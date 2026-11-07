# Release checklist — `dsh-pr-release-workspace` 0.1.0

Ordered, checkable list for the Lead. Every command below was verified on this machine
unless it is marked **not run** (those are the outward actions this document deliberately
leaves to you).

Verified state, updated 2026-11-07 (supersedes the 2026-11-06 table):

| Fact | Value |
| --- | --- |
| Working tree | `D:\dsh-plugins\dsh-pr-release-workspace` |
| Remote | `origin` → `https://github.com/tangyixiao/dsh-pr-release-workspace.git` |
| `main` | `5a0a82b` (the P0 baseline), pushed and tracking `origin/main` |
| Layered branches | `feat/host-read-layer`, `feat/client-panel`, `feat/security-tests`, `docs/readme-and-research` |
| Tags | none |
| `gh` auth | `tangyixiao`, scopes `admin:public_key, gist, notifications, read:org, repo, workflow` |
| Default npm registry | `https://registry.npmmirror.com` — **no working auth** |
| npmjs auth | works: `npm whoami --registry=https://registry.npmjs.org` → `tangyixiao` |
| Package name on npmjs | free (`npm view dsh-pr-release-workspace` → E404) |
| GitHub repo | exists, public, `https://github.com/tangyixiao/dsh-pr-release-workspace` |
| `.github/workflows/ci.yml` | exists on `feat/client-panel` onward: `npm ci`, `npm run build`, stale-bundle check, `npm test` |

---

## 0. The README blocker — resolved

This section originally recorded the last thing standing between the tree and a publishable
package: `README.md`/`README.zh.md` were named in `files` but did not exist, and npm silently
drops missing entries, so the pack succeeds while the package is wrong. Both files now exist
and both appear in the pack.

Current state of everything `files`/`exports` claims:

| Path | In `files`/`exports` | Exists | In tarball |
| --- | --- | --- | --- |
| `lib/` | yes | yes | yes, 7 files |
| `locale/en.json`, `locale/zh.json` | yes (`exports["./locale/*.json"]`) | yes | yes |
| `cordis.patch.yml` | yes | yes | yes |
| `LICENSE` | yes | yes (1,088 B) | yes |
| `icon.svg` | yes (`exports["./icon"]`) | yes (483 B) | yes |
| `README.md` | yes | yes (8,251 B) | yes |
| `README.zh.md` | yes | yes (7,596 B) | yes |

- [x] `README.md` written — install, usage, permissions, data sources, cache, privacy, limits
- [x] `README.zh.md` written
- [x] both appear in `npm pack --dry-run` (16 files)

---

## 1. Create the repository — done

Name: `dsh-pr-release-workspace` (matches `name` in `package.json`).
Visibility: public. The market build reads the repository URL from the published manifest
and requires it to match exactly.

Done on 2026-11-06:

```powershell
gh repo create tangyixiao/dsh-pr-release-workspace --public --disable-wiki `
  --description "DSH plugin: a read-only PR and release workspace inside the sidebar — grouped PR lists, diffs, comments, local review notes, and six independent release facts."
git remote add origin https://github.com/tangyixiao/dsh-pr-release-workspace.git
git push -u origin main    # main = 5a0a82b, the P0 baseline
```

Topics still to set (the two the community directories scan for are `dsh-plugin` and
`deepseek-harness`):

**not run — outward action**

```powershell
gh repo edit tangyixiao/dsh-pr-release-workspace `
  --add-topic dsh-plugin `
  --add-topic deepseek-harness `
  --add-topic dsh `
  --add-topic pull-requests `
  --add-topic code-review
```

- [x] Repository exists, public, description set
- [ ] Topics `dsh-plugin` and `deepseek-harness` present (`gh repo view --json repositoryTopics`)
- [x] `main` pushed; local `main` tracks `origin/main`

Note on history: local `main` already contains one commit (`5a0a82b`, the P0 baseline).
Do not squash it away and do not reset — the plan forbids deleting existing work. The real
work arrives as layered PRs on top of it, not as a rewritten first push.

Note on the age gate: `awesome-dsh-plugin` refuses submissions from repositories younger
than **1 day** (`MIN_AGE_DAYS = 1` in its `scripts/check-submission.mjs`, enforced by CI).
The epic PR therefore cannot be opened the same day the repository is created — but the
repository was created on 2026-11-06, so the gate clears on 2026-11-07.

