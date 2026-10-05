import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPilotSeo } from '../scripts/generate-pilot-seo.mjs';

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
