// Controlador de retiro: elimina las versiones que podían bloquear la navegación.
// La aplicación conserva localmente bitácoras pendientes y las sincroniza al volver
// la conexión, pero las páginas siempre se cargan directamente desde Cloudflare.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.map(key=>caches.delete(key))))
    .then(()=>self.registration.unregister())
    .then(()=>self.clients.claim())
));
