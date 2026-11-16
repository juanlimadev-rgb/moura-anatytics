let analysisId=null,analysisVersion=0,analysisController;
function closeAnalysis() {
  ++analysisVersion;analysisController?.abort();analysisId=null;
  document.getElementById('analysis').hidden=true;
  document.querySelectorAll('main.page > section:not(#analysis)').forEach(s=>s.hidden=false);
  document.getElementById('history').scrollIntoView({block:'start'});
}
async function openAnalysis(id) {
  analysisId=id;
  document.querySelectorAll('main.page > section:not(#analysis)').forEach(s=>s.hidden=true);
  document.getElementById('analysis').hidden=false;
  document.getElementById('analysis-type').value='dupla';document.getElementById('analysis-set').innerHTML='<option value="">Partida inteira</option>';
  document.getElementById('analysis-title').textContent='Análise da partida';
  document.getElementById('analysis-meta').replaceChildren();document.getElementById('analysis-people').replaceChildren();document.getElementById('analysis-pdfs').replaceChildren();
  window.scrollTo(0,0);await loadAnalysis(true);
}
async function loadAnalysis(initial=false) {
  if(!analysisId)return;
  const version=++analysisVersion;analysisController?.abort();analysisController=new AbortController();
  const type=document.getElementById('analysis-type').value,set=document.getElementById('analysis-set').value;
  const content=document.getElementById('analysis-stats'),status=document.getElementById('analysis-status');
  content.replaceChildren();content.setAttribute('aria-busy','true');status.textContent='Carregando a seleção…';
  try {
    const data=await ui.api(`/partidas/${analysisId}/dashboard?tipo=${encodeURIComponent(type)}&set=${encodeURIComponent(set)}`,{signal:analysisController.signal});
    if(version!==analysisVersion)return;
    const p=data.partida,names={dupla:p.dupla || `${p.atleta1 || 'Atleta 1'} / ${p.atleta2 || 'Atleta 2'}`,atleta1:p.atleta1 || 'Atleta 1',atleta2:p.atleta2 || 'Atleta 2'};
    const label=`${names[type]} · ${set ? 'Set '+set : 'Partida inteira'}`;
    document.getElementById('analysis-title').textContent=names.dupla;
    document.getElementById('analysis-type').innerHTML=Object.entries(names).map(([value,name])=>`<option value="${value}" ${value===type?'selected':''}>${ui.esc(value==='dupla'?'Dupla':name)}</option>`).join('');
    document.getElementById('analysis-set').innerHTML='<option value="">Partida inteira</option>'+data.sets_disponiveis.map(s=>`<option value="${s}" ${String(s)===set?'selected':''}>Set ${s}</option>`).join('');
    document.getElementById('analysis-meta').innerHTML=`<div><span class="small-label">Adversário</span><strong>${ui.esc(p.adversario || 'Não informado')}</strong></div><div><span class="small-label">Data</span><strong>${ui.esc(formatarDataHistorico(p.data_partida))}</strong></div><div><span class="small-label">Campeonato</span><strong>${ui.esc(p.campeonato || 'Não informado')}</strong></div><div><span class="small-label">Local</span><strong>${ui.esc(p.local || 'Não informado')}</strong></div><div><span class="small-label">Resultado da partida</span><strong>${ui.esc(p.resultado || 'Não informado')}</strong><p>${ui.esc(data.sets.map(s=>`Set ${s.set_numero}: ${s.pontos_dupla} × ${s.pontos_adversario}`).join(' · ') || 'Nenhum placar registrado')}</p></div>${p.video_url ? `<a class="topbar-btn" href="${ui.esc(p.video_url)}" target="_blank" rel="noopener noreferrer">Abrir vídeo no navegador ↗</a>` : ''}`;
    const people=document.getElementById('analysis-people');
    people.innerHTML=[1,2].map((n,i)=>`<div class="person">${ui.avatar(names['atleta'+n],data.atletas[i]?.foto_url)}<div><span class="small-label">Atleta ${n} nesta partida</span><strong>${ui.esc(names['atleta'+n])}</strong><span>${ui.esc(data.atletas[i]?.clube || 'Clube não informado')}</span></div></div>`).join('');ui.photos(people);
    document.getElementById('analysis-pdfs').innerHTML=Object.entries(names).map(([value,name])=>`<button class="topbar-btn" type="button" data-pdf-type="${value}">PDF ${ui.esc(name)} · partida inteira</button>`).join('');
    document.querySelectorAll('[data-pdf-type]').forEach(button=>button.onclick=async()=>{ui.busy(button,true);try{await gerarRelatorioPDF(analysisId,button.dataset.pdfType);}finally{ui.busy(button,false);}});
    status.textContent='Seleção ativa: '+label;
    const hasEvents=Object.values(data.estatisticas).some(e=>e.total>0);
    content.innerHTML=(hasEvents?'':`<p class="empty-state">Nenhum evento nesta seleção. Ausência de dados não indica desempenho ruim.</p>`)+Object.entries(data.estatisticas).map(([fund,e])=>{
      const metrics=e.total>0 ? `${e.aproveitamento!==null?`<span>Aproveitamento <strong>${e.aproveitamento.toFixed(2)}%</strong></span>`:''}${e.eficiencia!==null?`<span>Eficiência <strong>${e.eficiencia.toFixed(2)}%</strong></span>`:''}` : '<span>Métricas sem dados nesta seleção.</span>';
      return `<article class="stat-card"><div class="stat-heading"><h3>${ui.esc(formatFundamento(fund))}</h3><strong>${e.total} registros</strong></div><p class="stat-scope">${ui.esc(label)}</p>${e.total?'':'<p class="empty-state compact">Nenhum registro deste fundamento.</p>'}<div class="metric-row">${metrics}${['saque','bloqueio'].includes(fund)?'<span>Aproveitamento e eficiência: não se aplicam.</span>':''}</div><table><caption>Distribuição por categoria · base: ${e.total} registros de ${ui.esc(formatFundamento(fund))} nesta seleção</caption><thead><tr><th scope="col">Categoria</th><th scope="col">Quantidade</th><th scope="col">Distribuição</th></tr></thead><tbody>${data.distribuicoes[fund].map(d=>`<tr><th scope="row">${ui.esc(formatResultado(d.categoria))}</th><td>${d.quantidade}</td><td><div class="distribution"><span>${d.percentual===null?'Sem dados':d.percentual.toFixed(2)+'%'}</span><span class="bar-track" aria-hidden="true"><span style="width:${d.percentual || 0}%"></span></span></div></td></tr>`).join('')}</tbody></table></article>`;
    }).join('');
  }catch(e){if(e.name!=='AbortError' && version===analysisVersion){status.textContent=e.message;content.innerHTML='<p class="empty-state">Não foi possível carregar a seleção. Tente novamente.</p>';}}
  finally{if(version===analysisVersion)content.setAttribute('aria-busy','false');}
}
document.getElementById('analysis-type').onchange=()=>loadAnalysis();
document.getElementById('analysis-set').onchange=()=>loadAnalysis();
document.getElementById('analysis-back').onclick=closeAnalysis;
document.getElementById('analysis-retry').onclick=()=>loadAnalysis();
