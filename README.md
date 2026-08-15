# DSH Balance Panel

A small panel above the composer input showing your current usage at a glance:

```
HP [97% ██████████] 137.8K/1M    Wallet ¥110.00    Spend 12.3K tok · ¥0.0432
```

- **HP** — context remaining as a health bar, color-coded by the displayed value
  (green > 50%, yellow 20–50%, red ≤ 20%). The eased percentage is drawn inside
  the bar; the real `used/limit` tokens sit beside it in a muted tone.
- **Wallet** — your DeepSeek API balance, in yellow.
- **Spend** — today's token count and estimated cost, cost in yellow.

The HP curve is `shown = r³(4 − 3r)` on the remaining fraction: it stays high
while context is efficient and collapses as the window fills (≈50% at 400K,
≈10% at 700K, ≈3% at 800K on a 1M-token window).

## Requirements

- A DSH (DeepSeek Harness) deployment with the web GUI.
- The `DEEPSEEK_API_KEY` credential configured (Models settings page) for the
  balance to work — the other two sections work without it.

## Quick start (dynamic, no build)

On any device with the `cordis` agent preset:

1. Open a session with the `cordis` preset.
2. Call `cordis_define` with `code.host` = contents of
   [`dynamic/host.js`](dynamic/host.js) and `code.client` = contents of
   [`dynamic/client.js`](dynamic/client.js) (idPrefix: `blnc`).
3. Call `cordis_run` and approve the run.

The panel appears above the input box.

## Static install (proper)

Mount it as a dual-face plugin package in the web profile:

1. Copy this package into the profile, e.g.
   `~/.dsh/profiles/web/packages/dsh-balance-panel`.
2. In `~/.dsh/profiles/web/package.json` add
   `"dsh-balance-panel": "file:./packages/dsh-balance-panel"` to
   `dependencies`, then run `pnpm install` in that directory.
3. Append a row to `~/.dsh/profiles/web/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: balance-panel
         name: dsh-balance-panel
   ```

4. Restart DSH.

The node half (`lib/index.js`) tracks the ledger, fetches the balance, and
serves `GET /dsh-balance-panel/state` (JSON). The browser half
(`lib/client.js`) is a standard `dsh.client` web-plugin-table bundle: it reads
the `contextPressure` projection for the HP bar and polls the state route.

## Notes

- **Cost is an estimate.** DeepSeek moved to dynamic peak/off-peak pricing
  (2026-08-17); the reference rates live in the `PRICING` table at the top of
  `lib/index.js` / `dynamic/host.js` — edit them to match your account.
- Balance is cached for 60 s; a missing key or network failure shows `—`.
- The "today" ledger resets at midnight and is process-local (reset on restart).

## License

[MIT](LICENSE)
