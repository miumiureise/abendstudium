const CACHE='abendstudium-shell-v2';
const FILES=['./','./index.html','./style.css','./app.js','./core.js','./seeds.js','./character.js','./config.js','./manifest.webmanifest','./assets/professor-neutral.png','./assets/professor-book.png','./assets/professor-smile.png','./assets/professor-tea.png','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('abendstudium-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||!FILES.some(f=>new URL(f,self.registration.scope).href===url.href))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));});
// Supabase認証・個人データ・外部音声はキャッシュしません。
