import { describe, expect, it } from 'vitest';

import {
  formatShanghaiDate,
  normalizePostSlug,
  parseNewPostArguments,
  renderPostTemplate,
} from './new-post.mjs';

describe('new post scaffolder', () => {
  it('normalizes a safe post slug', () => {
    expect(normalizePostSlug('  Astro_内容集合  ')).toBe('astro-内容集合');
  });

  it('rejects paths and missing titles', () => {
    expect(() => normalizePostSlug('../secret')).toThrow('不能包含路径');
    expect(() => parseNewPostArguments(['hello'])).toThrow('参数不足');
  });

  it('renders a valid draft frontmatter template', () => {
    const template = renderPostTemplate({
      title: '新的文章',
      publishedAt: '2026-08-09',
    });

    expect(template).toContain('title: "新的文章"');
    expect(template).not.toContain('category:');
    expect(template).toContain('draft: true');
  });

  it('formats dates in the project timezone', () => {
    expect(formatShanghaiDate(new Date('2026-08-08T16:30:00Z'))).toBe(
      '2026-08-09',
    );
  });
});
