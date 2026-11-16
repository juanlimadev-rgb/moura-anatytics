const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const os=require('node:os');
const fs=require('node:fs');
const net=require('node:net');
const {fork}=require('node:child_process');
test('prontidão, porta dinâmica, conflito de porta e encerramento do backend',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'Moura lifecycle '));
  function launch(port,suffix) {
    const child=fork(path.join(__dirname,'..','Backend','server.js'),[],{env:{...process.env,PORT:String(port),MOURA_DATA_DIR:path.join(folder,suffix)},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
    const ended=new Promise(resolve=>child.once('exit',resolve));
    const message=new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Backend não ficou pronto.'));},10000);child.once('message',m=>{clearTimeout(timer);resolve(m);});child.once('exit',()=>clearTimeout(timer));});
    return {child,ended,message};
  }
  const busy=net.createServer();await new Promise(resolve=>busy.listen(0,'127.0.0.1',resolve));
  const failed=launch(busy.address().port,'conflito');assert.equal((await failed.message).code,'EADDRINUSE');assert.equal(await failed.ended,1);await new Promise(resolve=>busy.close(resolve));
  const good=launch(0,'normal');const ready=await good.message;assert.equal(ready.type,'ready');assert.ok(ready.port>0);
  assert.equal((await fetch(`http://127.0.0.1:${ready.port}/login.html`)).status,200);
  good.child.send({type:'shutdown'});assert.equal(await good.ended,0);await assert.rejects(fetch(`http://127.0.0.1:${ready.port}`));
});
