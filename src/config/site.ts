export const SITE = {
  name: 'CD233',
  title: 'CD233 Blog',
  description: '记录技术实践、学习笔记和日常杂谈。',
  tagline: '技术笔记和日常杂谈，留着以后翻。',
  url: 'https://blog.utopiacd.online',
  locale: 'zh-CN',
  language: 'zh',
  author: 'CD233',
  email: '',
  social: {
    github: '',
    x: '',
    bilibili: '',
  },
} as const;

export const NAV_ITEMS = [
  { href: '/posts/', label: '文章' },
  { href: '/archive/', label: '归档' },
  { href: '/about/', label: '关于' },
] as const;
