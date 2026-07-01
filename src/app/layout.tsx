import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quba Room Board — Aurion Hotels",
  description: "Front-desk room board, bookings, and occupancy analytics for Aurion Hotels.",
  manifest: "/manifest.json",
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
          Blocking theme/lang script — runs before first paint so there is
          NO flash of wrong theme or language on refresh.
          Must be dangerouslySetInnerHTML (raw <script>) to block rendering.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              var t=localStorage.getItem('quba-theme');
              var l=localStorage.getItem('quba-lang')||'ar';
              var r=document.documentElement;
              if(t==='dark')r.setAttribute('data-theme','dark');
              r.setAttribute('lang',l);
              r.setAttribute('dir',l==='ar'?'rtl':'ltr');
            }catch(e){}})();
            /* Nuke all service workers — they cause stale chunk issues */
            if('serviceWorker' in navigator){
              navigator.serviceWorker.getRegistrations().then(function(regs){
                regs.forEach(function(r){ r.unregister(); });
              });
              caches.keys().then(function(keys){
                keys.forEach(function(k){ caches.delete(k); });
              });
            }
            /* Auto-reload on chunk 404 */
            window.addEventListener('error',function(e){
              var src=e.filename||'';
              if(src.indexOf('/_next/')!==-1&&!sessionStorage.getItem('quba-chunk-reload')){
                sessionStorage.setItem('quba-chunk-reload','1');
                location.reload(true);
              }
            },true);`,
          }}
        />
        <link rel="manifest" href="/manifest.json" />
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
