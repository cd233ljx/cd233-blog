import {
  readFile,
  writeFile,
  readdir,
  lstat,
  mkdir,
  rename,
} from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { digest, HttpError } from './content.mjs';
import { SERIES_ID } from '../../src/lib/content-files.mjs';
import { createSeries } from '../new-series.mjs';

export function createSeriesStore(root, dataDir, posts) {
  const directory = path.join(root, 'src/content/posts');
  function validateId(id) {
    if (typeof id !== 'string' || id.length > 100 || !SERIES_ID.test(id))
      throw new HttpError(400, '系列标识只能包含小写英文、数字和短横线。');
    return id;
  }
  async function get(id) {
    const folder = path.join(directory, validateId(id));
    const file = path.join(folder, 'series.json');
    try {
      if (!(await lstat(folder)).isDirectory() || !(await lstat(file)).isFile())
        throw new HttpError(400, '系列不能使用符号链接。');
      const raw = await readFile(file, 'utf8');
      return { ...JSON.parse(raw), id, revision: digest(raw) };
    } catch (error) {
      if (error.code === 'ENOENT') throw new HttpError(404, '系列不存在。');
      throw error;
    }
  }
  async function list() {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || !SERIES_ID.test(entry.name)) continue;
      try {
        result.push(await get(entry.name));
      } catch (error) {
        if (error.status !== 404) throw error;
      }
    }
    return result.sort((a, b) => a.id.localeCompare(b.id));
  }
  return {
    list,
    async save(id, input) {
      validateId(id);
      if (
        !input ||
        typeof input.title !== 'string' ||
        !input.title.trim() ||
        input.title.trim().length > 120 ||
        typeof input.description !== 'string' ||
        !input.description.trim() ||
        input.description.trim().length > 240
      )
        throw new HttpError(400, '请填写系列名称和简介（最多 120 / 240 字）。');
      let previous;
      try {
        previous = await get(id);
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      if (
        previous ? previous.revision !== input.revision : input.revision != null
      )
        throw new HttpError(409, '系列已变化，请重新打开。');
      if (!previous) {
        try {
          await createSeries([id, input.title.trim()], directory);
        } catch (error) {
          throw new HttpError(409, error.message);
        }
      }
      const file = path.join(directory, id, 'series.json');
      if (previous) {
        const history = path.join(dataDir, 'history');
        await mkdir(history, { recursive: true, mode: 0o700 });
        await writeFile(
          path.join(history, `${Date.now()}-${randomUUID()}-series-${id}.json`),
          await readFile(file),
          { mode: 0o600, flag: 'wx' },
        );
      }
      const { revision: _, id: __, ...metadata } = previous || {};
      const temporary = path.join(directory, id, `.${randomUUID()}.tmp`);
      await writeFile(
        temporary,
        JSON.stringify(
          {
            ...metadata,
            title: input.title.trim(),
            description: input.description.trim(),
          },
          null,
          2,
        ) + '\n',
        { flag: 'wx' },
      );
      await rename(temporary, file);
      return get(id);
    },
    async organize(id, input) {
      await get(id);
      return posts.organizeSeries(id, input);
    },
    async revision() {
      return digest(JSON.stringify(await list()));
    },
  };
}