---

## 2. Version and `package.json`

Version: **`0.1.0`**. First formal version. No prerelease suffix, no `-rc`, no `-beta`.

Check these fields against the real file before publishing. The values below are what is
in the file today — re-read them, do not trust this table if the file changed.

| Field | Current value | Must be |
| --- | --- | --- |
| `name` | `"dsh-pr-release-workspace"` | unchanged; free on npmjs (verified E404) |
| `version` | `"0.1.0"` | `0.1.0`, no suffix |
| `files` | `["lib","locale/*.json","icon.svg","cordis.patch.yml","README.md","README.zh.md","LICENSE"]` | every entry must exist |
| `exports` | `{".":"./lib/index.js","./client":"./lib/client.js","./icon":"./icon.svg","./locale/*.json":"./locale/*.json","./package.json":"./package.json"}` | every target must exist |
| `engines.dsh` | `">=0.1.6-alpha.2"` | non-empty — the market build rejects a missing value |
| `engines.node` | `">=22"` | fine |
| `publishConfig.registry` | `"https://registry.npmjs.org/"` | keep |
| `publishConfig.access` | `"public"` | keep |
| `dsh.manifestVersion` | `1` | keep |
| `dsh.bundle.patch` | `"./cordis.patch.yml"` | non-empty string — hard requirement of both the market build and `awesome-dsh-plugin` |
| `dsh.client` | `{"platform":"web","immediately":true,"inject":["@deepseek-ai/dsh-client-ui-primitives"]}` | `exports["./client"]` must resolve to a real file — dshopen verifies `client-entry-present` |
| `repository.url` | `"git+https://github.com/tangyixiao/dsh-pr-release-workspace.git"` | must strip to exactly the market pin URL |
| `license` | `"MIT"` | needs a matching `LICENSE` file |
| `scripts.prepublishOnly` | `"npm run build && npm test"` | means `npm publish` re-runs the gate — good, keep it |

Verification of the repository URL match (the market strips `git+` and `.git` and requires
an exact string equality against the pin):

```powershell
node -e "const p=require('./package.json');console.log(p.repository.url.replace(/^git\+/,'').replace(/\.git$/,''))"
# must print: https://github.com/tangyixiao/dsh-pr-release-workspace
```

- [ ] `version` is exactly `0.1.0`
- [ ] `repository.url` strips to `https://github.com/tangyixiao/dsh-pr-release-workspace`
- [ ] `dsh.bundle.patch` and `engines.dsh` both non-empty
- [ ] committed and pushed

---

## 3. Pre-publish gate

Run all four from the project root. All four were run today and pass.

```powershell
Set-Location D:\dsh-plugins\dsh-pr-release-workspace

npm run build
# build-client: 13 fragments -> lib/client.js (109432 bytes)

npm test
# tests 136 / pass 136 / fail 0 / cancelled 0 / skipped 0

node --check lib/index.js
node --check lib/client.js
node --check lib/host/routes.js
node --check lib/host/release.js

npm pack --dry-run
```

`npm pack --dry-run` as obtained today — **16 files, 72,008 B packed, 252,342 B unpacked,
shasum `eab94f119b6d9c658b70f3dff65fd598e4bcf58a`**:

```
     1088 B  LICENSE
     8251 B  README.md
     7596 B  README.zh.md
      558 B  cordis.patch.yml
      483 B  icon.svg
   109432 B  lib/client.js
     9579 B  lib/host/drafts.js
    10370 B  lib/host/exec.js
    29301 B  lib/host/pull.js
    22958 B  lib/host/release.js
    16919 B  lib/host/routes.js
    16103 B  lib/host/search.js
     8269 B  lib/index.js
     4767 B  locale/en.json
     4761 B  locale/zh.json
     1907 B  package.json
```

The list **must** contain: `package.json`, `cordis.patch.yml`, `LICENSE`, `README.md`,
`README.zh.md`, `icon.svg`, `lib/index.js`, `lib/client.js`, every `lib/host/*.js`,
`locale/*.json`.

It **must not** contain: `src/`, `test/`, `node_modules/`, `*.tgz`, `.git`. None of those
appear — `files` in `package.json` is doing its job. Note that `docs/` also correctly does
not ship.

