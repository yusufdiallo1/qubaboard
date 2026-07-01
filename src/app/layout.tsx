import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quba Room Board — Aurion Hotels",
  description: "Front-desk room board, bookings, and occupancy analytics for Aurion Hotels.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Quba",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B2A47",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/*
          Blocking script — runs before first paint.
          1. Theme/lang from localStorage (no flash)
          2. Nuke every service worker + every cache, then hard-reload
             so the browser always fetches fresh JS chunks after a deploy.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              /* 1 ── Theme / lang before paint */
              try{
                var t=localStorage.getItem('quba-theme');
                var l=localStorage.getItem('quba-lang')||'ar';
                var h=document.documentElement;
                if(t==='dark')h.setAttribute('data-theme','dark');
                h.setAttribute('lang',l);
                h.setAttribute('dir',l==='ar'?'rtl':'ltr');
              }catch(e){}

              /* 2 ── Hard-reload helper (deduplicated) */
              var _reloading=false;
              function hardReload(){
                if(_reloading)return;
                _reloading=true;
                var u=window.location.pathname;
                /* cache-busting query param ensures disk cache is bypassed */
                window.location.replace(u+'?_v='+Date.now());
              }

              /* 3 ── Kill every service worker, then kill every cache */
              /*      If anything existed → hard-reload so fresh chunks load */
              try{
                var _swKilled=false;
                var _cacheKilled=false;
                function reloadIfNeeded(){
                  if(_swKilled||_cacheKilled) hardReload();
                }
                if('serviceWorker' in navigator){
                  /* Message from sw.js when it self-destructs */
                  navigator.serviceWorker.addEventListener('message',function(ev){
                    if(ev&&ev.data&&ev.data.type==='SW_SELF_DESTRUCT') hardReload();
                  });
                  navigator.serviceWorker.getRegistrations().then(function(regs){
                    if(!regs.length) return;
                    _swKilled=true;
                    Promise.all(regs.map(function(r){ return r.unregister(); }))
                      .then(reloadIfNeeded);
                  });
                }
                if('caches' in window){
                  caches.keys().then(function(keys){
                    if(!keys.length) return;
                    _cacheKilled=true;
                    Promise.all(keys.map(function(k){ return caches.delete(k); }))
                      .then(reloadIfNeeded);
                  });
                }
              }catch(e){}

              /* 4 ── Catch chunk-load failures → hard-reload */
              window.addEventListener('error',function(e){
                var s=(e.filename||e.message||'');
                if(s.indexOf('/_next/')!==-1||s.indexOf('ChunkLoad')!==-1) hardReload();
              },true);
              window.addEventListener('unhandledrejection',function(e){
                var m=String((e.reason&&e.reason.message)||e.reason||'');
                if(m.indexOf('chunk')!==-1||m.indexOf('Loading chunk')!==-1||m.indexOf('/_next/')!==-1) hardReload();
              });
            })();`,
          }}
        />
        {/* No manifest link — removed to prevent PWA caching */}
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
