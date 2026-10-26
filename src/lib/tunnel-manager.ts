import fs from 'fs';
import path from 'path';
import { safeJsonParse } from '@/lib/utils';

export interface TunnelInfo {
  tunnelUrl: string;
  updatedAt: string;
  port: number;
}

let cachedTunnelUrl: string | null = null;

function getTunnelFilePath(): string {
  return path.join(process.cwd(), '.tunnel-url.json');
}

/**
 * Membaca URL tunnel publik yang sedang aktif (misalnya dari localtunnel / ngrok)
 */
export function getActiveTunnelUrl(): string | null {
  // 1. Cek environment variable WEBHOOK_BASE_URL jika bukan localhost
  const envUrl = process.env.WEBHOOK_BASE_URL?.trim();
  if (envUrl && envUrl.startsWith('https://') && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. Cek in-memory cache
  if (cachedTunnelUrl) {
    return cachedTunnelUrl;
  }

  // 3. Baca dari file .tunnel-url.json
  try {
    const filePath = getTunnelFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = safeJsonParse<TunnelInfo>(content);
      if (data && data.tunnelUrl && data.tunnelUrl.startsWith('https://')) {
        cachedTunnelUrl = data.tunnelUrl.replace(/\/+$/, '');
        return cachedTunnelUrl;
      }
    }
  } catch (err) {
    // Ignore read errors
  }

  return null;
}

/**
 * Menyimpan URL tunnel publik aktif
 */
export function setActiveTunnelUrl(url: string, port: number = 3000): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  cachedTunnelUrl = cleanUrl;

  try {
    const filePath = getTunnelFilePath();
    const data: TunnelInfo = {
      tunnelUrl: cleanUrl,
      updatedAt: new Date().toISOString(),
      port,
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[TunnelManager] Failed to write .tunnel-url.json:', err);
  }
}

/**
 * Mendapatkan basis URL webhook yang paling efektif untuk pendaftaran setWebhook
 */
export function getEffectiveWebhookBaseUrl(): string {
  const tunnelUrl = getActiveTunnelUrl();
  if (tunnelUrl) {
    return tunnelUrl;
  }

  const envUrl = process.env.WEBHOOK_BASE_URL?.trim();
  if (envUrl && envUrl.startsWith('https://')) {
    return envUrl.replace(/\/+$/, '');
  }

  return 'http://localhost:3000';
}
