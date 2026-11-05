import { expect, it } from 'vitest';
import { renderLocalPreview, parseLocalSource } from './local-preview.mjs';
it('renders GFM, TeX delimiters and highlighted code without server compilation', () => {
  const result = renderLocalPreview(
    '# Title\n\n**bold** ~~gone~~ `n`\n\n- [x] done\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n\\[\\boxed{n^2}\\]\n\n```python\ndef example():\n    return 1\n```',
  );
  const html = result.blocks.join('');
  for (const value of [
    '<h1>',
    '<strong>',
    '<del>',
    '<code>n</code>',
    'checkbox',
    '<table>',
    'katex',
    'fbox',
    'hljs-keyword',
  ])
    expect(html).toContain(value);
  expect(result.components).toBe(false);
});
it('never evaluates imports, JSX, expressions or event handlers', () => {
  const result = renderLocalPreview(
    "import Demo from './Demo';\n\nText\n\n<Demo client:visible />\n\n{globalThis.alert('x')}\n\n<script>alert('x')</script>\n\n[bad](javascript:alert%281%29)",
  );
  const html = result.blocks.join('');
  expect(result.components).toBe(true);
  expect(html).toContain('Text');
  expect(html).not.toMatch(/<script|javascript:|alert\(|import Demo|<Demo/);
});
it('keeps incomplete MDX editable and preserves literal code', () => {
  expect(renderLocalPreview('## In progress\n\n<Demo value={').incomplete).toBe(
    true,
  );
  expect(renderLocalPreview('`\\(x\\)`').blocks.join('')).not.toContain(
    'katex',
  );
});

it('refreshes compiled components only when saved imports or component source change', () => {
  const source = "import Demo from './Demo';\n\n# Before\n\n<Demo value={1} />";
  const signature = parseLocalSource(source).componentSource;
  expect(
    parseLocalSource(source.replace('Before', 'After')).componentSource,
  ).toBe(signature);
  expect(
    parseLocalSource(source.replace('value={1}', 'value={2}')).componentSource,
  ).not.toBe(signature);
  expect(
    parseLocalSource(source.replace('./Demo', './Other')).componentSource,
  ).not.toBe(signature);
});
