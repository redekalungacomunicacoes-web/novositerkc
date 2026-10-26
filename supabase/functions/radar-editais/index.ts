import { createClient } from "npm:@supabase/supabase-js@2";
const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const client = createClient(URL_BASE, KEY, {auth:{persistSession:false}});
const SOURCES = [
 {nome:"MinC — Editais abertos",url:"https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-abertas"},
 {nome:"MinC — Editais em andamento",url:"https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento"}
];
const headers={"content-type":"application/json","access-control-allow-origin":"*","access-control-allow-headers":"authorization,apikey,content-type","access-control-allow-methods":"POST,OPTIONS"};
function response(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers});}
function clean(text:string){return text.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();}

// Bound work below the hosted 150s request timeout, leaving time to persist the log.
const SCAN_BUDGET_MS = 120_000;
const MAX_PAGES = 1000;
function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return JSON.stringify(error) || String(error);
}
export async function collectPages(
  modality: number, deadline: number,
  consume: (items: any[]) => Promise<void>,
  request: typeof fetch = fetch, now: () => number = Date.now,
) {
  let page = 1, completed = 0, total = 0;
  const fingerprints = new Set<string>();
  try {
    for (; page <= MAX_PAGES; page++) {
      const api = new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao");
      const today = new Date(deadline - SCAN_BUDGET_MS);
      const stamp = (d: Date) => d.toISOString().slice(0,10).replaceAll("-", "");
      for (const [key,value] of Object.entries({dataInicial:stamp(new Date(today.getTime()-3*86400000)),dataFinal:stamp(today),codigoModalidadeContratacao:String(modality),pagina:String(page),tamanhoPagina:"50"})) api.searchParams.set(key,value);
      let body: any;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const remaining = deadline - now();
        if (remaining < 1000) throw Error("Limite de tempo da coleta atingido");
        let retryAfterMs = 0;
        try {
          const res = await request(api, {signal:AbortSignal.timeout(Math.min(10_000, remaining)),headers:{accept:"application/json"}});
          if (res.status === 204) {
            if (page > 1 && page <= total) throw Error("HTTP 204 antes do fim informado");
            return {modalidade:modality,paginas:completed,totalPaginas:total,completa:true};
          }
          if (!res.ok) {
            const retryAfter = res.headers.get("retry-after");
            if (retryAfter) {
              const seconds = Number(retryAfter);
              retryAfterMs = Number.isFinite(seconds) ? seconds * 1000 : Math.max(0,Date.parse(retryAfter)-now());
            }
            if (res.status !== 429 && res.status < 500) throw new TypeError("HTTP " + res.status);
            throw Error("HTTP " + res.status);
          }
          body = await res.json();
          break;
        } catch (error) {
          if (error instanceof TypeError && /^HTTP /.test(error.message)) throw error;
          if (attempt === 4) throw Error("Após 4 tentativas: " + errorMessage(error));
          const delay = Math.max(1000 * 2 ** (attempt-1), Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
          if (deadline - now() < delay + 1000) throw Error("Limite de tempo durante retentativa: " + errorMessage(error));
          await new Promise(resolve => setTimeout(resolve,delay));
        }
      }
      if (!Array.isArray(body?.data) || !Number.isInteger(body.totalPaginas) || body.totalPaginas < 0 || (body.numeroPagina != null && body.numeroPagina !== page)) throw Error("Resposta PNCP inválida ou página divergente");
      total = body.totalPaginas;
      if (body.data.length === 0 && page <= total) throw Error("Página vazia antes do fim informado");
      if (body.data.length > 0) {
        if (total < page) throw Error("Total de páginas inconsistente");
        const fingerprint = JSON.stringify(body.data.map((item: any) => item.numeroControlePNCP));
        if (fingerprints.has(fingerprint)) throw Error("Página repetida pelo PNCP");
        fingerprints.add(fingerprint);
        await consume(body.data);
      }
      completed = page;
      if (page >= total) return {modalidade:modality,paginas:completed,totalPaginas:total,completa:true};
      // Avoid bursts against the national API. Backoff also honors Retry-After.
      if (deadline-now() > 1300) await new Promise(resolve=>setTimeout(resolve,300));
    }
    throw Error("Limite seguro de " + MAX_PAGES + " páginas atingido");
  } catch (error) {
    return {modalidade:modality,paginas:completed,totalPaginas:total,completa:false,erro:"PNCP modalidade " + modality + ", página " + page + " (" + completed + "/" + total + " concluídas): " + errorMessage(error)};
  }
}

