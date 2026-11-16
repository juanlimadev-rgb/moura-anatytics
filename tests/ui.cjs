const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {fork}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const output=path.join(root,'test-results','ui');fs.mkdirSync(output,{recursive:true});
const data=fs.mkdtempSync(path.join(os.tmpdir(),'Moura UI São Luís '));
async function startBackend() {
  const child=fork(path.join(root,'Backend','server.js'),[],{env:{...process.env,MOURA_DATA_DIR:data,PORT:'0'},stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});
  let stderr='';child.stderr.on('data',d=>stderr+=d);
  const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Backend timeout '+stderr)),15000);child.on('message',m=>{if(m.type==='ready'){clearTimeout(timer);resolve(m.port);}});child.once('exit',()=>{clearTimeout(timer);reject(Error(stderr));});});
  return {child,base:`http://127.0.0.1:${port}`};
}
async function stopBackend(child) {await new Promise(resolve=>{child.once('exit',resolve);child.send({type:'shutdown'});});}
async function run() {
  let service,browser;const errors=[],checks=[];
  try {
    service=await startBackend();
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
    const login=async(name)=>{
      await page.goto(service.base+'/login.html');await page.locator('#email').fill(name+'@example.test');await page.locator('#senha').fill('teste-ficticio');await page.locator('[type=submit]').click();await page.waitForURL('**/index.html');
    };
    const createProfile=async(name)=>{
      await page.goto(service.base+'/cadastro.html');await page.locator('#nome').fill('Perfil '+name);await page.locator('#email').fill(name+'@example.test');await page.locator('#senha').fill('teste-ficticio');
      await page.locator('[type=submit]').click();await page.waitForURL('**/login.html');await login(name);
    };
    await createProfile('a');checks.push('Perfil A criado e autenticado pela interface');
    for(const [id,value] of Object.entries({campeonato:'Copa UI',local:'São Luís',adversario:'Oponentes',data_partida:'2026-01-20','video-url':'https://example.test/jogo'})) await page.locator('#'+id).fill(value);
    await page.getByRole('button',{name:'Cadastrar atleta',exact:true}).click();
    const sharp=require('sharp');
    const image=path.join(output,'foto-referencia.png');await sharp({create:{width:150,height:240,channels:3,background:'#0f766e'}}).png().toFile(image);
    for(const name of ['Ana Patrícia','Duda']) {
      await page.locator('#athlete-nome').fill(name);await page.locator('#athlete-clube').fill('Clube Referência');await page.locator('#athlete-photo').setInputFiles(image);
      await page.waitForFunction(()=>document.querySelector('#photo-preview img')?.complete);
      await page.screenshot({path:path.join(output,'cadastro-'+(name==='Duda'?'2':'1')+'.png')});
      await page.locator('#athlete-form [type=submit]').click();await page.waitForFunction(()=>document.getElementById('athlete-nome').value==='');
    }
    await page.locator('#athlete-search').fill('patr');await page.waitForFunction(()=>document.querySelectorAll('#athlete-list .roster-card').length===1);
    assert.match(await page.locator('#athlete-list').innerText(),/Ana Patrícia/);await page.locator('#athlete-search').fill('');
    await page.locator('#roster-dialog').getByRole('button',{name:'Duplas',exact:true}).click();
    await page.locator('#pair-one').selectOption('1');await page.locator('#pair-two').selectOption('2');await page.locator('#pair-form [type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#pair-list .roster-card').length===1);
    await page.locator('#pair-one').selectOption('2');await page.locator('#pair-two').selectOption('1');await page.locator('#pair-form [type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#pair-form [type=submit]').disabled);
    assert.equal(await page.locator('#pair-list .roster-card').count(),1);checks.push('Dois atletas com clube/foto, busca, dupla e reutilização invertida');
    await page.getByRole('button',{name:'Voltar à partida',exact:true}).click();assert.equal(await page.locator('#campeonato').inputValue(),'Copa UI');
    await page.locator('#swap-positions').click();assert.equal(await page.locator('#atleta1').inputValue(),'Duda');
    await page.locator('#swap-positions').click();assert.equal(await page.locator('#atleta1').inputValue(),'Ana Patrícia');
    await page.screenshot({path:path.join(output,'partida-1440.png')});
    await page.locator('#btn-iniciar-partida').click();await page.waitForFunction(()=>document.getElementById('partida-status').textContent.includes('iniciada com ID'));
    assert.equal(await page.locator('#match-pair').isDisabled(),true);
    const record=async(position,fund,result,set)=>{
      await page.locator('#set_atleta'+position).selectOption(String(set));
      const button=page.locator(`.action-btn[data-atleta="${position}"][data-fundamento="${fund}"][data-resultado="${result}"]`);
      await button.click();await page.waitForFunction(sel=>!document.querySelector(sel).disabled,`.action-btn[data-atleta="${position}"][data-fundamento="${fund}"][data-resultado="${result}"]`);
    };
    await record(1,'ataque','ponto',1);await page.locator('#btn-desfazer').click();await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===0);
    for(const [pos,set,result] of [[1,1,'ponto'],[1,1,'erro'],[1,1,'bloqueado'],[2,2,'ponto'],[2,2,'neutro']])await record(pos,'ataque',result,set);
    // Dois cliques síncronos durante a mesma gravação devem produzir só um registro.
    await page.locator('[data-atleta="2"][data-fundamento="saque"][data-resultado="ace"]').evaluate(el=>{el.click();el.click();});
    await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===6);
    await page.route('**/evento',async route=>{await page.waitForTimeout(150);await route.continue();});
    await page.evaluate(()=>{
      document.getElementById('set_atleta1').value='1';
      document.querySelector('[data-atleta="1"][data-fundamento="bloqueio"][data-resultado="neutro"]').click();
      document.querySelector('[data-atleta="1"][data-fundamento="defesa"][data-resultado="excelente"]').click();
      document.getElementById('set_atleta1').value='2';
    });
    await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===8);
    assert.deepEqual(await page.locator('.log-entry .log-set').allTextContents().then(rows=>rows.slice(0,2)),['1º SET','1º SET']);
    await page.locator('#btn-desfazer').click();await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===7);await page.locator('#btn-desfazer').click();await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===6);await page.unroute('**/evento');checks.push('Fila de marcação preserva o set do momento do clique, mesmo após trocar o seletor');
    for(const [id,value] of Object.entries({final_set1_dupla:'21',final_set1_adv:'18',final_set2_dupla:'17',final_set2_adv:'21',final_set3_dupla:'15',final_set3_adv:'13'}))await page.locator('#'+id).fill(value);
    await page.locator('#btn-finalizar-partida').click();await page.waitForFunction(()=>document.getElementById('finalizacao-status').textContent.includes('2 x 1'));
    await page.locator('.btn-analisar').click();await page.waitForFunction(()=>document.querySelectorAll('.stat-card').length===7);
    const attack=page.locator('.stat-card').filter({has:page.getByRole('heading',{name:'Ataque',exact:true})});
    assert.match(await attack.innerText(),/5 registros/);checks.push('Marcação dos dois atletas, múltiplos sets, desfazer, clique duplicado e finalização');
    await page.locator('#analysis-type').selectOption('atleta1');await page.waitForFunction(()=>document.getElementById('analysis-status').textContent.includes('Ana Patrícia'));
    assert.match(await attack.innerText(),/-33\.33%/);
    await page.locator('#analysis-set').selectOption('2');await page.waitForFunction(()=>document.getElementById('analysis-status').textContent.includes('Set 2'));
    assert.match(await attack.innerText(),/0 registros/);assert.match(await attack.innerText(),/Nenhum registro/);
    await page.locator('#analysis-type').selectOption('atleta2');await page.waitForFunction(()=>document.getElementById('analysis-status').textContent.includes('Duda'));
    assert.match(await attack.innerText(),/2 registros/);assert.match(await attack.innerText(),/50\.00%/);
    for(const width of [1440,1100,900]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'sem rolagem horizontal '+width);
      await page.screenshot({path:path.join(output,`dashboard-${width}.png`),fullPage:true});
    }
    // Primeira resposta é atrasada e o abort é removido no teste para exercitar também o contador de versão.
    await page.evaluate(()=>{const original=window.fetch;window.fetch=async(input,options={})=>{if(String(input).includes('/dashboard')){const result=await original(input,{...options,signal:undefined});if(String(input).includes('tipo=atleta1'))await new Promise(resolve=>setTimeout(resolve,350));return result;}return original(input,options);};});
    await page.locator('#analysis-type').selectOption('atleta1');await page.locator('#analysis-set').selectOption('1');await page.locator('#analysis-type').selectOption('atleta2');await page.locator('#analysis-set').selectOption('2');
    await page.waitForFunction(()=>document.getElementById('analysis-status').textContent==='Seleção ativa: Duda · Set 2');await page.waitForTimeout(450);
    assert.equal(await page.locator('#analysis-status').innerText(),'Seleção ativa: Duda · Set 2');assert.match(await attack.innerText(),/2 registros/);checks.push('Filtros combinados, seleção sem dados e resposta antiga ignorada');
    for(const type of ['atleta1','atleta2','dupla']) {
      const downloadPromise=page.waitForEvent('download');await page.locator(`[data-pdf-type="${type}"]`).click();const download=await downloadPromise;await download.saveAs(path.join(output,'partida-'+type+'.pdf'));
    }
    checks.push('Três downloads PDF pela interface, rotulados como partida inteira');
    const tokenA=await page.evaluate(()=>localStorage.getItem('token'));
    await stopBackend(service.child);service=await startBackend();
    await login('a');assert.equal(await page.locator('.btn-analisar').count(),1);await page.locator('.btn-analisar').click();await page.waitForFunction(()=>document.querySelectorAll('#analysis-people img').length===2 && [...document.querySelectorAll('#analysis-people img')].every(i=>i.complete&&i.naturalWidth>0));
    assert.match(await page.locator('#analysis-meta').innerText(),/2 x 1/);checks.push('Backend fechado/reaberto; nomes, clube, fotos, dupla, link e partida persistem');
    await createProfile('b');assert.equal(await page.locator('.btn-analisar').count(),0);
    const status=await page.evaluate(async()=>{const r=await fetch('/partidas/1/dashboard',{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});return r.status;});assert.equal(status,404);
    await page.getByRole('button',{name:'Atletas',exact:true}).click();await page.waitForFunction(()=>document.getElementById('athlete-list').textContent.includes('Nenhum atleta'));checks.push('Perfil B pela interface, lista vazia e acesso direto à partida A negado');
    assert.deepEqual(errors,[]);checks.push('Sem erros JavaScript; larguras 1440, 1100 e 900 sem rolagem horizontal');
    fs.rmSync(path.join(output,'failure.txt'),{force:true});fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
  }catch(e){fs.writeFileSync(path.join(output,'failure.txt'),e.stack);throw e;}
  finally{if(browser)await browser.close();if(service?.child.connected)await stopBackend(service.child);}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
module.exports={run};
