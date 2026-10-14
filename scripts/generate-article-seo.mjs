import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const SITE = 'https://kalungacomunicacoes.org';
const SITE_NAME = 'Rede Kalunga Comunicações';
const DEFAULT_TITLE = 'Rede Kalunga Comunicações | Jornalismo quilombola';
const DEFAULT_DESCRIPTION = 'Jornalismo independente produzido no Território Quilombola Kalunga, na Chapada dos Veadeiros. Cultura, direitos, meio ambiente e vida no Cerrado.';
const PUBLIC_PATHS = ['/materias', '/quem-somos', '/projetos', '/contato', '/newsletter'];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const escapeXml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function metaTag(attribute, key, value) {
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`;
}

function withHeadTags(html, tags) {
  return html.replace('</head>', `${tags.filter(Boolean).join('\n')}\n</head>`);
}

function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: `${SITE}/`,
  };
}

export function renderSiteSeo(html, settings = {}) {
  const title = settings.seo_title?.trim() || DEFAULT_TITLE;
  const description = (settings.seo_description?.trim() || DEFAULT_DESCRIPTION).slice(0, 300);
  const ogTitle = settings.seo_og_title?.trim() || title;
  const ogDescription = (settings.seo_og_description?.trim() || description).slice(0, 300);
  const image = settings.seo_og_image?.trim() || '';
  const robots = settings.seo_indexation === 'noindex' ? 'noindex' : 'index, follow';
  const tags = [
    metaTag('name', 'description', description),
    metaTag('name', 'robots', robots),
    metaTag('property', 'og:type', 'website'),
    metaTag('property', 'og:title', ogTitle),
    metaTag('property', 'og:description', ogDescription),
    metaTag('property', 'og:url', `${SITE}/`),
    metaTag('property', 'og:site_name', SITE_NAME),
    metaTag('property', 'og:locale', 'pt_BR'),
    metaTag('name', 'twitter:card', image ? 'summary_large_image' : 'summary'),
    metaTag('name', 'twitter:title', ogTitle),
    metaTag('name', 'twitter:description', ogDescription),
    image && metaTag('property', 'og:image', image),
    image && metaTag('name', 'twitter:image', image),
    `<link rel="canonical" href="${SITE}/" />`,
    `<script type="application/ld+json">${safeJson({
      '@context': 'https://schema.org',
      '@graph': [organizationSchema(), {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE_NAME,
        url: `${SITE}/`,
        inLanguage: 'pt-BR',
      }],
    })}</script>`,
  ];
  const cleanHtml = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<html([^>]*)>/i, '<html lang="pt-BR">')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/i, '')
    .replace(/<meta\s+(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  return withHeadTags(cleanHtml, tags);
}

export function renderArticleSeo(html, article, { indexation = 'index' } = {}) {
  const title = article.seo_title?.trim() || article.titulo || SITE_NAME;
  const description = (article.seo_description?.trim() || article.resumo || '').slice(0, 300);
  const image = article.banner_url || article.capa_url || '';
  const canonical = `${SITE}/materias/${encodeURIComponent(article.slug)}`;
  const robots = indexation === 'noindex' ? 'noindex' : 'index, follow';
  const fields = [
    ['name', 'description', description],
    ['name', 'robots', robots],
    ['property', 'og:type', 'article'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:locale', 'pt_BR'],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ];
  if (/^https?:\/\//i.test(image)) {
    fields.push(['property', 'og:image', image], ['name', 'twitter:image', image]);
  }
  const tags = fields.map(([attr, name, content]) => metaTag(attr, name, content));
  tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    image: /^https?:\/\//i.test(image) ? [image] : undefined,
    datePublished: article.published_at || undefined,
    dateModified: article.updated_at || article.published_at || undefined,
    author: article.autor_nome ? { '@type': 'Person', name: article.autor_nome } : { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME, url: `${SITE}/` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: 'pt-BR',
  };
  tags.push(`<script type="application/ld+json">${safeJson(schema)}</script>`);
  const cleaned = html
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/i, '')
    .replace(/<meta\s+(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  const titledHtml = cleaned.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)} | RKC</title>`)
    .replace(/<html([^>]*)>/i, '<html lang="pt-BR">')
  return withHeadTags(titledHtml, tags);
}

