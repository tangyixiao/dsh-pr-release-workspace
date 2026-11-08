# P0 基线：DSH PR 与发布工作台

> 调研日期 2026-11-06。每条结论附来源。标注「未验证」的条目没有被实际执行过，不作为设计依据。

## 1. 目标宿主的真实版本

| 项目 | 实测值 | 来源 |
| --- | --- | --- |
| DSH 版本 | **0.2.2-rc.1** | `D:\DeepSeek Harness\resources\app.asar` 内 `@deepseek-ai/dsh-desktop-runtime/package.json`（asar 头部 JSON → 数据区偏移，逐个读包清单） |
| Electron | 44.7.0 | `D:\DeepSeek Harness\version` |
| 运行时 Node | 24.21.0（宿主捆绑） | `D:\DeepSeek Harness\resources\runtime\versions.json` |
| 当前 profile | `desktop` | `C:\Users\tangy\.dsh\profiles\desktop\package.json` |
| 源码检出 | `D:\tmp\dsh-temp\pd-asar`（从 app.asar 解包出的 0.2.2-rc.1 源码树） | 其中 `dsh/package.json` = `@deepseek-ai/dsh-desktop-runtime 0.2.2-rc.1` |

**这一点必须强调**：`~/.dsh/profiles/node_modules/@deepseek-ai/dsh` 是 CLI profile 的依赖树，版本停在
`0.1.6-alpha.2`，**它不是 Desktop 实际运行的宿主**。早先的基线表读错了这一处，于是把 0.1.6-alpha.2
当成了 Desktop 版本。Desktop 的真值只能从 `app.asar` 里读。

本插件的 `engines.dsh` 写成 `>=0.1.6-alpha.2 <0.3.0-0`：下界是它最初验证过的宿主，上界挡住下一次
主版本（`<0.3.0-0` 连 `0.3.0-0` 这类预发布也排除）。区间两端都用 `semver.satisfies(range, { includePrerelease: true })`
实测过——DSH 的兼容判据本身就是在 `includePrerelease: true` 下求值的，所以 `0.2.2-rc.1` 这种版本会真正参与比较。

## 1.1 三个跨版本契约（0.1.6-alpha.2 → 0.2.2-rc.1 逐项核对）

| 契约 | 0.1.6-alpha.2 | 0.2.2-rc.1 | 结论 |
| --- | --- | --- | --- |
| 左侧栏槽位 | `sidebar.panellist`（list/root） | 同名同 kind | 不变 |
| 主面板槽位 | `main`（keyed/root，用 `options.key` 寻址） | 同名同 kind | 不变 |
| 槽位服务 | `inject` / `entriesOfSlot` / `subscribe`（实现挂在 `dsh-client-ui-renderer`） | 同名，另增 `register` / `registerFactory` / `renderRoot` | 不变，探测锚点用 `entriesOfSlot` |
| `connection.requestRejection(request)` | 返回 `403` / `401` / `undefined` | 同签名同返回 | 不变 |
| `webServer.register({kind,path,handler})` | 存在，返回 disposer | 同 | 不变 |
| `@deepseek-ai/dsh-client-ui-primitives` | 独立包 + `dsh.client.inject` | 无包实体，由 shell 的 `staticModules` 种子提供（397 个导出） | 声明与 `require` 都照旧 |

因为这些都不变，插件没有写任何版本分支；差异只在「服务怎么找到」和「控件缺了怎么办」两处，
用运行时探测处理（见 §2.5 与 §3.1）。


## 2. 可用的官方扩展点

### 2.1 侧边栏入口 `sidebar.panellist`（真实可用）

- 类型声明：`list`，作用域 `root`。由 `@deepseek-ai/dsh-client-ui-sidebar` 注册。
  来源：`C:\Users\tangy\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-sidebar\src\index.ts`（`ctx.slots.subscribe('sidebar.panellist', syncPanels)`）。
