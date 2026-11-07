# DSH 0.1.6-alpha.2 原生 review / diff / PR 能力

只读侦察。版本核对：`C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-layout\package.json:4` = `0.1.6-alpha.2`。

## Q1 没有原生代码审查 / PR / diff 面板

- **已装包零命中**：`C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\` 全量目录名按 `review|diff|pr|git|vcs|change` 过滤为空。源码树同理——`D:\deepseek-harness\packages\client\` 60+ 包只有 `ui-sidebar-documentpreview` 命中，而它是文本/图片/PDF/Office 预览，无 diff 视图。
- **唯一 diff 渲染件 = `DiffBlock`**，导出见 `D:\deepseek-harness\packages\client\ui-primitives\src\index.ts:57-58`。
  - 签名 `DiffBlock({ diffs: DiffHunk[], labels: DiffBlockLabels, maxLines?, className? })`，`DiffHunk = { path: string; oldText: string | null; newText: string }`（`...\ui-primitives\src\DiffBlock.tsx:15-33`）。
  - 硬限制：**不接受 unified patch 字符串**，自己用 npm `diff` 的 `structuredPatch()` 从 oldText/newText 现算（`DiffBlock.tsx:71-78`，`MAX_DIFF_EDIT_LENGTH = 256`）；单列 unified，无 split、无语法高亮。
  - 唯一消费者是工具卡：`...\ui-tool\src\client\tool\models\diff-card-model.ts:2,20`（`CHAT_DIFF_MAX_LINES = 9` 见 `:7`）。
- **`@deepseek-ai/dsh-experimental-auto-review` 不是代码审查**：它是工具调用前逐次 LLM 授权闸（`D:\deepseek-harness\packages\experimental\auto-review\README.md:7-9`）。桌面 profile bundles 列了它（`C:\Users\tangy\.dsh\profiles\desktop\package.json:44`）但目录不存在 → 未加载。
- `@feng0531/dsh-code-review` **0.86.1** — **无 client bundle、零 UI**。`index.mjs:6-7` `name='dsh-code-review'`、`inject=['tools','llm']`；`:18-19` 注册 `code_review_preview`，`:22-23` 注册 `code_review_execute`。`engines` 只有 `node>=22`，**无 `engines.dsh`、无 peerDeps** → 未声明版本约束（运行时未验证）。纯对话内 LLM 审查。
- `@michengai/dsh-code-review` **1.0.3** — **不注册任何 slot**。`lib\index.js:11-12` `name='michengai-code-review'`、`inject=['commands','subagents','agents','tools','systemPrompt','sessions','userQuestions']`；`:31/:35/:44` 注册 `review-cancel`/`review-status`/`review` 命令，`:89` 一个 tool。`lib\client.js` 全文 4 行，只给 `commandUi` 候选加图标与中英 label。`engines.dsh: ">=0.2.0-rc.1 <0.3.0-0"` → **不兼容 0.1.6-alpha.2**。
- `@michengai/dsh-codex-ui` **1.1.49** — 同一 `engines.dsh` 范围 → **不兼容**。可借鉴两点：`lib\client.js:12113-12115` 用 `priority: -1` 抢占官方 `sidebar`（single slot 异 priority 可遮蔽）；`:12162-12170` 捕获 `slot "X" is already declared` 后剔除冲突项重试。

## Q2 右侧面板 slot

声明在 `D:\deepseek-harness\packages\client\ui-layout\src\client\index.ts`：`sidebar` = single/root `:61`；`main` = keyed/root `:66`；`rightbar` = single/root `:80`（owner `RightbarOwnerProps { width; viewportWidth; canShow }` `:109-119`）；`shell.overlay` = list/root `:91`。

- 渲染点 `AppFrame.tsx`：`:196` sidebar、`:201-202` main（`renderSlot('main', {}, { entryKey: panelId ?? 'conversation' })` 定义在 `:40-42`）、`:203` overlay、`:232` rightbar。
- **`rightbar` 已被 `ui-sidebar-right` 独占**：`...\ui-sidebar-right\src\client\index.ts:153-157` 注册 `rightbar` 并声明 `rightbar.session`(single/session)；`:158-175` 再声明 `sidebar.right.pane.tab`(keyed)/`.title`(keyed)/`sidebar.right.tab.menu.item`(list)（类型见 `...\ui-sidebar-right\src\client\contract\slots.ts:42-94`）。
- 正确接法 = 注册**一种 tab 类型**：`ctx.sidebarRightTabs.register(definition)`（`...\ui-sidebar-right\src\client\tab-registry.ts:248`），definition 含 `id`/`kind`（`:91-101`）；priority 取 `'extension'` 可压过内置（`:26-45`）。body 注册进 `sidebar.right.pane.tab`，key 用 definition 的 `id`。
- `ctx.sidebarRight` 导航面：`openResource`/`openTab`/`close`/`active`/`isExpanded`/`toggleExpanded`/`focus`/`split`/`float`/`dock`（`...\ui-sidebar-right\src\client\service.ts:150-218`）。
- 左侧图标位 `sidebar.panellist` = **list/root**（`...\ui-sidebar\src\client\contract\slots.ts:34`），owner props `{ size: number; active: boolean }`（`:69-73`）。注册选项 `{ id, order?, label?, priority? }`（`...\ui-slots\src\index.ts:774-780`）；同 id 同 priority 重复注册抛错、异 priority 遮蔽（`:1229-1236`）；注册进未声明 slot 抛 `slot "X" is not declared`（`:1206`）。
- 切面板 `ctx.layout.selectPanel(id)`；未注册的 main key 抛 `layout.selectPanel: main panel "..." is not registered`（`...\ui-layout\src\client\service.ts:68-74`）。

## Q3 host 侧 git diff 能力

- **没有 git service**：枚举全部 `super(ctx,'<name>')` 座位（agents/fs/sessions/tools/shell/subprocess/webServer/workspaceRegistry…）无 git；`ctx.provide('<name>')` 字面量只有 `loader`/`dshHomePath`/`appExit`/`appReady`/`cmdlineArgs`（外加 `workspaceChanges`）。`worktree` 服务与 `packages/**/worktree*` 均不存在（profile bundles 列了 `@deepseek-ai/dsh-experimental-tool-worktree`，目录不存在）。
- **`@deepseek-ai/dsh-workspace-changes` 有完整 git 引擎但未对外导出**：`D:\deepseek-harness\packages\deliverables\workspace-changes\lib\types\git.d.ts:28-40` `class GitRunner { run(args, { cwd, env?, stdin?, maxBytes?, signal }): Promise<GitRunResult> }`；同文件 `:69` `locateGitWorkspace`、`:81` `snapshotTree`、`:97` `treeBlob`、`:107` `blobText`、`:118` `diffTrees → NumstatEntry[]`。
  - 公共入口 import 不到：`lib\types\index.d.ts:3` 只 re-export `Workspace*` 类型，本体只导出 `name/inject/Config/apply`（`:5-33`）；package.json `exports` 仅 `.`、`./types`、`./src/*`。要复用只能引 `@deepseek-ai/dsh-workspace-changes/src/git.ts`（源码，需自打包）——**未运行时验证**。
  - 对外的是 `ctx.workspaceChanges`（`lib\types\types.d.ts:84-102`）：`summary(sessionId, seq)`、`diff(sessionId, seq, index, signal)`。text 形态带 `hunks: WorkspaceDiffHunk[]`（`:56-70`），hunk = `{ oldStart, oldLines, newStart, newLines, lines: string[] }`，`lines` 保留 `+`/`-`/空格前缀（`:43-54`）= 原生 unified-diff 形状。但它按 session/seq 索引 live session 的每轮改动，**读不了任意仓库或 GitHub PR**。
- 跑外部进程的正规口子：`ctx.shell`（`D:\deepseek-harness\packages\shell\shell\lib\types\index.d.ts:63,71,77` 抽象 `resolve(request)`/`run(spec)`/`start(spec)`，`ShellExecutor` 在 `src\index.ts:67` 以 `super(ctx,'shell')` 注册）。`ShellExecRequest` 字段 = `command`(string) / `workdir` / `timeoutMs` / `stdoutMaxBytes` / `signal:AbortSignal` / `stdin` / `env` / `dshEnv` / `sandboxPolicy`，`ShellRunResult` 带 `exitCode`、`stdout/stderr: CollectedOutput`、`*SpillPath`（`...\shell\lib\types\types.d.ts:34-74,107-144`）；`env` 的文档明说它「merged after the credential scrub」（`:58-59`）。另一条是 `ctx.subprocess`：`SubprocessRuntime.spawn(spec)` / `spawnTerminal(spec)`（`...\subprocess\subprocess\lib\types\index.d.ts:102,110`），spec 为 `{ argv: readonly string[]; cwd; stdio; graceMs; signal?; env? }`（`...\subprocess\lib\types\types.d.ts:69-98`）。无硬闸：`dsh-wsl-tool\index.js:59` 直接 `import { execFile } from 'node:child_process'`、`:727` 直接 `execFile('wsl.exe', ...)`。
- web 路由：`WebRoute = { kind: 'exact' | 'prefix'; path: string; handler(req,res) }`，`register(route): () => void`，另有 `registerUpgrade`/`registerFallback`/`tapIndex`（`D:\deepseek-harness\packages\host\webserver\lib\types\index.d.ts:31-38,90,97,106,114`；包名 `@deepseek-ai/dsh-host-webserver` 0.1.6-alpha.2，`package.json:2-3`）。**分发层没有任何鉴权/Origin 校验**——`src\index.ts:225-236` 只做 `match(rawPath)` → `route.handler(req,res)`，全文件无 `origin`/`token` 匹配。规范 dispose 见 `dsh-wsl-tool\index.js:767-777`：`ctx.inject(['webServer'], …)` → `webServer.register(...)` → `inner.effect(() => disposer, label)`。

## 对本项目的建议

1. **PR 详情走 `rightbar` 的 tab 类型，不要抢 `rightbar` 本体**：single/root 已被 `ui-sidebar-right` 占，抢则同 priority 抛错、异 priority 屏掉官方右侧栏。
2. **左侧入口用 `sidebar.panellist`(list/root) + `main` 的 keyed entry，同一个 id**：`D:\deepseek-harness\packages\client\ui-sidebar\src\client\SidebarRoot.tsx:59-71` 就是靠 `usePanelInfo(info => info.activePanelId === id)` 判断高亮、`selectPanel(id)` 切换；图标组件收到的 props 正是 `{ size: wide ? 16 : 18, active }`（`:71`）。
3. **PR 文件 diff 自己渲染，不要用 `DiffBlock`**：它只吃 `{oldText,newText}` 现算、单列无高亮、`maxEditLength: 256`，把 GitHub 的 patch 反推成两侧全文成本高于自绘。
4. **diff 数据从 GitHub API 取，不要找 `ctx.git`**：不存在；`dsh-workspace-changes` 的 `GitRunner` 未导出且按 session/seq 索引，读不了 PR。
5. **host 侧跑 `gh` 用 `ctx.shell.run(ctx.shell.resolve({ command, workdir, timeoutMs, signal, env }))`**：能拿到 abort、超时、`stdoutMaxBytes` 上限与 spill 文件，且 `env` 在凭据擦除之后合并；需要 argv 级控制再退到 `ctx.subprocess.spawn({ argv, cwd, stdio, graceMs })`。
6. **web 路由用 `ctx.webServer.register({ kind:'exact', path, handler })` 并把 disposer 交给 `ctx.effect`**；API 不自带鉴权，跨源/CSRF 需自己判 `Origin`。
7. **不复用两个 `@michengai` 插件**（`engines.dsh >=0.2.0-rc.1`，0.1.6 不满足）；`@feng0531` 只有对话内工具，也没有面板可借。
8. **唯一真正的 UI 增量是 diff 视图**（split/unified 切换 + 行内高亮 + 行级评论锚点），其余（列表、筛选、状态徽章、空态、菜单、弹层）都用 `@deepseek-ai/dsh-client-ui-primitives` 现成的 `Button`(index.ts:9)、`Pill`(:11)、`Tag`(:12)、`StateDot`(:5)、`Menu`(:17)、`Modal`(:24)、`Tooltip`(:42)、`CodeBlock`(:68) 组合。
