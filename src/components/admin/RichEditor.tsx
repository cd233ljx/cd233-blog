import {
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
  Component,
  type ReactNode,
} from 'react';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  thematicBreakPlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  jsxPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertCodeBlock,
  InsertThematicBreak,
  Separator,
  CodeToggle,
  usePublisher,
  insertJsx$,
  type JsxComponentDescriptor,
  type MDXEditorMethods,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { upload, type Media } from './client';
import MediaLibrary from './MediaLibrary';
import ContentCardEditor from './ContentCardEditor';
import ProtectedBlockEditor, { ProtectedBlocks } from './ProtectedBlockEditor';
import { protectMdx, restoreMdx } from '../../lib/protected-mdx';
import { Icon, Modal } from './ui';
const SourceEditor = lazy(() => import('./SourceEditor'));

const descriptors: JsxComponentDescriptor[] = [
  {
    name: 'Callout',
    kind: 'flow',
    props: [
      { name: 'type', type: 'string' },
      { name: 'title', type: 'string' },
    ],
    hasChildren: true,
    Editor: ContentCardEditor,
  },
  {
    name: 'LinkCard',
    kind: 'flow',
    props: ['href', 'title', 'description', 'label'].map((name) => ({
      name,
      type: 'string',
    })),
    hasChildren: false,
    Editor: ContentCardEditor,
  },
  {
    name: 'Mermaid',
    kind: 'flow',
    props: [
      { name: 'title', type: 'string' },
      { name: 'chart', type: 'expression' },
    ],
    hasChildren: false,
    Editor: ContentCardEditor,
  },
  {
    name: 'VideoEmbed',
    kind: 'flow',
    props: ['provider', 'id', 'title', 'description'].map((name) => ({
      name,
      type: 'string',
    })),
    hasChildren: false,
    Editor: ContentCardEditor,
  },
  {
    name: 'AudioPlayer',
    kind: 'flow',
    props: ['src', 'title', 'description'].map((name) => ({
      name,
      type: 'string',
    })),
    hasChildren: false,
    Editor: ContentCardEditor,
  },
  {
    name: 'Gallery',
    kind: 'flow',
    props: [
      { name: 'items', type: 'expression' },
      { name: 'columns', type: 'expression' },
    ],
    hasChildren: false,
    Editor: ContentCardEditor,
  },
  {
    name: '*',
    kind: 'flow',
    props: [],
    hasChildren: true,
    Editor: ContentCardEditor,
  },
];
const translations: Record<string, string> = {
  'toolbar.undo': '撤销 {{shortcut}}',
  'toolbar.redo': '重做 {{shortcut}}',
  'toolbar.bold': '加粗',
  'toolbar.removeBold': '取消加粗',
  'toolbar.italic': '斜体',
  'toolbar.removeItalic': '取消斜体',
  'toolbar.strikethrough': '删除线',
  'toolbar.removeStrikethrough': '取消删除线',
  'toolbar.inlineCode': '行内代码',
  'toolbar.removeInlineCode': '取消代码格式',
  'toolbar.bulletedList': '无序列表',
  'toolbar.numberedList': '有序列表',
  'toolbar.checkList': '待办列表',
  'toolbar.link': '插入链接',
  'toolbar.image': '插入图片',
  'toolbar.table': '插入表格',
  'toolbar.codeBlock': '插入代码块',
  'toolbar.thematicBreak': '插入分隔线',
  'toolbar.blockTypes.paragraph': '正文',
  'toolbar.blockTypes.quote': '引用',
  'toolbar.blockTypes.heading': '标题 {{level}}',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': '段落样式',
  'toolbar.blockTypeSelect.placeholder': '段落样式',
  'codeBlock.language': '代码语言',
  'codeBlock.selectLanguage': '选择语言',
  'codeBlock.delete': '删除代码块',
  'dialogControls.save': '保存',
  'dialogControls.cancel': '取消',
  'dialogControls.close': '关闭',
  'imageEditor.title': '编辑图片',
  'imageEditor.uploadImage': '上传图片',
  'imageEditor.imageSrc': '图片地址',
  'imageEditor.imageAlt': '替代文本',
  'imageEditor.imageTitle': '图片标题',
  'imageEditor.addImage': '插入图片',
  'linkDialog.url': '链接地址',
  'linkDialog.linkTitle': '链接文字',
  'linkDialog.pasteAnUrl': '粘贴链接',
  'linkDialog.save': '保存',
  'linkDialog.cancel': '取消',
  'uploadImage.dialogTitle': '插入或编辑图片',
  'uploadImage.dialogDescription': '填写图片地址，或从设备上传。',
  'uploadImage.dialogDescriptionNoUpload': '填写图片地址。',
  'uploadImage.uploadInstructions': '从设备上传图片',
  'uploadImage.addViaUrlInstructions': '或填写图片地址',
  'uploadImage.addViaUrlInstructionsNoUpload': '图片地址',
  'uploadImage.autoCompletePlaceholder': '粘贴图片网址',
  'uploadImage.alt': '替代文本',
  'uploadImage.title': '图片标题',
  'createLink.url': '链接地址',
  'createLink.urlPlaceholder': '粘贴或输入网址',
  'createLink.text': '链接文字',
  'createLink.textTooltip': '读者看到的链接文字',
  'createLink.title': '链接说明',
  'createLink.titleTooltip': '鼠标悬停时显示',
  'createLink.saveTooltip': '保存链接',
  'createLink.cancelTooltip': '取消',
  'linkPreview.open': '在新窗口打开 {{url}}',
  'linkPreview.edit': '编辑链接',
  'linkPreview.copyToClipboard': '复制链接',
  'linkPreview.copied': '已复制',
  'linkPreview.remove': '移除链接',
  'table.deleteTable': '删除表格',
  'table.columnMenu': '列操作',
  'table.rowMenu': '行操作',
  'table.textAlignment': '文字对齐',
  'table.alignLeft': '左对齐',
  'table.alignCenter': '居中',
  'table.alignRight': '右对齐',
  'table.insertColumnLeft': '在左侧插入列',
  'table.insertColumnRight': '在右侧插入列',
  'table.deleteColumn': '删除此列',
  'table.insertRowAbove': '在上方插入行',
  'table.insertRowBelow': '在下方插入行',
  'table.deleteRow': '删除此行',
  'genericJsxEditor.edit': '编辑组件属性',
  'genericJsxEditor.delete': '删除组件',
};
function translate(
  key: string,
  fallback: string,
  values?: Record<string, unknown>,
) {
  return (translations[key] || fallback).replace(
    /\{\{(\w+)\}\}/g,
    (_, name: string) => String(values?.[name] ?? ''),
  );
}
function InsertComponent() {
  const insert = usePublisher(insertJsx$);
  return (
    <select
      aria-label="插入内容组件"
      value=""
      onChange={(event) => {
        const name = event.target.value;
        const props: Record<
          string,
          string | { type: 'expression'; value: string }
        > =
          name === 'Callout'
            ? { type: 'note', title: '提示' }
            : name === 'LinkCard'
              ? { href: 'https://', title: '链接标题', description: '' }
              : name === 'Mermaid'
                ? {
                    title: '流程图',
                    chart: {
                      type: 'expression',
                      value: '`flowchart LR\n  A[开始] --> B[结束]`',
                    },
                  }
                : name === 'VideoEmbed'
                  ? { provider: 'bilibili', id: '', title: '视频标题' }
                  : { src: '', title: '音频标题' };
        insert({ name, kind: 'flow', props });
      }}
    >
      <option value="">＋ 内容卡片</option>
      <option value="Callout">提示框</option>
      <option value="LinkCard">链接卡片</option>
      <option value="Mermaid">流程图</option>
      <option value="VideoEmbed">视频</option>
      <option value="AudioPlayer">音频</option>
    </select>
  );
}

class VisualEditorBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function prepareDocument(value: string) {
  try {
    return protectMdx(value);
  } catch {
    return null;
  }
}
export default function RichEditor({
  value,
  onChange,
  dark,
  mdx = true,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  dark: boolean;
  mdx?: boolean;
  disabled?: boolean;
}) {
  const [document, setDocument] = useState(() => prepareDocument(value));
  const [mode, setMode] = useState<'visual' | 'source'>(() =>
    document ? 'visual' : 'source',
  );
  const [error, setError] = useState('');
  const [library, setLibrary] = useState(false);
  const ref = useRef<MDXEditorMethods>(null);
  const initial = useRef(document?.markdown ?? value);
  const lastVisual = useRef(initial.current);
  const latest = useRef(value);
  latest.current = value;
  const insertMedia = (item: Media) => {
    const markdown = `![${item.alt.replace(/[\[\]\\]/g, '\\$&')}](${item.url})`;
    if (mode === 'visual') ref.current?.insertMarkdown(markdown);
    else onChange(`${latest.current}\n\n${markdown}\n`);
    setLibrary(false);
  };
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      imagePlugin({
        imageUploadHandler: async (file) => (await upload(file)).url,
        disableImageResize: true,
      }),
      tablePlugin(),
      thematicBreakPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
      codeMirrorPlugin({
        codeBlockLanguages: {
          txt: '纯文本',
          js: 'JavaScript',
          ts: 'TypeScript',
          jsx: 'JSX',
          tsx: 'TSX',
          html: 'HTML',
          css: 'CSS',
          json: 'JSON',
          sh: 'Shell',
          bash: 'Bash',
          python: 'Python',
          py: 'Python',
          yaml: 'YAML',
          md: 'Markdown',
          sql: 'SQL',
          rust: 'Rust',
          go: 'Go',
          java: 'Java',
          c: 'C',
          cpp: 'C++',
          mermaid: 'Mermaid',
          '': '纯文本',
        },
      }),
      jsxPlugin({
        jsxComponentDescriptors: [
          {
            name: 'WritingBlock',
            kind: 'flow',
            props: [{ name: 'id', type: 'string' }],
            hasChildren: false,
            Editor: ProtectedBlockEditor,
          },
          {
            name: 'WritingInline',
            kind: 'text',
            props: [{ name: 'id', type: 'string' }],
            hasChildren: false,
            Editor: ProtectedBlockEditor,
          },
          ...(mdx ? descriptors : []),
        ],
      }),
      markdownShortcutPlugin(),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <UndoRedo />
            <Separator />
            <BlockTypeSelect />
            <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
            <StrikeThroughSupSubToggles options={['Strikethrough']} />
            <CodeToggle />
            <Separator />
            <ListsToggle />
            <CreateLink />
            <InsertImage />
            <InsertTable />
            <InsertCodeBlock />
            <InsertThematicBreak />
            {mdx && <InsertComponent />}
          </>
        ),
      }),
    ],
    [mdx],
  );
  return (
    <div className={`admin-rich-editor ${dark ? 'dark-theme' : ''}`}>
      <div className="editor-mode-bar">
        <div className="segmented" aria-label="编辑模式">
          <button
            type="button"
            aria-pressed={mode === 'visual'}
            disabled={disabled}
            onClick={() => {
              if (mode === 'visual') return;
              const next = prepareDocument(value);
              if (!next) {
                setError('这段语法暂不支持正文编辑，请使用源码。');
                return;
              }
              setDocument(next);
              initial.current = next.markdown;
              lastVisual.current = next.markdown;
              setError('');
              setMode('visual');
            }}
          >
            正文
          </button>
          <button
            type="button"
            aria-pressed={mode === 'source'}
            disabled={disabled}
            onClick={() => {
              initial.current = value;
              setMode('source');
            }}
          >
            Markdown 源码
          </button>
        </div>
        <button
          className="quiet-button"
          type="button"
          disabled={disabled}
          onClick={() => setLibrary(true)}
        >
          <Icon name="media" />
          媒体库
        </button>
      </div>
      {error && (
        <p className="editor-note" role="alert">
          {error}
        </p>
      )}
      {mode === 'source' ? (
        <Suspense
          fallback={<p className="admin-loading">正在载入源码编辑器…</p>}
        >
          <SourceEditor value={value} onChange={onChange} readOnly={disabled} />
        </Suspense>
      ) : (
        <VisualEditorBoundary
          onFailure={() => {
            setError('可视化编辑器未能读取这段内容');
            initial.current = latest.current;
            setMode('source');
          }}
        >
          <ProtectedBlocks.Provider value={document?.blocks || {}}>
            <MDXEditor
              ref={ref}
              markdown={initial.current}
              trim={false}
              readOnly={disabled}
              className={dark ? 'dark-theme' : ''}
              contentEditableClassName="admin-rich-content prose admin-preview"
              spellCheck={false}
              placeholder="从这里开始写作…"
              translation={translate}
              onChange={(markdown, normalize) => {
                if (normalize) return;
                try {
                  const restored = restoreMdx(
                    markdown,
                    document || { markdown: '', blocks: {} },
                  );
                  lastVisual.current = markdown;
                  onChange(restored);
                } catch (error) {
                  ref.current?.setMarkdown(lastVisual.current);
                  setError((error as Error).message);
                }
              }}
              onError={({ error: message }) => {
                setError(message);
                initial.current = latest.current;
                setMode('source');
              }}
              plugins={plugins}
            />
          </ProtectedBlocks.Provider>
        </VisualEditorBoundary>
      )}
      {library && (
        <Modal title="插入图片" wide onClose={() => setLibrary(false)}>
          <MediaLibrary onSelect={insertMedia} />
        </Modal>
      )}
    </div>
  );
}
