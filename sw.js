const VERSION='kizuna-rope-v1';
const CORE=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png'];
self.addEventListener('install', event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event=>event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(name=>name.startsWith('kizuna-rope-')&&name!==VERSION).map(name=>caches.delete(name)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;event.respondWith(fetch(request).then(response=>{if(response.ok){const clone=response.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put(request,clone)));}return response;}).catch(async()=>await caches.match(request)||await caches.match('./index.html')));});
