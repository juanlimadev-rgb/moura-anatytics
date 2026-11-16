const { _electron:electron }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const output=path.resolve(process.env.MOURA_TEST_OUTPUT_DIR || path.join(root,'test-results','packaged'));fs.mkdirSync(output,{recursive:true});
const downloadFolder=fs.mkdtempSync(path.join(output,'downloads-'));
const executable=path.resolve(process.env.MOURA_INSTALLED_EXE || path.join(root,'release','win-unpacked','Moura Analytics.exe'));
const data=process.env.MOURA_TEST_DATA_DIR || fs.mkdtempSync(path.join(os.tmpdir(),'Moura instalado São Luís '));fs.mkdirSync(data,{recursive:true});
// Evitar a escolha inicial durante o teste; o backend cria o esquema neste arquivo vazio.
if(process.env.MOURA_TEST_FIRST_RUN!=='1') fs.writeFileSync(path.join(data,'moura.db'),'');
const env={...process.env,MOURA_DATA_DIR:data,PATH:path.join(process.env.SystemRoot || 'C:/Windows','System32')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_PATH;delete env.NODE_OPTIONS;
async function run() {
  let instance;const checks=[],errors=[],externalRequests=[];let oldBase;
  let activeExecutable=executable;
  const launch=async(activeEnv=env)=>{
    const profile=path.join(activeEnv.MOURA_DATA_DIR,'electron-profile');
    const args=['--user-data-dir='+profile];
    if(!fs.existsSync(path.join(activeEnv.MOURA_DATA_DIR,'moura.db')))console.log('Primeira abertura: aguardando a escolha Criar perfil local na janela de boas-vindas.');
    if(process.env.MOURA_TEST_OFFLINE==='1') args.push('--disable-background-networking','--disable-component-update');
    instance=await electron.launch({executablePath:activeExecutable,args,cwd:path.dirname(activeExecutable),env:activeEnv,timeout:30000});
    if(process.env.MOURA_TEST_OFFLINE==='1') await instance.context().route('**/*',route=>{
      const url=new URL(route.request().url());
      if(['file:','data:','blob:'].includes(url.protocol)||['127.0.0.1','localhost','[::1]'].includes(url.hostname))return route.continue();
      externalRequests.push(url.origin);return route.abort();
    });
    const page=await instance.firstWindow({timeout:180000});page.on('pageerror',e=>errors.push(e.message));
    await page.waitForURL('**/login.html');return page;
  };
  const login=async page=>{await page.locator('#email').fill('instalado@example.test');await page.locator('#senha').fill('teste-ficticio');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/index.html');};
  try {
    let page=await launch();oldBase=new URL(page.url()).origin;
    assert.ok(fs.existsSync(path.join(path.dirname(executable),'resources','runtime','node.exe')));
    const metadata=await instance.evaluate(({app})=>({packaged:app.isPackaged,version:app.getVersion(),appPath:app.getAppPath(),userData:app.getPath('userData'),pid:process.pid}));assert.equal(metadata.packaged,true);
    assert.equal(path.resolve(metadata.userData),path.join(data,'electron-profile'),'O teste deve usar um perfil Electron isolado.');
    const parentPid=metadata.pid;
    const children=JSON.parse(execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',`[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); @(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}" | Select-Object ExecutablePath,ProcessId) | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}));
    const processes=Array.isArray(children)?children:[children];
    fs.writeFileSync(path.join(output,'processes.json'),JSON.stringify({metadata,processes,expected:path.join(path.dirname(executable),'resources','runtime','node.exe')},null,2));
    assert.ok(processes.some(p=>p.ExecutablePath?.toLowerCase()===path.join(path.dirname(executable),'resources','runtime','node.exe').toLowerCase()));checks.push('Electron instalado/empacotado usa exclusivamente o Node incluído; PATH contém somente System32');
    await page.getByRole('link',{name:'Cadastrar',exact:true}).click();await page.locator('#nome').fill('Perfil Instalado');await page.locator('#email').fill('instalado@example.test');await page.locator('#senha').fill('teste-ficticio');await page.locator('[type=submit]').click();await page.waitForURL('**/login.html');await login(page);
    // Apenas requisições ao próprio backend são permitidas durante os fluxos essenciais.
    await page.route('**/*',route=>new URL(route.request().url()).origin===oldBase?route.continue():route.abort());
    const body={campeonato:'Copa instalada',local:'São Luís',adversario:'Oponentes',data_partida:'2026-01-20',atleta1:'Um',atleta2:'Dois'};
    for(const [id,value] of Object.entries(body))await page.locator('#'+id).fill(value);
    const photoFile=path.join(output,'foto.png');await require('sharp')({create:{width:60,height:90,channels:3,background:'#0f766e'}}).png().toFile(photoFile);
    await page.getByRole('button',{name:'Cadastrar atleta',exact:true}).click();
    for(const name of ['Um','Dois']) {
      await page.locator('#athlete-nome').fill(name);await page.locator('#athlete-clube').fill('Clube instalado');await page.locator('#athlete-photo').setInputFiles(photoFile);
      await page.waitForFunction(()=>document.querySelector('#photo-preview img')?.complete);
      await page.locator('#athlete-form [type=submit]').click();await page.waitForFunction(()=>document.getElementById('athlete-nome').value==='');
    }
    await page.locator('#roster-dialog').getByRole('button',{name:'Duplas',exact:true}).click();await page.locator('#pair-one').selectOption('1');await page.locator('#pair-two').selectOption('2');await page.locator('#pair-form [type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#pair-list .roster-card').length===1);
    await page.getByRole('button',{name:'Voltar à partida',exact:true}).click();assert.equal(await page.locator('#campeonato').inputValue(),'Copa instalada');await page.locator('#video-url').fill('https://example.test/jogo');
    await page.locator('#btn-iniciar-partida').click();await page.waitForFunction(()=>document.getElementById('partida-status').textContent.includes('iniciada com ID'));
    await page.locator('[data-atleta="1"][data-fundamento="ataque"][data-resultado="ponto"]').click();await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===1);
    await page.locator('#set_atleta2').selectOption('2');await page.locator('[data-atleta="2"][data-fundamento="ataque"][data-resultado="erro"]').click();await page.waitForFunction(()=>document.querySelectorAll('.log-entry').length===2);
    for(const [id,value] of Object.entries({final_set1_dupla:'21',final_set1_adv:'18',final_set2_dupla:'21',final_set2_adv:'17'}))await page.locator('#'+id).fill(value);
    await page.locator('#btn-finalizar-partida').click();await page.waitForFunction(()=>document.getElementById('finalizacao-status').textContent.includes('2 x 0'));
    await page.locator('.btn-analisar').click();await page.waitForFunction(()=>document.querySelectorAll('.stat-card').length===7);
    assert.match(await page.locator('#analysis-stats').innerText(),/2 registros/);
    await page.locator('#analysis-type').selectOption('atleta2');await page.locator('#analysis-set').selectOption('2');await page.waitForFunction(()=>document.getElementById('analysis-status').textContent==='Seleção ativa: Dois · Set 2');assert.match(await page.locator('#analysis-stats').innerText(),/-100\.00%/);
    await page.locator('#analysis-type').selectOption('dupla');await page.locator('#analysis-set').selectOption('');await page.waitForFunction(()=>document.getElementById('analysis-status').textContent.includes('Partida inteira'));
    await instance.evaluate(({BrowserWindow},folder)=>{
      globalThis.__pdfDownloads=[];
      BrowserWindow.getAllWindows()[0].webContents.session.on('will-download',(event,item)=>{
        item.setSavePath(folder+'/'+item.getFilename());
        item.once('done',(event,state)=>globalThis.__pdfDownloads.push({state,file:item.getFilename()}));
      });
    },downloadFolder);
    let downloads=0;
    for(const type of ['atleta1','atleta2','dupla']){
      const responsePromise=page.waitForResponse(r=>r.url().includes('/relatorio/') && r.url().includes('/'+type+'/pdf'));
      await page.locator(`[data-pdf-type="${type}"]`).click();
      const pdfResponse=await responsePromise;assert.equal(pdfResponse.status(),200,await pdfResponse.text());
      const deadline=Date.now()+10000;
      while((await instance.evaluate(()=>globalThis.__pdfDownloads.length))<=downloads && Date.now()<deadline)await page.waitForTimeout(100);
      const list=await instance.evaluate(()=>globalThis.__pdfDownloads);assert.equal(list.length,++downloads,'Downloads; toast: '+await page.locator('#toast').textContent());assert.equal(list.at(-1).state,'completed');
    }
    await page.screenshot({path:path.join(output,'dashboard-installed.png'),fullPage:true});checks.push('Perfil, dois atletas com clube/foto, dupla, link, eventos dos dois atletas em dois sets, finalização, filtros e três PDFs no aplicativo empacotado');
    // Segunda instância deve encerrar, mantendo a janela e o backend da primeira.
    const second=spawn(executable,['--user-data-dir='+path.join(data,'electron-profile')],{env,windowsHide:true,stdio:'ignore'});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{second.kill();reject(Error('A segunda instância não encerrou.'));},8000);second.once('exit',()=>{clearTimeout(timer);resolve();});});
    assert.equal((await page.request.get(oldBase)).status(),200);checks.push('Segunda instância encerrada sem conflito');
    await instance.close();instance=null;
    if(process.env.MOURA_TEST_UPGRADE_EXE) {
      const fingerprint=()=>{
        const db=new (require('better-sqlite3'))(path.join(data,'moura.db'),{readonly:true});
        const records=Object.fromEntries(['usuarios','atletas','duplas','partidas','eventos_partida','sets_partida'].map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY id').all()]));db.close();
        const photos=fs.readdirSync(path.join(data,'photos')).sort().map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(path.join(data,'photos',f))).digest('hex')]);
        return JSON.stringify({records,photos});
      };
      const beforeUpgrade=fingerprint();activeExecutable=path.resolve(process.env.MOURA_TEST_UPGRADE_EXE);
      page=await launch();await login(page);assert.equal(await page.locator('.btn-analisar').count(),1);await page.locator('.btn-analisar').click();await page.waitForFunction(()=>document.querySelectorAll('.stat-card').length===7);
      await page.waitForFunction(()=>document.querySelectorAll('#analysis-people img').length===2 && [...document.querySelectorAll('#analysis-people img')].every(img=>img.complete&&img.naturalWidth>0));
      const upgraded=await instance.evaluate(({app})=>({version:app.getVersion(),appPath:app.getAppPath()}));assert.equal(upgraded.version,require('../package.json').version);
      await instance.close();instance=null;assert.equal(fingerprint(),beforeUpgrade);checks.push('Conteúdo '+metadata.version+' → '+upgraded.version+': banco, perfil, atletas, fotos, dupla, partida e eventos preservados (sem executar o assistente NSIS de atualização)');
    }
    await assert.rejects(fetch(oldBase));checks.push('Fechar a janela encerra o backend e libera a porta');
    page=await launch();await login(page);assert.equal(await page.locator('.btn-analisar').count(),1);await page.locator('.btn-analisar').click();await page.waitForFunction(()=>document.querySelectorAll('.stat-card').length===7);assert.match(await page.locator('#analysis-meta').innerText(),/2 x 0/);
    await page.waitForFunction(()=>document.querySelectorAll('#analysis-people img').length===2 && [...document.querySelectorAll('#analysis-people img')].every(img=>img.complete && img.naturalWidth>0));assert.match(await page.locator('#analysis-people').innerText(),/Clube instalado/);assert.equal(await page.locator('#analysis-meta a').getAttribute('href'),'https://example.test/jogo');checks.push('Fechar/reabrir preserva perfil, fotos, clube, dupla, link, partida e eventos');
    await instance.close();instance=null;
    const legacyFolder=fs.mkdtempSync(path.join(os.tmpdir(),'Moura legado instalado São Luís '));
    const legacySource=path.join(legacyFolder,'banco antigo.db'),legacyData=path.join(legacyFolder,'importado');fs.mkdirSync(legacyData);
    const {Database,seed}=require('./helpers.cjs');const legacyDb=new Database(legacySource);legacyDb.exec(fs.readFileSync(path.join(__dirname,'reference','legacy-schema.sql'),'utf8'));seed(legacyDb);legacyDb.prepare('UPDATE usuarios SET senha_hash=? WHERE id=1').run(require('bcryptjs').hashSync('teste-ficticio',10));legacyDb.close();
    const runtime=path.join(path.dirname(executable),'resources','runtime','node.exe');
    const importScript=path.join(path.dirname(executable),'resources','app.asar.unpacked','Backend','import-cli.js');
    const imported=JSON.parse(execFileSync(runtime,[importScript,legacySource,path.join(legacyData,'moura.db')],{env,windowsHide:true,encoding:'utf8',cwd:legacyFolder}));assert.equal(imported.tables.eventos_partida,55);
    page=await launch({...env,MOURA_DATA_DIR:legacyData});await page.locator('#email').fill('referencia@example.test');await page.locator('#senha').fill('teste-ficticio');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.waitForURL('**/index.html');assert.equal(await page.locator('.btn-analisar').count(),2);
    await page.locator('.btn-analisar[data-id="1"]').click();await page.waitForFunction(()=>document.querySelectorAll('.stat-card').length===7);assert.match(await page.locator('.stat-card').first().innerText(),/10 registros/);assert.match(await page.locator('.stat-card').first().innerText(),/-40\.00%/);
    await instance.evaluate(({BrowserWindow},folder)=>{
      globalThis.__legacyDownloads=[];
      BrowserWindow.getAllWindows()[0].webContents.session.on('will-download',(event,item)=>{item.setSavePath(folder+'/legado-'+item.getFilename());item.once('done',(event,state)=>globalThis.__legacyDownloads.push(state));});
    },downloadFolder);
    let legacyDownloads=0;
    for(const type of ['atleta1','atleta2','dupla']) {
      await page.locator(`[data-pdf-type="${type}"]`).click();const deadline=Date.now()+10000;
      while((await instance.evaluate(()=>globalThis.__legacyDownloads.length))<=legacyDownloads && Date.now()<deadline)await page.waitForTimeout(100);
      const list=await instance.evaluate(()=>globalThis.__legacyDownloads);assert.equal(list.length,++legacyDownloads);assert.equal(list.at(-1),'completed');
    }
    checks.push('Banco v1 fictício importado pelo runtime instalado; histórico antigo, números esperados e três PDFs antigos verificados');
    assert.deepEqual(errors,[]);
    if(process.env.MOURA_TEST_OFFLINE==='1') {assert.deepEqual(externalRequests,[]);checks.push('Conexões externas do renderer bloqueadas; fluxos essenciais sem requisições externas');}
    fs.rmSync(path.join(output,'failure.txt'),{force:true});
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({executable,data,metadata,checks,errors,externalRequests,limitation:'O Windows do host tem Node instalado. PATH foi isolado e o processo foi conferido, mas não substitui teste em máquina limpa. Troca de conteúdo entre versões não equivale à atualização pelo assistente NSIS.'},null,2));console.log(JSON.stringify({checks,errors},null,2));
    if(process.env.MOURA_VISUAL_HOLD==='1') {
      console.log('Janela instalada disponível para inspeção visual; feche-a para concluir o teste.');
      await new Promise(resolve=>instance.once('close',resolve));instance=null;
    }
  }finally{if(instance)await instance.close();}
}
run().catch(e=>{console.error(e);fs.writeFileSync(path.join(output,'failure.txt'),e.stack);process.exitCode=1});