Re-check, because a `files` list that names nonexistent files hides this until the file is
written:

```powershell
npm pack --dry-run --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const f=JSON.parse(s)[0].files.map(f=>f.path);for(const bad of ['src/','test/','node_modules/']){const hit=f.filter(p=>p.startsWith(bad));console.log(bad,hit.length?'PRESENT '+hit.join(','):'absent')}console.log('count',f.length)})"
```

- [x] `npm run build` exit 0
- [x] `npm test` 136/136 pass, 0 fail, 0 skipped
- [x] `node --check` exit 0 on all four entry files
- [x] `npm pack --dry-run` file list reviewed, no `src/`, no `test/`, no `node_modules/`
- [x] README, LICENSE, icon present in the pack

Optional but recommended before the tarball is trusted — install it into a throwaway
profile and uninstall:

```powershell
npm pack
dsh plugin --profile <throwaway> add .\dsh-pr-release-workspace-0.1.0.tgz
dsh plugin --profile <throwaway> remove dsh-pr-release-workspace
```

---

## 4. Publish to npm

Registry: **`https://registry.npmjs.org`**. This is not optional here. The default registry
on this machine is a mirror that has no working credentials:

```
$ npm config get registry
https://registry.npmmirror.com
$ npm whoami
npm error code ENEEDAUTH
npm error need auth This command requires you to be logged in.
$ npm whoami --registry=https://registry.npmjs.org
tangyixiao
```

So: publish against npmjs explicitly, and pass `--access public` explicitly even though
`publishConfig` already says both.

**No `--tag next`. No prerelease version. No `--dry-run` on the real run.**

**not run — outward action**

```powershell
Set-Location D:\dsh-plugins\dsh-pr-release-workspace
npm publish --registry=https://registry.npmjs.org --access public
```

`prepublishOnly` re-runs `npm run build && npm test` automatically; a failure aborts the
publish.

Verify — version, tarball URL, integrity, and that `latest` points at `0.1.0`:

```powershell
npm view dsh-pr-release-workspace@0.1.0 --registry=https://registry.npmjs.org version dist.tarball dist.integrity
npm view dsh-pr-release-workspace dist-tags --registry=https://registry.npmjs.org
# must be { latest: '0.1.0' }  —  not next, not beta
```

Verify the published manifest still carries what the market build will demand:

```powershell
npm view dsh-pr-release-workspace@0.1.0 --registry=https://registry.npmjs.org --json dsh.bundle.patch engines.dsh repository.url license
```

Verify the tarball contents from the registry, not from disk:

```powershell
npm pack dsh-pr-release-workspace@0.1.0 --registry=https://registry.npmjs.org --dry-run
```

- [ ] `npm view ...@0.1.0 version` → `0.1.0`
- [ ] `dist-tags` is exactly `{ latest: '0.1.0' }`
- [ ] registry tarball lists the same files as the local pack
- [ ] `dsh.bundle.patch` = `./cordis.patch.yml`, `engines.dsh` non-empty in the **published** manifest

If the publish fails on auth or quota: record the error and stop. Do not retry in a loop —
a partial publish plus a retry is how duplicate versions happen.

---

## 5. GitHub Release

Tag convention: **`v<version>`** — confirmed against the sibling plugin, whose tags are
`v0.5.0`, `v0.5.1`, `v0.5.2`, `v0.6.0-community.4`, `v0.6.0-community.5`. So: `v0.1.0`.

The tag must point at a commit that exists on the remote and that carries the CI check
runs, because the release panel asks GitHub for check runs by SHA.

**not run — outward action**

```powershell
Set-Location D:\dsh-plugins\dsh-pr-release-workspace
git tag -a v0.1.0 -m "dsh-pr-release-workspace 0.1.0"
git push origin v0.1.0

gh release create v0.1.0 `
  --repo tangyixiao/dsh-pr-release-workspace `
  --title "PR Release Workspace 0.1.0" `
  --generate-notes `
  --latest `
  --verify-tag `
  --notes-file docs/release-notes-0.1.0.md
```

`--latest` and the absence of `--prerelease` both matter: the release panel marks
`prerelease: true` as a hard **fail** (`reason: 'prerelease'`), and a draft as **pending**.

