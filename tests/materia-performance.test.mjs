import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

test('article detail prioritizes hero and lazily loads secondary images', async () => {
  const source = await read('src/app/pages/MateriaDetalhes.tsx');
  assert.match(source, /loading="eager"[\s\S]*fetchPriority="high"[\s\S]*sizes="100vw"/);
  assert.match(source, /loading="lazy"[\s\S]*decoding="async"[\s\S]*fetchPriority="low"/);
  assert.match(source, /fetchpriority="low"/);
});

test('card images use progressive loading before entering the viewport', async () => {
  const card = await read('src/app/components/RKCCard.tsx');
  const progressive = await read('src/app/components/RKCProgressiveImage.tsx');
  assert.match(card, /RKCProgressiveImage/);
  assert.match(card, /preloadMargin = '1200px 0px'/);
  assert.match(progressive, /IntersectionObserver/);
  assert.match(progressive, /decoding="async"/);
  assert.match(progressive, /animate-pulse/);
  assert.match(progressive, /transition-opacity/);
});

test('first article row is warmed without eagerly loading the whole archive', async () => {
  const source = await read('src/app/pages/Materias.tsx');
  assert.match(source, /const firstRow = index < 3/);
  assert.match(source, /loading=\{firstRow \? 'eager' : 'lazy'\}/);
  assert.match(source, /preloadMargin="1400px 0px"/);
});

test('native article images receive progressive enhancement and early preload', async () => {
  const loader = await read('src/lib/imageLoading.ts');
  const css = await read('src/styles/index.css');
  assert.match(loader, /rootMargin: preloadMargin/);
  assert.match(loader, /image\.loading = 'eager'/);
  assert.match(loader, /MutationObserver/);
  assert.match(css, /rkc-native-image--loading/);
  assert.match(css, /rkc-image-placeholder/);
});

test('media origin is preconnected before the app starts requesting images', async () => {
  const html = await read('index.html');
  assert.match(html, /rel="preconnect" href="https:\/\/yycfqeymdsjyulexwrlb\.supabase\.co"/);
  assert.match(html, /rel="dns-prefetch"/);
});

test('article uploads are optimized through the supported custom fetch hook', async () => {
  const client = await read('src/lib/supabase.ts');
  const optimizer = await read('src/lib/materiaMediaOptimization.ts');
  assert.match(client, /\/functions\/v1\/drive-files/);
  assert.match(client, /fetch: optimizedSupabaseFetch/);
  assert.match(client, /optimizeMateriaDriveForm/);
  assert.match(optimizer, /image\/webp/);
  assert.match(optimizer, /maxEdge: 1600/);
  assert.match(optimizer, /maxEdge: 1920/);
});

test('published article media uses immutable long-lived cache', async () => {
  const source = await read('supabase/functions/drive-media/index.ts');
  assert.match(source, /max-age=31536000, s-maxage=31536000, immutable/);
  assert.match(source, /ETag/);
  assert.match(source, /Last-Modified/);
});
