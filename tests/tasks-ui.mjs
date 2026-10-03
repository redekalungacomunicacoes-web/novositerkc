import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json` : import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
const user='00000000-0000-0000-0000-000000000001', member='10000000-0000-0000-0000-000000000001', other='10000000-0000-0000-0000-000000000002';
await mkdir('/tmp/rkc-tasks-qa',{recursive:true});
for(let attempt=0;attempt<50;attempt++){
 try{const response=await fetch('http://127.0.0.1:5173');if(response.ok)break;}catch{}
 await new Promise(resolve=>setTimeout(resolve,100));
}
try {
for(const width of [390,768,1440]) {
 const context=await browser.newContext({viewport:{width,height:900},locale:"pt-BR"});
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:user,role:'authenticated',exp:Math.floor(Date.now()/1000)+36000},'fixture'].map(v=>typeof v==='string'?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 await context.addInitScript(({jwt,user})=>localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+36000,expires_in:36000,token_type:'bearer',user:{id:user,aud:'authenticated',role:'authenticated',email:'test@example.invalid'}})),{jwt,user});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let tasks=[],inserts=0,folders=0,uploads=0,failFolder=true,files=[],centerFolders=[],items=[],links=[],history=[],members=[],comments=[],version=0;
 const requestIds=new Set();
 await page.route('https://fixture.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').at(-1);let data=[];
  if(u.pathname.includes('/auth/')) data={id:user,aud:'authenticated',role:'authenticated',email:'test@example.invalid'};
  if(table==='user_roles')data=[{role_id:'role',roles:{name:'admin'}}];
  if(table==='equipe'){data=[{id:member,user_id:user,nome:'Criador',cargo:'Comunicador',ativo:true},{id:other,user_id:'other-auth',nome:'Responsável',cargo:'Editor',ativo:true}]; if(u.searchParams.get('user_id')) data=data.filter(e=>e.user_id===user);if(u.searchParams.get('id'))data=data.filter(e=>e.id===u.searchParams.get('id').replace('eq.',''));}
  if(table==='tasks'){
   if(req.method()==='POST'){inserts++;const v=req.postDataJSON();const row={...(Array.isArray(v)?v[0]:v),id:'20000000-0000-0000-0000-000000000001',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};tasks.push(row);data=row;}
   else if(req.method()==='PATCH'){Object.assign(tasks[0],req.postDataJSON());data={id:tasks[0].id};}
   else data=tasks;
  }
  if(table==='task_checklist_progress')data=items.length?[{task_id:tasks[0].id,total:items.length,completed:items.filter(i=>i.completed_at).length}]:[];
  if(table==='task_checklist_items')data=[...items].sort((a,b)=>a.position-b.position);
  if(table==='task_file_links')data=links;
  if(table==='task_workflow_history')data=history;
  if(table==='task_comments'){
   if(req.method()==='POST')comments.push({...req.postDataJSON(),id:crypto.randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
   data=comments;
  }
  if(table==='task_assignees')data=members.map(user_id=>({user_id}));
  if(table==='mutate_task_workflow'){
   const b=req.postDataJSON(),p=b.p_payload;
   if(!requestIds.has(b.p_request)){
    requestIds.add(b.p_request);
    const add=step=>items.push({id:crypto.randomUUID(),task_id:tasks[0].id,title:step.title,note:step.note??null,position:items.length,completed_at:null,completed_by:null,assignee_id:null,due_date:null});
    if(b.p_action==='add')add(p);
    if(b.p_action==='template'){if(p.mode==='replace')items=[];p.steps.forEach(add);}
    if(b.p_action==='toggle'){const item=items.find(i=>i.id===p.item_id);item.completed_at=p.completed?new Date().toISOString():null;item.completed_by=p.completed?member:null;}
    if(b.p_action==='edit')Object.assign(items.find(i=>i.id===p.item_id),p);
    if(b.p_action==='order')p.ids.forEach((id,index)=>items.find(i=>i.id===id).position=index);
    if(b.p_action==='delete'){items=items.filter(i=>i.id!==p.item_id);links=links.filter(l=>l.item_id!==p.item_id);}
    if(b.p_action==='metadata')Object.assign(tasks[0],p);
    if(b.p_action==='collaborators')members=p.members;
    if(b.p_action==='link')links.push({...p,id:crypto.randomUUID()});
    if(b.p_action==='unlink')links=links.filter(l=>l.id!==p.link_id);
    if(b.p_action==='review')tasks[0].status='revisao';
    if(b.p_action==='complete')tasks[0].status='concluida';
    if(b.p_action==='reopen')tasks[0].status='em_andamento';
    version++;tasks[0].workflow_version=version;
    history.unshift({id:crypto.randomUUID(),event:b.p_action,actor_id:member,detail:p,created_at:new Date().toISOString()});
   }
   data={version,total:items.length,completed:items.filter(i=>i.completed_at).length,percent:items.length?Math.round(items.filter(i=>i.completed_at).length/items.length*100):null};
  }
  if(table==='file_center_folders')data=centerFolders;
  if(table==='drive_files'){
   data=files.filter(file=>file.status==='active');
   if(u.searchParams.get('module'))data=data.filter(file=>file.module===u.searchParams.get('module').replace('eq.',''));
   if(u.searchParams.get('central_folder_id'))data=data.filter(file=>file.central_folder_id===u.searchParams.get('central_folder_id').replace('eq.',''));
  }
  if(table==='drive-files'){
   if((req.headers()['content-type']??'').includes('multipart/form-data')) {
    uploads++;
    const raw=req.postDataBuffer().toString('utf8');
    const standalone=raw.includes('file-center');
    if(!standalone)assert.ok(raw.includes(tasks[0].id),'upload must reference saved task');
    const name=raw.match(/filename="([^"]+)"/)?.[1]??'arquivo.txt';
    const file={id:`uploaded-${uploads}`,task_id:standalone?null:tasks[0].id,central_folder_id:standalone?'center-folder':null,name,created_at:new Date().toISOString(),status:'active',module:standalone?'file-center':'tasks'};
    files.push(file);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,file})});
   }
   const b=req.postDataJSON();
   if(b.action==='center-folder-create'){const folder={id:'center-folder',name:b.name,parent_id:b.parent_id,owner_user_id:user,drive_folder_id:'physical-center',created_at:new Date().toISOString()};centerFolders.push(folder);data={ok:true,folder};}
   if(b.action==='center-folder-delete'){centerFolders=centerFolders.filter(folder=>folder.id!==b.id);data={ok:true};}
   if(b.action==='center-file-move'){const file=files.find(file=>file.id===b.id);Object.assign(file,{task_id:b.task_id,central_folder_id:b.folder_id,module:b.task_id?'tasks':'file-center'});data={ok:true,file};}
   if(b.action==='trash'){const file=files.find(file=>file.id===b.id);file.status='trashed';data={ok:true,file};}
   if(b.action==='task-ensure-folder'){folders++;if(failFolder){failFolder=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Drive temporariamente indisponível'})});}data={ok:true,folder_id:'folder'};}
   if(b.action==='task-cleanup-pending')data={ok:true,pending:0};
   if(b.action==='task-delete'){tasks=[];files=[];data={ok:true,cleanup_pending:false};}
  }
  const accept=req.headers()['accept']??'';if(Array.isArray(data)&&accept.includes('vnd.pgrst.object+json'))data=data[0]??null;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5173/admin/tarefas');
 await page.getByRole('button',{name:'Nova tarefa',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByPlaceholder('Ex.: Finalizar matéria sobre o encontro comunitário').fill('Tarefa de teste');
 await dialog.getByRole('combobox').first().selectOption(other);
 await dialog.getByText('Arquivos iniciais (opcional)',{exact:true}).click();
 await dialog.locator('input[type=file]').setInputFiles([{name:'anexo-a.txt',mimeType:'text/plain',buffer:Buffer.from('Arquivo A')},{name:'anexo-b.txt',mimeType:'text/plain',buffer:Buffer.from('Arquivo B')}]);
 await dialog.getByRole('button',{name:'Criar tarefa',exact:true}).click();
 await dialog.getByText('Drive temporariamente indisponível').waitFor();assert.equal(inserts,1);
 await dialog.getByRole('button',{name:'Concluir envio',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(inserts,1);assert.equal(folders,2);assert.equal(uploads,2);
 await page.getByText('Tarefa criada com sucesso.',{exact:true}).waitFor({state:'hidden',timeout:6000});
 await page.getByRole('button',{name:'Nova tarefa',exact:true}).click();
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),true,'focus must stay in dialog');
 await page.getByRole('dialog').screenshot({path:`/tmp/rkc-tasks-qa/modal-${width}.png`});
 const overflow = await page.evaluate(() => {
  const viewport = document.documentElement.clientWidth;
  const offenders = [...document.querySelectorAll('body *')]
    .filter(el => {
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'absolute') return false;
      const rect = el.getBoundingClientRect();
      return rect.right > viewport + 1 || rect.left < -1;
    })
    .map(el => ({ tag: el.tagName, className: String(el.className || ''), left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))
    .slice(0, 10);
  return { ok: document.documentElement.scrollWidth <= innerWidth, scrollWidth: document.documentElement.scrollWidth, innerWidth, offenders };
});
assert.equal(overflow.ok,true,`overflow ${width}: ${JSON.stringify(overflow)}`);
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 // Central must show Drive and legacy metadata without loading comments.
 files=[{id:'file-row',task_id:tasks[0].id,name:'arquivo.pdf',created_at:new Date().toISOString(),status:'active',module:'tasks'}];
 await page.getByRole('link',{name:'Anexos',exact:true}).click();await page.getByRole('heading',{name:'Pastas por tarefa',exact:true}).waitFor();
 await page.getByRole('button',{name:/Tarefa de teste/}).click();await page.getByText('arquivo.pdf',{exact:true}).waitFor();
 await page.screenshot({path:`/tmp/rkc-tasks-qa/anexos-${width}.png`,fullPage:true});

 await page.getByRole('button',{name:'Nova pasta',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Nome da pasta').fill('Cobertura da Romaria');
 await page.getByRole('dialog').getByRole('button',{name:'Salvar pasta',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Cobertura da Romaria',exact:true}).click();
 await page.getByRole('button',{name:'Enviar arquivos',exact:true}).click();
 await page.getByRole('dialog').locator('input[type=file]').setInputFiles([{name:'cobertura.jpg',mimeType:'image/jpeg',buffer:Buffer.from('Foto')}]);
 await page.getByRole('dialog').getByRole('button',{name:'Enviar arquivos',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Mover cobertura.jpg',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Destino').selectOption('task:'+tasks[0].id);
 await page.getByRole('dialog').getByRole('button',{name:'Mover arquivo',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(files.find(file=>file.name==='cobertura.jpg').task_id,tasks[0].id);
 await page.getByRole('button',{name:'Mover cobertura.jpg',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Destino').selectOption('folder:center-folder');
 await page.getByRole('dialog').getByRole('button',{name:'Mover arquivo',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(files.find(file=>file.name==='cobertura.jpg').task_id,null);
 await page.getByRole('button',{name:'Excluir cobertura.jpg',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Excluir arquivo',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Minhas pastas',exact:true}).click();
 await page.getByRole('button',{name:'Excluir pasta Cobertura da Romaria',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Excluir pasta',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(centerFolders.length,0);
 await page.getByRole('link',{name:'Tarefas',exact:true}).last().click();
 await page.getByRole('button',{name:'Ações de Tarefa de teste',exact:true}).click();
 await page.getByRole('menuitem',{name:'Mover para Em andamento',exact:true}).click();
 await page.getByText('Tarefa movida para Em andamento.',{exact:true}).waitFor();
 assert.equal(tasks[0].status,'em_andamento');
 await page.getByRole('link',{name:'Calendário',exact:true}).click();
 // Open the day from the month grid on every breakpoint.
 const day=tasks[0].data_inicio.split('-').reverse().join('/');
 await page.getByRole('button',{name:`Abrir tarefas de ${day}`,exact:true}).click();
 const taskRow=page.getByRole('dialog').getByRole('button',{name:/Tarefa de teste/});
 if(await taskRow.count())await taskRow.click();
 await page.getByRole('button',{name:'Ações da tarefa'}).waitFor();
 await page.getByRole('button',{name:'Ações da tarefa'}).click();await page.getByRole('menuitem',{name:'Editar',exact:true}).click();
 await page.getByRole('dialog').getByPlaceholder('Ex.: Finalizar matéria sobre o encontro comunitário').fill('Tarefa revisada');
 await page.getByRole('dialog').getByRole('button',{name:'Salvar alterações',exact:true}).click();
 await page.getByRole('dialog').getByRole('heading',{name:'Tarefa revisada',exact:true}).waitFor();
 assert.equal(inserts,1);assert.equal(await page.getByRole('dialog').getByPlaceholder('Ex.: Finalizar matéria sobre o encontro comunitário').count(),0);

 const workflow=page.getByRole('region',{name:'Acompanhamento da entrega'});
 await workflow.getByText('Etapas ainda não definidas',{exact:true}).waitFor();
 await workflow.getByLabel('Nova etapa',{exact:true}).fill('Verificar fontes');await workflow.getByRole('button',{name:'Adicionar etapa',exact:true}).click();
 await workflow.getByText('0 de 1 etapas concluídas · 0%',{exact:true}).waitFor();
 await workflow.getByLabel('Nova etapa',{exact:true}).fill('Entregar texto');await workflow.getByRole('button',{name:'Adicionar etapa',exact:true}).click();
 await workflow.getByRole('button',{name:'Subir Entregar texto',exact:true}).click();await workflow.getByText('Próxima etapa: Entregar texto',{exact:true}).waitFor();
 await workflow.getByRole('checkbox',{name:'Concluir Entregar texto',exact:true}).click();await workflow.getByText('1 de 2 etapas concluídas · 50%',{exact:true}).waitFor();
 await workflow.getByRole('checkbox',{name:'Concluir Entregar texto',exact:true}).click();await workflow.getByText('0 de 2 etapas concluídas · 0%',{exact:true}).waitFor();
 await workflow.getByText('Aplicar modelo de entrega (editável)',{exact:true}).click();await workflow.getByLabel('Modelo',{exact:true}).selectOption('Design');
 assert.equal(await workflow.getByRole('button',{name:'Aplicar cópia do modelo',exact:true}).isDisabled(),true);
 await workflow.getByLabel('Como aplicar',{exact:true}).selectOption('append');await workflow.getByLabel('Etapas, uma por linha',{exact:true}).fill('Revisar arte');await workflow.getByRole('button',{name:'Aplicar cópia do modelo',exact:true}).click();
 await workflow.getByText('0 de 3 etapas concluídas · 0%',{exact:true}).waitFor();assert.equal(items.length,3);
 const initialFileCount=files.length;
 const stage=workflow.locator('article').filter({hasText:'Verificar fontes'});
 await stage.getByText('Observação, arquivos e opções',{exact:true}).click();await stage.getByRole('combobox',{name:'Vincular arquivo a Verificar fontes',exact:true}).selectOption('file-row');
 await stage.getByRole('button',{name:'Desvincular do item',exact:true}).waitFor();assert.equal(files.length,initialFileCount);
 await stage.getByRole('button',{name:'Desvincular do item',exact:true}).click();await stage.getByRole('button',{name:'Desvincular do item',exact:true}).waitFor({state:'hidden'});assert.equal(files.length,initialFileCount);
 await stage.getByLabel('Observação',{exact:true}).fill('Conferir referências e créditos');await stage.getByRole('button',{name:'Salvar etapa',exact:true}).click();
 await workflow.getByRole('tab',{name:'Organização',exact:true}).click();await workflow.getByLabel('Entrega esperada',{exact:true}).fill('Texto e arte revisados');await workflow.getByLabel('Critério de conclusão',{exact:true}).fill('Fontes verificadas e arquivos finais');
 await workflow.getByLabel('O que está faltando',{exact:true}).fill('Falta autorização de imagem');await workflow.getByLabel('Pessoa revisora',{exact:true}).selectOption(other);await workflow.getByRole('button',{name:'Salvar organização',exact:true}).click();
 await workflow.getByRole('tab',{name:'Executar',exact:true}).click();
 await workflow.getByText('Bloqueada: Falta autorização de imagem',{exact:true}).waitFor();
 await workflow.getByRole('checkbox',{name:'Concluir Verificar fontes',exact:true}).click();await workflow.getByText('1 de 3 etapas concluídas · 33%',{exact:true}).waitFor();
 await workflow.getByRole('checkbox',{name:'Concluir Entregar texto',exact:true}).click();await workflow.getByText('2 de 3 etapas concluídas · 67%',{exact:true}).waitFor();
 await workflow.getByRole('checkbox',{name:'Concluir Revisar arte',exact:true}).click();await workflow.getByText('3 de 3 etapas concluídas · 100%',{exact:true}).waitFor();assert.equal(tasks[0].status,'em_andamento');
 await workflow.getByRole('button',{name:'Solicitar revisão',exact:true}).click();await workflow.getByRole('button',{name:'Solicitar revisão',exact:true}).waitFor({state:'hidden'});assert.equal(tasks[0].status,'revisao');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.waitForFunction(()=>document.querySelectorAll('[data-sonner-toast]').length===0,{},{timeout:15000});await page.getByRole('dialog').evaluate(dialog=>{dialog.scrollTop=0;});
 await page.getByRole('dialog').screenshot({path:`/tmp/rkc-tasks-qa/checklist-${width}.png`});
 await workflow.getByRole('tab',{name:'Arquivos',exact:true}).click();await workflow.getByRole('region',{name:'Materiais gerais',exact:true}).waitFor();
 await workflow.getByRole('textbox',{name:'Buscar materiais da tarefa',exact:true}).fill('inexistente');await workflow.getByText('Nenhum material encontrado.',{exact:true}).waitFor();
 await workflow.getByRole('textbox',{name:'Buscar materiais da tarefa',exact:true}).fill('arquivo');await workflow.getByRole('button',{name:/arquivo.pdf/}).first().waitFor();
 await workflow.getByRole('tab',{name:'Comentários e check-ins',exact:true}).click();await workflow.getByRole('textbox',{name:'Novo comentário',exact:true}).fill('Fontes conferidas, aguardando revisão.');
 // Draft survives section switches; inactive panels contain no tabbable controls.
 await workflow.getByRole('tab',{name:'Relatório',exact:true}).click();assert.equal(await workflow.getByRole('textbox',{name:'Novo comentário',exact:true}).count(),0);
 await workflow.getByRole('region',{name:'Relatório da tarefa',exact:true}).waitFor();
 await workflow.getByRole('tab',{name:'Comentários e check-ins',exact:true}).click();assert.equal(await workflow.getByRole('textbox',{name:'Novo comentário',exact:true}).inputValue(),'Fontes conferidas, aguardando revisão.');
 await workflow.getByRole('button',{name:'Registrar check-in',exact:true}).click();await workflow.locator('ol li').getByText('Fontes conferidas, aguardando revisão.',{exact:true}).waitFor();assert.equal(comments.length,1);
 await page.getByRole('dialog').screenshot({path:`/tmp/rkc-tasks-qa/checkins-${width}.png`});
 await workflow.getByRole('tab',{name:'Relatório',exact:true}).click();await page.getByRole('dialog').screenshot({path:`/tmp/rkc-tasks-qa/report-${width}.png`});
 const reportTab=workflow.getByRole('tab',{name:'Relatório',exact:true});await reportTab.focus();await page.keyboard.press('ArrowLeft');await workflow.locator('[role=tab][data-state=active]').filter({hasText:'Comentários e check-ins'}).waitFor();assert.equal(await workflow.getByRole('tab',{name:'Comentários e check-ins',exact:true}).getAttribute('aria-selected'),'true');
 await workflow.getByRole('tab',{name:'Executar',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();
 await page.getByRole('link',{name:'Tarefas',exact:true}).last().click();await page.getByText('3 de 3 etapas concluídas · 100%',{exact:false}).waitFor();
 await page.getByText('Tarefa revisada',{exact:true}).click();await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'Ações da tarefa'}).click();await page.getByRole('menuitem',{name:'Excluir',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Excluir tarefa',exact:true}).click();
 await page.getByRole('alertdialog').waitFor({state:'hidden'});assert.equal(tasks.length,0);assert.deepEqual(errors,[]);
 console.log(`PASS ${width}px: save/retry without duplicate, metadata, keyboard, delete, no overflow or page errors`);
 await context.close();
}
} finally {await browser.close();}
