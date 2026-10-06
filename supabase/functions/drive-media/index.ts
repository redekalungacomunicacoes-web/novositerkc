/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadDriveFile } from "../_shared/google-drive.ts";

type CachedMedia={file:any;expiresAt:number};
const mediaCache=new Map<string,CachedMedia>();
const CACHE_TTL=5*60*1000;
const CACHE_MAX=500;
function getCached(slug:string){const item=mediaCache.get(slug);if(!item)return null;if(item.expiresAt<=Date.now()){mediaCache.delete(slug);return null;}return item.file;}
function putCached(slug:string,file:any){if(mediaCache.size>=CACHE_MAX){const first=mediaCache.keys().next().value;if(first)mediaCache.delete(first);}mediaCache.set(slug,{file,expiresAt:Date.now()+CACHE_TTL});}

Deno.serve(async(req)=>{
 if(req.method!=="GET"&&req.method!=="HEAD")return new Response("Method not allowed",{status:405});
 const supabaseUrl=Deno.env.get("SUPABASE_URL"),serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!supabaseUrl||!serviceRole)return new Response("Backend configuration error",{status:500});
 const slug=new URL(req.url).searchParams.get("id")?.trim();if(!slug)return new Response("Not found",{status:404});
 const admin=createClient(supabaseUrl,serviceRole,{auth:{persistSession:false}});
 let file=getCached(slug);
 if(!file){
  const result=await admin.from("drive_files").select("id,drive_file_id,name,mime_type,size_bytes,module,entity_id,category").eq("public_slug",slug).eq("visibility","public").eq("status","active").is("deleted_at",null).single();
  file=result.data;if(result.error||!file)return new Response("Not found",{status:404});
  if(file.module==="materias"){
   const {data:materia}=await admin.from("materias").select("id,status,capa_drive_file_id,capa_thumb_drive_file_id,banner_drive_file_id,audio_drive_file_id,content_blocks").eq("id",file.entity_id).eq("status","published").maybeSingle();if(!materia)return new Response("Not found",{status:404});
   let linked=false;if(file.category==="cover")linked=materia.capa_drive_file_id===file.id;else if(file.category==="cover_thumb")linked=materia.capa_thumb_drive_file_id===file.id;else if(file.category==="banner")linked=materia.banner_drive_file_id===file.id;else if(file.category==="audio")linked=materia.audio_drive_file_id===file.id;else if(file.category==="content"){const blocks=Array.isArray(materia.content_blocks)?materia.content_blocks:[];linked=blocks.some((block:any)=>block?.drive_file_id===file.id);}else if(file.category==="gallery"){const {data:item}=await admin.from("materia_galeria").select("id").eq("materia_id",file.entity_id).eq("drive_file_id",file.id).maybeSingle();linked=!!item;}if(!linked)return new Response("Not found",{status:404});
  }
  if(file.module==="projetos"){
   const {data:project}=await admin.from("projetos").select("id,capa_drive_file_id,cover_card_drive_file_id").eq("id",file.entity_id).eq("publicado_transparencia",true).maybeSingle();if(!project)return new Response("Not found",{status:404});
   let linked=file.category==="cover"&&project.capa_drive_file_id===file.id||file.category==="cover_card"&&project.cover_card_drive_file_id===file.id;if(file.category==="gallery"||file.category==="gallery_thumb"){const {data:gallery}=await admin.from("projeto_galeria").select("id").eq("projeto_id",project.id).eq(file.category==="gallery"?"drive_file_id":"thumb_drive_file_id",file.id).limit(1);linked=!!gallery?.length;}if(!linked)return new Response("Not found",{status:404});
  }
  if(file.module==="team"){
   const member=await admin.from("equipe").select("id,avatar_drive_file_id,avatar_thumb_drive_file_id").eq("id",file.entity_id).eq("ativo",true).eq("is_public",true).maybeSingle();if(!member.data)return new Response("Not found",{status:404});if(file.category==="portfolio"){const item=await admin.from("team_member_portfolio").select("id").eq("drive_file_id",file.id).eq("is_public",true).maybeSingle();if(!item.data)return new Response("Not found",{status:404});}else if(![member.data.avatar_drive_file_id,member.data.avatar_thumb_drive_file_id].includes(file.id))return new Response("Not found",{status:404});
  }
  putCached(slug,file);
 }
 try{const drive=await downloadDriveFile(file.drive_file_id,req.headers.get("Range"));const headers=new Headers();headers.set("Content-Type",file.mime_type||drive.headers.get("Content-Type")||"application/octet-stream");headers.set("Cache-Control",["materias","projetos"].includes(file.module)?"public, max-age=31536000, s-maxage=31536000, immutable":"public, max-age=86400, s-maxage=86400");headers.set("X-Content-Type-Options","nosniff");headers.set("Accept-Ranges","bytes");headers.set("Timing-Allow-Origin","*");headers.set("X-RKC-Media-Auth",getCached(slug)?"cached":"db");for(const name of["Content-Length","Content-Range","ETag","Last-Modified"]){const value=drive.headers.get(name);if(value)headers.set(name,value);}if(req.method==="HEAD")return new Response(null,{status:drive.status,headers});return new Response(drive.body,{status:drive.status,headers});}catch{return new Response("Media unavailable",{status:502});}
});
