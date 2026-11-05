import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
} from 'react';
import { BookOpen, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { api, dateText, status, type Post, type Publication } from './client';
import { Icon, Modal, Empty, ErrorMessage } from './ui';
import ArticleEditor from './ArticleEditor';
import SiteEditor from './SiteEditor';
import MediaLibrary from './MediaLibrary';
import SeriesManager from './SeriesManager';
import PublishDialog from './PublishDialog';

type View =
  'series' | 'posts' | 'editor' | 'media' | 'settings' | 'publication';
function Login({
  onLogin,
  siteName,
  expired = false,
}: {
  onLogin: () => void;
  siteName: string;
  expired?: boolean;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/login', 'POST', { password });
      setPassword('');
      onLogin();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={expired ? 'login-inline' : 'admin-login'}>
      <a className="login-brand" href="/">
        {siteName}
        <span> / 写作空间</span>
      </a>
      <div className="login-panel">
        <span className="admin-eyebrow">WELCOME BACK</span>
        <h1>{expired ? '继续你的写作。' : '写下你的下一次折腾。'}</h1>
        <p>
          {expired
            ? '登录已过期。重新登录后，继续编辑当前内容。'
            : '文章、图片和你自己的小天地。'}
        </p>
        <form onSubmit={submit}>
          <label htmlFor="admin-password">密码</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            autoFocus={expired}
            required
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入后台密码"
          />
          {error && <ErrorMessage message={error} />}
          <button className="admin-primary" disabled={busy} type="submit">
            {busy ? '正在登录…' : '进入写作空间'}
          </button>
        </form>
      </div>
      {!expired && (
        <a href="/" className="muted small">
          回到博客
        </a>
      )}
    </div>
  );
}
export default function AdminApp({ siteName }: { siteName: string }) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [expired, setExpired] = useState(false);
  const [view, setView] = useState<View>('posts');
  const [editorReturn, setEditorReturn] = useState<View>('posts');
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [sidebarPreference, setSidebarPreference] = useState<boolean | null>(
    () => {
      try {
        const value = localStorage.getItem('admin:sidebar:v1');
        return value === 'collapsed'
          ? true
          : value === 'expanded'
            ? false
            : null;
      } catch {
        return null;
      }
    },
  );
  const [compactViewport, setCompactViewport] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 950px)').matches,
  );
  const sidebarCollapsed =
    sidebarPreference ?? (view === 'editor' || compactViewport);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selected, setSelected] = useState<Post | undefined>();
  const [editorKey, setEditorKey] = useState(0);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dark, setDark] = useState(() => {
    try {
      return (
        localStorage.getItem('cd233-theme') === 'dark' ||
        (!localStorage.getItem('cd233-theme') &&
          matchMedia('(prefers-color-scheme: dark)').matches)
      );
    } catch {
      return false;
    }
  });
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('date');
  const [publishDialog, setPublishDialog] = useState(false);
  const dirty = useRef(false);
  const notify = useCallback((message: string) => setNotice(message), []);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [list, state] = await Promise.all([
        api<{ posts: Post[] }>('/posts'),
        api<Publication>('/publication'),
      ]);
      setPosts(list.posts);
      setPublication(state);
      setError('');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void api('/session')
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false));
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 950px)');
    const update = () => setCompactViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function toggleSidebar() {
    const collapsed = !sidebarCollapsed;
    setSidebarPreference(collapsed);
    try {
      localStorage.setItem(
        'admin:sidebar:v1',
        collapsed ? 'collapsed' : 'expanded',
      );
    } catch {
      /* Keep the current choice even when preference storage is unavailable. */
    }
  }
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('cd233-theme', dark ? 'dark' : 'light');
    } catch {
      /* Theme still works without storage. */
    }
  }, [dark]);
  useEffect(() => {
    if (authenticated) void refresh();
  }, [authenticated, refresh]);
  useEffect(() => {
    const sessionExpired = () => {
      if (authenticated) setExpired(true);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    window.addEventListener('admin:session-expired', sessionExpired);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('admin:session-expired', sessionExpired);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [authenticated]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!authenticated || expired) return;
    let active = true;
    const check = () => {
      if (document.hidden) return;
      void api<Publication>('/publication')
        .then((state) => {
          if (!active) return;
          if (publication?.state === 'building' && state.state !== 'building') {
            notify(state.message);
            void refresh();
          }
          setPublication(state);
        })
        .catch(() => {});
    };
    const timer =
      publication?.state === 'building' ? setInterval(check, 1500) : undefined;
    window.addEventListener('focus', check);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, [authenticated, expired, publication?.state, refresh, notify]);
  function canLeave() {
    return (
      !dirty.current || confirm('还有内容尚未保存。确定离开当前编辑页吗？')
    );
  }
  function navigate(next: View, post?: Post) {
    if (!canLeave()) return;
    dirty.current = false;
    if (next === 'editor')
      setEditorReturn(view === 'series' ? 'series' : 'posts');
    setView(next);
    setSelected(post);
    setError('');
    if (next === 'editor') setEditorKey((value) => value + 1);
    if (next === 'posts' || next === 'publication') void refresh();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function logout() {
    if (!canLeave()) return;
    try {
      await api('/logout', 'POST');
      dirty.current = false;
      setAuthenticated(false);
      setView('posts');
    } catch (error) {
      notify((error as Error).message);
    }
  }
  const onSaved = useCallback((post: Post) => {
    setPosts((posts) => [post, ...posts.filter((item) => item.id !== post.id)]);
    void api<Publication>('/publication')
      .then(setPublication)
      .catch(() => undefined);
  }, []);
  const draftCount = posts.filter((post) => post.metadata.draft).length;
  const changeCount =
    (publication?.changes.length || 0) +
    (publication?.settingsChanged ? 1 : 0) +
    (publication?.seriesChanged ? 1 : 0);
  const filtered = posts
    .filter((post) => {
      const live = publication?.live?.posts[post.id];
      const matches =
        filter === 'all' ||
        (filter === 'drafts' && post.metadata.draft) ||
        (filter === 'published' && live?.visible) ||
        (filter === 'pending' &&
          !post.metadata.draft &&
          (!live?.visible || live.revision !== post.revision));
      return (
        matches &&
        `${post.metadata.title} ${post.metadata.description} ${post.metadata.tags?.join(' ')} ${post.id}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    })
    .sort((a, b) =>
      sort === 'title'
        ? a.metadata.title.localeCompare(b.metadata.title, 'zh-CN')
        : b.metadata.publishedAt.localeCompare(a.metadata.publishedAt),
    );
  if (authenticated === null)
    return <p className="admin-loading">正在打开写作空间…</p>;
  if (!authenticated)
    return <Login siteName={siteName} onLogin={() => setAuthenticated(true)} />;
  return (
    <div className={`admin-app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="admin-sidebar">
        <div className="sidebar-heading">
          <a className="sidebar-brand" href="/" target="_blank" rel="noopener">
            <span>
              {siteName}
              <small>写作空间</small>
            </span>
          </a>
          <button
            type="button"
            className="icon-button sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="admin-navigation"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen size={19} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={19} aria-hidden="true" />
            )}
          </button>
        </div>
        <button
          type="button"
          className="admin-primary new-post-button"
          aria-label="写文章"
          title="写文章"
          onClick={() => navigate('editor')}
        >
          <Icon name="plus" />
          <span>写文章</span>
        </button>
        <nav id="admin-navigation" aria-label="后台导航">
          {(
            [
              {
                key: 'posts',
                name: '文章',
                icon: 'posts',
                count: posts.length,
              },
              { key: 'series', name: '系列', icon: 'posts' },
              { key: 'media', name: '媒体库', icon: 'media' },
              { key: 'settings', name: '页面与站点', icon: 'settings' },
              {
                key: 'publication',
                name: '发布中心',
                icon: 'publish',
                count: changeCount,
              },
            ] as const
          ).map((item) => (
            <button
              type="button"
              key={item.key}
              aria-label={item.name}
              title={item.name}
              aria-current={
                view === item.key ||
                (item.key === editorReturn && view === 'editor')
                  ? 'page'
                  : undefined
              }
              onClick={() => navigate(item.key)}
            >
              {item.key === 'series' ? (
                <BookOpen size={18} aria-hidden="true" />
              ) : (
                <Icon name={item.icon} />
              )}
              <span>{item.name}</span>
              {'count' in item && <small>{item.count}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            aria-label="查看博客"
            title="查看博客"
          >
            <Icon name="eye" />
            <span>查看博客</span>
          </a>
          <button
            type="button"
            onClick={() => setDark(!dark)}
            aria-label={dark ? '切换浅色外观' : '切换深色外观'}
            title={dark ? '浅色外观' : '深色外观'}
          >
            <Icon name="moon" />
            <span>{dark ? '浅色外观' : '深色外观'}</span>
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="退出登录"
            title="退出登录"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="mobile-controls">
          <a href="/" target="_blank" rel="noopener">
            {siteName}
          </a>
          <div>
            <button
              type="button"
              aria-label={dark ? '切换浅色主题' : '切换深色主题'}
              onClick={() => setDark(!dark)}
            >
              <Icon name="moon" size={16} />
            </button>
            <button type="button" onClick={() => void logout()}>
              退出
            </button>
          </div>
        </header>
        {publication?.state === 'building' && (
          <div className="publication-banner" role="status">
            <span className="loading-dot" />
            <span>网站发布中，完成后会自动切换到新版本。</span>
            <button type="button" onClick={() => navigate('publication')}>
              查看进度
            </button>
          </div>
        )}
        {publication?.state === 'error' && (
          <div className="publication-banner is-error" role="alert">
            <span>上次发布失败，线上保留原版本。</span>
            <button type="button" onClick={() => navigate('publication')}>
              查看原因
            </button>
          </div>
        )}
        {error && (
          <div className="page-error">
            <ErrorMessage message={error} />
            <button type="button" onClick={() => void refresh()}>
              重新加载
            </button>
          </div>
        )}
        {view === 'posts' && (
          <section className="admin-page">
            <div className="admin-page-heading">
              <div>
                <span className="admin-eyebrow">你的文字，慢慢积累</span>
                <h1>文章</h1>
                <p>
                  {posts.length} 篇文章，{draftCount} 篇还在酝酿。
                </p>
              </div>
              <button
                type="button"
                className="admin-primary"
                onClick={() => navigate('editor')}
              >
                <Icon name="plus" />
                新文章
              </button>
            </div>
            <div className="post-list-toolbar">
              <div className="filter-tabs">
                {[
                  ['all', '全部文章'],
                  ['drafts', '草稿'],
                  ['published', '已上线'],
                  ['pending', '待发布'],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="search-input">
                <Icon name="search" />
                <input
                  aria-label="搜索文章"
                  placeholder="搜索标题、标签…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>
            <div className="post-list-caption">
              <span>{filtered.length} 篇文章</span>
              <label>
                排序{' '}
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="date">最新日期</option>
                  <option value="title">标题</option>
                </select>
              </label>
            </div>
            {loading ? (
              <p className="admin-loading">正在读取文章…</p>
            ) : filtered.length ? (
              <div className="article-list">
                {filtered.map((post) => (
                  <button
                    type="button"
                    key={post.id}
                    className="article-row"
                    onClick={() => navigate('editor', post)}
                  >
                    <div className="article-row-icon">
                      <Icon name="posts" size={24} />
                    </div>
                    <div className="article-row-copy">
                      <strong>
                        {post.metadata.title}
                        {post.metadata.featured && (
                          <span className="featured-label">置顶</span>
                        )}
                      </strong>
                      <p>{post.metadata.description}</p>
                      <div>
                        {post.metadata.tags?.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className="article-row-meta">
                      <span
                        className={`status-badge ${status(post, publication) === '已上线' ? 'is-live' : ''}`}
                      >
                        {status(post, publication)}
                      </span>
                      <time>{post.metadata.publishedAt}</time>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title={
                  query || filter !== 'all'
                    ? '这里还没有匹配的文章'
                    : '写下第一篇文章'
                }
              >
                <p>
                  {query
                    ? '试试其他关键词。'
                    : '不用急着写完，先把想法保存成草稿。'}
                </p>
                <button type="button" onClick={() => navigate('editor')}>
                  开始写作
                </button>
              </Empty>
            )}
          </section>
        )}
        {view === 'series' && (
          <SeriesManager
            initialSelectedId={selectedSeriesId}
            onSelect={setSelectedSeriesId}
            onOpen={(post) => navigate('editor', post)}
            onDirty={onDirty}
            onSaved={() => void refresh()}
            publication={publication}
            notify={notify}
          />
        )}
        {view === 'editor' && (
          <ArticleEditor
            key={editorKey}
            initialPost={selected}
            dark={dark}
            publication={publication}
            onSaved={onSaved}
            onDirty={onDirty}
            onBack={() => navigate(editorReturn)}
            backLabel={editorReturn === 'series' ? '系列' : '文章'}
            onPublication={() => void refresh()}
            notify={notify}
          />
        )}
        {view === 'media' && (
          <section className="admin-page">
            <div className="admin-page-heading">
              <div>
                <span className="admin-eyebrow">保存那些画面</span>
                <h1>媒体库</h1>
                <p>上传一次，在文章和页面里随时使用。</p>
              </div>
            </div>
            <MediaLibrary />
          </section>
        )}
        {view === 'settings' && (
          <SiteEditor
            dark={dark}
            onDirty={onDirty}
            onSaved={() => void refresh()}
            notify={notify}
            blocked={publication?.state === 'building'}
          />
        )}
        {view === 'publication' && (
          <section className="admin-page publication-page">
            <div className="admin-page-heading">
              <div>
                <span className="admin-eyebrow">准备好了，再让大家看到</span>
                <h1>发布中心</h1>
                <p>保存用于继续编辑，发布才会更新网站。</p>
              </div>
              <button
                type="button"
                className="admin-primary"
                disabled={!publication || publication.state === 'building'}
                onClick={() => setPublishDialog(true)}
              >
                <Icon name="publish" />
                发布网站
              </button>
            </div>
            <div className="publication-overview">
              <div>
                <span className="status-badge is-live">当前线上版本</span>
                <h2>{publication?.release || '初始版本'}</h2>
                <p>
                  {publication?.live
                    ? dateText(publication.live.publishedAt)
                    : '发布后开始记录版本信息'}
                </p>
              </div>
              <div>
                <strong>{changeCount}</strong>
                <span>项内容等待发布</span>
              </div>
            </div>
            <section className="publication-card">
              <h2>待发布的变更</h2>
              {!publication ? (
                <p>正在载入…</p>
              ) : changeCount ? (
                <ul className="change-list">
                  {publication.changes.map((item) => (
                    <li key={item.id}>
                      <span className="status-badge">{item.action}</span>
                      <strong>{item.title}</strong>
                      {posts.some((post) => post.id === item.id) && (
                        <button
                          type="button"
                          className="quiet-button"
                          onClick={() =>
                            navigate(
                              'editor',
                              posts.find((post) => post.id === item.id),
                            )
                          }
                        >
                          编辑
                        </button>
                      )}
                    </li>
                  ))}
                  {publication.settingsChanged && (
                    <li>
                      <span className="status-badge">更新</span>
                      <strong>站点页面与公共内容</strong>
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={() => navigate('settings')}
                      >
                        编辑
                      </button>
                    </li>
                  )}
                  {publication.seriesChanged && (
                    <li>
                      <span className="status-badge">更新</span>
                      <strong>系列名称与简介</strong>
                      <button
                        type="button"
                        className="quiet-button"
                        onClick={() => navigate('series')}
                      >
                        编辑
                      </button>
                    </li>
                  )}
                </ul>
              ) : (
                <p className="muted">已保存的公开内容与线上一致。</p>
              )}
              <p className="muted small">
                草稿不会出现在网站中。未来日期文章需在到期后再次发布。
              </p>
            </section>
            <section className="publication-card">
              <h2>发布状态</h2>
              <p role="status">{publication?.message}</p>
              {publication?.finishedAt && (
                <p className="muted small">
                  {dateText(publication.finishedAt)}
                </p>
              )}
              {publication?.log && (
                <details open={publication.state === 'error'}>
                  <summary>构建日志</summary>
                  <pre className="build-log">{publication.log}</pre>
                </details>
              )}
            </section>
          </section>
        )}
      </div>
      {notice && (
        <div className="admin-toast" role="status">
          {notice}
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => setNotice('')}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {publishDialog && (
        <PublishDialog
          onClose={() => setPublishDialog(false)}
          onConfirm={async () => {
            await api('/publish', 'POST');
            setPublishDialog(false);
            void refresh();
            notify('网站发布已开始。');
          }}
        />
      )}
      {expired && (
        <Modal title="重新登录" dismissible={false} onClose={() => undefined}>
          <Login
            siteName={siteName}
            expired
            onLogin={() => {
              setExpired(false);
              void refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
