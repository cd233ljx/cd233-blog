import { describe, expect, it } from 'vitest';
import {
  chapterChanges,
  dropChapter,
  moveChapter,
  sameChapters,
  seriesChapters,
} from './series-editor';
import type { Post } from './client';

describe('series chapter editing', () => {
  const chapters = ['intro', 'recursion', 'divide', 'summary'];

  it('interprets drops above and below a row without shifting the wrong neighbor', () => {
    expect(dropChapter(chapters, 'intro', 3)).toEqual([
      'recursion',
      'divide',
      'intro',
      'summary',
    ]);
    expect(dropChapter(chapters, 'summary', 1)).toEqual([
      'intro',
      'summary',
      'recursion',
      'divide',
    ]);
    expect(dropChapter(chapters, 'intro', 4)).toEqual([
      'recursion',
      'divide',
      'summary',
      'intro',
    ]);
    expect(dropChapter(chapters, 'summary', 0)).toEqual([
      'summary',
      'intro',
      'recursion',
      'divide',
    ]);
    expect(chapters).toEqual(['intro', 'recursion', 'divide', 'summary']);
  });

  it('ignores drops beside the source, stale ids, and invalid positions', () => {
    expect(dropChapter(chapters, 'recursion', 1)).toBe(chapters);
    expect(dropChapter(chapters, 'recursion', 2)).toBe(chapters);
    expect(dropChapter(chapters, 'missing', 0)).toBe(chapters);
    expect(moveChapter(chapters, 'intro', -1)).toBe(chapters);
    expect(moveChapter(chapters, 'summary', 4)).toBe(chapters);
    expect(dropChapter([], 'missing', 0)).toEqual([]);
  });

  it('treats keyboard/position moves as final positions and undo as clean', () => {
    const moved = moveChapter(chapters, 'recursion', 3);
    expect(moved).toEqual(['intro', 'divide', 'summary', 'recursion']);
    expect(sameChapters(chapters, moved)).toBe(false);
    expect(sameChapters(chapters, moveChapter(moved, 'recursion', 1))).toBe(
      true,
    );
  });

  it('distinguishes membership changes from reordering remaining chapters', () => {
    expect(
      chapterChanges(chapters, ['intro', 'divide', 'summary', 'new']),
    ).toBe('加入 1 篇 · 移出 1 篇');
    expect(chapterChanges(chapters, ['divide', 'intro', 'new'])).toBe(
      '加入 1 篇 · 移出 2 篇 · 调整顺序',
    );
    expect(chapterChanges(chapters, chapters)).toBe('');
    expect(chapterChanges(chapters, [])).toBe('移出 4 篇');
  });

  it('restores only the selected series in its stored order, including order zero and gaps', () => {
    const posts = [
      { id: 'later', metadata: { series: 'one', order: 4 } },
      { id: 'other', metadata: { series: 'two', order: 0 } },
      { id: 'intro', metadata: { series: 'one', order: 0 } },
      { id: 'standalone', metadata: {} },
    ] as Post[];
    expect(seriesChapters(posts, 'one')).toEqual(['intro', 'later']);
    expect(seriesChapters(posts, 'empty')).toEqual([]);
  });
});