function plainDescription(value) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/[#*_`~]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

function renderEntitySeo(html, { title, description, image, canonical, type, schema, indexation = 'index' }) {
  const safeTitle = plainDescription(title) || SITE_NAME;
  const documentTitle = safeTitle.includes(SITE_NAME) ? safeTitle : `${safeTitle} | RKC`;
  const safeDescription = plainDescription(description) || DEFAULT_DESCRIPTION;
  const safeImage = /^https?:\/\//i.test(image || '') ? image : '';
  const tags = [
    metaTag('name', 'description', safeDescription),
    metaTag('name', 'robots', indexation === 'noindex' ? 'noindex' : 'index, follow'),
    metaTag('property', 'og:type', type),
    metaTag('property', 'og:title', safeTitle),
    metaTag('property', 'og:description', safeDescription),
    metaTag('property', 'og:url', canonical),
    metaTag('property', 'og:site_name', SITE_NAME),
    metaTag('property', 'og:locale', 'pt_BR'),
    metaTag('name', 'twitter:card', safeImage ? 'summary_large_image' : 'summary'),
    metaTag('name', 'twitter:title', safeTitle),
    metaTag('name', 'twitter:description', safeDescription),
    safeImage && metaTag('property', 'og:image', safeImage),
    safeImage && metaTag('name', 'twitter:image', safeImage),
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<script type="application/ld+json">${safeJson(schema)}</script>`,
  ];
  const cleaned = html
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i, '')
    .replace(/<script\s+type=["']application\/ld\+json["'][\s\S]*?<\/script>/i, '')
    .replace(/<meta\s+(?:name|property)=["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  return withHeadTags(cleaned.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(documentTitle)}</title>`), tags);
}

export function renderStaticPageSeo(html, page, { indexation = 'index' } = {}) {
  const canonical = `${SITE}${page.path}`;
  return renderEntitySeo(html, {
    title: page.title,
    description: page.description,
    image: page.image || '',
    canonical,
    type: 'website',
    indexation,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: plainDescription(page.description),
      url: canonical,
      inLanguage: 'pt-BR',
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: `${SITE}/` },
    },
  });
}

export function renderProjectSeo(html, project, { indexation = 'index' } = {}) {
  const title = project.titulo || 'Projeto';
  const description = project.resumo || project.descricao || '';
  const canonical = `${SITE}/projetos/${encodeURIComponent(project.slug)}`;
  return renderEntitySeo(html, {
    title, description, image: project.image || project.capa_url || '', canonical, type: 'article', indexation,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: title,
      description: plainDescription(description),
      image: /^https?:\/\//i.test(project.image || project.capa_url || '') ? project.image || project.capa_url : undefined,
      datePublished: project.published_at || undefined,
      dateModified: project.updated_at || project.published_at || undefined,
      creator: { '@type': 'Organization', name: SITE_NAME },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      inLanguage: 'pt-BR',
    },
  });
}

export function renderTeamMemberSeo(html, member, { indexation = 'index' } = {}) {
  const title = `${member.nome || 'Integrante'} | ${SITE_NAME}`;
  const description = member.bio || [member.cargo, `Integrante da ${SITE_NAME}, comunicação quilombola no Território Kalunga.`].filter(Boolean).join(' — ');
  const canonical = `${SITE}/equipe/${encodeURIComponent(member.slug)}`;
  return renderEntitySeo(html, {
    title, description, image: member.image || member.foto_url || '', canonical, type: 'profile', indexation,
    schema: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: member.nome,
      jobTitle: member.cargo || undefined,
      description: plainDescription(description),
      image: /^https?:\/\//i.test(member.image || member.foto_url || '') ? member.image || member.foto_url : undefined,
      worksFor: { '@type': 'Organization', name: SITE_NAME, url: `${SITE}/` },
      url: canonical,
      inLanguage: 'pt-BR',
    },
  });
}

