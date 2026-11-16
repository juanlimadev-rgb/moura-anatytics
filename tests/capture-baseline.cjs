// Executar somente contra o código original, antes da alteração compartilhada.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
process.env.JWT_SECRET = 'fixture-only';
const {root, loadReportingSubject, serve} = require('./helpers.cjs');
const jwt = require('jsonwebtoken');
const expected=fs.readFileSync(path.join(__dirname,'reference','original-server.sha256'),'utf8').trim();
if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'Backend','server.js'))).digest('hex')!==expected) {
  throw Error('Captura bloqueada: o servidor já foi modificado. Não substitua as referências originais.');
}
(async()=>{
  const {app,db,buscarDadosRelatorio} = loadReportingSubject();
  const folder = path.join(__dirname,'reference');
  const statistics = {};
  await serve(app, async base=>{
    const token = jwt.sign({id:1},process.env.JWT_SECRET);
    for (const id of [1,2]) for (const type of ['atleta1','atleta2','dupla']) {
      statistics[`${id}-${type}`] = await buscarDadosRelatorio(id,type,1);
      const res = await fetch(`${base}/relatorio/${id}/${type}/pdf`,{headers:{Authorization:`Bearer ${token}`}});
      if (!res.ok) throw Error(await res.text());
      fs.writeFileSync(path.join(folder,`${id}-${type}.pdf`),Buffer.from(await res.arrayBuffer()));
    }
  });
  fs.writeFileSync(path.join(folder,'original-statistics.json'),JSON.stringify(statistics,null,2));
  fs.writeFileSync(path.join(folder,'original-server.sha256'),crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'Backend','server.js'))).digest('hex')+'\n');
  db.close(); console.log('Referências originais capturadas: 6 PDFs e estatísticas; banco fictício.');
})().catch(e=>{console.error(e);process.exitCode=1});
