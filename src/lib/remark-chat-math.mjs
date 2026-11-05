import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';

const sourceParser = unified().use(remarkParse).use(remarkMath);

// Protect literal examples and existing dollar math before interpreting TeX delimiters.
export function normalizeChatMath(source) {
  const protectedRanges = [];
  function visit(node) {
    if (
      ['code', 'inlineCode', 'math', 'inlineMath', 'html'].includes(node.type)
    ) {
      protectedRanges.push([
        node.position.start.offset,
        node.position.end.offset,
      ]);
      return;
    }
    for (const child of node.children || []) visit(child);
  }
  visit(sourceParser.parse(source));
  function convert(text) {
    return text.replace(
      /(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)|(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g,
      (_match, inline, display) => {
        if (inline !== undefined) return `$${inline.trim()}$`;
        return `\n$$\n${display.trim()}\n$$\n`;
      },
    );
  }
  let result = '';
  let offset = 0;
  for (const [start, end] of protectedRanges) {
    result += convert(source.slice(offset, start)) + source.slice(start, end);
    offset = end;
  }
  return result + convert(source.slice(offset));
}

/** @type {import('@astrojs/markdown-remark').RemarkPlugin} */
const remarkChatMath = function () {
  const parser = this.parser;
  this.parser = (source, file) => parser(normalizeChatMath(source), file);
};

export default remarkChatMath;
