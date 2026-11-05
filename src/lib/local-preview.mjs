import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkMdx from 'remark-mdx';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import { normalizeChatMath } from './remark-chat-math.mjs';

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const mdx = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkMdx);
const html = unified()
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [['className', /^language-./, 'math-inline', 'math-display']],
    },
  })
  // Only these trusted renderers may add math/highlight markup after sanitization.
  .use(rehypeKatex, { trust: false, strict: 'ignore' })
  .use(rehypeHighlight, { detect: false, ignoreMissing: true });
const serializer = unified().use(rehypeStringify);

export function parseLocalSource(source) {
  const normalized = normalizeChatMath(source);
  let tree;
  let incomplete = false;
  try {
    tree = mdx.parse(normalized);
  } catch {
    tree = markdown.parse(normalized);
    incomplete = true;
  }
  let components = false;
  const componentSources = [];
  function clean(node) {
    if (!node.children) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === 'mdxjsEsm') {
        componentSources.push(child.value);
        return [];
      }
      if (child.type.startsWith('mdx')) {
        components = true;
        componentSources.push(
          normalized.slice(
            child.position.start.offset,
            child.position.end.offset,
          ),
        );
        return [];
      }
      clean(child);
      return [child];
    });
  }
  clean(tree);
  return {
    tree,
    components,
    incomplete,
    componentSource: componentSources.join('\n'),
  };
}

export function renderLocalPreview(source) {
  const { tree, components, incomplete } = parseLocalSource(source);
  const result = html.runSync(tree);
  // Stable block strings let React retain unchanged DOM, including images.
  const blocks = result.children
    .filter((node) => node.type !== 'text' || node.value.trim())
    .map((node) => serializer.stringify({ type: 'root', children: [node] }));
  return { blocks, components, incomplete };
}
