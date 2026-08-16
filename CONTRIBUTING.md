# Contributing

**Balance HUD** is a small community plugin for DeepSeek Harness (DSH), maintained by its author.

## DSH ecosystem conventions

This repository follows the official DSH guidance for community plugins:

- **Own repository** — a plugin lives in its author's own GitHub repo (this one), not inside the official DSH codebase.
- **`dsh-plugin` topic** — the repo carries the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic so it can be discovered alongside other DSH plugins.
- **No upstream PRs** — the official DSH repository does not accept external pull requests; plugin code and fixes belong here instead.
- **No mandatory template** — DSH does not require a specific plugin scaffold. This repo keeps a minimal layout: `dynamic/` (no-build host + client) and `lib/` (static package).

## Reporting issues

Open an [issue](../../issues) and include:

- DSH version (see the UI or the version pinned in `README.md`)
- what you expected vs. what happened
- any console / devtools errors

## Pull requests

Pull requests are welcome for small, focused fixes. Please scope each PR to a single change and test it against the DSH version noted in `README.md` before submitting.

## Development

The plugin is plain JavaScript with no build step. See `README.md` for the two install modes (dynamic no-build and static package).
