#!/usr/bin/env node

import { mkdir, writeFile, readFile, lstat } from 'node:fs/promises';
import { relative, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { findPostFiles, SERIES_ID } from '../src/lib/content-files.mjs';

const POSTS_DIRECTORY = fileURLToPath(
  new URL('../src/content/posts/', import.meta.url),
);

export const NEW_POST_USAGE =
  'npm run new:post -- <slug> "文章标题" [--series 系列标识] [--order 顺序]';

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

  const positional = [];
  let series;
  let order;
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (value === '--series') {
      series = args[++i];
      if (!series || !SERIES_ID.test(series))
        throw new Error('系列标识只能包含小写英文、数字和短横线。');
    } else if (value === '--order') {
      const rawOrder = args[++i];
      order = Number(rawOrder);
      if (!rawOrder || !Number.isSafeInteger(order) || order < 0)
        throw new Error('章节顺序必须是非负整数。');
    } else if (value.startsWith('--')) {
      throw new Error(`未知参数：${value}`);
    } else positional.push(value);
  }
  if (positional.length < 2)
    throw new Error(`参数不足。\n用法：${NEW_POST_USAGE}`);
  if (order !== undefined && !series)
    throw new Error('--order 必须与 --series 一起使用。');
  const [rawSlug, ...titleParts] = positional;
  const slug = normalizePostSlug(rawSlug);
  const title = titleParts.join(' ').trim();

  if (!title) {
    throw new Error('文章标题不能为空。');
  }

  return {
    slug,
    title,
    ...(series ? { series } : {}),
    ...(order !== undefined ? { order } : {}),
  };
}

export function formatShanghaiDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function renderPostTemplate({
  title,
  publishedAt,
  slug,
  series,
  order,
}) {
  return `---
title: ${JSON.stringify(title)}
description: 'TODO：用一句话概括这篇文章。'
publishedAt: ${publishedAt}
${slug ? `slug: ${JSON.stringify(slug)}\n` : ''}${series ? `series: ${series}\norder: ${order}\n` : ''}tags: []
featured: false
draft: true
---

在这里开始写正文。
`;
}

export async function createPost(args, directory = POSTS_DIRECTORY) {
  const post = parseNewPostArguments(args);
  await mkdir(directory, { recursive: true });
  if (post.series) {
    const folder = join(directory, post.series);
    const info = join(folder, 'series.json');
    try {
      if (!(await lstat(folder)).isDirectory() || !(await lstat(info)).isFile())
        throw new Error();
      JSON.parse(await readFile(info, 'utf8'));
    } catch {
      throw new Error(
        `系列不存在：${post.series}。请先运行 npm run new:series。`,
      );
    }
  }
  const orders = [];
  for (const file of await findPostFiles(directory)) {
    const absolute = join(directory, file);
    if (!(await lstat(absolute)).isFile())
      throw new Error('文章不能是符号链接。');
    const raw = await readFile(absolute, 'utf8');
    const frontmatter =
      YAML.parse(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '') || {};
    const fileSlug = basename(file).replace(/\.(md|mdx)$/, '');
    if (fileSlug === post.slug || frontmatter.slug === post.slug)
      throw new Error(`文章地址已存在：${post.slug}`);
    if (
      post.series &&
      frontmatter.series === post.series &&
      Number.isSafeInteger(frontmatter.order)
    )
      orders.push(frontmatter.order);
  }
  if (post.series) {
    post.order ??= Math.max(0, ...orders) + 1;
    if (orders.includes(post.order))
      throw new Error(`章节顺序已存在：${post.order}`);
  }
  const folder = post.series
    ? join(directory, post.series, 'articles')
    : directory;
  await mkdir(folder, { recursive: true });
  if (!(await lstat(folder)).isDirectory())
    throw new Error('文章目录不能是符号链接。');
  const target = join(folder, `${post.slug}.${post.series ? 'mdx' : 'md'}`);
  const content = renderPostTemplate({
    ...post,
    publishedAt: formatShanghaiDate(),
  });

  try {
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'EEXIST') {
      throw new Error(`文章已存在：${target}`);
    }
    throw error;
  }

  return relative(process.cwd(), target);
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
