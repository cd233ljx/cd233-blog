import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  symlink,
  rename,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createSeries } from './new-series.mjs';
import { createPost } from './new-post.mjs';
import { findPostFiles } from '../src/lib/content-files.mjs';
import { createContentStore } from './admin/content.mjs';

let root;
let directory;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'blog-series-'));
  directory = path.join(root, 'src/content/posts');
  await createSeries(['course', '课程笔记'], directory);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('series authoring', () => {
  it('creates draft chapters, assigns the next order, and excludes source notes', async () => {
    await createPost(['first', '第一篇', '--series', 'course'], directory);
    await createPost(['next', '下一篇', '--series', 'course'], directory);
    await writeFile(
      path.join(directory, 'course/notes/private.md'),
      'not an article',
    );
    expect(await findPostFiles(directory)).toEqual([
      'course/articles/first.mdx',
      'course/articles/next.mdx',
    ]);
    const store = createContentStore(root, path.join(root, 'private'));
    const posts = await store.list();
    expect(posts).toHaveLength(2);
    expect((await store.get('first.mdx')).metadata).toMatchObject({
      slug: 'first',
      series: 'course',
      order: 1,
      draft: true,
    });
    expect((await store.get('next.mdx')).metadata.order).toBe(2);
    await expect(
      createSeries(['course', '不要覆盖'], directory),
    ).rejects.toThrow('不会覆盖');
    await expect(createPost(['first', '重复地址'], directory)).rejects.toThrow(
      '已存在',
    );
    await expect(
      createPost(
        ['another', '重复顺序', '--series', 'course', '--order', '1'],
        directory,
      ),
    ).rejects.toThrow('顺序已存在');
    await expect(
      createPost(['unknown', '未知系列', '--series', 'missing'], directory),
    ).rejects.toThrow('系列不存在');
    await expect(
      createPost(
        ['invalid', '无效顺序', '--series', 'course', '--order', '-1'],
        directory,
      ),
    ).rejects.toThrow('非负整数');
  });

  it('keeps nested articles editable with history, stable slugs and safe deletion', async () => {
    await createPost(
      ['chapter', '章节', '--series', 'course', '--order', '0'],
      directory,
    );
    const file = path.join(directory, 'course/articles/chapter.mdx');
    const store = createContentStore(root, path.join(root, 'private'));
    const original = await store.get('chapter.mdx');
    const saved = await store.save('chapter.mdx', {
      ...original,
      body: 'import Demo from "../components/Demo";\n\n人工修订',
    });
    expect(saved.sourcePath).toBe(
      'src/content/posts/course/articles/chapter.mdx',
    );
    expect(saved.metadata).toMatchObject({
      slug: 'chapter',
      series: 'course',
      order: 0,
    });
    expect(await readFile(file, 'utf8')).toContain('人工修订');
    await expect(store.save('chapter.mdx', original)).rejects.toMatchObject({
      status: 409,
    });
    const [history] = await store.history('chapter.mdx');
    const restored = await store.restore(
      'chapter.mdx',
      history.version,
      saved.revision,
    );
    expect(restored.body).toBe(original.body);
    expect((await store.list())[0].id).toBe('chapter.mdx');
    await store.remove('chapter.mdx', restored.revision);
    expect(await store.list()).toEqual([]);
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('normalizes media picker covers for nested files and reads colocated assets safely', async () => {
    await createPost(['cover', '封面', '--series', 'course'], directory);
    const store = createContentStore(root, path.join(root, 'private'));
    const original = await store.get('cover.mdx');
    const saved = await store.save('cover.mdx', {
      ...original,
      metadata: {
        ...original.metadata,
        cover: '../../assets/posts/shared.png',
        coverAlt: '共享图片',
      },
    });
    expect(
      await readFile(path.join(directory, 'course/articles/cover.mdx'), 'utf8'),
    ).toContain('../../../../assets/posts/shared.png');
    expect(saved.metadata.cover).toBe('../../assets/posts/shared.png');
    const asset = path.join(directory, 'course/assets/local.png');
    await writeFile(asset, 'local image');
    const local = await store.save('cover.mdx', {
      ...saved,
      metadata: { ...saved.metadata, cover: '../assets/local.png' },
    });
    expect(await store.coverFile('cover.mdx')).toBe(asset);
    await expect(
      store.save('cover.mdx', {
        ...local,
        metadata: { ...local.metadata, cover: '../../../../../../outside.png' },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await rm(asset);
    await writeFile(path.join(root, 'secret.png'), 'secret');
    await symlink(path.join(root, 'secret.png'), asset);
    await expect(store.coverFile('cover.mdx')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('rejects duplicate slugs and chapter order without overwriting either file', async () => {
    await createPost(['first', '第一篇', '--series', 'course'], directory);
    await createPost(['second', '第二篇', '--series', 'course'], directory);
    const store = createContentStore(root, path.join(root, 'private'));
    const second = await store.get('second.mdx');
    await expect(
      store.save('second.mdx', {
        ...second,
        metadata: { ...second.metadata, slug: 'first' },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      store.save('second.mdx', {
        ...second,
        metadata: { ...second.metadata, order: 1 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await store.get('second.mdx')).revision).toBe(second.revision);
  });

  it('does not follow article directory symlinks', async () => {
    const articles = path.join(directory, 'course/articles');
    await rename(articles, path.join(root, 'outside'));
    await symlink(path.join(root, 'outside'), articles);
    await expect(findPostFiles(directory)).rejects.toThrow('实际目录');
  });
});
