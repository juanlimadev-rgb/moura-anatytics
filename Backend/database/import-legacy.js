const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const {migrate,snapshot,validateSnapshot} = require('./migrate');
async function importLegacy(sourcePath,targetPath) {
  sourcePath = path.resolve(sourcePath); targetPath = path.resolve(targetPath);
  if (fs.existsSync(targetPath)) throw Error('O banco de destino já existe. Nenhum dado foi sobrescrito.');
  fs.mkdirSync(path.dirname(targetPath),{recursive:true});
  const staging = targetPath+'.import-'+crypto.randomUUID();
  let source, copy;
  try {
    source = new Database(sourcePath,{readonly:true,fileMustExist:true});
    for (const t of ['usuarios','partidas','eventos_partida','sets_partida']) {
      if (!source.prepare("SELECT 1 FROM sqlite_master WHERE name=? AND type='table'").get(t)) throw Error('O arquivo não é um banco Moura Analytics compatível.');
    }
    // Backup online usa a API SQLite e inclui transações já confirmadas no WAL.
    await source.backup(staging);
    source.close(); source = null;
    copy = new Database(staging);
    const before = snapshot(copy);
    migrate(copy); validateSnapshot(copy,before);
    copy.close(); copy = null;
    // link é atômico e falha se outro processo criou o destino; nunca substitui.
    fs.linkSync(staging,targetPath); fs.unlinkSync(staging);
    return {tables:Object.fromEntries(Object.entries(before).map(([t,v])=>[t,v.count])),unownedAthletes:before.atletas?.count || 0};
  } finally {
    if (source?.open) source.close(); if (copy?.open) copy.close();
    if (fs.existsSync(staging)) fs.unlinkSync(staging);
  }
}
module.exports = {importLegacy};
