import { memo, useEffect, useRef, useState } from 'react';
import LivePreview from './LivePreview';
import 'katex/dist/katex.min.css';

type Result = {
  id: number;
  blocks: string[];
  components: boolean;
  savedComponents: boolean;
  savedComponentSource: string;
  incomplete: boolean;
  error?: string;
};
const Block = memo(function Block({ html }: { html: string }) {
  return (
    <div
      className="local-preview-block"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

export default function LocalPreview({
  body,
  savedBody,
  path,
  dark,
  active = true,
}: {
  body: string;
  savedBody: string;
  path: string;
  dark: boolean;
  active?: boolean;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const latest = useRef({ body, savedBody, active, id: 0 });
  const busy = useRef(false);
  const send = useRef<() => void>(() => {});
  useEffect(() => {
    const instance = new Worker(
      new URL('../../lib/local-preview.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.current = instance;
    send.current = () => {
      if (busy.current || !latest.current.active) return;
      busy.current = true;
      instance.postMessage(latest.current);
    };
    instance.onmessage = (event: MessageEvent<Result>) => {
      busy.current = false;
      if (event.data.id !== latest.current.id) {
        send.current();
        return;
      }
      if (event.data.error) setError(event.data.error);
      else {
        setError('');
        setResult(event.data);
      }
    };
    instance.onerror = () => {
      busy.current = false;
      setError('本地预览未能启动，请刷新页面重试。');
    };
    send.current();
    return () => {
      instance.terminate();
      worker.current = null;
      busy.current = false;
      send.current = () => {};
    };
  }, []);
  useEffect(() => {
    latest.current = { body, savedBody, active, id: latest.current.id + 1 };
    // Coalesce rapid edits; only one render plus the newest pending input is kept.
    const timer = setTimeout(() => send.current(), 80);
    return () => clearTimeout(timer);
  }, [body, savedBody, active]);
  return (
    <div className="local-preview">
      {error && (
        <p role="status" className="editor-note">
          {error}
        </p>
      )}
      <div className="prose article-prose local-preview-prose">
        {result?.blocks.map((html, index) => (
          <Block key={index} html={html} />
        ))}
      </div>
      {result?.incomplete && (
        <p className="muted small">
          当前按普通 Markdown 预览；未完成的组件语法会在写完后更新。
        </p>
      )}
      {(result?.components || result?.savedComponents) && (
        <section className="local-preview-components" aria-label="交互演示">
          <p className="muted small">交互演示 · 同步后更新</p>
          {result.savedComponents ? (
            <LivePreview
              path={`${path}?components=1`}
              dark={dark}
              refreshKey={result.savedComponentSource}
            />
          ) : (
            <p className="muted">首次同步后显示演示。</p>
          )}
        </section>
      )}
    </div>
  );
}
