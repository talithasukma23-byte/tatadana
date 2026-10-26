import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramWebhook, TelegramUpdate } from '@/lib/telegram/bot-engine';
import { db } from '@/lib/supabase/mock-db';
import { getActiveBotToken, getPersistedBotConfig } from '@/lib/telegram/bot-config';

export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString();

  // 1. Validasi Secret Token Telegram jika TELEGRAM_WEBHOOK_SECRET dikonfigurasi
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (expectedSecret) {
    const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token');
    if (!receivedSecret || receivedSecret !== expectedSecret) {
      console.warn(`[Telegram Webhook] ⛔ Unauthorized request: invalid or missing secret token.`);
      return NextResponse.json({ ok: false, error: 'Unauthorized secret token' }, { status: 401 });
    }
  }

  try {
    // 2. Parsing body payload secara aman
    let body: TelegramUpdate | null = null;
    try {
      body = await req.json();
    } catch {
      // Body kosong atau format non-JSON (misal health check / ping)
      return NextResponse.json(
        { ok: true, message: 'Ping or empty payload received' },
        { status: 200 }
      );
    }

    // Jika payload kosong atau tidak memiliki update_id
    if (!body || typeof body.update_id !== 'number') {
      return NextResponse.json(
        { ok: true, ignored: true, message: 'Acknowledged: missing update_id' },
        { status: 200 }
      );
    }

    const message = body.message;
    const chatId = message?.chat?.id;
    const sender = message?.from?.username
      ? `@${message.from.username}`
      : (message?.from?.first_name || 'unknown');
    const msgSnippet = message?.text
      ? `"${message.text.slice(0, 50)}"`
      : (message?.caption
        ? `[Caption: "${message.caption.slice(0, 50)}"]`
        : (message?.photo
          ? '[Photo]'
          : (message?.voice
            ? '[Voice]'
            : (message?.audio
              ? '[Audio]'
              : '[Media/Other]'))));

    // 3. Instant Idempotency Check (Cegah transaksi dobel pada webhook retry)
    if (db.isTelegramUpdateProcessed(body.update_id)) {
      console.log(`[Telegram Webhook] 🔁 Duplicate update detected: update_id ${body.update_id} has already been processed. Skipping duplicate.`);
      return NextResponse.json(
        { ok: true, duplicate: true, update_id: body.update_id, status: 'already_processed' },
        { status: 200 }
      );
    }

    // Tandai processed langsung untuk mencegah race condition
    db.markTelegramUpdateProcessed(body.update_id);

    console.log(`[Telegram Webhook] 📥 Received update #${body.update_id} from ${sender} (chat_id: ${chatId ?? 'N/A'}): ${msgSnippet}`);

    const user = chatId
      ? (db.getUserByTelegramId(chatId) || (message?.from?.username ? db.getUserByEmailOrUsername(message.from.username) : undefined) || db.getUser('admin-owner-talitha'))
      : undefined;
    if (user && chatId && user.telegram_chat_id !== chatId) {
      user.telegram_chat_id = chatId;
      user.telegram_connected = true;
      user.telegram_connected_at = user.telegram_connected_at || new Date().toISOString();
      if (message?.from?.username) {
        user.telegram_username = message.from.username;
      }
    }

    // Catat log webhook di database
    db.logTelegramWebhook({
      id: `wh-${Date.now()}`,
      update_id: body.update_id,
      user_id: user?.id,
      payload: body,
      processed_at: timestamp,
    });

    // Synchronous execution for test suite if header present
    const isTestSync = req.headers.get('x-test-sync') === 'true';
    if (isTestSync) {
      const reply = await handleTelegramWebhook(body, true);
      return NextResponse.json(
        {
          ok: true,
          update_id: body.update_id,
          status: 'processed_sync',
          reply,
        },
        { status: 200 }
      );
    }

    // 4. Asynchronous Background Execution (Non-blocking response)
    // Run LLM parsing, database mutation, dan Telegram sendMessage di background
    (async () => {
      try {
        console.log(`[Telegram Webhook] ⚙️ Dispatched async worker for update #${body.update_id}`);
        const reply = await handleTelegramWebhook(body, true);
        if (reply) {
          const persisted = getPersistedBotConfig();
          const botToken = getActiveBotToken() || persisted?.botToken || user?.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;

          if (
            botToken &&
            !botToken.toUpperCase().startsWith('DEMO_') &&
            !botToken.toUpperCase().startsWith('TEST_') &&
            botToken !== 'mock_token'
          ) {
            console.log(`[Telegram Webhook] 📤 Sending reply to chat_id: ${reply.chat_id} (parse_mode: ${reply.parse_mode || 'none'}, length: ${reply.text.length})...`);
            const sendRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: reply.chat_id,
                text: reply.text,
                parse_mode: reply.parse_mode,
              }),
            });

            const sendData = await sendRes.json();
            if (!sendData.ok) {
              const desc = (sendData.description || '').toLowerCase();
              const isEntityError =
                sendData.error_code === 400 &&
                (desc.includes('entity') || desc.includes("can't parse") || desc.includes('entities'));

              console.warn(
                `[Telegram Webhook] ⚠️ sendMessage error for chat_id ${reply.chat_id} (${sendData.error_code}: ${sendData.description}). ${
                  isEntityError ? 'Attempting plain text fallback retry...' : 'No retry attempted.'
                }`
              );

              // Resilient Markdown Fallback jika Telegram menolak Markdown formatting
              if (isEntityError) {
                // Plain text fallback tanpa parse_mode (strip `*`, `_`, ``` ` ```, jangan strip tanda kurung `()` agar nominal (Rp25.000) tidak rusak)
                const plainText = reply.text.replace(/[*_`]/g, '');
                const retryRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: reply.chat_id,
                    text: plainText,
                  }),
                });
                const retryData = await retryRes.json();
                if (retryData.ok) {
                  console.log(`[Telegram Webhook] ✅ Fallback plain text succeeded for chat_id: ${reply.chat_id} (message_id: ${retryData.result?.message_id})`);
                } else {
                  console.error(`[Telegram Webhook] ❌ Fallback plain text failed for chat_id ${reply.chat_id} (${retryData.error_code}: ${retryData.description})`);
                }
              }
            } else {
              console.log(`[Telegram Webhook] ✅ Outgoing sendMessage succeeded for chat_id: ${reply.chat_id} (message_id: ${sendData.result?.message_id})`);
            }
          } else {
            console.warn(`[Telegram Webhook] ⚠️ Bot token not configured or in mock/demo mode. Outgoing Telegram reply skipped.`);
          }
        }
      } catch (asyncErr: any) {
        console.error(`[Telegram Webhook Worker Error] update_id ${body.update_id}:`, asyncErr?.message || asyncErr);
      }
    })();

    // 5. Respond HTTP 200 OK instantly ke Telegram API
    return NextResponse.json(
      {
        ok: true,
        update_id: body.update_id,
        status: 'queued_async',
        received_at: timestamp,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Telegram Webhook Error]:', error);
    // Telegram membutuhkan HTTP 200 OK untuk menghentikan retry storm
    return NextResponse.json({ ok: true, error: error?.message || 'Internal server error' }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service: 'TataDana Telegram Webhook Engine',
    timezone: 'Asia/Jakarta (WIB)',
    idempotency_enabled: true,
    healthy: true,
  }, { status: 200 });
}
