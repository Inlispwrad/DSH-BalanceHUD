// DSH Balance Panel - browser half (web plugin table bundle).
// Registered with the kernel module loader exactly like shipped client
// bundles; requires other modules by id and exports the cordis plugin
// ({ apply, inject }). Reads the context-pressure projection for the HP bar
// and polls /dsh-balance-panel/state for balance + today's spend.
window.__ModuleLoader__.load({
  id: "dsh-balance-panel",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");

    // Package-owned stylesheet (same pattern shipped bundles use).
    var css = ".dsb-row{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance));max-width:var(--dsh-composer-card-max-width);margin:0 auto;padding:2px 20px 4px 0;display:flex;flex-direction:row;justify-content:flex-end;align-items:center;gap:16px;font-size:12px;line-height:1;color:var(--dsw-alias-label-secondary,#9aa0a6);user-select:none;}.dsb-item{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;}.dsb-label{color:var(--dsw-alias-label-secondary,#9aa0a6);font-size:11px;letter-spacing:.3px;}.dsb-gold{color:#facc15;font-weight:650;}.dsb-hp-track{display:inline-block;width:92px;height:12px;border-radius:6px;background:rgba(128,128,128,.22);overflow:hidden;vertical-align:middle;position:relative;}.dsb-hp-fill{display:block;height:100%;border-radius:6px;transition:width .4s ease;}.dsb-hp-fill.ok{background:#22c55e;}.dsb-hp-fill.warn{background:#eab308;}.dsb-hp-fill.low{background:#ef4444;}.dsb-hp-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:10px;line-height:12px;color:#fff;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.5);font-variant-numeric:tabular-nums;}.dsb-hp-nums{color:var(--dsw-alias-label-secondary,#9aa0a6);opacity:.55;font-size:11px;font-variant-numeric:tabular-nums;}";
    var cssTag = "dsh-balance-panel/dock.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTag) + "]") === null) {
      var styleTag = document.createElement("style");
      styleTag.dataset.plugin = "dsh-balance-panel";
      styleTag.dataset.pluginCss = cssTag;
      styleTag.textContent = css;
      document.head.appendChild(styleTag);
    }

    var STATE_URL = "/dsh-balance-panel/state";
    var inject = ["slots", "timer"];

    function fmtTokens(n) {
      if (n < 1000) return String(n);
      var scaled = function (v) { return v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10); };
      if (n < 1e6) return scaled(n / 1e3) + "K";
      return scaled(n / 1e6) + "M";
    }
    var CURRENCY_SYM = { CNY: "\u00a5", USD: "$", EUR: "\u20ac", GBP: "\u00a3", JPY: "\u00a5" };
    function fmtMoney(v, cur) {
      var sym = CURRENCY_SYM[cur] || (cur ? cur + " " : "\u00a5");
      if (v === 0) return sym + "0";
      var s;
      if (v >= 1) s = v.toFixed(2);
      else if (v >= 0.01) s = v.toFixed(3);
      else s = v.toFixed(4);
      return sym + s;
    }
    // HP curve: shown = r^3(4 - 3r), r = remaining fraction (1 - used fraction).
    // Stays high while context is efficient, collapses as it fills:
    // ~50% at 400K, ~10% at 700K, ~3% at 800K on a 1M window.
    function hpShownFromUsed(u) {
      var r = Math.min(1, Math.max(0, 1 - u));
      return r * r * r * (4 - 3 * r);
    }

    function sameState(a, b) {
      var sameBalance = a.balance === null && b.balance === null
        ? true
        : a.balance !== null && b.balance !== null
          ? a.balance.total === b.balance.total && a.balance.currency === b.balance.currency
          : false;
      return sameBalance && a.today.tokens === b.today.tokens && a.today.cost === b.today.cost;
    }

    function apply(ctx) {
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register(
          // Order 1: stay above the shipped dock strips (todo/goal/queue) so the
          // queue tucks to the composer card and this HUD rides above it.
          { name: "conversation.input.dock", id: "balance-panel", order: 1, label: "Balance Panel" },
          react.memo(function BalanceDock(props) {
            var pressure = props.useProjection ? props.useProjection("contextPressure") : undefined;
            var statePair = react.useState({ balance: null, today: { tokens: 0, cost: 0 } });
            var state = statePair[0];
            var setState = statePair[1];

            react.useEffect(function () {
              var alive = true;
              var refresh = function () {
                fetch(STATE_URL, { cache: "no-store" })
                  .then(function (r) {
                    if (!r.ok) throw new Error("HTTP " + r.status);
                    return r.json();
                  })
                  .then(function (v) {
                    if (alive && v) setState(function (prev) { return sameState(prev, v) ? prev : v; });
                  })
                  .catch(function () {});
              };
              refresh();
              var dispose = ctx.interval(refresh, 8000);
              return function () { alive = false; dispose(); };
            }, []);

            var hp = null;
            var used = pressure && (pressure.projectedTokens !== undefined ? pressure.projectedTokens : pressure.pressureTokens);
            if (used !== undefined && pressure && typeof pressure.contextWindow === "number" && pressure.contextWindow > 0) {
              var remaining = Math.max(0, pressure.contextWindow - used);
              var pct = Math.min(1, remaining / pressure.contextWindow);
              hp = { used: used, limit: pressure.contextWindow, pct: pct, shown: hpShownFromUsed(1 - pct) };
            }
            var hpCls = !hp ? "" : hp.shown > 0.5 ? "ok" : hp.shown > 0.2 ? "warn" : "low";

            var hpEl = react.createElement("span", {
              className: "dsb-item",
              title: hp ? ("Context " + hp.used.toLocaleString() + " / " + hp.limit.toLocaleString() + " tokens, " + Math.round(hp.pct * 100) + "% remaining") : "Context (no data yet)",
            },
              react.createElement("span", { className: "dsb-label" }, "HP"),
              react.createElement("span", { className: "dsb-hp-track" },
                hp ? react.createElement("span", { className: "dsb-hp-fill " + hpCls, style: { width: Math.round(hp.shown * 100) + "%" } }) : null,
                react.createElement("span", { className: "dsb-hp-pct" }, hp ? Math.round(hp.shown * 100) + "%" : "\u2014"),
              ),
              react.createElement("span", { className: "dsb-hp-nums" }, hp ? fmtTokens(hp.used) + "/" + fmtTokens(hp.limit) : "\u2014"),
            );

            var walletEl = react.createElement("span", { className: "dsb-item", title: "API balance" },
              react.createElement("span", { className: "dsb-label" }, "Wallet"),
              react.createElement("span", { className: "dsb-gold" },
                state.balance ? fmtMoney(state.balance.total, state.balance.currency) : "\u2014"),
            );

            var spendEl = react.createElement("span", { className: "dsb-item", title: "Today's tokens and cost" },
              react.createElement("span", { className: "dsb-label" }, "Spend"),
              react.createElement("span", null, fmtTokens(state.today.tokens) + " tok \u00b7 "),
              react.createElement("span", { className: "dsb-gold" }, fmtMoney(state.today.cost, "CNY")),
            );

            return react.createElement("div", { className: "dsb-row" }, hpEl, walletEl, spendEl);
          }, function () { return true; })
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
