# 开发与维护

## 环境

- Node.js `>=22.12.0`
- 日常开发和 GitHub Actions 使用 `.nvmrc` 中的 Node.js 24；使用 nvm 时先执行 `nvm use`
- 使用仓库中的 `package-lock.json`，安装依赖时优先执行 `npm ci`
- 构建输出位于 `dist/`，Astro 类型缓存位于 `.astro/`；两者都不提交

## 后台开发服务

```bash
npm run dev:background
npm run dev:status
npm run dev:logs
npm run dev:stop
```

服务固定监听 `0.0.0.0`，便于局域网人工验收。不要同时启动第二个占用 `4321` 的实例。

日常写作从开发服务的 `/series/` 进入，使用真实的主站布局预览草稿和交互。系列目录与正文属于同一开发服务，源码位置和使用命令见仓库写作文档；后台的私有实时预览供登录后的远端使用。

新增系列使用 `npm run new:series -- <id> "标题"`，新增章节使用 `npm run new:post -- <slug> "标题" --series <id>`。系列目录与字段约定见 `WRITING.md`。脚手架拒绝覆盖已有目录、地址或章节顺序。改内容加载范围时，同步 `src/content.config.ts` 与 `src/lib/content-files.mjs`，保证主站和后台识别相同文件。

## 质量检查

日常修改后运行：

```bash
npm run check
```

准备提交或发布前运行：

```bash
npm run verify
```

验证链路包括：

1. `astro check`：Astro 与 TypeScript 诊断
2. `vitest run`：纯逻辑与脚手架测试
3. `prettier --check`：格式一致性
4. `astro build`：生成全部静态路由
5. `pagefind`：为最终 HTML 建立搜索索引

构建日志中的 `Indexed pages` 应与已发布文章数量一致。用 `npm run preview -- --port 4322 --background` 验收生产搜索；开发服务不生成 Pagefind 索引。预览同样可以通过 `npm run preview -- status`、`logs` 和 `stop` 管理。

`npm run build` 会先执行 Astro 类型检查；`npm run build:site` 只用于已经完成检查的内部流程。

## 自动验证

`.github/workflows/verify.yml` 在推送、PR 和手动触发时执行同一套 `npm run verify`，先通过 `npm ci` 安装锁文件中的依赖。重复推送会取消同一分支上尚未结束的检查。

Actions 固定到完整 commit SHA，权限限于读取仓库；Node 版本与本地共用 `.nvmrc`。本地验证通过不代表远端 CI 已运行，远端结果以对应提交的 Actions 记录为准。

## 修改边界

- 页面负责数据组合与语义结构，内容逻辑放在 `src/lib/`，共享站点身份放在 `src/config/site.ts`。
- 新依赖应解决已有代码无法简单处理的问题；先考虑 Astro、浏览器和 Node.js 自带能力。
- 源码或根配置直接导入的 npm 包必须声明为直接依赖，不能依赖其他包顺带安装或偶然提升到根目录。
- 单元测试覆盖易出错的逻辑和边界；排版修改用实际页面验收，避免只验证实现细节的测试。
- 客户端脚本使用 TypeScript。跨页面保留的脚本要管理监听器、定时器和观察器的生命周期。
- 搜索以最新输入为准，旧请求或已经离开的页面不能继续写入结果。
- 提交只包含与当前改动相关的文件；行为或契约变化同步更新相应文档。

## 依赖维护

```bash
npm outdated
npm audit --omit=dev
```

优先升级补丁和兼容的小版本，并在每次升级后运行 `npm run verify`。不要直接执行无审阅的 `npm audit fix --force`，它可能跨主版本修改依赖。

Dependabot 每月更新 npm 依赖与 GitHub Actions。兼容的小版本、补丁按组提交，主版本保持独立；依赖 PR 也必须经过完整验证，不设置自动合并。

Mermaid 按需加载，但它本身较大，因此生产构建可能出现大于 500 kB 的 chunk 提示。只要图表仍是低频能力，这个提示不是发布阻断；如果文章大量使用图表，再单独评估拆包或替代方案。

## 样式维护

`src/styles/global.css` 只负责按固定顺序组装样式模块：

- `tokens.css`：设计 token、reset、按钮和通用基础类
- `shell.css`：顶部导航与全站外壳
- `home.css`：作者介绍、共享文章列表和标签列表
- `pages.css`：列表页、归档、关于、搜索、404 与页脚
- `content.css`：文章布局和富内容组件
- `responsive.css`：基础响应式行为
- `theme.css`：浅色、深色的语义配色、宽屏背景和标签蓄水池动画
- `typography.css`：自托管 Inter Latin 字体、标题与引用字体规则

