const CACHE='bitacora-vp-ios-v9';
const SHELL=['./','./index.html','./captura.html','./vip.html','./login.html','./admin.html','./manifest.webmanifest','./css/style.css','./css/home.css','./css/components.css','./css/captura.css','./css/login.css','./css/dashboard.css','./js/app-shell.js','./js/storage.js','./js/auth.js','./js/utils.js','./js/captura.js','./js/login.js','./js/dashboard.js','./js/gallery.js','./js/signature.js','./js/pdf-download.js','./js/html2canvas.min.js','./data/predios.json','./data/usuarios.json','./assets/logo/mantenimiento-icon.jpg','./assets/logo/mantenimiento.jpg','./assets/logo/vallejo-properties.png'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE)
    .then(cache=>Promise.allSettled(SHELL.map(asset=>cache.add(asset))))
    .then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));

const PAGE_FALLBACKS={
  '/':'./index.html',
  '/vip':'./vip.html',
  '/vip.html':'./vip.html',
  '/captura':'./captura.html',
  '/captura.html':'./captura.html',
  '/admin':'./admin.html',
  '/admin.html':'./admin.html',
  '/login':'./login.html',
  '/login.html':'./login.html'
};

async function staleWhileRevalidate(request){
  const cached=await caches.match(request,{ignoreSearch:true});
  const refresh=fetch(request).then(async response=>{
    if(response.ok)(await caches.open(CACHE)).put(request,response.clone());
    return response;
  }).catch(()=>null);
  if(cached){refresh.catch(()=>null);return cached}
  return (await refresh)||new Response('Sin conexión',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate')event.respondWith((async()=>{
    const response=await staleWhileRevalidate(event.request);
    if(response.status!==503)return response;
    return caches.match(PAGE_FALLBACKS[url.pathname]||'./index.html',{ignoreSearch:true})||response;
  })());
  else if(['script','style','image'].includes(event.request.destination))event.respondWith(staleWhileRevalidate(event.request));
  else event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request).then(async response=>{if(response.ok)(await caches.open(CACHE)).put(event.request,response.clone());return response})));
});
