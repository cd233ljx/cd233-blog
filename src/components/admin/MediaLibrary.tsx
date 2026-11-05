import { useEffect, useRef, useState } from 'react';
import { api, upload, type Media } from './client';
import { Icon, ErrorMessage, Empty } from './ui';

export default function MediaLibrary({
  onSelect,
}: {
  onSelect?: (item: Media) => void;
}) {
  const [items, setItems] = useState<Media[]>([]);
  const [selected, setSelected] = useState<Media | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [alt, setAlt] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const refresh = async () => {
    const result = await api<{ items: Media[] }>('/media');
    if (alive.current) setItems(result.items);
  };
  useEffect(() => {
    alive.current = true;
    void refresh()
      .catch((error) => setError(error.message))
      .finally(() => setLoading(false));
    return () => {
      alive.current = false;
    };
  }, []);
  function select(item: Media) {
    setSelected(item);
    setName(item.name);
    setAlt(item.alt);
    setMessage('');
    setError('');
  }
  async function add(files: FileList | File[]) {
    if (busy) return;
    setBusy(true);
    setError('');
    let count = 0;
    try {
      for (const file of Array.from(files)) {
        const item = await upload(file);
        count++;
        select(item);
      }
      setMessage(`已上传 ${count} 张图片`);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      await refresh().catch((error) => setError(error.message));
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }
  async function saveDetails() {
    if (!selected) return;
    await api('/media', 'PUT', { id: selected.id, name, alt });
    const updated = { ...selected, name, alt };
    setSelected(updated);
    setItems((items) =>
      items.map((item) => (item.id === selected.id ? updated : item)),
    );
  }
  async function useImage() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await saveDetails();
      const item = await api<Media>('/media/reuse', 'POST', {
        id: selected.id,
      });
      if (onSelect) onSelect({ ...item, name, alt });
      else {
        await navigator.clipboard.writeText(item.url);
        setMessage('图片地址已复制');
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const visible = items.filter((item) =>
    `${item.name} ${item.alt}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div
      className="media-library"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault();
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          void add(event.dataTransfer.files);
        }
      }}
    >
      <div className="media-toolbar">
        <label className="search-input">
          <Icon name="search" />
          <input
            aria-label="搜索图片"
            placeholder="搜索图片名称或描述…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <input
          ref={fileInput}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          multiple
          onChange={(event) => {
            if (event.target.files) void add(event.target.files);
          }}
        />
        <button
          type="button"
          className="admin-primary"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="plus" />
          {busy ? '处理中…' : '上传图片'}
        </button>
      </div>
      <p className="muted small">
        {items.length} 张图片 · 可以把图片拖到这里，单张最大 10 MB
      </p>
      {error && <ErrorMessage message={error} />}
      {message && (
        <p role="status" className="admin-success">
          {message}
        </p>
      )}
      <div className={`media-layout ${selected ? 'has-selection' : ''}`}>
        <div>
          {loading ? (
            <p className="admin-loading">正在载入图片…</p>
          ) : !visible.length ? (
            <Empty title={query ? '没有找到图片' : '把第一张图片放进来'}>
              <p>上传后的图片可以重复用于正文和封面。</p>
            </Empty>
          ) : (
            <div className="media-grid">
              {visible.map((item) => (
                <button
                  type="button"
                  className="media-card"
                  disabled={busy}
                  key={item.id}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => select(item)}
                >
                  <div>
                    <img
                      src={item.url}
                      alt={item.alt || item.name}
                      loading="lazy"
                    />
                  </div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.size ? `${Math.round(item.size / 1024)} KB` : ''}
                    {item.width && ` · ${item.width} × ${item.height}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selected && (
          <aside className="media-inspector">
            <img src={selected.url} alt={alt || name} />
            <h3>图片信息</h3>
            <label>
              图片名称
              <input
                disabled={busy}
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              替代文本
              <textarea
                disabled={busy}
                rows={3}
                value={alt}
                maxLength={1000}
                placeholder="描述画面内容，方便读屏和图片加载失败时阅读"
                onChange={(event) => setAlt(event.target.value)}
              />
            </label>
            <p className="muted small">
              修改描述后，再次插入时使用新描述。文章中已有的图片可在编辑器内单独修改。
            </p>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await saveDetails();
                  setMessage('图片信息已保存');
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              保存图片信息
            </button>
            <button
              type="button"
              className="admin-primary"
              disabled={busy || !name.trim()}
              onClick={() => void useImage()}
            >
              {onSelect ? '使用这张图片' : '复制图片地址'}
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}
