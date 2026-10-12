# Publishing Task Model Advisor

How to ship releases to [Open VSX](https://open-vsx.org) (VSCodium, Gitpod, etc.) and optionally the [Visual Studio Marketplace](https://marketplace.visualstudio.com).

The extension `publisher` in `package.json` must match your registry namespace (`jft63`). Open VSX namespace settings: [jft63](https://open-vsx.org/user-settings/namespaces/jft63).

## Before you publish

```bash
npm ci
npm test
npm run lint
```

Bump `version` in `package.json` for each new release (registries reject duplicate versions).

## Package a `.vsix`

```bash
npm run package
```

Produces `task-model-advisor-<version>.vsix` in the repo root (`vsce package` + `vscode:prepublish` compile).

## Open VSX

Open VSX uses the **`ovsx`** CLI ([`ovsx` on npm](https://www.npmjs.com/package/ovsx)), **not** `@open-vsx/cli` (that package does not exist).

### One-time setup

1. Sign in at [open-vsx.org](https://open-vsx.org).
2. Create a **Personal Access Token**: [Access tokens](https://open-vsx.org/user-settings/tokens) with permission to publish under namespace `jft63`.

Optional: install the CLI as a dev dependency:

```bash
npm install -D ovsx
```

### Publish

Create a token at [Access tokens](https://open-vsx.org/user-settings/tokens), then set **`OVSX_PAT`** in your shell (do not commit it):

```bash
export OVSX_PAT="…"
```

From the extension root, after tests pass:

```bash
npm run package
npx ovsx publish
```

Or publish an existing `.vsix`:

```bash
npx ovsx publish task-model-advisor-0.3.0.vsix
```

After the first successful publish, the listing is typically:

`https://open-vsx.org/extension/jft63/task-model-advisor`

### Updates

1. Increment `version` in `package.json`.
2. `npm run package`
3. `export OVSX_PAT="…"` then `npx ovsx publish`.

## Visual Studio Marketplace (separate registry)

`npm run publish` runs **`vsce publish`**, which targets the **Microsoft** Marketplace only. It does **not** upload to Open VSX.

You need a [Microsoft publisher](https://marketplace.visualstudio.com/manage) and an Azure DevOps PAT with Marketplace **Manage** scope. Then:

```bash
npm run package
npx vsce publish -p YOUR_AZURE_DEVOPS_PAT
```

You can publish the same `.vsix` to both Open VSX and the VS Marketplace; each registry has its own token and portal.

## CI (optional)

A common GitHub Actions pattern:

- Store `OVSX_PAT` as a repository secret.
- On release tag or manual workflow: `npm ci`, `npm test`, `npx ovsx publish`.

This repo does not include that workflow yet; add it when you want automated Open VSX releases.

## Related

- Owner checklist and manual test matrix: [CONTRIBUTING.md — Release](../CONTRIBUTING.md#release)
- Rebuild demo GIFs after UI changes: [docs/images/README.md](images/README.md)
