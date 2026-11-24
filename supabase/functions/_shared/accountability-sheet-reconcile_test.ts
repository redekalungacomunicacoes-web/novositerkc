import { reconcileCells } from './accountability-sheet-reconcile.ts';

Deno.test('reconciles independent changes without overwriting conflicts', () => {
  const result = reconcileCells(
    { a: 10, b: 20, c: 30, d: null, formula: 60 },
    { a: 11, b: 20, c: 31, d: null, formula: 61 },
    { a: 10, b: 22, c: 32, d: 0, formula: 62 },
    ['a', 'b', 'c', 'd', 'missing']
  );
  if (result.toSheet.a !== 11 || result.toPanel.b !== 22 || result.toPanel.d !== 0) throw new Error('Independent changes lost');
  if (result.conflicts.length !== 1 || result.conflicts[0].key !== 'c') throw new Error('Conflict not detected');
  if ('c' in result.toPanel || 'c' in result.toSheet || 'formula' in result.toPanel || 'formula' in result.toSheet) throw new Error('Unsafe write');
  if (result.missing[0] !== 'missing') throw new Error('Missing field not detected');
});

Deno.test('equal changes do not generate redundant writes', () => {
  const result = reconcileCells({ a: 1 }, { a: null }, { a: null }, ['a']);
  if (Object.keys(result.toPanel).length || Object.keys(result.toSheet).length || result.conflicts.length) throw new Error('Redundant write');
});
