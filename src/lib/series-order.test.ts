import { describe, expect, it } from 'vitest';
import { getSeriesPosts, validateSeriesPosts } from './series-order';

const post = (id: string, series: string, order: number) => ({
  id,
  data: { series: { id: series }, order },
});

describe('series organization', () => {
  it('orders a series without changing the chronological list or adding excluded chapters', () => {
    const visible = [
      post('last', 'course', 9),
      post('other', 'other', 1),
      post('intro', 'course', 0),
    ];
    expect(getSeriesPosts(visible, 'course').map((p) => p.id)).toEqual([
      'intro',
      'last',
    ]);
    expect(visible.map((p) => p.id)).toEqual(['last', 'other', 'intro']);
  });
  it('rejects ambiguous chapter positions and missing series, including order zero', () => {
    expect(() =>
      validateSeriesPosts(
        [post('a', 'course', 0), post('b', 'course', 0)],
        new Set(['course']),
      ),
    ).toThrow('顺序重复');
    expect(() =>
      validateSeriesPosts([post('a', 'missing', 1)], new Set()),
    ).toThrow('不存在的系列');
    expect(() =>
      validateSeriesPosts(
        [post('a', 'one', 1), post('b', 'two', 1)],
        new Set(['one', 'two']),
      ),
    ).not.toThrow();
  });
});