- 侧边栏自身渲染行与文字标签；插件条目**只负责画图标**。渲染点在
  `SidebarRoot.tsx`：`<nav className={css.panelList} aria-label={t('panels.label')}>` 内调用
  `renderSlot('sidebar.panellist', { size: wide ? 16 : 18, active }, { only: id })`。
- 官方 README 明确说明：插件向 `sidebar.panellist` 添加带 `id`、可选 `order`、字符串或本地化 `label` 的图标组件；
  同一个 `id` 用于寻址 layout 中 root 作用域的 `main` 键控槽；选择未注册的 main 键会抛错且不改变当前选择。

**结论：截图里的「左侧独立入口 + 点开是独立主面板」在 0.1.6-alpha.2 与 0.2.2-rc.1 上都是受支持的一等能力，不需要注入私有 DOM，也不需要改 DSH 核心。**

### 2.2 主面板 `main`（键控槽）

`AppFrame.tsx` 的 `MainPanel` 执行 `renderSlot('main', {}, { entryKey: panelId ?? 'conversation' })`。
面板切换通过 `ctx.layout.selectPanel(panelId)`（`ILayout` 接口，见 `ui-layout/src/client/service.ts`）。

### 2.3 宿主导出数据到客户端：`webServer` 路由

宿主侧在 `ctx.inject(['webServer'], ...)` 内 `webServer.register({ kind: 'exact', path, handler })`，
handler 是原生 Node `(req, res)`。既有插件 `dsh-wsl-tool` 与 `dsh-token-diet` 都用这一条路。
路径按插件包名命名空间（如 `/dsh-wsl-tool/info`）以避免冲突。
来源：`C:\Users\tangy\.dsh\profiles\desktop\node_modules\dsh-wsl-tool\index.js`。

0.2.2 的分发（`dsh-host-webserver/lib/index.js`）：`responderFor(pathname)` 先查 exact 表，
再按 prefix 最长前缀匹配，命中后 `responder.handler(req, res)`。本插件用
`{ kind: 'prefix', path: '/dsh-pr-release-workspace', handler }`，`register` 返回 disposer。
重复注册同一路径会 throw `webserver: duplicate prefix route "…"`。

**这是本插件 Host→Client 的唯一数据通道**：GitHub / npm / 市场查询全部在 Host 侧完成，客户端只收到裁剪后的结果，永远拿不到 token。

### 2.5 服务查找：为什么不写版本判断

`ctx.inject([...], cb)` 在 cordis 4.1.0 里是硬等待：`_refresh()` 会对每个 inject 项查
`this._store[name]`，任一项没有 impl 就整体 INACTIVE，回调根本不执行。也就是说
「依赖缺失」在插件体内是观察不到的。

所以宿主侧用 `serviceOf(inner, name)` 做查找，顺序是：先读属性 `inner[name]`（Cordis 代理对
未 declare 的名字会 throw `cannot get property "…" without inject`，所以包在 try 里）；
失败再试 `inner.get(name, false)`（`strict = false` 连未激活的 impl 也算），最后返回 null。
找到之后才判断能力（`register` / `requestRejection` 是不是函数）。

`engines.dsh` 只声明区间，不参与运行期分支——兼容判据在 `dsh-app-boot` 的
`evaluatePluginCompatibility` 里已经做过一次，插件再判一次版本只会多一份会腐坏的副本。

### 2.4 客户端可 require 的模块

加载器 `window.__ModuleLoader__` 的工厂函数收到 `require`。0.2.2 的实现（`dsh-client-modules`
的 `ClientModuleSystem.makeRequire`）先查 shell 注入的种子表 `staticModules`，再查已加载模块图，
最后才 throw。种子表里共 11 个模块，`react` 与
`@deepseek-ai/dsh-client-ui-primitives` 都在其中。`dsh-wsl-tool` 的清单里写着：

