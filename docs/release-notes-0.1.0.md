# dsh-pr-release-workspace 0.1.0

First formal release. A DSH panel for reviewing pull requests and for checking whether a
release actually happened.

Package: `dsh-pr-release-workspace`
License: MIT
Repository: https://github.com/tangyixiao/dsh-pr-release-workspace

---

## What it does

The plugin adds one sidebar entry, **Pull requests**, with two top-level views: the PR
workspace and **Release state**.

The PR workspace has three group tabs.

**Created by me** — pull requests you opened, with state, draft marker, the repository, the
head branch, and the relative time of the last update.

**Awaiting my review** — pull requests where your review is requested.

**Awaiting my team** — pull requests where a team you belong to is requested. This tab needs
the `read:org` scope on your `gh` token. Without it the tab says
"Team membership could not be confirmed, so this list may be incomplete." rather than showing
an empty list, because an empty list would read as "nothing to review".

Clicking a pull request opens a detail view with four tabs:

- **Overview** — base and head branches, head commit, mergeable or conflicting, the
  description as text, and the CI rollup.
- **Files** — the changed file list and, per file, the diff hunks.
- **Comments** — the reviews and the inline review comments, with file and line.
- **My notes** — local review notes you write per file and line.

A search box accepts `owner/repo#123` or a pasted `github.com` pull request URL.

### Release state

The second half of the panel answers a question that a merged pull request does not answer:
did this version actually ship? It takes a target — owner, repo, tag, commit SHA, npm package
name, version, and the market repository plus pull request number — and reports **six
separate facts**:

| Fact | Reads |
| --- | --- |
| Commit checks | `GET /repos/{owner}/{repo}/commits/{sha}/check-runs` |
| GitHub Release | the release for the tag |
| npm | the published version and the `latest` dist-tag |
| Market pull request | `gh pr view` on the market repository |
| Market manifest | `market.json` on the market's default branch |
| Live index | the published index URL |

Each fact renders with its own verdict — Yes, No, Pending, Unverified, Not configured, or
Stale — its reason, and a link to the evidence. The summary line reads "Every fact checks out"
only when all six pass. A pending CI run is not a pass. An npm version that exists but is not
`latest` is not a pass. A merged PR with no published package is not a pass.

This is deliberate. The panel is built to refuse to call a release done on the strength of one
green check.

### Local review notes

You can attach notes to a file and line in the diff. They stay on this machine, under the DSH
home directory (`~/.dsh` by default), in a JSON store. They are never posted anywhere. A note
written against an earlier commit is marked "Written against an earlier commit" rather than
silently moved to whatever line now occupies that position.

---

## What it does not do

**It does not write to GitHub.** No comments, no reviews, no approvals, no change requests, no
merges, no labels, no branch updates, no closing. The panel reads; you act on GitHub. The
message it shows when you try to leave a note says exactly this: "This panel is read-only: it
never posts to GitHub."

**It does not register any agent tool, model provider, prompt fragment, or hook.** It adds a
panel and nothing else. Your agent's tool list is unchanged by installing it.

**It does not store or handle GitHub credentials.** Every GitHub call goes through the `gh`
CLI and your existing `gh auth login` session. The plugin never sees a token.

**It does not cache GitHub responses on disk.** Each view is fetched when you open it.

---

## Requirements

- **DSH** `>= 0.1.6-alpha.2` (declared in `engines.dsh`). That release is the validated
  baseline: it provides the `webServer` route service the panel's data channel uses.
- **Node.js** `>= 22` (`engines.node`).
- **GitHub CLI** installed and authenticated: run `gh auth login` once. Without it the panel
  shows "The `gh` command is not available" or "GitHub is not signed in" and does nothing
  else.
- **A DSH host that exposes `webServer`.** If it does not, the plugin logs a warning at start
  instead of throwing, and the panel has no data.

Scopes: `repo` covers everything except the "Awaiting my team" tab and team review requests,
which need `read:org`.

Platforms: DSH web UI and the desktop app's web surface. This has been exercised on Windows;
macOS and Linux have not been run by the maintainer. The panel itself is
platform-independent, so the risk there is the `gh` CLI's behaviour, not the plugin's.

---

## Install

From npm:

