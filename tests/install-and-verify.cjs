const fs=require('node:fs');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const installer=path.join(root,'release',`MouraAnalytics-Setup-${require('../package.json').version}.exe`);
const folder=path.join(root,'test-results','Windows instalado São Luís');
async function wait(child) {return new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Processo encerrou com código '+code)));});}
(async()=>{
  if(!fs.existsSync(installer)) throw Error('Gere o instalador com npm run dist:win.');
  const query=`[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); @(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKCU:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object {$_.DisplayName -like 'Moura Analytics*'} | Select-Object -ExpandProperty InstallLocation) | ConvertTo-Json -Compress`;
  const registered=execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-Command',query],{encoding:'utf8',windowsHide:true}).trim();
  const locations=registered ? JSON.parse(registered) : [];
  for(const location of Array.isArray(locations)?locations:[locations]) if(location && path.resolve(location).toLowerCase()!==path.resolve(folder).toLowerCase()) {
    throw Error('Teste NSIS interrompido para preservar a instalação existente. Execute em VM/usuário Windows de teste. npm run test:distribution verifica o conteúdo do instalador sem substituir sua instalação.');
  }
  // NSIS lê /D e todo o restante como caminho, inclusive espaços e acentos.
  await wait(spawn(installer,['/S','/D='+folder],{windowsHide:true,windowsVerbatimArguments:true,stdio:'inherit'}));
  const executable=path.join(folder,'Moura Analytics.exe');
  if(!fs.existsSync(executable)) throw Error('O instalador não criou o executável no destino esperado.');
  console.log('Instalado em: '+folder);
  await wait(spawn(process.execPath,[path.join(__dirname,'packaged.cjs')],{env:{...process.env,MOURA_INSTALLED_EXE:executable},stdio:'inherit',windowsHide:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
