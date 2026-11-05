import { useState } from 'react';
import {
  NestedLexicalEditor,
  useMdastNodeUpdater,
  type JsxEditorProps,
} from '@mdxeditor/editor';
const names: Record<string, string> = {
  Callout: '提示框',
  LinkCard: '链接卡片',
  Mermaid: '流程图',
  VideoEmbed: '视频',
  AudioPlayer: '音频',
  Gallery: '图库',
};
const labels: Record<string, string> = {
  type: '提示类型',
  title: '标题',
  description: '说明',
  href: '链接地址',
  label: '角标文字',
  src: '资源地址',
  provider: '视频平台',
  id: '视频 ID',
  chart: '图表表达式',
  items: '图片数据表达式',
  columns: '列数',
};
export default function ContentCardEditor({
  mdastNode,
  descriptor,
}: JsxEditorProps) {
  const update = useMdastNodeUpdater();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  function edit() {
    setValues(
      Object.fromEntries(
        descriptor.props.map((prop) => {
          const attribute = mdastNode.attributes.find(
            (attr) =>
              attr.type === 'mdxJsxAttribute' && attr.name === prop.name,
          );
          const value =
            attribute?.type === 'mdxJsxAttribute' ? attribute.value : '';
          return [
            prop.name,
            typeof value === 'string' ? value : value?.value || '',
          ];
        }),
      ),
    );
    setEditing(true);
  }
  function apply() {
    // Preserve attributes unknown to the card UI, including spreads and custom properties.
    const known = new Set(descriptor.props.map((prop) => prop.name));
    const attributes = mdastNode.attributes.filter(
      (attr) => attr.type !== 'mdxJsxAttribute' || !known.has(attr.name),
    );
    for (const prop of descriptor.props) {
      const value = values[prop.name];
      if (!value) continue;
      const old = mdastNode.attributes.find(
        (attr) => attr.type === 'mdxJsxAttribute' && attr.name === prop.name,
      );
      const expression =
        prop.type === 'expression' ||
        (old?.type === 'mdxJsxAttribute' &&
          typeof old.value === 'object' &&
          old.value !== null);
      attributes.push({
        type: 'mdxJsxAttribute',
        name: prop.name,
        value: expression
          ? { type: 'mdxJsxAttributeValueExpression', value }
          : value,
      });
    }
    update({ attributes });
    setEditing(false);
  }
  const title = mdastNode.attributes.find(
    (attr) => attr.type === 'mdxJsxAttribute' && attr.name === 'title',
  );
  return (
    <div className="content-card-editor">
      <header contentEditable={false}>
        <strong>
          {names[mdastNode.name || ''] || mdastNode.name || '内容组件'}
        </strong>
        {title?.type === 'mdxJsxAttribute' &&
          typeof title.value === 'string' && <span>{title.value}</span>}
        {descriptor.props.length > 0 && (
          <button type="button" onClick={edit}>
            编辑内容
          </button>
        )}
      </header>
      {editing && (
        <div className="content-card-fields" contentEditable={false}>
          {descriptor.props.map((prop) => (
            <label key={prop.name}>
              {labels[prop.name] || prop.name}
              {prop.name === 'type' && mdastNode.name === 'Callout' ? (
                <select
                  value={values[prop.name]}
                  onChange={(event) =>
                    setValues((values) => ({
                      ...values,
                      [prop.name]: event.target.value,
                    }))
                  }
                >
                  <option value="note">说明</option>
                  <option value="tip">提示</option>
                  <option value="warning">注意</option>
                  <option value="danger">警告</option>
                </select>
              ) : prop.name === 'provider' ? (
                <select
                  value={values[prop.name]}
                  onChange={(event) =>
                    setValues((values) => ({
                      ...values,
                      [prop.name]: event.target.value,
                    }))
                  }
                >
                  <option value="bilibili">哔哩哔哩</option>
                  <option value="youtube">YouTube</option>
                </select>
              ) : (
                <textarea
                  rows={prop.name === 'chart' || prop.name === 'items' ? 5 : 2}
                  value={values[prop.name] || ''}
                  onChange={(event) =>
                    setValues((values) => ({
                      ...values,
                      [prop.name]: event.target.value,
                    }))
                  }
                />
              )}
            </label>
          ))}
          {mdastNode.name === 'Mermaid' && (
            <p className="muted small">
              图表表达式保留首尾反引号，在中间编写 Mermaid 图表。
            </p>
          )}
          <div className="admin-actions">
            <button type="button" className="admin-primary" onClick={apply}>
              应用修改
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </div>
      )}
      {descriptor.hasChildren && (
        <NestedLexicalEditor<typeof mdastNode>
          block={mdastNode.type === 'mdxJsxFlowElement'}
          getContent={(node) => node.children}
          getUpdatedMdastNode={(node, children) => {
            if (node.type === 'mdxJsxFlowElement')
              return { ...node, children: children as typeof node.children };
            return { ...node, children: children as typeof node.children };
          }}
        />
      )}
    </div>
  );
}
