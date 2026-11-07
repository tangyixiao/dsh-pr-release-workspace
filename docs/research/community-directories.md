# Community directories for DSH plugins

Research note for the release of `dsh-pr-release-workspace` 0.1.0. All URLs and repositories
below were fetched and inspected with `gh api` and web requests on 2026-11-06. Nothing was
submitted.

Summary of the five routes, in order of friction:

| Directory | Backing repository | Submission | Required fields | Enforced by CI | Rejection risk for a brand-new plugin |
| --- | --- | --- | --- | --- | --- |
| DSH Marketplace (full catalogue) — `dshmarketplace.dev` | `DshMarketPlace/dshmarketplace` (site), topic sync | none — add the `dsh-plugin` topic | public repo, topic `dsh-plugin`, licence, description, README | no check to pass; sync job | very low — listing is automatic, the site may mark it not install-tested |
| Open Plugin Market — `dshopen.org` | `polang233/dsh-plugin-index` | GitHub **issue** form, not a PR | plugin link, one-line summary; must have npm release, `dsh.bundle.patch`, public repo, LICENSE | yes — `publish.yml` builds and verifies archives; plus human security review | medium — its security rules want `connection.requestRejection(req)` for `webServer` routes; this plugin does not do that |
| DSH Plugin Hub — `dpharness.com` | **none found** | web form on the site | nickname, GitHub URL, optional note | unknown — no public CI to read | low control — you cannot see or satisfy the rules; the site scrapes, translates and install-verifies on its own schedule |
| awesome-dsh-plugin — `awesome-dsh-plugin.com` | `awesome-dsh-plugin/awesome-dsh-plugin` | PR adding **one YAML file** | `url`, `name`, `category`, `description.en` | yes — `check-submission.mjs` via `pr-check.yml` / `pr-gate.yml` | high on timing and judgement — repo must be ≥1 day old, needs `dsh.bundle`, a maintainer reads the code |
| Awesome DSH Plugins (curated) — part of `dshmarketplace.dev` | `DshMarketPlace/awesome-dsh-plugin` | PR to `data/curated.yml` | `repo:` line only; both topics; README with install | yes — `validate.yml` | high — "Not every plugin that meets the technical requirements will be accepted" |
| Your own market — `tangyixiao/dsh-plugin-market` | it is yours | PR to `market.json` | `{name, version, repository, title}` | yes — `npm test` + build fetches the published manifest | none, you are the maintainer |

---

## 1. DSH Marketplace — `https://dshmarketplace.dev`

**Site repository:** `DshMarketPlace/dshmarketplace` — MIT, created 2026-08-16, 6 stars,
Next.js on Cloudflare Workers, `has_pages: false`, homepage `https://dshmarketplace.dev`,
topics `ai-agents`, `cloudflare-workers`, `deepseek`, `deepseek-harness`, `dsh`,
`dsh-plugin`, `nextjs`, `plugin-directory`. Read access only (`permissions.push: false`).

**Curated list repository:** `DshMarketPlace/awesome-dsh-plugin` — CC0-1.0
(`NOASSERTION` per the API, `license` field in `package.json` says `CC0-1.0`), created
2026-08-16, 4 stars.

### Mechanism

Three doors, and only one is a PR:

1. **Topic sync — no submission at all.** From `https://dshmarketplace.dev/submit`:
   > This catalogue syncs the `dsh-plugin` GitHub topic. Adding that topic to your
   > repository gets you listed on the next sync, with no submission needed — and it also
   > makes you discoverable to every other DSH plugin market, including the one built into
   > DeepSeek Harness.

   The command the page gives: `gh repo edit --add-topic dsh-plugin`. The page also asks for
   **both** `dsh-plugin` and `deepseek-harness`.

2. **Web form** at `https://dshmarketplace.dev/submit` — "Submit a repository". Paste the
   repository URL; the site reads public metadata before you commit to anything.
   "Submissions are reviewed by hand before they are published." Public GitHub repositories
   only — private, archived and disabled projects cannot be listed. Form fields observed in
   the markup: nickname (placeholder `如：姬野`), repository URL (placeholder
   `https://github.com/your/your-plugin`), and a remarks textarea.

