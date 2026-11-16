const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function deliver() {
  if (pkg.build.win.target !== 'nsis') throw Error('A entrega exige o instalador NSIS completo, sem download externo.');
  const name = `MouraAnalytics-Setup-${pkg.version}.exe`;
  const source = path.join(root, 'release', name);
  const folder = path.join(root, 'entrega-cliente');
  const target = path.join(folder, name);
  if (!fs.existsSync(source) || fs.statSync(source).size < 50 * 1024 * 1024) throw Error('Instalador completo não encontrado. Execute npm run dist:client.');
  const signature = fs.openSync(source, 'r');
  const header = Buffer.alloc(2); fs.readSync(signature, header, 0, 2, 0); fs.closeSync(signature);
  if (header.toString() !== 'MZ') throw Error('O resultado não é um executável Windows.');
  fs.mkdirSync(folder, {recursive:true});
  const archive = path.join(root, 'release', 'entregas-anteriores');
  for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
    if (!entry.isFile() || !/^MouraAnalytics-Setup-\d+\.\d+\.\d+\.exe$/.test(entry.name)) {
      throw Error('A pasta de entrega contém um arquivo não reconhecido. Ele foi preservado: '+entry.name);
    }
    const old = path.resolve(folder, entry.name);
    if (!old.startsWith(folder+path.sep)) throw Error('Caminho fora da pasta de entrega.');
    if (old === target && hash(old) === hash(source)) continue;
    fs.mkdirSync(archive, {recursive:true});
    const archived = path.resolve(archive, `${Date.now()}-${crypto.randomUUID()}-${entry.name}`);
    if (!archived.startsWith(archive+path.sep)) throw Error('Destino fora da pasta de arquivos anteriores.');
    fs.renameSync(old, archived);
  }
  if (!fs.existsSync(target)) {
    const staging = path.join(folder, `.instalador-${crypto.randomUUID()}.tmp`);
    fs.copyFileSync(source, staging, fs.constants.COPYFILE_EXCL);
    if (hash(staging) !== hash(source)) { fs.unlinkSync(staging); throw Error('A cópia do instalador falhou na verificação.'); }
    fs.renameSync(staging, target);
  }
  if (fs.readdirSync(folder).length !== 1) throw Error('A entrega deve conter exatamente um arquivo.');
  const manifest = {version:pkg.version,kind:'nsis-offline-full',file:target,bytes:fs.statSync(target).size,sha256:hash(target)};
  fs.writeFileSync(path.join(root, 'release', 'delivery-manifest.json'), JSON.stringify(manifest,null,2));
  console.log(JSON.stringify(manifest,null,2));
  return manifest;
}
if (require.main === module) deliver();
module.exports = deliver;
