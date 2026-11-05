import type { Post } from '../components/admin/client';
let connection: Promise<IDBDatabase> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let tabId: string | undefined;
function key(id: string) {
  // Preserve the previous per-tab isolation without writing document text to
  // synchronous Web Storage. Reloading this tab retains its recovery drafts.
  if (!tabId) {
    tabId = sessionStorage.getItem('admin-draft-tab') || crypto.randomUUID();
    sessionStorage.setItem('admin-draft-tab', tabId);
  }
  return `${tabId}:${id}`;
}
function database() {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('blog-editor-drafts', 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('drafts');
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
    });
  return connection;
}
function transaction<T>(work: (store: IDBObjectStore) => IDBRequest<T>) {
  const operation = queue.then(async () => {
    const db = await database();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite');
      const request = work(tx.objectStore('drafts'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || new Error('本地草稿保存失败'));
      tx.onerror = () => reject(tx.error);
    });
  });
  queue = operation.catch(() => {});
  return operation;
}
export const drafts = {
  async get(id: string): Promise<Post | null> {
    const value = (await transaction((store) => store.get(key(id)))) as
      Post | undefined;
    if (value) return value;
    // Migrate existing recovery data once; delete it only after IndexedDB commits.
    const legacy = sessionStorage.getItem(id);
    if (!legacy) return null;
    const post = JSON.parse(legacy) as Post;
    await drafts.set(id, post);
    sessionStorage.removeItem(id);
    return post;
  },
  set(id: string, post: Post) {
    return transaction((store) => store.put(post, key(id)));
  },
  async remove(id: string) {
    await transaction((store) => store.delete(key(id)));
    sessionStorage.removeItem(id);
  },
  async move(from: string, to: string) {
    // Enqueue both mutations in one transaction so later edits cannot overtake it.
    return transaction((store) => {
      const request = store.get(key(from));
      request.onsuccess = () => {
        if (request.result) store.put(request.result, key(to));
        store.delete(key(from));
      };
      return request;
    });
  },
};
