const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tables = ['usuarios','partidas','eventos_partida','sets_partida','atletas'];
function snapshot(db) {
  const result = {};
  for (const table of tables) {
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    result[table] = {count:rows.length, columns:db.pragma(`table_info(${table})`).map(c=>c.name),
      digest:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
  }
  return result;
}
function validateSnapshot(db, before) {
  for (const [table,info] of Object.entries(before)) {
    const rows = db.prepare(`SELECT ${info.columns.map(c=>'"'+c+'"').join(',')} FROM ${table} ORDER BY id`).all();
    if (rows.length !== info.count || crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex') !== info.digest) {
      throw Error(`A validação dos registros e vínculos falhou em ${table}.`);
    }
  }
  if (db.pragma('integrity_check',{simple:true}) !== 'ok') throw Error('Falha de integridade SQLite.');
}
function migrate(db) {
  const version = db.pragma('user_version',{simple:true});
  if (version > 2) throw Error('Este banco exige uma versão mais recente do Moura Analytics.');
  if (version === 2) return;
  const before = snapshot(db);
  if (Object.keys(before).length && db.name !== ':memory:') {
    const folder = path.join(path.dirname(db.name),'backups'); fs.mkdirSync(folder,{recursive:true});
    const backup = path.join(folder,`antes-v2-${Date.now()}-${crypto.randomUUID()}.db`);
    // VACUUM INTO é um snapshot consistente, inclusive com WAL ativo.
    db.prepare('VACUUM INTO ?').run(backup);
  }
  db.transaction(()=>{
    db.exec(fs.readFileSync(path.join(__dirname,'schema-v1.sql'),'utf8'));
    const add = (table,name,type) => {
      if (!db.pragma(`table_info(${table})`).some(c=>c.name===name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
    };
    for (const [name,type] of [['id_usuario','INTEGER'],['clube','TEXT'],['foto','TEXT'],['arquivado','INTEGER NOT NULL DEFAULT 0']]) add('atletas',name,type);
    db.exec(`CREATE TABLE IF NOT EXISTS duplas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER NOT NULL REFERENCES usuarios(id),
      atleta_a INTEGER NOT NULL REFERENCES atletas(id), atleta_b INTEGER NOT NULL REFERENCES atletas(id),
      arquivado INTEGER NOT NULL DEFAULT 0, CHECK(atleta_a < atleta_b), UNIQUE(id_usuario,atleta_a,atleta_b));`);
    for (const [name,type] of [['dupla_id','INTEGER REFERENCES duplas(id)'],['atleta1_id','INTEGER REFERENCES atletas(id)'],['atleta2_id','INTEGER REFERENCES atletas(id)'],['video_url','TEXT']]) add('partidas',name,type);
    db.exec(`CREATE TABLE IF NOT EXISTS operacoes (
      id_usuario INTEGER NOT NULL, chave TEXT NOT NULL, rota TEXT NOT NULL, corpo TEXT NOT NULL,
      resposta TEXT NOT NULL, status INTEGER NOT NULL, PRIMARY KEY(id_usuario,chave));
      CREATE INDEX IF NOT EXISTS eventos_partida_filtro ON eventos_partida(id_partida,id_atleta,set_numero);
      CREATE INDEX IF NOT EXISTS atletas_perfil ON atletas(id_usuario,arquivado);
      CREATE INDEX IF NOT EXISTS partidas_perfil ON partidas(id_usuario);
      CREATE UNIQUE INDEX IF NOT EXISTS duplas_formacao ON duplas(id_usuario,atleta_a,atleta_b);
      PRAGMA user_version = 2;`);
    validateSnapshot(db,before);
  })();
}
module.exports = {migrate,snapshot,validateSnapshot};
