import { describe, expect, it } from 'vitest';

import { slugifyTag } from './tags';

describe('slugifyTag', () => {
  it('keeps Chinese characters and normalizes spaces', () => {
    expect(slugifyTag('前端 工程')).toBe('前端-工程');
  });

  it('normalizes latin tags and strips punctuation', () => {
    expect(slugifyTag('Astro & Tailwind')).toBe('astro-tailwind');
  });
});
