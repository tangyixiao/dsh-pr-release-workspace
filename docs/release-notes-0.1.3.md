# dsh-pr-release-workspace 0.1.3

A security fix for compositions that lack DSH connection authentication.

## What changed

In 0.1.2, a composition with a web server but no `connection` service or no
`connection.requestRejection` method still exposed the plugin's data route. It
trusted loopback, Host and Origin checks alone. A non-browser client can supply
those headers, so they cannot authenticate access to private GitHub data or local
review notes. A loopback binding limits reachability but does not fix that gap.

The plugin now registers no data route when connection authentication is
unavailable. The request admission function independently returns `403` when the
service or method is missing, including when the method disappears after route
registration. Authentication remains ahead of method and content-type checks.
The existing `401`/`403` passthrough and throw-refuses behavior remain in place.
Only the connection service's documented `undefined` result allows a request;
unexpected return values, including a Promise, are refused with `403`.

Compositions without connection authentication have no panel data. They must
provide the supported DSH connection service to use the panel.

## Verification

Two regression tests first failed against 0.1.2: a local JSON request was admitted
without an authentication service, and the host registered the data route anyway.
The tests now require `403` for missing or malformed services and no route
registration without the admission method. A further regression first failed
when the connection service returned `null`; it now covers unexpected return
values as refusals. Existing tests cover authenticated admission, `401`/`403`
passthrough, exceptions and method/content-type checks.

The release preparation runs the full test suite, build and package dry-run.
Real DSH host validation and publication are tracked separately from those local
checks.

## Upgrade

```sh
dsh plugin --profile <profile> add dsh-pr-release-workspace@0.1.3
```

Restart the host after installation. The panel continues to use the current
`gh` session and never posts to GitHub.
