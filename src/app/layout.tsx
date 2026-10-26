import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TataDana — Catat Keuangan Semudah Chat Langsung dari Telegram',
  description: 'TataDana adalah aplikasi manajemen keuangan pribadi yang terintegrasi dengan Telegram Bot. Catat pemasukan dan pengeluaran semudah kirim chat!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-white dark:bg-[#08090a] text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
