// DSH Balance Panel - host half (static cordis plugin, ESM).
// Tracks today's token/cost spend from every llm/stream call, fetches the
// DeepSeek API balance, and serves both to the browser half over an HTTP
// state route (no typert codegen needed). Mount this package as a row in the
// DSH composition; the browser half is discovered via the package.json
// `dsh.client` declaration and exports["./client"].

// ---- Pricing (CNY per 1M tokens). DeepSeek switched to dynamic
// peak/off-peak pricing on 2026-08-17; these are reference rates and the
// cost figure is an estimate. Edit to match your account/model.
const PRICING = {
  'deepseek-v4-flash': { input: 2.0, cacheRead: 0.5, cacheWrite: 2.0, output: 4.0 },
  'deepseek-chat': { input: 1.0, cacheRead: 0.1, cacheWrite: 1.0, output: 2.0 },
  'deepseek-reasoner': { input: 4.0, cacheRead: 1.0, cacheWrite: 4.0, output: 16.0 },
}
const FALLBACK_PRICE = { input: 2.0, cacheRead: 0.5, cacheWrite: 2.0, output: 4.0 }

// Browser half polls this exact route for { balance, today }.
const STATE_PATH = '/dsh-balance-panel/state'

// curl is the only external dependency; resolve per-platform.
const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl'

const dayKey = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function apply(ctx) {
  let ledger = { date: dayKey(), input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
  let balanceCache = { at: 0, value: null }
  let balanceFetching = null

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

  async function fetchBalanceNow() {
    const credentials = ctx.get('credentials')
    const subprocess = ctx.get('subprocess')
    if (credentials === undefined || subprocess === undefined) return null
    let cred
    try {
      cred = await credentials.resolve('DEEPSEEK_API_KEY')
    } catch (err) {
      console.error('[dsh-balance-panel] credentials.resolve failed', err)
      return null
    }
    if (!cred || !cred.value) return null
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const cwd = sandboxPolicy && sandboxPolicy.workspaceRoot ? sandboxPolicy.workspaceRoot : '.'
    try {
      const handle = subprocess.spawn({
        argv: [CURL, '-s', '-L', '--max-time', '15', '--header', '@-', 'https://api.deepseek.com/user/balance'],
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
      console.error('[dsh-balance-panel] balance fetch failed', err)
      return null
    }
  }

  // 60s cache + single-flight: concurrent polls share one in-flight fetch.
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

  // Ledger every streaming model call (waterfall passthrough).
  ctx.on('llm/stream', (options, next) => {
    const model = options && options.model ? options.model : 'unknown'
    return (async function* () {
      for await (const chunk of next()) {
        if (chunk && chunk.type === 'usage' && chunk.usage) {
          try {
            recordUsage(model, chunk.usage)
          } catch (err) {
            console.error('[dsh-balance-panel] usage record failed', err)
          }
        }
        yield chunk
      }
    })()
  })

  // Serve the state the browser half polls.
  const webServer = ctx.get('webServer')
  if (webServer !== undefined) {
    webServer.register({
      kind: 'exact',
      path: STATE_PATH,
      handler: async (_req, res) => {
        try {
          const balance = await currentBalance()
          const now = dayKey()
          const t = ledger.date === now ? ledger : { date: now, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
          res.writeHead(200, {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          })
          res.end(JSON.stringify({
            balance,
            today: {
              tokens: t.input + t.output,
              input: t.input,
              output: t.output,
              cost: t.cost,
            },
          }))
        } catch (err) {
          res.writeHead(500, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: String((err && err.message) || err) }))
        }
      },
    })
  }

  console.log('[dsh-balance-panel] host ready')
}
