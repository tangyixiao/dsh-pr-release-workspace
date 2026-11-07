# dsh-pr-release-workspace

[DeepSeek Harness](https://github.com/deepseek-harness) 的拉取请求与发布工作台。左侧加一个入口，做两件事：
不离开 DSH 就能看 PR，以及核验一次发布到底有没有真的发出去。

第二件事才是这个插件存在的理由。PR 已合并、CI 已通过、npm 已发布、GitHub Release 已发布、
市场 PR 已合并、市场清单里有这一版、线上索引已更新 —— 这是七个不同的事实。多数发布面板显示其中
一个就当成了全部。这个面板并排显示六个判据，六个都通过之前不会说「已发布」。

许可证：MIT。作者：Tang Yixiao。

---

## 环境要求

| 要求 | 原因 |
| --- | --- |
| DSH `>= 0.1.6-alpha.2` | 面板用到 `sidebar.panellist` 和 `main` 两个扩展点 |
| Node `>= 22` | 宿主侧用到 `AbortSignal.any` |
| `PATH` 上有 [GitHub CLI](https://cli.github.com/) `gh`，并且已登录（`gh auth login`） | 所有 GitHub 读取都走你现有的 `gh` 会话 |
| 「团队待审」需要 `read:org` scope | 没有就 `gh auth refresh -s read:org` |

插件不申请自己的 token，也不读浏览器 Cookie。它就是调 `gh` —— `gh` 能看到的，面板才能看到，不会更多。

---

## 安装

```sh
dsh plugin --profile <profile> add dsh-pr-release-workspace
```

桌面版的当前 profile 由应用自己管理，所以请在 DSH 的插件市场里装，或者加到你自己的 profile：

```sh
dsh plugin --profile web add dsh-pr-release-workspace
```

重启宿主，然后在左侧栏打开 **拉取请求**。

从本地目录试用：

```sh
dsh plugin --profile <profile> add file:/绝对路径/dsh-pr-release-workspace
```

## 卸载

```sh
dsh plugin --profile <profile> remove dsh-pr-release-workspace
```

本地批注不会因卸载消失。要一起清掉就删
`~/.dsh/storages/dsh-pr-release-workspace/drafts.json`。

---

## 功能

### 侧边栏入口

左侧栏一个图标，面板顶部用两个 pill 切换两半。

### 拉取请求

三个列表，各自独立加载：

| 列表 | 查询 |
| --- | --- |
| 我创建的 | `is:pr author:@me is:open` |
| 待我审查 | `is:pr review-requested:@me is:open` |
| 需要我的团队审查 | `is:pr team-review-requested:<你的团队> is:open` |

某个列表加载失败就单独说失败。某个列表的团队成员身份无法确认，也单独说明 —— 绝不渲染成「没有内容」，
因为「没法确认」和「确实没有」是两句话。

搜索框接受粘贴的 `https://github.com/owner/repo/pull/123`、`owner/repo#123` 简写，或交给 GitHub 搜索的
自由文本。

### PR 详情

四个标签页：

- **概览** —— 作者、描述、base/head 分支、可否合并、文件与行数、CI 汇总（每个 check 一行）。
- **文件** —— 变更文件列表与行数统计。展开就能看 diff，按旧侧/新侧文本渲染，用宿主自带的 diff 组件。
- **评论** —— 评审结论、会话评论、带文件与行号的行内评论。
- **我的批注** —— 你自己按文件和行写的本地评审批注。

CI 只会是这几种之一：通过、失败、进行中、已取消、只有跳过的检查、未配置、未知。空的检查列表是
**未配置**，不是「通过」。已取消的运行也不是通过。仓库根本没配 CI 的时候，它什么也没验证。

### 发布状态

填目标 —— owner、repo、tag、commit SHA、npm 包名、版本，以及市场仓库与 PR 号 —— 面板报告六个独立判据：

| 判据 | 读取来源 |
| --- | --- |
| 提交检查 | 该 commit 上的 check runs |
| GitHub Release | 该 tag 的 release |
| npm | 已发布版本与 `latest` dist-tag |
| 市场 PR | 市场仓库的那个 PR |
| 市场清单 | 市场默认分支上的 `market.json` |
| 线上索引 | 已发布的索引 URL |

每行显示自己的结论、原因，以及它读到的证据。六项全通过时汇总行才显示「全部判据通过」。

这三类情况是它专门要抓的，都是在真实数据里见过的：

- 市场 PR 已合并，但 `main` 上的清单里列的是**更新**的版本 —— 合并那个 PR 并没有发布你这一版。
- npm 上有这一版，但 `latest` 指向别处 —— 所以直接 `npm install` 拿不到。
- Release 有了，但该 commit 的 CI 还在进行 —— 那就是没人验证过产物。

## 它不做什么

- **不向 GitHub 写入。** 不发评论、不提交评审、不 Approve、不合并。这些动作都带着你的名字，应该由你来
  做，面板只负责把每项链接回 GitHub。
- **不读浏览器 Cookie，不存 token。** 认证是 `gh` 的事。
- **不把 PR 内容写进日志。** 错误在记录前先压成错误码；GitHub 的错误消息里可能带着私有文本。
- **不在磁盘上缓存 PR 内容。** 列表和 diff 每次重新取。它唯一写的文件是你自己的批注。
- **不渲染 GitHub 来的 Markdown 或 HTML。** 描述按纯文本显示，只把 `http(s)` 链接变成可点链接；
  对一个能访问本机 HTTP 路由的面板来说，Markdown 渲染器是过大的攻击面。

## 本地批注与隐私

批注存在 `~/.dsh/storages/dsh-pr-release-workspace/drafts.json`（或 `$DSH_HOME` 下）。每条记录 PR、
写入时的 commit、文件、行号。

写在更早 commit 上的批注会被标成 **stale**（对应行可能已经移动），而不是被悄悄挪到那个位置现在的
内容上。读取路径从不改写批注位置。

任何内容都不离开这台机器，什么都不会发出去。删掉就是删掉。

## 路由

客户端通过 `POST /dsh-pr-release-workspace/<endpoint>` 与宿主通信。该路由会先询问组合的
`connection` 服务——`connection.requestRejection(request)`——并原样透传它的 `401`/`403`；这道闸
既执行 Host/Origin 规则，也要求启动令牌建立起来的浏览器会话 cookie。若 `connection` 抛错，则拒绝。
之后该路由只接受 `POST` 且 `content-type: application/json`，请求体上限 1 MiB，统一返回 JSON 信封：
`{"ok":true,"value":…}` 或 `{"ok":false,"error":{"code":…,"message":…}}`。端点名与 GitHub 的
owner/repo/number 参数在进入 `gh` 之前都会按固定模式校验；`gh` 以参数数组启动，从不经过 shell 字符串。

插件自身的本机校验（`Host` 为回环地址或服务绑定地址、出现的 `Origin` 与 `Host` 一致、无
`sec-fetch-site: cross-site`）仍在 `connection` 闸之后执行。它保护的是完全没有 `connection`
服务的组合——无头宿主或测试环境——否则那条路由就没有任何认证。

## 已知限制

- `gh pr view --json files` 在 100 个文件处静默截断。面板会报告真实的变更文件数，并说明当前只显示了其中多少。
- 超过 300 个文件的 diff 无法一次取回。面板改用逐文件 patch 重组，并注明这一点。
- 二进制文件没有文本两侧，显示为「二进制文件」。
- GitHub 搜索接口限速 30 次/分钟。连续快速刷新三个列表会触限，面板会告诉你还要等多久。
- DSH `0.1.6-alpha.2` 没有原生 diff 或评审面板可复用，所以 diff 视图建在
  `@deepseek-ai/dsh-client-ui-primitives` 自带的 `DiffBlock` 之上。

## 开发

```sh
npm install
npm run build      # 把 src/client/*.js 拼成 lib/client.js
npm test           # node --test，100+ 个用例
```

没有打包器。`lib/client.js` 由 `src/client/` 下按编号排列的片段拼装而成，每个片段往同一个命名空间
对象上挂东西，最后包进 DSH 期望的 loader 调用。数字前缀就是加载顺序，不能重新编号。

`lib/host/` 是纯 ESM，没有构建步骤。

宿主版本调研见 `docs/baseline.md`，`gh` 行为实测表见 `docs/research/gh-api.md`，可复用的原生能力调研
见 `docs/research/native-review.md`（几乎没有）。

## 许可证

MIT —— 见 [LICENSE](./LICENSE)。
