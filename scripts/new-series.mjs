#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { SERIES_ID } from '../src/lib/content-files.mjs';

const POSTS = fileURLToPath(new URL('../src/content/posts/', import.meta.url));

export async function createSeries(args, directory = POSTS) {
  const [id, ...titleParts] = args;
  const title = titleParts.join(' ').trim();
  if (!id || !SERIES_ID.test(id) || !title)
    throw new Error('用法：npm run new:series -- <小写英文标识> "系列标题"');
  if (title.length > 120) throw new Error('系列标题最多 120 个字符。');
  await mkdir(directory, { recursive: true });
  const folder = path.join(directory, id);
  try {
    await mkdir(folder);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`目录已存在，不会覆盖：${id}`);
    throw error;
  }
  for (const name of ['articles', 'components', 'assets', 'notes']) {
    await mkdir(path.join(folder, name));
    await writeFile(path.join(folder, name, '.gitkeep'), '', { flag: 'wx' });
  }
  await writeFile(
    path.join(folder, 'series.json'),
    JSON.stringify(
      { title, description: `关于${title}的持续记录。` },
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  await writeFile(
    path.join(folder, 'README.md'),
    `# ${title}\n\n- articles/：文章，使用固定 slug、series 和 order。\n- components/：本系列的交互组件与计算逻辑。\n- assets/：图片等素材。\n- notes/：素材与备忘，不作为文章读取；公开仓库中仍应避免提交私密信息。\n\n本地入口：/series/${id}/\n\n新增文章：npm run new:post -- 文章地址 "文章标题" --series ${id}\n\n先让 AI 读取最新内容，再修改指定范围；保留人工修订，用 Git 留版本。发布前运行 npm run verify。\n`,
    { flag: 'wx' },
  );
  return folder;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(`已创建系列：${await createSeries(process.argv.slice(2))}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
