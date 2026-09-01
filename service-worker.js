const CACHE='bitacora-vp-ios-v5';
const SHELL=['./','./index.html','./captura.html','./login.html','./admin.html','./manifest.webmanifest','./css/style.css','./css/home.css','./css/components.css','./css/captura.css','./css/login.css','./css/dashboard.css','./js/app-shell.js','./js/storage.js','./js/auth.js','./js/utils.js','./js/captura.js','./js/login.js','./js/dashboard.js','./data/predios.json','./data/usuarios.json'];

self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));

async function networkFirst(request){
  try{
    const response=await fetch(request);
    if(response.ok)(await caches.open(CACHE)).put(request,response.clone());
    return response;
  }catch(error){
    return (await caches.match(request))||new Response('Sin conexión',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }
}

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'||['script','style'].includes(event.request.destination))event.respondWith(networkFirst(event.request));
  else event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(async response=>{if(response.ok)(await caches.open(CACHE)).put(event.request,response.clone());return response})));
});
