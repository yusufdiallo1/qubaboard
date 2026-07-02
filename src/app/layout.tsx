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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){
              /* ── 1. Theme / lang before paint ── */
              try{
                var t=localStorage.getItem('quba-theme');
                var l=localStorage.getItem('quba-lang')||'ar';
                var h=document.documentElement;
                if(t==='dark')h.setAttribute('data-theme','dark');
                h.setAttribute('lang',l);
                h.setAttribute('dir',l==='ar'?'rtl':'ltr');
              }catch(e){}

              /* ── 2. SW + cache nuke (runs once per browser tab lifetime) ── */
              /* Uses a timestamp so it re-runs after 5 min (catches new deploys)  */
              /* and resets on new tabs so stale state never persists long-term.   */
              var _reloading=false;
              function hardReload(){
                if(_reloading)return;
                _reloading=true;
                try{ sessionStorage.setItem('quba-nuked',String(Date.now())); }catch(e){}
                /* Replace URL — strips stale ?_v= if present, adds fresh one */
                window.location.replace(window.location.pathname+'?_bust='+Date.now());
              }

              /* Only nuke once per 5-minute window to prevent loops */
              var _lastNuke=0;
              try{ _lastNuke=parseInt(sessionStorage.getItem('quba-nuked')||'0',10)||0; }catch(e){}
              var _elapsed=Date.now()-_lastNuke;
              var _alreadyNuked=(_elapsed>0 && _elapsed<300000); /* 5 min */

              /* Also skip if this is already a ?_bust= reload (strips after redirect) */
              /* sessionStorage covers us across redirects, this just double-guards */

              if(!_alreadyNuked){
                try{
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
                              if(!keys.length) return;
                              Promise.all(keys.map(function(k){ return caches.delete(k); }))
                                .then(hardReload);
                            });
                          } else { hardReload(); }
                        });
                    });
                  }
                  if('caches' in window){
                    caches.keys().then(function(keys){
                      if(!keys.length) return;
                      Promise.all(keys.map(function(k){ return caches.delete(k); }))
                        .then(hardReload);
                    });
                  }
                }catch(e){}
              }

              /* ── 3. Chunk-load failure → one reload ── */
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
