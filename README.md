# dsh-pr-release-workspace

A pull request and release workspace for [DeepSeek Harness](https://github.com/deepseek-harness). It adds one sidebar entry that
does two jobs: review pull requests without leaving DSH, and check whether a release
actually shipped.

The second job is the reason this plugin exists. A merged pull request, a green CI run, a
published npm version, a GitHub Release, a merged market pull request, a market manifest
entry and a live index update are seven different facts. Most release dashboards show one
of them and call it done. This one takes the pull request as its target and shows the other
six as separate verdicts, refusing to say "released" until every one of them passes.

Licence: MIT. Author: Tang Yixiao.

---

## Requirements

| Requirement | Why |
| --- | --- |
| DSH `>= 0.1.6-alpha.2 < 0.3.0-0` | The panel uses the `sidebar.panellist` and `main` slots, which are unchanged from `0.1.6-alpha.2` through `0.2.2`. Verified on `0.2.2-rc.1`. |
| Node `>= 22` | The host half uses `AbortSignal.any` |
| [GitHub CLI](https://cli.github.com/) `gh` on `PATH`, signed in (`gh auth login`) | Every GitHub read goes through your existing `gh` session |
| `read:org` scope for the team tab | `gh auth refresh -s read:org` if your token lacks it |

The plugin never asks for a token of its own and never reads a browser cookie. It shells
out to `gh`, so whatever `gh` can see is what the panel can see, and nothing more.

---

## Install

```sh
dsh plugin --profile <profile> add dsh-pr-release-workspace
```

In the desktop app the active profile is managed by the application itself, so install the
package from the plugin market inside DSH, or add it to a profile you control:

```sh
dsh plugin --profile web add dsh-pr-release-workspace
```

Then restart the host and open **Pull requests** in the left sidebar.

To try it from a local checkout instead:

```sh
dsh plugin --profile <profile> add file:/absolute/path/to/dsh-pr-release-workspace
```

## Uninstall

```sh
dsh plugin --profile <profile> remove dsh-pr-release-workspace
```

Local review notes survive an uninstall. Delete `~/.dsh/storages/dsh-pr-release-workspace/drafts.json`
if you want them gone too.

---

## What you get

### The sidebar entry

One icon in the left rail. The panel has two halves, switched by a pair of pills at the top.

### Pull requests

Three lists, each loaded independently:

| List | Query |
| --- | --- |
| Created by me | `is:pr author:@me is:open` |
| Awaiting my review | `is:pr review-requested:@me is:open` |
| Awaiting my team | `is:pr team-review-requested:<your-teams> is:open` |

A list that could not be loaded says so, per list. A list whose team membership could not be
confirmed says so — it is never rendered as "no results", because "we could not check" and
"there is nothing" are different statements.

The search box takes a pasted `https://github.com/owner/repo/pull/123` URL, the
`owner/repo#123` shorthand, or free text passed to GitHub's search.

### The pull request view

Four tabs:

- **Overview** — author, description, base and head branches, mergeable state, file and
  line counts, and the CI rollup with one row per check.
- **Files** — the changed file list with line totals. Expand a file for its diff, written as
  old-side and new-side text and rendered by the host's own diff component.
- **Comments** — review verdicts, conversation comments, and inline comments with their file
  and line.
- **My notes** — review notes you write locally, per file and per line.

CI is reported as one of: passed, failed, pending, cancelled, only skipped checks, not
configured, or unknown. An empty check list is **not configured**, never "passed". A
cancelled run is not a pass. This distinction matters: a repository with no CI has not
verified anything.

### Release state

Fill in the target — owner, repo, tag, commit SHA, npm package name, version, and the market
repository plus pull request number — and the panel reports six independent facts:

| Fact | Read from |
| --- | --- |
| Commit checks | check runs on the exact commit |
| GitHub Release | the release for the tag |
| npm | the published version and the `latest` dist-tag |
| Market pull request | the market repository's pull request |
| Market manifest | `market.json` on the market's default branch |
| Live index | the published market index URL |

Each row shows its own verdict, its reason, and the evidence it read. The summary reads
"every fact checks out" only when all six pass.

Three cases this is built to catch, all observed in the wild:

- The market pull request is merged, but the manifest on `main` lists a *newer* version than
  the one you asked about — so merging that PR did not publish your version.
- npm has the version, but `latest` points somewhere else — so a plain `npm install` does not
  get it.
- The release exists, but CI on that commit is still pending — so nobody verified the
  artifact.

## What it does not do

- **It does not write to GitHub.** No comments, no reviews, no approvals, no merges. Every
  one of those is a decision with a name attached, and the panel is not where you make it.
  Each pull request view links to GitHub for those actions.
- **It does not read browser cookies or store a token.** Authentication is `gh`'s.
- **It does not write pull request content to logs.** Errors are flattened to a code before
  they are logged; a GitHub error message can quote private text.
- **It does not cache pull request content on disk.** Lists and diffs are re-fetched. The
  only file it writes is your own local notes.
- **It does not render Markdown or HTML from GitHub.** Descriptions show as text with
  `http(s)` links; a Markdown renderer is a large attack surface for a panel that can reach a
  local HTTP route.

## Local notes and privacy

Notes are stored at `~/.dsh/storages/dsh-pr-release-workspace/drafts.json` (or under
`$DSH_HOME`). Each note records the pull request, the commit it was written against, the
file, and the line.

A note written against an earlier commit is marked **stale** rather than moved to whatever
now occupies that line. The read path never rewrites a note's position.

Nothing leaves the machine. Nothing is posted. Deleting a note deletes it.

## Routes

The client talks to the host on `POST /dsh-pr-release-workspace/<endpoint>`. The route asks
the composition's `connection` service first — `connection.requestRejection(request)` — and
passes its `401`/`403` straight through; that fence applies the Host/Origin rules and then
requires the browser session cookie the launch token established. A connection service that
throws refuses. After that the route requires `POST` with `content-type: application/json`,
caps bodies at 1 MiB, and answers with a JSON envelope:
`{"ok":true,"value":…}` or `{"ok":false,"error":{"code":…,"message":…}}`. Endpoint names and
GitHub owner/repo/number arguments are validated against a fixed pattern before they reach
`gh`; `gh` is spawned with an argument array, never a shell string.

The plugin's own local-only check (`Host` is loopback or the server's bind address, a present
`Origin` matches `Host`, no `sec-fetch-site: cross-site`) still runs after the connection
fence. Those headers are an additional boundary; they do not authenticate a caller. If the
composition has no `connection` service or no `requestRejection` method, the plugin registers
no data route and the panel has no data. The admission check also refuses with `403` if that
method disappears after registration.

## Known limits

- `gh pr view --json files` silently truncates at 100 files. The panel reports the real
  changed-file count and says when it is showing fewer.
- Diffs over 300 files cannot be fetched as one diff. The panel reassembles them from
  per-file patches and says so.
- A binary file has no text sides and renders as "binary file".
- GitHub's search API allows 30 requests a minute. Reloading the three lists in a tight loop
  will hit the limit; the panel then says how long to wait.
- DSH ships a native review surface on recent versions — the **Change requests & worktrees**
  experimental plugin, which registers a tab in the right sidebar
  (`sidebar.right.pane.tab`) and shows only the pull request bound to the current session.
  That panel starts from a branch and therefore cannot answer "which of my open pull requests
  did anyone review". This plugin is the other half: discovery across all three queues, search
  by paste, and the release chain. The two run side by side and do not fight over a slot —
  the official panel owns the right of the window, this one owns the left rail.
- The diff view is built on the `DiffBlock` component that ships with
  `@deepseek-ai/dsh-client-ui-primitives`. Both pieces are part of the host, not a dependency
  this package installs; if a host ships an older component set, the affected controls fall
  back to plain markup and the panel says so rather than rendering blank.

## Development

```sh
npm install
npm run build      # concatenates src/client/*.js into lib/client.js
npm test           # node --test, 100+ cases
```

There is no bundler. `lib/client.js` is assembled from numbered fragments in `src/client/`,
each of which appends to one namespace object, and is wrapped in the loader call DSH expects.
The numeric prefixes are load order and must not be renumbered.

`lib/host/` is plain ESM, no build step.

See `docs/baseline.md` for the host-version research this was built against,
`docs/research/gh-api.md` for the verified `gh` behaviour table, and
`docs/research/native-review.md` for what native capability exists to reuse (almost none).

## Licence

MIT — see [LICENSE](./LICENSE).
