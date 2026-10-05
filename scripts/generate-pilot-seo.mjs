import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

// Only the named pilot gets a static entry. No content or file migration occurs.
export const slug = 'folia-de-sao-joao-batista-fortalece-a-fe-e-preserva-a-tradicao-no-quilombo-capela';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function renderPilotSeo(html, article) {
  const canonical = `https://kalungacomunicacoes.org/materias/${slug}/`;
  const tags = [
    ['name', 'description', article.resumo],
    ['property', 'og:type', 'article'],
    ['property', 'og:title', article.titulo],
    ['property', 'og:description', article.resumo],
    ['property', 'og:image', article.capa_url],
    ['property', 'og:url', canonical],
    ['property', 'og:locale', 'pt_BR'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', article.titulo],
    ['name', 'twitter:description', article.resumo],
    ['name', 'twitter:image', article.capa_url],
  ].map(([key, name, value]) => `<meta ${key}="${name}" content="${escape(value)}" />`).join('\n');
  return html.replace(/<html[^>]*>/i, '<html lang="pt-BR">')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escape(article.titulo)} | RKC</title>`)
    .replace('</head>', `${tags}\n<link rel="canonical" href="${canonical}" />\n</head>`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw new Error('Public Supabase build configuration is required for pilot SEO.');
  const url = new URL('/rest/v1/materias', env.VITE_SUPABASE_URL);
  url.search = new URLSearchParams({ select: 'titulo,resumo,capa_url', slug: `eq.${slug}`, status: 'eq.published' }).toString();
  const response = await fetch(url, { headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Pilot SEO query failed: ${response.status}`);
  const rows = await response.json();
  if (rows.length !== 1 || !rows[0].capa_url?.includes('/functions/v1/drive-media?')) throw new Error('Published Drive pilot not found; refusing stale social metadata.');
  const dir = `dist/materias/${slug}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/index.html`, renderPilotSeo(await readFile('dist/index.html', 'utf8'), rows[0]));
  console.log('Pilot HTML includes title, description, canonical and original Drive cover for social crawlers.');
}
