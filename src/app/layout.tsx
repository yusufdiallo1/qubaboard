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
          2. On first load: nuke any SW + caches left by old deploys, reload once
          3. On chunk errors: reload once with cache-busted URL
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

              /* 2 ── One-time SW + cache nuke */
              /* Guard via sessionStorage so redirects can't reset the flag */
              /* (prevents infinite loop even when auth redirects strip ?_v= param) */
              var _nuked=false;
              try{ _nuked=!!sessionStorage.getItem('quba-nuked'); }catch(e){}
              var _reloading=false;
              function hardReload(){
                if(_reloading)return;
                _reloading=true;
                try{ sessionStorage.setItem('quba-nuked','1'); }catch(e){}
                window.location.replace(window.location.pathname+'?_v='+Date.now());
              }

              if(!_nuked){
                try{
                  /* Kill any leftover SW from old deploys */
                  if('serviceWorker' in navigator){
                    navigator.serviceWorker.addEventListener('message',function(ev){
                      if(ev&&ev.data&&ev.data.type==='SW_SELF_DESTRUCT') hardReload();
                    });
                    navigator.serviceWorker.getRegistrations().then(function(regs){
                      if(!regs.length) return;
                      Promise.all(regs.map(function(r){ return r.unregister(); }))
                        .then(function(){
                          if('caches' in window){
                            caches.keys().then(function(keys){
                              Promise.all(keys.map(function(k){ return caches.delete(k); }))
                                .then(hardReload);
                            });
                          } else { hardReload(); }
                        });
                    });
                  }
                  /* Kill any leftover caches (even without a SW) */
                  if('caches' in window){
                    caches.keys().then(function(keys){
                      if(!keys.length) return;
                      Promise.all(keys.map(function(k){ return caches.delete(k); }))
                        .then(hardReload);
                    });
                  }
                }catch(e){}
              }

              /* 3 ── Chunk-load failure → reload once */
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