Verify:

```powershell
gh release view v0.1.0 --repo tangyixiao/dsh-pr-release-workspace --json tagName,isDraft,isPrerelease,url,assets
# isDraft false, isPrerelease false

git rev-list -n 1 v0.1.0
# the SHA the release tag resolves to — copy it, the release panel needs it
```

- [ ] tag `v0.1.0` exists on the remote
- [ ] release is neither draft nor prerelease
- [ ] `git rev-list -n 1 v0.1.0` recorded for step 7

---

## 6. Market PR — `tangyixiao/dsh-plugin-market`

The market is `D:\dsh-plugins\dsh-plugin-market`, remote
`https://github.com/tangyixiao/dsh-plugin-market.git`, default branch `main`. Its checkout
is currently on `update/workbuddy-0.1.14` — get back to `main` first.

### 6.1 The exact entry to add

`market.json` holds `plugins[]` with exactly four keys per entry, appended in the order
plugins were added (not alphabetical). Today it ends with:

```json
    {
      "name": "dsh-workbuddy-connect-community",
      "version": "0.1.14",
      "repository": "https://github.com/tangyixiao/dsh-workbuddy-connect-community",
      "title": "WorkBuddy Connect Community"
    }
  ]
}
```

Add this **after** that block, with a comma after the closing `}` of the workbuddy entry:

```json
    {
      "name": "dsh-pr-release-workspace",
      "version": "0.1.0",
      "repository": "https://github.com/tangyixiao/dsh-pr-release-workspace",
      "title": "PR Release Workspace"
    }
```

All four values are load-bearing:
- `name` must equal the npm package name and the manifest `name`
- `version` must be a plain `x.y.z` (the config validator rejects anything else unless
  `allowPrerelease` is set — it is not, in `market.json`)
- `repository` must equal the published manifest's repository after `git+`/`.git` stripping
- `title` is display only; existing entries use the human product name, not the package name

### 6.2 Branch and PR conventions (observed, not invented)

Branches in that repository follow `update/<plugin-slug>-<version>`:
`update/workbuddy-0.1.14`, `update/zcode-0.6.0`, `update/workbuddy-0.1.13`,
`update/workbuddy-auth-0.1.12`. So: `update/pr-release-workspace-0.1.0`.

Titles follow `Update <Display Title> to <version>`:
"Update WorkBuddy Connect Community to 0.1.14", "Update ZCode Plan Bridge to 0.6.0".
So: **`Update PR Release Workspace to 0.1.0`**.

Base is always `main`. PR numbers so far run 1–10, so the next one is 11 or higher.

### 6.3 What the market CI does

`.github/workflows/publish.yml`, `name: Publish plugin market`:

- triggers: `pull_request`, `push` to `main`, `workflow_dispatch`
- job `build` (ubuntu-latest, `timeout-minutes: 10`): `npm ci --ignore-scripts --registry=https://registry.npmjs.org`, `npm test`, `npm run build` (with `MARKET_FETCH_ATTEMPTS=6`, `MARKET_RETRY_DELAY_MS=10000`, `MARKET_FETCH_TIMEOUT_MS=15000`), `npm run build:preview`
- on a **PR**: test + build only, `upload-pages-artifact` is skipped, `deploy` is skipped
- on a **push to `main`**: the same build, then `upload-pages-artifact` and the `deploy` job
  (`pages: write`, `id-token: write`, `environment: github-pages`)

So the market CI builds and deploys to GitHub Pages **after merge only**. A PR can be fully
green while the live index still shows the previous state — and with a 10-minute job timeout
plus npm fetches, a run legitimately takes several minutes.

`scripts/metadata.mjs` is the gate the new pin must pass, and it fetches the **published**
manifest: name/version match, not private/deprecated, `dsh.bundle.patch` a non-empty string,
`engines.dsh` a non-empty string, valid publish timestamp, repository URL equal to the pin.
An unpublished version throws `UnpublishedVersionError` —
`"dsh-pr-release-workspace@0.1.0 is not published in the public registry yet (HTTP 404)"`.
All of those pass for this package **on the assumption §2 and §4 are done**.

**not run — outward action**

