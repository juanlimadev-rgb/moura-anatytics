const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const Database = require('better-sqlite3');
const root = path.resolve(__dirname, '..');
const categories = {
  ataque: ['ponto','neutro','bloqueado','erro'], saque: ['ace','bom','neutro','erro'],
  passe: ['excelente','bom','regular','ruim','erro'], bloqueio: ['ponto','neutro','erro'],
  defesa: ['excelente','acao','erro'], 'side-out': ['ponto','neutro','erro'],
  'contra-ataque': ['ponto','neutro','bloqueado','erro']
};
function seed(db) {
  db.prepare('INSERT INTO usuarios(id,nome,email,senha_hash) VALUES(1,?,?,?)').run('Perfil Referência','referencia@example.test','fixture');
  db.prepare(`INSERT INTO partidas(id,data_partida,adversario,campeonato,local,resultado,dupla,atleta1,atleta2,id_usuario)
    VALUES(1,'2026-01-20','Adversário fictício','Copa Referência','São Luís','1 x 2','Ana / Duda','Ana','Duda',1)`).run();
  db.prepare(`INSERT INTO partidas(id,data_partida,dupla,atleta1,atleta2,id_usuario) VALUES(2,'2026-01-21','Sem / Eventos','Sem','Eventos',1)`).run();
  const insert = db.prepare('INSERT INTO eventos_partida(id_partida,id_atleta,set_numero,fundamento,resultado) VALUES(1,?,?,?,?)');
  for (const position of [1,2]) for (const [fund, results] of Object.entries(categories)) {
    for (const result of results) insert.run(position,position,fund,result);
  }
  // A UI antiga oferece esta categoria, embora seu mapa PDF não a declare.
  insert.run(1,1,'side-out','bloqueado');
  insert.run(1,1,'ataque','erro'); insert.run(1,1,'ataque','erro');
  for (const [n,ours,theirs] of [[1,21,18],[2,17,21],[3,13,15]]) {
    db.prepare('INSERT INTO sets_partida(id_partida,set_numero,pontos_dupla,pontos_adversario) VALUES(1,?,?,?)').run(n,ours,theirs);
  }
}
function loadReportingSubject(migrated=false) {
  const db = new Database(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname,'reference','legacy-schema.sql'),'utf8'));
  seed(db);
  if(migrated) require('../Backend/database/migrate').migrate(db);
  const filename = path.join(root,'Backend','server.js');
  const realRequire = createRequire(filename);
  const fixed = new Date('2026-01-22T15:00:00Z');
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed.getTime()])); } static now() { return fixed.getTime(); } }
  const sandbox = { require: name => name === './database/connection' ? db : name === './database/init' || name === './paths' ? {} : name === './management' ? {register(){}} : realRequire(name),
    console, process, Buffer, Date: FixedDate, module:{exports:{}}, __dirname:path.dirname(filename) };
  let source = fs.readFileSync(filename,'utf8');
  source = source.replace(/app\.listen\(PORT,[\s\S]*$/, '');
  vm.runInNewContext(source + '\nmodule.exports = {app, buscarDadosRelatorio, gerarSqlEstatistica, getResultadosPorFundamento};',sandbox,{filename});
  return {...sandbox.module.exports,db};
}
async function serve(app, fn) {
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try { return await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve=>server.close(resolve)); }
}
module.exports = {root, seed, categories, loadReportingSubject, serve, Database};
