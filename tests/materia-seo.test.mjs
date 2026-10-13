import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPilotSeo } from '../scripts/generate-pilot-seo.mjs';
import { renderArticleSeo, renderProjectSeo, renderStaticPageSeo, renderTeamMemberSeo, renderSiteSeo, renderSitemap } from '../scripts/generate-article-seo.mjs';

test('social crawlers receive escaped article metadata and the original Drive cover without JavaScript', () => {
  const html = renderPilotSeo('<html lang="en"><head><title>Default</title></head><body><script src="/assets/app.js"></script></body></html>', {
    titulo: 'Folia <São João> "RKC"', resumo: 'Fé & tradição', capa_url: 'https://example.test/functions/v1/drive-media?id=cover',
  });
  assert.match(html, /lang="pt-BR"/);
  assert.match(html, /<title>Folia &lt;São João&gt; &quot;RKC&quot; \| RKC<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/example.test\/functions\/v1\/drive-media\?id=cover"/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /src="\/assets\/app.js"/);
  assert.doesNotMatch(html, /<São João>/);
});

test('published article HTML includes safe search metadata, NewsArticle schema and noindex support', () => {
  const html = renderArticleSeo('<html><head><title>Default</title></head><body><div id="root"></div></body></html>', {
    slug: 'materia-teste',
    titulo: 'Título <Kalunga> & RKC',
    resumo: 'Descrição da matéria com & conteúdo.',
    seo_title: '',
    seo_description: '',
    capa_url: 'https://example.test/capa.jpg',
    autor_nome: 'Autora Kalunga',
    published_at: '2026-10-13T12:00:00Z',
    updated_at: '2026-10-13T13:00:00Z',
  }, { indexation: 'noindex' });

  assert.match(html, /<title>Título &lt;Kalunga&gt; &amp; RKC \| RKC<\/title>/);
  assert.match(html, /name="description" content="Descrição da matéria com &amp; conteúdo\."/);
  assert.match(html, /name="robots" content="noindex"/);
  assert.match(html, /rel="canonical" href="https:\/\/kalungacomunicacoes\.org\/materias\/materia-teste"/);
  assert.match(html, /"@type":"NewsArticle"/);
  assert.match(html, /"datePublished":"2026-10-13T12:00:00Z"/);
  assert.match(html, /<div id="root"><\/div>/);
  assert.doesNotMatch(html, /<Título <Kalunga>/);
});

test('homepage metadata honors saved settings and safely escapes JSON-LD', () => {
  const html = renderSiteSeo('<html lang="en"><head><title>Default</title></head><body></body></html>', {
    seo_title: 'Kalunga <Rede>',
    seo_description: 'Jornalismo & memória',
    seo_indexation: 'index',
  });

  assert.match(html, /<html lang="pt-BR">/);
  assert.match(html, /<title>Kalunga &lt;Rede&gt;<\/title>/);
  assert.match(html, /name="description" content="Jornalismo &amp; memória"/);
  assert.match(html, /name="robots" content="index, follow"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"WebSite"/);
  assert.doesNotMatch(html, /<Kalunga>/);
});

test('public project and team pages get entity-specific metadata and structured data', () => {
  const template = '<html><head><title>Default</title></head><body></body></html>';
  const project = renderProjectSeo(template, {
    slug: 'projeto-raizes', titulo: 'Projeto Raízes', resumo: 'Memória e comunicação quilombola.', image: 'https://example.test/projeto.jpg',
  });
  const profile = renderTeamMemberSeo(template, {
    slug: 'joana-kalunga', nome: 'Joana Kalunga', cargo: 'Comunicadora', bio: 'Atua no Território Kalunga.',
  });

  assert.match(project, /<title>Projeto Raízes \| RKC<\/title>/);
  assert.match(project, /"@type":"CreativeWork"/);
  assert.match(project, /og:image/);
  assert.match(profile, /<title>Joana Kalunga \| Rede Kalunga Comunicações<\/title>/);
  assert.match(profile, /"@type":"Person"/);
  assert.match(profile, /name="description" content="Atua no Território Kalunga\."/);
});

test('public section pages receive their own canonical and WebPage metadata', () => {
  const html = renderStaticPageSeo('<html><head><title>Default</title></head><body></body></html>', {
    path: '/materias',
    title: 'Matérias | Rede Kalunga Comunicações',
    description: 'Jornalismo do Território Kalunga.',
  });
  assert.match(html, /<title>Matérias \| Rede Kalunga Comunicações<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/kalungacomunicacoes\.org\/materias"/);
  assert.match(html, /"@type":"WebPage"/);
});

test('sitemap includes public pages and only valid published article slugs', () => {
  const sitemap = renderSitemap([
    { slug: 'materia-publicada', updated_at: '2026-10-13T13:00:00Z' },
    { slug: '../../admin' },
  ], [{ slug: 'projeto-publico' }], [{ slug: 'perfil-publico' }]);

  assert.match(sitemap, /<loc>https:\/\/kalungacomunicacoes\.org\/materias\/materia-publicada<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-10-13<\/lastmod>/);
  assert.match(sitemap, /https:\/\/kalungacomunicacoes\.org\/materias<\/loc>/);
  assert.match(sitemap, /https:\/\/kalungacomunicacoes\.org\/projetos\/projeto-publico<\/loc>/);
  assert.match(sitemap, /https:\/\/kalungacomunicacoes\.org\/equipe\/perfil-publico<\/loc>/);
  assert.doesNotMatch(sitemap, /\.\.\/admin/);
  assert.doesNotMatch(renderSitemap([{ slug: 'hidden' }], [], [], { indexation: 'noindex' }), /<loc>/);
});
