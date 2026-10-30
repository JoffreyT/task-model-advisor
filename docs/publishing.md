# Publishing Task Model Advisor

Two registries, one `.vsix`:

| Where it shows up  | Registry                                                          | Command            |
| ------------------ | ----------------------------------------------------------------- | ------------------ |
| VS Code Extensions | [Visual Studio Marketplace](https://marketplace.visualstudio.com) | `npm run publish`  |
| Cursor Extensions  | [Open VSX](https://open-vsx.org) (Cursor reads this registry)     | `npx ovsx publish` |

`publisher` in `package.json` is `jft63`. It must match both accounts.

## Publish a release

Put the tokens in a gitignored `.env` at the repo root (`cp .env.example .env`), then:

```bash
python3 scripts/publish.py
```

The script reads `.env` when those variables are not already in the shell. A new terminal does not keep `export`s from an older one.

The script bumps the patch version (`0.3.0` → `0.3.1`), asks for confirmation, then runs `npm test`, `npm run package`, `npm run publish`, and `npx ovsx publish` on `task-model-advisor-<version>.vsix`. Both registries reject a version that already exists. Pass `--version 0.4.0` to choose the number, or `--no-bump` if `package.json` is already updated. `--yes` skips the prompt.

`npm run publish` is `vsce publish` and only uploads to the Marketplace. Cursor reads Open VSX, so the release is missing there until `ovsx` succeeds. If the Marketplace step works and Open VSX fails, do not run `npm run publish` again. Retry only:

```bash
npx ovsx publish task-model-advisor-<version>.vsix
```

Listings:

- VS Code: `https://marketplace.visualstudio.com/items?itemName=jft63.task-model-advisor`
- Cursor / Open VSX: `https://open-vsx.org/extension/jft63/task-model-advisor`

## One-time tokens

**VS Code Marketplace** — [publisher management](https://marketplace.visualstudio.com/manage). Create publisher `jft63`, then an Azure DevOps PAT with Marketplace **Manage**. Save it as `VSCE_PAT` in `.env`. `vsce login` also stores this PAT in the macOS keychain (service `vscode-vsce`), which is why `npm run publish` can succeed without the variable.

**Cursor (Open VSX)** — sign in at [open-vsx.org](https://open-vsx.org), then create a token at [Access tokens](https://open-vsx.org/user-settings/tokens). Namespace settings: [jft63](https://open-vsx.org/user-settings/namespaces/jft63). Save it as `OVSX_PAT` in `.env`.

The publisher is `ovsx`, not `@open-vsx/cli`. If the namespace does not exist yet:

```bash
npx ovsx create-namespace jft63 -p "$OVSX_PAT"
```

## Related

- Owner checklist and manual test matrix: [CONTRIBUTING.md — Release](../CONTRIBUTING.md#release)
- Rebuild demo GIFs after UI changes: [docs/images/README.md](images/README.md)
