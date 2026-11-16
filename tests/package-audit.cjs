const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const asar=require('@electron/asar');
const root=path.resolve(__dirname,'..');
const archive=path.join(root,'release','win-unpacked','resources','app.asar');
const files=asar.listPackage(archive);
const forbidden=files.filter(file=>/\.(db|sqlite|sqlite3)(-|$)/i.test(file)||/(^|[\\/])\.env$/.test(file)||/[\\/](tests|test-results|\.git)[\\/]|[\\/]server\.exe$/i.test(file));
assert.deepEqual(forbidden,[],'O pacote não pode conter banco pessoal, segredos ou dados de teste.');
const source=['main.js'];
for(const folder of ['Backend','Backend/database','Backend/middlewares'])for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true}))if(entry.isFile() && /\.(js|sql)$/.test(entry.name))source.push(path.join(folder,entry.name));
function frontend(folder) {for(const entry of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const rel=path.join(folder,entry.name);if(entry.isDirectory())frontend(rel);else source.push(rel);}}
frontend('Frontend');
for(const file of source)assert.ok(fs.readFileSync(path.join(root,file)).equals(asar.extractFile(archive,path.normalize(file))),file+' não corresponde ao fonte final');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(path.join(root,'runtime','node.exe')),hash(path.join(root,'release','win-unpacked','resources','runtime','node.exe')));
const output=path.join(root,'test-results','package-audit.json');fs.mkdirSync(path.dirname(output),{recursive:true});
const result={sourceFilesChecked:source.length,forbiddenFiles:forbidden,runtimeHash:hash(path.join(root,'runtime','node.exe')),sourcesMatch:true};fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