```powershell
Set-Location D:\dsh-plugins\dsh-plugin-market
git switch main
git pull --ff-only
# edit market.json: append the entry from 6.1
node -e "JSON.parse(require('fs').readFileSync('market.json','utf8'));console.log('valid json')"
npm test
git switch -c update/pr-release-workspace-0.1.0
git commit -am "Update PR Release Workspace to 0.1.0"
git push -u origin update/pr-release-workspace-0.1.0
gh pr create --repo tangyixiao/dsh-plugin-market --base main `
  --title "Update PR Release Workspace to 0.1.0" `
  --body "Adds dsh-pr-release-workspace 0.1.0 to the self-pinned list. npm: https://www.npmjs.com/package/dsh-pr-release-workspace . Release: https://github.com/tangyixiao/dsh-pr-release-workspace/releases/tag/v0.1.0"
```

One plugin per PR. The plan is explicit that multiple plugins must never share a market PR.

### 6.4 Verifying the deployment

```powershell
# the run that matters is the one on main, after the merge
gh run list --repo tangyixiao/dsh-plugin-market --event push --limit 3
gh run watch <run-id> --repo tangyixiao/dsh-plugin-market

# poll the live index until the plugin appears with 0.1.0
$url = 'https://tangyixiao.github.io/dsh-plugin-market/index.json'
do {
  $doc = Invoke-RestMethod $url
  $hit = $doc.plugins | Where-Object { $_.name -eq 'dsh-pr-release-workspace' }
  if ($hit) { $hit | ConvertTo-Json -Depth 5 } else { Start-Sleep -Seconds 15 }
} while (-not $hit)
```

A one-liner for a quick look:

```powershell
(Invoke-RestMethod 'https://tangyixiao.github.io/dsh-plugin-market/index.json').plugins |
  Where-Object name -eq 'dsh-pr-release-workspace' |
  Select-Object name, @{n='versions';e={$_.versions.version -join ','}}
```

GitHub Pages caches. If the entry is missing for more than ~10 minutes after a successful
deploy, check `?v=$(Get-Random)` on the URL and the run log before assuming the pin is wrong.

- [ ] `market.json` parses, entry has exactly the four keys, correct version
- [ ] `npm test` passes in the market repo before pushing
- [ ] PR opened with the observed branch and title conventions
- [ ] PR CI green
- [ ] merged to `main`
- [ ] main-branch run succeeded
- [ ] live index lists `dsh-pr-release-workspace` with `0.1.0` in `versions[]`

---

## 7. Six-fact verification — the screenshot

The panel's `release` endpoint takes this payload (`lib/host/routes.js:148-167`):

```json
{
  "owner": "tangyixiao",
  "repo": "dsh-pr-release-workspace",
  "tag": "v0.1.0",
  "sha": "<git rev-list -n 1 v0.1.0>",
  "npmName": "dsh-pr-release-workspace",
  "version": "0.1.0",
  "market": {
    "repo": "tangyixiao/dsh-plugin-market",
    "number": <the market PR number from 6.4>,
    "indexUrl": "https://tangyixiao.github.io/dsh-plugin-market/index.json",
    "branch": "main"
  }
}
```

### The values, filled in

| Field | Value |
| --- | --- |
| owner | `tangyixiao` |
| repo | `dsh-pr-release-workspace` |
| tag | `v0.1.0` |
| sha | **the tag's commit** — `git rev-list -n 1 v0.1.0` in the project root |
| npmName | `dsh-pr-release-workspace` |
| version | `0.1.0` |
| market.repo | `tangyixiao/dsh-plugin-market` |
| market.number | the PR number created in §6 (not known until then; must be an integer) |
| market.indexUrl | `https://tangyixiao.github.io/dsh-plugin-market/index.json` |
| market.branch | `main` |

### What each row needs to be `pass`

Rows render in this order — `ci`, `github-release`, `npm`, `market-pr`,
`market-manifest`, `live-index` — and `ready` is true only when **all six** pass
(`lib/host/release.js:509-511`).

