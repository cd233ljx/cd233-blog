// Only the authenticated dev preview uses these wrappers. Never execute MDX in
// the browser Markdown worker; real components stay in Astro's compiled page.
export default function remarkPreviewComponents() {
  return (tree) => {
    function walk(parent) {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (
          [
            'mdxJsxFlowElement',
            'mdxJsxTextElement',
            'mdxFlowExpression',
            'mdxTextExpression',
          ].includes(node.type)
        ) {
          return {
            type: ['mdxJsxFlowElement', 'mdxFlowExpression'].includes(node.type)
              ? 'mdxJsxFlowElement'
              : 'mdxJsxTextElement',
            name: ['mdxJsxFlowElement', 'mdxFlowExpression'].includes(node.type)
              ? 'div'
              : 'span',
            attributes: [
              {
                type: 'mdxJsxAttribute',
                name: 'data-preview-component',
                value: '',
              },
            ],
            children: [node],
          };
        }
        walk(node);
        return node;
      });
    }
    walk(tree);
  };
}
