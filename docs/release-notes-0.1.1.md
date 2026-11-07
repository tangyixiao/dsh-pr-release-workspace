# dsh-pr-release-workspace 0.1.1

A patch release. One real defect, found by using the panel against a genuinely large pull
request rather than against fixtures.

Package: `dsh-pr-release-workspace`
License: MIT
Previous release: 0.1.0

---

## What changed

### Large pull requests open again

`gh pr diff` refuses any pull request with more than 300 changed files:

```
HTTP 406: Sorry, the diff exceeded the maximum number of files (300).
PullRequest.diff too_large
```

The panel has always had a fallback for that — the per-file endpoint still answers — but the
fallback could never run. `runGh` classifies a failure and returns a content-free message, so
the original stderr, which is the only place `406` and `too_large` appear, was already gone by
the time `readPullDiff` caught the error. The check that should have recognised the refusal
matched against that erased message and therefore always said no.

The effect in the real host: opening a 1680-file pull request and clicking 文件 rendered
「diff 加载失败。」 with 「GitHub 拒绝了这次请求。」 — a size limit reported as a refusal.

Now:

- The classifier assigns `diff-too-large` before the generic branches. It is a recoverable
  code, not `unknown`.
- The per-file fallback actually runs, and pages up to 20 pages (2000 files) instead of 8.
- The files tab distinguishes two different claims. `truncated` means GitHub would not render
  the change as one diff. `complete` means the per-file read reached the end. When it did not,
  the panel says the list below is incomplete instead of presenting a slice that looks whole.

Measured on `tangyixiao/CSP-2026#6` (1680 changed files): 1680 files, 1667 with text, 13 named
as binary with no text on either side, `complete: true`. A 21-file pull request still takes the
fast `gh pr diff` path unchanged.

### Tests

A new test pins the case that was missing:
`the "more than 300 files" refusal is its own recoverable code, not unknown`. It also asserts
the surfaced message stays content-free — no URL, no owner name.

Full suite: **139 tests, 139 pass**.

---

## Install

```
dsh plugin --profile <your-profile> add dsh-pr-release-workspace
```

Requires DSH 0.1.6-alpha.2 or newer, Node 22 or newer, and a `gh` on PATH that is already
signed in (`gh auth login`). The panel reads through `gh` and never handles a token itself.

---

## Known limits, unchanged

- A 2000-file pull request takes roughly 25 seconds per diff open and produces a payload of
  several megabytes. Reading every file eagerly has that cost; capping the payload or loading
  files lazily is a separate change.
- Files that GitHub will not patch (binaries, very large files) are listed by name with no
  text on either side. They are not silently dropped.
- The team tab needs `read:org`. Without it the tab says membership could not be confirmed
  rather than showing an empty list.
- The panel is read-only. It does not comment, review, approve, request changes, or merge.
  Those stay a deliberate action on GitHub.