3. **Curated list PR** to `DshMarketPlace/awesome-dsh-plugin` — see §5 below.

### What the full catalogue needs

Nothing to fill in. The listing is generated from what the repository publishes:

- repository description → the card summary
- a licence file (repositories without one default to all-rights-reserved and the listing says so)
- a README with install instructions → rendered on the detail page
- an npm package, if there is one → installs resolve a tarball instead of cloning

`CONTRIBUTING.md` in the site repository is **internal maintainer documentation**, not a
submission guide. It is worth reading anyway because it explains what the "install-verified"
badge means, and because it says plainly that the sandbox verdicts are
`passed`, `needs-approval`, `not-a-layer`, `failed`, `timeout`, and that **only `failed` and
`timeout` are defects**. There is no `data/curated.yml` in that repository — it lives in the
separate `awesome-dsh-plugin` repo.

### Can the Lead submit automatically?

Yes, for the full catalogue: adding the topic is enough, no PR, no review queue. The curated
list needs a PR the Lead opens and then waits on.

### Risk

Low for the catalogue — the worst case is the site marks the plugin "install-tested" or not,
and the listing appears anyway with the site's own risk flags. Note that the site reports
1,000+ install commands shipping without `--profile` in its history, so its verdicts are
worth checking rather than assuming.

### Links

- Site: https://dshmarketplace.dev
- Submit page: https://dshmarketplace.dev/submit
- API docs: https://dshmarketplace.dev/api-docs
- Site rules (internal): https://github.com/DshMarketPlace/dshmarketplace/blob/main/CONTRIBUTING.md

---

## 2. Open Plugin Market — `https://dshopen.org`

**Backing repository:** `polang233/dsh-plugin-index` — GPL-3.0, created 2026-10-17,
183 stars, 8 forks, 26 open issues, default `main`, homepage `https://dshopen.org`,
`has_pages: true`, `pull_request_creation_policy: all`, permissions
`{admin: false, maintain: false, push: false, triage: false, pull: true}` — you can open a PR
but you cannot push.

**Index file:** `https://dshopen.org/index.json` (1.6 MB, `format: 1`), which is one of the
four sources the user's own market already reads.

### Mechanism: a GitHub issue, not a PR

Listings are not edited by contributors. `data/sources.json` (568 KB) is maintained by the
maintainers. You open an issue from a form:

```
https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml
```

`blank_issues_enabled: false` — the form is the only way in.

**The form, quoted from `.github/ISSUE_TEMPLATE/plugin-add.yml`:**

```yaml
name: 插件收录 / Add a plugin
description: 推荐新插件或更正已收录信息 / Suggest a plugin or correct a listing
title: "[plugin-add] "
body:
  - type: input
    id: plugin
    attributes:
      label: 插件地址 / Plugin link
      description: 填写 npm 包名或源码仓库地址；插件位于子目录时请注明相对路径。 / npm package name or repository URL; include the relative path for a plugin in a subdirectory.
      placeholder: "@owner/dsh-plugin 或 https://github.com/owner/plugin"
    validations:
      required: true
  - type: textarea
    id: description
    attributes:
      label: 简短说明 / Summary
      description: 用一句话介绍用途，或说明需要更正的内容。中文或英文均可。
    validations:
      required: true
  - type: textarea
    id: screenshots
    attributes:
      label: 插件实际效果 / Plugin screenshots
      description: 可选，拖入 1–6 张真实使用截图，并为每张写一句说明。请勿提交 Logo、装饰边框或广告图；提交前遮盖密钥和个人信息。
  - type: textarea
    id: extra
    attributes:
      label: 补充信息 / Additional details
      description: 可选，附上 Logo、已验证的 DSH 版本、平台或其他测试情况。
```

Two fields are required: the plugin link, and one sentence of description.

### Required for listing (from `.github/CONTRIBUTING.md`)

- A public npm release, **or** a pinned GitHub commit
- **`dsh.bundle.patch` declared in `package.json`, with the patch file present in the
  published package**
- A public source repository and a clear licence — the `license` field **and** a LICENSE file
  in the repository
