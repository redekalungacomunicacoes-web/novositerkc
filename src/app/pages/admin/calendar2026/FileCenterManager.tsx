import { useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FolderOpen, FolderPlus, MoveRight, Pencil, Trash2, Upload, X } from "lucide-react";
import { createCenterFolder, deleteCenterFolder, listCenterFolders, listCenterFolderFiles, moveCenterFile, renameCenterFolder, trashRkcDriveFile, uploadRkcDriveFile } from "../../../../services/driveFiles";
import type { CenterFolder } from "../../../../services/driveFiles";
import { openTaskAttachment } from "./tasksApi";
import type { CalendarTask, TaskAttachment } from "./types";

const keys=["file-center"] as const;
const button="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 px-3 text-sm font-medium hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:hover:bg-emerald-900";
const field="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-emerald-800 dark:bg-emerald-950";
function Sheet({title,open,onClose,busy,children}:{title:string;open:boolean;onClose:()=>void;busy:boolean;children:React.ReactNode}){
 return <Dialog.Root open={open} onOpenChange={value=>{if(!value&&!busy)onClose();}}>
 <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm"/>
 <Dialog.Content onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onInteractOutside={event=>{if(busy)event.preventDefault();}}
 className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-xl dark:bg-emerald-950 dark:text-white">
 <div className="flex items-center justify-between gap-4"><Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title><Dialog.Close disabled={busy} aria-label="Fechar" className={button}><X size={18}/></Dialog.Close></div>
 <Dialog.Description className="mt-2 text-sm text-slate-500 dark:text-emerald-100/70">Organize os arquivos da equipe no Drive RKC.</Dialog.Description>
 <div className="mt-5 space-y-4">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function useRefresh(){
 const client=useQueryClient();
 return async()=>{await Promise.all([client.invalidateQueries({queryKey:keys}),client.invalidateQueries({queryKey:["admin-tasks"]})]);};
}
export function CenterFileActions({attachment,tasks}:{attachment:TaskAttachment;tasks:CalendarTask[]}){
 const [mode,setMode]=useState<"move"|"delete"|null>(null),[target,setTarget]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const lock=useRef(false),refresh=useRefresh();
 const folders=useQuery({queryKey:[...keys,"folders"],queryFn:listCenterFolders,staleTime:30000});
 const isDrive=attachment.file_url.startsWith("drive:");
 if(!isDrive)return null;
 async function submit(){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{
   const id=attachment.file_url.slice(6);
   if(mode==="delete")await trashRkcDriveFile(id);
   else{
    if(!target)throw new Error("Escolha o destino.");
    const [kind,id]=target.split(":");
    await moveCenterFile(attachment.file_url.slice(6),kind==="folder"?{folderId:id}:{taskId:id});
   }
   await refresh();setMode(null);setTarget("");
  }catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível concluir.");}
  finally{lock.current=false;setBusy(false);}
 }
 return <>
 <button type="button" onClick={()=>{setMode("move");setError("");setTarget("");}} className={button} aria-label={`Mover ${attachment.file_name || "arquivo"}`}><MoveRight size={16}/><span className="hidden sm:inline">Mover</span></button>
 <button type="button" onClick={()=>{setMode("delete");setError("");}} className={button+" text-rose-700"} aria-label={`Excluir ${attachment.file_name || "arquivo"}`}><Trash2 size={16}/></button>
 <Sheet title={mode==="delete"?"Excluir arquivo":"Mover arquivo"} open={Boolean(mode)} onClose={()=>setMode(null)} busy={busy}>
 <p className="break-words text-sm">{attachment.file_name || "Arquivo"}</p>
 {mode==="delete"?<p className="text-sm">O arquivo será enviado à lixeira do Drive e removido dos anexos exibidos no site.</p>:<>
 <label className="grid gap-2 text-sm">Destino<select className={field} value={target} onChange={event=>setTarget(event.target.value)}>
 <option value="">Escolha uma pasta ou tarefa</option><optgroup label="Pastas e coberturas">{folders.data?.map(folder=><option key={folder.id} value={"folder:"+folder.id}>{folder.name}</option>)}</optgroup>
 <optgroup label="Tarefas">{tasks.map(task=><option key={task.id} value={"task:"+task.id}>{task.title}</option>)}</optgroup></select></label>
 {folders.isLoading?<p role="status" className="text-sm">Carregando pastas…</p>:null}
 {folders.error?<p role="alert" className="text-sm text-rose-700">Não foi possível carregar os destinos. <button type="button" onClick={()=>void folders.refetch()} className="underline">Tentar novamente</button></p>:null}
 <p className="text-sm text-slate-500">O arquivo sai do local atual e passa a usar o acesso da tarefa ou pasta escolhida.</p></>}
 {error?<p role="alert" className="text-sm text-rose-700">{error}</p>:null}
 {mode==="move" ? <p className="text-sm">Mover para outra tarefa ou pasta remove os vínculos com etapas e entrega final da tarefa original. O arquivo será preservado no destino.</p> : null}<div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={()=>setMode(null)} className={button}>Cancelar</button><button type="button" disabled={busy || (mode==="move"&&!target)} onClick={()=>void submit()} className={button+(mode==="delete"?" bg-rose-50 text-rose-700":" bg-emerald-100 text-emerald-900")}>{busy?"Processando…":mode==="delete"?"Excluir arquivo":"Mover arquivo"}</button></div>
 </Sheet></>;
}
export function FileCenterManager({tasks}:{tasks:CalendarTask[]}){
 const folders=useQuery({queryKey:[...keys,"folders"],queryFn:listCenterFolders,staleTime:30000});
 const [current,setCurrent]=useState<string|null>(null),[search,setSearch]=useState(""),[mode,setMode]=useState<"create"|"rename"|"delete"|"upload"|null>(null);
 const [name,setName]=useState(""),[selected,setSelected]=useState<CenterFolder|null>(null),[queue,setQueue]=useState<File[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const lock=useRef(false),refresh=useRefresh();
 const fileQuery=useQuery({queryKey:[...keys,"files",current],queryFn:()=>listCenterFolderFiles(current!),enabled:Boolean(current),staleTime:30000});
 const all=folders.data || [],parent=all.find(folder=>folder.id===current);
 const path=useMemo(()=>{const result:CenterFolder[]=[],seen=new Set<string>();let folder=parent;while(folder&&!seen.has(folder.id)){seen.add(folder.id);result.unshift(folder);folder=all.find(item=>item.id===folder!.parent_id);}return result;},[parent,all]);
 const visible=all.filter(folder=>folder.parent_id===current&&folder.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 const files=(fileQuery.data || []).filter(file=>file.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
 function start(next:typeof mode,folder?:CenterFolder){setMode(next);setSelected(folder || null);setName(folder?.name || "");setError("");setNotice("");setQueue([]);}
 async function submit(event?:React.FormEvent){
  event?.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError("");
  try{
   if(mode==="create")await createCenterFolder(name,current);
   if(mode==="rename"&&selected)await renameCenterFolder(selected.id,name);
   if(mode==="delete"&&selected)await deleteCenterFolder(selected.id);
   if(mode==="upload"){
    if(!current || !queue.length)throw new Error("Selecione arquivos para enviar.");
    const failed:File[]=[],details:string[]=[];
    // A shared lease serializes mutations; upload sequentially and retain only failed files.
    for(const file of queue){
     try{await uploadRkcDriveFile({file,module:"file-center",folderId:current});}
     catch(reason){failed.push(file);details.push(file.name+": "+(reason instanceof Error?reason.message:"falha no envio"));}
    }
    setQueue(failed);await refresh();
    if(failed.length){setError(details.join(" · "));return;}
   }else await refresh();
   setNotice(mode==="upload"?"Arquivos enviados.":mode==="delete"?"Pasta excluída.":mode==="rename"?"Pasta renomeada.":"Pasta criada.");setMode(null);
  }catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível concluir.");}
  finally{lock.current=false;setBusy(false);}
 }
 return <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/70 sm:p-5">
 <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold"><FolderOpen size={20}/>Pastas e coberturas</h2><p className="mt-1 text-sm text-slate-500 dark:text-emerald-100/70">Crie uma pasta para a cobertura, envie arquivos e organize sem precisar criar uma tarefa.</p></div>
 <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={()=>start("create")}><FolderPlus size={17}/>Nova pasta</button><button type="button" className={button} disabled={!current} onClick={()=>start("upload")}><Upload size={17}/>Enviar arquivos</button></div></div>
 <nav aria-label="Caminho das pastas" className="my-4 flex flex-wrap items-center gap-2 text-sm"><button type="button" onClick={()=>{setCurrent(null);setSearch("");}} className={button}>Minhas pastas</button>{path.map(folder=><button type="button" key={folder.id} onClick={()=>{setCurrent(folder.id);setSearch("");}} className={button+ " max-w-full truncate"}>{folder.name}</button>)}</nav>
 <div className="mb-4 flex flex-wrap items-center gap-2">{current?<button type="button" className={button} onClick={()=>{setCurrent(parent?.parent_id || null);setSearch("");}}><ArrowLeft size={16}/>Voltar</button>:null}<input aria-label="Buscar em pastas e coberturas" placeholder="Buscar nesta pasta" value={search} onChange={event=>setSearch(event.target.value)} className={field+" sm:max-w-xs"}/></div>
 {notice?<p role="status" className="mb-4 text-sm text-emerald-700">{notice}</p>:null}
 {folders.isLoading || (current&&fileQuery.isLoading)?<p role="status" className="py-6 text-sm">Carregando pastas e arquivos…</p>:null}
 {folders.error || fileQuery.error?<p role="alert" className="py-4 text-sm text-rose-700">Não foi possível carregar a central. <button type="button" onClick={()=>{void folders.refetch();if(current)void fileQuery.refetch();}} className="underline">Tentar novamente</button></p>:null}
 <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map(folder=><article key={folder.id} className="rounded-2xl border border-slate-200 p-3 dark:border-emerald-800">
 <button type="button" className="flex min-h-14 w-full items-center gap-3 text-left" onClick={()=>{setCurrent(folder.id);setSearch("");setNotice("");}}><FolderOpen size={25} className="shrink-0 text-emerald-600"/><span className="min-w-0 break-words font-semibold">{folder.name}</span></button>
 <div className="mt-2 flex justify-end gap-2"><button type="button" aria-label={`Renomear pasta ${folder.name}`} className={button} onClick={()=>start("rename",folder)}><Pencil size={16}/></button><button type="button" aria-label={`Excluir pasta ${folder.name}`} className={button+" text-rose-700"} onClick={()=>start("delete",folder)}><Trash2 size={16}/></button></div></article>)}</div>
 <div className="mt-3 space-y-2">{files.map(file=>{
 const attachment={id:file.id,task_id:file.task_id || "",file_name:file.name,file_url:"drive:"+file.id,created_at:file.created_at};
 return <article key={file.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3 dark:bg-emerald-900/30">
 <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{file.name}</p><p className="mt-1 text-xs text-slate-500">{((file.size_bytes || 0)/1024/1024).toFixed(1)} MB</p></div>
 <button type="button" className={button} onClick={()=>void openTaskAttachment(attachment).catch(reason=>setNotice(reason.message))}>Abrir</button>
 <CenterFileActions attachment={attachment} tasks={tasks}/></article>;
 })}</div>
 {!folders.isLoading&&!folders.error&&!(current&&fileQuery.isLoading)&&!visible.length&&!files.length?<p className="py-8 text-center text-sm text-slate-500">{search?"Nenhum resultado nesta pasta.":current?"Esta pasta está vazia. Envie arquivos ou crie uma subpasta.":"Crie sua primeira pasta para organizar uma cobertura."}</p>:null}
 <Sheet title={mode==="create"?"Nova pasta":mode==="rename"?"Renomear pasta":mode==="delete"?"Excluir pasta":"Enviar arquivos"} open={Boolean(mode)} onClose={()=>setMode(null)} busy={busy}>
 <form onSubmit={event=>void submit(event)} className="space-y-4"><fieldset disabled={busy} className="min-w-0 space-y-4">
 {mode==="create"||mode==="rename"?<label className="grid gap-2 text-sm">Nome da pasta<input autoFocus required maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder="Ex.: Cobertura da Romaria" className={field}/></label>:null}
 {mode==="delete"?<p className="break-words text-sm">Excluir “{selected?.name}”? Somente pastas vazias podem ser excluídas.</p>:null}
 {mode==="upload"?<>
 <p className="break-words text-sm">Destino: {parent?.name}</p>
 <label className="grid cursor-pointer gap-2 rounded-2xl border-2 border-dashed border-emerald-200 p-4 text-sm">Escolher arquivos<input type="file" multiple onChange={event=>{const incoming=Array.from(event.target.files || []);setQueue(old=>[...old,...incoming.filter(file=>!old.some(item=>item.name===file.name&&item.size===file.size&&item.lastModified===file.lastModified))]);event.target.value="";}}/></label>
 <p className="text-xs text-slate-500">Até 50 MB por arquivo. Itens com erro ficam na fila para tentar novamente.</p>
 {queue.map((file,index)=><div key={index} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" className={button} aria-label={`Retirar ${file.name} da fila`} onClick={()=>setQueue(old=>old.filter((_,i)=>i!==index))}><X size={14}/></button></div>)}</>:null}
 </fieldset>{error?<p role="alert" className="break-words text-sm text-rose-700">{error}</p>:null}
 <div className="flex justify-end gap-2"><button type="button" disabled={busy} className={button} onClick={()=>setMode(null)}>Cancelar</button><button type="submit" disabled={busy || (mode==="upload"&&!queue.length)} className={button+" bg-emerald-100 text-emerald-900"}>{busy?"Processando…":mode==="upload"?"Enviar arquivos":mode==="delete"?"Excluir pasta":"Salvar pasta"}</button></div></form>
 </Sheet></section>;
}
