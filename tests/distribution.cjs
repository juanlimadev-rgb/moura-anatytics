const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {spawn,spawnSync}=require('node:child_process');
const asar=require('@electron/asar');
const root=path.resolve(__dirname,'..');
const pkg=require('../package.json');
const output=path.join(root,'test-results','distribution');fs.mkdirSync(output,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'Moura distribuição só instalador São Luís '));
const incoming=path.join(temp,'recebido');fs.mkdirSync(incoming);
const name=`MouraAnalytics-Setup-${pkg.version}.exe`;
const single=path.join(incoming,name);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function find7zip(folder) {
  if(!fs.existsSync(folder))return null;
  for(const e of fs.readdirSync(folder,{withFileTypes:true})){
    const p=path.join(folder,e.name);if(e.isFile()&&e.name.toLowerCase()==='7za.exe')return p;
    if(e.isDirectory()){const found=find7zip(p);if(found)return found;}
  }
  return null;
}
const seven=process.env.MOURA_7ZIP || find7zip(path.join(os.homedir(),'AppData','Local','electron-builder','Cache','7zip@1.0.0'));
if(!seven)throw Error('7-Zip do empacotador não encontrado. Gere a distribuição primeiro ou defina MOURA_7ZIP.');
function extract(installer,destination,label){
  fs.mkdirSync(destination,{recursive:true});
  const result=spawnSync(seven,['x','-y',installer,'-o'+destination],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024,cwd:temp});
  fs.writeFileSync(path.join(output,label+'-extraction.log'),(result.stdout||'')+(result.stderr||''));
  if(result.error||![0,1].includes(result.status))throw result.error||Error('Falha na extração: '+result.status);
  for(const rel of ['Moura Analytics.exe','resources/app.asar','resources/runtime/node.exe','resources/runtime/NODE-LICENSE.txt','resources/app.asar.unpacked/Backend/server.js','resources/app.asar.unpacked/Frontend/index.html','resources/app.asar.unpacked/node_modules/pdfkit/js/data/Helvetica.afm'])assert.ok(fs.existsSync(path.join(destination,rel)),rel+' ausente no instalador');
  return path.join(destination,'Moura Analytics.exe');
}
async function fullFlow(executable,label,upgrade){
  const data=fs.mkdtempSync(path.join(os.tmpdir(),'MouraData-'+label+'-')),evidence=path.join(temp,label+'-evidencias');
  const env={...process.env,MOURA_INSTALLED_EXE:executable,MOURA_TEST_DATA_DIR:data,MOURA_TEST_OUTPUT_DIR:evidence,MOURA_TEST_FIRST_RUN:'1',MOURA_TEST_OFFLINE:'1'};
  delete env.MOURA_VISUAL_HOLD;
  if(upgrade)env.MOURA_TEST_UPGRADE_EXE=upgrade;else delete env.MOURA_TEST_UPGRADE_EXE;
  console.log('TESTE '+label+': '+executable+' — primeira abertura em diretório vazio.');
  const child=spawn(process.execPath,[path.join(__dirname,'packaged.cjs')],{env,windowsHide:true,stdio:'inherit',cwd:temp});
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(label+' falhou: '+code)));});
  return JSON.parse(fs.readFileSync(path.join(evidence,'results.json'),'utf8'));
}
(async()=>{
  fs.copyFileSync(path.join(root,'entrega-cliente',name),single,fs.constants.COPYFILE_EXCL);
  assert.deepEqual(fs.readdirSync(incoming),[name]);
  assert.equal(sha(single),sha(path.join(root,'entrega-cliente',name)));
  const appFolder=path.join(temp,'aplicativo final');const finalExe=extract(single,appFolder,'final');
  const archive=path.join(appFolder,'resources','app.asar');
  const archived=asar.listPackage(archive);
  const forbidden=archived.filter(p=>/\.(db|db-wal|db-shm|sqlite|sqlite3)$/i.test(p)||/(^|[\\/])\.env(?:\.|$)|[\\/](tests|test-results|\.git|photos)[\\/]/i.test(p));assert.deepEqual(forbidden,[]);
  const before=JSON.parse(fs.readFileSync(path.join(output,'source-before.json'),'utf8'));
  for(const [rel,digest]of Object.entries(before)){
    assert.equal(sha(path.join(root,rel)),digest,'Fonte funcional alterado: '+rel);
    assert.equal(crypto.createHash('sha256').update(asar.extractFile(archive,path.normalize(rel))).digest('hex'),digest,'Fonte empacotado diverge: '+rel);
  }
  const final=await fullFlow(finalExe,'final');
  const baselineFolder=path.join(temp,'aplicativo anterior');
  const oldExe=extract(path.join(root,'release','Moura-Analytics-1.1.0-Setup.exe'),baselineFolder,'anterior');
  const upgrade=await fullFlow(oldExe,'atualizacao-conteudo',finalExe);
  const result={singleInstaller:single,sha256:sha(single),temp,sourceFilesUnchanged:Object.keys(before).length,forbiddenFiles:forbidden,final,upgrade,
    limits:['Host Windows com Node instalado; PATH isolado, não uma VM limpa.','Conexões externas do aplicativo bloqueadas; a rede global do Windows não foi desligada.','O conteúdo foi extraído somente do instalador; o assistente NSIS não foi usado para instalar/atualizar no perfil atual, para preservar a instalação do usuário.','Pasta original permaneceu intacta e existente; não houve teste com acesso ao projeto negado pelo sistema operacional.']};
  fs.rmSync(path.join(output,'failure.txt'),{force:true});
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,singleInstaller:single,sourceFilesUnchanged:Object.keys(before).length,final:final.checks,upgrade:upgrade.checks,limits:result.limits},null,2));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(output,'failure.txt'),e.stack);process.exitCode=1});
