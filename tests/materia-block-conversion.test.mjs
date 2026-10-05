import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const form = await readFile('src/app/pages/admin/AdminMateriaForm.tsx', 'utf8');
const conversion = form.slice(form.indexOf('  const changeBlockType ='), form.indexOf('  const updateBlock ='));
const js = ts.transpileModule(conversion, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function convert(block, type) {
  let blocks = [block];
  const change = new Function('isMounted', 'setBlocks', `${js}; return changeBlockType;`)(
    { current: true }, update => { blocks = update(blocks); },
  );
  change(block.id, type);
  return blocks[0];
}

test('switching image layouts preserves the Drive reference used by post-save cleanup', () => {
  const original = { id: 'block', type: 'image', url: 'https://example.test/drive-media?id=media', drive_file_id: 'media-id', caption: 'Legenda', credit: 'RKC' };
  const withText = convert(original, 'image-text');
  assert.equal(withText.drive_file_id, original.drive_file_id);
  assert.equal(withText.url, original.url);
  assert.deepEqual(convert(withText, 'image'), original);
});

test('switching to text removes the obsolete image reference', () => {
  const result = convert({ id: 'block', type: 'image-text', text: 'Texto preservado', url: 'media', drive_file_id: 'media-id' }, 'paragraph');
  assert.equal(result.text, 'Texto preservado');
  assert.equal(result.drive_file_id, undefined);
  assert.equal(result.url, undefined);
});
