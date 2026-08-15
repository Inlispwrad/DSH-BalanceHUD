# Balance HUD

A tiny HUD for DeepSeek Harness, docked above the composer input:

```
HP [97% ██████████] 137.8K/1M    Wallet ¥110.00    Spend 12.3K tok · ¥0.0432
```

- **HP** — remaining effective context (the usable capacity left in the context window), drawn as a health bar. It holds near full while the context is efficient, then collapses as the window fills: ≈50% at 400K, ≈10% at 700K, ≈3% at 800K on a 1M-token window.
- **Wallet** — your DeepSeek API account balance.
- **Spend** — today's token count and estimated cost.

Developed and tested on DSH `0.1.0-rc.6`.

## Install

**Dynamic (no build)** — in a `cordis` session, `cordis_define` with [`dynamic/host.js`](dynamic/host.js) (host) and [`dynamic/client.js`](dynamic/client.js) (client), then `cordis_run`.

**Static** — copy this package to `~/.dsh/profiles/web/packages/`, add `"dsh-balance-panel": "file:./packages/dsh-balance-panel"` to the profile `package.json`, append to `cordis.patch.yml`:

```yaml
- insert:
    - id: balance-panel
      name: dsh-balance-panel
```

then restart DSH.

## License

[MIT](LICENSE)