import { readdir, lstat } from 'node:fs/promises';
import path from 'node:path';

export const SERIES_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ARTICLE_FILE = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,99}\.(md|mdx)$/u;

// Match the collection loader: standalone files and series/articles files only.
// Notes, README files and component documentation never become articles.
export async function findPostFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() && ARTICLE_FILE.test(entry.name)) {
      result.push(entry.name);
    } else if (entry.isDirectory() && SERIES_ID.test(entry.name)) {
      const articles = path.join(directory, entry.name, 'articles');
      try {
        const stat = await lstat(articles);
        if (!stat.isDirectory() || stat.isSymbolicLink())
          throw new Error('系列的 articles 必须是实际目录。');
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      for (const file of await readdir(articles, { withFileTypes: true })) {
        if (!file.isDirectory() && ARTICLE_FILE.test(file.name))
          result.push(`${entry.name}/articles/${file.name}`);
      }
    }
  }
  const names = new Set();
  for (const file of result) {
    const name = path.basename(file).replace(/\.(md|mdx)$/, '');
    if (names.has(name)) throw new Error(`文章文件名重复：${name}`);
    names.add(name);
  }
  return result.sort();
}
