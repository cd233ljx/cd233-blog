import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { protectMdx, restoreMdx } from './protected-mdx';

describe('editing text around preserved MDX', () => {
  it('preserves imports, expressions, nested JSX and math exactly', () => {
    const source =
      'import { Demo,\n Other } from "../components/Demo";\n\n正文 $a_{i} > 0$。\n\n<Demo client:visible data={{text: ">"}} {...props}><Other /></Demo>\n\n$$\nf(x)=x^2\n$$\n\n```tsx\n<NotAComponent />\n```\n';
    const document = protectMdx(source);
    expect(restoreMdx(document.markdown, document)).toBe(source);
    expect(
      restoreMdx(document.markdown.replace('正文', '人工修订'), document),
    ).toBe(source.replace('正文', '人工修订'));
    expect(document.markdown).toContain('<NotAComponent />');
  });
  it('rejects lost and duplicated blocks before they can be saved', () => {
    const document = protectMdx('正文\n\n<Demo client:visible />\n');
    expect(() => restoreMdx('只剩正文', document)).toThrow('被删除');
    expect(() =>
      restoreMdx(document.markdown + '\n' + document.markdown, document),
    ).toThrow('组件块无效');
  });
  it('round-trips every imported algorithm article without changing its source', () => {
    const folder = new URL(
      '../content/posts/algorithm-notes/articles/',
      import.meta.url,
    );
    for (const file of readdirSync(folder)) {
      if (!file.endsWith('.mdx')) continue;
      const body = readFileSync(new URL(file, folder), 'utf8').replace(
        /^---\r?\n[\s\S]*?\r?\n---\r?\n/,
        '',
      );
      const document = protectMdx(body);
      expect(restoreMdx(document.markdown, document), file).toBe(body);
    }
  });
});
