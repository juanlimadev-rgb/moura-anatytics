const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
async function prepare() {
  if(process.platform!=='win32' || process.arch!=='x64') throw Error('Gere esta distribuição em Windows x64 com Node 24.');
  if(Number(process.versions.node.split('.')[0])!==24) throw Error('Use Node 24 para preparar o runtime e os módulos nativos.');
  const root=path.resolve(__dirname,'..'),folder=path.join(root,'runtime');fs.mkdirSync(folder,{recursive:true});
  // O executável testado é incluído. O computador do cliente não precisa de Node.
  const exe=path.join(folder,'node.exe');fs.copyFileSync(process.execPath,exe);
  execFileSync(exe,['-e',"const D=require('better-sqlite3');const d=new D(':memory:');if(d.prepare('SELECT 42 n').get().n!==42)process.exit(1);d.close();require('sharp')({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer().catch(()=>process.exit(1));"],{cwd:root,windowsHide:true});
  const license=path.join(folder,'NODE-LICENSE.txt');
  const versionFile=path.join(folder,'version.json');
  if(!fs.existsSync(license) || !fs.existsSync(versionFile) || JSON.parse(fs.readFileSync(versionFile)).node!==process.versions.node) {
    const response=await fetch(`https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`);
    if(!response.ok) throw Error('Não foi possível obter a licença do runtime Node para distribuição.');
    fs.writeFileSync(license,await response.text());
  }
  fs.writeFileSync(versionFile,JSON.stringify({node:process.versions.node,modules:process.versions.modules,platform:process.platform,arch:process.arch},null,2));
  console.log(`Runtime Node ${process.versions.node}, SQLite e Sharp verificados para distribuição.`);
}
if(require.main===module)prepare().catch(e=>{console.error(e);process.exitCode=1});
module.exports=prepare;
