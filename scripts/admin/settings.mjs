import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import schema from '../../src/config/settings-schema.json' with { type: 'json' };
import { digest, HttpError } from './content.mjs';

function safeUrl(value, { image = false } = {}) {
  if (!value) return true;
  if (/[\s\\\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try {
    return (image ? ['https:'] : ['https:', 'http:', 'mailto:']).includes(
      new URL(value).protocol,
    );
  } catch {
    return false;
  }
}
export function validateSettings(input) {
  if (!input || typeof input !== 'object')
    throw new HttpError(400, '缺少站点内容。');
  const result = {};
  for (const group of schema) {
    result[group.key] = {};
    for (const field of group.fields) {
      const value = input[group.key]?.[field.key];
      const invalid = () => {
        throw new HttpError(
          400,
          `请检查「${group.label} / ${field.label}」的内容。`,
        );
      };
      if (field.type === 'boolean') {
        if (typeof value !== 'boolean') invalid();
      } else if (field.type === 'number') {
        if (!Number.isInteger(value) || value < field.min || value > field.max)
          invalid();
      } else if (field.type === 'links') {
        if (!Array.isArray(value) || value.length > 20) invalid();
        for (const link of value)
          if (
            !link ||
            typeof link.label !== 'string' ||
            !link.label.trim() ||
            link.label.length > 80 ||
            typeof link.href !== 'string' ||
            !link.href ||
            link.href.length > 2000 ||
            !safeUrl(link.href)
          )
            invalid();
      } else {
        const limit = field.type === 'markdown' ? 50000 : 2000;
        if (
          typeof value !== 'string' ||
          value.length > limit ||
          (field.required && !value.trim())
        )
          invalid();
        if (
          ['url', 'image'].includes(field.type) &&
          !safeUrl(value, { image: field.type === 'image' })
        )
          invalid();
        if (
          field.type === 'email' &&
          value &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        )
          invalid();
      }
      result[group.key][field.key] =
        field.type === 'links'
          ? value.map((link) => ({ label: link.label.trim(), href: link.href }))
          : value;
    }
  }
  return result;
}
export function createSettingsStore(root, dataDir) {
  const file = path.join(root, 'src/config/site-content.json');
  async function get() {
    const raw = await readFile(file, 'utf8');
    return { revision: digest(raw), content: JSON.parse(raw) };
  }
  return {
    get,
    async save(input) {
      const content = validateSettings(input?.content);
      const previous = await readFile(file, 'utf8');
      if (input.revision !== digest(previous))
        throw new HttpError(
          409,
          '站点内容已在其他窗口修改，请重新加载后再保存。',
        );
      const history = path.join(dataDir, 'history');
      await mkdir(history, { recursive: true, mode: 0o700 });
      await writeFile(
        path.join(history, `${Date.now()}-${randomUUID()}-site-content.json`),
        previous,
        { mode: 0o600, flag: 'wx' },
      );
      const raw = `${JSON.stringify(content, null, 2)}\n`;
      const temporary = path.join(path.dirname(file), `.${randomUUID()}.tmp`);
      await writeFile(temporary, raw, { flag: 'wx' });
      await rename(temporary, file);
      return { revision: digest(raw), content };
    },
  };
}
