# 0.1.8 — Owner admission and Host contract hardening

HTTP routes now require the Host's synchronous `connection.requestRejection(request)` approval followed by an `admit(request)` result whose principal is `owner`. An authenticated non-owner API Peer cannot use the host's GitHub CLI session or local drafts. Missing methods, throwing method getters, exceptions, malformed results and asynchronous verdicts fail closed before body reads or endpoint work. Rejected promises and thenables are consumed to avoid unhandled process-level failures.

This changes compatibility: the minimum DSH version is now `>=0.2.2-rc.1 <0.3.0-0`. The official rc.1 package and installed rc.3 runtime provide both APIs. Older hosts lacking owner admission receive no data route; authentication is never weakened as a fallback. Owner browser requests without an Origin header remain supported.

GitHub CLI must be installed on `PATH` and authenticated with `gh auth login`; both quick starts and usage guides state this requirement.

## 中文说明

HTTP 路由先执行宿主 `requestRejection`，再通过同步 `admit` 结果确认 owner。已认证的非 owner API Peer 不能借用宿主的 gh 登录或本地批注。方法缺失、getter 抛错、异常、无效值及异步返回值均在读取请求体或执行端点前拒绝；异步拒绝被消费以免触发未处理的 Promise rejection。

兼容范围实质收紧为 `>=0.2.2-rc.1 <0.3.0-0`；已核对官方 rc.1 包与本机 rc.3 契约。旧宿主缺少 owner 准入 API 时不注册数据路由，不采用降级放行。没有 Origin 请求头的 owner 浏览器请求仍受支持。使用前仍须安装 GitHub CLI 并运行 `gh auth login`。