- A clear purpose. Maintainers write the Chinese and English descriptions themselves.

Optional extras: logo, 1–6 real screenshots with captions, tested DSH versions and platforms.
Compatibility goes in `engines.dsh` or DSH-related `peerDependencies`.

**Git sources:** a plugin that is not on npm can be listed from a pinned GitHub commit —
public repository, version, and the full 40-character commit SHA, plus the relative path if
it lives in a subdirectory. That directory must install as-is: `package.json`, the patch, and
the build output. GitHub Release attachments **cannot** be used as an install source yet.

### What actually gates a submission

The named "common reasons for changes" are a security review, not a metadata check. The first
one is directly relevant here:

> **Local routes without host authentication.** Routes registered through `webServer` should
> admit requests with `connection.requestRejection(req)`. If `connection` is missing or
> throws, reject the request; do not fall back to checking only Host, Origin or the loopback
> address. This matters most for routes that touch keys, sessions or files, or that trigger
> model calls.

`dsh-pr-release-workspace` registers its route through `webServer` (`lib/index.js:90-99`) and
authorises with `isTrustedLocalRequest()` (`lib/host/routes.js:312-340`), which checks the
Host header against loopback or the bind address, rejects `sec-fetch-site: cross-site`, and
requires an Origin match when an Origin is present. It uses **no** Connection service and has
no `requestRejection` path — `lib/host/routes.js:302` documents the mirroring deliberately.
By the letter of that rule, this is the exact pattern the review asks authors to replace.

The other named reasons: CORS `Access-Control-Allow-Origin: *` on sensitive routes (not
applicable — this plugin sends no CORS header); unchecked paths and traversal (draft paths are
capped and the file store lives under `~/.dsh`); credentials leaking to other domains (the
plugin shells out to `gh`, it does not handle tokens); skipping approval or permissions (no
commands are executed from request input beyond fixed `gh` argument vectors); a missing
licence or `repository` field, or build output missing from the published package (**partly
true of this package as it stands — `LICENSE` and `icon.svg` now exist and ship, but
`README.md` and `README.zh.md` are declared in `files` and absent, so the published tarball
has no README**).

### After submission

Maintainers check ownership, purpose, licence, patch and entry files, do a security review,
and reply in the issue. A version that passes gets the 「已审查」 Reviewed label, and **new
releases need a new review**. A low-risk issue may be listed anyway with a note in the
description. **Issues with no reply for 7 days are closed**; replying or resubmitting reopens
the review.

Listed plugins follow the npm `latest` tag. Pinned versions or commits are upgraded only after
a maintainer re-checks.

### CI

Only one workflow: `.github/workflows/publish.yml`. It runs unit tests, builds, validates the
official format, and runs browser tests. Pull requests run checks; passing builds on `main`
publish the generated artifacts. `docs/maintenance.md` documents the archive checks: source,
version, archive hash, manifest, patch, entry files, licence, withdrawal status — and that
**runtime files declared by `exports["./client"]` must be present**
(`client-entry-present` evidence). Downloads have a 30-second deadline, a 100 MiB
decoded-byte limit, and at most three attempts; compressed downloads are capped at 64 MiB.
More than 10 failures, or 5% of the catalogue, stops the build.

### Can the Lead submit automatically?

The issue can be opened automatically (it is a form POST or a `gh issue create` with the right
title and body). The **review** cannot be automated — a human decides.

### Risk

**Medium-high for this plugin specifically**, because of the route-authentication rule. The
honest path is either to add a `connection.requestRejection` path before submitting, or to
say in the issue that the route deliberately mirrors the documented check because no
Connection service is available in this build. The second is what the code comments already
argue; whether a maintainer accepts it is not something this research can predict.

### Links

- Market: https://dshopen.org
- Index: https://dshopen.org/index.json
- Repository: https://github.com/polang233/dsh-plugin-index
- Submit form: https://github.com/polang233/dsh-plugin-index/issues/new?template=plugin-add.yml
- Rules: https://github.com/polang233/dsh-plugin-index/blob/main/.github/CONTRIBUTING.md
- Maintenance detail: https://github.com/polang233/dsh-plugin-index/blob/main/docs/maintenance.md

