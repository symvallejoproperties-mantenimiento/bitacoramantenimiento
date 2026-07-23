export const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
export const fmtDate=v=>v?new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(v)): '—';
export const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export function toast(msg,type='ok'){let n=document.createElement('div');n.className=`toast ${type}`;n.textContent=msg;document.body.append(n);setTimeout(()=>n.remove(),3200)}
export function uid(){return crypto.randomUUID?.()||Date.now().toString(36)}
export function download(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
export function minutes(a,b){if(!a||!b)return 0;let [ah,am]=a.split(':').map(Number),[bh,bm]=b.split(':').map(Number);return Math.max(0,bh*60+bm-ah*60-am)}
