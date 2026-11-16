const roster={athletes:[],pairs:[],photo:undefined,editing:null};
const rosterDialog=document.getElementById('roster-dialog');
async function refreshRoster() {
  const selected=document.getElementById('match-pair').value;
  [roster.athletes,roster.pairs]=await Promise.all([ui.api('/atletas'),ui.api('/duplas')]);
  const eligible=roster.pairs.filter(p=>p.atletas.every(a=>!a.arquivado));
  document.getElementById('match-pair').innerHTML='<option value="">Preenchimento manual</option>'+eligible.map(p=>`<option value="${p.id}">${ui.esc(p.atletas.map(a=>a.nome).join(' / '))}</option>`).join('');
  document.getElementById('match-pair').value=selected;
  for(const id of ['pair-one','pair-two']) document.getElementById(id).innerHTML='<option value="">Selecione um atleta</option>'+roster.athletes.map(a=>`<option value="${a.id}">${ui.esc(a.nome)}${a.clube ? ' · '+ui.esc(a.clube) : ''} · #${a.id}</option>`).join('');
  applyPair();
}
function applyPair(swap=false) {
  if(idPartidaAtual && !partidaFinalizada) return;
  const pair=roster.pairs.find(p=>p.id===Number(document.getElementById('match-pair').value));
  let athletes=pair?.atletas || [];
  if(pair && document.getElementById('atleta1').dataset.athleteId===String(athletes[1].id)) athletes=[...athletes].reverse();
  if(swap) athletes=[...athletes].reverse();
  [1,2].forEach((n,i)=>{
    const input=document.getElementById('atleta'+n);
    if(pair) {input.value=athletes[i].nome;input.dataset.athleteId=athletes[i].id;}
    else delete input.dataset.athleteId;
    input.readOnly=Boolean(pair);
  });
  document.getElementById('swap-positions').disabled=!pair || Boolean(idPartidaAtual && !partidaFinalizada);
  const people=document.getElementById('match-people');
  people.innerHTML=athletes.map((a,i)=>`<div class="person">${ui.avatar(a.nome,a.foto_url)}<div><span class="small-label">Atleta ${i+1} nesta partida</span><strong>${ui.esc(a.nome)}</strong><span>${ui.esc(a.clube)}</span></div></div>`).join('');
  ui.photos(people);aplicarNomesNaTela();
}
function matchRosterData() {
  return {dupla_id:Number(document.getElementById('match-pair').value)||null,
    atleta1_id:Number(document.getElementById('atleta1').dataset.athleteId)||null,
    atleta2_id:Number(document.getElementById('atleta2').dataset.athleteId)||null,video_url:document.getElementById('video-url').value.trim()};
}
function lockMatchForm(locked) {
  document.querySelectorAll('.match-setup-panel input,.match-setup-panel select,#swap-positions').forEach(el=>el.disabled=locked);
  if(!locked) document.getElementById('swap-positions').disabled=!document.getElementById('match-pair').value;
}
async function openRoster(tab) {
  rosterDialog.showModal();showRosterTab(tab);
  try {await refreshRoster();await renderAthletes();renderPairs();}
  catch(e){rosterMessage(e.message,true);}
}
function showRosterTab(tab) {
  document.getElementById('athletes-area').hidden=tab!=='athletes';
  document.getElementById('pairs-area').hidden=tab!=='pairs';
  document.getElementById('roster-title').textContent=tab==='athletes'?'Atletas':'Duplas';
  rosterMessage('');
}
function rosterMessage(message,error=false) {
  const el=document.getElementById('roster-message');el.textContent=message;el.className=error?'form-message error':'form-message';
}
let athleteListRequest=0;
async function renderAthletes() {
  const request=++athleteListRequest;
  const rows=await ui.api('/atletas?q='+encodeURIComponent(document.getElementById('athlete-search').value)+'&arquivados='+(document.getElementById('show-archived').checked?'1':'0'));
  if(request!==athleteListRequest)return;
  const list=document.getElementById('athlete-list');
  list.innerHTML=rows.length? rows.map(a=>`<article class="roster-card"><div class="person">${ui.avatar(a.nome,a.foto_url)}<div><strong>${ui.esc(a.nome)}</strong><span>${ui.esc(a.clube || 'Clube não informado')} · #${a.id}${a.arquivado?' · Arquivado':''}</span></div></div><div class="topbar-actions"><button class="topbar-btn" data-edit="${a.id}" type="button">Editar</button>${a.arquivado?'':`<button class="topbar-btn" data-archive-athlete="${a.id}" type="button">Arquivar</button>`}</div></article>`).join(''):'<p class="empty-state">Nenhum atleta encontrado.</p>';
  list.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>editAthlete(rows.find(a=>a.id===Number(button.dataset.edit))));
  list.querySelectorAll('[data-archive-athlete]').forEach(button=>button.onclick=()=>archive('atletas',button.dataset.archiveAthlete,button));
  ui.photos(list);
  if(!roster.editing && !document.querySelector('#photo-preview img')) document.getElementById('photo-preview').innerHTML=ui.avatar('Sem foto');
}
function editAthlete(a=null) {
  roster.editing=a?.id || null;roster.photo=undefined;
  document.getElementById('athlete-form').reset();
  for(const key of ['nome','clube','pais','altura','idade','dupla']) document.getElementById('athlete-'+key).value=a?.[key] ?? '';
  document.getElementById('athlete-form-title').textContent=a?'Editar atleta':'Adicionar atleta';
  const preview=document.getElementById('photo-preview');preview.innerHTML=ui.avatar(a?.nome,a?.foto_url);ui.photos(preview);
  document.getElementById('athlete-nome').focus();
}
function renderPairs() {
  const list=document.getElementById('pair-list');
  list.innerHTML=roster.pairs.length?roster.pairs.map(p=>`<article class="roster-card"><div><strong>${ui.esc(p.atletas.map(a=>a.nome).join(' / '))}</strong><p>Formação #${p.id}${p.atletas.some(a=>a.arquivado)?' · Contém atleta arquivado':''}</p></div><button type="button" class="topbar-btn" data-archive-pair="${p.id}">Arquivar</button></article>`).join(''):'<p class="empty-state">Cadastre dois atletas e forme sua primeira dupla.</p>';
  list.querySelectorAll('[data-archive-pair]').forEach(button=>button.onclick=()=>archive('duplas',button.dataset.archivePair,button));
}
async function archive(kind,id,button) {
  if(!confirm('Arquivar este cadastro? As partidas e os relatórios serão preservados.'))return;
  ui.busy(button,true);
  try {await ui.api(`/${kind}/${id}/arquivar`,{method:'POST',body:'{}'});await refreshRoster();await renderAthletes();renderPairs();rosterMessage('Cadastro arquivado. Partidas preservadas.');}
  catch(e){rosterMessage(e.message,true);}finally{ui.busy(button,false);}
}
document.getElementById('athlete-form').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('[type=submit]');if(button.disabled)return;ui.busy(button,true);
  const body={};for(const key of ['nome','clube','pais','altura','idade','dupla'])body[key]=document.getElementById('athlete-'+key).value;
  if(roster.photo!==undefined)body.foto=roster.photo;
  try {
    await ui.api('/atletas'+(roster.editing?'/'+roster.editing:''),{method:roster.editing?'PUT':'POST',body:JSON.stringify(body)});
    editAthlete();await refreshRoster();await renderAthletes();renderPairs();rosterMessage('Atleta salvo. Os dados da partida continuam preenchidos.');
  }catch(e){rosterMessage(e.message,true);}finally{ui.busy(button,false);}
};
document.getElementById('athlete-photo').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(file.size>3*1024*1024 || !['image/png','image/jpeg','image/webp'].includes(file.type)){rosterMessage('Selecione PNG, JPEG ou WebP de até 3 MB.',true);event.target.value='';return;}
  const reader=new FileReader();reader.onload=()=>{roster.photo=reader.result;const img=document.createElement('img');img.src=reader.result;img.alt='Prévia da foto';document.getElementById('photo-preview').replaceChildren(img);};reader.readAsDataURL(file);
};
document.getElementById('remove-photo').onclick=()=>{roster.photo=null;document.getElementById('athlete-photo').value='';document.getElementById('photo-preview').innerHTML=ui.avatar('Sem foto');};
document.getElementById('new-athlete').onclick=()=>editAthlete();
document.getElementById('pair-form').onsubmit=async event=>{
  event.preventDefault();const button=event.target.querySelector('[type=submit]');if(button.disabled)return;ui.busy(button,true);
  try{
    const pair=await ui.api('/duplas',{method:'POST',body:JSON.stringify({atleta_a:Number(document.getElementById('pair-one').value),atleta_b:Number(document.getElementById('pair-two').value)})});
    await refreshRoster();renderPairs();
    if(!idPartidaAtual || partidaFinalizada) {document.getElementById('match-pair').value=pair.id;applyPair();}
    rosterMessage('Dupla salva e disponível. A formação existente é reutilizada.');
  }catch(e){rosterMessage(e.message,true);}finally{ui.busy(button,false);}
};
document.getElementById('athlete-search').oninput=()=>renderAthletes().catch(e=>rosterMessage(e.message,true));
document.getElementById('show-archived').onchange=()=>renderAthletes().catch(e=>rosterMessage(e.message,true));
document.getElementById('match-pair').onchange=()=>applyPair();
document.getElementById('swap-positions').onclick=()=>applyPair(true);
if(localStorage.getItem('token'))refreshRoster().catch(e=>showToast(e.message,true));