---

## 3. DSH Plugin Hub — `https://dpharness.com`

**Backing repository: none found.** This is the one candidate where the usual "find the repo,
read the CONTRIBUTING" approach fails.

Searches performed:

- `gh api "search/repositories?q=dpharness"` → only `dpharmacyit/dphar-repair` (0 stars),
  `manyapn/dpharness` (an agentic-browser harness project, unrelated), and
  `zhanghao3693/dsh-dpharness`.
- `zhanghao3693/dsh-dpharness` is **MIT, 1 star, created 2026-09-17, topics `deepseek`,
  `deepseek-harness`, `dsh`, `dsh-plugin`** — it is the DSH-side client plugin that browses
  dpharness.com's catalogue and installs from it. It is not the site's data source and
  contains no listing data.
- The site's own pages link to no repository. `/about` (HTTP 200) says the site is run by an
  independent developer, not a company, and is not affiliated with DeepSeek; contact
  `zhanghao3693@agent.qq.com`; ICP 京ICP备2026021437号.

**Index file read by the user's market:** `https://dpharness.com/market/index.json`
(2.8 MB, `format: 1`, title 「DSH Harness 严选插件库」).

### Mechanism: a web form

`https://dpharness.com/submit` (HTTP 200; `/zh/submit` is 404). Quoted from the page:

> 提交你的插件 — 支持三种方式：贴 GitHub 链接、上传源码 zip、或直接粘贴 README。系统会由
> DeepSeek 最新模型汉化并评分。

Three tabs: GitHub link, upload a source zip, paste text. Fields visible in the markup:

| Field | Required |
| --- | --- |
| 提交者昵称 (submitter nickname) | yes (`*`) |
| GitHub 仓库链接 (repository URL) | yes (`*`) |
| 备注 (note) | no |

### What gets a plugin listed

From `/about` (HTTP 200), which is the only rule text the site publishes:

- Metadata (name, description, README, stars, update time) is scraped from public GitHub
  repositories, updated daily.
- Chinese descriptions are machine-translated by a DeepSeek model and labelled as such.
- Installability verdicts come from actually running `dsh plugin add` in a real environment.
  Three states: 实装验证通过 / 未通过 / 无法判定 — the third means the verification environment
  or package-manager policy differed, and is explicitly *not* a conclusion about the plugin.
- Listing = passed the static install check **or** real install verification, plus a Chinese
  translation. Unmarked = unverified.

There is no written CONTRIBUTING, no CI to inspect, and no way to pre-check a submission.

### Its data is open (useful for our own market)

- MCP endpoint `https://dpharness.com/api/mcp` — Streamable HTTP, read-only, no auth, four
  tools: `search_plugins`, `get_benefits`, `get_free_models`, `get_plugin_board`.
- JSON API `GET https://dpharness.com/api/plugins?q=…&take=…` — params `q`, `sort`
  (`final|stars|newest|updated`), `type`, `tier`, `category`, `scene`, `tested`, `verified`,
  `risk`, `riskAuto`; `take` max 500 and there is no pagination or `skip`.
- Rate limit 60 requests/minute/IP, 429 with `Retry-After`.
- Attribution requested: 「数据来自 dpharness.com」.

### Can the Lead submit automatically?

The form can be submitted by a human in a browser. It is not a documented API and there is no
repo to PR against, so it should not be automated blindly. Whether the submission is even
necessary is unclear — the site scrapes public GitHub repositories daily, so a public repo
with the right topics may be picked up on its own.

### Risk

Cannot be assessed from the outside. The site's own text says it is not a full audit and that
"未进行实测的不会写成可用". The practical risk is not rejection but silence: no rule to satisfy
means no way to know what is missing.

### Links

- Hub: https://dpharness.com
- Submit: https://dpharness.com/submit
- About / method: https://dpharness.com/about
- API: https://dpharness.com/api-docs
- Index: https://dpharness.com/market/index.json
- The in-DSH client (not the catalogue): https://github.com/zhanghao3693/dsh-dpharness

---

## 4. awesome-dsh-plugin — `https://awesome-dsh-plugin.com`

