import { useEffect, useState } from 'react';
import { api, dateText, type Post } from './client';
import { Modal, Empty, ErrorMessage } from './ui';
export default function HistoryDialog({
  post,
  onRestore,
  onClose,
}: {
  post: Post;
  onRestore: (post: Post) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<{ version: string; date: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [previous, setPrevious] = useState<Post | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api<{ items: typeof items }>(
      `/history?id=${encodeURIComponent(post.id)}`,
    )
      .then((result) => {
        if (active) setItems(result.items);
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
  }, [post.id]);
  useEffect(() => {
    let active = true;
    setPrevious(null);
    if (selected)
      void api<Post>(
        `/history?id=${encodeURIComponent(post.id)}&version=${encodeURIComponent(selected)}`,
      )
        .then((result) => {
          if (active) setPrevious(result);
        })
        .catch((error) => {
          if (active) setError(error.message);
        });
    return () => {
      active = false;
    };
  }, [selected, post.id]);
  async function restore() {
    if (
      !confirm(
        '恢复这个版本到编辑器？当前版本会保留在历史中，线上页面不会立即改变。',
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      const result = await api<Post>('/restore', 'POST', {
        id: post.id,
        version: selected,
        revision: post.revision,
      });
      onRestore(result);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="文章历史版本" wide onClose={onClose}>
      {error && <ErrorMessage message={error} />}
      {loading ? (
        <p className="admin-loading">正在读取历史…</p>
      ) : !items.length ? (
        <Empty title="还没有历史版本">
          <p>每次保存前都会保留旧版本。</p>
        </Empty>
      ) : (
        <div className="history-layout">
          <nav aria-label="历史版本" className="history-list">
            {items.map((item) => (
              <button
                type="button"
                key={item.version}
                aria-pressed={item.version === selected}
                onClick={() => setSelected(item.version)}
              >
                {dateText(item.date)}
              </button>
            ))}
          </nav>
          <div>
            {previous ? (
              <>
                <div className="admin-section-heading">
                  <div>
                    <h3>{previous.metadata.title}</h3>
                    <p className="muted small">
                      {previous.metadata.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={busy}
                    onClick={() => void restore()}
                  >
                    恢复这个版本
                  </button>
                </div>
                <div className="history-compare">
                  <section>
                    <h4>历史正文</h4>
                    <pre>{previous.body}</pre>
                  </section>
                  <section>
                    <h4>当前正文</h4>
                    <pre>{post.body}</pre>
                  </section>
                </div>
              </>
            ) : (
              <p className="admin-loading">选择一个版本查看内容</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
