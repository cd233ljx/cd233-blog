import { getCollection } from 'astro:content';
import { getPosts, type Post } from './posts';
import { getSeriesPosts } from './series-order';

export { getSeriesPosts } from './series-order';

export async function getSeries(input?: Post[]) {
  const posts = input ?? (await getPosts());
  return (await getCollection('series'))
    .map((entry) => ({ ...entry, posts: getSeriesPosts(posts, entry.id) }))
    .filter((entry) => entry.posts.length > 0 || import.meta.env.DEV)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, 'zh-CN'));
}

export const getSeriesHref = (id: string) => `/series/${id}/`;