```
dsh plugin --profile web add dsh-pr-release-workspace
```

Or without naming the profile, into the default one:

```
dsh plugin add dsh-pr-release-workspace
```

From a downloaded tarball:

```
dsh plugin --profile web add ./dsh-pr-release-workspace-0.1.0.tgz
```

Then reload DSH. The sidebar entry is **Pull requests**. If it does not appear, check that
`gh auth status` succeeds in a terminal on the same machine.

To remove:

```
dsh plugin --profile web remove dsh-pr-release-workspace
```

Removal does not delete your local notes; they remain under `~/.dsh` until you delete them.

---

## Known limits

These are real and measured in the source, not hedging. Each one is a boundary set by the
GitHub API or a deliberate scope decision.

**Diffs over 300 changed files.** `gh pr diff` refuses a pull request with more than 300
changed files (HTTP 406, "too_large"). The plugin catches that and reassembles the diff from
the per-file patches endpoint instead, which is capped at 800 files (8 pages of 100). Beyond
that, the diff is marked truncated. The panel says so: "This pull request is larger than one
diff; files were read individually."

**File lists over 100 files.** `gh pr view --json files` returns at most 100 entries and
truncates silently. When the returned list is shorter than the PR's stated changed-file count,
the panel shows "showing 100 of 472" rather than pretending the list is complete.

**Diffs over 1.5 MB.** Truncated and labelled.

**Inline review comments are one page of 100, and they are flat.** Review comments are read
from a single REST page. More than 100 inline comments will be cut off. They render as a flat
list per file, ordered by file and line — there is no thread model, no reply nesting, and no
resolved/unresolved state. If you need to know whether a thread is resolved, use GitHub.

**Search is capped at 1,000 results.** GitHub's search API returns at most 1,000 items per
query. When the total count exceeds that, the panel reports it rather than implying it has
everything.

**Team review requests are best-effort.** Only the first six teams you belong to get their own
`team-review-requested:` query. Without `read:org`, the "Awaiting my team" tab shows
"unconfirmed" instead of an empty list — an empty list would be a lie.

**Rate limits are surfaced, not retried.** When GitHub asks the panel to slow down, it shows
the wait time GitHub gave it and does not retry in the background.

**Notes are local only.** There is no sync, no export yet, and no way to turn a note into a
GitHub review comment. The 20,000-character cap per note body is a request-body limit, not a
suggestion.

**No multi-account support.** The panel uses whichever account `gh` is currently authenticated
as.

---

## What changed

Initial release. No prior versions.

---

## Verification for this release

- 136 tests, 0 failures, 0 skipped (`npm test`).
- Build is reproducible from 13 source fragments (`npm run build`). CI rebuilds the bundle and
  fails if the committed `lib/client.js` differs, so the source and the artifact cannot drift.
- `node --check` clean on `lib/index.js`, `lib/client.js`, `lib/host/routes.js`,
  `lib/host/release.js`.
- Tarball contents inspected with `npm pack --dry-run` before publishing: 16 files —
  `package.json`, `cordis.patch.yml`, `LICENSE`, `README.md`, `README.zh.md`, `icon.svg`,
  `lib/` (7 files), `locale/en.json`, `locale/zh.json`. No `src/`, no `test/`, no
  `node_modules/`.
- The read-only guarantee is enforced by construction, not by policy: `lib/index.js` registers
  one prefix route and no tool, and every endpoint in `lib/host/routes.js` is a read or a local
  note write. A source scan in `test/security.test.js` asserts no production file performs a
  GitHub write.
- Exercised end to end inside a real DSH process (isolated `DSH_HOME`, profile `rescue-prw`,
  port 13787) against real GitHub: the sidebar entry renders, the three group queries return
  real data (authored 116 total, review-requested 0, team-review-requested `unconfirmed` for an
  account with no teams), a real PR opens with its YAML diff and its two passing checks, the
  notes tab saves and marks a note stale when the SHA changes, and the release panel returns six
  separate rows for an unpublished version (`ready: false`).

What has **not** been done: a full release chain observed from the panel itself for a version
this plugin published — that is what 0.1.0 establishes, and the panel is used to verify it. And
the panel has not been run against a pull request with more than 300 changed files, so the
reassembly path is covered by unit tests rather than by a live observation.