**Backing repository:** `awesome-dsh-plugin/awesome-dsh-plugin` — **CC0-1.0**, created
2026-08-13, **23,188 stars, 7,047 forks, 520 open issues**, default `main`, topics `awesome`,
`awesome-list`, `deepseek-harness`, `dsh`, `dsh-plugin`, `has_pages: true`,
`has_discussions: true`, `pull_request_creation_policy: all`, permissions
`{admin: false, maintain: false, push: false, triage: false, pull: true}`.

Root layout: `LICENSE` (7,048 B), `README.md` (**3,174,402 B**), `README.zh.md` (2,972,406 B),
`contributing.md` (35,465 B), `data/`, `scripts/`, `site/`, `design-mocks/`,
`package.json`, `package-lock.json`, `skills-lock.json`.

`data/`: `plugins/` (a directory, thousands of `.yml` files), `capabilities.json` (1.24 MB),
`stars.json`, `downloads.json`, `screenshots.json`, `added-dates.json`.

### Mechanism: a PR that adds exactly one file

From `contributing.md`, quoted:

> **The READMEs are generated — don't edit them by hand.** The list lives in `data/plugins/`,
> one YAML file per plugin.
>
> Open a PR that adds **one file**, named after your repo — `data/plugins/<owner>__<repo>.yml`
> […]
> **That one file is the whole submission.** The two READMEs are generated from
> `data/plugins/*.yml` and are regenerated on `main` after your PR merges — you do not have to
> run anything, and you should not edit them by hand. This is also why your PR will not
> conflict with anyone else's: entry files never collide, generated README lines always did.

Monorepo subpackages use `owner__repo--packages-my-plugin.yml`, with `url` pointing at the
subdirectory and `name` written as `owner/repo#subname`.

**So there is no plain README list that takes PRs.** The READMEs are generated output; a PR
touching them is rejected by the `READMEs match data/plugins` check.

### The exact schema — quoted from a real entry

`data/plugins/135ty__dsh-git-commit-panel.yml`:

```yaml
url: https://github.com/135ty/dsh-git-commit-panel
name: 135ty/dsh-git-commit-panel
category: git
description:
  en: 'Floating commit panel for the DSH web UI: it appears when the current session workspace has unstaged or untracked changes, takes a hand-written or AI-drafted commit message (AI drafts follow Conventional Commit), and commits or commits and pushes. Works in the DSH web UI and CLI only; the desktop app cannot install it.'
  zh: 'DSH 网页界面的悬浮提交面板：当前对话所在工作区出现未暂存或未跟踪改动时浮出，提交信息可手写或由 AI 起草（AI 起草按 Conventional Commit 生成），支持提交与提交并推送。仅支持 DSH Web / CLI，桌面版无法安装。'
icon: https://raw.githubusercontent.com/135ty/dsh-git-commit-panel/main/assets/icon-180.png
tarball: https://github.com/135ty/dsh-git-commit-panel/releases/latest/download/dsh-git-commit-panel.tgz
```

And a minimal one, `data/plugins/173787247__dsh-wsl-git.yml`:

```yaml
url: https://github.com/173787247/dsh-wsl-git
name: 173787247/dsh-wsl-git
category: wsl
description:
  en: Capped Git status / diff --stat / log --oneline (no full patches).
  zh: 截断版 Git status / diff --stat / log --oneline。
```

**Only `description.en` is required.** `zh` is optional — a maintainer will add it. `icon` and
`tarball` are optional. A description containing `: ` must be quoted, as in the first example.

Valid categories: `agi ui usage theme model identity session memory tools wsl browser vision
voice docs skill workflow git notify dev security remote market fun`.

### Requirements (quoted from `contributing.md`)

- The repository's `package.json` declares **`dsh.bundle`**. "Most rejected submissions
  declare only `dsh.client`." — this plugin declares `dsh.bundle.patch`, so it passes.
  `scripts/check-submission.mjs` walks the tree for any manifest containing `dsh.bundle`,
  so monorepos are handled.
- "The repo contains real, working code — placeholder, name-squat, or README-only repos don't
  qualify."
