import { expect, it } from 'vitest';
import { textChange } from './text-change';
it.each([
  ['abc', 'aXbc'],
  ['abcdef', 'abef'],
  ['', '新内容'],
  ['旧内容', ''],
  ['a😀b', 'a😄b'],
  ['abc', 'abc'],
])(
  'reconstructs external edits without replacing unchanged text: %s',
  (before, after) => {
    const change = textChange(before, after);
    expect(
      before.slice(0, change.from) + change.insert + before.slice(change.to),
    ).toBe(after);
  },
);
it('keeps a long unchanged prefix and suffix outside the transaction', () => {
  expect(
    textChange(
      'a'.repeat(10000) + 'old' + 'z'.repeat(10000),
      'a'.repeat(10000) + 'new' + 'z'.repeat(10000),
    ),
  ).toEqual({ from: 10000, to: 10003, insert: 'new' });
});
