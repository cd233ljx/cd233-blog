## Blog writing

新写、续写或改写博客文章、系列笔记及其交互组件时，先读取并使用仓库技能 [blog-writing](.agents/skills/blog-writing/SKILL.md)。新会话以最新文件和系列 README 为准，具体写作契约仍由 `docs/WRITING.md` 维护。

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Before handing off code changes, run:

```
npm run verify
```

## Project conventions

- Read `docs/ARCHITECTURE.md` before changing content flow, routing, layouts, or build behavior.
- Read `docs/WRITING.md` before writing or editing articles, the article schema, or MDX components, and update it when the authoring contract changes.
- Keep article `slug` values stable when organizing series. Read the series README and current article before AI-assisted revisions; new articles stay drafts.
- Read `docs/DEVELOPMENT.md` before changing scripts, dependencies, styles, or validation behavior.
- Read `docs/DESIGN.md` before changing visual hierarchy or interface copy.
- Keep `src/config/site.ts` as the source of truth for the public site origin and shared site metadata.
- Update `src/styles/theme.css` in place; do not append another full-site override layer or change the import order in `src/styles/global.css`.
- Clean up page-specific listeners, timers, and observers before Astro swaps the page.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