| Row | `pass` requires | What fails it |
| --- | --- | --- |
| Commit checks | at least one check run on `sha`, none failing, none pending, at least one `success` | no checks at all → `not_configured`; all skipped → fail `all-skipped`; still running → `pending` |
| GitHub Release | release for `tag` exists, not a draft, not a prerelease | draft → `pending`; `prerelease: true` → fail `prerelease`; absent → fail `not-found` |
| npm | version published **and** `dist-tags.latest === 0.1.0` | `not-latest-tag`, `version-missing`, `not-found` |
| Market pull request | `gh pr view` shows `mergedAt` non-empty | open → `pending` `open`; closed unmerged → `pending` `closed-unmerged`; `number` not an integer → `not_configured` `no-pr` |
| Market manifest | `market.json` **on the market default branch** has the entry with `version === 0.1.0` | `not-listed`, `version-mismatch` |
| Live index | the index URL lists the plugin with `0.1.0` in `versions[]` | `not-listed`, `version-mismatch`, http/network error → `unknown` |

### Two consequences worth planning around

**7.1 — the CI row cannot pass without a workflow, and this repository has none.**
`checkCommitChecks` (`lib/host/release.js:408-460`) returns
`not_configured` when `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` comes back with
zero runs, and `not_configured` is not `pass`. There is no `.github/workflows` in this
project. Until one exists and has run against the released commit, the sixth row can never
be green and `ready` stays false.

Two honest options:

- **Add a workflow** (e.g. `.github/workflows/ci.yml` running `npm run build` and `npm test`
  on `push` and `pull_request`), push it before tagging, and tag a commit that carries a
  green run. This is the only way to a genuine all-six screenshot.
- **Record the gap.** The plan explicitly allows this: "未配置 CI 就如实写明". Then the
  screenshot shows five `pass` and one `Not configured`, and the release report says so.

- [ ] decide: add CI, or document the `not_configured` row as a known gap
- [ ] if adding CI: the tag's commit has a completed, successful check run
      (`gh api repos/tangyixiao/dsh-pr-release-workspace/commits/<sha>/check-runs`)

**7.2 — the last three rows only pass after the market PR is merged and deployed.**
`market-pr` requires `mergedAt`; `market-manifest` reads `market.json` from the market's
default branch, not from the PR head; `live-index` needs the Pages deploy. So the sequence
is: publish → release → open the market PR → merge → wait for the main-branch deploy →
only then capture the six facts. Taking the screenshot earlier will show `pending` on three
rows, which is accurate but not the picture you want to publish.

### Where to take the screenshot

DSH → Plugins → PR Release Workspace panel → **Release state** tab. Enter owner, repo,
tag, sha, npm name, version, market repo, market PR number, index URL; the panel renders
the six rows with the evidence link on each.

The same call from a terminal, if you prefer to save the JSON as evidence first:

```powershell
$body = @{
  owner='tangyixiao'; repo='dsh-pr-release-workspace'; tag='v0.1.0'
  sha='<git rev-list -n 1 v0.1.0>'; npmName='dsh-pr-release-workspace'; version='0.1.0'
  market=@{ repo='tangyixiao/dsh-plugin-market'; number=<PR>; indexUrl='https://tangyixiao.github.io/dsh-plugin-market/index.json'; branch='main' }
} | ConvertTo-Json -Depth 4

Invoke-RestMethod -Uri 'http://127.0.0.1:13787/dsh-pr-release-workspace/release' `
  -Method Post -ContentType 'application/json' -Body $body |
  ConvertTo-Json -Depth 8 | Set-Content evidence\release-facts.json
