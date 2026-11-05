import { useEffect, useState } from 'react';
import {
  api,
  today,
  status,
  type Post,
  type Series,
  type Publication,
} from './client';
import { ErrorMessage, type Notify } from './ui';
import PreviewDialog from './PreviewDialog';

export default function SeriesManager({
  onOpen,
  onDirty,
  onSaved,
  publication,
  notify,
}: {
  onOpen: (post: Post) => void;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
  publication: Publication | null;
  notify: Notify;
}) {
  const [items, setItems] = useState<Series[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Series | null>(null);
  const [form, setForm] = useState({ id: '', title: '', description: '' });
  const [chapters, setChapters] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState('');
  const [preview, setPreview] = useState(false);
  const blocked = busy || loading || publication?.state === 'building';
  function mark(value: boolean) {
    setDirty(value);
    onDirty(value);
  }
  async function reload(id?: string) {
    const [groups, articles] = await Promise.all([
      api<{ items: Series[] }>('/series'),
      api<{ posts: Post[] }>('/posts'),
    ]);
    setItems(groups.items);
    setPosts(articles.posts);
    if (id) {
      const group = groups.items.find((item) => item.id === id);
      if (group) choose(group, articles.posts);
    }
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ items: Series[] }>('/series'),
      api<{ posts: Post[] }>('/posts'),
    ])
      .then(([groups, articles]) => {
        if (active) {
          setItems(groups.items);
          setPosts(articles.posts);
        }
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
  }, []);
  function choose(item: Series | null, source = posts) {
    setSelected(item);
    setForm(item || { id: '', title: '', description: '' });
    setChapters(
      item
        ? source
            .filter((post) => post.metadata.series === item.id)
            .sort((a, b) => a.metadata.order! - b.metadata.order!)
            .map((post) => post.id)
        : [],
    );
    setAdding('');
    mark(false);
    setError('');
  }
  function switchTo(item: Series | null) {
    if (dirty && !confirm('放弃尚未保存的系列修改？')) return;
    choose(item);
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const item = await api<Series>(
        `/series/${encodeURIComponent(form.id)}`,
        'PUT',
        { ...form, revision: selected?.revision ?? null },
      );
      setSelected(item);
      if (selected)
        await api(`/series/${encodeURIComponent(item.id)}/chapters`, 'PUT', {
          chapters,
          revisions: Object.fromEntries(
            posts.map((post) => [post.id, post.revision]),
          ),
        });
      await reload(item.id);
      onSaved();
      notify('系列已保存');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, direction: number) {
    const next = [...chapters];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setChapters(next);
    mark(true);
  }
  function createChapter() {
    if (!selected || dirty) return;
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
            ...posts
              .filter((post) => post.metadata.series === selected.id)
              .map((post) => post.metadata.order ?? 0),
          ) + 1,
      },
    });
  }
  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <h1>系列</h1>
        <button type="button" disabled={blocked} onClick={() => switchTo(null)}>
          新建系列
        </button>
      </div>
      {error && <ErrorMessage message={error} />}
      <fieldset disabled={blocked} className="series-manager">
        <label>
          选择系列
          <select
            value={selected?.id || ''}
            onChange={(event) =>
              switchTo(
                items.find((item) => item.id === event.target.value) || null,
              )
            }
          >
            <option value="">新建系列</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          名称
          <input
            value={form.title}
            maxLength={120}
            onChange={(e) => {
              setForm({ ...form, title: e.target.value });
              mark(true);
            }}
          />
        </label>
        {!selected && (
          <label>
            地址标识
            <input
              value={form.id}
              placeholder="例如 algorithm-notes"
              onChange={(e) => {
                setForm({ ...form, id: e.target.value });
                mark(true);
              }}
            />
          </label>
        )}
        <label>
          简介
          <textarea
            value={form.description}
            maxLength={240}
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              mark(true);
            }}
          />
        </label>
        {selected && (
          <>
            <div className="admin-actions">
              <h2>篇目</h2>
              <button type="button" disabled={dirty} onClick={createChapter}>
                新增文章
              </button>
            </div>
            <ol className="series-editor-list">
              {chapters.map((id, index) => {
                const post = posts.find((item) => item.id === id)!;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className="series-edit-title"
                      disabled={dirty}
                      onClick={() => onOpen(post)}
                    >
                      {post.metadata.title}
                    </button>
                    <span className="muted small">
                      {status(post, publication)}
                    </span>
                    <div className="admin-actions">
                      <button
                        type="button"
                        aria-label={`上移 ${post.metadata.title}`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`下移 ${post.metadata.title}`}
                        disabled={index === chapters.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChapters(chapters.filter((item) => item !== id));
                          mark(true);
                        }}
                      >
                        移出系列
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="admin-actions">
              <select
                aria-label="选择已有文章"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
              >
                <option value="">添加已有文章</option>
                {posts
                  .filter((post) => !chapters.includes(post.id))
                  .map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.metadata.title}
                      {post.metadata.series ? '（来自其他系列）' : ''}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!adding}
                onClick={() => {
                  setChapters([...chapters, adding]);
                  setAdding('');
                  mark(true);
                }}
              >
                添加
              </button>
            </div>
          </>
        )}
        <div className="admin-actions">
          <button
            type="button"
            className="admin-primary"
            disabled={!dirty}
            onClick={() => void save()}
          >
            {busy ? '保存中…' : '保存系列'}
          </button>
          {selected && (
            <button
              type="button"
              disabled={dirty || !chapters.length}
              onClick={() => setPreview(true)}
            >
              预览系列
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!dirty || confirm('放弃尚未保存的修改并重新读取？')) {
                setBusy(true);
                void reload(selected?.id)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }
            }}
          >
            重新读取
          </button>
        </div>
      </fieldset>
      {preview && selected && (
        <PreviewDialog
          path={`/series/${selected.id}/`}
          onClose={() => setPreview(false)}
        />
      )}
    </section>
  );
}
