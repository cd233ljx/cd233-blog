type OrderedPost = {
  id: string;
  data: { series?: { id: string }; order?: number };
};

export function getSeriesPosts<T extends OrderedPost>(
  posts: T[],
  id: string,
): T[] {
  return posts
    .filter((post) => post.data.series?.id === id)
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0));
}

export function validateSeriesPosts(
  posts: OrderedPost[],
  seriesIds: Set<string>,
) {
  const positions = new Set<string>();
  for (const post of posts) {
    if (!post.data.series) continue;
    const id = post.data.series.id;
    if (!seriesIds.has(id))
      throw new Error(`文章 ${post.id} 引用了不存在的系列：${id}`);
    const key = `${id}:${post.data.order}`;
    if (positions.has(key))
      throw new Error(`系列 ${id} 的章节顺序重复：${post.data.order}`);
    positions.add(key);
  }
}
