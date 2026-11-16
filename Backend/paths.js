const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const dataDir = path.resolve(process.env.MOURA_DATA_DIR || path.join(process.env.APPDATA || path.join(os.homedir(),'.local','share'),'moura-analytics'));
fs.mkdirSync(dataDir,{recursive:true});
fs.mkdirSync(path.join(dataDir,'photos'),{recursive:true});
const secretFile = path.join(dataDir,'local-secret');
if (!process.env.JWT_SECRET) {
  try { fs.writeFileSync(secretFile,crypto.randomBytes(48).toString('hex'),{flag:'wx',mode:0o600}); }
  catch(e) { if (e.code !== 'EEXIST') throw e; }
  process.env.JWT_SECRET = fs.readFileSync(secretFile,'utf8').trim();
}
module.exports = {dataDir,dbPath:path.join(dataDir,'moura.db'),photoDir:path.join(dataDir,'photos')};
