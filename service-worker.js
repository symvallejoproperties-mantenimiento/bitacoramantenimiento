const CACHE='bitacora-vp-ios-v12';
const SHELL=[
  './','./index.html','./captura.html','./vip.html','./login.html','./admin.html','./manifest.webmanifest',
  './css/style.css','./css/components.css','./css/captura.css','./css/dashboard.css','./css/home.css','./css/login.css','./css/orange.css',
  './js/app-shell.js','./js/auth.js','./js/camera.js','./js/captura.js','./js/dashboard.js','./js/gallery.js','./js/html2canvas.min.js','./js/login.js','./js/pdf-download.js','./js/pdf.js','./js/reportes.js','./js/signature.js','./js/storage.js','./js/utils.js',
  './data/predios.json','./data/usuarios.json','./data/bitacoras-recuperadas.json','./assets/logo/mantenimiento-icon.jpg','./assets/logo/mantenimiento.jpg','./assets/logo/vallejo-properties.png','./assets/logo/vallejo-properties-vertical.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('bitacora-vp-ios-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
function offlinePage(pathname){
  if(pathname.endsWith('/captura')||pathname.endsWith('/captura.html'))return './captura.html';
  if(pathname.endsWith('/vip')||pathname.endsWith('/vip.html'))return './vip.html';
  if(pathname.endsWith('/admin')||pathname.endsWith('/admin.html'))return './admin.html';
  if(pathname.endsWith('/login')||pathname.endsWith('/login.html'))return './login.html';
  return './index.html';
}
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(async()=>await caches.match(request)||await caches.match(offlinePage(url.pathname))||await caches.match('./index.html')));
    return;
  }
  const isCode=['style','script'].includes(request.destination);
  if(isCode){
    event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>caches.match(request)));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>{const network=fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>cached);return cached||network}));
});

function pendingDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('bitacora-vp-offline',2);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains('pending-records'))request.result.createObjectStore('pending-records',{keyPath:'record.id'});
      if(!request.result.objectStoreNames.contains('source-pdfs'))request.result.createObjectStore('source-pdfs',{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function pendingItems(){
  const database=await pendingDb();
  return new Promise((resolve,reject)=>{const request=database.transaction('pending-records','readonly').objectStore('pending-records').getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)});
}
async function removePending(id){
  const database=await pendingDb();
  return new Promise((resolve,reject)=>{const request=database.transaction('pending-records','readwrite').objectStore('pending-records').delete(id);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error)});
}
async function syncPendingRecords(){
  const items=await pendingItems();
  for(const item of items){
    const record={...item.record};delete record._pendingSync;
    if(!item.preserveFolio)delete record.folio;
    const response=await fetch(`/api/records/${encodeURIComponent(record.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});
    if(!response.ok)throw new Error(`No fue posible sincronizar ${record.id}: ${response.status}`);
    await removePending(record.id);
  }
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  clients.forEach(client=>client.postMessage({type:'vp-sync-complete',count:items.length}));
}
self.addEventListener('sync',event=>{if(event.tag==='vp-sync-records')event.waitUntil(syncPendingRecords())});
self.addEventListener('message',event=>{if(event.data?.type==='vp-sync-now')event.waitUntil(syncPendingRecords())});
