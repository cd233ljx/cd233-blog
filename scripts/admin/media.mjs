import {
  readdir,
  lstat,
  readFile,
  writeFile,
  mkdir,
  rename,
} from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { HttpError } from './content.mjs';

export function createMediaStore(root, dataDir) {
  const catalogFile = path.join(dataDir, 'media.json');
  const folders = {
    upload: path.join(root, 'public/uploads'),
    asset: path.join(root, 'src/assets/posts'),
  };
  async function catalog() {
    try {
      return JSON.parse(await readFile(catalogFile, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
  }
  async function writeCatalog(data) {
    await writeFile(`${catalogFile}.tmp`, JSON.stringify(data), {
      mode: 0o600,
    });
    await rename(`${catalogFile}.tmp`, catalogFile);
  }
  async function locate(id) {
    if (typeof id !== 'string') throw new HttpError(400, '无效的图片。');
    const [kind, ...pieces] = id.split('/');
    if (
      !folders[kind] ||
      !pieces.length ||
      pieces.some(
        (p) => !p || p === '.' || p === '..' || /[\\\u0000-\u001f]/.test(p),
      )
    )
      throw new HttpError(400, '无效的图片路径。');
    let file = folders[kind];
    for (let i = 0; i < pieces.length; i++) {
      file = path.join(file, pieces[i]);
      let stat;
      try {
        stat = await lstat(file);
      } catch (error) {
        if (error.code === 'ENOENT') throw new HttpError(404, '图片不存在。');
        throw error;
      }
      if (
        stat.isSymbolicLink() ||
        (i < pieces.length - 1 ? !stat.isDirectory() : !stat.isFile())
      )
        throw new HttpError(400, '无效的图片。');
    }
    if (!/\.(png|jpe?g|webp|gif|avif)$/i.test(file))
      throw new HttpError(400, '不支持的图片格式。');
    return file;
  }
  async function list() {
    const meta = await catalog();
    const result = [];
    async function walk(folder, kind, prefix = '') {
      let entries;
      try {
        entries = await readdir(folder, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return;
        throw error;
      }
      for (const entry of entries) {
        if (kind === 'asset' && !prefix && entry.name === 'uploads') continue;
        const relative = `${prefix}${entry.name}`;
        const id = `${kind}/${relative}`;
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) await walk(file, kind, `${relative}/`);
        else if (
          entry.isFile() &&
          /\.(png|jpe?g|webp|gif|avif)$/i.test(entry.name)
        ) {
          const stat = await lstat(file);
          result.push({
            id,
            name: meta[id]?.name || entry.name,
            alt: meta[id]?.alt || '',
            size: stat.size,
            date: stat.mtime.toISOString(),
            width: meta[id]?.width,
            height: meta[id]?.height,
            url:
              kind === 'upload'
                ? `/uploads/${relative}`
                : `/admin/api/media/file?id=${encodeURIComponent(id)}`,
            cover: `../../assets/posts/${kind === 'upload' ? 'uploads/' : ''}${relative}`,
          });
        }
      }
    }
    await walk(folders.upload, 'upload');
    await walk(folders.asset, 'asset');
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }
  async function upload(bytes, name = '图片', alt = '') {
    let buffer, info;
    try {
      const decoder = sharp(bytes, { limitInputPixels: 40000000 });
      const metadata = await decoder.metadata();
      if (!['png', 'jpeg', 'webp', 'gif', 'avif'].includes(metadata.format))
        throw new Error('Unsupported');
      ({ data: buffer, info } = await decoder
        .rotate()
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true }));
    } catch {
      throw new HttpError(
        400,
        '请上传 PNG、JPEG、WebP、GIF 或 AVIF 图片，最大 10 MB。',
      );
    }
    const file = `${randomBytes(12).toString('hex')}.webp`;
    await mkdir(folders.upload, { recursive: true });
    await mkdir(path.join(folders.asset, 'uploads'), { recursive: true });
    await writeFile(path.join(folders.upload, file), buffer, { flag: 'wx' });
    await writeFile(path.join(folders.asset, 'uploads', file), buffer, {
      flag: 'wx',
    });
    const id = `upload/${file}`;
    const meta = await catalog();
    meta[id] = {
      name: String(name).slice(0, 200),
      alt: String(alt).slice(0, 1000),
      width: info.width,
      height: info.height,
    };
    await writeCatalog(meta);
    return {
      id,
      ...meta[id],
      url: `/uploads/${file}`,
      cover: `../../assets/posts/uploads/${file}`,
    };
  }
  return {
    list,
    locate,
    upload,
    async update(id, input) {
      await locate(id);
      if (
        typeof input.name !== 'string' ||
        !input.name.trim() ||
        input.name.length > 200 ||
        typeof input.alt !== 'string' ||
        input.alt.length > 1000
      )
        throw new HttpError(400, '请填写图片名称，替代文本最多 1000 字。');
      const meta = await catalog();
      meta[id] = { ...meta[id], name: input.name.trim(), alt: input.alt };
      await writeCatalog(meta);
      return { ok: true };
    },
    async reuse(id) {
      const file = await locate(id);
      const meta = (await catalog())[id] || {};
      if (id.startsWith('upload/'))
        return {
          id,
          url: `/uploads/${id.slice(7)}`,
          cover: `../../assets/posts/uploads/${id.slice(7)}`,
          alt: meta.alt || '',
        };
      return upload(
        await readFile(file),
        meta.name || path.basename(file),
        meta.alt || '',
      );
    },
  };
}
