# DSH-余额面板(DSH Balance Panel)

## 关于

DSH-余额面板是 **DeepSeek Harness** 的插件,用来便捷查看当前用量。它在输入框正上方维持一个紧凑 HUD,包含三项读数 —— **HP**:剩余上下文(血槽显示)、**Wallet**:DeepSeek API 账户余额、**Spend**:今日 Token 数与估算金额 —— 不用离开对话就能一眼掌握。

```
HP [97% ██████████] 137.8K/1M    Wallet ¥110.00    Spend 12.3K tok · ¥0.0432
```

- **HP** — 上下文剩余,以血槽形式显示,按显示值变色(>50% 绿、20–50% 黄、≤20% 红)。经缓动后的百分比显示在槽内,槽右侧用淡色显示真实的 `已用/上限` tokens。
- **Wallet** — DeepSeek API 余额,黄色数字。
- **Spend** — 今日 Token 数与估算金额,金额为黄色。

HP 曲线:`shown = r³(4 − 3r)`,r 为剩余比例 —— 上下文高效时几乎不掉血,接近占满时急剧崩落(1M 窗口下约 400K→50%、700K→10%、800K→3%)。

## 环境要求

- 带 Web GUI 的 DSH(DeepSeek Harness)部署。
- 余额需要已配置 `DEEPSEEK_API_KEY` 凭据(Models 设置页);未配置时其余两项照常工作。

## 快速开始(动态方式,无需构建)

在任何运行 `cordis` agent preset 的设备上:

1. 打开一个使用 `cordis` preset 的会话。
2. 调用 `cordis_define`,`code.host` 填入 [`dynamic/host.js`](dynamic/host.js) 的内容,`code.client` 填入 [`dynamic/client.js`](dynamic/client.js) 的内容(idPrefix:`blnc`)。
3. 调用 `cordis_run` 并批准运行。

面板即出现在输入框上方。

## 静态安装(正式方式)

以双面包插件形式挂载到 web profile:

1. 把本包复制到 profile,例如 `~/.dsh/profiles/web/packages/dsh-balance-panel`。
2. 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 中加入 `"dsh-balance-panel": "file:./packages/dsh-balance-panel"`,然后在该目录执行 `pnpm install`。
3. 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加一行配置:

   ```yaml
   - insert:
       - id: balance-panel
         name: dsh-balance-panel
   ```

4. 重启 DSH。

Node 半边(`lib/index.js`)负责记账、抓取余额,并提供 `GET /dsh-balance-panel/state`(JSON)。浏览器半边(`lib/client.js`)是标准的 `dsh.client` web 插件表 bundle:通过 `contextPressure` 投影读取 HP,并轮询该状态路由。

## 说明

- **金额是估算值。** DeepSeek 自 2026-08-17 起实行峰谷动态定价;参考单价在 `lib/index.js` / `dynamic/host.js` 顶部的 `PRICING` 表中,请按你的实际模型与时段修改。
- 余额缓存 60 秒;未配置 key 或网络失败时显示 `—`。
- 「今日」账本跨零点清零,且为进程内数据(重启后重置)。

## 许可证

[MIT](LICENSE)
