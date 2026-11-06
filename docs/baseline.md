# P0 基线：DSH PR 与发布工作台

> 调研日期 2026-11-06。每条结论附来源。标注「未验证」的条目没有被实际执行过，不作为设计依据。

## 1. 目标宿主的真实版本

| 项目 | 实测值 | 来源 |
| --- | --- | --- |
| DSH 版本 | **0.1.6-alpha.2** | `C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh\package.json` |
| Electron | 44.7.0 | `D:\DeepSeek Harness\version` |
| 运行时 Node | 24.21.0（宿主捆绑） | `D:\DeepSeek Harness\resources\runtime\versions.json` |
| 当前 profile | `desktop` | `C:\Users\tangy\.dsh\profiles\desktop\package.json` |
| 源码检出 | `D:\deepseek-harness`，HEAD `ddefc45f`，与安装版本一致 | `package.json` = `@deepseek-ai/dsh-root 0.1.6-alpha.2` |

**这一点必须强调**：生态里相当一部分插件声明 `dsh >=0.2.x`，在本机装不上或装上不工作。本插件以 **0.1.6-alpha.2 为验证基线**，`engines.dsh` 按此写，并对更新的宿主保持向后兼容而非假设。

## 2. 可用的官方扩展点

### 2.1 侧边栏入口 `sidebar.panellist`（真实可用）

- 类型声明：`list`，作用域 `root`。由 `@deepseek-ai/dsh-client-ui-sidebar` 注册。
  来源：`C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-sidebar\src\index.ts`（`ctx.slots.subscribe('sidebar.panellist', syncPanels)`）。
- 侧边栏自身渲染行与文字标签；插件条目**只负责画图标**。渲染点在
  `SidebarRoot.tsx`：`<nav className={css.panelList} aria-label={t('panels.label')}>` 内调用
  `renderSlot('sidebar.panellist', { size: wide ? 16 : 18, active }, { only: id })`。
- 官方 README 明确说明：插件向 `sidebar.panellist` 添加带 `id`、可选 `order`、字符串或本地化 `label` 的图标组件；
  同一个 `id` 用于寻址 layout 中 root 作用域的 `main` 键控槽；选择未注册的 main 键会抛错且不改变当前选择。

**结论：截图里的「左侧独立入口 + 点开是独立主面板」在 0.1.6-alpha.2 上是受支持的一等能力，不需要注入私有 DOM，也不需要改 DSH 核心。**

### 2.2 主面板 `main`（键控槽）

`AppFrame.tsx` 的 `MainPanel` 执行 `renderSlot('main', {}, { entryKey: panelId ?? 'conversation' })`。
面板切换通过 `ctx.layout.selectPanel(panelId)`（`ILayout` 接口，见 `ui-layout/src/client/service.ts`）。

### 2.3 宿主导出数据到客户端：`webServer` 路由

宿主侧在 `ctx.inject(['webServer'], ...)` 内 `webServer.register({ kind: 'exact', path, handler })`，
handler 是原生 Node `(req, res)`。既有插件 `dsh-wsl-tool` 与 `dsh-token-diet` 都用这一条路。
路径按插件包名命名空间（如 `/dsh-wsl-tool/info`）以避免冲突。
来源：`C:\Users\tangy\.dsh\profiles\desktop\node_modules\dsh-wsl-tool\index.js`。

**这是本插件 Host→Client 的唯一数据通道**：GitHub / npm / 市场查询全部在 Host 侧完成，客户端只收到裁剪后的结果，永远拿不到 token。

### 2.4 客户端可 require 的模块

加载器 `window.__ModuleLoader__` 的工厂函数收到 `require`。实测仅 `react` 与
由 `dsh.client.inject` 声明的包可解析。`dsh-wsl-tool` 的清单里写着：

```json
"dsh": { "client": { "platform": "web", "immediately": true,
  "inject": ["@deepseek-ai/dsh-client-ui-primitives"] } }
```

并在 `lib/client.js` 里 `const primitives = require('@deepseek-ai/dsh-client-ui-primitives')`。
**本插件照此声明**，从而复用官方原语而不是自造控件。

## 3. 可复用的官方 UI 原语（这一节决定了「不重复造轮子」的边界）

`@deepseek-ai/dsh-client-ui-primitives@0.1.6-alpha.2` 已导出、可直接使用：

