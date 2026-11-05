import { describe, it, expect } from 'vitest';
import { rewritePreviewHtml } from './preview.mjs';

describe('private preview asset routing', () => {
  it('keeps island modules, image sources and navigation behind authentication', () => {
    const html = rewritePreviewHtml(
      `<astro-island component-url="/src/demo.tsx" renderer-url="/node_modules/react/client.js"></astro-island><script src="/admin/live//@fs/project/style.css"></script><a href="/series/">系列</a><img src="/uploads/a.png" srcset="/a.png 1x, /b.png 2x"><a href="https://example.com">外部</a><img src="//cdn.example.com/a.png">`,
    );
    expect(html).toContain('component-url="/admin/live/src/demo.tsx"');
    expect(html).toContain(
      'renderer-url="/admin/live/node_modules/react/client.js"',
    );
    expect(html).toContain('src="/admin/live/@fs/project/style.css"');
    expect(html).toContain('href="/admin/live/series/"');
    expect(html).toContain('src="/admin/live/uploads/a.png"');
    expect(html).toContain(
      'srcset="/admin/live/a.png 1x, /admin/live/b.png 2x"',
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('src="//cdn.example.com/a.png"');
    expect(rewritePreviewHtml(html)).toBe(html);
  });
});
