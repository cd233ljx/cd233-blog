import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Eye,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Undo2,
} from 'lucide-react';
import {
  api,
  today,
  status,
  type Post,
  type Series,
  type Publication,
} from './client';
import { Empty, ErrorMessage, Modal, type Notify } from './ui';
import PreviewDialog from './PreviewDialog';
import { SeriesArticlePicker, SeriesDetailsDialog } from './SeriesDialogs';
import {
  chapterChanges,
  dropChapter,
  moveChapter,
  sameChapters,
  seriesChapters,
} from './series-editor';

export default function SeriesManager({
  initialSelectedId,
  onSelect,
  onOpen,
  onDirty,
  onSaved,
  publication,
  notify,
}: {
  initialSelectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (post: Post) => void;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
  publication: Publication | null;
  notify: Notify;
}) {
  const initialId = useRef(initialSelectedId);
  const [items, setItems] = useState<Series[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );
  const [chapters, setChapters] = useState<string[]>([]);
  const [undo, setUndo] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState<'create' | 'edit' | null>(null);
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [picker, setPicker] = useState(false);
  const [preview, setPreview] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    label: string;
    run: (source: Post[]) => void;
  } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropSlot, setDropSlot] = useState<number | null>(null);
  const dragId = useRef<string | null>(null);
  const operation = useRef(false);
  const selected = items.find((item) => item.id === selectedId);
  const savedChapters = selected ? seriesChapters(posts, selected.id) : [];
  const dirty = !sameChapters(savedChapters, chapters);
  const blocked = busy || loading || publication?.state === 'building';
  const postById = new Map(posts.map((post) => [post.id, post]));
  const actionPost = actionId ? postById.get(actionId) : undefined;
  const changes = chapterChanges(savedChapters, chapters);
  const filtered = items.filter((item) =>
    `${item.title} ${item.description}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.metadata.series)
      counts.set(
        post.metadata.series,
        (counts.get(post.metadata.series) ?? 0) + 1,
      );
  }

  useEffect(() => {
    onDirty(dirty || detailsDirty || busy);
  }, [dirty, detailsDirty, busy, onDirty]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ items: Series[] }>('/series'),
      api<{ posts: Post[] }>('/posts'),
    ])
      .then(([groups, articles]) => {
        if (!active) return;
        setItems(groups.items);
        setPosts(articles.posts);
        const group =
          groups.items.find((item) => item.id === initialId.current) ??
          groups.items[0];
        setSelectedId(group?.id ?? null);
        onSelect(group?.id ?? null);
        setChapters(group ? seriesChapters(articles.posts, group.id) : []);
      })
      .catch((error) => {
        if (active) setError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onSelect]);

  function choose(item: Series | undefined, source = posts) {
    setSelectedId(item?.id ?? null);
    onSelect(item?.id ?? null);
    setChapters(item ? seriesChapters(source, item.id) : []);
    setUndo(null);
    setError('');
    setAnnouncement('');
    dragId.current = null;
    setDragging(null);
    setDropSlot(null);
  }
  function proceed(label: string, run: (source: Post[]) => void) {
    if (blocked) return;
    if (dirty) setPending({ label, run });
    else run(posts);
  }
  async function reload() {
    if (operation.current) return;
    operation.current = true;
    setLoading(true);
    setError('');
    try {
      const [groups, articles] = await Promise.all([
        api<{ items: Series[] }>('/series'),
        api<{ posts: Post[] }>('/posts'),
      ]);
      setItems(groups.items);
      setPosts(articles.posts);
      choose(
        groups.items.find((item) => item.id === selectedId) ?? groups.items[0],
        articles.posts,
      );
      notify('已读取最新系列和文章');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      operation.current = false;
      setLoading(false);
    }
  }
  async function saveChapters(): Promise<Post[] | null> {
    if (blocked || operation.current || !selected) return null;
    if (!dirty) return posts;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<{ posts: Post[] }>(
        `/series/${encodeURIComponent(selected.id)}/chapters`,
        'PUT',
        {
          chapters,
          revisions: Object.fromEntries(
            posts.map((post) => [post.id, post.revision]),
          ),
        },
      );
      setPosts(result.posts);
      setChapters(seriesChapters(result.posts, selected.id));
      setUndo(null);
      onDirty(false);
      onSaved();
      notify('篇目已保存，发布后更新到博客');
      return result.posts;
    } catch (error) {
      setError((error as Error).message);
      return null;
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function updateChapters(next: string[], message: string) {
    if (blocked || sameChapters(next, chapters)) return;
    setUndo(chapters);
    setChapters(next);
    setAnnouncement(message);
  }
  function move(id: string, index: number) {
    updateChapters(
      moveChapter(chapters, id, index),
      `「${postById.get(id)?.metadata.title}」已移到第 ${index + 1} 位，尚未保存。`,
    );
  }
  async function openPost(id?: string) {
    if (!selected || blocked) return;
    const source = await saveChapters();
    if (!source) return;
    if (id) {
      const post = source.find((item) => item.id === id);
      if (post) onOpen(post);
      return;
    }
    onOpen({
      id: `post-${Date.now()}.mdx`,
      revision: null,
      body: '',
      metadata: {
        title: '',
        description: '',
        publishedAt: today(),
        tags: [],
        featured: false,
        draft: true,
        series: selected.id,
        order:
          Math.max(
            -1,
            ...source
              .filter((post) => post.metadata.series === selected.id)
              .map((post) => post.metadata.order ?? 0),
          ) + 1,
      },
    });
  }
  async function openPreview() {
    if (await saveChapters()) setPreview(true);
  }
  function endDrag() {
    dragId.current = null;
    setDragging(null);
    setDropSlot(null);
  }
  const liveCount = chapters.filter(
    (id) => publication?.live?.posts[id]?.visible,
  ).length;
  const draftCount = chapters.filter(
    (id) => postById.get(id)?.metadata.draft,
  ).length;

  return (
    <section className="admin-page series-page">
      <div className="admin-page-heading">
        <div>
          <h1>系列</h1>
          <p>把零散的文章，整理成一条阅读路径。</p>
        </div>
        <button
          type="button"
          className="admin-primary"
          disabled={blocked}
          onClick={() => proceed('新建系列', () => setDetails('create'))}
        >
          <Plus size={16} aria-hidden="true" />
          新建系列
        </button>
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? (
        <p className="admin-loading" role="status">
          正在读取系列…
        </p>
      ) : (
        <div className="series-workspace">
          <aside className="series-browser" aria-label="系列列表">
            <div className="series-browser-heading">
              <span>全部系列</span>
              <span className="muted small">{items.length}</span>
            </div>
            <label className="search-input">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="搜索系列"
                placeholder="搜索系列…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <nav aria-label="选择系列">
              {filtered.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  disabled={blocked}
                  aria-current={selectedId === item.id ? 'true' : undefined}
                  onClick={() => {
                    if (selectedId !== item.id)
                      proceed(`切换到「${item.title}」`, (source) =>
                        choose(item, source),
                      );
                  }}
                >
                  <BookOpen size={18} aria-hidden="true" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.id === selectedId
                        ? chapters.length
                        : (counts.get(item.id) ?? 0)}{' '}
                      篇文章{item.id === selectedId && dirty ? ' · 未保存' : ''}
                    </small>
                  </span>
                </button>
              ))}
              {!filtered.length && (
                <p className="muted small">
                  {query
                    ? '没有找到匹配的系列'
                    : '还没有系列，创建一个开始整理。'}
                </p>
              )}
            </nav>
            <button
              type="button"
              className="quiet-button series-reload"
              disabled={blocked}
              onClick={() => proceed('重新读取', () => void reload())}
            >
              重新读取
            </button>
          </aside>
          <div className="series-detail" aria-busy={busy}>
            {selected ? (
              <>
                <header className="series-detail-header">
                  <div className="series-detail-title">
                    <h2>{selected.title}</h2>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="quiet-button"
                        disabled={blocked}
                        onClick={() => setDetails('edit')}
                      >
                        <Settings2 size={15} aria-hidden="true" />
                        编辑资料
                      </button>
                      <button
                        type="button"
                        className="quiet-button"
                        disabled={blocked || !chapters.length}
                        onClick={() => void openPreview()}
                      >
                        <Eye size={15} aria-hidden="true" />
                        预览
                      </button>
                    </div>
                  </div>
                  <p className="series-description">{selected.description}</p>
                  <div className="series-summary">
                    <span>{chapters.length} 篇文章</span>
                    <span>{draftCount} 篇草稿</span>
                    {publication?.known && <span>{liveCount} 篇已上线</span>}
                  </div>
                </header>
                <div className="series-chapter-toolbar">
                  <div>
                    <h3>篇目目录</h3>
                    <p id="series-order-help" className="muted small">
                      按阅读顺序排列。拖动手柄排序，或打开篇目操作。
                    </p>
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setPicker(true)}
                    >
                      添加已有文章
                    </button>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => void openPost()}
                    >
                      <Plus size={15} aria-hidden="true" />
                      写新文章
                    </button>
                  </div>
                </div>
                <p id="series-keyboard-help" className="sr-only">
                  聚焦排序手柄后，按 Alt
                  加上、下方向键移动。也可使用篇目操作中的位置选择。
                </p>
                <p className="sr-only" role="status" aria-live="polite">
                  {announcement}
                </p>
                {chapters.length ? (
                  <ol
                    className="series-editor-list"
                    aria-label={`${selected.title}的篇目`}
                    aria-describedby="series-order-help"
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      )
                        setDropSlot(null);
                    }}
                  >
                    {chapters.map((id, index) => {
                      const post = postById.get(id);
                      if (!post) return null;
                      const state = status(post, publication);
                      return (
                        <li
                          key={id}
                          className={`${dragging === id ? 'is-dragging' : ''} ${dropSlot === index ? 'drop-before' : ''} ${dropSlot === chapters.length && index === chapters.length - 1 ? 'drop-after' : ''}`}
                          onDragOver={(event) => {
                            if (!dragId.current || blocked) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'move';
                            const rect =
                              event.currentTarget.getBoundingClientRect();
                            setDropSlot(
                              index +
                                (event.clientY >= rect.top + rect.height / 2
                                  ? 1
                                  : 0),
                            );
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (dragId.current && !blocked) {
                              const rect =
                                event.currentTarget.getBoundingClientRect();
                              const slot =
                                index +
                                (event.clientY >= rect.top + rect.height / 2
                                  ? 1
                                  : 0);
                              const next = dropChapter(
                                chapters,
                                dragId.current,
                                slot,
                              );
                              updateChapters(
                                next,
                                `篇目顺序已调整，尚未保存。`,
                              );
                            }
                            endDrag();
                          }}
                        >
                          <button
                            type="button"
                            className="icon-button series-drag-handle"
                            disabled={blocked || chapters.length < 2}
                            draggable={!blocked && chapters.length > 1}
                            aria-label={`调整「${post.metadata.title}」顺序`}
                            aria-describedby="series-keyboard-help"
                            title="拖动排序；Alt + 上下方向键移动；点击选择位置"
                            onClick={() => setActionId(id)}
                            onKeyDown={(event) => {
                              if (
                                !event.altKey ||
                                !['ArrowUp', 'ArrowDown'].includes(event.key)
                              )
                                return;
                              event.preventDefault();
                              move(
                                id,
                                index + (event.key === 'ArrowUp' ? -1 : 1),
                              );
                            }}
                            onDragStart={(event) => {
                              dragId.current = id;
                              setDragging(id);
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', id);
                            }}
                            onDragEnd={endDrag}
                          >
                            <GripVertical size={17} aria-hidden="true" />
                          </button>
                          <span
                            className="series-chapter-number"
                            aria-hidden="true"
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            className="series-edit-title"
                            disabled={blocked}
                            onClick={() => void openPost(id)}
                          >
                            <strong>{post.metadata.title}</strong>
                            <span>
                              <time>{post.metadata.publishedAt}</time>
                              {!savedChapters.includes(id) && (
                                <span className="series-added-label">
                                  待加入
                                </span>
                              )}
                            </span>
                          </button>
                          <span
                            className={`status-badge ${state === '已上线' ? 'is-live' : ''}`}
                          >
                            {state}
                          </span>
                          <button
                            type="button"
                            className="icon-button series-row-actions"
                            disabled={blocked}
                            aria-label={`「${post.metadata.title}」的篇目操作`}
                            title="篇目操作"
                            onClick={() => setActionId(id)}
                          >
                            <MoreHorizontal size={19} aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <Empty title="从第一篇开始">
                    <p>把已有文章加入目录，或直接写下这个系列的第一篇。</p>
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => setPicker(true)}
                    >
                      选择已有文章
                    </button>
                  </Empty>
                )}
                <div className={`series-save-bar ${dirty ? 'is-dirty' : ''}`}>
                  <div role="status">
                    <strong>
                      {busy ? '正在保存…' : dirty ? changes : '篇目已保存'}
                    </strong>
                    <small>
                      {dirty
                        ? '打开文章或预览前，会先保存这些调整。'
                        : '保存用于继续编辑，发布后才会更新博客。'}
                    </small>
                  </div>
                  <div className="admin-actions">
                    {undo && (
                      <button
                        type="button"
                        className="quiet-button"
                        disabled={blocked}
                        onClick={() => {
                          setChapters(undo);
                          setUndo(null);
                          setAnnouncement('已撤销上一步调整。');
                        }}
                      >
                        <Undo2 size={15} aria-hidden="true" />
                        撤销上一步
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-primary"
                      disabled={blocked || !dirty}
                      onClick={() => void saveChapters()}
                    >
                      {busy ? '保存中…' : '保存篇目'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Empty title={error ? '系列暂时无法读取' : '把文章串成一个系列'}>
                <p>
                  {error
                    ? '重新读取后继续整理。'
                    : '学习笔记、项目记录或长期专题，都可以从这里开始。'}
                </p>
                <button
                  type="button"
                  className="admin-primary"
                  disabled={blocked}
                  onClick={() => (error ? void reload() : setDetails('create'))}
                >
                  {error ? '重新读取' : '创建第一个系列'}
                </button>
              </Empty>
            )}
          </div>
        </div>
      )}
      {details && (
        <SeriesDetailsDialog
          series={details === 'edit' ? (selected ?? null) : null}
          blocked={blocked}
          onDirty={setDetailsDirty}
          onClose={() => {
            setDetails(null);
            setDetailsDirty(false);
          }}
          onSaved={(item) => {
            setItems((current) =>
              [...current.filter((group) => group.id !== item.id), item].sort(
                (a, b) => a.id.localeCompare(b.id),
              ),
            );
            if (details === 'create') {
              choose(item);
              setQuery('');
            }
            setDetails(null);
            setDetailsDirty(false);
            onSaved();
            notify(
              details === 'create'
                ? '系列已创建，可以添加第一篇文章了'
                : '系列资料已保存',
            );
          }}
        />
      )}
      {picker && selected && (
        <SeriesArticlePicker
          series={selected}
          items={items}
          posts={posts}
          chapters={chapters}
          publication={publication}
          blocked={blocked}
          onClose={() => setPicker(false)}
          onAdd={(ids) => {
            updateChapters(
              [...new Set([...chapters, ...ids])],
              `已加入 ${ids.length} 篇文章，尚未保存。`,
            );
            setPicker(false);
          }}
        />
      )}
      {actionPost && (
        <Modal title="篇目操作" onClose={() => setActionId(null)}>
          <p className="series-action-title">{actionPost.metadata.title}</p>
          <label className="series-position-label">
            阅读位置
            <select
              disabled={blocked}
              value={chapters.indexOf(actionPost.id)}
              onChange={(event) => {
                move(actionPost.id, Number(event.target.value));
                setActionId(null);
              }}
            >
              {chapters.map((id, index) => (
                <option key={id} value={index}>
                  第 {index + 1} 篇{index === 0 ? ' · 开篇' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="series-position-actions">
            <button
              type="button"
              disabled={blocked || chapters.indexOf(actionPost.id) === 0}
              onClick={() =>
                move(actionPost.id, chapters.indexOf(actionPost.id) - 1)
              }
            >
              上移一位
            </button>
            <button
              type="button"
              disabled={
                blocked ||
                chapters.indexOf(actionPost.id) === chapters.length - 1
              }
              onClick={() =>
                move(actionPost.id, chapters.indexOf(actionPost.id) + 1)
              }
            >
              下移一位
            </button>
          </div>
          <div className="series-remove-action">
            <p className="muted small">
              移出后文章仍保留在文章列表，内容和地址不变。
            </p>
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                updateChapters(
                  chapters.filter((id) => id !== actionPost.id),
                  `已移出「${actionPost.metadata.title}」，可撤销，尚未保存。`,
                );
                setActionId(null);
              }}
            >
              移出系列
            </button>
          </div>
          <div className="modal-actions">
            <button type="button" onClick={() => setActionId(null)}>
              完成
            </button>
          </div>
        </Modal>
      )}
      {pending && (
        <Modal
          title="保存篇目后继续？"
          onClose={() => {
            if (!busy) setPending(null);
          }}
          dismissible={!busy}
        >
          <p>
            「{selected?.title}」有未保存的调整：{changes}。保存后
            {pending.label}。
          </p>
          {error && <ErrorMessage message={error} />}
          <div className="modal-actions series-pending-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              继续整理
            </button>
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                setChapters(savedChapters);
                setUndo(null);
                setPending(null);
                pending.run(posts);
              }}
            >
              放弃调整并继续
            </button>
            <button
              type="button"
              className="admin-primary"
              disabled={blocked}
              onClick={async () => {
                const source = await saveChapters();
                if (source) {
                  setPending(null);
                  pending.run(source);
                }
              }}
            >
              {busy ? '保存中…' : '保存并继续'}
            </button>
          </div>
        </Modal>
      )}
      {preview && selected && (
        <PreviewDialog
          path={`/series/${selected.id}/`}
          onClose={() => setPreview(false)}
        />
      )}
    </section>
  );
}
