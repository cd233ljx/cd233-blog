import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react';
import {
  api,
  today,
  status,
  type Post,
  type Publication,
  type Media,
} from './client';
import { Icon, Modal, ErrorMessage, type Notify } from './ui';
import MediaLibrary from './MediaLibrary';
import { createBatchedTask } from '../../lib/batched-task';
import HistoryDialog from './HistoryDialog';
import PreviewDialog from './PreviewDialog';
import LocalPreview from './LocalPreview';
import { useSplitScroll } from './useSplitScroll';
import { drafts } from '../../lib/draft-store';
import PublishDialog from './PublishDialog';
const SourceEditor = lazy(() => import('./SourceEditor'));
const newPost = (): Post => ({
  id: `post-${today().replaceAll('-', '')}-${crypto.randomUUID().slice(0, 6)}.mdx`,
  revision: null,
  body: '',
  metadata: {
    title: '',
    description: '',
    publishedAt: today(),
    tags: [],
    draft: true,
    featured: false,
  },
});
function editablePost(post: Post): Post {
  return {
    ...post,
    metadata: {
      ...post.metadata,
      tags: post.metadata.tags || [],
      draft: Boolean(post.metadata.draft),
      featured: Boolean(post.metadata.featured),
    },
  };
}
function excerpt(body: string, title: string) {
  return (
    body
      .replace(/```[\s\S]*?```/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[#*_`>\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160) || title
  );
}
export default function ArticleEditor({
  initialPost,
  dark,
  publication,
  onSaved,
  onDirty,
  onBack,
  backLabel = '文章',
  onPublication,
  notify,
}: {
  initialPost?: Post;
  dark: boolean;
  publication: Publication | null;
  onSaved: (post: Post) => void;
  onDirty: (dirty: boolean) => void;
  onBack: () => void;
  backLabel?: string;
  onPublication: () => void;
  notify: Notify;
}) {
  const [post, setPost] = useState<Post>(() =>
    initialPost ? editablePost(initialPost) : newPost(),
  );
  const [savedBody, setSavedBody] = useState(initialPost?.body || '');
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const storageFailure = () => {
    if (mounted.current)
      setStorageError('本地草稿存储不可用，请保持页面打开并同步保存。');
  };
  const current = useRef(post);
  current.current = post;
  const revision = useRef(post.revision);
  const saved = useRef<string | null>(null);
  if (saved.current === null) saved.current = JSON.stringify(post);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState(
    post.revision ? '所有修改已保存' : '填写标题后自动保存',
  );
  const inFlight = useRef<Promise<Post | null> | null>(null);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [inspector, setInspector] = useState(false);
  const [coverPicker, setCoverPicker] = useState(false);
  const [history, setHistory] = useState(false);
  const [preview, setPreview] = useState(false);
  const [mode, setMode] = useState<'edit' | 'split' | 'read'>('split');
  const splitRoot = useSplitScroll(mode === 'split' && !preview);
  const [externalPost, setExternalPost] = useState<Post | null>(null);
  const [syncError, setSyncError] = useState('');
  const [publish, setPublish] = useState<'publish' | 'unpublish' | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [recovery, setRecovery] = useState<Post | null>(null);
  const recoveryKey = useRef(`admin-draft:${initialPost?.id || 'new'}`);
  const mounted = useRef(true);
  const [recoveryWriter] = useState(() => createBatchedTask());
  useEffect(() => {
    const flush = () => recoveryWriter.flush();
    const hidden = () => {
      if (document.hidden) flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [recoveryWriter]);
  const blocked = publication?.state === 'building' || actionBusy;
  const localChanges = useRef(false);
  localChanges.current = dirty || Boolean(recovery);
  const savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;
  useEffect(() => {
    mounted.current = true;
    void drafts
      .get(recoveryKey.current)
      .then((value) => {
        if (!mounted.current) return;
        if (
          value &&
          (value.body !== current.current.body ||
            JSON.stringify(value.metadata) !==
              JSON.stringify(current.current.metadata))
        )
          setRecovery(value);
      })
      .catch(storageFailure)
      .finally(() => {
        if (mounted.current) setRecoveryReady(true);
      });
    return () => {
      mounted.current = false;
      onDirty(false);
    };
  }, []);
  useEffect(() => {
    onDirty(dirty || saving);
  }, [dirty, saving, onDirty]);
  function update(next: Post) {
    current.current = next;
    setPost(next);
    setDirty(true);
    setSaveLabel('等待自动保存…');
    const key = recoveryKey.current;
    recoveryWriter.schedule(() => {
      void drafts
        .set(key, { ...next, revision: revision.current })
        .catch(storageFailure);
    });
  }
  function field<K extends keyof Post['metadata']>(
    name: K,
    value: Post['metadata'][K],
  ) {
    update({
      ...current.current,
      metadata: { ...current.current.metadata, [name]: value },
    });
  }
  async function save(draft?: boolean): Promise<Post | null> {
    if (inFlight.current) {
      await inFlight.current;
      return save(draft);
    }
    recoveryWriter.flush();
    const original = current.current;
    if (!original.metadata.title.trim()) {
      setError('先给文章写一个标题。');
      setSaveLabel('等待标题');
      return null;
    }
    if (original.metadata.cover && !original.metadata.coverAlt?.trim()) {
      setInspector(true);
      setError('请填写封面替代文本。');
      return null;
    }
    if (
      draft === undefined &&
      revision.current &&
      JSON.stringify(original) === saved.current
    )
      return { ...original, revision: revision.current };
    const input: Post = {
      ...original,
      revision: revision.current,
      metadata: {
        ...original.metadata,
        draft: draft ?? original.metadata.draft,
        tags: [
          ...new Set(
            original.metadata.tags.map((tag) => tag.trim()).filter(Boolean),
          ),
        ],
        description:
          original.metadata.description.trim() ||
          excerpt(original.body, original.metadata.title),
      },
    };
    setSaving(true);
    setError('');
    setSaveLabel('正在保存…');
    const task = (async () => {
      try {
        const result = await api<Post>(
          `/posts/${encodeURIComponent(input.id)}`,
          'PUT',
          input,
        );
        revision.current = result.revision;
        if (mounted.current) setSavedBody(original.body);
        onSaved(result);
        if (mounted.current) {
          recoveryWriter.cancel();
          const unchanged = current.current === original;
          if (unchanged) {
            const next = {
              ...original,
              revision: result.revision,
              metadata: { ...original.metadata, draft: result.metadata.draft },
            };
            current.current = next;
            setPost(next);
            saved.current = JSON.stringify(next);
            setDirty(false);
            try {
              void drafts.remove(recoveryKey.current).catch(storageFailure);
            } catch {
              /* No browser storage. */
            }
          } else {
            const next = { ...current.current, revision: result.revision };
            current.current = next;
            setPost(next);
            saved.current = JSON.stringify({
              ...original,
              revision: result.revision,
            });
            try {
              void drafts.set(recoveryKey.current, next).catch(storageFailure);
            } catch {
              /* No browser storage. */
            }
          }
          if (recoveryKey.current === 'admin-draft:new') {
            const previousKey = recoveryKey.current;
            recoveryKey.current = `admin-draft:${result.id}`;
            void drafts
              .move(previousKey, recoveryKey.current)
              .catch(storageFailure);
          }
          setPaused(false);
          setSaveLabel(unchanged ? '所有修改已保存' : '已保存，继续同步…');
        }
        return result;
      } catch (error) {
        if (mounted.current) {
          setError((error as Error).message);
          setPaused(true);
          setSaveLabel('保存未完成');
        }
        return null;
      } finally {
        inFlight.current = null;
        if (mounted.current) setSaving(false);
      }
    })();
    inFlight.current = task;
    return task;
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (
      !recoveryReady ||
      !dirty ||
      saving ||
      blocked ||
      paused ||
      recovery ||
      !post.metadata.title.trim()
    )
      return;
    const timer = setTimeout(() => void saveRef.current(), 1800);
    return () => clearTimeout(timer);
  }, [post, dirty, saving, blocked, paused, recovery, recoveryReady]);
  useEffect(() => {
    const reconnect = () => {
      if (dirty && !blocked && !externalPost && !recovery && recoveryReady)
        void saveRef.current();
    };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [dirty, blocked, externalPost, recovery, recoveryReady]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!blocked) void saveRef.current();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [blocked]);
  useEffect(() => {
    let active = true;
    let checking = false;
    async function syncFromRepository() {
      if (!revision.current || inFlight.current || checking || document.hidden)
        return;
      checking = true;
      const original = current.current;
      const previousRevision = revision.current;
      try {
        const latest = editablePost(
          await api<Post>(`/posts/${encodeURIComponent(original.id)}`),
        );
        if (
          !active ||
          inFlight.current ||
          revision.current !== previousRevision
        )
          return;
        setSyncError('');
        if (latest.revision === previousRevision) return;
        if (localChanges.current || current.current !== original) {
          setExternalPost(latest);
          setPaused(true);
          setSaveLabel('仓库中有新修改，自动保存已暂停');
          return;
        }
        setSavedBody(latest.body);
        current.current = latest;
        revision.current = latest.revision;
        saved.current = JSON.stringify(latest);
        setPost(latest);
        setExternalPost(null);
        setPaused(false);
        setError('');
        setSaveLabel('已同步仓库修改');
        savedCallback.current(latest);
      } catch (error) {
        if (active)
          setSyncError(`仓库同步暂时失败：${(error as Error).message}`);
      } finally {
        checking = false;
      }
    }

    window.addEventListener('focus', syncFromRepository);
    return () => {
      active = false;
      window.removeEventListener('focus', syncFromRepository);
    };
  }, []);
  async function prepare(
    action: 'preview' | 'history' | 'publish' | 'unpublish',
  ) {
    if (action === 'preview') {
      setPreview(true);
      return;
    }
    const result = await save();
    if (!result) return;
    if (action === 'history') setHistory(true);
    else setPublish(action);
  }
  function restore(raw: Post) {
    recoveryWriter.cancel();
    const result = editablePost(raw);
    setSavedBody(result.body);
    current.current = result;
    setPost(result);
    revision.current = result.revision;
    saved.current = JSON.stringify(result);
    setDirty(false);
    setPaused(false);
    setError('');
    setHistory(false);
    setExternalPost(null);
    setRecovery(null);
    setEditorKey((value) => value + 1);
    setSaveLabel('已恢复历史版本，尚未发布');
    onSaved(result);
    try {
      void drafts.remove(recoveryKey.current).catch(storageFailure);
    } catch {
      /* No browser storage. */
    }
  }
  async function publishNow() {
    setActionBusy(true);
    try {
      const result = await save(publish === 'unpublish');
      if (!result) throw new Error('请先处理文章保存错误。');
      await api('/publish', 'POST');
      setPublish(null);
      onPublication();
      notify('发布已开始，完成后会更新线上页面。');
    } finally {
      setActionBusy(false);
    }
  }
  const notePath = `/note/${encodeURIComponent(post.metadata.slug || post.id.replace(/\.(md|mdx)$/, ''))}/`;
  const count = useMemo(
    () => Array.from(post.body.replace(/\s/g, '')).length,
    [post.body],
  );
  return (
    <div className={`article-workspace ${inspector ? 'inspector-open' : ''}`}>
      <header className="editor-topbar">
        <button type="button" className="quiet-button" onClick={onBack}>
          {backLabel}
        </button>
        <div className="editor-save-state" role="status">
          <span className={`save-dot ${dirty || saving ? 'pending' : ''}`} />
          {saving
            ? '正在保存…'
            : !dirty && revision.current
              ? '所有修改已保存'
              : saveLabel}
        </div>
        <div className="editor-top-actions">
          <button type="button" disabled={blocked} onClick={() => void save()}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={() => void prepare('preview')}
          >
            <Icon name="eye" />
            <span>预览</span>
          </button>
          <button
            type="button"
            aria-pressed={inspector}
            onClick={() => setInspector(!inspector)}
            aria-label="文章设置"
          >
            <Icon name="settings" />
          </button>
          <button
            type="button"
            className="admin-primary"
            disabled={blocked}
            onClick={() => void prepare('publish')}
          >
            发布…
          </button>
        </div>
      </header>
      <main className="article-canvas">
        {error && <ErrorMessage message={error} />}
        {syncError && <ErrorMessage message={syncError} />}
        {storageError && <ErrorMessage message={storageError} />}
        {paused && (
          <div className="editor-note">
            <p>自动保存已暂停，输入仍保留在当前窗口。</p>
            {!externalPost && (
              <button type="button" onClick={() => void save()}>
                重试保存
              </button>
            )}
            {externalPost && (
              <>
                <p>仓库中的笔记已更新。复制当前正文留存后，可载入最新版本。</p>
                <button type="button" onClick={() => restore(externalPost)}>
                  放弃当前输入，载入仓库版本
                </button>
              </>
            )}
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(post.body);
                  notify('正文已复制');
                } catch {
                  notify('无法访问剪贴板，请在源码模式中手动复制。');
                }
              }}
            >
              复制正文
            </button>
          </div>
        )}
        {recovery && (
          <div className="recovery-banner">
            <p>这个窗口留有一份未保存的内容。</p>
            <button
              type="button"
              onClick={() => {
                revision.current = recovery.revision;
                update(recovery);
                setEditorKey((value) => value + 1);
                setRecovery(null);
              }}
            >
              恢复输入
            </button>
            <button
              type="button"
              onClick={() => {
                setRecovery(null);
                try {
                  void drafts.remove(recoveryKey.current).catch(storageFailure);
                } catch {
                  /* No storage. */
                }
              }}
            >
              使用服务器版本
            </button>
          </div>
        )}
        <div className="article-heading">
          <div className="article-kicker">
            <span className="status-badge">{status(post, publication)}</span>
            <span>{post.metadata.publishedAt}</span>
          </div>
          <input
            className="article-title"
            aria-label="文章标题"
            placeholder="文章标题"
            maxLength={120}
            value={post.metadata.title}
            disabled={blocked}
            onChange={(event) => field('title', event.target.value)}
          />
          <div className="article-byline">
            <span>
              {count.toLocaleString()} 字符 · 约{' '}
              {Math.max(1, Math.ceil(count / 400))} 分钟阅读
            </span>
            <button
              type="button"
              className="quiet-button"
              onClick={() => setInspector(true)}
            >
              添加摘要、标签与封面 <Icon name="settings" size={14} />
            </button>
          </div>
        </div>
        <div className="editor-mode-bar">
          <div className="segmented" aria-label="笔记视图">
            {(
              [
                ['edit', '编辑'],
                ['split', '分栏'],
                ['read', '阅读'],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="muted small">
            {dirty || saving ? '本地预览 · 后台同步中' : '本地预览 · 已同步'}
          </span>
        </div>
        <div ref={splitRoot} className={`note-workspace mode-${mode}`}>
          <section
            className="note-source-pane"
            aria-label="Markdown 编辑"
            hidden={mode === 'read'}
          >
            <Suspense
              fallback={<p className="admin-loading">正在载入编辑器…</p>}
            >
              <SourceEditor
                key={editorKey}
                value={post.body}
                onChange={(body) => update({ ...current.current, body })}
                readOnly={blocked}
              />
            </Suspense>
          </section>
          <section
            className="note-preview-pane"
            aria-label="阅读预览"
            hidden={mode === 'edit'}
          >
            <LocalPreview
              body={post.body}
              savedBody={savedBody}
              path={notePath}
              dark={dark}
              active={mode !== 'edit' && !preview}
            />
          </section>
        </div>
        <p className="writing-footnote">
          Markdown 编辑 · 正文即时预览 · Ctrl / ⌘ + S 同步保存
        </p>
      </main>
      {inspector && (
        <aside className="article-inspector">
          <header>
            <h2>文章设置</h2>
            <button
              type="button"
              className="icon-button"
              aria-label="收起文章设置"
              onClick={() => setInspector(false)}
            >
              <Icon name="close" />
            </button>
          </header>
          <fieldset disabled={blocked}>
            <label>
              摘要
              <textarea
                rows={4}
                maxLength={240}
                value={post.metadata.description}
                placeholder="留空时自动从正文生成，也可以写一句自己的介绍。"
                onChange={(event) => field('description', event.target.value)}
              />
              <small>用于文章列表和搜索引擎描述。</small>
            </label>
            <label>
              标签
              <input
                value={post.metadata.tags.join(', ')}
                placeholder="用逗号分隔，例如：折腾, 日常"
                onChange={(event) =>
                  field(
                    'tags',
                    event.target.value
                      .split(/[,，]/)
                      .map((value) => value.trimStart()),
                  )
                }
                onBlur={() =>
                  field(
                    'tags',
                    post.metadata.tags
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={post.metadata.featured}
                onChange={(event) => field('featured', event.target.checked)}
              />
              首页置顶
            </label>
            <div className="field-pair">
              <label>
                发布日期
                <input
                  type="date"
                  value={post.metadata.publishedAt}
                  onChange={(event) => field('publishedAt', event.target.value)}
                />
              </label>
              <label>
                更新日期
                <input
                  type="date"
                  value={post.metadata.updatedAt || ''}
                  onChange={(event) => field('updatedAt', event.target.value)}
                />
              </label>
            </div>
            <p className="muted small">
              未来日期不会自动上线，到期后需手动发布。
            </p>
            <section className="inspector-section">
              <h3>文章封面</h3>
              {post.metadata.cover ? (
                <div className="cover-preview">
                  <img
                    alt={post.metadata.coverAlt || '文章封面'}
                    src={
                      post.metadata.cover.startsWith('../../assets/posts/')
                        ? `/admin/api/media/file?id=${encodeURIComponent(`asset/${post.metadata.cover.replace('../../assets/posts/', '')}`)}`
                        : `/admin/api/post-cover?id=${encodeURIComponent(post.id)}`
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        ...current.current,
                        metadata: {
                          ...current.current.metadata,
                          cover: '',
                          coverAlt: '',
                        },
                      })
                    }
                  >
                    移除封面
                  </button>
                </div>
              ) : (
                <div className="cover-empty">
                  <Icon name="media" size={28} />
                  <span>给文章加一张封面</span>
                </div>
              )}
              <button type="button" onClick={() => setCoverPicker(true)}>
                <Icon name="media" />
                从媒体库选择
              </button>
              {post.metadata.cover && (
                <label>
                  封面替代文本
                  <input
                    value={post.metadata.coverAlt || ''}
                    maxLength={1000}
                    onChange={(event) => field('coverAlt', event.target.value)}
                    placeholder="描述封面的画面内容"
                  />
                </label>
              )}
            </section>
            <section className="inspector-section">
              <h3>文章地址</h3>
              <label>
                地址标识
                <input
                  disabled={!!revision.current || saving}
                  value={post.id.replace(/\.(md|mdx)$/, '')}
                  onChange={(event) =>
                    update({
                      ...current.current,
                      id: `${event.target.value}.${post.id.endsWith('.mdx') ? 'mdx' : 'md'}`,
                    })
                  }
                />
              </label>
              <label>
                文件格式
                <select
                  disabled={!!revision.current || saving}
                  value={post.id.endsWith('.mdx') ? 'mdx' : 'md'}
                  onChange={(event) =>
                    update({
                      ...current.current,
                      id: post.id.replace(
                        /\.(md|mdx)$/,
                        `.${event.target.value}`,
                      ),
                    })
                  }
                >
                  <option value="mdx">MDX · 支持内容卡片</option>
                  <option value="md">Markdown</option>
                </select>
              </label>
              <small>
                /posts/
                {post.metadata.slug || post.id.replace(/\.(md|mdx)$/, '')}/
              </small>
              {post.sourcePath && <small>{post.sourcePath}</small>}
              {post.metadata.series && (
                <p className="muted small">
                  系列：{post.metadata.series} · 顺序 {post.metadata.order}
                  。可在后台「系列」中调整。
                </p>
              )}
            </section>
            <section className="inspector-section">
              <button
                type="button"
                disabled={!revision.current}
                onClick={() => void prepare('history')}
              >
                <Icon name="history" />
                查看历史版本
              </button>
              {!post.metadata.draft && (
                <button type="button" onClick={() => void prepare('unpublish')}>
                  转为草稿并下线…
                </button>
              )}
              <button
                type="button"
                className="danger-button"
                disabled={!revision.current}
                onClick={async () => {
                  if (
                    !confirm(
                      '将文章移入私有回收目录？线上文章会在下次发布网站时移除。',
                    )
                  )
                    return;
                  setActionBusy(true);
                  try {
                    if (inFlight.current) await inFlight.current;
                    await api(
                      `/posts/${encodeURIComponent(current.current.id)}`,
                      'DELETE',
                      { revision: revision.current },
                    );
                    recoveryWriter.cancel();
                    setDirty(false);
                    onDirty(false);
                    try {
                      void drafts
                        .remove(recoveryKey.current)
                        .catch(storageFailure);
                    } catch {
                      /* No storage. */
                    }
                    notify('文章已移入回收目录，发布网站后线上页面才会移除。');
                    onPublication();
                    onBack();
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setActionBusy(false);
                  }
                }}
              >
                删除文章…
              </button>
            </section>
          </fieldset>
        </aside>
      )}
      {coverPicker && (
        <Modal title="选择文章封面" wide onClose={() => setCoverPicker(false)}>
          <MediaLibrary
            onSelect={(item: Media) => {
              update({
                ...current.current,
                metadata: {
                  ...current.current.metadata,
                  cover: item.cover,
                  coverAlt: item.alt || '',
                },
              });
              setCoverPicker(false);
            }}
          />
        </Modal>
      )}
      {history && (
        <HistoryDialog
          post={{ ...post, revision: revision.current }}
          onRestore={restore}
          onClose={() => setHistory(false)}
        />
      )}
      {preview && (
        <PreviewDialog
          path={notePath}
          body={post.body}
          savedBody={savedBody}
          dark={dark}
          onClose={() => setPreview(false)}
        />
      )}
      {publish && (
        <PublishDialog
          post={post}
          action={publish}
          onConfirm={publishNow}
          onClose={() => setPublish(null)}
        />
      )}
    </div>
  );
}
