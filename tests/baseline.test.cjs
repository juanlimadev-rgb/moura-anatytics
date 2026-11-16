const {test} = require('node:test');
const assert = require('node:assert/strict');
const {loadReportingSubject} = require('./helpers.cjs');
test('referência independente: fórmulas e categorias originais, inclusive eficiência negativa',async()=>{
  const {db,buscarDadosRelatorio} = loadReportingSubject();
  try {
    const a = await buscarDadosRelatorio(1,'atleta1',1);
    assert.deepEqual(JSON.parse(JSON.stringify(a.estatisticas.ataque)),{total:6,neutros:1,pontos:1,acertos:1,erros:4,aproveitamento:16.67,eficiencia:-50});
    assert.equal(a.estatisticas.saque.aproveitamento,null);
    assert.equal(a.estatisticas.bloqueio.eficiencia,null);
    assert.equal(a.estatisticas.passe.aproveitamento,60);
    assert.equal(a.estatisticas.passe.eficiencia,40);
    assert.equal(a.estatisticas.defesa.eficiencia,0);
    assert.equal(a.estatisticas['side-out'].eficiencia,-25);
    const b = await buscarDadosRelatorio(1,'atleta2',1);
    assert.equal(b.estatisticas.ataque.total,4);
    assert.equal(b.estatisticas.ataque.eficiencia,-25);
    const pair = await buscarDadosRelatorio(1,'dupla',1);
    assert.equal(pair.estatisticas.ataque.total,10);
    assert.equal(pair.estatisticas.ataque.eficiencia,-40);
    const empty = await buscarDadosRelatorio(2,'dupla',1);
    assert.equal(empty.estatisticas.ataque.eficiencia,0);
    assert.equal(empty.estatisticas.saque.eficiencia,null);
    assert.equal(await buscarDadosRelatorio(1,'dupla',2),null);
  } finally {db.close();}
});
test('todos os fundamentos/categorias conservam os denominadores e arredondamentos',async()=>{
  const {db,buscarDadosRelatorio}=loadReportingSubject(true);
  try {
    const expected={
      ataque:{total:4,acertos:1,erros:2,aproveitamento:25,eficiencia:-25},
      saque:{total:4,acertos:3,erros:1,aproveitamento:null,eficiencia:null},
      passe:{total:5,acertos:3,erros:1,aproveitamento:60,eficiencia:40},
      bloqueio:{total:3,acertos:1,erros:1,aproveitamento:null,eficiencia:null},
      defesa:{total:3,acertos:1,erros:1,aproveitamento:33.33,eficiencia:0},
      'side-out':{total:3,acertos:1,erros:1,aproveitamento:33.33,eficiencia:0},
      'contra-ataque':{total:4,acertos:1,erros:2,aproveitamento:25,eficiencia:-25}
    };
    const athlete=await buscarDadosRelatorio(1,'atleta2',1,2);
    for(const [fund,values] of Object.entries(expected)) {
      for(const [key,value] of Object.entries(values))assert.equal(athlete.estatisticas[fund][key],value,fund+' '+key);
      assert.ok(Object.values(athlete.detalhamento[fund]).every(v=>v===1),fund+' categorias');
    }
    const empty=await buscarDadosRelatorio(1,'atleta2',1,1);
    assert.ok(Object.values(empty.estatisticas).every(s=>s.total===0));
  }finally{db.close();}
});
