import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkChatMath, { normalizeChatMath } from './remark-chat-math.mjs';

describe('pasted TeX math', () => {
  it('parses TeX delimiters before MDX expressions, including boxed and cases', () => {
    const source = String.raw`Inline \(n^{2}\).

\[
\boxed{T(n)=\Theta(n^2)}
\]

$$
C(n)=\begin{cases}1&n<3\\2&n\ge3\end{cases}
$$`;
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkMdx)
      .use(remarkChatMath)
      .parse(source);
    expect(tree.children[0].children[1].type).toBe('inlineMath');
    expect(tree.children.filter((n) => n.type === 'math')).toHaveLength(2);
    expect(tree.children[1].value).toBe(String.raw`\boxed{T(n)=\Theta(n^2)}`);
  });
  it('preserves literal code, existing math, HTML and escaped delimiters', () => {
    const source =
      '```tex\n\\[x\\]\n```\n\n`\\(x\\)`\n\n    \\[x\\]\n\n$$\n\\text{\\(x\\)}\n$$\n\n<div>\\(x\\)</div>\n\n\\\\(x\\\\)';
    expect(normalizeChatMath(source)).toBe(source);
  });
  it('keeps unmatched delimiters and ordinary Markdown untouched', () => {
    const source =
      '# Heading\n\n- **bold**\n- ~~strike~~\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\nUnclosed \\(x';
    expect(normalizeChatMath(source)).toBe(source);
  });
});
