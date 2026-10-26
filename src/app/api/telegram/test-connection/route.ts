import { NextRequest, NextResponse } from 'next/server';
import { testAndSetupBotToken, cleanTelegramToken, isLocalOrPrivateUrl } from '@/lib/telegram/bot-engine';
import { getActiveTunnelUrl } from '@/lib/tunnel-manager';
import { db } from '@/lib/supabase/mock-db';
import {
  savePersistedBotConfig,
  getPersistedBotConfig,
  clearPersistedBotConfig,
  syncPersistedConfigToDb,
} from '@/lib/telegram/bot-config';

export async function POST(req: NextRequest) {
  try {
    const { token, userId } = await req.json();

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Token bot tidak boleh kosong.' }, { status: 400 });
    }

    const cleanToken = cleanTelegramToken(token);
    const targetUserId = userId || 'admin-owner-talitha';

    // 1. Cek keunikan token (Cegah 1 token riil dipakai lebih dari 1 user, lewati untuk demo token)
    const upperToken = cleanToken.toUpperCase();
    if (!upperToken.startsWith('DEMO_') && !upperToken.startsWith('TEST_')) {
      const existing = db.profiles.find((p) => p.telegram_bot_token === cleanToken && p.id !== targetUserId);
      if (existing) {
        return NextResponse.json({
          success: false,
          error: 'Token bot ini sudah digunakan oleh akun pengguna lain. Harap buat bot baru di @BotFather.',
        }, { status: 400 });
      }
    }

    // 2. Deteksi URL Webhook (Prioritaskan Tunnel Publik HTTPS yang sedang aktif)
    const activeTunnel = getActiveTunnelUrl();
    const origin = req.headers.get('origin') || (req.nextUrl.origin !== 'null' ? req.nextUrl.origin : '');
    const host = req.headers.get('host') || req.nextUrl.host || '';
    const forwardedProto = req.headers.get('x-forwarded-proto');

    let webhookBaseUrl = activeTunnel || process.env.WEBHOOK_BASE_URL?.trim();
    if (!webhookBaseUrl) {
      if (origin && origin !== 'null') {
        webhookBaseUrl = origin;
      } else if (host) {
        const isHostLocal = host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('192.168.') || host.startsWith('10.');
        const proto = forwardedProto || (isHostLocal ? 'http' : 'https');
        webhookBaseUrl = `${proto}://${host}`;
      } else {
        webhookBaseUrl = 'http://localhost:3000';
      }
    }

    const isLocal = isLocalOrPrivateUrl(webhookBaseUrl);

    // 3. Panggil test & setup bot token
    const result = await testAndSetupBotToken(cleanToken, webhookBaseUrl);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Token bot tidak valid atau tidak dapat dihubungi oleh Telegram API.',
      }, { status: 400 });
    }

    // 4. Simpan ke database mock & file disk persisten
    const user = db.getUser(targetUserId);
    if (user) {
      user.telegram_bot_token = cleanToken;
      user.telegram_connected = true;
      user.telegram_connected_at = new Date().toISOString();
      user.telegram_username = result.botName || 'CustomBot';
    }

    // Simpan ke disk agar server restart tidak menghilangkan token
    if (!upperToken.startsWith('DEMO_') && !upperToken.startsWith('TEST_')) {
      savePersistedBotConfig({
        botToken: cleanToken,
        botName: result.botName,
      });
    }

    const effectiveIsLocal = result.isLocalDev ?? isLocal;

    return NextResponse.json({
      success: true,
      botName: result.botName,
      isLocalDev: effectiveIsLocal,
      webhookSet: result.webhookSet ?? !effectiveIsLocal,
      webhookUrl: result.webhookUrl || (activeTunnel ? `${activeTunnel}/api/telegram/webhook` : undefined),
      tunnelUrl: activeTunnel,
      message: result.message || (
        result.webhookSet
          ? `🟢 Terhubung! Bot @${result.botName} berhasil diverifikasi dan webhook aktif di ${result.webhookUrl}.`
          : `🟢 Terhubung! Bot @${result.botName} berhasil diverifikasi via getMe!`
      ),
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET() {
  const activeTunnel = getActiveTunnelUrl();
  syncPersistedConfigToDb(db, 'admin-owner-talitha');
  const user = db.getUser('admin-owner-talitha');
  const persisted = getPersistedBotConfig();

  const persistedToken = (persisted?.botToken && persisted.botToken !== 'mock_token') ? persisted.botToken : null;
  const activeToken = persistedToken || (user?.telegram_bot_token && user.telegram_bot_token !== 'mock_token' ? user.telegram_bot_token : null);

  return NextResponse.json({
    status: 'active',
    endpoint: '/api/telegram/test-connection',
    mode: 'tunnel_supported',
    activeTunnel,
    botConnected: !!user?.telegram_connected,
    botName: user?.telegram_username || persisted?.botName || null,
    botToken: activeToken,
    hasPersistedToken: !!persistedToken,
    updatedAt: persisted?.updatedAt || null,
  });
}

export async function DELETE() {
  try {
    clearPersistedBotConfig();

    const user = db.getUser('admin-owner-talitha');
    if (user) {
      user.telegram_bot_token = undefined;
      user.telegram_connected = false;
      user.telegram_username = undefined;
      user.telegram_connected_at = undefined;
      user.telegram_chat_id = undefined;
    }

    return NextResponse.json({
      success: true,
      message: 'Bot configuration removed',
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Gagal menghapus konfigurasi bot',
    }, { status: 500 });
  }
}

