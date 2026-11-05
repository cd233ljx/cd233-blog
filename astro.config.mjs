// @ts-check
import { createRequire } from 'node:module';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import { unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { SITE } from './src/config/site';
import remarkChatMath from './src/lib/remark-chat-math.mjs';
import remarkPreviewComponents from './src/lib/remark-preview-components.mjs';

/** @type {import('astro').AstroIntegration} */
const notePreview = {
  name: 'private-note-preview',
  hooks: {
    'astro:config:setup': ({ command, injectRoute }) => {
      if (command === 'dev')
        injectRoute({
          pattern: '/note/[...slug]',
          entrypoint: './src/components/admin/NotePreview.astro',
          prerender: false,
        });
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  base: process.env.BLOG_ADMIN_PREVIEW_BASE || '/',
  trailingSlash: 'always',
  integrations: [
    ...(process.env.BLOG_ADMIN_PREVIEW === '1' ? [notePreview] : []),
    react(),
    mdx({
      optimize: true,
    }),
    sitemap({
      filter: (page) => !page.includes('/drafts/') && !page.includes('/admin'),
    }),
  ],
  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkGfm,
        remarkMath,
        remarkChatMath,
        ...(process.env.BLOG_ADMIN_PREVIEW === '1'
          ? [remarkPreviewComponents]
          : []),
      ],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'append',
            properties: {
              className: ['heading-anchor'],
              ariaLabel: '链接到此标题',
            },
          },
        ],
        rehypeKatex,
      ],
    }),
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      wrap: true,
    },
  },
  vite: {
    // Keep dependency component IDs inside the isolated preview workspace.
    resolve: {
      preserveSymlinks: process.env.BLOG_ADMIN_PREVIEW === '1',
      // The browser entry uses document; workers need the package's DOM-free decoder.
      alias: {
        'hast-util-from-html-isomorphic': createRequire(
          import.meta.url,
        ).resolve('hast-util-from-html-isomorphic'),
        'decode-named-character-reference': createRequire(
          import.meta.url,
        ).resolve('decode-named-character-reference'),
      },
    },
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/admin/api': 'http://127.0.0.1:4325',
        '/admin/live': { target: 'http://127.0.0.1:4325', ws: true },
      },
    },
  },
});
