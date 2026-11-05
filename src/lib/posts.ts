import { getCollection, type CollectionEntry } from 'astro:content';
import readingTime from 'reading-time';

import { slugifyTag } from './tags';
import { validateSeriesPosts } from './series-order';

export { slugifyTag } from './tags';

export type Post = CollectionEntry<'posts'>;

type GetPostsOptions = {
  includeDrafts?: boolean;
};

export async function getPosts(options: GetPostsOptions = {}): Promise<Post[]> {
  const { includeDrafts = import.meta.env.DEV } = options;
  const now = Date.now();
  const [entries, series] = await Promise.all([
    getCollection('posts'),
    getCollection('series'),
  ]);
  validateSeriesPosts(entries, new Set(series.map((item) => item.id)));
  const posts = entries.filter(({ data }) => {
    if (includeDrafts) return true;
    return !data.draft && data.publishedAt.getTime() <= now;
  });

  return posts.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export function getPostHref(post: Post): string {
  return `/posts/${post.id}/`;
}

export function getTagHref(tag: string): string {
  return `/tags/${slugifyTag(tag)}/`;
}

export function formatPostDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatArchiveMonth(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
  }).format(date);
}

export function getReadingMinutes(post: Post): number {
  return Math.max(1, Math.round(readingTime(post.body ?? '').minutes));
}

export function getAllTags(posts: Post[]) {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const tag of post.data.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({
      name,
      count,
      slug: slugifyTag(name),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}

export function getRelatedPosts(post: Post, posts: Post[], limit = 3) {
  const tags = new Set(post.data.tags);

  return posts
    .filter((candidate) => candidate.id !== post.id)
    .map((candidate) => ({
      candidate,
      score: candidate.data.tags.filter((tag) => tags.has(tag)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.candidate.data.publishedAt.getTime() -
          a.candidate.data.publishedAt.getTime(),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