export function renderSitemap(articles, projects = [], team = [], { indexation = 'index' } = {}) {
  if (indexation === 'noindex') {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  }
  const urls = [{ loc: `${SITE}/`, priority: '1.0' }];
  for (const path of PUBLIC_PATHS) urls.push({ loc: `${SITE}${path}`, priority: path === '/materias' ? '0.9' : '0.7' });
  for (const article of articles) {
    if (!/^[a-z0-9-]{1,220}$/i.test(article.slug || '')) continue;
    urls.push({
      loc: `${SITE}/materias/${encodeURIComponent(article.slug)}`,
      lastmod: article.updated_at || article.published_at || undefined,
      priority: '0.8',
    });
  }
  for (const project of projects) {
    if (!/^[a-z0-9-]{1,220}$/i.test(project.slug || '')) continue;
    urls.push({ loc: `${SITE}/projetos/${encodeURIComponent(project.slug)}`, lastmod: project.updated_at || project.published_at || undefined, priority: '0.7' });
  }
  for (const member of team) {
    if (!/^[a-z0-9-]{1,220}$/i.test(member.slug || '')) continue;
    urls.push({ loc: `${SITE}/equipe/${encodeURIComponent(member.slug)}`, lastmod: member.updated_at || undefined, priority: '0.6' });
  }
  const entries = urls.map(({ loc, lastmod, priority }) => `<url><loc>${escapeXml(loc)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ''}<priority>${priority}</priority></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

async function fetchPublicTable(url, key) {
  const headers = { apikey: key };
  // Legacy anon keys are JWTs; opaque sb_publishable keys must not be sent as bearer tokens.
  if (key.split('.').length === 3) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`SEO metadata query failed: HTTP ${response.status}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) throw Error('SEO metadata response malformed');
  return rows;
}

