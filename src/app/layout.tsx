import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quba Room Board — Aurion Hotels",
  description: "Front-desk room board, bookings, and occupancy analytics for Aurion Hotels.",
};

export const viewport: Viewport = {
  themeColor: "#1B2A47",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  /**
   * Arabic (RTL) is the default.
   * suppressHydrationWarning is required because AppBootstrap mutates
   * <html lang>, <html dir>, and <html data-theme> on the client after
   * reading localStorage — Next.js would otherwise warn about a
   * server/client mismatch on those attributes.
   */
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts CDN */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/*
          Inter  — UI text
          Cormorant Garamond — brand wordmark feel
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      {/* suppressHydrationWarning on body for theme/lang class mutations */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
