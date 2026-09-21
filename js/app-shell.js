const status=document.createElement('div');
status.className='connection-status';
status.setAttribute('role','status');
status.setAttribute('aria-live','polite');
document.body.append(status);

function showConnectionMessage(message){
  status.textContent=message;
  status.classList.add('visible','online');
  setTimeout(()=>status.classList.remove('visible'),3200);
}

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

window.addEventListener('online',()=>window.dispatchEvent(new CustomEvent('vp:sync-requested')));

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const registration=await navigator.serviceWorker.register('/service-worker.js?v=4',{scope:'/'});
      await registration.update();
    }catch(error){console.warn('No se pudo activar el modo sin conexión.',error)}
  });
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type!=='vp-sync-complete')return;
    window.dispatchEvent(new CustomEvent('vp:sync-requested'));
    if(event.data.count)showConnectionMessage(`${event.data.count} bitácora${event.data.count===1?'':'s'} sincronizada${event.data.count===1?'':'s'} correctamente.`);
  });
}
