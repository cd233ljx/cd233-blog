# 工程架构

## 内容到页面

```text
src/content/posts/*.md(x) + */articles/*.md(x)
        ↓ schema validation
src/content.config.ts
        ↓ getPosts()
src/lib/posts.ts
        ↓ static routes
src/pages/** + src/layouts/**
        ↓ astro build
dist/ + Sitemap + Pagefind
```

文章文件是唯一文章内容源。标签、归档、相关文章和搜索都从文章元数据派生，不维护第二套索引文件。

Markdown 与 MDX 使用显式配置的 unified 处理器，`@astrojs/markdown-remark` 是直接依赖。GFM、数学公式与标题锚点插件共用这条处理链；`remark-chat-math.mjs` 在解析前兼容 TeX 括号分隔符，并保护代码与已有公式，框架升级后也要验证这些能力。

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
- 动态路由使用内容条目的 `id`；新稿通过 frontmatter 的 `slug` 固定该 ID。搬迁目录时保留 slug，旧稿无 slug 时仍由文件名生成。
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

## 写作后台与静态发布

后台页面独立于前台布局，不启用 ClientRouter。`AdminApp` 由外部模块脚本挂载，以遵守后台禁止内联脚本的 CSP；入口显式导入 React 开发热更新 preamble，构建时该导入为空。`src/components/admin/` 中的 React 组件管理写作工作区，`scripts/admin/server.mjs` 提供 Node HTTP 服务和受密码保护的接口，`scripts/admin/content.mjs` 维护原始 Markdown / MDX 文件。文章仍以原 Markdown / MDX 为来源；站点文案由独立 JSON 管理，不引入数据库。现有 MDX 正文、未知 frontmatter 字段会保留。

服务仅监听回环地址，运行环境通过反向代理接入。认证使用带盐 scrypt 密码摘要和 12 小时内存会话，Cookie 设置 HttpOnly、SameSite 与生产 Secure 属性；重启会使会话失效。所有写请求检查 Origin 和自定义请求头，登录有尝试次数限制。接口限制文件名、正文大小和图片大小；图片经过解码并重新编码为 WebP。

每次覆盖与删除前保留私有历史副本；删除移入私有回收目录。修订摘要防止旧窗口覆盖新内容，构建期间拒绝写入。发布在独立目录执行 Astro 检查、构建和 Pagefind 索引，全部成功后原子切换持久化的版本指针；失败继续提供上一版本。前台继续提供静态 HTML。历史构建与备份不进入公开静态目录。

工作区分为文章列表、写作、媒体库、页面与站点、发布中心。文章以 CodeMirror 6 编辑 Markdown / MDX 原文，提供编辑、分栏和阅读视图。阅读窗通过 Web Worker 在客户端解析 Markdown、GFM、公式和代码高亮，不依赖保存或网络。MDX 导入、JSX 和表达式不在浏览器执行；交互演示区复用 Astro 已编译的组件，后台同步后更新。React 用于后台和文章局部演示；组件仍由仓库维护并通过 MDX 显式导入。页面与站点的富文本字段继续使用 MDXEditor。

文章只在窗口重新聚焦时检查文件修订，不定时拉取全文；保存仍由服务器核对修订。发布状态仅在构建进行中轮询，空闲时只在重新聚焦时检查。无本地输入时同步最新正文和元数据；有未保存输入或恢复稿时暂停自动保存，提示仓库冲突。保存仍通过修订摘要防止覆盖。

## 系列与本地写作

`series` 内容集合读取 `src/content/posts/*/series.json`，目录名作为系列 ID。文章通过 `series` 引用该集合，`order` 决定章节顺序；组合必须完整，顺序不重复。`src/lib/series-order.ts` 负责分组、排序与完整性检查。系列信息只存标题和简介，文章文件仍是篇目清单的唯一来源。

`posts` loader 显式匹配根目录文章和系列的 `articles/`，排除素材、README 和组件文档。系列专用演示、计算模型、样式和图片放在相邻的 `components/`、`assets/`。原算法文章的 slug 和后台文件标识保持不变。

`/series/` 及详情页保持面向读者的简洁目录；开发环境额外显示草稿，点击篇目标题预览。源码路径、命令和写作说明仅保留在仓库文档中。目录和 `SeriesNavigation` 共用经过可见性过滤的文章，按 order 排列；空系列不生成生产详情路由。导读的 `SeriesContents` 也使用同一份可见文章，不产生未发布章节链接。时间线与标签逻辑保留。

后台通过 `src/lib/content-files.mjs` 查找根目录和系列文章，使用全局唯一文件名作为 API、历史与发布快照的标识，实际路径由服务端查找，客户端不能指定写入位置。移入系列后，保存、恢复和删除继续操作原文件；拒绝目录符号链接。封面支持公共图片目录和本系列 assets，媒体库路径在保存时换算成相对于文章的位置。

