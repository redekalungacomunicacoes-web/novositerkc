import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{env:{...process.env,VITE_SUPABASE_URL:'https://fixture.supabase.co',VITE_SUPABASE_ANON_KEY:'fixture-public-key'},stdio:'ignore'});
for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:5173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
import {createRequire} from 'node:module';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/package.json`:import.meta.url);
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||chromium.executablePath()});
const user='00000000-0000-4000-8000-000000000001';
try{for(const width of [390,1440]){
 const context=await browser.newContext({viewport:{width,height:1000}});
 const jwt=[{alg:'HS256',typ:'JWT'},{sub:user,role:'authenticated',exp:Math.floor(Date.now()/1000)+36000},'fixture'].map(v=>typeof v==='string'?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 await context.addInitScript(({jwt,user})=>localStorage.setItem('sb-fixture-auth-token',JSON.stringify({access_token:jwt,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+36000,user:{id:user,email:'test@example.invalid'}})),{jwt,user});
 const page=await context.newPage(),errors=[],counts={};page.on('pageerror',e=>errors.push(e.message));
 const editais=[{id:'ed1',title:'Edital de teste',funder:'Instituto',category:'Cultura',protocol:'TEST-1',deadline:'2026-12-01',status:'pending_eligibility',eligibility_status:'pending_verification',created_at:'2026-10-22'}];
 const requirements=[{id:'req1',edital_id:'ed1',description:'Comprovar atuação',status:'pending'}];
 const tasks=[{id:'task1',edital_id:'ed1',title:'Preparar proposta',status:'pendente',priority:'media',assignee_id:'member',assignee:{nome:'Felipe'}}];
 await page.route('https://fixture.supabase.co/**',async route=>{
  const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').at(-1);counts[table]=(counts[table]||0)+1;let data=[];
  if(u.pathname.includes('/functions/'))throw new Error('Não deve executar coleta');
  if(u.pathname.includes('/auth/'))data={id:user,email:'test@example.invalid',aud:'authenticated',role:'authenticated'};
  if(table==='user_roles')data=[{role_id:'role',roles:{name:'admin'}}];
  if(table==='equipe')data=[{id:'member',nome:'Felipe',user_id:user,ativo:true}];
  if(table==='captacao_editais'){
   if(req.method()==='POST')editais.push({...req.postDataJSON(),id:'ed2',protocol:'TEST-2',created_at:'2026-10-22'});
   if(req.method()==='PATCH')Object.assign(editais.find(e=>e.id===u.searchParams.get('id')?.replace('eq.','')),req.postDataJSON());
   data=editais;
  }
  if(table==='captacao_requisitos'){if(req.method()==='PATCH')Object.assign(requirements[0],req.postDataJSON());data=requirements;}
  if(table==='captacao_tarefas'){if(req.method()==='PATCH')Object.assign(tasks[0],req.postDataJSON());data=tasks;}
  if(table==='captacao_radar_oportunidades')data=[{id:'rad1',titulo:'Oportunidade Radar',organizador:'MinC',url_oficial:'https://example.org/edital',prazo:'2026-12-01',area:'Cultura',status_triagem:'nao_verificado',resumo:'Resumo oficial'}];
  if(table==='captacao_radar_sincronizacoes')data=[{id:1,iniciada_em:'2026-10-22T09:15:00Z',finalizada_em:'2026-10-22T09:16:00Z',status:'sucesso',encontradas:1,novas:1}];
  if(table==='captacao_radar_fontes')data=[{id:'src',nome:'MinC',url:'https://example.org',ativa:true}];
  if(table==='finance_projects')data=[{id:'fin1',name:'Projeto financeiro',status:'em_andamento',initial_amount:1000,current_balance:500}];
  if(table==='finance_movements')data=[{id:'mov1',project_id:'fin1',title:'Parcela 1',date:'2026-10-21',total_value:500,status:'pago'}];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5173/admin/editais');
 await page.getByRole('tab',{name:'Radar e inscrições',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Situação no Radar').count(),0);
 await page.getByRole('button',{name:'Filtros do Radar',exact:true}).click();
 await page.getByLabel('Área no Radar',{exact:true}).selectOption('Cultura');
 await page.getByRole('button',{name:'Ver resultados',exact:true}).click();await page.locator('[data-slot="popover-content"]').waitFor({state:'detached'});
 await page.getByLabel('Área no Radar',{exact:true}).waitFor({state:'detached'});
 assert.match(await page.getByRole('button',{name:'Filtros do Radar',exact:true}).innerText(),/Filtros\s*1/);
 await page.getByRole('button',{name:'Filtros do Radar',exact:true}).click();
 assert.equal(await page.getByLabel('Área no Radar',{exact:true}).inputValue(),'Cultura');
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.keyboard.press('Escape');await page.locator('[data-slot="popover-content"]').waitFor({state:'detached'});
 await page.getByRole('button',{name:'Filtros das inscrições',exact:true}).click();
 await page.getByLabel('Filtrar inscrições por prazo').selectOption('none');
 await page.getByRole('button',{name:'Ver resultados',exact:true}).click();await page.locator('[data-slot="popover-content"]').waitFor({state:'detached'});
 assert.equal(await page.getByRole('button',{name:/Abrir Edital de teste/}).count(),0);
 await page.getByRole('button',{name:'Filtros das inscrições',exact:true}).click();
 await page.getByRole('button',{name:'Limpar filtros',exact:true}).click();await page.keyboard.press('Escape');await page.locator('[data-slot="popover-content"]').waitFor({state:'detached'});
 await page.getByLabel('Pesquisar no Radar').fill('inexistente');assert.equal(await page.getByText('Oportunidade Radar',{exact:true}).count(),0);
 await page.getByRole('tab',{name:'Radar e inscrições',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.getByText('Parcela 1 · R$ 500,00').waitFor();
 await page.getByLabel('Projeto dos repasses').selectOption('fin1');const n=counts.finance_movements;
 await page.getByRole('tab',{name:'Carteira RKC',exact:true}).click();await page.getByRole('heading',{name:'Carteira de projetos da RKC'}).waitFor();
 await page.getByRole('tab',{name:'Gestão',exact:true}).click();await page.getByRole('heading',{name:'Fontes de monitoramento'}).waitFor();
 await page.getByRole('tab',{name:'Repasses',exact:true}).click();assert.equal(await page.getByLabel('Projeto dos repasses').inputValue(),'fin1');assert.equal(counts.finance_movements,n);
 await page.getByRole('tab',{name:'Radar e inscrições',exact:true}).click();assert.equal(await page.getByLabel('Pesquisar no Radar').inputValue(),'inexistente');await page.getByLabel('Pesquisar no Radar').fill('');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`/tmp/captacao-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Adicionar edital',exact:true}).click();await page.getByPlaceholder('Nome do edital').fill('Novo teste');await page.getByPlaceholder('Instituição / financiador').fill('Teste');await page.getByRole('button',{name:'Cadastrar edital',exact:true}).click();await page.getByRole('heading',{name:'Novo teste',exact:true}).waitFor();
 await page.getByRole('button',{name:/Abrir Edital de teste/}).click();
 await page.getByRole('button',{name:/Elegibilidade/}).click();
 await page.getByLabel('Situação do requisito Comprovar atuação').selectOption('met');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Situação do requisito Comprovar atuação"]')?.value==='met');
 assert.equal(await page.getByLabel('Situação do requisito Comprovar atuação').inputValue(),'met');
 await page.getByRole('button',{name:/^Tarefas/}).click();
 await page.getByLabel('Situação de Preparar proposta').selectOption('concluida');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Situação de Preparar proposta"]')?.value==='concluida');
 await page.reload();await page.getByRole('button',{name:/^Tarefas/}).waitFor();await page.getByRole('button',{name:/^Tarefas/}).click();
 await page.getByLabel('Situação de Preparar proposta').waitFor();assert.equal(await page.getByLabel('Situação de Preparar proposta').inputValue(),'concluida');
 await page.getByRole('button',{name:'Editar edital',exact:true}).click();
 await page.getByPlaceholder('Nome do edital').fill('Edital atualizado');await page.getByRole('dialog').locator('select').selectOption('aguardando_avaliacao');
 await page.getByRole('button',{name:'Salvar alterações',exact:true}).click();await page.getByRole('heading',{name:'Edital atualizado',exact:true}).waitFor();
 assert.equal(editais[0].status,'aguardando_avaliacao');
 await page.reload();await page.getByRole('heading',{name:'Edital atualizado',exact:true}).waitFor();
 assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px: abas, filtros, cache, cadastro, checklist, sem erros`);
}}finally{await browser.close();server.kill();}
