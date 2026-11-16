const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const os=require('node:os');
const {loadReportingSubject,serve}=require('./helpers.cjs');
const jwt=require('jsonwebtoken');
process.env.JWT_SECRET='fixture-only';
const bundled=path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies');
const poppler=process.env.POPPLER_BIN || path.join(bundled,'native','poppler','Library','bin');
const python=process.env.PDF_PYTHON || path.join(bundled,'python','python.exe');
const bin=name=>fs.existsSync(path.join(poppler,name+'.exe'))?path.join(poppler,name+'.exe'):name;
async function compare() {
  const output=path.resolve(__dirname,'..','test-results','pdf');fs.mkdirSync(output,{recursive:true});
  const {app,db,buscarDadosRelatorio}=loadReportingSubject(true);
  const original=require('./reference/original-statistics.json');const results=[];
  try {await serve(app,async base=>{
    const token=jwt.sign({id:1},process.env.JWT_SECRET);
    for(const id of [1,2]) for(const type of ['atleta1','atleta2','dupla']) {
      const name=`${id}-${type}`,before=path.join(__dirname,'reference',name+'.pdf'),after=path.join(output,name+'.pdf');
      const stats=await buscarDadosRelatorio(id,type,1);
      const comparable=JSON.parse(JSON.stringify(stats));
      comparable.partida=Object.fromEntries(Object.keys(original[name].partida).map(key=>[key,comparable.partida[key]]));
      assert.deepEqual(comparable,original[name]);
      // A renderização síncrona pode ultrapassar o keep-alive do servidor.
      // Cada comparação usa uma conexão própria, evitando reutilizar um socket expirado.
      const response=await fetch(`${base}/relatorio/${id}/${type}/pdf`,{headers:{Authorization:`Bearer ${token}`,Connection:'close'}});assert.equal(response.status,200);
      fs.writeFileSync(after,Buffer.from(await response.arrayBuffer()));
      const text=file=>execFileSync(python,['-c',"import sys,json; from pypdf import PdfReader; print(json.dumps([p.extract_text() for p in PdfReader(sys.argv[1]).pages],ensure_ascii=True))",file],{encoding:'utf8'}).replace(/\r\n/g,'\n');assert.equal(text(after),text(before),name+' texto/números');
      const pages=file=>Number(/Pages:\s+(\d+)/.exec(execFileSync(bin('pdfinfo'),[file],{encoding:'utf8'}))[1]);assert.equal(pages(after),pages(before));
      for(const [label,file] of [['before',before],['after',after]]) execFileSync(bin('pdftoppm'),['-scale-to','1000','-png',file,path.join(output,name+'-'+label)],{stdio:'pipe'});
      for(let p=1;p<=pages(before);p++) {
        const hash=label=>crypto.createHash('sha256').update(fs.readFileSync(path.join(output,`${name}-${label}-${p}.png`))).digest('hex');
        assert.equal(hash('after'),hash('before'),name+' página '+p+' pixels renderizados');
      }
      results.push({report:name,pages:pages(after),text:'igual',statistics:'iguais',render:'pixels idênticos'});
    }
  });}finally{db.close();}
  fs.writeFileSync(path.join(output,'comparison.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}
if(require.main===module)compare().catch(e=>{console.error(e);process.exitCode=1});
module.exports=compare;
