import { SITE } from '../config/site';
export function GET() {
  return new Response(
    JSON.stringify({
      name: SITE.title,
      short_name: SITE.name,
      description: SITE.description,
      lang: SITE.locale,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#ffffff',
      icons: [{ src: SITE.icon || '/favicon.ico' }],
    }),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
