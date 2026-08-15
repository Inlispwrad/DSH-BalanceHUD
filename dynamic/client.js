// DSH Balance Panel - DYNAMIC client half.
// Paste this whole body into `cordis_define` (code.client), English UI.
// Registers into conversation.input.dock: HP bar (context remaining) with the
// eased percentage inside the bar, API balance and today's spend in yellow.
return {
  inject: ['timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    styles.insert(`
      .dsb-row{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance));max-width:var(--dsh-composer-card-max-width);margin:0 auto;padding:2px 20px 4px 0;display:flex;flex-direction:row;justify-content:flex-end;align-items:center;gap:16px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary,#9aa0a6);user-select:none;}
      .dsb-item{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;}
      .dsb-label{color:var(--dsw-alias-label-secondary,#9aa0a6);font-size:11px;letter-spacing:.3px;}
      .dsb-gold{color:#facc15;font-weight:650;}
      .dsb-hp-track{display:inline-block;width:92px;height:12px;border-radius:6px;background:rgba(128,128,128,.22);overflow:hidden;vertical-align:middle;position:relative;}
      .dsb-hp-fill{display:block;height:100%;border-radius:6px;transition:width .4s ease;}
      .dsb-hp-fill.ok{background:#22c55e;}
      .dsb-hp-fill.warn{background:#eab308;}
      .dsb-hp-fill.low{background:#ef4444;}
      .dsb-hp-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;line-height:12px;color:#fff;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.5);font-variant-numeric:tabular-nums;}
      .dsb-hp-nums{color:var(--dsw-alias-label-secondary,#9aa0a6);opacity:.55;font-size:11px;font-variant-numeric:tabular-nums;}
    `)

    const fmtTokens = (n) => {
      if (n < 1000) return String(n)
      const scaled = (v) => (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))
      if (n < 1e6) return scaled(n / 1e3) + 'K'
      return scaled(n / 1e6) + 'M'
    }
    const CURRENCY_SYM = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }
    const fmtMoney = (v, cur) => {
      const sym = CURRENCY_SYM[cur] || (cur ? cur + ' ' : '¥')
      if (v === 0) return sym + '0'
      let s
      if (v >= 1) s = v.toFixed(2)
      else if (v >= 0.01) s = v.toFixed(3)
      else s = v.toFixed(4)
      return sym + s
    }

    // HP curve: shown = r^3(4 - 3r), r = remaining fraction.
    const hpShownFromUsed = (u) => {
      const r = Math.min(1, Math.max(0, 1 - u))
      return r * r * r * (4 - 3 * r)
    }

    const BalancesDock = React.memo(function BalancesDock(props) {
      const pressure = props.useProjection ? props.useProjection('contextPressure') : undefined
      const [state, setState] = React.useState({ balance: null, today: { tokens: 0, cost: 0 } })

      React.useEffect(() => {
        let alive = true
        const sameState = (a, b) => {
          const sameBalance = a.balance === null && b.balance === null
            ? true
            : a.balance !== null && b.balance !== null
              ? a.balance.total === b.balance.total && a.balance.currency === b.balance.currency
              : false
          return sameBalance && a.today.tokens === b.today.tokens && a.today.cost === b.today.cost
        }
        const refresh = () => {
          host.call('get-state').then((v) => {
            if (!alive || !v) return
            setState((prev) => (sameState(prev, v) ? prev : v))
          }).catch(() => {})
        }
        refresh()
        const dispose = ctx.interval(refresh, 8000)
        return () => { alive = false; dispose() }
      }, [])

      let hp = null
      const used = pressure && (pressure.projectedTokens !== undefined ? pressure.projectedTokens : pressure.pressureTokens)
      if (used !== undefined && pressure && typeof pressure.contextWindow === 'number' && pressure.contextWindow > 0) {
        const remaining = Math.max(0, pressure.contextWindow - used)
        const pct = Math.min(1, remaining / pressure.contextWindow)
        hp = { used, limit: pressure.contextWindow, pct, shown: hpShownFromUsed(1 - pct) }
      }
      const hpCls = !hp ? '' : hp.shown > 0.5 ? 'ok' : hp.shown > 0.2 ? 'warn' : 'low'

      const hpEl = React.createElement('span', {
        className: 'dsb-item',
        title: hp ? ('Context ' + hp.used.toLocaleString() + ' / ' + hp.limit.toLocaleString() + ' tokens, ' + Math.round(hp.pct * 100) + '% remaining') : 'Context (no data yet)',
      },
        React.createElement('span', { className: 'dsb-label' }, 'HP'),
        React.createElement('span', { className: 'dsb-hp-track' },
          hp ? React.createElement('span', { className: 'dsb-hp-fill ' + hpCls, style: { width: Math.round(hp.shown * 100) + '%' } }) : null,
          React.createElement('span', { className: 'dsb-hp-pct' }, hp ? Math.round(hp.shown * 100) + '%' : '—'),
        ),
        React.createElement('span', { className: 'dsb-hp-nums' }, hp ? fmtTokens(hp.used) + '/' + fmtTokens(hp.limit) : '—'),
      )

      const walletEl = React.createElement('span', { className: 'dsb-item', title: 'API balance' },
        React.createElement('span', { className: 'dsb-label' }, 'Wallet'),
        React.createElement('span', { className: 'dsb-gold' },
          state.balance ? fmtMoney(state.balance.total, state.balance.currency) : '—'),
      )

      const spendEl = React.createElement('span', { className: 'dsb-item', title: "Today's tokens and cost" },
        React.createElement('span', { className: 'dsb-label' }, 'Spend'),
        React.createElement('span', null, fmtTokens(state.today.tokens) + ' tok · '),
        React.createElement('span', { className: 'dsb-gold' }, fmtMoney(state.today.cost, 'CNY')),
      )

      return React.createElement('div', { className: 'dsb-row' }, hpEl, walletEl, spendEl)
    }, () => true)

    // Order 1: stay ABOVE the shipped dock strips (todo/goal/queue). When the
    // queue strip appears it tucks against the composer card as designed and
    // this HUD simply rides above it - no overlap, no crowding.
    slots.inject('conversation.input.dock', () => slots.register(
      { name: 'conversation.input.dock', id: 'balances', order: 1, label: 'Balances' },
      BalancesDock,
    ))
  },
}
