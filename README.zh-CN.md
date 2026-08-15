# Balance HUD(余额面板)

DeepSeek Harness 的迷你 HUD,固定在输入框正上方:

```
HP [97% ██████████] 137.8K/1M    Wallet ¥110.00    Spend 12.3K tok · ¥0.0432
```

- **HP** —— 剩余有效上下文(上下文窗口中仍可用的容量),以血槽显示。上下文高效时几乎不掉血,随窗口占满急剧崩落:1M 窗口下约 400K→50%、700K→10%、800K→3%。
- **Wallet** —— DeepSeek API 账户余额。
- **Spend** —— 今日 Token 数与估算金额。

开发与测试于 DSH `0.1.0-rc.6`。

## 安装

**动态(无需构建)** —— 在 `cordis` 会话中,`cordis_define` 的 host/client 分别填入 [`dynamic/host.js`](dynamic/host.js)、[`dynamic/client.js`](dynamic/client.js),然后 `cordis_run`。

**静态** —— 把本包复制到 `~/.dsh/profiles/web/packages/`,在 profile 的 `package.json` 加入 `"dsh-balance-panel": "file:./packages/dsh-balance-panel"`,并在 `cordis.patch.yml` 追加下面内容,重启 DSH:

```yaml
- insert:
    - id: balance-panel
      name: dsh-balance-panel
```

## 许可证

[MIT](LICENSE)