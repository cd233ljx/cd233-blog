export type Metadata = {
  slug?: string;
  series?: string;
  order?: number;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags: string[];
  draft: boolean;
  featured: boolean;
  cover?: string;
  coverAlt?: string;
};
export type Post = {
  sourcePath?: string;
  id: string;
  revision: string | null;
  metadata: Metadata;
  body: string;
};
export type Series = {
  id: string;
  title: string;
  description: string;
  revision: string;
};
export type Media = {
  id: string;
  name: string;
  alt: string;
  url: string;
  cover: string;
  size?: number;
  date?: string;
  width?: number;
  height?: number;
};
export type SiteContent = Record<
  string,
  Record<string, string | number | boolean | { label: string; href: string }[]>
>;
export type SiteSettings = { revision: string; content: SiteContent };
export type Publication = {
  state: 'idle' | 'building' | 'success' | 'error';
  message: string;
  log: string;
  finishedAt: string | null;
  release: string;
  known: boolean;
  settingsChanged: boolean;
  seriesChanged: boolean;
  changes: { id: string; title: string; action: string }[];
  live: null | {
    publishedAt: string;
    posts: Record<
      string,
      { revision: string; title: string; visible: boolean }
    >;
  };
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
let writes: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const result = writes.then(task, task);
  writes = result.catch(() => undefined);
  return result;
}
export async function api<T>(
  path: string,
  method = 'GET',
  data?: unknown,
): Promise<T> {
  const request = async () => {
    const response = await fetch(`/admin/api${path}`, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Request': '1' },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && path !== '/login')
        window.dispatchEvent(new Event('admin:session-expired'));
      throw new ApiError(result.error || '请求失败，请重试。', response.status);
    }
    return result as T;
  };
  return method === 'GET' || path === '/site-preview'
    ? request()
    : serialize(request);
}
export async function upload(file: File): Promise<Media> {
  if (file.size > 10 * 1024 * 1024) throw new Error('图片最大 10 MB。');
  return serialize(async () => {
    const response = await fetch(
      `/admin/api/upload?name=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Admin-Request': '1' },
        body: file,
      },
    );
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401)
        window.dispatchEvent(new Event('admin:session-expired'));
      throw new ApiError(result.error || '上传失败。', response.status);
    }
    return result;
  });
}
export const dateText = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('zh-CN', { hour12: false })
    : '尚无记录';
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function status(post: Post, publication?: Publication | null) {
  const live = publication?.live?.posts[post.id];
  if (post.metadata.draft) return live?.visible ? '待下线' : '草稿';
  if (Date.parse(post.metadata.publishedAt) > Date.now()) return '未来日期';
  if (live?.visible && live.revision === post.revision) return '已上线';
  if (live?.visible) return '有未发布修改';
  return '待发布';
}
