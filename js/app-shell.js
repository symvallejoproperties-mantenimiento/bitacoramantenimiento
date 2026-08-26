const status=document.createElement('div');
status.className='connection-status';
status.setAttribute('role','status');
status.setAttribute('aria-live','polite');
document.body.append(status);

function updateConnection(){
  const offline=!navigator.onLine;
  status.textContent=offline?'Sin conexión: puedes continuar; la bitácora se enviará al recuperar la señal.':'Conexión restablecida. Sincronizando…';
  status.classList.toggle('visible',offline);
  status.classList.toggle('online',!offline);
  if(!offline){
    status.classList.add('visible');
    setTimeout(()=>status.classList.remove('visible'),2200);
  }
}

window.addEventListener('offline',updateConnection);
window.addEventListener('online',updateConnection);
if(!navigator.onLine)updateConnection();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(error=>console.warn('No se pudo activar el modo sin conexión.',error)));
}
