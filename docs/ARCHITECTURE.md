# 工程架构

## 内容到页面

```text
src/content/posts/*.md(x)
        ↓ schema validation
src/content.config.ts
        ↓ getPosts()
src/lib/posts.ts
        ↓ static routes
src/pages/** + src/layouts/**
        ↓ astro build
dist/ + Sitemap + Pagefind
```

文章是唯一内容源。标签、归档、相关文章和搜索都从文章元数据派生，不维护第二套索引文件。

Markdown 与 MDX 使用显式配置的 unified 处理器，`@astrojs/markdown-remark` 是直接依赖。GFM、数学公式与标题锚点插件共用这条处理链，框架升级后也要验证这些能力。

生产部署消费 `dist/` 中的静态产物，具体服务器拓扑不进入公共仓库；发布验证与安全边界见 [部署与运维](OPERATIONS.md)。

## 模块边界

| 位置                    | 责任                                         |
| ----------------------- | -------------------------------------------- |
| `src/config/site.ts`    | 站点身份、正式域名与导航                     |
| `src/content.config.ts` | 文章字段契约与构建期校验                     |
| `src/lib/posts.ts`      | 文章读取、排序、地址、阅读时长和相关文章     |
| `src/lib/tags.ts`       | 标签 slug 的纯函数                           |
| `src/pages/`            | 路由与页面级数据组合                         |
| `src/layouts/`          | 全站 HTML、SEO、文章结构化数据和文章阅读布局 |
| `src/components/`       | 可复用界面与受控 MDX 组件                    |
| `src/styles/global.css` | 样式入口与固定导入顺序                       |
| `src/styles/*.css`      | token、外壳、页面、内容、响应式、主题与字体  |
| `scripts/new-post.mjs`  | 安全创建文章草稿，不覆盖已有内容             |

## 关键约定

- 正式域名以 `SITE.url` 为单一来源，Astro Sitemap、canonical、Open Graph 和结构化数据共用它。
- 生产环境只包含 `draft: false` 且发布日期不晚于当前时间的文章。
- 动态路由使用内容条目的 `id`，因此文件名一旦公开，不应随意修改。
- MDX 默认注册 `src/components/content/index.ts` 中的组件，保持统一的写作接口；新增交互通过组件维护。
- 视频默认延迟连接第三方服务，用户点击播放后才创建 iframe。
- Mermaid 在图表页面加载，Pagefind 在搜索发生时加载；普通文章主体保持静态 HTML。
- Pagefind 只索引 `PostLayout` 中的文章区域，搜索结果使用文章标题；首页、列表、目录和 404 不进入索引。
- 使用浏览器原生滚动与轻量 CSS 反馈，正文在客户端脚本执行前就可阅读。
- `PostList.astro` 统一首页、文章页、标签详情和相关文章的列表结构；页面只决定传入的文章与标题层级。
- `TagPool.astro` 单独负责标签蓄水池的结构和浮动参数，标签内容仍由 `getAllTags()` 派生。保留这一交互是设计约定，视觉调整不能顺带移除它。
- `AmbientBackdrop.astro` 只负责宽屏两侧的枝条生长，不参与内容流。根据实际正文与目录边界生成有上限的线段，按代绘制，完成后停止动画；颜色读取主题 token，主题切换沿用已有形状。窄屏不生成枝条，减弱动效时直接显示完整静态枝条，标签页隐藏时暂停。切页前释放画布、动画与监听器，进入新页面后重新测量。
- 保留 Astro ClientRouter；页面绑定的监听器和观察器在 `astro:before-swap` 时清理，在 `astro:page-load` 时重新绑定。

## 常见修改入口

| 需求           | 修改位置                                                         |
| -------------- | ---------------------------------------------------------------- |
| 新增文章       | `src/content/posts/` 或 `npm run new:post`                       |
| 修改导航       | `NAV_ITEMS`                                                      |
| 修改文章字段   | 先改 `src/content.config.ts`，再同步写作文档和示例文章           |
| 新增 MDX 组件  | `src/components/content/`、导出文件、动态文章路由和写作文档      |
| 修改正式域名   | `SITE.url`                                                       |
| 修改视觉 token | `src/styles/tokens.css` 与 `src/styles/theme.css`                |
| 修改阅读进度   | `src/components/ReadingProgress.astro`                           |
| 修改文章列表   | `src/components/PostList.astro` 与 `src/styles/home.css`         |
| 修改标签池     | `src/components/TagPool.astro` 与 `src/styles/theme.css`         |
| 修改两侧背景   | `src/components/AmbientBackdrop.astro` 与 `src/styles/theme.css` |
| 修改视觉与文案 | 先读 `docs/DESIGN.md`，在现有样式模块中修改                      |

涉及内容契约、路由或构建流程的修改，必须同步更新文档并运行 `npm run verify`。