- **The repository must be at least one day old.** `scripts/check-submission.mjs` sets
  `const MIN_AGE_DAYS = 1` and the comment explains the age floor "is the part that actually
  blocks". CI enforces it.
- Actively maintained (there is a periodic `decay-scan.yml`).
- Add the GitHub topic `dsh-plugin`.
- The description states what it does, with no superlatives, and must be accurate — it gets
  checked against the code.
- The category must match the actual function.
- Not a pure meta-package or bundle; dependencies must point at the original author.

### CI

Eleven workflows: `pr-check.yml`, `pr-gate.yml`, `pr-guard.yml`, `regate.yml`,
`held-rescan.yml`, `sync-readme.yml`, `build-site.yml`, `decay-scan.yml`, `site-health.yml`,
`adopt-discussions.yml`.

`pr-check.yml` runs `npm ci` (against `https://registry.npmjs.org/` in CI, because the
lockfile pins npmmirror URLs), then a stale-fork guard that fails when a PR deletes more than
two existing entry files, then structural checks (every entry file must end in `.yml`, every
entry must live in `data/plugins/`, READMEs must regenerate identically). `pr-gate.yml` calls
`check-submission.mjs` with the PR creation time, enforcing the repository age and
`dsh.bundle` rules.

A green CI run is the **precondition, not the decision**:

> A maintainer reads the target repository before merging. […] Being listed is still **not** a
> security review.

Feedback arrives as a PR comment; there is a `held: author` label and a "Held pull requests
that may have healed" tracking issue regenerated daily at 06:19 UTC.

### Can the Lead submit automatically?

Yes mechanically — one YAML file on a fork, one PR. But it cannot be done on release day: the
repository age gate needs 24 hours, and the category choice (`git` is the best fit; `market`
would be defensible but weaker) is a human judgement.

### Risk

**High.** Three independent ways to be rejected: the repository is too young (auto-checked),
the category or description does not convince a maintainer who reads the code, or the entry
duplicates something already listed. This is a 23k-star curated list with 520 open issues; the
queue is real.

### Links

- Site: https://awesome-dsh-plugin.com
- Index: https://awesome-dsh-plugin.com/index.json
- Repository: https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
- Rules: https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md
- Gate script: https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/scripts/check-submission.mjs

---

## 5. Awesome DSH Plugins (curated) — `DshMarketPlace/awesome-dsh-plugin`

A different list from §4, despite the almost identical name. Maintained by DSH Marketplace.
CC0-1.0. 4 stars, created 2026-08-16.

Its `CONTRIBUTING.md` is explicit about the relationship:

> This repository is DSH Marketplace's curated recommendations, maintained independently from
> [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin).
> A PR here adds a recommendation; it does not itself register a plugin in the marketplace.
> Marketplace discovery uses the public topics and the upstream registry.

### Mechanism: a PR to `data/curated.yml`

Fork → edit `data/curated.yml` in the right category → `npm install` and `npm test` → commit
`data/marketplace-cache.json`, `README.md` and `README.zh-CN.md` **together with** the YAML
change → PR titled `Add [plugin-name]` (updates use `Update [plugin-name]`).

The real file, quoted:

```yaml
# Curated DSH Plugins
# This file contains the selection of plugins to be featured in the Awesome list
# Metadata is fetched from DSH Marketplace API

# Starter Pack - repos to highlight as "essential"
starter:
  - dsh-market/dsh-market
  - omdsh-dev/DSH-better-sidebar
  - …

categories:
  - name: UI & Experience
    slug: ui
    plugins:
      - repo: omdsh-dev/DSH-better-sidebar
      - repo: ccch1mneyyy/dsh-TUI
      …

  - name: Development
    slug: dev
    plugins:
      - repo: hust-open-atom-club/oh-dsh
      - repo: Jayden-X-L/forkprobe
      - repo: vlln/plugin-registry
      - repo: forrestchang/dsh-multica-runtime
      - repo: GooDAnDReaDY/dsh-github-ops

  - name: Fun & Experimental
    slug: fun
    plugins:
      - repo: Nagi-ovo/dsh-ads
      - repo: vlln/whale-girl
```

