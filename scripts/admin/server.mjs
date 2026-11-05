import { createSeriesStore } from './series.mjs';
import http from 'node:http';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {
  cp,
  mkdir,
  readFile,
  writeFile,
  rename,
  access,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import sirv from 'sirv';
import { renderMarkdown as renderPreview } from '../../src/lib/markdown.mjs';
export { renderMarkdown as renderPreview } from '../../src/lib/markdown.mjs';
import { createMediaStore } from './media.mjs';
import { createPublicationStore } from './publication.mjs';
import { createPreviewService, previewBase } from './preview.mjs';
import { createSettingsStore } from './settings.mjs';
import { createContentStore, HttpError } from './content.mjs';

function run(root, command, args, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let timer = setTimeout(() => child.kill('SIGTERM'), 180000);
    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(`构建进程退出（${code}）`));
    });
  });
}
export async function createAdminServer({
  root,
  dataDir = path.join(root, '.admin-data'),
  origin,
  passwordHash,
  secure = true,
}) {
  if (
    !origin ||
    !passwordHash ||
    !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)
  )
    throw new Error('请配置 ADMIN_ORIGIN 和 ADMIN_PASSWORD_HASH。');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const store = createContentStore(root, dataDir);
  await store.recoverSeries();
  const series = createSeriesStore(root, dataDir, store);
  const settings = createSettingsStore(root, dataDir);
  const media = createMediaStore(root, dataDir);
  const releases = createPublicationStore(dataDir, store, settings, series);
  const previews = createPreviewService(root);
  const sessions = new Map();
  const attempts = [];
  let mutating = false;
  let publication = {
    state: 'idle',
    message: '尚未从后台发布',
    log: '',
    finishedAt: null,
  };
  let directory = path.join(root, 'dist');
  let activeRelease = '';
  try {
    const release = (
      await readFile(path.join(dataDir, 'current'), 'utf8')
    ).trim();
    if (/^release-[0-9]+$/.test(release)) {
      const candidate = path.join(dataDir, release);
      await access(path.join(candidate, 'index.html'));
      directory = candidate;
      activeRelease = release;
      publication.message = '网站运行中；保存修改后可发布更新。';
    }
  } catch {
    /* 首次启动使用已验证的 dist */
  }
  let staticFiles = sirv(directory, { etag: true, dev: true });
  const uploadedFiles = sirv(path.join(root, 'public'), { dev: true });
  async function publish() {
    publication = {
      state: 'building',
      message: '正在构建页面和搜索索引…',
      log: '',
      finishedAt: null,
    };
    const release = `release-${Date.now()}`;
    const target = path.join(dataDir, release);
    const output = (chunk) => {
      publication.log = (publication.log + chunk.toString()).slice(-16000);
    };
    try {
      const manifest = await releases.snapshot();
      await run(
        root,
        process.execPath,
        ['node_modules/astro/bin/astro.mjs', 'check'],
        output,
      );
      await run(
        root,
        process.execPath,
        ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', target],
        output,
      );
      await run(
        root,
        path.join(root, 'node_modules/.bin/pagefind'),
        ['--site', target],
        output,
      );
      await access(path.join(target, 'index.html'));
      try {
        await cp(path.join(directory, '_astro'), path.join(target, '_astro'), {
          recursive: true,
          force: false,
          errorOnExist: false,
        });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await releases.write(release, manifest);
      await writeFile(path.join(dataDir, 'current.tmp'), release, {
        mode: 0o600,
      });
      await rename(
        path.join(dataDir, 'current.tmp'),
        path.join(dataDir, 'current'),
      );
      directory = target;
      activeRelease = release;
      staticFiles = sirv(target, { etag: true, dev: true });
      publication.state = 'success';
      publication.message = '发布成功，网站和搜索已更新。';
    } catch (error) {
      publication.state = 'error';
      publication.message = '发布失败，线上仍保留原版本。请查看构建日志。';
      output(`\n${error.message}`);
    } finally {
      publication.finishedAt = new Date().toISOString();
    }
  }
  function json(res, status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
    });
    res.end(JSON.stringify(data));
  }
  async function body(req, limit = 1200000) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, '上传内容过大。');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  async function jsonBody(req) {
    try {
      return JSON.parse((await body(req)).toString('utf8'));
    } catch (error) {
      if (error.status) throw error;
      throw new HttpError(400, '请求内容格式有误。');
    }
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url, 'http://localhost');
    const cookie = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('blog_admin='))
      ?.slice(11);
    const now = Date.now();
    for (const [token, expiry] of sessions)
      if (expiry <= now) sessions.delete(token);
    const authenticated = cookie && sessions.has(cookie);
    const admin =
      url.pathname === '/admin' || url.pathname.startsWith('/admin/');
    if (admin) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Referrer-Policy', 'same-origin');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
    }
    if (url.pathname.startsWith(previewBase)) {
      try {
        if (!authenticated) throw new HttpError(401, '请先登录后台。');
        if (!['GET', 'HEAD'].includes(req.method))
          throw new HttpError(405, '不支持的请求方法。');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' https:; frame-src https://www.youtube-nocookie.com https://player.bilibili.com; object-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        );
        return previews.proxy(req, res);
      } catch (error) {
        return json(res, error.status || 502, { error: error.message });
      }
    }
    if (!url.pathname.startsWith('/admin/api/')) {
      if (!['GET', 'HEAD'].includes(req.method))
        return json(res, 405, { error: '不支持的请求方法。' });
      if (url.pathname.startsWith('/uploads/'))
        return uploadedFiles(req, res, () =>
          json(res, 404, { error: '图片不存在。' }),
        );
      return staticFiles(req, res, async () => {
        res.statusCode = 404;
        try {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(await readFile(path.join(directory, '404.html')));
        } catch {
          res.end('Not found');
        }
      });
    }
    try {
      const route = url.pathname.slice('/admin/api'.length);
      if (
        req.method !== 'GET' &&
        (req.headers.origin !== origin ||
          req.headers['x-admin-request'] !== '1')
      )
        throw new HttpError(403, '请求来源校验失败，请从后台页面操作。');
      const cookieValue = (token, age) =>
        `blog_admin=${token}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${age}${secure ? '; Secure' : ''}`;
      if (route === '/login' && req.method === 'POST') {
        while (attempts.length && attempts[0] < now - 15 * 60 * 1000)
          attempts.shift();
        if (attempts.length >= 20) {
          res.setHeader('Retry-After', '900');
          throw new HttpError(429, '尝试次数过多，请 15 分钟后重试。');
        }
        const input = await jsonBody(req);
        attempts.push(now);
        const [salt, hash] = passwordHash.split(':');
        if (
          typeof input.password !== 'string' ||
          input.password.length > 256 ||
          !timingSafeEqual(
            scryptSync(input.password, salt, 64),
            Buffer.from(hash, 'hex'),
          )
        )
          throw new HttpError(401, '密码不正确。');
        attempts.length = 0;
        if (sessions.size >= 20) sessions.delete(sessions.keys().next().value);
        const token = randomBytes(32).toString('hex');
        sessions.set(token, now + 12 * 3600000);
        res.setHeader('Set-Cookie', cookieValue(token, 43200));
        return json(res, 200, { ok: true });
      }
      if (!authenticated) throw new HttpError(401, '请先登录。');
      if (route === '/session' && req.method === 'GET')
        return json(res, 200, { authenticated: true });
      if (route === '/logout' && req.method === 'POST') {
        sessions.delete(cookie);
        res.setHeader('Set-Cookie', cookieValue('', 0));
        return json(res, 200, { ok: true });
      }
      if (mutating) throw new HttpError(409, '正在保存，请稍后重试。');
      if (route === '/series' && req.method === 'GET')
        return json(res, 200, { items: await series.list() });
      if (route === '/settings' && req.method === 'GET')
        return json(res, 200, await settings.get());
      if (route.startsWith('/posts/') && req.method === 'GET')
        return json(
          res,
          200,
          await store.get(decodeURIComponent(route.slice('/posts/'.length))),
        );
      if (route === '/posts' && req.method === 'GET')
        return json(res, 200, { posts: await store.list() });
      if (route === '/publication' && req.method === 'GET')
        return json(res, 200, {
          ...publication,
          release: activeRelease,
          ...(await releases.summary(activeRelease)),
        });
      if (route === '/media' && req.method === 'GET')
        return json(res, 200, { items: await media.list() });
      if (route === '/post-cover' && req.method === 'GET') {
        const file = await store.coverFile(url.searchParams.get('id'));
        const types = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.avif': 'image/avif',
        };
        res.setHeader('Content-Type', types[path.extname(file).toLowerCase()]);
        res.end(await readFile(file));
        return;
      }
      if (route === '/media/file' && req.method === 'GET') {
        const file = await media.locate(url.searchParams.get('id'));
        const types = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.gif': 'image/gif',
          '.avif': 'image/avif',
        };
        res.setHeader('Content-Type', types[path.extname(file).toLowerCase()]);
        res.end(await readFile(file));
        return;
      }
      if (route === '/history' && req.method === 'GET') {
        const id = url.searchParams.get('id');
        const version = url.searchParams.get('version');
        return json(
          res,
          200,
          version
            ? await store.version(id, version)
            : { items: await store.history(id) },
        );
      }
      if (route === '/site-preview' && req.method === 'POST')
        return json(res, 200, await previews.start());
      if (route === '/preview' && req.method === 'POST') {
        const input = await jsonBody(req);
        if (typeof input.body !== 'string')
          throw new HttpError(400, '缺少正文。');
        return json(res, 200, { html: renderPreview(input.body) });
      }
      if (publication.state === 'building' || mutating)
        throw new HttpError(409, '正在保存或发布，请稍后再试。');
      mutating = true;
      try {
        const seriesRoute = route.match(/^\/series\/([^/]+)(\/chapters)?$/);
        if (seriesRoute && req.method === 'PUT') {
          const id = decodeURIComponent(seriesRoute[1]);
          const input = await jsonBody(req);
          return json(
            res,
            200,
            seriesRoute[2]
              ? { posts: await series.organize(id, input) }
              : await series.save(id, input),
          );
        }
        if (route === '/restore' && req.method === 'POST') {
          const input = await jsonBody(req);
          return json(
            res,
            200,
            await store.restore(input.id, input.version, input.revision),
          );
        }
        if (route === '/media' && req.method === 'PUT') {
          const input = await jsonBody(req);
          return json(res, 200, await media.update(input.id, input));
        }
        if (route === '/media/reuse' && req.method === 'POST')
          return json(res, 200, await media.reuse((await jsonBody(req)).id));
        if (route === '/settings' && req.method === 'PUT')
          return json(res, 200, await settings.save(await jsonBody(req)));
        if (route === '/publish' && req.method === 'POST') {
          void publish();
          return json(res, 202, { ok: true });
        }
        if (route.startsWith('/posts/')) {
          const id = decodeURIComponent(route.slice('/posts/'.length));
          if (req.method === 'PUT')
            return json(res, 200, await store.save(id, await jsonBody(req)));
          if (req.method === 'DELETE') {
            await store.remove(id, (await jsonBody(req)).revision);
            return json(res, 200, { ok: true });
          }
        }
        if (route === '/upload' && req.method === 'POST') {
          const bytes = await body(req, 10 * 1024 * 1024);
          return json(
            res,
            201,
            await media.upload(bytes, url.searchParams.get('name') || '图片'),
          );
        }
        throw new HttpError(404, '接口不存在。');
      } finally {
        mutating = false;
      }
    } catch (error) {
      if (!error.status) console.error(error);
      if (!res.headersSent)
        json(res, error.status || 500, {
          error: error.status
            ? error.message
            : '操作失败，请稍后重试或检查服务日志。',
        });
    }
  });
  server.on('upgrade', (req, socket, head) => {
    const token = req.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('blog_admin='))
      ?.slice(11);
    if (
      !req.url?.startsWith(previewBase) ||
      req.headers.origin !== origin ||
      !token ||
      (sessions.get(token) || 0) <= Date.now()
    ) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return;
    }
    previews.upgrade(req, socket, head);
    // Existing HMR sockets must stop when the session expires or logs out.
    const timer = setInterval(() => {
      if ((sessions.get(token) || 0) <= Date.now()) socket.destroy();
    }, 1000);
    timer.unref();
    socket.once('close', () => clearInterval(timer));
  });
  server.requestTimeout = 30000;
  return server;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const server = await createAdminServer({
    root,
    dataDir: process.env.ADMIN_DATA_DIR || path.join(root, '.admin-data'),
    origin: process.env.ADMIN_ORIGIN,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    secure: process.env.ADMIN_COOKIE_SECURE !== 'false',
  });
  server.listen(Number(process.env.ADMIN_PORT || 4325), '127.0.0.1', () =>
    console.log('Blog admin server ready on loopback.'),
  );
}
