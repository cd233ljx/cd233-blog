# CD233 Blog

一个基于 Astro 的中文个人博客，用来维护技术笔记与日常杂谈。程序代码由 Git 管理，文章正文保存在写作主机并单独备份，构建结果为静态站点。新检出不包含文章；发布内容前需恢复本机正文。

## 快速开始

项目要求 Node.js 22.12 或更高版本，日常开发与 CI 使用 `.nvmrc` 指定的 Node.js 24。

```bash
npm ci
npm run dev:background
```

后台服务默认监听 `0.0.0.0:4321`。查看状态、日志或关闭服务：

```bash
npm run dev:status
npm run dev:logs
npm run dev:stop
```

## 常用命令

| 命令                                | 用途                             |
| ----------------------------------- | -------------------------------- |
| `npm run new:post -- <slug> "标题"` | 创建一篇默认不发布的文章草稿     |
| `npm run check`                     | 类型检查、单元测试和格式检查     |
| `npm run build`                     | 类型检查并生成生产站点与搜索索引 |
| `npm run verify`                    | 提交或发布前的完整验证           |
| `npm run format`                    | 自动格式化项目文件               |

## 文档

- [写作与发布](docs/WRITING.md)：文章字段、Markdown/MDX、图片和发布检查
- [开发与维护](docs/DEVELOPMENT.md)：本地命令、验证、依赖与样式维护约定
- [设计与阅读](docs/DESIGN.md)：个人博客的视觉约定与参考资料
- [工程架构](docs/ARCHITECTURE.md)：内容流、模块边界和常见修改入口
- [部署与运维](docs/OPERATIONS.md)：公开发布流程、线上验证与安全边界

## 主要能力

- Markdown / MDX 内容集合与字段校验
- 文章、标签、归档、Sitemap 和 Pagefind 搜索
- 浅色 / 深色主题、原生滚动与键盘导航
- 窄幅单列阅读、统一文章列表和交互式标签蓄水池
- Mermaid、提示框、图库、链接卡片、视频和音频等受控组件
- 静态构建，自托管友好

站点名称、正式域名和导航统一维护在 [`src/config/site.ts`](src/config/site.ts)。

每次推送和 PR 会通过 GitHub Actions 执行 `npm run verify`。Dependabot 每月检查依赖与 Actions 更新；小版本和补丁合并成一组，主版本单独审阅。