- 字体与布局尺寸维护在 `tokens.css`；配色与圆角维护在 `theme.css`。先修改 `:root` token，不要在组件中新增同义常量。
- 字体从声明为直接依赖的 Fontsource 包引用，不使用外部字体请求。Inter 只引用 Latin 的正体和斜体可变字体，中文无衬线字体使用系统回退；Noto Serif SC 用于正文引用。
- 当前主题应在 `theme.css` 内原位调整，并保持 `global.css` 的导入顺序。
- 不要继续在文件末尾追加第四套“整体覆盖”；涉及大改时应先合并同一选择器的旧规则。
- 客户端组件需要从 CSS token 读取颜色；Mermaid 已按此方式处理浅色和深色主题。
- 动效必须遵守 `prefers-reduced-motion`，移动端不强制桌面交互。
- 宽屏枝条由 `AmbientBackdrop.astro` 使用原生 Canvas 2D 绘制，改编自 Antfu 的「Plum」，没有额外的绘图依赖。先生成有上限的枝条线段，再按代逐步绘制；每侧最多 1600 条线段、最多 96 代、每秒最多 30 帧、像素密度最多 2。生长完成后停止动画，主题切换只重绘已显示的线段，保留形状。减弱动效时直接画完；隐藏标签页、缩窄视口和切页均停止动画并按生命周期清理。改编源码的来源与许可记录在组件及 `public/licenses/antfu-100-MIT.txt`。

## 算法演示依赖

系列交互使用 `@radix-ui/react-slider` 处理滑块的指针与键盘行为，`lucide-react` 提供控制图标，`recharts` 提供自适应增长图和作业时间轴。图表模块由 `React.lazy` 按需加载，保留静态数据说明；不在公共布局导入图表库。配色沿用主题变量，动画关闭，算法过程仍由纯模型生成。修改算例或模型时运行系列的 `models.test.ts`，修改界面时额外检查窄屏横向滚动、深色主题、播放结束与切页后的计时器清理。

## 生成文件与敏感信息

不要提交 `dist/`、`.astro/`、`node_modules/`、Pagefind 生成物、覆盖率报告或 `.env*`。可以提交只包含示例值的 `.env.example`。正式域名和公开站点配置放在 `src/config/site.ts`；密钥不得进入该文件或文章内容。

## 参考资料

