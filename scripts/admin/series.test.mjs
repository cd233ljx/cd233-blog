import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createContentStore } from './content.mjs';
import { createSeriesStore } from './series.mjs';
import { createPublicationStore } from './publication.mjs';

let root, posts, series, dataDir;
const article = (title, group, order) => ({
  metadata: {
    title,
    description: '摘要',
    publishedAt: '2026-01-01',
    tags: [],
    draft: true,
    featured: false,
    series: group,
    order,
  },
  body: 'import Demo from "../components/Demo";\n\n正文\n\n<Demo />\n',
});
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'admin-series-'));
  dataDir = path.join(root, 'private');
  await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
  posts = createContentStore(root, dataDir);
  series = createSeriesStore(root, dataDir, posts);
  await series.save('one', { title: '系列一', description: '简介' });
  await series.save('two', { title: '系列二', description: '简介' });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
describe('admin series workflow', () => {
  it('creates chapters in the series and reorders or transfers them without moving dependencies', async () => {
    const a = await posts.save('a.mdx', article('第一篇', 'one', 0));
    const b = await posts.save('b.mdx', article('第二篇', 'one', 1));
    const revisions = Object.fromEntries([a, b].map((p) => [p.id, p.revision]));
    expect(a.sourcePath).toBe('src/content/posts/one/articles/a.mdx');
    await series.organize('one', { chapters: ['b.mdx', 'a.mdx'], revisions });
    expect((await posts.get('a.mdx')).metadata.order).toBe(1);
    await expect(
      series.organize('one', { chapters: ['a.mdx', 'b.mdx'], revisions }),
    ).rejects.toMatchObject({ status: 409 });
    const current = await posts.get('a.mdx');
    await series.organize('two', {
      chapters: ['a.mdx'],
      revisions: { 'a.mdx': current.revision },
    });
    const moved = await posts.get('a.mdx');
    expect(moved.metadata.series).toBe('two');
    expect(moved.sourcePath).toBe(a.sourcePath);
    expect(moved.body).toBe(a.body);
    await series.organize('two', {
      chapters: [],
      revisions: { 'a.mdx': moved.revision },
    });
    expect((await posts.get('a.mdx')).metadata.series).toBeUndefined();
    expect((await posts.history('a.mdx')).length).toBeGreaterThan(0);
  });
  it('validates metadata revisions and includes series changes in publication state', async () => {
    const [one] = await series.list();
    const releases = createPublicationStore(
      dataDir,
      posts,
      { get: async () => ({ revision: 'settings' }) },
      series,
    );
    await releases.write('release-1', await releases.snapshot());
    await series.save('one', { ...one, title: '修改名称' });
    await expect(
      series.save('one', { ...one, title: '旧窗口' }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await releases.summary('release-1')).seriesChanged).toBe(true);
    expect((await releases.summary('release-1')).settingsChanged).toBe(false);
    await expect(
      series.save('../escape', { title: 'x', description: 'x' }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('recovers an interrupted multi-article update from the journal', async () => {
    await posts.save('a.mdx', article('第一篇', 'one', 0));
    const file = path.join(root, 'src/content/posts/one/articles/a.mdx');
    const before = await readFile(file, 'utf8');
    const after = before.replace('order: 0', 'order: 2');
    await mkdir(dataDir, { recursive: true });
    await writeFile(
      path.join(dataDir, 'series-transaction.json'),
      JSON.stringify([
        { id: 'a.mdx', file: 'one/articles/a.mdx', before, after },
      ]),
    );
    await writeFile(file, after);
    await posts.recoverSeries();
    expect(await readFile(file, 'utf8')).toBe(before);
  });
});
