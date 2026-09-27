try { document.documentElement.dataset.theme=localStorage.getItem('consultorio-theme')||'light'; } catch {}
const menu=document.querySelector('[data-menu]');
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'Cerrar':'Menú';document.querySelector('.nav').classList.toggle('open',open);});
document.querySelector('[data-theme-toggle]')?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('consultorio-theme',next);}catch{}});
