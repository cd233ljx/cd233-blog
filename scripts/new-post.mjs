#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const POSTS_DIRECTORY = fileURLToPath(
  new URL('../src/content/posts/', import.meta.url),
);

export const NEW_POST_USAGE = 'npm run new:post -- <slug> "文章标题"';

export function normalizePostSlug(value) {
  const slug = value
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/[\s_]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(slug)) {
    throw new Error('slug 只能包含文字、数字和连字符，不能包含路径或标点。');
  }

  return slug;
}

export function parseNewPostArguments(args) {
  if (args.length < 2) {
    throw new Error(`参数不足。\n用法：${NEW_POST_USAGE}`);
  }

  const [rawSlug, ...titleParts] = args;
  const slug = normalizePostSlug(rawSlug);
  const title = titleParts.join(' ').trim();

  if (!title) {
    throw new Error('文章标题不能为空。');
  }

  return { slug, title };
}

export function formatShanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function renderPostTemplate({ title, publishedAt }) {
  return `---
title: ${JSON.stringify(title)}
description: 'TODO：用一句话概括这篇文章。'
publishedAt: ${publishedAt}
tags: []
featured: false
draft: true
---

在这里开始写正文。
`;
}

export async function createPost(args) {
  const post = parseNewPostArguments(args);
  const target = new URL(
    `${post.slug}.md`,
    pathToFileURL(POSTS_DIRECTORY + '/'),
  );
  const content = renderPostTemplate({
    ...post,
    publishedAt: formatShanghaiDate(),
  });

  await mkdir(POSTS_DIRECTORY, { recursive: true });
  try {
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') {
      throw new Error(`文章已存在：src/content/posts/${post.slug}.md`);
    }
    throw error;
  }

  return relative(process.cwd(), fileURLToPath(target));
}

async function main() {
  try {
    const target = await createPost(process.argv.slice(2));
    console.log(`已创建草稿：${target}`);
    console.log('写完后将 draft 改为 false，再运行 npm run verify。');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  await main();
}
