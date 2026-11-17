# dsh-pr-release-workspace 0.1.7

## 简体中文

- 完整包含 PR 列表排版、真实生命周期／CI／审查状态、状态图标与颜色和 Markdown 正文渲染。
- 列表默认包含全部状态；可筛选开放中、已合并、已关闭（未合并），分组列表和文字搜索使用相同筛选。
- 正确识别 React `forwardRef`、`memo` 组件；组件缺失时使用兼容样式，不再直接归因为宿主版本较旧。
- 根据可见窗口和宿主裁剪区域确定面板高度，固定导航并使列表与详情内容在面板内滚动。
- 使用宿主主题、插件原有 Logo，并保留桌面与窄屏布局。

## English

- Include the PR list layout, live lifecycle/check/review labels, state glyphs and colors, and Markdown rendering.
- Include all lifecycle states by default, with open/merged/closed-without-merge filters shared by grouped lists and text searches.
- Accept React `forwardRef` and `memo` components. Missing components use styled fallbacks without implying an old host version.
- Bound the panel to the visible viewport and clipped host ancestors, keeping navigation outside the scrolling content.
- Preserve host themes, the original plugin artwork, and desktop/narrow layouts.