- [Astro 组件](https://docs.astro.build/en/basics/astro-components/)：模板、构建期数据与客户端脚本的边界。
- [Astro 样式](https://docs.astro.build/en/guides/styling/)：局部样式、共享样式与导入顺序。
- [GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)：锁文件安装及复用本地验证命令。
- [Dependabot 配置](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)：更新频率、分组与 PR 数量。

## 写作后台开发

`npm run admin:start` 启动独立 Node 服务，读取本地 `.env.admin`。该文件不提交；字段示例见 `.env.example`。密码只配置带随机盐的 scrypt 摘要，格式为 `32 位十六进制盐:128 位十六进制摘要`，摘要长度 64 字节。默认私有状态目录为 `.admin-data/`，可通过 `ADMIN_DATA_DIR` 指定。运行账户需有文章、上传目录和私有状态目录的读写权限。

开发时先启动后台服务，再使用已有的 `npm run dev:background`。Vite 把后台接口代理至本机服务；将 `ADMIN_ORIGIN` 配置为浏览器实际访问的开发源，本地 HTTP 调试时显式设置 `ADMIN_COOKIE_SECURE=false`。生产必须启用 Secure Cookie 并配置 HTTPS 源。

测试覆盖认证、跨站写入拒绝、路径遍历、符号链接、并发修订冲突、删除备份和预览 HTML 清理。后台的真实发布流程额外执行类型检查、静态构建与搜索索引；源码发布仍需完整运行 `npm run verify`。依赖更新或界面改动后，应先验证并发布新的构建版本，已有版本指针不会因为单独重新生成 `dist/` 自动变化。

## 扩展可编辑站点内容

新增站点字段时同步修改 `src/config/settings-schema.json`、`site-content.json` 和使用它的页面。后台表单由字段描述生成，`src/components/admin/SiteEditor.tsx` 管理编辑、预览与图片选择，服务端 `scripts/admin/settings.mjs` 依据同一 schema 校验。不要把密码、认证源或服务器配置放入站点 JSON。

文章预览和主站正文共用 `theme.css` 中的 prose 颜色变量，包括标题、加粗、链接、代码、引用和表格；预览的布局规则仍由 `admin.css` 管理。避免仅修改段落颜色而遗漏 Typography 插件的其他文字颜色。

## 后台编辑器维护

`AdminApp.tsx` 管理登录、导航和发布状态，`ArticleEditor.tsx` 管理修订与自动保存。文章使用 `SourceEditor.tsx` 封装的 CodeMirror，并在卸载时销毁编辑器；`LocalPreview.tsx` 用 Web Worker 显示即时正文预览；`LivePreview.tsx` 仅用于已编译的交互演示与站点页面。`RichEditor.tsx` 封装 MDXEditor，供站点文案字段继续使用。厚重的编辑依赖延迟到进入正文时加载，不加入主站脚本。

自动保存等待输入停顿 1.8 秒；写请求在客户端串行，保存响应只更新对应修订，不能覆盖等待期间继续输入的正文。冲突与网络错误暂停自动保存，窗口内提供恢复输入和重试入口。保存中的新文章禁止修改文件名，保存后文件名固定。服务端仍进行修订冲突校验，前端串行队列不能代替它。

文章工作区不提供组件属性表单；新组件只需在仓库中按正常 MDX 导入并添加 hydration 指令。`ContentCardEditor.tsx` 与 protected-mdx 保留给站点富文本的兼容处理，不参与文章 Markdown 保存。

私有预览按需启动后台开发进程，复用源码与编译缓存。正式构建禁止设置 `BLOG_ADMIN_PREVIEW` 或 `BLOG_ADMIN_PREVIEW_BASE`。发布快照位于私有 `manifests/`，部署代码时应让快照与实际构建使用同一份内容。不要用当前工作区的摘要补写未知历史版本。

后台正文解析直接依赖 unified、remark-parse 和 remark-mdx；不得只依赖 MDXEditor 的间接安装。系列目录调整使用私有 series-transaction.json 保存原稿与目标稿，启动时恢复未完成操作；不要清除未处理的日志。

预览工作区通过软链接引用 src、public 和 node_modules；仅私有预览启用 Vite `resolve.preserveSymlinks`。默认使用 4326 端口，已占用时 Astro 自动选择空闲端口。后台读取开发锁获取实际端口，HTTP 与 WebSocket 均通过会话认证后代理。反向代理必须向后台转发 `/admin/live/`，并支持 WebSocket Upgrade；开发模式的 Vite 已配置这两个代理。

管理预览进程：`npx astro dev status --root .admin-data/live-preview`，同样可使用 `logs` 与 `stop`。预览工作区固定在仓库内，不随 `ADMIN_DATA_DIR` 移动；Astro 的虚拟组件路径需要与源码处在同一目录树。自定义私有状态目录只影响历史、媒体元数据和发布版本。后台重启后会复用已运行进程；修改环境配置后先 stop 再打开预览。不要把此回环端口直接暴露到公网。验证预览时检查单篇渲染、交互 hydration、正文与组件热更新、未保存输入冲突及未登录资源拒绝；无需生成预览构建产物。

### 编辑器性能约束

输入时避免重复序列化整个文章；CodeMirror 缓存最近通知的字符串，仓库同步只提交变化区间，外部同步不进入用户撤销历史。预览组件按路径和主题隔离 React 更新，字数统计按正文缓存。

浏览器恢复草稿采用最长 250 ms 的合并写入窗口，连续输入也会定期异步写入 IndexedDB；仅标签页标识保留在 sessionStorage。保存前、页面隐藏、离开页面和组件卸载时立即补写；保存响应、恢复或删除会取消旧的排队快照。浏览器崩溃仍可能丢失最后一个窗口内的输入，服务端自动保存间隔保持 1.8 秒。优化不能绕过修订冲突保护。

正文空闲时不轮询服务器；返回窗口时检查修订，停笔 1.8 秒后异步同步，Ctrl / ⌘ + S 可立即同步。首次读取本地草稿完成前不自动保存，避免覆盖待恢复输入。联网事件触发未同步内容的重试，保存冲突不自动覆盖。

验证客户端链路须使用实际构建的 Worker，检查 Markdown、公式、代码高亮和 HTML 清理；模拟写入失败后继续输入，确认本地预览与 IndexedDB 恢复可用，且普通文章没有 `/site-preview` 请求或空闲轮询。另验证组件演示可操作、正文输入不重载 iframe，保存后组件更新。
