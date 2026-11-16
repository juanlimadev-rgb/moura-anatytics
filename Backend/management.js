const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const {photoDir} = require('./paths');
function fail(status,message) { throw Object.assign(Error(message),{status}); }
function text(value, required=false, max=200) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) fail(400,'Preencha os campos com texto válido.');
  return value.trim();
}
function videoUrl(value) {
  if (!value) return null;
  if (typeof value !== 'string' || value.length>2048 || !/^https?:\/\//i.test(value) || /\s/.test(value)) fail(400,'O link deve ser uma URL HTTP ou HTTPS válida.');
  try { const url = new URL(value); if (!url.hostname || url.username || url.password) throw Error(); return url.href; }
  catch { fail(400,'O link deve ser uma URL HTTP ou HTTPS válida.'); }
}
function register(app,db,auth,report,categories,finalResult) {
  const route = fn => async(req,res)=>{try {await fn(req,res);} catch(e) {res.status(e.status || 500).json({erro:e.status ? e.message : 'Não foi possível concluir a operação.'});}};
  const owned = (table,id,user) => db.prepare(`SELECT * FROM ${table} WHERE id=? AND id_usuario=?`).get(Number(id)||0,user);
  const match = req => {const p=owned('partidas',req.params.id || req.params.id_partida || req.body.id_partida,req.usuario.id); if(!p) fail(404,'Partida não encontrada.'); return p;};
  const activeMatch = req => {const p=match(req); if(p.resultado && p.resultado!=='Em andamento') fail(409,'Esta partida já foi finalizada.'); return p;};
  const athlete = (id,user,active=false) => { const a=owned('atletas',id,user); if(!a || (active && a.arquivado)) fail(404,'Atleta não encontrado ou arquivado.'); return a; };
  const bodyHash=body=>crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  function replay(req,res) {
    const key=req.get('Idempotency-Key'); if(!key) return false;
    if(!/^[a-zA-Z0-9-]{16,100}$/.test(key)) fail(400,'Chave de operação inválida.');
    const old=db.prepare('SELECT * FROM operacoes WHERE id_usuario=? AND chave=?').get(req.usuario.id,key);
    if(!old) return false;
    if(old.rota!==req.method+' '+req.path || old.corpo!==bodyHash(req.body)) fail(409,'Esta chave já foi usada em outra operação.');
    res.status(old.status).json(JSON.parse(old.resposta)); return true;
  }
  function write(req,res,operation) {
    let response;
    db.transaction(()=>{
      if(replay(req,res)) return;
      response=operation();
      const key=req.get('Idempotency-Key');
      if(key) db.prepare('INSERT INTO operacoes(id_usuario,chave,rota,corpo,resposta,status) VALUES(?,?,?,?,?,?)').run(req.usuario.id,key,req.method+' '+req.path,bodyHash(req.body),JSON.stringify(response.body),response.status||200);
    })();
    if(response) res.status(response.status||200).json(response.body);
  }
  const expose = a => ({...a,foto:undefined,foto_url:a.foto ? `/atletas/${a.id}/foto` : null});
  async function photo(data) {
    if(data==null) return null;
    if(typeof data!=='string' || data.length>4.2*1024*1024) fail(400,'A foto deve ter no máximo 3 MB.');
    const parsed=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if(!parsed) fail(400,'Selecione uma imagem PNG, JPEG ou WebP válida.');
    const input=Buffer.from(parsed[2],'base64');
    if(input.length>3*1024*1024) fail(400,'A foto deve ter no máximo 3 MB.');
    try {
      const image=sharp(input,{limitInputPixels:20000000,failOn:'warning'});
      const meta=await image.metadata();
      if(!['png','jpeg','webp'].includes(meta.format) || meta.format!==parsed[1] || (meta.pages||1)>1) throw Error();
      const buffer=await image.rotate().resize(640,640,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
      const filename=crypto.randomUUID()+'.webp'; fs.writeFileSync(path.join(photoDir,filename),buffer,{flag:'wx'}); return filename;
    } catch {fail(400,'A foto está inválida, corrompida ou excede 20 milhões de pixels.');}
  }
  function fields(body,previous={}) {
    const values={nome:text(body.nome,true),clube:text(body.clube ?? previous.clube),pais:text(body.pais ?? previous.pais),dupla:text(body.dupla ?? previous.dupla)};
    for(const key of ['altura','idade']) {
      const val=body[key] ?? previous[key] ?? null;
      if(val!==null && val!=='' && (!Number.isFinite(Number(val)) || Number(val)<0 || (key==='idade' && !Number.isInteger(Number(val))))) fail(400,'Altura ou idade inválida.');
      values[key]=val===null || val==='' ? null : Number(val);
    }
    return values;
  }
  app.get('/atletas',auth,route((req,res)=>{
    const q=text(req.query.q||'');
    const rows=db.prepare(`SELECT * FROM atletas WHERE id_usuario=? AND (?=1 OR arquivado=0) ORDER BY nome COLLATE NOCASE,id`).all(req.usuario.id,req.query.arquivados==='1'?1:0);
    res.json(rows.filter(a=>a.nome.toLocaleLowerCase('pt-BR').includes(q.toLocaleLowerCase('pt-BR'))).map(expose));
  }));
  app.get('/atletas/:id',auth,route((req,res)=>res.json(expose(athlete(req.params.id,req.usuario.id)))));
  app.get('/atletas/:id/foto',auth,route((req,res)=>{
    const a=athlete(req.params.id,req.usuario.id);
    if(!a.foto || !/^[a-f0-9-]+\.webp$/.test(a.foto) || !fs.existsSync(path.join(photoDir,a.foto))) fail(404,'Foto não encontrada.');
    res.set('Cache-Control','no-store').set('X-Content-Type-Options','nosniff').type('webp').sendFile(path.join(photoDir,a.foto));
  }));
  app.post('/atletas',auth,route(async(req,res)=>{
    if(replay(req,res)) return;
    const v=fields(req.body); const filename=await photo(req.body.foto);
    let used=false;
    try {write(req,res,()=>{
      const result=db.prepare('INSERT INTO atletas(nome,clube,pais,altura,idade,dupla,id_usuario,foto) VALUES(?,?,?,?,?,?,?,?)').run(v.nome,v.clube,v.pais,v.altura,v.idade,v.dupla,req.usuario.id,filename);
      used=true; return {status:201,body:expose(athlete(result.lastInsertRowid,req.usuario.id))};
    });} finally {if(filename && !used) fs.unlinkSync(path.join(photoDir,filename));}
  }));
  app.put('/atletas/:id',auth,route(async(req,res)=>{
    const old=athlete(req.params.id,req.usuario.id); if(replay(req,res)) return;
    const v=fields(req.body,old);
    const changed=Object.hasOwn(req.body,'foto'); const filename=changed ? await photo(req.body.foto) : undefined;
    let used=false;
    try {write(req,res,()=>{
      athlete(req.params.id,req.usuario.id);
      db.prepare('UPDATE atletas SET nome=?,clube=?,pais=?,altura=?,idade=?,dupla=? WHERE id=? AND id_usuario=?').run(v.nome,v.clube,v.pais,v.altura,v.idade,v.dupla,old.id,req.usuario.id);
      if(changed) db.prepare('UPDATE atletas SET foto=? WHERE id=? AND id_usuario=?').run(filename,old.id,req.usuario.id);
      used=true; return {body:expose(athlete(old.id,req.usuario.id))};
    });} finally {if(filename && !used) fs.unlinkSync(path.join(photoDir,filename));}
    // Fotos antigas só são excluídas se não houver vínculo no banco.
    if(used && changed && old.foto && /^[a-f0-9-]+\.webp$/.test(old.foto) && !db.prepare('SELECT 1 FROM atletas WHERE foto=?').get(old.foto)) {
      try {fs.rmSync(path.join(photoDir,old.foto),{force:true});}catch {/* Uma sobra de arquivo não invalida a gravação já confirmada. */}
    }
  }));
  app.post('/atletas/:id/arquivar',auth,route((req,res)=>write(req,res,()=>{
    const a=athlete(req.params.id,req.usuario.id); db.prepare('UPDATE atletas SET arquivado=1 WHERE id=? AND id_usuario=?').run(a.id,req.usuario.id); return {body:{mensagem:'Atleta arquivado. Partidas preservadas.'}};
  })));
  const pairView = (d,user) => ({...d,atletas:[expose(athlete(d.atleta_a,user)),expose(athlete(d.atleta_b,user))]});
  app.get('/duplas',auth,route((req,res)=>res.json(db.prepare('SELECT * FROM duplas WHERE id_usuario=? AND (?=1 OR arquivado=0) ORDER BY id DESC').all(req.usuario.id,req.query.arquivados==='1'?1:0).map(d=>pairView(d,req.usuario.id)))));
  app.get('/duplas/:id',auth,route((req,res)=>{const d=owned('duplas',req.params.id,req.usuario.id);if(!d)fail(404,'Dupla não encontrada.');res.json(pairView(d,req.usuario.id));}));
  app.post('/duplas',auth,route((req,res)=>write(req,res,()=>{
    const a=athlete(req.body.atleta_a,req.usuario.id,true),b=athlete(req.body.atleta_b,req.usuario.id,true);
    if(a.id===b.id) fail(400,'Selecione dois atletas diferentes.');
    const [one,two]=[a.id,b.id].sort((x,y)=>x-y);
    const old=db.prepare('SELECT * FROM duplas WHERE id_usuario=? AND atleta_a=? AND atleta_b=?').get(req.usuario.id,one,two);
    if(old) {db.prepare('UPDATE duplas SET arquivado=0 WHERE id=? AND id_usuario=?').run(old.id,req.usuario.id); return {body:pairView({...old,arquivado:0},req.usuario.id)};}
    const r=db.prepare('INSERT INTO duplas(id_usuario,atleta_a,atleta_b) VALUES(?,?,?)').run(req.usuario.id,one,two);
    return {status:201,body:pairView(owned('duplas',r.lastInsertRowid,req.usuario.id),req.usuario.id)};
  })));
  app.post('/duplas/:id/arquivar',auth,route((req,res)=>write(req,res,()=>{
    if(!owned('duplas',req.params.id,req.usuario.id)) fail(404,'Dupla não encontrada.');
    db.prepare('UPDATE duplas SET arquivado=1 WHERE id=? AND id_usuario=?').run(req.params.id,req.usuario.id);return {body:{mensagem:'Dupla arquivada. Partidas preservadas.'}};
  })));
  app.post('/partidas',auth,route((req,res)=>write(req,res,()=>{
    const b=req.body; let a1=text(b.atleta1),a2=text(b.atleta2),one=null,two=null,pair=null;
    if(b.dupla_id) {
      const d=owned('duplas',b.dupla_id,req.usuario.id); if(!d || d.arquivado) fail(404,'Dupla não encontrada ou arquivada.');
      one=athlete(b.atleta1_id,req.usuario.id,true);two=athlete(b.atleta2_id,req.usuario.id,true);
      if(one.id===two.id || [one.id,two.id].sort((x,y)=>x-y).join(',')!==[d.atleta_a,d.atleta_b].join(',')) fail(400,'As posições devem corresponder aos dois atletas da dupla.');
      pair=d.id;a1=one.nome;a2=two.nome;
    } else if(b.atleta1_id || b.atleta2_id) fail(400,'Selecione a dupla para vincular atletas.');
    if(!a1 || !a2) fail(400,'Informe os dois atletas.');
    const campeonato=text(b.campeonato,true),local=text(b.local,true),adv=text(b.adversario,true),date=text(b.data_partida,true,30);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) fail(400,'Informe uma data válida.');
    const url=videoUrl(b.video_url);
    const r=db.prepare(`INSERT INTO partidas(campeonato,local,adversario,data_partida,dupla,atleta1,atleta2,resultado,id_usuario,dupla_id,atleta1_id,atleta2_id,video_url)
      VALUES(?,?,?,?,?,?,?,'Em andamento',?,?,?,?,?)`).run(campeonato,local,adv,date,`${a1} / ${a2}`,a1,a2,req.usuario.id,pair,one?.id||null,two?.id||null,url);
    return {status:201,body:{id_partida:r.lastInsertRowid}};
  })));
  app.post('/evento',auth,route((req,res)=>write(req,res,()=>{
    const p=activeMatch(req),b=req.body;
    const results=categories()[b.fundamento];
    if(![1,2].includes(b.id_atleta) || !Number.isInteger(b.set_numero) || b.set_numero<1 || b.set_numero>3 || !results || (!results.includes(b.resultado) && !(b.fundamento==='side-out' && b.resultado==='bloqueado'))) fail(400,'Evento inválido. Confira atleta, set, fundamento e categoria.');
    const r=db.prepare('INSERT INTO eventos_partida(id_partida,id_atleta,set_numero,fundamento,resultado) VALUES(?,?,?,?,?)').run(p.id,b.id_atleta,b.set_numero,b.fundamento,b.resultado);
    return {body:{mensagem:'Evento salvo!',id:r.lastInsertRowid}};
  })));
  app.delete('/evento/ultimo/:id_partida',auth,route((req,res)=>write(req,res,()=>{
    const p=activeMatch(req),last=db.prepare('SELECT * FROM eventos_partida WHERE id_partida=? ORDER BY id DESC LIMIT 1').get(p.id);
    if(last) db.prepare('DELETE FROM eventos_partida WHERE id=?').run(last.id);
    return {body:{mensagem:'Desfeito!',evento:last || null}};
  })));
  app.post('/partidas/:id/finalizar',auth,route((req,res)=>write(req,res,()=>{
    const p=activeMatch(req),sets=req.body.sets;
    // Mesmo critério já usado pela tela: sets 1/2 a 21, set 3 a 15, diferença >=2.
    if(!Array.isArray(sets) || sets.length<2 || sets.length>3 || sets.some((s,i)=>s.set_numero!==i+1 || !Number.isInteger(s.pontos_dupla) || !Number.isInteger(s.pontos_adversario) || Math.min(s.pontos_dupla,s.pontos_adversario)<0 || Math.max(s.pontos_dupla,s.pontos_adversario)<(i===2?15:21) || Math.abs(s.pontos_dupla-s.pontos_adversario)<2)) fail(400,'Preencha placares completos e válidos dos sets.');
    db.prepare('DELETE FROM sets_partida WHERE id_partida=?').run(p.id);
    for(const s of sets) db.prepare('INSERT INTO sets_partida(id_partida,set_numero,pontos_dupla,pontos_adversario) VALUES(?,?,?,?)').run(p.id,s.set_numero,s.pontos_dupla,s.pontos_adversario);
    const result=finalResult(sets);db.prepare('UPDATE partidas SET resultado=? WHERE id=? AND id_usuario=?').run(result,p.id,req.usuario.id);return {body:{resultado:result}};
  })));
  app.get('/partidas/:id/dashboard',auth,route(async(req,res)=>{
    const p=match(req),type=req.query.tipo || 'dupla';
    if(!['dupla','atleta1','atleta2'].includes(type)) fail(400,'Seleção inválida.');
    const existing=db.prepare('SELECT set_numero FROM sets_partida WHERE id_partida=? UNION SELECT set_numero FROM eventos_partida WHERE id_partida=? ORDER BY set_numero').all(p.id,p.id).map(s=>s.set_numero);
    const set=req.query.set==null || req.query.set==='' ? null : Number(req.query.set);
    if(set!==null && (!Number.isInteger(set) || !existing.includes(set))) fail(400,'Este set não existe na partida.');
    const data=await report(p.id,type,req.usuario.id,set);
    // Categoria presente nos botões atuais; completar o dashboard sem alterar o mapa/saída PDF.
    data.detalhamento['side-out'].bloqueado ??= 0;
    const people=[p.atleta1_id,p.atleta2_id].map(id=>id && owned('atletas',id,req.usuario.id)).map(a=>a ? expose(a) : null);
    const distributions={};
    for(const [fund,detail] of Object.entries(data.detalhamento)) {
      const total=data.estatisticas[fund].total;
      distributions[fund]=Object.entries(detail).map(([categoria,quantidade])=>({categoria,quantidade,percentual:total ? Math.round(quantidade/total*10000)/100 : null}));
    }
    res.set('Cache-Control','no-store').json({...data,atletas:people,sets_disponiveis:existing,distribuicoes:distributions,selecao:{tipo:type,set}});
  }));
}
module.exports = {register,videoUrl};
