/* Public application shell only. Auth endpoints and personal cloud records are never cached. */
const VERSION='health-plan-shell-20261112-pulse2';
const REV='20261112-pulse2';
const SHELL=['./','./index.html','./assets/health-pulse-32.png?v='+REV,'./assets/health-pulse-180.png?v='+REV,'./assets/health-pulse-192.png?v='+REV,'./assets/health-pulse-512.png?v='+REV,'./sports-theme.css?v='+REV,'./medical-theme.css?v='+REV,'./v3-blue.css?v='+REV,'./sports-ui.js?v='+REV,'./weekly-dates.js?v='+REV,'./assets/wellness-hero.png?v='+REV,'./mobile-app.css?v='+REV,'./mobile-app.js?v='+REV,
 './mobile-tabs.js?v='+REV,'./cloud-sync.js?v='+REV,'./sync-core.js?v='+REV,
 './assets/supabase.min.js?v='+REV,'./assets/health-icon.svg','./assets/health-icon-180.png',
 './assets/health-icon-192.png','./assets/health-icon-512.png','./manifest.webmanifest?v='+REV];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(VERSION);await cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('health-plan-shell-')&&key!==VERSION)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),base=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const relative=url.pathname.slice(base.pathname.length);
 const files=new Set(['','index.html','assets/health-pulse-32.png','assets/health-pulse-180.png','assets/health-pulse-192.png','assets/health-pulse-512.png','sports-theme.css','medical-theme.css','v3-blue.css','sports-ui.js','weekly-dates.js','assets/wellness-hero.png','mobile-app.css','mobile-app.js','mobile-tabs.js','cloud-sync.js','sync-core.js',
  'assets/supabase.min.js','assets/health-icon.svg','assets/health-icon-180.png','assets/health-icon-192.png','assets/health-icon-512.png','manifest.webmanifest']);
 if(!files.has(relative))return;
 event.respondWith((async()=>{
   const cache=await caches.open(VERSION);
   try{
     const response=await fetch(event.request,{cache:'no-cache'});
     if(response.ok){
       await cache.put(event.request,response.clone());
       if(event.request.mode==='navigate')await cache.put(new URL('./',base).href,response.clone());
       return response;
     }
     throw Error('Application unavailable');
   }catch(error){
     const cached=await cache.match(event.request,{ignoreSearch:true});
     if(cached)return cached;
     if(event.request.mode==='navigate'){const home=await cache.match(new URL('./',base).href);if(home)return home}
     return Response.error();
   }
 })());
});
