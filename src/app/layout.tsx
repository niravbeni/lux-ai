import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Future Store — Frame Assistant',
  description: 'In-store eyewear discovery assistant powered by AI',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Future Store',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0e0e10',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ background: '#0e0e10' }}>
      <head>
        {/* Explicit theme-color for iOS Safari toolbar + status bar */}
        <meta name="theme-color" content="#0e0e10" />
        {/* iOS Safari fullscreen + status bar */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Prevent phone number detection */}
        <meta name="format-detection" content="telephone=no" />
        {/* Preload 3D models at browser level — starts download before React hydrates */}
        <link rel="preload" href="/models/source/rayban.glb" as="fetch" crossOrigin="anonymous" />
        <link rel="prefetch" href="/models/source/oakley.glb" crossOrigin="anonymous" />
        <link rel="prefetch" href="/models/source/aviator.glb" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        {/* Full-viewport background — extends behind iOS bars regardless of
            overflow:hidden / 100svh constraints on child containers.
            Uses both the CSS variable (for consistency) and hardcoded
            fallback (for before CSS loads). */}
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--background, #0e0e10)',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        />
        {children}
      </body>
    </html>
  );
}
