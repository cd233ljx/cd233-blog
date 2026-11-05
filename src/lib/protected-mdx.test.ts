import { describe, expect, it } from 'vitest';
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
  it.each(['\n', '\r\n'])(
    'round-trips a standalone MDX fixture with %j line endings',
    (newline) => {
      // Test data must not depend on private articles stored on the writing host.
      const body = [
        'import { Demo } from "../components/Demo";',
        '',
        '# 测试样例',
        '',
        '| 表达式 | 结果 |',
        '| --- | --- |',
        '| $x_{i}$ | {2 + 2} |',
        '',
        '1. 列表中的 **文字** 与 $n^2$。',
        '   - 嵌套项中的 `code`。',
        '',
        '<Callout title="示例">',
        '',
        '组件内的文字与 $a+b$。',
        '',
        '</Callout>',
        '',
        '$$',
        '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
        '$$',
        '',
        '<Demo client:visible />',
        '',
        '```js',
        'const value = "<Demo />";',
        '```',
        '',
      ].join(newline);
      const document = protectMdx(body);
      expect(restoreMdx(document.markdown, document)).toBe(body);
      expect(
        restoreMdx(
          document.markdown.replace('测试样例', '已修改标题'),
          document,
        ),
      ).toBe(body.replace('测试样例', '已修改标题'));
    },
  );
});
