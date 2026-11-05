import { createContext, useContext } from 'react';
import type { JsxEditorProps } from '@mdxeditor/editor';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ProtectedBlock } from '../../lib/protected-mdx';

export const ProtectedBlocks = createContext<Record<string, ProtectedBlock>>(
  {},
);
export default function ProtectedBlockEditor({ mdastNode }: JsxEditorProps) {
  const blocks = useContext(ProtectedBlocks);
  const attribute = mdastNode.attributes.find(
    (attr) => attr.type === 'mdxJsxAttribute' && attr.name === 'id',
  );
  const id =
    attribute?.type === 'mdxJsxAttribute' && typeof attribute.value === 'string'
      ? attribute.value
      : '';
  const block = blocks[id];
  if (!block) return <span contentEditable={false}>组件块不可用</span>;
  if (block.math !== undefined)
    return (
      <span
        className="protected-math"
        contentEditable={false}
        title="公式 · 源码中可修改"
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(block.math, {
            displayMode: !block.inline,
            throwOnError: false,
            trust: false,
            strict: false,
          }),
        }}
      />
    );
  if (block.inline)
    return (
      <span className="protected-inline" contentEditable={false}>
        {block.label}
      </span>
    );
  return (
    <div className="protected-block" contentEditable={false}>
      <strong>{block.label}</strong>
      <details>
        <summary>源码</summary>
        <pre>{block.source}</pre>
      </details>
    </div>
  );
}
