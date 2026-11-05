import { mkdir, symlink, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import http from 'node:http';
import { HttpError } from './content.mjs';

const exec = promisify(execFile);
export const previewBase = '/admin/live/';

export function rewritePreviewHtml(html) {
  return html
    .replace(
      /(\b(?:href|src|action|component-url|renderer-url|before-hydration-url)=["'])\/(?!\/|admin\/live\/)/g,
      `$1${previewBase}`,
    )
    .replace(
      /\bsrcset=(["'])(.*?)\1/g,
      (_match, quote, value) =>
        `srcset=${quote}${value.replace(/(^|,\s*)\/(?!\/|admin\/live\/)/g, `$1${previewBase}`)}${quote}`,
    )
    .replaceAll(`${previewBase}/`, previewBase);
}

// One private, reusable dev server. Source links keep repository edits live;
// separate caches and lock files keep it independent of builds and normal dev.
export function createPreviewService(root) {
  // Keep source and virtual Astro modules under the same filesystem ancestor.
  // An external ADMIN_DATA_DIR can otherwise turn absolute module IDs into routes.
  const workspace = path.join(root, '.admin-data', 'live-preview');
  const cli = path.join(root, 'node_modules/astro/bin/astro.mjs');
  let starting;
  let port;
  async function start() {
    if (starting) return starting;
    starting = (async () => {
      await mkdir(workspace, { recursive: true, mode: 0o700 });
      for (const name of [
        'src',
        'public',
        'node_modules',
        'tsconfig.json',
        'package.json',
      ]) {
        await symlink(path.join(root, name), path.join(workspace, name)).catch(
          (error) => {
            if (error.code !== 'EEXIST') throw error;
          },
        );
      }
      // Astro handles routes at /; Vite mounts modules under the authenticated prefix.
      // Ignore dev logs/caches, but retain content-module watching for newly created notes.
      const config = `import config from ${JSON.stringify(pathToFileURL(path.join(root, 'astro.config.mjs')).href)};\nexport default { ...config, base: '/', trailingSlash: 'ignore', devToolbar: { enabled: false }, cacheDir: './.astro/cache', server: { host: '127.0.0.1', port: 4326 }, vite: { ...config.vite, base: ${JSON.stringify(previewBase)}, cacheDir: './.astro/vite', server: { watch: { ignored: ['**/.astro/vite/**', '**/.astro/cache/**', '**/.astro/dev.log', '**/.astro/dev.json', '**/dist/**'] }, fs: { allow: [${JSON.stringify(root)}, ${JSON.stringify(workspace)}] } } } };\n`;
      // Do not restart Vite merely because another preview tab was opened.
      const configPath = path.join(workspace, 'astro.config.mjs');
      const previousConfig = await readFile(configPath, 'utf8').catch(() => '');
      if (previousConfig !== config) {
        if (previousConfig)
          await exec(
            process.execPath,
            [cli, 'dev', 'stop', '--root', workspace],
            { cwd: root, timeout: 15000 },
          );
        await writeFile(configPath, config);
      }
      try {
        await exec(
          process.execPath,
          [cli, 'dev', '--background', '--root', workspace],
          {
            cwd: root,
            env: {
              ...process.env,
              BLOG_ADMIN_PREVIEW: '1',
              BLOG_ADMIN_PREVIEW_BASE: previewBase,
            },
            timeout: 40000,
          },
        );
        const lock = JSON.parse(
          await readFile(path.join(workspace, '.astro/dev.json'), 'utf8'),
        );
        port = lock.port;
        return { base: previewBase };
      } catch {
        port = undefined;
        throw new HttpError(
          503,
          '无法启动实时预览，请检查后台预览服务日志后重试。',
        );
      }
    })().finally(() => {
      starting = undefined;
    });
    return starting;
  }
  function proxy(req, res) {
    if (!port) throw new HttpError(503, '请重新打开实时预览。');
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${port}`,
          'accept-encoding': 'identity',
        },
      },
      (response) => {
        res.statusCode = response.statusCode;
        // Keep authentication, no-store and CSP headers owned by the admin boundary.
        for (const name of ['content-type', 'location'])
          if (response.headers[name])
            res.setHeader(name, response.headers[name]);
        if (response.headers['content-type']?.includes('text/html')) {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () =>
            res.end(rewritePreviewHtml(Buffer.concat(chunks).toString('utf8'))),
          );
          response.on('error', () => res.destroy());
        } else response.pipe(res);
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end('实时预览连接中断，请重新打开预览。');
      } else res.destroy();
    });
    res.on('close', () => upstream.destroy());
    req.pipe(upstream);
  }
  function upgrade(req, socket, head) {
    if (!port) return socket.destroy();
    const upstream = http.request({
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: 'GET',
      headers: { ...req.headers, host: `127.0.0.1:${port}` },
    });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n')}\r\n\r\n`,
      );
      if (head.length) remote.write(head);
      if (remoteHead.length) socket.write(remoteHead);
      socket.pipe(remote).pipe(socket);
      socket.on('error', () => remote.destroy());
      remote.on('error', () => socket.destroy());
      socket.on('close', () => remote.destroy());
      remote.on('close', () => socket.destroy());
    });
    upstream.on('response', () => socket.destroy());
    upstream.on('error', () => socket.destroy());
    upstream.end();
  }
  return { start, proxy, upgrade };
}
