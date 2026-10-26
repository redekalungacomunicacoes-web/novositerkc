import test from "node:test";
import assert from "node:assert/strict";
import { pncpUrl, fetchPncpPage, iteratePncp } from "../src/lib/radar/pncp-client.js";

test("gera URL oficial com filtros", () => {
 const url = new URL(pncpUrl({from:"2026-10-20",to:"2026-10-26",modality:6}));
 assert.equal(url.origin,"https://pncp.gov.br");
 assert.equal(url.searchParams.get("dataInicial"),"20261020");
 assert.equal(url.searchParams.get("codigoModalidadeContratacao"),"6");
});
test("lê página simulada sem conexão real", async () => {
 const result = await fetchPncpPage({from:"2026-10-20",to:"2026-10-26",modality:6},{fetchImpl:async()=>({ok:true,json:async()=>({data:[{numeroControlePNCP:"123"}],totalPaginas:1})})});
 assert.equal(result.records.length,1);
});
test("interrompe quando total de páginas foi atingido", async () => {
 let calls=0;
 const fetchImpl=async()=>{calls++;return {ok:true,json:async()=>({data:[{id:calls}],totalPaginas:2})}};
 const pages=[];
 for await (const p of iteratePncp({from:"2026-10-20",to:"2026-10-26",modality:6},{fetchImpl,maxPages:3})) pages.push(p);
 assert.equal(pages.length,2);
 assert.equal(calls,2);
});
test("sinaliza coleta incompleta ao atingir limite", async () => {
 const fetchImpl=async()=>({ok:true,json:async()=>({data:[],totalPaginas:9})});
 await assert.rejects(async()=>{for await (const _ of iteratePncp({from:"2026-10-20",to:"2026-10-26",modality:6},{fetchImpl,maxPages:1})) {}},/incompleta/);
});