Deno.serve(async(req)=>{
 const deadline=Date.now()+SCAN_BUDGET_MS;
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 const bearer=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
 if(!bearer)return response({error:"Authorization required"},401);
 // Only logged-in captação staff or service-role automation may trigger scans.
 if(bearer!==KEY){
   const userClient=createClient(URL_BASE,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:"Bearer "+bearer}},auth:{persistSession:false}});
   const {data:user,error:authError}=await userClient.auth.getUser();
   if(authError||!user.user)return response({error:"Invalid user"},401);
   const {data:allowed,error:aclError}=await userClient.rpc("can_access_captacao");
   if(aclError||allowed!==true)return response({error:"Access denied"},403);
 }
 const {data:log,error:logError}=await client.from("captacao_radar_sincronizacoes").insert({status:"executando"}).select("id").single();
 if(logError)return response({error:"Unable to start sync"},500);
 let found=0,created=0;const errors:string[]=[];
 const seenPNCP=new Set<string>(); const progress:any[]=[];
 try{
  for(const source of SOURCES){
   try{
    const {data:row,error:sourceError}=await client.from("captacao_radar_fontes").upsert(source,{onConflict:"url"}).select("id").single();
    if(sourceError)throw sourceError;
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);
    let html="";try{const res=await fetch(source.url,{signal:controller.signal,headers:{"user-agent":"RKC-Editais-Radar/1.0"}});if(!res.ok)throw Error("HTTP "+res.status);html=await res.text();}finally{clearTimeout(timer);}
    // Extract only real official links from the Ministry's listing; no inferred deadlines or awards.
    const pattern=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const seen=new Set<string>();let match:RegExpExecArray|null;
    while((match=pattern.exec(html))!==null){
      const title=clean(match[2]);if(title.length<14||title.length>230||!/edital|programa rouanet|chamada|fomento|bolsa|pr[eê]mio|sele[cç][aã]o/i.test(title))continue;
      let url:URL;try{url=new URL(match[1],source.url);}catch{continue;}
      if(url.hostname!=="www.gov.br"||!url.pathname.startsWith("/cultura/pt-br/assuntos/editais/"))continue;
      url.hash="";url.search="";const link=url.toString();if(link===source.url||seen.has(link))continue;seen.add(link);found++;
      const {data:existing,error:checkError}=await client.from("captacao_radar_oportunidades").select("id").eq("url_oficial",link).maybeSingle();if(checkError)throw checkError;
      if(existing)continue;
      const {error:insertError}=await client.from("captacao_radar_oportunidades").insert({fonte_id:row.id,titulo:title,organizador:"Ministério da Cultura",url_oficial:link,status_triagem:"nao_verificado",resumo:"Prazo, valores e elegibilidade aguardam conferência no edital oficial."});
      if(insertError)throw insertError;created++;
    }
   }catch(e){errors.push(source.nome+": "+String(e));}
  }

  // PNCP: apenas novas oportunidades; nunca altera triagens humanas.
  try {
    const pncpSource={nome:"PNCP — Contratações públicas",url:"https://pncp.gov.br/app/editais"};
    const {data:pncpRow,error:pncpSourceError}=await client.from("captacao_radar_fontes").upsert(pncpSource,{onConflict:"url"}).select("id").single();
    if(pncpSourceError)throw pncpSourceError;
    const term=/cultura|patrim[oô]nio|museu|mem[oó]ria|quilomb|comunica[cç][aã]o|assessoria|imprensa|publicidade|audiovisual|document[aá]rio|filmagem|v[ií]deo|cinema|fotografia|educa[cç][aã]o|forma[cç][aã]o|capacita[cç][aã]o|direitos humanos|design|identidade visual|diagrama[cç][aã]o|editora[cç][aã]o|software|site|portal|aplicativo|marketing|m[ií]dia/i;
    const modalities=[1,4,6,8,9,12,13];
    // Three bounded workers; each modality retains sequential pagination.
    await Promise.all(Array.from({length:3},async()=>{
      while(modalities.length){
        const modality=modalities.shift()!;
        const result=await collectPages(modality,deadline,async(items)=>{
          const candidates=[];
          for(const item of items){
            const title=String(item.objetoCompra??"").trim();
            if(!term.test(title))continue;
            const m=/^(\d{14})-(\d+)-(\d{4})$/.exec(String(item.numeroControlePNCP??""));
            if(!m)continue;
            const link="https://pncp.gov.br/app/editais/"+m[1]+"/"+m[3]+"/"+m[2];
            if(seenPNCP.has(link))continue;
            seenPNCP.add(link);found++;
            const deadline=String(item.dataEncerramentoProposta??"").slice(0,10);
            candidates.push({fonte_id:pncpRow.id,titulo:title.slice(0,500),organizador:String(item.orgaoEntidade?.razaoSocial??"Órgão não informado"),url_oficial:link,prazo:/^\d{4}-\d{2}-\d{2}$/.test(deadline)?deadline:null,valor_estimado:typeof item.valorTotalEstimado==="number"?item.valorTotalEstimado:null,area:"Licitações e contratos",resumo:"Oportunidade identificada no PNCP. Requisitos e elegibilidade dependem de análise do edital oficial.",status_triagem:"nao_verificado"});
          }
          if(candidates.length){
            // ON CONFLICT DO NOTHING: never overwrite a human review or existing row.
            const {data:inserted,error}=await client.from("captacao_radar_oportunidades")
              .upsert(candidates,{onConflict:"url_oficial",ignoreDuplicates:true}).select("id")
              .abortSignal(AbortSignal.timeout(Math.max(1,Math.min(10_000,deadline-Date.now()))));
            if(error)throw error;
            created+=inserted?.length??0;
          }
        });
        progress.push(result);
        console.log(JSON.stringify({sincronizacao:log.id,...result}));
        if(result.erro)errors.push(result.erro);
      }
    }));
  }catch(e){errors.push("PNCP: "+String(e));}
  const status=errors.length?"erro":"sucesso";
  const {error:finishError}=await client.from("captacao_radar_sincronizacoes").update({status,finalizada_em:new Date().toISOString(),encontradas:found,novas:created,erro:errors.join(" | ")||null}).eq("id",log.id);
  if(finishError)throw finishError;
  return response({status,encontradas:found,novas:created,erros:errors,pncp:progress});
 }catch(e){await client.from("captacao_radar_sincronizacoes").update({status:"erro",finalizada_em:new Date().toISOString(),erro:String(e)}).eq("id",log.id);return response({error:"Synchronization failed"},500);}
});
