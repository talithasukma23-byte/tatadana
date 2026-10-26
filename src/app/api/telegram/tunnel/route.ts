import { NextRequest, NextResponse } from 'next/server';
import { getActiveTunnelUrl, setActiveTunnelUrl } from '@/lib/tunnel-manager';
import { db } from '@/lib/supabase/mock-db';
import { getActiveBotToken } from '@/lib/telegram/bot-config';
import { getTelegramWebhookInfo } from '@/lib/telegram/bot-engine';

export async function GET() {
  const tunnelUrl = getActiveTunnelUrl();
  const user = db.getUser('admin-owner-talitha');
  const token = getActiveBotToken() || user?.telegram_bot_token;

  let webhookHealth = null;
  let webhookInfo = null;

  try {
    webhookHealth = await getTelegramWebhookInfo(token || undefined);
    webhookInfo = webhookHealth.ok ? webhookHealth.info : null;
  } catch (err: any) {
    webhookHealth = { ok: false, error: err.message };
  }

  return NextResponse.json({
    active: !!tunnelUrl,
    tunnelUrl: tunnelUrl || null,
    webhookUrl: tunnelUrl ? `${tunnelUrl}/api/telegram/webhook` : null,
    botConnected: !!user?.telegram_connected,
    botUsername: user?.telegram_username,
    webhookInfo,
    webhookHealth,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { tunnelUrl, botToken } = await req.json();

    if (tunnelUrl && typeof tunnelUrl === 'string') {
      setActiveTunnelUrl(tunnelUrl);
    }

    const activeTunnel = getActiveTunnelUrl();
    const tokenToUse = botToken || getActiveBotToken() || db.getUser('admin-owner-talitha')?.telegram_bot_token;

    let webhookResult = null;

    if (
      tokenToUse &&
      activeTunnel &&
      !tokenToUse.startsWith('DEMO_') &&
      !tokenToUse.startsWith('TEST_') &&
      tokenToUse !== 'mock_token'
    ) {
      const webhookUrl = `${activeTunnel}/api/telegram/webhook`;
      const setWebhookUrl = new URL(`https://api.telegram.org/bot${tokenToUse}/setWebhook`);
      setWebhookUrl.searchParams.set('url', webhookUrl);

      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (webhookSecret) {
        setWebhookUrl.searchParams.set('secret_token', webhookSecret.trim());
      }

      const res = await fetch(setWebhookUrl.toString(), {
        signal: AbortSignal.timeout(15000),
      });
      webhookResult = await res.json();
    }

    let webhookHealth = null;
    let webhookInfo = null;

    try {
      webhookHealth = await getTelegramWebhookInfo(tokenToUse || undefined);
      webhookInfo = webhookHealth.ok ? webhookHealth.info : null;
    } catch (err: any) {
      webhookHealth = { ok: false, error: err.message };
    }

    return NextResponse.json({
      success: true,
      tunnelUrl: activeTunnel,
      webhookResult,
      webhookInfo,
      webhookHealth,
      message: activeTunnel
        ? `Tunnel aktif di ${activeTunnel}`
        : 'Tunnel belum terdeteksi.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