```json
"dsh": { "client": { "platform": "web", "immediately": true,
  "inject": ["@deepseek-ai/dsh-client-ui-primitives"] } }
```

并在 `lib/client.js` 里 `const primitives = require('@deepseek-ai/dsh-client-ui-primitives')`。
**本插件照此声明**，从而复用官方原语而不是自造控件。

要点：`dsh.client.inject` 是「同批加载 + 排序」的声明，不是安装动作，也不是 require 白名单。
0.2.2 里 `@deepseek-ai/dsh-client-ui-primitives` **没有包实体**
（`node_modules/@deepseek-ai/` 下不存在这个目录），它只作为 shell 的种子模块存在；
所以它不能、也不该写进 `dependencies`。0.1.6 时代它是个真包，两种形态下这份声明都正确。

## 3. 可复用的官方 UI 原语（这一节决定了「不重复造轮子」的边界）

`@deepseek-ai/dsh-client-ui-primitives` 在 0.1.6-alpha.2 是个独立包，在 0.2.2-rc.1 是 shell 的
种子模块（397 个导出，本插件要用的 8 个组件 + `diffTotals` + `relativeTime` 全在）。可直接使用：

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

**0.1.6-alpha.2 上这一节原来写的是「没有原生审查界面」——这个结论在 0.2.2 上已经过时。**

0.2.2 自带一个实验性插件「变更请求与工作树」（设置里的开关，包为
`@deepseek-ai/dsh-experimental-client-ui-forge` 等一整套 forge 包）。实况：

- 它注册在**右侧栏** `sidebar.right.pane.tab`（经 `ctx.sidebarRightTabs.register`），
  是右栏的标签页，不是左侧栏入口；
- 它只显示**绑定到当前 Session** 的那个 PR——入口是分支，不是「我有哪些开着 PR」；
- `dsh-experimental-forge-github` 的 provider 里 `search` / `author:@me` / `review-requested`
  的出现次数都是 0：它不做全仓搜索、不做分组。

它仍然复用的是同一层渲染原语：`DiffBlock` 这类组件属于宿主，不是本插件的依赖。

因此本插件做的是**补充**，而不是替代：三组队列的发现（我开的 / 等我审的 / 等我团队审的）、
粘贴链接直接定位、以及发布事实链。两者并存——官方面板占右栏，本插件占左栏，
不抢槽位。详见 `docs/research/native-capability.md`。

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

- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-client-ui-sidebar\lib\client.js`（0.2.2-rc.1，`sidebar` 根注册与 `renderSlot('sidebar.panellist', …)`）
- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-client-ui-layout\lib\client.js`（0.2.2-rc.1，`root` 注册表与 `main` 键控槽）
- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-client-ui-renderer\lib\client.js`（0.2.2-rc.1，`SlotRegistry`：`entriesOfSlot` / `subscribe` / `register`）
- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-client-connection\lib\index.js`（0.2.2-rc.1，`requestRejection`）
- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-host-webserver\lib\index.js`（0.2.2-rc.1，`register` / `responderFor`）
- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-app-boot\lib\index.js`（0.2.2-rc.1，`engines.dsh` 是唯一的兼容判据，且在 `includePrerelease: true` 下求值）
- `D:\tmp\dsh-temp\pd-asar\dsh\node_modules\@deepseek-ai\dsh-web-frontend\dist\assets\index-*.js`（shell 的 `staticModules` 种子，含 `@deepseek-ai/dsh-client-ui-primitives`）
- `D:\tmp\dsh-temp\v016\`（npm 直接下载的 0.1.6-alpha.2 tarball：connection / renderer / sidebar / layout / primitives / slots，用于逐项对照旧宿主）
- `C:\Users\tangy\.dsh\profiles\desktop\node_modules\dsh-wsl-tool\`（route 注册、client inject、manifest 的现成样例）
- `C:\Users\tangy\.dsh\profiles\desktop\node_modules\dsh-token-diet\`（最小可用插件骨架）
