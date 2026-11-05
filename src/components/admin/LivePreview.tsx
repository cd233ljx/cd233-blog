import { memo, useEffect, useState } from 'react';
import { api } from './client';
import { ErrorMessage } from './ui';

function LivePreview({
  path,
  dark = false,
  refreshKey = '',
}: {
  path: string;
  dark?: boolean;
  refreshKey?: string;
}) {
  const [base, setBase] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    void api<{ base: string }>('/site-preview', 'POST')
      .then((result) => {
        if (active) setBase(result.base);
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  return (
    <div className="live-preview">
      {error ? (
        <div role="alert">
          <ErrorMessage message={error} />
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>
            重连预览
          </button>
        </div>
      ) : base ? (
        <iframe
          key={`${attempt}:${refreshKey}`}
          title="笔记实时预览"
          src={`${base}${path.replace(/^\//, '')}${path.includes('?') ? '&' : '?'}theme=${dark ? 'dark' : 'light'}`}
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <p className="admin-loading" role="status">
          正在连接实时预览…首次打开需要准备组件。
        </p>
      )}
    </div>
  );
}

export default memo(LivePreview);