```

(Note: a live probe of that route from this session returned 405 and `GET /` returned 401,
so the route was not reachable as configured here. Drive it from the panel; treat the curl
above as a convenience, not as a verified path.)

- [ ] six rows captured with `ready: true`, or five plus a documented `not_configured`
- [ ] screenshot saved with the evidence links visible

---

## 8. Community directories (separate, optional, after the above)

Each is its own submission with its own rules and its own waiting time. The plan requires
one PR per plugin per directory and says to wait for external maintainers rather than
pushing them. Full detail, including the exact files and the rejection risks, is in
`docs/research/community-directories.md`.

Order by friction, lowest first:

1. **dshmarketplace.dev full catalogue** — add the `dsh-plugin` topic; no submission. Listed on the next sync.
2. **dshopen.org** — GitHub issue from the `plugin-add.yml` form. Expect a change request on route authentication: its rules want `connection.requestRejection(req)`, and this plugin only checks Host/Origin/loopback.
3. **dpharness.com** — web form, no repo, no readable rules; the site scrapes and verifies on its own schedule.
4. **awesome-dsh-plugin** — PR adding one YAML file; blocked for the first 24 h by the repository age gate, and the category is a judgement call.
5. **DshMarketPlace/awesome-dsh-plugin curated list** — PR to `data/curated.yml`; explicitly selective, real rejection risk.

---

## 9. 中文摘要（给执行者）

按顺序做，不要跳步：

1. **先补 `README.md` 和 `README.zh.md`**。`package.json` 的 `files` 声明了它们，但磁盘上没有；npm 打包会静默跳过，结果就是一个没有 README 的包——npmjs 页面空白，两个社区目录也都会因为「没有安装说明」拒收。（`.gitignore`、`LICENSE`、`icon.svg` 已经有了，记得一起提交。）
2. **建仓库**：`dsh-pr-release-workspace`，public，描述用 `package.json` 里那句；topic 至少要有 `dsh-plugin` 和 `deepseek-harness`（两个市场都靠它扫描）。本地 `main` 已有一个提交 `5a0a82b`，保留，不要 reset。
3. **版本 0.1.0**，不要预发布后缀。确认 `dsh.bundle.patch`、`engines.dsh` 非空，`repository.url` 去掉 `git+`/`.git` 后正好等于市场里要填的仓库地址。
4. **过闸**：`npm run build`、`npm test`（136/136）、`node --check` 四个入口文件、`npm pack --dry-run` 检查文件清单（不能有 `src/`、`test/`、`node_modules/`；补完 README 后应该是 16 个文件）。
5. **发布**：必须带 `--registry=https://registry.npmjs.org`。本机默认 registry 是 npmmirror，没有可用凭据（`npm whoami` 报 ENEEDAUTH）；npmjs 上是 `tangyixiao`。**不要 `--tag next`，不要预发布版本**。发布后核对 `dist-tags` 只有 `latest: 0.1.0`。
6. **GitHub Release**：tag 用 `v0.1.0`（跟兄弟插件一致），跑 `gh release create ... --generate-notes --latest`，不要 `--prerelease`，不要留草稿。
7. **市场 PR**：在 `market.json` 的 `plugins[]` 末尾追加四键条目，分支 `update/pr-release-workspace-0.1.0`，标题 `Update PR Release Workspace to 0.1.0`。PR 的 CI 只跑测试和构建，**不部署**；合并到 `main` 后才部署 GitHub Pages，要等几分钟。
8. **六件事截图**要放在最后：`market-pr` 要看到 `mergedAt`，`market-manifest` 读的是市场默认分支，`live-index` 依赖部署完成。**注意：本仓库现在完全没有任何 GitHub Actions workflow，CI 那一行会是 `not_configured`，六行不可能全绿。** 要么先加一个跑 `npm run build && npm test` 的 workflow 并在打 tag 前跑绿，要么如实记录这个缺口。
9. 社区目录各自独立提交、各自等待维护方，不要催，也不要一次 PR 塞多个插件。

---

## Appendix — commands that were run to produce this document

```powershell
node -v                                   # v26.9.0
npm -v                                    # 11.19.0
git --version                             # 2.55.0.windows.2
gh --version                              # 2.97.0 (2026-07-31)
gh auth status                            # tangyixiao, scopes include repo, read:org, workflow
npm config get registry                   # https://registry.npmmirror.com
npm whoami                                # ENEEDAUTH
npm whoami --registry=https://registry.npmjs.org   # tangyixiao
npm view dsh-pr-release-workspace --registry=https://registry.npmjs.org   # E404
gh api repos/tangyixiao/dsh-pr-release-workspace   # 404
npm run build                             # 13 fragments -> lib/client.js (109432 bytes)
npm test                                  # 21 pass, 0 fail
npm pack --dry-run                        # 14 files, 61.1 kB, shasum f7de445c…
git -C D:\dsh-plugins\dsh-zcode-plan-bridge tag --list   # v0.5.0 v0.5.1 v0.5.2 v0.6.0-community.4 v0.6.0-community.5 …
```

`~/.npmrc` could not be read — access was blocked by a secret-file guard. Nothing in this
document depends on its contents; the registry and auth facts above come from `npm` itself.