`media.mjs` 管理图片列表、复用与描述，私有 `media.json` 只保存显示名称、替代文本及尺寸。已有本地图片可以复用，正文复用时生成公开上传副本。文件读取限制在图片目录并逐层拒绝符号链接。

`publication.mjs` 为每个发布版本保存私有内容摘要，记录文章修订、实际可见性与站点配置摘要。发布清单比较保存内容和线上快照，区分草稿、待发布、已上线、有未发布修改与待下线；不再把源文件的 `draft: false` 当作已经上线。

`preview.mjs` 按需启动并复用私有 Astro 开发服务，使用 `astro dev --background`，只监听回环地址。仓库内的 `.admin-data/live-preview/` 链接源码，不随 `ADMIN_DATA_DIR` 移到仓库外，避免 Astro 虚拟组件路径被误判为路由。缓存与开发锁独立于正式构建；不复制源码，不执行整站构建或搜索索引。首次启动需扫描内容集合，之后只按请求渲染页面。仅开发预览注入 `/note/[...slug]`，使用 `getEntry` / `render` 渲染单篇正文，共享公式、样式和 MDX hydration，不加载主站布局与导航。

后台通过 `/admin/live/` 代理页面、模块和 HMR WebSocket，全部需要有效会话；WebSocket 同时核对 Origin，退出或会话到期后断开。仓库里的正文、组件与样式修改由 Vite 更新浏览器。预览与发布可并行，正式静态构建不包含私有笔记路由或草稿。站点与系列的预览也复用此服务，按需请求对应页面。

## 站点内容编辑

`src/config/site.ts` 仍是共享站点资料的唯一导出入口，正式域名固定在该文件；可编辑的资料与文案从 `src/config/site-content.json` 导入。`settings-schema.json` 定义后台分组、字段类型与约束，前端表单与服务端校验共用这一份描述。

站点配置包含首页、关于页、站点身份、导航、页脚、文章列表、归档、标签、搜索、阅读页与 404 文案。数量从文章派生，通过 `{count}`、`{minutes}`、`{date}` 等占位符调整显示格式。导航与页脚链接支持增删和排序；首页栏目及背景可开关。站点图标和默认分享图片支持上传；Web Manifest 在构建时从 `SITE` 生成。

`settings.mjs` 只写入经过白名单字段校验的 JSON，不允许后台编辑可执行配置。链接校验拒绝脚本协议；Markdown 通过共享 `src/lib/markdown.mjs` 处理并清理 HTML。站点配置沿用修订冲突检查、私有历史备份和原子替换；保存后仍需发布才更新前台。404 回退也从当前发布版本读取。

## 后台系列与正文保护

`SeriesManager.tsx` 使用认证后的 `/admin/api/series` 接口管理系列资料及篇目。`series.mjs` 读写 series.json；content store 的 organizeSeries 批量调整文章元数据，逐篇核对修订摘要，并保存私有事务日志。失败回滚，服务启动时恢复中断事务；遇到事务之外的文件变更拒绝覆盖。旧窗口的文章保存仍由 revision 拦截。已有文件不随系列归属搬迁，避免破坏相对导入。

`protected-mdx.ts` 用 remark 语法树定位 ESM、JSX、表达式和数学公式，将片段映射到后台专用占位节点。`ProtectedBlockEditor.tsx` 保留给富文本字段的兼容编辑；片段恢复会验证缺失、重复及未知占位节点。文章工作区直接编辑原文，不经过占位节点转换。

发布快照包含系列描述文件的修订摘要；修改系列名称与简介会触发站点待发布提示。

## 客户端正文预览与草稿

`local-preview.mjs` 共用 remark/GFM/math 解析规则，先清理不可信 HTML，再由 KaTeX 和代码高亮器生成受控标记。Vite 显式选择两个解析依赖的无 DOM 入口，使 Web Worker 在开发和构建环境都可运行。`LocalPreview` 保持一个工作任务，过期结果丢弃，只继续处理最新输入；80 ms 合并输入，关闭组件时终止 Worker。React 按块保留未改变的正文 DOM，编辑视图隐藏预览时停止提交新渲染。

普通正文不创建 Astro 预览 iframe、不调用 `/site-preview`。包含已保存组件时才加载演示 iframe；私有预览的 remark 插件为 MDX 节点标记边界，`NotePreview` 的组件视图只保留真实演示。当前输入中的组件代码不在浏览器编译，初次保存前提示等待同步；普通文字编辑不刷新演示。

`draft-store.ts` 通过串行 IndexedDB 事务存储原始文章对象，同一标签页的恢复键由 sessionStorage 中的小型随机标识维持，正文不再写入同步 Web Storage。兼容迁移旧草稿。保存、恢复和删除取消排队快照，事务按提交顺序完成，避免旧草稿复活。网络失败不阻断本地预览；恢复联网后重试同步，修订冲突仍需人工处理。
