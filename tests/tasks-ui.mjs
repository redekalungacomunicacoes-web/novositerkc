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
 let tasks=[],inserts=0,folders=0,uploads=0,failFolder=true,files=[];
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
  if(table==='drive_files')data=files;
  if(table==='drive-files'){
   if((req.headers()['content-type']??'').includes('multipart/form-data')) {
    uploads++;
    const raw=req.postDataBuffer().toString('utf8');
    assert.ok(raw.includes(tasks[0].id),'upload must reference saved task');
    const name=raw.match(/filename="([^"]+)"/)?.[1]??'arquivo.txt';
    const file={id:`uploaded-${uploads}`,task_id:tasks[0].id,name,created_at:new Date().toISOString(),status:'active',module:'tasks'};
    files.push(file);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,file})});
   }
   const b=req.postDataJSON();
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
 await dialog.locator('input[type=file]').setInputFiles([{name:'anexo-a.txt',mimeType:'text/plain',buffer:Buffer.from('Arquivo A')},{name:'anexo-b.txt',mimeType:'text/plain',buffer:Buffer.from('Arquivo B')}]);
 await dialog.getByRole('button',{name:'Criar tarefa',exact:true}).click();
 await dialog.getByText('Drive temporariamente indisponível').waitFor();assert.equal(inserts,1);
 await dialog.getByRole('button',{name:'Concluir envio',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(inserts,1);assert.equal(folders,2);assert.equal(uploads,2);
 await page.getByText('Tarefa criada com sucesso.',{exact:true}).waitFor({state:'hidden',timeout:6000});
 await page.getByRole('button',{name:'Nova tarefa',exact:true}).click();
 await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),true,'focus must stay in dialog');
 await page.getByRole('dialog').screenshot({path:`/tmp/rkc-tasks-qa/modal-${width}.png`});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});
 // Central must show Drive and legacy metadata without loading comments.
 files=[{id:'file-row',task_id:tasks[0].id,name:'arquivo.pdf',created_at:new Date().toISOString(),status:'active',module:'tasks'}];
 await page.getByRole('link',{name:'Anexos',exact:true}).click();
 await page.getByRole('button',{name:/Tarefa de teste/}).click();await page.getByText('arquivo.pdf',{exact:true}).waitFor();
 await page.screenshot({path:`/tmp/rkc-tasks-qa/anexos-${width}.png`,fullPage:true});
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
 await page.getByRole('button',{name:'Ações da tarefa'}).click();await page.getByRole('menuitem',{name:'Excluir',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Excluir tarefa',exact:true}).click();
 await page.getByRole('alertdialog').waitFor({state:'hidden'});assert.equal(tasks.length,0);assert.deepEqual(errors,[]);
 console.log(`PASS ${width}px: save/retry without duplicate, metadata, keyboard, delete, no overflow or page errors`);
 await context.close();
}
} finally {await browser.close();}
