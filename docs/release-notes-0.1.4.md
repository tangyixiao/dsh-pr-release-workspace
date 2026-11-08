# 0.1.4 — Verified against DSH 0.2.2-rc.1

**This release fixes a wrong statement, and one real bug the statement was hiding.**

0.1.3 works. It shipped a connection fence and it passed its tests. What was wrong was the
claim underneath it: the baseline said the host was DSH `0.1.6-alpha.2`, and on that basis the
package declared `engines.dsh: ">=0.1.6-alpha.2"`. The host was actually `0.2.2-rc.1`.

## Why the baseline was wrong

`~/.dsh/profiles/node_modules/@deepseek-ai/dsh` does report `0.1.6-alpha.2`. That tree belongs
to the CLI profile. The Desktop application does not load it — Desktop runs its own runtime
from `app.asar`, and that runtime is `@deepseek-ai/dsh-desktop-runtime 0.2.2-rc.1`. Reading the
profile was reading the wrong tree, and every downstream document inherited the mistake.

The honest value comes out of the asar: 12 bytes of header, then a `uint32` header size, then a
JSON directory, then the file data. Every forge package, the sidebar, the layout, the locale
packages and the client connection package inside it are `0.2.2-rc.1`.

## The bug under the claim

Running the panel on the real host surfaced one: **pasting a pull request link searched for it
instead of opening it.** The hint under the box has always said `owner/repo#123` or a github.com
pull URL works, and the host has always had a `resolve` endpoint that parses exactly those — but
no client code ever called it. The submitted text went straight to GitHub's search API, which
returns nothing for a URL, so a paste came back as "no matches" for every PR including the one
two inches away in the list.

The box now routes on the shape of the input. A github.com pull URL, `owner/repo/pull/123`,
`owner/repo#123`, or a bare `#123` / `123` goes to `resolve` and opens the detail view directly.
Anything else — and any reference the host refuses, such as a bare number with no repository in
view — falls back to search, so free text still answers honestly. `looksLikeReference` is only a
routing hint; the host still owns the real parsing and refuses non-references with
`bad-request`.

Verified on a running 0.2.2-rc.1 host: both the URL and the shorthand open the PR, free text
still searches, and Back returns to a clean list.

## What changed in the code

Nothing had to be renamed. Three contracts were checked on both hosts and they are identical:

| Contract | `0.1.6-alpha.2` | `0.2.2-rc.1` |
| --- | --- | --- |
| `sidebar.panellist` | `list` / `root` | same |
| `main` | `keyed` / `root`, addressed by `options.key` | same |
| `connection.requestRejection(request)` | `403` / `401` / `undefined` | same |

So there is no version branch anywhere. What did change is how the plugin **finds** things:

- **Host services** are looked up by `serviceOf(inner, name)`: the plain property first, then
  `inner.get(name, false)`. A Cordis proxy throws on a name the fiber did not declare, so the
  property read is wrapped; the reflective read is the fallback. Capability checks
  (`typeof register === 'function'`, same for `requestRejection`) still decide whether a route
  is published — a service that exists but cannot fence still gets no route.
- **Client capabilities** are probed once at load (`PRW.compat`). Missing primitives are
  reported instead of rendering blanks; a host without a slot service or a locale service still
  gets a working panel with a local dictionary fallback.
- **The host version is read at runtime** from the `clientModules` service
  (`release.version`) and logged. On a host that does not publish it, the log says
  `version not reported` — it never guesses.

## What changed in the metadata

- `engines.dsh` is now `>=0.1.6-alpha.2 <0.3.0-0`. The lower bound is the oldest host this
  panel was tested against; the upper bound excludes the next major. `<0.3.0-0` rather than
  `<0.3.0` because DSH evaluates the range with `includePrerelease: true`, and under that rule
  `<0.3.0` still admits `0.3.0-0`.
- `version` is `0.1.4`. `0.1.3` was taken by the security release and is not being reused.

## Documentation corrected

- `README.md` / `README.zh.md`: the Requirements row now names the real range and the host it
  was verified on.
- The "Known limits" line that said DSH `0.1.6-alpha.2` has no native diff or review panel is
  gone. It was wrong twice over: `0.2.2` ships a native review surface (the **Change requests &
  worktrees** experimental plugin), and `DiffBlock` was never a dependency of this package —
  it is part of the host. The README now describes the division of labour instead: the official
  panel owns the right sidebar and shows the PR bound to the current session; this panel owns
  the left rail and does discovery, search and the release chain.
- `docs/baseline.md`: the baseline table now reads the version out of `app.asar`, records the
  three-contract comparison, and explains why a plugin should not re-implement the host's own
  compatibility check.

## Upgrading

```sh
npm install dsh-pr-release-workspace@0.1.4
```

Nothing to migrate. No stored data changed shape; local notes are untouched.

## Tests

166 cases, all passing. Three new files cover this release:
`test/host-compat.test.js` (service lookup order, a proxy that throws on read, a connection
without an admission method, version reporting), `test/client-compat.test.js` (degraded
primitives, a missing slot service, a missing locale service) and `test/client-search.test.js`
(which input goes to `resolve` and which goes to search).
