import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  lstat,
  rm,
} from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import {
  findPostFiles,
  ARTICLE_FILE,
  SERIES_ID,
} from '../../src/lib/content-files.mjs';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const digest = (text) => createHash('sha256').update(text).digest('hex');
export function validateId(id) {
  if (typeof id !== 'string' || !ARTICLE_FILE.test(id))
    throw new HttpError(400, '文章地址仅支持字母、数字、短横线和下划线。');
  return id;
}
export function parsePost(raw, id) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new HttpError(422, `${id} 缺少文章信息。`);
  const document = YAML.parseDocument(match[1]);
  if (document.errors.length)
    throw new HttpError(422, `${id} 的文章信息格式有误。`);
  return {
    id,
    revision: digest(raw),
    metadata: document.toJS(),
    body: raw.slice(match[0].length).replace(/^\r?\n/, ''),
    document,
  };
}
const dateValid = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export function validatePost(input) {
  if (!input || typeof input !== 'object')
    throw new HttpError(400, '无效的文章。');
  const m = input.metadata;
  if (!m || typeof m !== 'object') throw new HttpError(400, '请填写文章信息。');
  for (const [key, max, label] of [
    ['title', 120, '标题'],
    ['description', 240, '摘要'],
  ]) {
    if (
      typeof m[key] !== 'string' ||
      !m[key].trim() ||
      m[key].trim().length > max
    )
      throw new HttpError(400, `${label}不能为空，最多 ${max} 字。`);
  }
  if (!dateValid(m.publishedAt) || (m.updatedAt && !dateValid(m.updatedAt)))
    throw new HttpError(400, '请填写有效日期。');
  if (
    !Array.isArray(m.tags) ||
    m.tags.length > 12 ||
    m.tags.some((t) => typeof t !== 'string' || !t.trim() || t.length > 80)
  )
    throw new HttpError(400, '最多 12 个标签，每个标签最多 80 字。');
  if (typeof m.draft !== 'boolean' || typeof m.featured !== 'boolean')
    throw new HttpError(400, '无效的文章状态。');
  if (
    m.slug !== undefined &&
    (typeof m.slug !== 'string' ||
      !/^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u.test(m.slug))
  )
    throw new HttpError(400, '无效的固定文章地址。');
  if (
    m.series !== undefined &&
    (typeof m.series !== 'string' || !SERIES_ID.test(m.series))
  )
    throw new HttpError(400, '无效的系列标识。');
  if (
    Boolean(m.series) !== (m.order !== undefined) ||
    (m.order !== undefined && (!Number.isSafeInteger(m.order) || m.order < 0))
  )
    throw new HttpError(400, '系列文章必须填写系列和非负整数顺序。');
  if (
    typeof input.body !== 'string' ||
    Buffer.byteLength(input.body) > 1024 * 1024
  )
    throw new HttpError(400, '正文不能超过 1 MB。');
  if (
    m.cover &&
    (typeof m.cover !== 'string' ||
      m.cover.includes('\\') ||
      m.cover.includes('\0'))
  )
    throw new HttpError(400, '封面必须使用 src/assets/posts 下的本地图片。');
  if (m.cover && (typeof m.coverAlt !== 'string' || !m.coverAlt.trim()))
    throw new HttpError(400, '请填写封面替代文本。');
  return {
    ...m,
    title: m.title.trim(),
    description: m.description.trim(),
    tags: [...new Set(m.tags.map((t) => t.trim()))],
  };
}
export function createContentStore(root, dataDir) {
  const postsDir = path.join(root, 'src/content/posts');
  const journal = path.join(dataDir, 'series-transaction.json');
  async function recoverSeries() {
    let entries;
    try {
      entries = JSON.parse(await readFile(journal, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const file = await locate(entry.id);
      const current = await read(entry.id);
      if (current !== entry.before && current !== entry.after)
        throw new HttpError(
          409,
          '系列调整期间文件被外部修改，请先处理未完成的系列事务。',
        );
      if (path.relative(postsDir, file) !== entry.file)
        throw new HttpError(409, '系列事务中的文件位置已变化。');
    }
    for (const entry of entries) {
      const temporary = path.join(postsDir, `.${randomUUID()}.tmp`);
      await writeFile(temporary, entry.before, { flag: 'wx' });
      await rename(temporary, await locate(entry.id));
    }
    await rm(journal);
  }
  async function locate(id) {
    validateId(id);
    const files = await findPostFiles(postsDir);
    return path.join(
      postsDir,
      files.find((file) => path.basename(file) === id) || id,
    );
  }
  function coverPath(file, cover) {
    const assetRoot = path.join(root, 'src/assets/posts');
    // Media picker values are relative to the original flat posts directory.
    const resolved = cover.startsWith('../../assets/posts/')
      ? path.resolve(postsDir, cover)
      : path.resolve(path.dirname(file), cover);
    const allowed = [assetRoot];
    if (path.basename(path.dirname(file)) === 'articles')
      allowed.push(path.join(path.dirname(path.dirname(file)), 'assets'));
    if (!allowed.some((folder) => resolved.startsWith(folder + path.sep)))
      throw new HttpError(
        400,
        '封面必须位于文章图片目录或本系列的 assets 目录。',
      );
    return resolved;
  }
  async function read(id) {
    const file = await locate(id);
    try {
      if (!(await lstat(file)).isFile())
        throw new HttpError(400, '不支持符号链接文章。');
      return await readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') throw new HttpError(404, '文章不存在。');
      throw error;
    }
  }
  async function backup(id, raw, action) {
    const dir = path.join(dataDir, 'history');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(
      path.join(dir, `${Date.now()}-${randomUUID()}-${action}-${id}`),
      raw,
      { mode: 0o600, flag: 'wx' },
    );
  }
  async function publicPost(raw, id) {
    const { document: _, ...post } = parsePost(raw, id);
    const file = await locate(id);
    if (post.metadata.cover) {
      const resolved = coverPath(file, post.metadata.cover);
      const assets = path.join(root, 'src/assets/posts');
      if (resolved.startsWith(assets + path.sep))
        post.metadata.cover = `../../assets/posts/${path.relative(assets, resolved).split(path.sep).join('/')}`;
    }
    return {
      ...post,
      sourcePath: path.relative(root, file).split(path.sep).join('/'),
    };
  }
  async function historyFile(id, version) {
    validateId(id);
    if (
      typeof version !== 'string' ||
      !/^\d+-[a-f0-9-]{36}-(save|delete|restore)-/.test(version) ||
      !version.endsWith(`-${id}`) ||
      path.basename(version) !== version
    )
      throw new HttpError(400, '无效的历史版本。');
    const file = path.join(dataDir, 'history', version);
    try {
      if (!(await lstat(file)).isFile())
        throw new HttpError(400, '无效的历史版本。');
      return await readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') throw new HttpError(404, '历史版本不存在。');
      throw error;
    }
  }
  return {
    recoverSeries,
    async organizeSeries(series, input) {
      if (
        !SERIES_ID.test(series) ||
        !Array.isArray(input?.chapters) ||
        !input.revisions ||
        typeof input.revisions !== 'object'
      )
        throw new HttpError(400, '无效的系列目录。');
      const selected = new Set(input.chapters.map(validateId));
      if (selected.size !== input.chapters.length)
        throw new HttpError(400, '篇目不能重复。');
      const posts = await this.list();
      if (input.chapters.some((id) => !posts.some((post) => post.id === id)))
        throw new HttpError(409, '文章已被删除，请刷新目录。');
      const affected = posts.filter(
        (post) => selected.has(post.id) || post.metadata.series === series,
      );
      const entries = [];
      for (const post of affected) {
        const before = await read(post.id);
        if (digest(before) !== input.revisions[post.id])
          throw new HttpError(409, '文章已变化，请刷新后重新调整系列。');
        const parsed = parsePost(before, post.id);
        if (selected.has(post.id)) {
          parsed.document.set('series', series);
          parsed.document.set('order', input.chapters.indexOf(post.id));
        } else {
          parsed.document.delete('series');
          parsed.document.delete('order');
        }
        const after = `---\n${parsed.document.toString()}---\n\n${parsed.body}`;
        if (after !== before)
          entries.push({
            id: post.id,
            file: path.relative(postsDir, await locate(post.id)),
            before,
            after,
          });
      }
      if (!entries.length) return this.list();
      await mkdir(dataDir, { recursive: true, mode: 0o700 });
      for (const entry of entries) await backup(entry.id, entry.before, 'save');
      await writeFile(journal, JSON.stringify(entries), {
        mode: 0o600,
        flag: 'wx',
      });
      try {
        for (const entry of entries) {
          const temporary = path.join(postsDir, `.${randomUUID()}.tmp`);
          await writeFile(temporary, entry.after, { flag: 'wx' });
          await rename(temporary, await locate(entry.id));
        }
        await rm(journal);
      } catch (error) {
        await recoverSeries();
        throw error;
      }
      return this.list();
    },
    async coverFile(id) {
      const file = await locate(id);
      const { metadata } = parsePost(await read(id), id);
      if (!metadata.cover) throw new HttpError(404, '文章没有封面。');
      const resolved = coverPath(file, metadata.cover);
      if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(resolved))
        throw new HttpError(400, '不支持的图片格式。');
      let current = root;
      for (const segment of path.relative(root, resolved).split(path.sep)) {
        current = path.join(current, segment);
        if ((await lstat(current)).isSymbolicLink())
          throw new HttpError(400, '不支持符号链接图片。');
      }
      if (!(await lstat(resolved)).isFile())
        throw new HttpError(400, '不是图片文件。');
      return resolved;
    },
    async history(id) {
      validateId(id);
      let files;
      try {
        files = await readdir(path.join(dataDir, 'history'), {
          withFileTypes: true,
        });
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
      return files
        .filter(
          (f) =>
            f.isFile() &&
            /^\d+-[a-f0-9-]{36}-(save|delete|restore)-/.test(f.name) &&
            f.name.endsWith(`-${id}`),
        )
        .map((f) => ({
          version: f.name,
          date: new Date(Number(f.name.split('-')[0])).toISOString(),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 100);
    },
    async version(id, version) {
      return publicPost(await historyFile(id, version), id);
    },
    async restore(id, version, revision) {
      const raw = await historyFile(id, version);
      const previous = await read(id);
      if (digest(previous) !== revision)
        throw new HttpError(409, '文章已经变化，请重新打开后恢复。');
      // Restore the complete original, including unknown frontmatter and MDX.
      await backup(id, previous, 'restore');
      const temporary = path.join(postsDir, `.${randomUUID()}.tmp`);
      await writeFile(temporary, raw, { mode: 0o644, flag: 'wx' });
      await rename(temporary, await locate(id));
      return publicPost(raw, id);
    },
    async list() {
      const files = await findPostFiles(postsDir);
      const posts = await Promise.all(
        files.map(async (file) => {
          const id = path.basename(file);
          return publicPost(await read(id), id);
        }),
      );
      return posts.sort((a, b) =>
        String(b.metadata.publishedAt).localeCompare(
          String(a.metadata.publishedAt),
        ),
      );
    },
    async get(id) {
      return publicPost(await read(id), id);
    },
    async save(id, input) {
      validateId(id);
      const metadata = validatePost(input);
      let file = await locate(id);
      let previous = null;
      try {
        previous = await read(id);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      if (previous !== null && input.revision !== digest(previous))
        throw new HttpError(409, '文章已在其他窗口修改，请重新打开后再保存。');
      if (previous === null && input.revision)
        throw new HttpError(409, '原文章已被删除，请另存为新文章。');
      if (previous === null) {
        if (metadata.series) {
          const folder = path.join(postsDir, metadata.series);
          if (
            !(await lstat(folder)).isDirectory() ||
            !(await lstat(path.join(folder, 'articles'))).isDirectory()
          )
            throw new HttpError(400, '系列目录不可用。');
          file = path.join(folder, 'articles', id);
        }
        const alternate = id.replace(
          /\.(md|mdx)$/,
          id.endsWith('.mdx') ? '.md' : '.mdx',
        );
        try {
          await read(alternate);
          throw new HttpError(
            409,
            '此文章地址已存在，不能使用另一种格式重复创建。',
          );
        } catch (error) {
          if (error.status !== 404) throw error;
        }
      }
      if (metadata.cover)
        metadata.cover = path
          .relative(path.dirname(file), coverPath(file, metadata.cover))
          .split(path.sep)
          .join('/');
      const document =
        previous === null
          ? new YAML.Document()
          : parsePost(previous, id).document;
      const effectiveSlug =
        metadata.slug ?? document.get('slug') ?? id.replace(/\.(md|mdx)$/, '');
      const effectiveSeries = metadata.series ?? document.get('series');
      const effectiveOrder = metadata.order ?? document.get('order');
      if (effectiveSeries) {
        try {
          const info = path.join(postsDir, effectiveSeries, 'series.json');
          if (
            !(await lstat(path.dirname(info))).isDirectory() ||
            !(await lstat(info)).isFile()
          )
            throw new Error();
        } catch {
          throw new HttpError(400, '系列不存在，请先创建系列。');
        }
      }
      for (const other of await this.list()) {
        if (other.id === id) continue;
        if (
          (other.metadata.slug || other.id.replace(/\.(md|mdx)$/, '')) ===
          effectiveSlug
        )
          throw new HttpError(409, '此固定文章地址已存在。');
        if (
          effectiveSeries &&
          other.metadata.series === effectiveSeries &&
          other.metadata.order === effectiveOrder
        )
          throw new HttpError(409, '此系列的章节顺序已被占用。');
      }
      for (const key of ['slug', 'series', 'order']) {
        if (Object.hasOwn(metadata, key)) document.set(key, metadata[key]);
      }
      for (const key of [
        'title',
        'description',
        'publishedAt',
        'updatedAt',
        'tags',
        'draft',
        'featured',
        'cover',
        'coverAlt',
      ]) {
        if (metadata[key] === undefined || metadata[key] === '')
          document.delete(key);
        else document.set(key, metadata[key]);
      }
      const raw = `---\n${document.toString()}---\n\n${input.body.trimEnd()}\n`;
      if (raw === previous) return publicPost(raw, id);
      if (previous !== null) await backup(id, previous, 'save');
      const temporary = path.join(postsDir, `.${randomUUID()}.tmp`);
      await writeFile(temporary, raw, { mode: 0o644, flag: 'wx' });
      await rename(temporary, file);
      return publicPost(raw, id);
    },
    async remove(id, revision) {
      const raw = await read(id);
      if (revision !== digest(raw))
        throw new HttpError(409, '文章已经变化，请刷新后再删除。');
      await backup(id, raw, 'delete');
      const trash = path.join(dataDir, 'trash');
      await mkdir(trash, { recursive: true, mode: 0o700 });
      await rename(
        await locate(id),
        path.join(trash, `${Date.now()}-${randomUUID()}-${id}`),
      );
    },
  };
}
