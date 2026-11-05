import { useState } from 'react';
import { Modal } from './ui';
import LivePreview from './LivePreview';
import LocalPreview from './LocalPreview';

export default function PreviewDialog({
  path = '/',
  dark = false,
  body,
  savedBody = '',
  onClose,
}: {
  path?: string;
  dark?: boolean;
  body?: string;
  savedBody?: string;
  onClose: () => void;
}) {
  const [mobile, setMobile] = useState(false);
  return (
    <Modal title="实时预览" wide onClose={onClose}>
      <div className="preview-toolbar">
        <p className="muted small">正文即时预览，交互演示在同步后更新。</p>
        <div className="segmented">
          <button
            type="button"
            aria-pressed={!mobile}
            onClick={() => setMobile(false)}
          >
            桌面
          </button>
          <button
            type="button"
            aria-pressed={mobile}
            onClick={() => setMobile(true)}
          >
            手机
          </button>
        </div>
      </div>
      <div className={`preview-stage ${mobile ? 'is-mobile' : ''}`}>
        {body === undefined ? (
          <LivePreview path={path} dark={dark} />
        ) : (
          <LocalPreview
            body={body}
            savedBody={savedBody}
            path={path}
            dark={dark}
          />
        )}
      </div>
    </Modal>
  );
}
