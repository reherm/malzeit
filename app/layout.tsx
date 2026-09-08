import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Malzeit – Dein Atelier',
  description:
    'Deine Bilder, Malsitzungen und Fortschritte. Ein persönliches Atelier mit Timer und Offline-Speicherung.',
  manifest: './manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Malzeit',
  },
  icons: { icon: './icon.svg', apple: './apple-touch-icon.png' },
};
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#101214',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body>{children}</body>
    </html>
  );
}
