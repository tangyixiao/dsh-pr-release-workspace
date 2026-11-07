# gh CLI 调用验证表（PR 面板用）

环境：gh 2.97.0 / Windows / 登录 tangyixiao。验证样本：`cli/cli` 公开 PR、`tangyixiao/dsh-plugin-market`（我们自己的公开仓库）。
所有命令均已实跑并抓取输出；未实跑的标 **未验证**。

## 1. 命令 × 字段 × 验证状态

| 用途 | 确切命令 | 实际存在的 `--json` 字段 | 已验证 |
|---|---|---|---|
| PR 核心详情 | `gh pr view <n> --repo <O>/<R> --json number,title,body,state,isDraft,mergeable,mergeStateStatus,reviewDecision,author,baseRefName,headRefName,headRefOid,additions,deletions,changedFiles,url,createdAt,updatedAt,closedAt,mergedAt` | 全部存在。`author` 是对象 `{login,is_bot}` | ✅ |
| 变更文件清单 | `gh pr view <n> --repo <O>/<R> --json files` | 每项仅 `path, additions, deletions, changeType`；**无 `patch`**；最多 **100** 条 | ✅ |
| 整份 patch 文本 | `gh pr diff <n> --repo <O>/<R>` | 非 JSON，unified diff 字符串；`--patch` 换成 mailbox 格式（`From <sha> … Subject:`） | ✅ |
| 逐文件 patch（JSON） | `gh api "repos/<O>/<R>/pulls/<n>/files?per_page=100&page=N"` | 每项有 `patch`（unified hunk），另有 `sha,status,additions,deletions,changes,filename` | ✅ |
| Issue 评论 | `gh pr view <n> --json comments` | `author,authorAssociation,body,createdAt,id,includesCreatedEdit,isMinimized,minimizedReason,reactionGroups,url,viewerDidAuthor`；**无 path/line** | ✅ |
| 行内 review 评论 | `gh api "repos/<O>/<R>/pulls/<n>/comments?per_page=100"` | `id,path,line,start_line,side,start_side,original_line,original_start_line,diff_hunk,body,user.login,pull_request_review_id,in_reply_to_id,commit_id,html_url,position` | ✅ |
| Reviews | `gh pr view <n> --json reviews` / `--json latestReviews` | `author,authorAssociation,body,commit,id,includesCreatedEdit,reactionGroups,state,submittedAt` | ✅ |
| 待审请求 | `gh pr view <n> --json reviewRequests` | `{__typename:"User",login}`，Team 为 `{__typename:"Team",slug,name}`（Team 分支**未验证**） | ✅ 部分 |
| CI 检查 | `gh pr checks <n> --repo <O>/<R> --json bucket,state,name,link,workflow,event,startedAt,completedAt,description` | 全部存在；`bucket ∈ {pass,fail,pending,skipping,cancel}` | ✅ |
| CI 汇总（GraphQL） | `gh pr view <n> --json statusCheckRollup` | CheckRun:`__typename,conclusion,detailsUrl,name,startedAt,completedAt,status,workflowName`；StatusContext:`context,state,targetUrl,startedAt` | ✅ |

**`gh pr view` 完整合法字段**（用 `--json bogus` 报错枚举得到）：additions, assignees, author, autoMergeRequest, baseRefName, baseRefOid, body, changedFiles, closed, closedAt, closingIssuesReferences, comments, commits, createdAt, deletions, files, fullDatabaseId, headRefName, headRefOid, headRepository, headRepositoryOwner, id, isCrossRepository, isDraft, labels, latestReviews, maintainerCanModify, mergeCommit, mergeStateStatus, mergeable, mergedAt, mergedBy, milestone, number, potentialMergeCommit, projectCards, projectItems, reactionGroups, reviewDecision, reviewRequests, reviews, state, statusCheckRollup, title, updatedAt, url。

## 2. 真实输出片段（已 trim）

```text
$ gh pr view --repo cli/cli 14964 --json number,...,mergeStateStatus
{"additions":4,"author":{"is_bot":true,"login":"app/dependabot"},"baseRefName":"trunk",
 "changedFiles":2,"closedAt":null,"headRefOid":"dab49c4e...","isDraft":false,
 "mergeStateStatus":"BLOCKED","mergeable":"MERGEABLE","mergedAt":null,"number":14964,
 "reviewDecision":"REVIEW_REQUIRED","state":"OPEN"}

$ gh pr view --repo cli/cli 14964 --json files
{"files":[{"path":".github/workflows/codeql.yml","additions":3,"deletions":3,"changeType":"MODIFIED"},
          {"path":".github/workflows/govulncheck.yml","additions":1,"deletions":1,"changeType":"MODIFIED"}]}

$ gh api "repos/tangyixiao/dsh-plugin-market/pulls/9/files?per_page=100"   # 有 patch
[{"filename":"market.json","status":"modified","additions":1,"deletions":1,
  "patch":"@@ -41,7 +41,7 @@\n   \"plugins\": [\n ... -      \"version\": \"0.5.2\",\n+      \"version\": \"0.6.0\","}]

$ gh pr checks --repo cli/cli 14927 --json bucket,name,state
[{"bucket":"fail","name":"build (windows-latest)","state":"FAILURE"},
 {"bucket":"pass","name":"integration-tests (ubuntu-latest)","state":"SUCCESS"},
 {"bucket":"skipping","name":"ready-for-review","state":"SKIPPED"}]

$ gh pr view --repo cli/cli 14964 --json statusCheckRollup
[{"__typename":"CheckRun","conclusion":"SKIPPED","name":"label-external","status":"COMPLETED","workflowName":"PR Triaging"},
 {"__typename":"StatusContext","context":"EasyCLA","state":"SUCCESS","targetUrl":"https://..."}]
```

