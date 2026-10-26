import fs from 'fs';
import path from 'path';
import { db } from '@/lib/supabase/mock-db';
import { safeJsonParse } from '@/lib/utils';

export interface BotConfig {
  botToken: string;
  botName?: string;
  updatedAt: string;
}

const CONFIG_FILE = path.join(process.cwd(), '.bot-config.json');

let inMemoryConfig: BotConfig | null = null;

export function getPersistedBotConfig(): BotConfig | null {
  if (inMemoryConfig && inMemoryConfig.botToken) {
    return inMemoryConfig;
  }

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const parsed = safeJsonParse<BotConfig>(data);
      if (parsed && parsed.botToken) {
        inMemoryConfig = parsed;
        return inMemoryConfig;
      }
    }
  } catch (err) {
    // Ignore read errors
  }

  return null;
}

export function savePersistedBotConfig(config: { botToken: string; botName?: string }): void {
  const data: BotConfig = {
    botToken: config.botToken.trim(),
    botName: config.botName?.trim(),
    updatedAt: new Date().toISOString(),
  };

  inMemoryConfig = data;

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save .bot-config.json:', err);
  }
}

/**
 * Menghapus file .bot-config.json dan membersihkan cache in-memory.
 */
export function clearPersistedBotConfig(): void {
  inMemoryConfig = null;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
    }
  } catch (err) {
    console.error('Failed to clear .bot-config.json:', err);
  }
}

/**
 * Mengambil bot token yang tersimpan di .bot-config.json secara persisten.
 * Prioritas utama: file persisten .bot-config.json.
 * Fallback: process.env.TELEGRAM_BOT_TOKEN (jika valid dan bukan mock/demo).
 */
export function getPersistedBotToken(): string | null {
  const persisted = getPersistedBotConfig();
  if (
    persisted?.botToken &&
    persisted.botToken !== 'mock_token' &&
    !persisted.botToken.toUpperCase().startsWith('DEMO_') &&
    !persisted.botToken.toUpperCase().startsWith('TEST_')
  ) {
    return persisted.botToken.trim();
  }

  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (
    envToken &&
    envToken !== 'mock_token' &&
    !envToken.toUpperCase().startsWith('DEMO_') &&
    !envToken.toUpperCase().startsWith('TEST_')
  ) {
    return envToken;
  }

  return null;
}

/**
 * Mengambil bot token aktif untuk komunikasi dengan Telegram API.
 */
export function getActiveBotToken(): string | null {
  return getPersistedBotToken();
}

/**
 * Sinkronisasi konfigurasi bot persisten ke profil database pengguna di mock-db.
 */
export function syncPersistedConfigToDb(store: any = db, userId: string = 'admin-owner-talitha'): void {
  const persisted = getPersistedBotConfig();
  const targetStore = store || db;
  if (!targetStore) return;

  const user = targetStore.getUser ? targetStore.getUser(userId) : targetStore.profiles?.find((p: any) => p.id === userId);
  if (user) {
    if (
      persisted?.botToken &&
      persisted.botToken !== 'mock_token' &&
      !persisted.botToken.toUpperCase().startsWith('DEMO_') &&
      !persisted.botToken.toUpperCase().startsWith('TEST_')
    ) {
      user.telegram_bot_token = persisted.botToken;
      user.telegram_connected = true;
      if (persisted.botName) user.telegram_username = persisted.botName;
      if (persisted.updatedAt) user.telegram_connected_at = persisted.updatedAt;
    }
  }
}

