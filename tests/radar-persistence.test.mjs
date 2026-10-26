import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRadarRow, persistPncpBatch } from '../src/lib/radar/radar-persistence.js';
const item = { numeroControlePNCP: '12345678901234-1-2026', objetoCompra: 'Produção audiovisual', dataEncerramentoProposta: '2026-11-01T18:00:00' };
test('converte dados para esquema RKC', () => { const row=prepareRadarRow(item,'fonte'); assert.equal(row.prazo,'2026-11-01'); assert.equal(row.status_triagem,'pendente'); });
test('simulação não escreve no banco', async () => { const result=await persistPncpBatch(null,[item,item],'fonte'); assert.equal(result.prepared,1); assert.equal(result.inserted,0); });