## 3. 关键坑（全部实测）

1. **`gh pr view --json files` 不含 patch，且静默截断到 100 条**。472 文件的 PR 返回正好 100 条，`exit=0`，无任何警告 → 不能据此判断"只有 100 个文件"。要 patch 必须走 REST `pulls/{n}/files`（该端点 `per_page` 上限 100，`per_page=300` 也只回 100；472 文件需分 5 页：100/100/…/72）。
2. **`gh pr diff` 超过 300 文件直接失败**：`exit=1`，stderr `could not find pull request diff: HTTP 406: Sorry, the diff exceeded the maximum number of files (300)...`，尾部还有一行 `PullRequest.diff too_large`。同一限制也作用于 `gh api -H "Accept: application/vnd.github.v3.diff" repos/O/R/pulls/N`（406 `too_large`）。→ 大 PR 只能用 `pulls/{n}/files` 逐页取 patch。
3. **`gh pr checks` 的 `exit=1` 有两种含义**：有 fail，或**该分支压根没有 check**（stderr `no checks reported on the 'branch' branch`）。必须以 `--json` 的输出是否为空来区分"未配置 CI"和"CI 失败"。
4. **`bucket` 值域**：`gh pr checks --json bucket` 文档写明为 `pass|fail|pending|skipping|cancel`。实测见到 `pass/fail/pending/skipping`；`cancel` **未验证**。退出码：全 pass/skip→0，有 fail→1，有 pending→**8**（实测 k8s PR 得到 8）。
5. **行内评论 `gh pr view` 拿不到**，只有 REST `pulls/{n}/comments` 有 `path/line/side/start_line/diff_hunk/in_reply_to_id`。线程"已解决"状态 REST 完全没有，必须 GraphQL `reviewThreads`。注意 GraphQL 的 `PullRequestReviewComment` **没有 `side` 字段**（实测报错 `Field 'side' doesn't exist`），side 只能取 REST。
6. **`mergeable`/`mergeStateStatus` 对已合并/已关闭 PR 返回 `UNKNOWN`**（实测 merged PR 与 closed PR 都是 `UNKNOWN`）。对 OPEN PR 是实时的：约 1.0–1.3 s 返回 `MERGEABLE`/`BLOCKED`，**不需要 `@include`**。仅 OPEN 状态可作门禁判断。
7. **merged 判定**：`mergedAt` 非 null 即已合并；`state=CLOSED` 且 `mergedAt=null` 是关闭未合并（实测 14961）。`state` 只有 `OPEN/CLOSED/MERGED`，不能单靠 `CLOSED` 区分。

## 4. GraphQL 线程解析（补充）

```powershell
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){reviewThreads(first:50){totalCount nodes{isResolved isOutdated path line comments(first:50){totalCount nodes{databaseId body path originalLine author{login}}}}}}}}' -f o=cli -f r=cli -F n=13251
```
实测返回：`{"isResolved":true,"isOutdated":false,"path":"internal/ghcmd/cmd.go","line":220,"commentCount":2}`。
注意：`-f` 传字符串，**`-F` 传数字**（`number:$n` 是 `Int!`，用 `-f n=14964` 会报 `Variable $n of type Int! was provided invalid value`）。

## 5. 错误 / 降级检测（实测 stderr + exit code）

| 场景 | exit | stderr / stdout |
|---|---|---|
| 未登录 | **4** | `To get started with GitHub CLI, please run:  gh auth login` + `Alternatively, populate the GH_TOKEN environment variable...` |
| token 失效 | 1 | `HTTP 401: Bad credentials (https://api.github.com/graphql)` + `Try authenticating with:  gh auth login -h github.com` |
| 仓库不存在/无权限 | 1 | `gh: Not Found (HTTP 404)` + `{"message":"Not Found",...}` |
| PR 不存在 | 1 | `GraphQL: Could not resolve to a PullRequest with the number of 999999999. (repository.pullRequest)` |
| 大 PR diff | 1 | `... exceeded the maximum number of files (300) ...` / `PullRequest.diff too_large` |
| 无 CI | 1 | `no checks reported on the '<branch>' branch` |
| 二进制未安装 | — | Node `spawnSync` 得到 `error.code === "ENOENT"`，`status === null`（plugin 侧据此判"gh 缺失"） |

`gh auth status` 未登录时 exit=1，输出 `You are not logged into any GitHub hosts. To log in, run: gh auth login`。

## 6. 未决事项

- `team-review-requested:ORG/SLUG` 与 `review-requested:@me` 在**当前账号下均返回 0 命中**（账号无 review 请求），因此该限定词的命中行为**未验证**。已知：非法 team 名在 GraphQL search 里**静默返回 `issueCount:0`**（不报错），而 REST search 才报 422 `"x/y" is not a valid team name` → 建议用 REST search 做校验探针。
- 团队枚举：`gh api user/teams` 可用（仅返回有 membership 的团队）；`gh api orgs/<O>/teams` 需要 `admin:org`，实测 403。改为 GraphQL `viewer.organizations.teams(userLogins:["<me>"])` 可用（实测 totalCount 0，因账号无团队）。
- 频率限制（实测）：core 5000/h、graphql 5000/h（`rateLimit` 查询本身 cost=1）、**search 仅 30/min** → 列表用 GraphQL search 时每个分组占 1 次 search 配额，三个分组刷新间隔务必 ≥ 2 s 且要缓存。
