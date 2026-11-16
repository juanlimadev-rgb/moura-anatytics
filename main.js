const {app,BrowserWindow,dialog,shell,Menu} = require('electron');
const {fork} = require('node:child_process');
const execFile = require('node:util').promisify(require('node:child_process').execFile);
const fs = require('node:fs');
const path = require('node:path');
let backend,win,quitting=false;
const lock=app.requestSingleInstanceLock();
if(!lock) app.quit();
else {
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
  app.whenReady().then(launch).catch(async e=>{
    await dialog.showMessageBox({type:'error',title:'Moura Analytics',message:'Não foi possível iniciar o aplicativo.',detail:e.message+'\nSeus dados foram preservados em: '+app.getPath('userData')});
    app.quit();
  });
}
async function launch() {
  const dataDir=path.resolve(process.env.MOURA_DATA_DIR || app.getPath('userData'));
  process.env.MOURA_DATA_DIR=dataDir;
  fs.mkdirSync(dataDir,{recursive:true});
  const target=path.join(dataDir,'moura.db');
  const runtime=path.join(app.isPackaged ? process.resourcesPath : __dirname,'runtime','node.exe');
  const backendDir=app.isPackaged ? path.join(process.resourcesPath,'app.asar.unpacked','Backend') : path.join(__dirname,'Backend');
  if(!fs.existsSync(target)) {
    const answer=await dialog.showMessageBox({type:'question',title:'Bem-vindo ao Moura Analytics',message:'Como deseja começar?',detail:'Crie seu perfil neste computador ou importe uma cópia do banco da versão anterior. O arquivo original será preservado.',buttons:['Criar perfil local','Importar banco antigo'],defaultId:0,cancelId:0});
    if(answer.response===1) {
      const selected=await dialog.showOpenDialog({title:'Selecione o banco da versão anterior',filters:[{name:'Banco SQLite',extensions:['db','sqlite','sqlite3']}],properties:['openFile']});
      if(selected.canceled) return launch();
      await execFile(runtime,[path.join(backendDir,'import-cli.js'),selected.filePaths[0],target],{windowsHide:true,cwd:dataDir});
    }
  }
  const port=await new Promise((resolve,reject)=>{
    backend=fork(path.join(backendDir,'server.js'),[],{
      execPath:runtime,cwd:dataDir,windowsHide:true,
      env:{...process.env,MOURA_DATA_DIR:dataDir,PORT:'0'},
      stdio:['ignore','ignore','pipe','ipc']
    });
    const timeout=setTimeout(()=>reject(Error('O servidor local não respondeu em 30 segundos.')),30000);
    const finish=(error,port)=>{clearTimeout(timeout);backend.removeListener('exit',exited);error?reject(error):resolve(port);};
    const exited=()=>finish(Error('O servidor local encerrou antes de ficar pronto. Confira a instalação e a compatibilidade SQLite.'));
    backend.once('exit',exited);
    backend.once('error',err=>finish(err));
    backend.on('message',m=>{if(m?.type==='ready')finish(null,m.port);else if(m?.type==='startup-error')finish(Error('Falha no servidor local: '+m.code));});
  });
  const origin=`http://127.0.0.1:${port}`;
  win=new BrowserWindow({width:1400,height:900,minWidth:900,minHeight:600,show:false,autoHideMenuBar:true,
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  const external=url=>{try {const parsed=new URL(url);if(['http:','https:'].includes(parsed.protocol)&&!parsed.username&&!parsed.password)shell.openExternal(parsed.href);}catch{}};
  win.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin){event.preventDefault();external(url);}});
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'Arquivo',submenu:[{label:'Pasta de dados',click:()=>shell.openPath(dataDir)},{type:'separator'},{role:'quit',label:'Sair'}]}]));
  win.once('ready-to-show',()=>win.show());
  backend.on('exit',()=>{if(!quitting){dialog.showErrorBox('Moura Analytics','O servidor local encerrou inesperadamente. Reabra o aplicativo. Seus dados foram preservados.');app.quit();}});
  await win.loadURL(origin+'/login.html');
}
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',event=>{
  if(quitting || !backend || backend.exitCode!==null) return;
  event.preventDefault();quitting=true;
  const timer=setTimeout(()=>{backend.kill();app.quit();},4000);
  backend.once('exit',()=>{clearTimeout(timer);app.quit();});
  if(backend.connected)backend.send({type:'shutdown'});else backend.kill();
});
