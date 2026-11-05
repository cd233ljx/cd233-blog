import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import schema from '../../config/settings-schema.json';
import { api, type SiteSettings, type SiteContent, type Media } from './client';
import { Icon, Modal, ErrorMessage, type Notify } from './ui';
import MediaLibrary from './MediaLibrary';
import PreviewDialog from './PreviewDialog';
const RichEditor = lazy(() => import('./RichEditor'));
const pagePaths: Record<string, string> = {
  identity: '/',
  home: '/',
  about: '/about/',
  navigation: '/',
  footer: '/',
  posts: '/posts/',
  archive: '/archive/',
  tags: '/tags/',
  search: '/search/',
  article: '/posts/',
  notFound: '/404.html',
};
export default function SiteEditor({
  dark,
  onDirty,
  onSaved,
  notify,
  blocked,
}: {
  dark: boolean;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
  notify: Notify;
  blocked: boolean;
}) {
  const [data, setData] = useState<SiteSettings | null>(null);
  const [groupKey, setGroupKey] = useState('home');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const group = schema.find((group) => group.key === groupKey)!;
  useEffect(() => {
    let active = true;
    void api<SiteSettings>('/settings')
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      onDirty(false);
    };
  }, []);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  function change(key: string, value: SiteContent[string][string]) {
    setData(
      (data) =>
        data && {
          ...data,
          content: {
            ...data.content,
            [groupKey]: { ...data.content[groupKey], [key]: value },
          },
        },
    );
    setDirty(true);
  }
  async function save() {
    if (!data || busy || blocked) return false;
    if (!form.current?.reportValidity()) return false;
    setBusy(true);
    setError('');
    try {
      const result = await api<SiteSettings>('/settings', 'PUT', data);
      setData(result);
      setDirty(false);
      onSaved();
      notify('页面内容已保存，发布网站后生效。');
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  return (
    <section className="site-editor">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">让这里更像你</span>
          <h1>页面与站点</h1>
          <p>从首页介绍到页脚，每一处内容都在这里。</p>
        </div>
        <div className="admin-actions">
          <span className="small muted" role="status">
            {dirty ? '有未保存的修改' : '已保存'}
          </span>
          <button
            type="button"
            disabled={!data || busy || blocked}
            onClick={async () => {
              if (!dirty || (await save())) setPreview(true);
            }}
          >
            <Icon name="eye" />
            预览页面
          </button>
          <button
            type="button"
            className="admin-primary"
            disabled={!data || busy || blocked}
            onClick={() => void save()}
          >
            {busy ? '保存中…' : '保存内容'}
          </button>
        </div>
      </div>
      {error && <ErrorMessage message={error} />}
      <div className="site-editor-layout">
        <nav className="site-section-nav" aria-label="站点内容分区">
          {schema.map((section) => (
            <button
              type="button"
              key={section.key}
              aria-current={groupKey === section.key ? 'page' : undefined}
              onClick={() => {
                setGroupKey(section.key);
                setError('');
              }}
            >
              {section.label}
            </button>
          ))}
        </nav>
        {!data ? (
          <p className="admin-loading">正在载入页面内容…</p>
        ) : (
          <form
            ref={form}
            className="site-fields"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <header>
              <h2>{group.label}</h2>
              <p>{group.description}</p>
            </header>
            <fieldset disabled={busy || blocked}>
              {group.fields.map((field) => {
                const value = data.content[groupKey][field.key];
                const id = `site-${groupKey}-${field.key}`;
                const required = 'required' in field && field.required;
                return (
                  <div
                    className={`site-field ${field.type === 'boolean' ? 'site-field-toggle' : ''}`}
                    key={id}
                  >
                    <label htmlFor={id}>{field.label}</label>
                    {field.type === 'boolean' ? (
                      <input
                        id={id}
                        type="checkbox"
                        role="switch"
                        checked={Boolean(value)}
                        onChange={(event) =>
                          change(field.key, event.target.checked)
                        }
                      />
                    ) : field.type === 'markdown' ? (
                      <Suspense
                        fallback={
                          <p className="admin-loading">正在载入编辑器…</p>
                        }
                      >
                        <RichEditor
                          key={id}
                          value={String(value)}
                          onChange={(value) => change(field.key, value)}
                          dark={dark}
                          mdx={false}
                          disabled={busy || blocked}
                        />
                      </Suspense>
                    ) : field.type === 'links' ? (
                      <div className="link-editor">
                        {(value as { label: string; href: string }[]).map(
                          (link, index, links) => (
                            <div className="link-row" key={index}>
                              <span className="link-index">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <label>
                                文字
                                <input
                                  required
                                  aria-label={`第 ${index + 1} 个链接文字`}
                                  maxLength={80}
                                  value={link.label}
                                  onChange={(event) =>
                                    change(
                                      field.key,
                                      links.map((item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              label: event.target.value,
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <label>
                                地址
                                <input
                                  required
                                  aria-label={`第 ${index + 1} 个链接地址`}
                                  value={link.href}
                                  onChange={(event) =>
                                    change(
                                      field.key,
                                      links.map((item, i) =>
                                        i === index
                                          ? {
                                              ...item,
                                              href: event.target.value,
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <div className="link-row-actions">
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  aria-label="上移链接"
                                  onClick={() => {
                                    const next = [...links];
                                    [next[index - 1], next[index]] = [
                                      next[index],
                                      next[index - 1],
                                    ];
                                    change(field.key, next);
                                  }}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={index === links.length - 1}
                                  aria-label="下移链接"
                                  onClick={() => {
                                    const next = [...links];
                                    [next[index + 1], next[index]] = [
                                      next[index],
                                      next[index + 1],
                                    ];
                                    change(field.key, next);
                                  }}
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  className="danger-button"
                                  aria-label="删除链接"
                                  onClick={() =>
                                    change(
                                      field.key,
                                      links.filter((_, i) => i !== index),
                                    )
                                  }
                                >
                                  <Icon name="close" size={14} />
                                </button>
                              </div>
                            </div>
                          ),
                        )}
                        <button
                          type="button"
                          disabled={(value as unknown[]).length >= 20}
                          onClick={() =>
                            change(field.key, [
                              ...(value as { label: string; href: string }[]),
                              { label: '', href: '/' },
                            ])
                          }
                        >
                          <Icon name="plus" />
                          添加链接
                        </button>
                      </div>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        id={id}
                        rows={3}
                        maxLength={2000}
                        required={required}
                        value={String(value)}
                        onChange={(event) =>
                          change(field.key, event.target.value)
                        }
                      />
                    ) : (
                      <>
                        <input
                          id={id}
                          type={
                            field.type === 'number'
                              ? 'number'
                              : field.type === 'email'
                                ? 'email'
                                : 'text'
                          }
                          required={required}
                          min={'min' in field ? field.min : undefined}
                          max={'max' in field ? field.max : undefined}
                          maxLength={2000}
                          value={String(value)}
                          onChange={(event) =>
                            change(
                              field.key,
                              field.type === 'number'
                                ? Number(event.target.value)
                                : event.target.value,
                            )
                          }
                        />
                        {field.type === 'image' && (
                          <div className="image-field">
                            {value && (
                              <img src={String(value)} alt={field.label} />
                            )}
                            <button
                              type="button"
                              onClick={() => setPicker(field.key)}
                            >
                              <Icon name="media" />
                              从媒体库选择
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <p className="settings-footnote">
              数字、日期等动态信息由网站生成。含 {'{count}'}、{'{year}'}{' '}
              等占位符的文字，请保留需要显示的占位符。
            </p>
          </form>
        )}
      </div>
      {picker && (
        <Modal title="选择图片" wide onClose={() => setPicker(null)}>
          <MediaLibrary
            onSelect={(item: Media) => {
              change(picker, item.url);
              setPicker(null);
            }}
          />
        </Modal>
      )}
      {preview && (
        <PreviewDialog
          path={pagePaths[groupKey]}
          onClose={() => setPreview(false)}
        />
      )}
    </section>
  );
}
