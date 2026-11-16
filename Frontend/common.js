// Utilitários de interface, sem fórmulas esportivas.
const ui = {
  esc(value) {return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  async api(url,options={}) {
    const headers={Authorization:`Bearer ${localStorage.getItem('token')}`,...options.headers};
    if(options.body) {headers['Content-Type']='application/json';headers['Idempotency-Key'] ||= crypto.randomUUID();}
    if(options.method==='DELETE') headers['Idempotency-Key'] ||= crypto.randomUUID();
    const response=await fetch(url,{...options,headers});
    const data=await response.json();
    if(response.status===401) {localStorage.removeItem('token');window.location.href='login.html';throw Error('Entre novamente no seu perfil.');}
    if(!response.ok) throw Error(data.erro || 'Não foi possível concluir a operação.');
    return data;
  },
  avatar(name,photoUrl) {
    return `<span class="avatar" role="img" aria-label="${ui.esc(name || 'Atleta')}">${photoUrl ? `<img data-photo="${ui.esc(photoUrl)}" alt="${ui.esc(name)}">` : '<svg aria-hidden="true" viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/></svg>'}</span>`;
  },
  async photos(container) {
    await Promise.all([...container.querySelectorAll('img[data-photo]')].map(async img=>{
      try {
        const response=await fetch(img.dataset.photo,{headers:{Authorization:`Bearer ${localStorage.getItem('token')}`}});
        if(!response.ok) throw Error();
        const objectUrl=URL.createObjectURL(await response.blob());
        img.onload=()=>URL.revokeObjectURL(objectUrl);img.src=objectUrl;
      } catch {img.replaceWith(Object.assign(document.createElement('span'),{textContent:'●'}));}
    }));
  },
  busy(button,state) {button.disabled=state;button.setAttribute('aria-busy',String(state));}
};
