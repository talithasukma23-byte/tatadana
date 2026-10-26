'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronDown,
  ArrowRight,
  Play,
  Zap,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
  Brain,
  Bot,
  CreditCard,
  Send,
  Star,
  Lock,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { formatRupiah } from '@/lib/utils';

export default function LandingPage() {
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'lifetime'>('lifetime');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Interactive Bot Chat Simulator State
  const [simulatedInput, setSimulatedInput] = useState('beli bakso iga 25rb');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    { sender: 'user', text: 'beli bakso iga 25rb' },
    {
      sender: 'bot',
      text: `📅 Sabtu, 10 Oktober 2026 — 12:30 WIB\n💸 Pengeluaran tercatat!\n├ Nominal : Rp25.000\n├ Kategori : 🍜 Makanan & Minuman\n├ Dompet : 👛 Tunai (Cash)\n├ Catatan : Bakso Iga\n└ Saldo : Rp725.000\n\n📊 Budget Makanan bulan ini:\n████████░░ 80% — sisa Rp300.000\n⚠️ Perhatian: Budget kategori ini sudah mencapai 80%. Hemat-hemat ya!`,
    },
  ]);

  const handleSimulateChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedInput.trim()) return;

    const userText = simulatedInput.trim();
    const isIncome = userText.toLowerCase().includes('gajian') || userText.toLowerCase().includes('dapat');

    let botReply = '';
    if (isIncome) {
      botReply = `📅 Sabtu, 10 Oktober 2026 — 12:35 WIB\n💰 Pemasukan tercatat!\n├ Nominal : Rp5.000.000\n├ Kategori : 💼 Pemasukan\n├ Dompet : 👛 Tunai (Cash)\n└ Saldo baru : Rp5.725.000\n\n💪 Semangat terus! Jangan lupa sisihkan untuk tabungan ya.`;
    } else {
      botReply = `📅 Sabtu, 10 Oktober 2026 — 12:35 WIB\n💸 Pengeluaran tercatat!\n├ Nominal : Rp15.000\n├ Kategori : 🍜 Makanan & Minuman\n├ Dompet : 👛 Tunai (Cash)\n├ Catatan : ${userText}\n└ Saldo : Rp710.000\n\n📊 Budget Makanan bulan ini:\n████████░░ 82% — sisa Rp285.000\n👍 Pengeluaran terkendali, pertahankan!`;
    }

    setChatMessages((prev) => [
      ...prev,
      { sender: 'user', text: userText },
      { sender: 'bot', text: botReply },
    ]);
    setSimulatedInput('');
  };

  const faqs = [
    {
      q: 'Bagaimana cara kerja pencatatan via Telegram Bot?',
      a: 'Setelah mendaftar dan menautkan nomor HP, kamu cukup mengirim pesan biasa ke Telegram bot TataDana, misalnya "beli kopi 25rb" atau "gajian 8jt". AI TataDana otomatis mengenali jenis transaksi, nominal, dan kategorinya lalu menyimpannya secara real-time ke akunmu.',
    },
    {
      q: 'Apakah bisa menggunakan fitur foto struk di paket Starter?',
      a: 'Fitur ekstraksi foto struk belanja otomatis menggunakan AI Vision OCR dirancang khusus untuk paket Pro. Di paket Starter, kamu tetap bisa mencatat transaksi teks tanpa batas waktu (maksimal 50 transaksi per bulan).',
    },
    {
      q: 'Bagaimana keamanan data transaksi saya di TataDana?',
      a: 'Data transaksi kamu 100% tersimpan aman di database privat Supabase dengan enkripsi standar industri dan Row Level Security (RLS). Tidak ada pihak ketiga yang memiliki akses ke riwayat keuangan pribadimu.',
    },
    {
      q: 'Apakah saya bisa membuat banyak dompet (Multi-Wallet)?',
      a: 'Ya! Kamu bisa membuat beberapa dompet seperti Uang Tunai, Rekening BCA, Mandiri, GoPay, dan OVO dengan saldo masing-masing, serta menentukan 1 dompet default untuk transaksi Telegram.',
    },
    {
      q: 'Bagaimana AI Financial Advisor membantu saya?',
      a: 'AI Advisor aktif otomatis untuk pengguna Pro dan akan memberi insight actionable saat pengeluaran kategori melonjak >50% dibanding minggu lalu, pengeluaran melampaui 80% pemasukan, atau ada transaksi besar tak terduga.',
    },
    {
      q: 'Metode pembayaran apa saja yang didukung?',
      a: 'Kami mendukung pembayaran otomatis via Midtrans (QRIS, GoPay, ShopeePay, Virtual Account BCA/Mandiri/BRI) serta opsi transfer manual dengan konfirmasi tim admin.',
    },
    {
      q: 'Apakah laporan keuangan bisa diekspor ke format Excel dan PDF?',
      a: 'Ya, di halaman Laporan TataDana, pengguna Pro dapat mengunduh laporan keuangan lengkap beserta ringkasan net cashflow ke format PDF dan Excel (.xlsx) on-demand untuk periode apa saja.',
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#070809] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-500 selection:text-white">
      {/* 1. NAVBAR (Sticky) */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-[#070809]/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white font-black text-lg">
              T
            </div>
            <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">
              Tata<span className="text-emerald-500">Dana</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            <a href="#fitur" className="hover:text-emerald-500 transition-colors">Fitur</a>
            <a href="#demo" className="hover:text-emerald-500 transition-colors">Cara Kerja</a>
            <a href="#harga" className="hover:text-emerald-500 transition-colors">Harga</a>
            <a href="#faq" className="hover:text-emerald-500 transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-emerald-500 px-3 py-2 transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
            >
              Coba Gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <section className="pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        {/* Pre-headline badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>✨ Catat keuangan langsung dari Telegram</span>
        </div>

        {/* Headline (H1) */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 dark:text-white max-w-4xl mx-auto leading-tight">
          Gaji habis sebelum akhir bulan? Sudah saatnya kamu{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
            tahu ke mana uangmu pergi.
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="mt-6 text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          TataDana mencatat setiap pengeluaranmu langsung dari chat Telegram atau foto struk — sisanya kami yang urus.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all hover:scale-105"
          >
            Mulai Gratis Sekarang
          </Link>
          <a
            href="#demo"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold text-sm border border-zinc-200 dark:border-zinc-800 transition-all flex items-center justify-center gap-2"
          >
            Lihat cara kerjanya →
          </a>
        </div>

        {/* Hero Section Video Placeholder (Ditandai jelas di kode) */}
        <div className="mt-14 max-w-4xl mx-auto rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/60 p-2 shadow-2xl relative group">
          {/* TODO: Ganti dengan video asli demo interaktif TataDana */}
          <div className="relative aspect-video rounded-2xl bg-gradient-to-br from-zinc-900 to-black flex flex-col items-center justify-center text-white p-6 overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-emerald-600/90 flex items-center justify-center text-white shadow-lg shadow-emerald-500/40 group-hover:scale-110 transition-transform cursor-pointer">
              <Play className="w-6 h-6 fill-white translate-x-0.5" />
            </div>
            <p className="mt-4 font-bold text-sm text-zinc-200">
              [Placeholder Video: Demo Eksekusi Telegram Bot TataDana]
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              // TODO: Ganti dengan rekaman video demo asli produk
            </p>
          </div>
        </div>
      </section>

      {/* 3. PROBLEM AWARE BULLETS */}
      <section className="py-16 bg-zinc-50 dark:bg-[#0c0d10] border-y border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              Mengapa Catat Keuangan Selalu Gagal?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Bukan kamu yang tidak disiplin, tapi aplikasinya yang terlalu ribet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-3xl block mb-4">😩</span>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white mb-2">
                "Buka aplikasi keuangan? Nanti dulu deh..."
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Harus buka aplikasi terpisah, loading berulang, pilih 5 dropdown hanya untuk mencatat kopi Rp20.000. Akhirnya malas dan terbengkalai.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-3xl block mb-4">💸</span>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white mb-2">
                "Kok uangnya habis ya? Padahal kayak tidak beli apa-apa"
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Pengeluaran kecil harian seperti parkir, jajan sore, dan pesan antar tidak pernah tercatat. Tahu-tahu saldo ludes di tanggal 15.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-3xl block mb-4">📉</span>
              <h3 className="font-bold text-base text-zinc-900 dark:text-white mb-2">
                "Udah niat bikin budget, tapi seminggu lupa"
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Budget yang dibuat di awal bulan tidak pernah dipantau secara real-time. Tanpa ada trigger pengingat, sama saja tidak ada budget.
              </p>
            </div>
          </div>

          {/* Solusi Transition */}
          <div className="mt-14 p-8 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/20 text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
              Bagaimana kalau mencatat keuangan semudah kirim pesan ke teman?
            </p>
            <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
              Introducing <span className="text-emerald-600 dark:text-emerald-400">TataDana</span>
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 mt-2">
              Tinggal buka chat Telegram yang sudah kamu pakai tiap hari. Ketik kalimat biasa atau kirim foto struk belanja, AI kami langsung mencatatnya ke dashboard.
            </p>
          </div>
        </div>
      </section>

      {/* 4. INTERACTIVE DEMO (DUMMY BOT CHAT SIMULATOR) */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Demo Interaktif</span>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Coba Ketik Transaksi Kamu di Bawah
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            Simulasi respon asli bot Telegram TataDana dengan parsing otomatis dan progress bar budget.
          </p>
        </div>

        {/* Telegram Chat Mockup */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-[#0c0d10] text-zinc-100 overflow-hidden shadow-2xl max-w-2xl mx-auto">
          {/* Telegram Header */}
          <div className="px-5 py-4 bg-zinc-900 border-b border-zinc-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center font-bold text-white text-lg">
              T
            </div>
            <div>
              <p className="font-bold text-sm text-white">TataDana Bot 🤖</p>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> online
              </p>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="p-5 space-y-4 max-h-[380px] overflow-y-auto bg-[#0a0b0d]">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-sm'
                      : 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-bl-sm font-mono'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSimulateChat} className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="Coba ketik 'beli bensin 35rb' atau 'gajian 6jt'..."
              value={simulatedInput}
              onChange={(e) => setSimulatedInput(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-white focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shrink-0"
              title="Kirim pesan simulasi"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* 5. FITUR SECTION (3 Alternating Features) */}
      <section id="fitur" className="py-20 bg-zinc-50 dark:bg-[#0c0d10] border-y border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {/* Fitur 1: Catat via Telegram */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Fitur 01</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
                Catat Transaksi Semudah Kirim Pesan Teks & Foto Struk
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
                Cukup ketik bahasa natural seperti "beli soto 18rb" atau kirim voice note singkat. Untuk pengguna Pro, foto struk belanja supermarket langsung diekstraksi rincian barangnya secara otomatis oleh AI Vision.
              </p>
              <ul className="mt-4 space-y-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">✓ Parsing nominal fleksibel (15rb, 500k, 1.5jt)</li>
                <li className="flex items-center gap-2">✓ Ekstraksi multi-item struk belanja otomatis</li>
                <li className="flex items-center gap-2">✓ Transkrip Voice Note audio hingga 60 detik</li>
              </ul>
            </div>
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 shadow-xl">
              <div className="space-y-3 font-mono text-xs text-zinc-300">
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                  <p className="text-teal-400 font-bold mb-1">📸 Foto Struk Dipindai (5 item)</p>
                  <p>• Beras Ramos 5kg : Rp75.000</p>
                  <p>• Minyak Goreng 2L : Rp36.000</p>
                  <p>• Daging Fillet 1kg : Rp68.000</p>
                  <p className="text-emerald-400 font-bold mt-1">Total: Rp285.000 (Tercatat!)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fitur 2: Laporan & Export Otomatis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center md:flex-row-reverse">
            <div className="md:order-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Fitur 02</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
                Laporan & Export Otomatis di Dashboard TataDana
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
                Semua data transaksi tersimpan 100% di database Supabase. Lihat tabel transaksi lengkap dengan filter kategori, multi-wallet, dan rentang tanggal, serta ekspor resmi ke format PDF dan Excel (.xlsx) kapan saja.
              </p>
              <ul className="mt-4 space-y-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">✓ Real-time update tanpa perlu refresh manual</li>
                <li className="flex items-center gap-2">✓ Unduh file resmi PDF dan Excel on-demand</li>
                <li className="flex items-center gap-2">✓ Transaksi multi-item dapat di-expand</li>
              </ul>
            </div>
            <div className="md:order-1 p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 shadow-xl">
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-zinc-900 space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-zinc-900 dark:text-white">
                  <span>Laporan Keuangan Oktober 2026</span>
                  <span className="text-emerald-500">+Rp2.350.000 (Net)</span>
                </div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full w-3/4 rounded-full" />
                </div>
                <div className="flex gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold text-[10px]">PDF Ready</span>
                  <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-500 font-bold text-[10px]">Excel Ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Fitur 3: AI Financial Advisor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Fitur 03</span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
                AI Financial Advisor Pribadi yang Proaktif
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3 leading-relaxed">
                Tidak perlu memanggil perintah khusus. AI Financial Advisor aktif otomatis mendeteksi anomali: kenaikan pengeluaran kategori lebih dari 50%, pengeluaran mendekati 80% pemasukan, atau transaksi mendadak yang membebani dompetmu.
              </p>
              <ul className="mt-4 space-y-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <li className="flex items-center gap-2">✓ Rekomendasi actionable dan personal</li>
                <li className="flex items-center gap-2">✓ Peringatan dini sebelum over-budget</li>
                <li className="flex items-center gap-2">✓ Motivasi finansial rutin lewat chat</li>
              </ul>
            </div>
            <div className="p-6 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 shadow-xl">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-2">
                <p className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Brain className="w-4 h-4" /> AI Financial Advisor Alert:
                </p>
                <p className="text-zinc-700 dark:text-zinc-300">
                  "Pengeluaran kategori <strong>Hiburan & Ngopi</strong> minggu ini melonjak 65% dibanding rata-rata biasanya."
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  💡 Saran: Tahan agenda hangout hingga akhir pekan depan agar budget bulanan tetap surplus.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. TESTIMONIALS (Masonry Placeholder) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Testimoni Pengguna</span>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Cerita Mereka yang Sudah Bebas Boncos
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2">
            // TODO: Ganti dengan testimoni asli dari beta tester setelah rilis
          </p>
        </div>

        {/* Masonry Placeholder Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex text-amber-400 tracking-wider">
              {'★★★★★'}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
              "Dulu tiap tanggal 20 gaji udah sisa 200 ribu dan gatau habis buat apa. Sejak pake TataDana di Telegram, tiap beli bakso langsung catat 2 detik. Akhir bulan bisa nabung 2 juta!"
            </p>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <p className="font-bold text-xs text-zinc-900 dark:text-white">Rian Hidayat</p>
              <p className="text-[10px] text-zinc-400">Software Engineer, Jakarta (26 th)</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex text-amber-400 tracking-wider">
              {'★★★★★'}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
              "Fitur foto struknya juara banget! Belanja bulanan tinggal jepret struk Superindo, itemnya langsung kepisah rapi di laporan. Hemat waktu banget."
            </p>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <p className="font-bold text-xs text-zinc-900 dark:text-white">Nadia Safitri</p>
              <p className="text-[10px] text-zinc-400">Content Creator & Freelancer (28 th)</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-[#111216] border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex text-amber-400 tracking-wider">
              {'★★★★★'}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed italic">
              "Paling suka ada alert otomatis kalau budget makanan udah 80%. Botnya langsung ngingetin di Telegram tanpa harus buka aplikasi. Worth it banget paket Pro!"
            </p>
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <p className="font-bold text-xs text-zinc-900 dark:text-white">Dimas Prasetyo</p>
              <p className="text-[10px] text-zinc-400">Mahasiswa Tingkat Akhir (23 th)</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRICING SECTION (Starter vs Pro) */}
      <section id="harga" className="py-20 bg-zinc-50 dark:bg-[#0c0d10] border-y border-zinc-200 dark:border-zinc-800/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Pilihan Paket</span>
            <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
              Investasi Kecil untuk Keuangan Terkontrol
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2">
              Pilih paket yang paling cocok untuk gaya hidup dan kebutuhan finansialmu.
            </p>

            {/* Toggle Switch */}
            <div className="mt-6 inline-flex p-1 bg-zinc-200 dark:bg-zinc-800 rounded-2xl text-xs font-bold">
              <button
                onClick={() => setPricingCycle('monthly')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  pricingCycle === 'monthly' ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-zinc-500'
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setPricingCycle('lifetime')}
                className={`px-4 py-2 rounded-xl transition-all ${
                  pricingCycle === 'lifetime' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm' : 'text-zinc-500'
                }`}
              >
                Sekali Bayar (Hemat 🔥)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Paket 1: Starter */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#111216] border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">Starter</h3>
                <p className="text-xs text-zinc-400 mt-1">Cocok untuk pencatatan harian sederhana</p>
                <div className="my-6">
                  <span className="text-3xl font-black text-zinc-900 dark:text-white">Rp49.000</span>
                  <span className="text-xs text-zinc-400"> / bulan</span>
                </div>

                <ul className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                  <li className="flex items-center gap-2.5">✓ Catat transaksi via teks Telegram</li>
                  <li className="flex items-center gap-2.5">✓ Dashboard web lengkap</li>
                  <li className="flex items-center gap-2.5">✓ Maksimal 50 transaksi / bulan</li>
                  <li className="flex items-center gap-2.5">✓ Maksimal 3 dompet, 5 kategori budget</li>
                  <li className="flex items-center gap-2.5 text-zinc-400">✕ Tanpa input foto struk AI</li>
                  <li className="flex items-center gap-2.5 text-zinc-400">✕ Tanpa AI Financial Advisor</li>
                  <li className="flex items-center gap-2.5 text-zinc-400">✕ Tanpa export PDF/Excel</li>
                </ul>
              </div>

              <div className="pt-8 mt-8 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href="/register"
                  className="w-full block py-3 rounded-xl text-center text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors"
                >
                  Pilih Starter
                </Link>
              </div>
            </div>

            {/* Paket 2: Pro (Featured) */}
            <div className="p-8 rounded-3xl bg-white dark:bg-[#111216] border-2 border-emerald-500 shadow-2xl shadow-emerald-500/10 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-black uppercase px-4 py-1 rounded-bl-xl tracking-wider">
                Paling Populer
              </div>

              <div>
                <h3 className="font-extrabold text-lg text-zinc-900 dark:text-white">Pro Lifetime</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Akses penuh selamanya tanpa biaya bulanan</p>
                <div className="my-6">
                  <span className="text-4xl font-black text-zinc-900 dark:text-white">Rp99.000</span>
                  <span className="text-xs text-zinc-400"> Sekali Bayar</span>
                </div>

                <ul className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300">
                  <li className="flex items-center gap-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Semua fitur paket Starter
                  </li>
                  <li className="flex items-center gap-2.5">✓ <strong>Unlimited</strong> transaksi, wallet, & kategori</li>
                  <li className="flex items-center gap-2.5">✓ <strong>Input foto struk AI OCR</strong> (multi-item)</li>
                  <li className="flex items-center gap-2.5">✓ <strong>AI Financial Advisor</strong> aktif otomatis</li>
                  <li className="flex items-center gap-2.5">✓ <strong>Laporan lengkap & export unlimited</strong> PDF / Excel</li>
                  <li className="flex items-center gap-2.5">✓ Custom reminder & prioritas support</li>
                </ul>
              </div>

              <div className="pt-8 mt-8 border-t border-zinc-100 dark:border-zinc-800">
                <Link
                  href="/register"
                  className="w-full block py-3.5 rounded-xl text-center text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/25 transition-all hover:scale-105"
                >
                  Beli Pro Sekarang (Rp99k)
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ SECTION (Minimal 7 Pertanyaan) */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Tanya Jawab</span>
          <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mt-1">
            Pertanyaan yang Sering Diajukan
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111216] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between text-sm font-bold text-zinc-900 dark:text-white"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. FINAL CTA (Gradient Emerald/Teal) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-tr from-emerald-700 via-teal-700 to-cyan-800 p-10 sm:p-16 text-center text-white shadow-2xl shadow-teal-500/30">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight max-w-2xl mx-auto leading-tight">
            Mulai kendalikan keuanganmu hari ini.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-emerald-100 max-w-xl mx-auto">
            Hanya butuh 1 menit untuk menghubungkan Telegram dan merasakan betapa mudahnya mencatat setiap rupiah.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="px-8 py-3.5 rounded-2xl bg-white text-emerald-700 hover:bg-emerald-50 font-extrabold text-sm shadow-lg transition-all hover:scale-105"
            >
              Mulai Sekarang Gratis
            </Link>
          </div>
        </div>
      </section>

      {/* 10. FOOTER (4 Kolom) */}
      <footer className="bg-zinc-100 dark:bg-[#0c0d10] border-t border-zinc-200 dark:border-zinc-800/80 py-16 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Kolom 1: Brand & Sosmed */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-black text-base shadow-sm shadow-emerald-500/20">
                T
              </div>
              <span className="font-extrabold text-lg text-zinc-900 dark:text-white">TataDana</span>
            </div>
            <p className="leading-relaxed">
              Catat keuangan semudah chat — langsung dari Telegram kamu.
            </p>
            <p className="mt-4 text-[11px] text-zinc-400">
              © 2026 PT TataDana Teknologi Indonesia. All rights reserved.
            </p>
          </div>

          {/* Kolom 2: Produk */}
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider text-[11px]">Produk</h4>
            <ul className="space-y-2">
              <li><a href="#fitur" className="hover:text-emerald-500 transition-colors">Telegram Bot Parser</a></li>
              <li><a href="#fitur" className="hover:text-emerald-500 transition-colors">AI Vision OCR Struk</a></li>
              <li><a href="#fitur" className="hover:text-emerald-500 transition-colors">Laporan & Export Excel/PDF</a></li>
              <li><a href="#fitur" className="hover:text-emerald-500 transition-colors">AI Financial Advisor</a></li>
            </ul>
          </div>

          {/* Kolom 3: Perusahaan */}
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider text-[11px]">Perusahaan</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="hover:text-emerald-500 transition-colors">Tentang Kami</Link></li>
              <li><Link href="/" className="hover:text-emerald-500 transition-colors">Karir</Link></li>
              <li><Link href="/" className="hover:text-emerald-500 transition-colors">Blog Keuangan</Link></li>
              <li><Link href="/admin" className="hover:text-emerald-500 transition-colors">Portal Admin</Link></li>
            </ul>
          </div>

          {/* Kolom 4: Legal & Kontak */}
          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-wider text-[11px]">Legal & Bantuan</h4>
            <ul className="space-y-2">
              <li><Link href="/" className="hover:text-emerald-500 transition-colors">Kebijakan Privasi</Link></li>
              <li><Link href="/" className="hover:text-emerald-500 transition-colors">Syarat & Ketentuan</Link></li>
              <li><a href="mailto:support@tatadana.app" className="hover:text-emerald-500 transition-colors">Hubungi Kami: support@tatadana.app</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
