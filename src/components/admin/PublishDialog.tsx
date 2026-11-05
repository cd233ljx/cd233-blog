import { useEffect, useState } from 'react';
import { api, type Publication, type Post } from './client';
import { Modal, ErrorMessage } from './ui';
export default function PublishDialog({
  post,
  action = 'publish',
  onConfirm,
  onClose,
}: {
  post?: Post;
  action?: 'publish' | 'unpublish';
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api<Publication>('/publication')
      .then((value) => {
        if (active) setPublication(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const changes =
    publication?.changes.filter((item) => item.id !== post?.id) || [];
  return (
    <Modal
      title={action === 'unpublish' ? '确认下线文章' : '发布前确认'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>本次会重新生成网站，下面这些已保存的修改会一起生效。</p>
      {error && <ErrorMessage message={error} />}
      {!publication && !error && (
        <p className="admin-loading">正在核对待发布内容…</p>
      )}
      {publication && (
        <ul className="change-list">
          {post && (
            <li>
              <span className="status-badge">
                {action === 'unpublish' ? '下线' : '发布'}
              </span>
              <strong>{post.metadata.title}</strong>
            </li>
          )}
          {changes.map((item) => (
            <li key={item.id}>
              <span className="status-badge">{item.action}</span>
              <strong>{item.title}</strong>
            </li>
          ))}
          {publication.settingsChanged && (
            <li>
              <span className="status-badge">更新</span>
              <strong>站点页面与公共内容</strong>
            </li>
          )}
          {publication.seriesChanged && (
            <li>
              <span className="status-badge">更新</span>
              <strong>系列名称与简介</strong>
            </li>
          )}
          {!post &&
            !changes.length &&
            !publication.settingsChanged &&
            !publication.seriesChanged && (
              <li>没有新的内容修改，将重新生成当前网站。</li>
            )}
        </ul>
      )}
      {post &&
        action === 'publish' &&
        Date.parse(post.metadata.publishedAt) > Date.now() && (
          <ErrorMessage message="文章使用未来日期，本次构建仍不会展示。到期后需要再次发布网站。" />
        )}
      <p className="muted small">
        发布成功后才会更新线上版本；构建失败时保留原来的页面。
      </p>
      <div className="modal-actions">
        <button type="button" disabled={busy} onClick={onClose}>
          继续编辑
        </button>
        <button
          type="button"
          className="admin-primary"
          disabled={busy || !publication || publication.state === 'building'}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } catch (error) {
              setError((error as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy
            ? '正在提交…'
            : action === 'unpublish'
              ? '确认下线并更新网站'
              : '确认发布网站'}
        </button>
      </div>
    </Modal>
  );
}
