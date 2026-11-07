# v0.1.2 — the route now asks DSH who is allowed in

A security fix. Everything the panel does is unchanged; what changed is who can
reach the route behind it.

## The defect

The route was guarded only by `isTrustedLocalRequest`: it checked the `Host`
header, `Origin`, and `sec-fetch-site`. Those rules stop DNS rebinding — a page
cannot make the browser believe it is talking to `127.0.0.1` when it is not — but
they are **not authentication**. A page served from any origin can send a
loopback request without an `Origin` header at all, and the route answered it.

So: any web page the user happened to have open could read their pull request
list, titles, diffs and review comments through this panel.

## The fix

DSH already provides the fence. `connection.requestRejection(request)` applies
the Host/Origin rules and then requires the browser session cookie that the
launch token established, answering `401` or `403`. Every first-party route asks
it first (`packages/host/open-in-app/src/index.ts:184-191`), and its own comment
explains why: the fence "defeats DNS rebinding and cross-site calls, and its
browser authentication (the login-token cookie) gates every caller".

`@deepseek-ai/dsh-host-webserver` does no checking of its own, so this was
entirely the plugin's responsibility — and 0.1.0/0.1.1 skipped it.

`apply` now injects `['webServer', 'connection']`. The whole admission decision
moved into `admitRequest()` in `lib/host/routes.js`, ordered as:

1. **connection fence** — `401`/`403` passed through verbatim
2. **method** — `405`
3. **local check** — `403`
4. **content type** — `415`

The fence runs before the method check so a refused caller cannot probe which
endpoints exist. A connection service that **throws** refuses: "we could not
tell" is not "yes". A composition with no connection service at all (headless,
tests) still runs the local check and logs that only that check applies.

## Verified in a real DSH host

```
POST /dsh-pr-release-workspace/identity, no cookie   → 401
same call, with the launch-token session cookie      → 200 + real pull requests
```

And the panel still lists, opens and diffs pull requests in the browser, so the
intended path is intact.

## Upgrade

```sh
npm install -g dsh-pr-release-workspace@0.1.2
# or, in a profile you control:
dsh plugin --profile <profile> add dsh-pr-release-workspace@0.1.2
```

Then restart the host. **If you run 0.1.0 or 0.1.1, upgrade**: the route in those
versions is reachable by any page the browser loads.

## Tests

144 tests, all passing. Five are new and each names the attack it closes: the
401/403 passthrough, the throw-refuses case, the no-connection fallback, the
no-oracle ordering, and post-fence method/content-type checks.

## Unchanged

- Nothing is ever written to GitHub: no comments, reviews, approvals, merges.
- No cookie, token or private pull-request content is logged.
- Local notes stay in `~/.dsh/storages/dsh-pr-release-workspace/drafts.json`.
- The six release facts remain six separate verdicts.
- Known limits still apply: `gh pr view --json files` stops at 100 files, diffs
  over 300 files are reassembled page by page (a 1,680-file pull request takes
  about 20 seconds and returns a large payload), and binary files have no text
  sides.
