import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const SITE = 'https://kalungacomunicacoes.org';
export function renderArticleSeo(html, article) {
  const title = article.seo_title?.trim() || article.titulo || 'Rede Kalunga Comunicações';
  const description = (article.seo_description?.trim() || article.resumo || '').slice(0, 300);
  const image = article.banner_url || article.capa_url || '';
  const canonical = `${SITE}/materias/${encodeURIComponent(article.slug)}`;
  const fields = [
    ['name', 'description', description],
    ['property', 'og:type', 'article'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['property', 'og:site_name', 'Rede Kalunga Comunicações'],
    ['property', 'og:locale', 'pt_BR'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ];
  if (/^https:\/\//i.test(image)) {
    fields.push(['property', 'og:image', image], ['name', 'twitter:image', image]);
  }
  const tags = fields.map(([attr, name, content]) =>
    `<meta ${attr}="${name}" content="${escape(content)}" />`).join('\n');
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(title)} | RKC</title>`)
    .replace('</head>', `${tags}\n<link rel="canonical" href="${escape(canonical)}" />\n</head>`);
}
export async function generate() {
  const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw Error('Supabase public environment is required');
  const template = await readFile('dist/index.html', 'utf8');
  let offset = 0, count = 0;
  while (true) {
    const url = new URL('/rest/v1/materias', env.VITE_SUPABASE_URL);
    url.search = new URLSearchParams({
      select: 'slug,titulo,resumo,seo_title,seo_description,banner_url,capa_url',
      status: 'eq.published', order: 'created_at.asc', limit: '500', offset: String(offset)
    }).toString();
    const response = await fetch(url, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(`SEO metadata query failed: HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error('SEO metadata response malformed');
    for (const article of rows) {
      if (!/^[a-z0-9-]{1,220}$/i.test(article.slug)) continue;
      const dir = `dist/materias/${article.slug}`;
      await mkdir(dir, { recursive: true });
      await writeFile(`${dir}/index.html`, renderArticleSeo(template, article));
      count++;
    }
    if (rows.length < 500) break;
    offset += rows.length;
  }
  console.log(`Generated SEO HTML for ${count} published articles`);
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await generate();
