const CACHE='bitacora-vp-ios-v5';
const SHELL=[
  './','./index.html','./captura.html','./vip.html','./login.html','./admin.html','./manifest.webmanifest',
  './css/style.css','./css/components.css','./css/captura.css','./css/dashboard.css','./css/home.css','./css/login.css','./css/orange.css',
  './js/app-shell.js','./js/auth.js','./js/camera.js','./js/captura.js','./js/dashboard.js','./js/gallery.js','./js/html2canvas.min.js','./js/login.js','./js/pdf-download.js','./js/pdf.js','./js/reportes.js','./js/signature.js','./js/storage.js','./js/utils.js',
  './data/predios.json','./data/usuarios.json','./assets/logo/mantenimiento-icon.jpg','./assets/logo/mantenimiento.jpg','./assets/logo/vallejo-properties.png','./assets/logo/vallejo-properties-vertical.png'
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
  event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>{const network=fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>cached);return cached||network}));
});
