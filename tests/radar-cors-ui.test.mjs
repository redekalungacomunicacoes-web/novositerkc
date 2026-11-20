import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";

const fn=readFileSync(new URL("../supabase/functions/radar-editais/index.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../src/app/pages/admin/AdminCaptacao.tsx",import.meta.url),"utf8");

test("CORS preflight accepts the headers used by the browser Supabase client",()=>{
  const line=fn.split("\n").find(line=>line.startsWith("const headers="));
  assert.ok(line);
  const headers=JSON.parse(line.slice("const headers=".length,-1));
  const accepted=headers["access-control-allow-headers"].split(",").map(x=>x.trim());
  for(const field of ["authorization","x-client-info","apikey","content-type"]){
    assert.ok(accepted.includes(field),"Missing CORS header "+field);
  }
  assert.match(headers["access-control-allow-methods"],/OPTIONS/);
  assert.match(headers["access-control-allow-methods"],/POST/);
  assert.match(fn,/if\(req.method==="OPTIONS"\)return new Response\(null,\{headers\}\)/);
});

test("authentication and human triages are still protected",()=>{
  assert.match(fn,/if\(!bearer\)return response\(\{error:"Authorization required"\},401\)/);
  assert.match(fn,/userClient\.rpc\("can_access_captacao"\)/);
  assert.match(fn,/ignoreDuplicates:true/);
  assert.doesNotMatch(fn,/from\("captacao_radar_oportunidades"\)\.update/);
});

test("rate limits honor Retry-After and do not rapidly repeat PNCP requests",async()=>{
  const helper=fn.slice(fn.indexOf("const SCAN_BUDGET_MS"),fn.indexOf("Deno.serve")).replace("export async function","async function");
  const delays=[];let requests=0;
  const ctx=vm.createContext({URL,Date,Set,JSON,Number,Math,Error,TypeError,AbortSignal,fetch,setTimeout:(cb,ms)=>{delays.push(ms);cb();}});
  vm.runInContext(stripTypeScriptTypes(helper)+";globalThis.collect=collectPages",ctx);
  const result=await ctx.collect(6,Date.now()+120000,async()=>{},
    async()=>++requests===1?new Response("",{status:429,headers:{"Retry-After":"13"}}):
      new Response(JSON.stringify({data:[{numeroControlePNCP:"1"}],numeroPagina:1,totalPaginas:1}),{status:200}));
  assert.equal(result.completa,true);
  assert.equal(requests,2);
  assert.ok(delays.some(ms=>ms>=13000),"Expected server Retry-After or a longer cooldown");
});

test("UI retains diagnostics after refreshing data",()=>{
  assert.match(ui,/async function refreshRadar\(preserveError = false\)/);
  assert.match(ui,/if \(!preserveError\) setRadarError\(null\)/);
  assert.match(ui,/finally \{await refreshRadar\(true\);\}/);
  assert.match(ui,/response\.clone\(\)\.json\(\)/);
  assert.match(ui,/response\?\.status===401/);
  assert.match(ui,/response\?\.status===403/);
});

test("gateway-verified service-role token requires matching apikey, role and project",()=>{
  const start=fn.indexOf("function verifiedGatewayServiceRole(");
  const end=fn.indexOf("Deno.serve",start);
  assert.ok(start>=0&&end>start,"Expected auth helper");
  const ctx=vm.createContext({URL,Date,JSON,atob,console});
  vm.runInContext(stripTypeScriptTypes('const URL_BASE="https://yycfqeymdsjyulexwrlb.supabase.co";'+fn.slice(start,end))+';globalThis.authorize=verifiedGatewayServiceRole',ctx);
  const jwt=(claims)=>["header",Buffer.from(JSON.stringify(claims)).toString("base64url"),"signature"].join(".");
  const valid=jwt({role:"service_role",ref:"yycfqeymdsjyulexwrlb",exp:Math.floor(Date.now()/1000)+3600});
  assert.equal(ctx.authorize(valid,valid),true);
  assert.equal(ctx.authorize(valid,null),false);
  assert.equal(ctx.authorize(valid,"wrong-apikey"),false);
  const wrongProject=jwt({role:"service_role",ref:"another-project"});
  assert.equal(ctx.authorize(wrongProject,wrongProject),false);
  const user=jwt({role:"authenticated",ref:"yycfqeymdsjyulexwrlb"});
  assert.equal(ctx.authorize(user,user),false);
  const expired=jwt({role:"service_role",exp:Math.floor(Date.now()/1000)-60});
  assert.equal(ctx.authorize(expired,expired),false);
  assert.match(fn,/if\(bearer!==KEY && !gatewayServiceRole\)/);
  assert.match(fn,/gatewayServiceRole\?bearer:KEY/);
  // The server must remain deployed with verify_jwt=true, which validates signatures.
});
