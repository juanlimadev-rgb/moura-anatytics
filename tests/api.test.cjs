const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {Database,seed,serve,root} = require('./helpers.cjs');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'Moura teste São Luís '));
process.env.MOURA_DATA_DIR=temp;delete process.env.JWT_SECRET;
const {app,connection:db,buscarDadosRelatorio}=require('../Backend/server');
const sharp=require('sharp');
test('fluxos HTTP reais, fórmulas, perfis e persistência',async t=>{
  let tokenA,tokenB,a,b,pair,matchId,photo;
  try {await serve(app,async base=>{
    async function request(method,url,body,token=tokenA,key) {
      const headers={};if(token)headers.Authorization=`Bearer ${token}`;if(body!==undefined)headers['Content-Type']='application/json';if(key)headers['Idempotency-Key']=key;
      const res=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
      const data=res.headers.get('content-type')?.includes('json')?await res.json():Buffer.from(await res.arrayBuffer());
      return {status:res.status,data};
    }
    await t.test('criar e autenticar dois perfis locais',async()=>{
      for(const name of ['a','b']) {
        assert.equal((await request('POST','/auth/cadastro',{nome:'Perfil '+name,email:name+'@example.test',senha:'teste-ficticio'},null)).status,201);
        const login=await request('POST','/auth/login',{email:name+'@example.test',senha:'teste-ficticio'},null);assert.equal(login.status,200);
        if(name==='a')tokenA=login.data.token;else tokenB=login.data.token;
      }
      assert.equal((await request('GET','/atletas',undefined,null)).status,401);
    });
    await t.test('dois atletas com foto, conteúdo inválido, limites e nomes iguais',async()=>{
      photo='data:image/png;base64,'+(await sharp({create:{width:40,height:70,channels:3,background:'#02857b'}}).png().toBuffer()).toString('base64');
      const key=crypto.randomUUID();const body={nome:'Ana',clube:'Clube Referência',foto:photo,pais:'Brasil',altura:1.8,idade:25,dupla:'Anotação histórica'};
      const saved=await request('POST','/atletas',body,tokenA,key);assert.equal(saved.status,201);a=saved.data;
      const replay=await request('POST','/atletas',body,tokenA,key);assert.equal(replay.data.id,a.id);
      assert.equal((await request('POST','/atletas',{...body,nome:'Outra'},tokenA,key)).status,409);
      const second=await request('POST','/atletas',{nome:'Duda',clube:'Clube B',foto:photo});assert.equal(second.status,201);b=second.data;
      const duplicate=await request('POST','/atletas',{nome:'Ana'});assert.equal(duplicate.status,201);assert.notEqual(duplicate.data.id,a.id);
      assert.equal((await request('POST','/atletas',{nome:''})).status,400);
      for(const invalid of ['data:image/png;base64,AAAA','data:image/svg+xml;base64,PHN2Zy8+','data:image/jpeg;base64,'+Buffer.from('<script>x</script>').toString('base64'),'data:image/png;base64,'+'A'.repeat(4300000)]) {
        assert.ok([400,413].includes((await request('POST','/atletas',{nome:'Inválida',foto:invalid})).status));
      }
      const huge='data:image/png;base64,'+(await sharp({create:{width:5000,height:5000,channels:3,background:'white'}}).png().toBuffer()).toString('base64');
      assert.equal((await request('POST','/atletas',{nome:'Grande',foto:huge})).status,400);
      const img=await request('GET',a.foto_url);assert.equal(img.status,200);const meta=await sharp(img.data).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,40);assert.equal(meta.height,70);
      assert.deepEqual((await request('GET','/atletas?q=DU')).data.map(x=>x.id),[b.id]);
      assert.equal((await request('GET','/atletas',undefined,tokenB)).data.length,0);
    });
    await t.test('formações por IDs e reutilização invertida',async()=>{
      assert.equal((await request('POST','/duplas',{atleta_a:a.id,atleta_b:a.id})).status,400);
      const created=await request('POST','/duplas',{atleta_a:a.id,atleta_b:b.id});assert.equal(created.status,201);pair=created.data;
      const reversed=await request('POST','/duplas',{atleta_a:b.id,atleta_b:a.id});assert.equal(reversed.status,200);assert.equal(reversed.data.id,pair.id);
      const c=(await request('POST','/atletas',{nome:'Ana'})).data;
      assert.equal((await request('POST','/duplas',{atleta_a:a.id,atleta_b:c.id})).status,201);
    });
    const matchBody=()=>({campeonato:'Copa',local:'São Luís',adversario:'Oponentes',data_partida:'2026-01-20',dupla_id:pair.id,atleta1_id:b.id,atleta2_id:a.id,video_url:'https://example.test/jogo'});
    await t.test('iniciar com posições invertidas e URL; cliques duplicados idempotentes',async()=>{
      for(const url of ['javascript:alert(1)','file:///x','ftp://example.test','http:example.test','https://','https://ex ample.test']) assert.equal((await request('POST','/partidas',{...matchBody(),video_url:url})).status,400);
      const key=crypto.randomUUID();const results=await Promise.all([request('POST','/partidas',matchBody(),tokenA,key),request('POST','/partidas',matchBody(),tokenA,key)]);
      assert.equal(results[0].status,201);assert.equal(results[0].data.id_partida,results[1].data.id_partida);matchId=results[0].data.id_partida;
      const p=(await request('GET',`/partidas/${matchId}/dashboard`)).data.partida;
      assert.equal(p.atleta1,'Duda');assert.equal(p.atleta2,'Ana');assert.equal(p.atleta1_id,b.id);assert.equal(p.video_url,'https://example.test/jogo');
      assert.equal((await request('POST','/partidas',{...matchBody(),atleta1_id:a.id})).status,400);
    });
    const event=(position,set,result='ponto',fund='ataque')=>({id_partida:matchId,id_atleta:position,set_numero:set,fundamento:fund,resultado:result});
    await t.test('nenhum evento, um atleta, dois atletas e desfazer',async()=>{
      const empty=(await request('GET',`/partidas/${matchId}/dashboard`)).data;
      assert.deepEqual(empty.sets_disponiveis,[]);assert.equal(empty.estatisticas.ataque.total,0);assert.equal(empty.distribuicoes.ataque[0].percentual,null);assert.equal(empty.estatisticas.saque.eficiencia,null);
      const key=crypto.randomUUID();await Promise.all([request('POST','/evento',event(1,1),tokenA,key),request('POST','/evento',event(1,1),tokenA,key)]);
      assert.equal((await request('GET',`/partidas/${matchId}/dashboard?tipo=atleta2`)).data.estatisticas.ataque.total,0);
      const undo=await request('DELETE',`/evento/ultimo/${matchId}`,undefined,tokenA,crypto.randomUUID());assert.equal(undo.data.evento.id_atleta,1);
      assert.equal((await request('GET',`/partidas/${matchId}/dashboard`)).data.estatisticas.ataque.total,0);
      for(const data of [event(1,1,'ponto'),event(1,1,'erro'),event(1,1,'bloqueado'),event(2,2,'neutro'),event(2,2,'ponto'),event(2,2,'ace','saque')]) assert.equal((await request('POST','/evento',data)).status,200);
      assert.equal((await request('POST','/evento',event(3,1))).status,400);
      assert.equal((await request('POST','/evento',event(1,1,'inexistente'))).status,400);
    });
    await t.test('filtros combinados com resultados calculados independentemente',async()=>{
      const all=(await request('GET',`/partidas/${matchId}/dashboard`)).data;
      assert.equal(all.estatisticas.ataque.total,5);assert.equal(all.estatisticas.ataque.aproveitamento,40);assert.equal(all.estatisticas.ataque.eficiencia,0);
      assert.equal(all.distribuicoes.ataque.find(d=>d.categoria==='ponto').percentual,40);
      assert.equal(all.distribuicoes.ataque.find(d=>d.categoria==='erro').percentual,20);
      const one=(await request('GET',`/partidas/${matchId}/dashboard?tipo=atleta1&set=1`)).data;
      assert.equal(one.estatisticas.ataque.total,3);assert.equal(one.estatisticas.ataque.eficiencia,-33.33);
      const two=(await request('GET',`/partidas/${matchId}/dashboard?tipo=atleta2&set=2`)).data;
      assert.equal(two.estatisticas.ataque.total,2);assert.equal(two.estatisticas.ataque.aproveitamento,50);assert.equal(two.estatisticas.ataque.eficiencia,50);
      const cross=(await request('GET',`/partidas/${matchId}/dashboard?tipo=atleta1&set=2`)).data;
      assert.equal(cross.estatisticas.ataque.total,0);assert.equal(cross.estatisticas.ataque.eficiencia,0);
      assert.equal((await request('GET',`/partidas/${matchId}/dashboard?set=9`)).status,400);
      assert.equal((await request('GET',`/partidas/${matchId}/dashboard?tipo=outro`)).status,400);
    });
    await t.test('isolamento também por IDs diretos em todas as operações',async()=>{
      for(const [method,url,body] of [
        ['GET','/atletas/'+a.id],['GET',a.foto_url],['PUT','/atletas/'+a.id,{nome:'Invadido'}],['POST',`/atletas/${a.id}/arquivar`,{}],
        ['GET','/duplas/'+pair.id],['POST',`/duplas/${pair.id}/arquivar`,{}],['POST','/duplas',{atleta_a:a.id,atleta_b:b.id}],
        ['POST','/partidas',matchBody()],['GET',`/partidas/${matchId}/dashboard`],['GET',`/relatorio/${matchId}/dupla/pdf`],
        ['POST','/evento',event(1,1)],['DELETE',`/evento/ultimo/${matchId}`],['POST',`/partidas/${matchId}/finalizar`,{sets:[]}]
      ]) assert.equal((await request(method,url,body,tokenB)).status,404,method+' '+url);
      assert.deepEqual((await request('GET','/partidas',undefined,tokenB)).data,[]);
      assert.equal((await request('POST','/atletas',{nome:'Só B',id_usuario:1},tokenB)).data.id_usuario,2);
    });
    await t.test('editar foto/nome preserva snapshot histórico; arquivamento preserva eventos e PDFs',async()=>{
      assert.equal((await request('PUT','/atletas/'+a.id,{nome:'Nome atualizado',foto:null})).status,200);
      const edited=(await request('GET','/atletas/'+a.id)).data;assert.equal(edited.foto_url,null);assert.equal(edited.pais,'Brasil');assert.equal(edited.altura,1.8);
      assert.equal((await request('PUT','/atletas/'+a.id,{nome:'Nome atualizado',foto:photo})).status,200);
      assert.equal((await request('GET',`/partidas/${matchId}/dashboard`)).data.partida.atleta2,'Ana');
      assert.equal((await request('POST',`/atletas/${a.id}/arquivar`,{})).status,200);
      assert.equal((await request('POST','/partidas',matchBody())).status,404);
      assert.equal((await request('POST',`/duplas/${pair.id}/arquivar`,{})).status,200);
      assert.ok((await request('GET',`/partidas/${matchId}/dashboard`)).data.estatisticas.ataque.total>0);
    });
    await t.test('finalizar com transação, histórico, três PDFs e bloqueio de alterações após final',async()=>{
      assert.equal((await request('POST',`/partidas/${matchId}/finalizar`,{sets:[{set_numero:1,pontos_dupla:1,pontos_adversario:0}]})).status,400);
      const sets=[{set_numero:1,pontos_dupla:21,pontos_adversario:18},{set_numero:2,pontos_dupla:17,pontos_adversario:21},{set_numero:3,pontos_dupla:15,pontos_adversario:13}];
      const key=crypto.randomUUID();const final=await request('POST',`/partidas/${matchId}/finalizar`,{sets},tokenA,key);assert.equal(final.data.resultado,'2 x 1');
      assert.equal((await request('POST',`/partidas/${matchId}/finalizar`,{sets},tokenA,key)).status,200);
      assert.equal((await request('POST','/evento',event(1,1))).status,409);
      assert.equal((await request('DELETE',`/evento/ultimo/${matchId}`)).status,409);
      const list=(await request('GET','/partidas')).data;assert.equal(list.length,1);assert.equal(list[0].resultado,'2 x 1');
      assert.deepEqual((await request('GET',`/partidas/${matchId}/dashboard`)).data.sets_disponiveis,[1,2,3]);
      for(const type of ['dupla','atleta1','atleta2']) {const pdf=await request('GET',`/relatorio/${matchId}/${type}/pdf?set=1`);assert.equal(pdf.status,200);assert.equal(pdf.data.subarray(0,4).toString(),'%PDF');}
    });
    await t.test('reabrir banco em caminho com espaços/acentos e recarregar fotos',async()=>{
      const reopened=new Database(path.join(temp,'moura.db'),{readonly:true});
      assert.equal(reopened.prepare('SELECT video_url FROM partidas WHERE id=?').get(matchId).video_url,'https://example.test/jogo');
      const saved=reopened.prepare('SELECT * FROM atletas WHERE id=?').get(a.id);assert.equal(saved.arquivado,1);assert.ok(fs.existsSync(path.join(temp,'photos',saved.foto)));
      assert.equal(reopened.prepare('SELECT count(*) n FROM duplas').get().n,2);reopened.close();
      const secret=fs.readFileSync(path.join(temp,'local-secret'),'utf8');assert.ok(secret.length>=64);
    });
  });} finally{db.close();}
});
