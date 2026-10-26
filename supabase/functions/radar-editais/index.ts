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
Deno.serve(async(req)=>{
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
    const today=new Date(), start=new Date(today.getTime()-3*86400000);
    const stamp=(d:Date)=>d.toISOString().slice(0,10).replaceAll("-","");
    const term=/cultura|patrim[oô]nio|museu|mem[oó]ria|quilomb|comunica[cç][aã]o|assessoria|imprensa|publicidade|audiovisual|document[aá]rio|filmagem|v[ií]deo|cinema|fotografia|educa[cç][aã]o|forma[cç][aã]o|capacita[cç][aã]o|direitos humanos|design|identidade visual|diagrama[cç][aã]o|editora[cç][aã]o|software|site|portal|aplicativo|marketing|m[ií]dia/i;
    for(const modality of [1,4,6,8,9,12,13]){
      try{
        for(let page=1;page<=2;page++){
          const api=new URL("https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao");
          for(const [k,v] of Object.entries({dataInicial:stamp(start),dataFinal:stamp(today),codigoModalidadeContratacao:String(modality),pagina:String(page),tamanhoPagina:"50"}))api.searchParams.set(k,v);
          const res=await fetch(api,{signal:AbortSignal.timeout(12000),headers:{accept:"application/json"}});
          if(!res.ok)throw Error("HTTP "+res.status);
          const body=await res.json();
          if(!Array.isArray(body.data))throw Error("Resposta PNCP inválida");
          for(const item of body.data){
            const title=String(item.objetoCompra??"").trim();
            if(!term.test(title))continue;
            const m=/^(\d{14})-(\d+)-(\d{4})$/.exec(String(item.numeroControlePNCP??""));
            if(!m)continue;
            const link="https://pncp.gov.br/app/editais/"+m[1]+"/"+m[3]+"/"+m[2];
            found++;
            const {data:existing,error:checkError}=await client.from("captacao_radar_oportunidades").select("id").eq("url_oficial",link).limit(1);
            if(checkError)throw checkError;
            if(existing?.length)continue;
            const deadline=String(item.dataEncerramentoProposta??"").slice(0,10);
            const {error:insertError}=await client.from("captacao_radar_oportunidades").insert({fonte_id:pncpRow.id,titulo:title.slice(0,500),organizador:String(item.orgaoEntidade?.razaoSocial??"Órgão não informado"),url_oficial:link,prazo:/^\d{4}-\d{2}-\d{2}$/.test(deadline)?deadline:null,valor_estimado:typeof item.valorTotalEstimado==="number"?item.valorTotalEstimado:null,area:"Licitações e contratos",resumo:"Oportunidade identificada no PNCP. Requisitos e elegibilidade dependem de análise do edital oficial.",status_triagem:"nao_verificado"});
            if(insertError?.code==="23505")continue;
            if(insertError)throw insertError;
            created++;
          }
          if(page>=Number(body.totalPaginas??1))break;
          if(page===2)errors.push("PNCP modalidade "+modality+": coleta parcial; páginas adicionais disponíveis");
        }
      }catch(e){errors.push("PNCP modalidade "+modality+": "+String(e));}
    }
  }catch(e){errors.push("PNCP: "+String(e));}
  const status=errors.length?"erro":"sucesso";
  await client.from("captacao_radar_sincronizacoes").update({status,finalizada_em:new Date().toISOString(),encontradas:found,novas:created,erro:errors.join(" | ")||null}).eq("id",log.id);
  return response({status,encontradas:found,novas:created,erros:errors});
 }catch(e){await client.from("captacao_radar_sincronizacoes").update({status:"erro",finalizada_em:new Date().toISOString(),erro:String(e)}).eq("id",log.id);return response({error:"Synchronization failed"},500);}
});
