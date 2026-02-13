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
  themeColor: '#0A0A0A',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
        {children}
      </body>
    </html>
  );
}