export async function generate() {
  const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) throw Error('Supabase public environment is required');
  const template = await readFile('dist/index.html', 'utf8');
  const settingsUrl = new URL('/rest/v1/site_settings', env.VITE_SUPABASE_URL);
  settingsUrl.search = new URLSearchParams({
    select: 'seo_title,seo_description,seo_og_title,seo_og_description,seo_og_image,seo_indexation',
    singleton: 'eq.true', limit: '1',
  }).toString();
  const settingsRows = await fetchPublicTable(settingsUrl, env.VITE_SUPABASE_ANON_KEY);
  const settings = settingsRows[0] || {};
  await writeFile('dist/index.html', renderSiteSeo(template, settings));

  const staticPages = [
    { path: '/materias', title: 'Matérias | Rede Kalunga Comunicações', description: 'Jornalismo independente que nasce do Território Quilombola Kalunga e da Chapada dos Veadeiros.' },
    { path: '/quem-somos', title: 'Quem Somos | Rede Kalunga Comunicações', description: 'Conheça a Rede Kalunga Comunicações, iniciativa quilombola de jornalismo e comunicação no Território Kalunga.' },
    { path: '/projetos', title: 'Projetos | Rede Kalunga Comunicações', description: 'Iniciativas de comunicação, memória, cultura e formação da Rede Kalunga Comunicações.' },
    { path: '/contato', title: 'Contato | Rede Kalunga Comunicações', description: 'Fale com a Rede Kalunga Comunicações sobre jornalismo, parcerias e comunicação no Território Kalunga.' },
    { path: '/newsletter', title: 'Newsletter | Rede Kalunga Comunicações', description: 'Receba notícias e histórias do Território Quilombola Kalunga, da Chapada dos Veadeiros e do Cerrado.' },
  ];
  for (const page of staticPages) {
    page.image = settings.seo_og_image || '';
    const dir = `dist${page.path}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, renderStaticPageSeo(template, page, { indexation: settings.seo_indexation }));
  }

  const projectUrl = new URL('/rest/v1/projetos', env.VITE_SUPABASE_URL);
  projectUrl.search = new URLSearchParams({
    select: 'id,slug,titulo,resumo,descricao,capa_url,cover_card_path,published_at,updated_at',
    publicado_transparencia: 'eq.true', order: 'published_at.desc.nullslast', limit: '500',
  }).toString();
  const projects = await fetchPublicTable(projectUrl, env.VITE_SUPABASE_ANON_KEY);
  const teamUrl = new URL('/rest/v1/equipe', env.VITE_SUPABASE_URL);
  teamUrl.search = new URLSearchParams({
    select: 'id,slug,nome,cargo,bio,foto_url,avatar_path,avatar_thumb_path,avatar_drive_file_id,avatar_thumb_drive_file_id,avatar_thumb_drive:drive_files!equipe_avatar_thumb_drive_file_id_fkey(public_slug),avatar_drive:drive_files!equipe_avatar_drive_file_id_fkey(public_slug),updated_at',
    is_public: 'eq.true', ativo: 'eq.true', order: 'order_index.asc', limit: '500',
  }).toString();
  const team = await fetchPublicTable(teamUrl, env.VITE_SUPABASE_ANON_KEY);

  const publicStorageUrl = (bucket, path) => `${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${String(path || '').split('/').map(encodeURIComponent).join('/')}`;
  for (const project of projects) {
    if (!/^[a-z0-9-]{1,220}$/i.test(project.slug || '')) continue;
    const imagePath = project.cover_card_path || project.capa_url || '';
    project.image = /^https?:\/\//i.test(imagePath) ? imagePath : imagePath ? publicStorageUrl('projetos', imagePath) : '';
    const dir = `dist/projetos/${project.slug}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, renderProjectSeo(template, project, { indexation: settings.seo_indexation }));
  }
  for (const member of team) {
    if (!/^[a-z0-9-]{1,220}$/i.test(member.slug || '')) continue;
    const drive = Array.isArray(member.avatar_thumb_drive) ? member.avatar_thumb_drive[0] : member.avatar_thumb_drive;
    const originalDrive = Array.isArray(member.avatar_drive) ? member.avatar_drive[0] : member.avatar_drive;
    const publicSlug = drive?.public_slug || originalDrive?.public_slug;
    member.image = publicSlug
      ? `${env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/drive-media?id=${encodeURIComponent(publicSlug)}`
      : member.avatar_thumb_path ? publicStorageUrl('team-avatars', member.avatar_thumb_path)
        : member.avatar_path ? publicStorageUrl('team-avatars', member.avatar_path) : member.foto_url || '';
    const dir = `dist/equipe/${member.slug}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, renderTeamMemberSeo(template, member, { indexation: settings.seo_indexation }));
  }

  const articles = [];
  let offset = 0;
  while (true) {
    const url = new URL('/rest/v1/materias', env.VITE_SUPABASE_URL);
    url.search = new URLSearchParams({
      select: 'slug,titulo,resumo,seo_title,seo_description,banner_url,capa_url,autor_nome,published_at,updated_at',
      status: 'eq.published', order: 'created_at.asc', limit: '500', offset: String(offset),
    }).toString();
    const rows = await fetchPublicTable(url, env.VITE_SUPABASE_ANON_KEY);
    articles.push(...rows);
    if (rows.length < 500) break;
    offset += rows.length;
  }

  let count = 0;
  for (const article of articles) {
    if (!/^[a-z0-9-]{1,220}$/i.test(article.slug || '')) continue;
    const dir = `dist/materias/${article.slug}`;
    await mkdir(dir, { recursive: true });
    await writeFile(`${dir}/index.html`, renderArticleSeo(template, article, { indexation: settings.seo_indexation }));
    count++;
  }
  const sitemap = renderSitemap(articles, projects, team, { indexation: settings.seo_indexation });
  await writeFile('dist/sitemap.xml', sitemap);
  console.log(`Generated SEO HTML for ${count} published articles, ${projects.length} projects and ${team.length} public team profiles; indexation=${settings.seo_indexation || 'index'}`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) await generate();
