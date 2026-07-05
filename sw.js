const CACHE="gastos-familia-v5";
const SHELL=["./index.html","./config.js","./manifest.json","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{})); });
self.addEventListener("activate",e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch",e=>{ const u=e.request.url;
  if(u.includes("firebase")||u.includes("googleapis")||u.includes("gstatic")||u.includes("firebasestorage")) return;
  e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(CACHE).then(cc=>cc.put(e.request,c)); return r; }).catch(()=>caches.match(e.request).then(r=>r||caches.match("./index.html")))); });
