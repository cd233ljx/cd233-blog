import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

type Node = {
  type: string;
  name?: string;
  value?: string;
  attributes?: { type: string; name: string; value: unknown }[];
  children?: Node[];
  position?: { start: { offset: number }; end: { offset: number } };
};
export type ProtectedBlock = {
  source: string;
  label: string;
  math?: string;
  inline: boolean;
};
export type ProtectedDocument = {
  markdown: string;
  blocks: Record<string, ProtectedBlock>;
};
const parser = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkMdx);
const protectedTypes = new Set([
  'mdxjsEsm',
  'mdxJsxFlowElement',
  'mdxJsxTextElement',
  'mdxFlowExpression',
  'mdxTextExpression',
  'math',
  'inlineMath',
  'html',
]);

function walk(node: Node, visit: (node: Node) => boolean) {
  if (visit(node)) return;
  for (const child of node.children || []) walk(child, visit);
}
function replaceRanges(
  source: string,
  ranges: { start: number; end: number; value: string }[],
) {
  for (const range of ranges.sort((a, b) => b.start - a.start))
    source =
      source.slice(0, range.start) + range.value + source.slice(range.end);
  return source;
}

export function protectMdx(source: string): ProtectedDocument {
  const tree = parser.parse(source) as unknown as Node;
  const blocks: Record<string, ProtectedBlock> = {};
  const ranges: { start: number; end: number; value: string }[] = [];
  walk(tree, (node) => {
    if (!protectedTypes.has(node.type) || !node.position) return false;
    const id = `p${Object.keys(blocks).length}`;
    const inline = [
      'inlineMath',
      'mdxJsxTextElement',
      'mdxTextExpression',
    ].includes(node.type);
    const math = ['math', 'inlineMath'].includes(node.type)
      ? node.value
      : undefined;
    const { start, end } = node.position;
    blocks[id] = {
      source: source.slice(start.offset, end.offset),
      inline,
      math,
      label:
        math !== undefined
          ? '公式'
          : node.type === 'mdxjsEsm'
            ? '组件引用'
            : node.name || '组件代码',
    };
    ranges.push({
      start: start.offset,
      end: end.offset,
      value: `<${inline ? 'WritingInline' : 'WritingBlock'} id="${id}" />`,
    });
    return true;
  });
  return { markdown: replaceRanges(source, ranges), blocks };
}

// Never save placeholder markup or silently lose code when rich-text editing.
export function restoreMdx(markdown: string, document: ProtectedDocument) {
  const tree = parser.parse(markdown) as unknown as Node;
  const seen = new Set<string>();
  const ranges: { start: number; end: number; value: string }[] = [];
  walk(tree, (node) => {
    if (
      !['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) ||
      !['WritingInline', 'WritingBlock'].includes(node.name || '')
    )
      return false;
    const id = node.attributes?.find((attr) => attr.name === 'id')?.value;
    if (
      typeof id !== 'string' ||
      !Object.hasOwn(document.blocks, id) ||
      seen.has(id) ||
      !node.position
    )
      throw new Error('组件块无效，请撤销这次修改。');
    seen.add(id);
    ranges.push({
      start: node.position.start.offset,
      end: node.position.end.offset,
      value: document.blocks[id].source,
    });
    return true;
  });
  if (seen.size !== Object.keys(document.blocks).length)
    throw new Error('公式或组件块被删除，请撤销；需要删除时请切换到源码。');
  return replaceRanges(markdown, ranges);
}