| 导出 | 用途 | 对本插件的意义 |
| --- | --- | --- |
| `DiffBlock` + `diffTotals` + `DEFAULT_DIFF_MAX_LINES` | 渲染 `DiffHunk[]`（`path`/`oldText`/`newText`），带折叠、复制、+/- 统计 | **PR 文件 diff 直接复用**，不自己写 diff 渲染 |
| `StateDot` | `done`/`warning`/`ongoing`/`error`/`idle`，aria-hidden，需配文字 | CI 与发布状态的圆点，且强制配可访问文字 |
| `Pill` / `Tag` / `Button` / `Input` / `Menu` / `Tooltip` / `Switch` / `Checkbox` | 标准控件 | 分组切换、搜索框、操作按钮 |
| `FileTypeIcon` / `classifyFileType` | 按扩展名出文件图标 | 文件列表 |
| `CodeBlock` | 带高亮的代码块 | diff 之外的上下文片段 |
| `relativeTime` | 相对时间 | 「更新于 X」「核验于 X」 |
| `Toast` / `writeClipboard` | 轻提示、复制 | 复制 SHA / 链接 |
| `HoverCard` / `Modal` / `DisclosureRow` | 悬浮卡、模态、可展开行 | 证据展开 |

**边界结论**：diff 渲染、状态点、文件图标、相对时间、基础控件全部复用官方原语。
本插件自己写的只有：PR 数据获取与聚合、分组语义、草稿存储与 SHA 绑定、发布证据链、面板布局。

## 4. 原生「代码审查 / PR」能力的实况

DSH 0.1.6-alpha.2 **没有**面向 GitHub PR 的原生审查界面。它有的是：

- worktree / 变更请求（本地 git 变更），与 GitHub PR 无关；
- `DiffBlock` 这类**渲染**原语，是能力而非工作流；
- 右侧栏 `rightbar` 单例槽，供其他面板挂载。

因此本插件做的是**补充**：把 GitHub 上的 PR 接到 DSH 里，渲染层复用官方原语。
详见 `docs/research/native-capability.md`。

## 5. 认证

| 通道 | 状态 | 采用 |
| --- | --- | --- |
| `gh` CLI | 2.97.0，已登录 `tangyixiao`，scopes `repo, read:org, workflow, gist, notifications` | **主通道** |
| 环境变量 token | 未使用 | 兜底（只读，不落日志） |
| 浏览器 Cookie | 不读取 | 明确禁止 |

插件不索取、不存储、不传输用户 token。所有 GitHub 调用走本机既有的 `gh` 登录态；
Host 侧以 `execFile('gh', [...], { shell: false })` 参数数组调用，**不拼接 shell 字符串**，
因此 PR 标题/分支名等内容无法变成命令。

## 6. 发布侧数据源

| 事实 | 来源 | 备注 |
| --- | --- | --- |
| npm 包存在 / 版本 / dist-tag / 完整性 | `https://registry.npmjs.org/<pkg>`、`/<pkg>/<version>` | 默认 registry 是 npmmirror 镜像，**不能**用于判定 npmjs 真值，必须显式 npmjs |
| GitHub Release | `gh api repos/{o}/{r}/releases/tags/{tag}` | 需区分 draft / prerelease / 正式 |
| tag → commit | `gh api repos/{o}/{r}/git/ref/tags/{tag}` | 用来核对「发布自最终提交」 |
| 市场 PR | `gh pr view` + `gh api .../commits/{sha}/check-runs` | 合并与 CI 是两个独立事实 |
| 线上索引 | `https://tangyixiao.github.io/dsh-plugin-market/index.json` | 已实测 Pages 地址 |

## 7. 包名与仓库

- npm 包名 `dsh-pr-release-workspace`：**npmjs 上 404，可用**（`https://registry.npmjs.org/dsh-pr-release-workspace`）。
- GitHub 仓库 `tangyixiao/dsh-pr-release-workspace`：调研时不存在，本项目新建。
- 许可证：MIT（与 DSH 生态主流一致）。

## 8. 已知限制（写进 README，不隐藏）

1. **GitHub 搜索 1000 条上限**：搜索 API 最多返回 1000 条，超过必须在界面声明「结果不完整」。
2. **团队 review 请求依赖 `read:org`**：权限不足时显示「不可确认」，不显示「没有」。
3. **GitHub Pages 缓存**：线上索引可能滞后，状态需带核验时间。
4. **npm 镜像与 npmjs 可能不一致**：判定一律以 npmjs 为准。
5. **没有真实 macOS/Linux 实机**：只报告自动化结果。
6. **不自动写 GitHub**：写操作（评论 / review / 合并）在本版本中**只做本地草稿**，且需要用户逐次确认后才可能对外发送——首版甚至不发。

## 9. 来源清单

- `D:\deepseek-harness\packages\client\ui-layout\src\client\AppFrame.tsx`
- `D:\deepseek-harness\packages\client\ui-layout\src\client\service.ts`
- `C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-sidebar\src\index.ts`
- `C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-sidebar\src\client\SidebarRoot.tsx`
- `C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-primitives\lib\types\index.d.ts`
- `C:\Users\tangy\.dsh\profiles\desktop\node_modules\dsh-wsl-tool\`（route 注册、client inject、manifest）
- `C:\Users\tangy\.dsh\profiles\desktop\node_modules\dsh-token-diet\`（最小可用插件骨架）
