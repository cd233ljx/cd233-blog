import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync } from 'node:crypto';
import { createContentStore, validateId } from './content.mjs';
import { createAdminServer, renderPreview } from './server.mjs';
let root;
const post = {
  metadata: {
    title: '测试文章',
    description: '摘要',
    publishedAt: '2026-10-26',
    tags: ['测试'],
    draft: true,
    featured: false,
  },
  body: '# 正文\n\nHello',
};
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'blog-admin-test-'));
  await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});
describe('content storage', () => {
  it('preserves MDX and unknown metadata; refuses stale writes and backs up deletion', async () => {
    const store = createContentStore(root, path.join(root, 'private'));
    await writeFile(
      path.join(root, 'src/content/posts/example.mdx'),
      '---\ntitle: Original\ndescription: Summary\npublishedAt: 2026-10-26\ndraft: true\ncustom: preserved\n---\n\n<Callout>Keep me</Callout>\n',
    );
    const old = await store.get('example.mdx');
    const updated = await store.save('example.mdx', {
      ...post,
      revision: old.revision,
      body: old.body,
    });
    expect(updated.metadata.custom).toBe('preserved');
    expect(updated.body).toContain('<Callout>Keep me</Callout>');
    await expect(
      store.save('example.mdx', { ...post, revision: old.revision }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(store.save('example.md', post)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      store.remove('example.mdx', old.revision),
    ).rejects.toMatchObject({ status: 409 });
    await store.remove('example.mdx', updated.revision);
    expect(await store.list()).toHaveLength(0);
    expect(await readdir(path.join(root, 'private/trash'))).toHaveLength(1);
    expect(await readdir(path.join(root, 'private/history'))).toHaveLength(2);
  });
  it('blocks traversal, symlinks, invalid dates and missing cover descriptions', async () => {
    for (const id of ['../x.md', '/x.md', 'x/../y.md', 'x.md/anything'])
      expect(() => validateId(id)).toThrow();
    const store = createContentStore(root, path.join(root, 'private'));
    await expect(
      store.save('invalid.md', {
        ...post,
        metadata: { ...post.metadata, publishedAt: '2026-02-30' },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      store.save('invalid.md', {
        ...post,
        metadata: { ...post.metadata, cover: '../../assets/posts/cover.png' },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await writeFile(path.join(root, 'outside.md'), 'secret');
    await symlink(
      path.join(root, 'outside.md'),
      path.join(root, 'src/content/posts/link.md'),
    );
    await expect(store.get('link.md')).rejects.toMatchObject({ status: 400 });
    expect(await readFile(path.join(root, 'outside.md'), 'utf8')).toBe(
      'secret',
    );
  });
});
describe('admin HTTP boundary', () => {
  it('requires authentication and same-origin mutation; saves, previews and invalidates logout', async () => {
    const salt = 'a'.repeat(32);
    const passwordHash = `${salt}:${scryptSync('test-only-password', salt, 64).toString('hex')}`;
    const server = await createAdminServer({
      root,
      origin: 'http://localhost',
      passwordHash,
      secure: false,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/admin/api`;
    let cookie = '';
    const request = (
      route,
      method = 'GET',
      data,
      origin = 'http://localhost',
    ) =>
      fetch(base + route, {
        method,
        headers: {
          Origin: origin,
          Cookie: cookie,
          'X-Admin-Request': '1',
          'Content-Type': 'application/json',
        },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
    try {
      expect((await request('/posts')).status).toBe(401);
      expect(
        (await fetch(base.replace('/api', '/live/note/private/'))).status,
      ).toBe(401);
      expect((await request('/posts/x.md', 'PUT', post)).status).toBe(401);
      expect(
        (await request('/login', 'POST', { password: 'wrong' })).status,
      ).toBe(401);
      expect(
        (
          await request(
            '/login',
            'POST',
            { password: 'test-only-password' },
            'https://evil.example',
          )
        ).status,
      ).toBe(403);
      const login = await request('/login', 'POST', {
        password: 'test-only-password',
      });
      expect(login.status).toBe(200);
      expect(login.headers.get('set-cookie')).toContain('HttpOnly');
      expect(login.headers.get('set-cookie')).toContain('SameSite=Strict');
      cookie = login.headers.get('set-cookie').split(';')[0];
      expect(
        (await request('/posts/x.md', 'PUT', post, 'https://evil.example'))
          .status,
      ).toBe(403);
      const privatePreview = await fetch(
        base.replace('/api', '/live/note/private/'),
        { headers: { Cookie: cookie } },
      );
      expect(privatePreview.status).toBe(503);
      expect(privatePreview.headers.get('cache-control')).toBe('no-store');
      expect(
        (
          await fetch(base.replace('/api', '/live/note/private/'), {
            method: 'POST',
            headers: { Cookie: cookie },
          })
        ).status,
      ).toBe(405);
      const save = await request('/posts/x.md', 'PUT', post);
      expect(save.status).toBe(200);
      const savedPost = await save.json();
      expect(await (await request('/posts/x.md')).json()).toMatchObject({
        body: savedPost.body,
        revision: savedPost.revision,
      });
      expect((await request('/posts/missing.md')).status).toBe(404);
      expect((await (await request('/posts')).json()).posts).toHaveLength(1);
      const preview = await request('/preview', 'POST', {
        body: '<script>alert(1)</script>\n\n[link](javascript:alert)\n\n![x](https://example.com/x.png)',
      });
      const html = (await preview.json()).html;
      expect(html).not.toContain('<script');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('<img');
      expect((await request('/upload', 'POST', {})).status).toBe(400);
      expect((await request('/logout', 'POST', {})).status).toBe(200);
      expect((await request('/posts')).status).toBe(401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
  it('sanitizes inline HTML in previews', () => {
    expect(
      renderPreview(
        '<img src="x" onerror="alert(1)"><iframe src="x"></iframe>',
      ),
    ).not.toMatch(/onerror|iframe/);
  });
});
