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

## 生成文件与敏感信息

不要提交 `dist/`、`.astro/`、`node_modules/`、Pagefind 生成物、覆盖率报告或 `.env*`。可以提交只包含示例值的 `.env.example`。正式域名和公开站点配置放在 `src/config/site.ts`；密钥不得进入该文件或文章内容。

## 参考资料

- [Astro 组件](https://docs.astro.build/en/basics/astro-components/)：模板、构建期数据与客户端脚本的边界。
- [Astro 样式](https://docs.astro.build/en/guides/styling/)：局部样式、共享样式与导入顺序。
- [GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)：锁文件安装及复用本地验证命令。
- [Dependabot 配置](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)：更新频率、分组与 PR 数量。
