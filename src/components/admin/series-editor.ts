import type { Post } from './client';

export function seriesChapters(posts: Post[], series: string) {
  return posts
    .filter((post) => post.metadata.series === series)
    .sort((a, b) => (a.metadata.order ?? 0) - (b.metadata.order ?? 0))
    .map((post) => post.id);
}

export function sameChapters(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** Move to a final, zero-based position; ignore stale or out-of-range actions. */
export function moveChapter(chapters: string[], id: string, position: number) {
  const from = chapters.indexOf(id);
  if (
    from < 0 ||
    position < 0 ||
    position >= chapters.length ||
    from === position
  )
    return chapters;
  const next = chapters.filter((chapter) => chapter !== id);
  next.splice(position, 0, id);
  return next;
}

/** A drop slot is a gap in the original list, including before/after the list. */
export function dropChapter(chapters: string[], id: string, slot: number) {
  const from = chapters.indexOf(id);
  if (from < 0 || slot < 0 || slot > chapters.length) return chapters;
  return moveChapter(chapters, id, slot > from ? slot - 1 : slot);
}

export function chapterChanges(saved: string[], current: string[]) {
  const previous = new Set(saved);
  const next = new Set(current);
  const added = current.filter((id) => !previous.has(id)).length;
  const removed = saved.filter((id) => !next.has(id)).length;
  const reordered = !sameChapters(
    saved.filter((id) => next.has(id)),
    current.filter((id) => previous.has(id)),
  );
  return [
    added ? `加入 ${added} 篇` : '',
    removed ? `移出 ${removed} 篇` : '',
    reordered ? '调整顺序' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
