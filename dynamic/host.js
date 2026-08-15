// DSH Balance Panel - DYNAMIC host half.
// Paste this whole body into `cordis_define` (code.host) inside a session
// running the `cordis` agent preset, then `cordis_run`.
// Behavior: ledger of today's tokens/cost from every llm/stream call + the
// DeepSeek API balance, served to the client via the Package-private
// `get-state` RPC. Balance needs the DEEPSEEK_API_KEY credential.
return {
  apply(ctx) {
    // ---- Pricing (CNY per 1M tokens); DeepSeek uses dynamic peak/off-peak
    // pricing since 2026-08-17, so this is an editable reference estimate. ----
    const PRICING = {
      'deepseek-v4-flash': { input: 2.0, cacheRead: 0.5, cacheWrite: 2.0, output: 4.0 },
      'deepseek-chat': { input: 1.0, cacheRead: 0.1, cacheWrite: 1.0, output: 2.0 },
      'deepseek-reasoner': { input: 4.0, cacheRead: 1.0, cacheWrite: 4.0, output: 16.0 },
    }
    const FALLBACK_PRICE = { input: 2.0, cacheRead: 0.5, cacheWrite: 2.0, output: 4.0 }

    const dayKey = () => {
      const d = new Date()
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    }
    let ledger = { date: dayKey(), input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }

    function recordUsage(model, usage) {
      const now = dayKey()
      if (now !== ledger.date) {
        ledger = { date: now, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
      }
      const p = PRICING[model] || FALLBACK_PRICE
      const inputTokens = usage.inputTokens || 0
      const readTokens = usage.cacheReadTokens || 0
      const writeTokens = usage.cacheWriteTokens || 0
      const outputTokens = usage.outputTokens || 0
      ledger.input += inputTokens + readTokens + writeTokens
      ledger.output += outputTokens
      ledger.cacheRead += readTokens
      ledger.cacheWrite += writeTokens
      ledger.cost += (inputTokens * p.input + readTokens * p.cacheRead + writeTokens * p.cacheWrite + outputTokens * p.output) / 1e6
    }

    let balanceCache = { at: 0, value: null }
    let balanceFetching = null

    async function fetchBalanceNow() {
      const credentials = ctx.get('credentials')
      const subprocess = ctx.get('subprocess')
      if (credentials === undefined || subprocess === undefined) return null
      let cred
      try {
        cred = await credentials.resolve('DEEPSEEK_API_KEY')
      } catch (err) {
        console.error('balances: credentials.resolve failed', err)
        return null
      }
      if (!cred || !cred.value) return null
      const sandboxPolicy = ctx.get('sandboxPolicy')
      const cwd = sandboxPolicy && sandboxPolicy.workspaceRoot ? sandboxPolicy.workspaceRoot : '.'
      try {
        const handle = subprocess.spawn({
          argv: ['curl.exe', '-s', '-L', '--max-time', '15', '--header', '@-', 'https://api.deepseek.com/user/balance'],
          cwd,
          stdio: {
            stdin: { data: 'Authorization: Bearer ' + cred.value + '\n' },
            stdout: { maxBytes: 16384 },
            stderr: { maxBytes: 4096 },
          },
          graceMs: 5000,
        })
        const outcome = await handle.done
        if (outcome.exitCode !== 0) return null
        const text = handle.collected.stdout.readFrom(0).text
        const data = JSON.parse(text)
        const infos = data && Array.isArray(data.balance_infos) ? data.balance_infos : []
        const info = infos[0]
        if (!info) return null
        const total = Number(info.total_balance)
        if (!Number.isFinite(total)) return null
        return { currency: String(info.currency || 'CNY'), total }
      } catch (err) {
        console.error('balances: fetch failed', err)
        return null
      }
    }

    // 60s cache + single-flight (concurrent get-state share one fetch)
    function currentBalance() {
      const now = Date.now()
      if (now - balanceCache.at < 60000) return Promise.resolve(balanceCache.value)
      if (balanceFetching !== null) return balanceFetching
      balanceFetching = fetchBalanceNow()
        .then((value) => {
          balanceCache = { at: Date.now(), value }
          return value
        })
        .finally(() => {
          balanceFetching = null
        })
      return balanceFetching
    }

    ctx.on('llm/stream', (options, next) => {
      const model = options && options.model ? options.model : 'unknown'
      return (async function* () {
        for await (const chunk of next()) {
          if (chunk && chunk.type === 'usage' && chunk.usage) {
            try {
              recordUsage(model, chunk.usage)
            } catch (err) {
              console.error('balances: usage record failed', err)
            }
          }
          yield chunk
        }
      })()
    })

    harness.handle('get-state', async () => {
      const balance = await currentBalance()
      const now = dayKey()
      const t = ledger.date === now ? ledger : { date: now, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
      return {
        balance,
        today: {
          tokens: t.input + t.output,
          input: t.input,
          output: t.output,
          cost: t.cost,
        },
      }
    })

    console.log('balances: host ready')
  },
}
