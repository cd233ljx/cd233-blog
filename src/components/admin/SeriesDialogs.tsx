import { useEffect, useState, type SubmitEvent } from 'react';
import { Search } from 'lucide-react';
import {
  api,
  status,
  type Post,
  type Publication,
  type Series,
} from './client';
import { ErrorMessage, Modal } from './ui';

export function SeriesDetailsDialog({
  series,
  blocked,
  onClose,
  onSaved,
  onDirty,
}: {
  series: Series | null;
  blocked: boolean;
  onClose: () => void;
  onSaved: (series: Series) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState({
    id: series?.id ?? '',
    title: series?.title ?? '',
    description: series?.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty =
    form.id !== (series?.id ?? '') ||
    form.title !== (series?.title ?? '') ||
    form.description !== (series?.description ?? '');
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy, onDirty]);

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || blocked) return;
    setBusy(true);
    setError('');
    try {
      const item = await api<Series>(
        `/series/${encodeURIComponent(form.id)}`,
        'PUT',
        {
          ...form,
          revision: series?.revision ?? null,
        },
      );
      onSaved(item);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={series ? '编辑系列资料' : '新建系列'}
      onClose={() => {
        if (!busy) onClose();
      }}
      dismissible={!busy}
    >
      <form onSubmit={save}>
        <fieldset className="series-details-form" disabled={busy || blocked}>
          <label>
            系列名称
            <input
              autoFocus
              required
              maxLength={120}
              value={form.title}
              placeholder="例如：算法学习笔记"
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>
          <label>
            简介
            <textarea
              required
              rows={3}
              maxLength={240}
              value={form.description}
              placeholder="这个系列会记录什么？"
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
            <small>显示在系列目录中，最多 240 字。</small>
          </label>
          <label>
            系列地址
            <input
              required
              disabled={!!series}
              value={form.id}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="例如 algorithm-notes"
              autoCapitalize="none"
              spellCheck={false}
              onChange={(event) => setForm({ ...form, id: event.target.value })}
            />
            <small>
              {series
                ? `/series/${series.id}/ · 创建后地址固定`
                : '使用小写英文、数字和短横线，创建后不可更改。'}
            </small>
          </label>
        </fieldset>
        {error && <ErrorMessage message={error} />}
        <div className="modal-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="submit"
            className="admin-primary"
            disabled={
              busy ||
              blocked ||
              !dirty ||
              !form.title.trim() ||
              !form.description.trim() ||
              !form.id
            }
          >
            {busy ? '保存中…' : series ? '保存资料' : '创建系列'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function SeriesArticlePicker({
  series,
  items,
  posts,
  chapters,
  publication,
  blocked,
  onClose,
  onAdd,
}: {
  series: Series;
  items: Series[];
  posts: Post[];
  chapters: string[];
  publication: Publication | null;
  blocked: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('ungrouped');
  const [checked, setChecked] = useState<string[]>([]);
  const existing = new Set(chapters);
  const selected = new Set(checked);
  const titles = new Map(items.map((item) => [item.id, item.title]));
  const available = posts.filter((post) => !existing.has(post.id));
  const filtered = available.filter(
    (post) =>
      (scope === 'all' ||
        !post.metadata.series ||
        post.metadata.series === series.id) &&
      `${post.metadata.title} ${post.metadata.tags?.join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const transfers = available.filter(
    (post) =>
      selected.has(post.id) &&
      post.metadata.series &&
      post.metadata.series !== series.id,
  );
  const allChecked =
    filtered.length > 0 && filtered.every((post) => selected.has(post.id));
  function toggle(id: string) {
    setChecked((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  return (
    <Modal title={`添加文章到「${series.title}」`} onClose={onClose}>
      <div className="series-picker-toolbar">
        <label className="search-input">
          <Search size={16} aria-hidden="true" />
          <input
            autoFocus
            aria-label="搜索已有文章"
            placeholder="搜索标题、标签…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="文章归属筛选"
          value={scope}
          onChange={(event) => setScope(event.target.value)}
        >
          <option value="ungrouped">未加入其他系列</option>
          <option value="all">全部可添加文章</option>
        </select>
      </div>
      <div className="series-picker-caption">
        <span className="muted small" role="status">
          {filtered.length} 篇可选 · 已选 {checked.length} 篇
        </span>
        <button
          type="button"
          className="quiet-button"
          disabled={blocked || !filtered.length}
          onClick={() =>
            setChecked((current) =>
              allChecked
                ? current.filter(
                    (id) => !filtered.some((post) => post.id === id),
                  )
                : [
                    ...new Set([
                      ...current,
                      ...filtered.map((post) => post.id),
                    ]),
                  ],
            )
          }
        >
          {allChecked ? '取消选择当前结果' : '选择当前结果'}
        </button>
      </div>
      <div className="series-picker-list">
        {filtered.length ? (
          filtered.map((post) => (
            <label
              key={post.id}
              className={`series-picker-row ${selected.has(post.id) ? 'is-selected' : ''}`}
            >
              <input
                type="checkbox"
                disabled={blocked}
                checked={selected.has(post.id)}
                onChange={() => toggle(post.id)}
              />
              <span>
                <strong>{post.metadata.title}</strong>
                <small>
                  {post.metadata.series && post.metadata.series !== series.id
                    ? `来自「${titles.get(post.metadata.series) || post.metadata.series}」`
                    : '未加入其他系列'}
                </small>
              </span>
              <span className="status-badge">{status(post, publication)}</span>
            </label>
          ))
        ) : (
          <div className="series-picker-empty">
            <p>{query ? '没有找到匹配的文章' : '没有可添加的文章'}</p>
            <p className="muted small">
              {scope === 'ungrouped'
                ? '可切换到「全部可添加文章」，从其他系列移入。'
                : '试试其他关键词，或直接在系列中新建文章。'}
            </p>
          </div>
        )}
      </div>
      {transfers.length > 0 && (
        <p className="series-transfer-note" role="status">
          其中 {transfers.length}{' '}
          篇来自其他系列。保存篇目后，这些文章将移出原系列，文章内容和地址不变。
        </p>
      )}
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="admin-primary"
          disabled={blocked || !checked.length}
          onClick={() => onAdd(checked)}
        >
          添加{checked.length ? ` ${checked.length} 篇` : ''}
        </button>
      </div>
    </Modal>
  );
}
