# 写作与发布

文章统一保存在 `src/content/posts/`。文件名就是文章地址中的 slug：

```text
src/content/posts/astro-content-collections.md
→ /posts/astro-content-collections/
```

## 创建草稿

推荐使用脚手架命令：

```bash
npm run new:post -- astro-content-collections "用 Astro 内容集合管理文章"
```

它会创建一篇 `draft: true` 的 Markdown 草稿，并拒绝覆盖同名文件。

也可以手工创建 `.md` 或 `.mdx` 文件：

```md
---
title: '文章标题'
description: '用于列表卡片和 SEO 的一句摘要。'
publishedAt: 2026-08-09
updatedAt: 2026-08-10
tags:
  - Astro
  - 内容管理
featured: false
draft: true
---

这里开始写正文。
```

## Frontmatter 字段

| 字段          | 必填     | 说明                             |
| ------------- | -------- | -------------------------------- |
| `title`       | 是       | 文章标题，最多 120 个字符        |
| `description` | 是       | 卡片与页面摘要，最多 240 个字符  |
| `publishedAt` | 是       | 发布时间，使用 `YYYY-MM-DD`      |
| `updatedAt`   | 否       | 内容有实质更新时填写             |
| `tags`        | 否       | 最多 12 个；重复标签会自动去重   |
| `featured`    | 否       | 首页优先展示最新的精选文章       |
| `draft`       | 否       | 开发环境可见，生产构建会排除     |
| `cover`       | 否       | 相对于文章文件的本地图片路径     |
| `coverAlt`    | 有封面时 | 封面替代文本，使用封面时必须填写 |

未来日期的文章也不会进入生产构建。标签、归档与相关文章都由内容集合自动生成。

## 封面与正文图片

建议把图片放在 `src/assets/posts/<slug>/`，由 Astro 处理尺寸和格式。文章在 `src/content/posts/` 时，封面写法如下：

```yaml
cover: ../../assets/posts/astro-content-collections/cover.webp
coverAlt: 'Astro 内容集合的数据流示意图'
```

普通 Markdown 图片仍可使用标准语法。需要响应式图库时使用 MDX 的 `Gallery` 组件。

## MDX 组件

将扩展名改为 `.mdx` 后，可以直接使用以下受控组件：

```mdx
<Callout type="tip" title="提示">
  提示内容。
</Callout>

<LinkCard
  href="https://docs.astro.build/"
  title="Astro 文档"
  description="框架的官方使用文档。"
/>

<Mermaid
  title="内容流"
  chart={`flowchart LR
    A[Markdown] --> B[Content Collection]
    B --> C[Static Page]`}
/>

<VideoEmbed provider="bilibili" id="BV..." title="视频标题" />

<AudioPlayer src="/audio/example.mp3" title="音频标题" />
```

`Callout` 的 `type` 支持 `note`、`tip`、`warning`、`danger`；视频支持 `youtube` 与 `bilibili`。完整接口以 `src/components/content/` 中的组件 Props 为准。

## 发布检查

1. 摘要能独立说明文章内容。
2. 日期和标签正确。
3. 所有图片都有有意义的替代文本。
4. 将 `draft` 改为 `false`。
5. 运行 `npm run verify`。

验证通过后，静态页面、Sitemap 和 Pagefind 索引会在构建时一起更新。Git 提交、上线确认与公开文档的安全边界见 [部署与运维](OPERATIONS.md)。
