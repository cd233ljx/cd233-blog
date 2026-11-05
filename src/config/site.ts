import content from './site-content.json';

// Public origin stays here; editable content never changes deployment/auth origins.
export const SITE = {
  ...content.identity,
  url: 'https://blog.utopiacd.online',
  locale: 'zh-CN',
  language: 'zh',
  social: {
    github: content.identity.github,
    x: content.identity.x,
    bilibili: content.identity.bilibili,
  },
} as const;

export const CONTENT = content;
export const NAV_ITEMS = content.navigation.items;
export function formatText(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    String(Object.hasOwn(values, key) ? values[key] : match),
  );
}
