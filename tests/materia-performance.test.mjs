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

test('card images default to lazy async loading', async () => {
  const source = await read('src/app/components/RKCCard.tsx');
  assert.match(source, /loading = 'lazy'/);
  assert.match(source, /fetchPriority = 'low'/);
  assert.match(source, /decoding="async"/);
});

test('article uploads are optimized before invoking drive-files', async () => {
  const client = await read('src/lib/supabase.ts');
  const optimizer = await read('src/lib/materiaMediaOptimization.ts');
  assert.match(client, /functionName === "drive-files"/);
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