The minimal entry is a single line — `- repo: owner/name`. There is no description field;
descriptions come from the Marketplace API. Monorepo subpackages use the optional key
`# subpath: path/to/plugin`.

Categories present, in file order: `ui`, `model`, `memory`, `tools`, `vision`, `workflow`,
`skill`, `session`, `theme`, `market`, `dev`, `fun`. This plugin would go under `dev`
(Development) — it is a PR/CI/release tool, not a marketplace.

### CI

`.github/workflows/validate.yml`, Node 22:

1. `npm ci --ignore-scripts`
2. `npm test` with `MARKETPLACE_OFFLINE: '1'` — validates the committed snapshot
3. `npm run validate` with `MARKETPLACE_OFFLINE: '0'`, `MARKETPLACE_WRITE_CACHE: '0'` — checks
   the live catalogue without rewriting the snapshot
4. fails if `git status --porcelain` is non-empty — "Generated files differ from committed
   versions … run 'npm test' locally and commit the generated files"

`package.json` scripts: `generate: node scripts/generate-readme.js`,
`validate: node scripts/validate.js`,
`test: node --test scripts/marketplace.test.js && npm run validate && MARKETPLACE_OFFLINE=1 npm run generate`.

### Required

- real functional DSH plugin, public GitHub repository
- README with installation instructions and usage
- a documented `dsh plugin add …`
- actively maintained, not archived
- GitHub topics **`dsh-plugin`** and **`deepseek-harness`**
- licence specified

### The honest part

> This is a **curated** list, not a comprehensive directory. […] Not every plugin that meets
> the technical requirements will be accepted.

### Can the Lead submit automatically?

Yes mechanically, but the PR must not be a bare YAML edit — the generated READMEs and cache
must be committed with it, or CI fails on the dirty-tree step.

### Risk

**High.** CI green is necessary and not sufficient; the list is small and selective by design.

### Links

- Repository: https://github.com/DshMarketPlace/awesome-dsh-plugin
- Rules: https://github.com/DshMarketPlace/awesome-dsh-plugin/blob/main/CONTRIBUTING.md
- Data: https://github.com/DshMarketPlace/awesome-dsh-plugin/blob/main/data/curated.yml

---

## 6. Other directories observed (not researched in depth)

Found while checking links; reachable, but no readable submission rules were extracted:

- `https://dsh.so` — HTTP 200
- `https://dshfind.com` — HTTP 200
- `https://dshmarket.com` — HTTP 200 (site of `zhanghao3693/dsh-market`)
- `https://1024store.com` — TLS handshake failed from this machine

They are listed here for completeness, not as recommendations.

---

## 7. What this means for the release

Ordered by what is achievable soonest:

1. **Your own market** (`tangyixiao/dsh-plugin-market`) — the only one fully under your
   control, and the one the six-fact check in the release panel depends on. Do this first.
2. **DSH Marketplace full catalogue** — add the topics; the sync does the rest. No queue.
3. **dshopen.org** — open the issue form. Expect a question about route authentication, and
   prepare the answer: the route mirrors the documented `dsh-client-connection` check because
   this build has no Connection service wired, and the plugin never writes to GitHub.
4. **dpharness.com** — the form, or just let the daily scrape find it. No way to verify in
   advance.
5. **awesome-dsh-plugin** — wait 24 hours after repository creation, then one YAML file.
   Category `git`.
6. **DshMarketPlace/awesome-dsh-plugin** — one PR, `data/curated.yml`, category `dev`,
   generated files committed alongside.

Two things are true for every route above and worth stating plainly rather than discovering
later:

- **Fix the package before any of this.** `LICENSE` is declared in `files` but does not exist;
  `README.md`, `README.zh.md` and `icon.svg` likewise. dshopen and both awesome lists require a
  licence file and a README with install instructions. Submitting today would be rejected for
  reasons that have nothing to do with the plugin's quality.
- **The marketplace listing follows npm `latest`.** Publishing `0.1.0` as anything other than
  `latest` — a `next` tag, or a prerelease version — makes every one of these directories
  either skip the version or show a version that does not exist. No `--tag next`, no `-rc`.
