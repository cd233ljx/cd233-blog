import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export function createPublicationStore(dataDir, store, settings, series) {
  async function snapshot() {
    const now = Date.now();
    return {
      publishedAt: new Date(now).toISOString(),
      seriesRevision: series ? await series.revision() : null,
      settingsRevision: (await settings.get()).revision,
      posts: Object.fromEntries(
        (await store.list()).map((post) => [
          post.id,
          {
            revision: post.revision,
            title: post.metadata.title,
            visible:
              !post.metadata.draft &&
              Date.parse(post.metadata.publishedAt) <= now,
          },
        ]),
      ),
    };
  }
  async function read(release) {
    if (!/^release-\d+$/.test(release)) return null;
    try {
      return JSON.parse(
        await readFile(
          path.join(dataDir, 'manifests', `${release}.json`),
          'utf8',
        ),
      );
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }
  async function write(release, manifest) {
    await mkdir(path.join(dataDir, 'manifests'), {
      recursive: true,
      mode: 0o700,
    });
    await writeFile(
      path.join(dataDir, 'manifests', `${release}.json`),
      JSON.stringify(manifest),
      { mode: 0o600 },
    );
  }
  async function summary(release) {
    const [live, current] = await Promise.all([read(release), snapshot()]);
    const changes = [];
    for (const [id, post] of Object.entries(current.posts)) {
      const published = live?.posts[id];
      if (
        published?.revision === post.revision &&
        published.visible === post.visible
      )
        continue;
      if (!post.visible && !published?.visible) continue;
      changes.push({
        id,
        title: post.title,
        action: !post.visible ? '下线' : !published?.visible ? '发布' : '更新',
      });
    }
    for (const [id, post] of Object.entries(live?.posts || {})) {
      if (!current.posts[id] && post.visible)
        changes.push({ id, title: post.title, action: '删除' });
    }
    return {
      known: !!live,
      live,
      changes,
      settingsChanged: live?.settingsRevision !== current.settingsRevision,
      seriesChanged: (live?.seriesRevision ?? null) !== current.seriesRevision,
    };
  }
  return { snapshot, read, write, summary };
}
