// ====================================================================
// TataDana Smart In-Memory / Local Storage Database Layer
// Berfungsi penuh untuk dev lokal tanpa blocking kredensial Supabase
// ====================================================================

import {
  UserProfile,
  Wallet,
  Category,
  Transaction,
  TransactionItem,
  AIProviderConfig,
  AILog,
  SubscriptionPayment,
  ExportHistory,
  AuditLog,
  Budget,
  BudgetPeriodType,
  AIChatHistory,
  TelegramWebhookLog,
  PaymentApproval,
  AdminAuditLog,
} from '@/types/database';
import { safeJsonParse } from '@/lib/utils';

// 1. Initial State Data
const DEFAULT_USER_ID = 'admin-owner-talitha';
const DEMO_USER_ID = 'user-pro-001';
const STARTER_USER_ID = 'user-starter-002';
const ADMIN_USER_ID = 'admin-super-999';

export { DEFAULT_USER_ID, DEMO_USER_ID, STARTER_USER_ID, ADMIN_USER_ID };

// Hydrate disk persistence if running on server without bundling fs for client
function getInitialPersistedBotConfig(): { botToken?: string; botName?: string; connected: boolean } {
  if (typeof window === 'undefined') {
    try {
      const nodeRequire = eval('require');
      const fs = nodeRequire('fs');
      const path = nodeRequire('path');
      const configPath = path.join(process.cwd(), '.bot-config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const data = safeJsonParse<{ botToken?: string; botName?: string }>(raw);
        if (
          data &&
          typeof data.botToken === 'string' &&
          data.botToken !== 'mock_token' &&
          !data.botToken.toUpperCase().startsWith('DEMO_') &&
          !data.botToken.toUpperCase().startsWith('TEST_')
        ) {
          return {
            botToken: data.botToken.trim(),
            botName: data.botName?.trim(),
            connected: true,
          };
        }
      }
    } catch {
      // Ignore if not in Node or file not accessible
    }
  }
  return { connected: false };
}

function getInitialPersistedAdmin(): UserProfile | null {
  if (typeof window === 'undefined') {
    try {
      const nodeRequire = eval('require');
      const fs = nodeRequire('fs');
      const path = nodeRequire('path');
      const adminPath = path.join(process.cwd(), '.admin-account.json');
      if (fs.existsSync(adminPath)) {
        const raw = fs.readFileSync(adminPath, 'utf-8');
        const data = safeJsonParse<UserProfile>(raw);
        if (data && (data.email || data.id)) {
          return data;
        }
      }
    } catch {
      // Ignore if not in Node or file not accessible
    }
  }
  return null;
}

function checkBootstrapLock(): boolean {
  if (typeof window === 'undefined') {
    try {
      const nodeRequire = eval('require');
      const fs = nodeRequire('fs');
      const path = nodeRequire('path');
      const lockPath = path.join(process.cwd(), '.admin-bootstrap.lock');
      return fs.existsSync(lockPath);
    } catch {
      // Ignore
    }
  }
  return false;
}

function hashPassword(password: string, salt: string): string {
  try {
    const nodeRequire = eval('require');
    const crypto = nodeRequire('crypto');
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  } catch {
    return password;
  }
}

function generateSalt(): string {
  try {
    const nodeRequire = eval('require');
    const crypto = nodeRequire('crypto');
    return crypto.randomBytes(16).toString('hex');
  } catch {
    return 'salt-' + Date.now();
  }
}

const initialBotConfig = getInitialPersistedBotConfig();
const initialPersistedAdmin = getInitialPersistedAdmin();

class TataDanaStore {
  public profiles: UserProfile[] = [
    {
      id: DEFAULT_USER_ID,
      email: 'talithasukma23@gmail.com',
      full_name: 'Talitha Ayu Sukma (Owner & Superadmin)',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      phone_number: '088222003880',
      phone_verified: true,
      email_verified: true,
      plan: 'pro',
      role: 'superadmin',
      account_status: 'approved',
      password_hash: '974c21ce310284844b6fc76795d475cdafe2ba657ba16b6fcfb1797fceb0880a2ce44255e596edc58b90aab94b157eee2cc47e93bfec0e6dea4f3a953dd75ca7',
      password_salt: '87efad03b60c190a06088734d0b236c3',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      telegram_chat_id: 8806951051,
      telegram_username: 'talithaayusukm',
      telegram_bot_token: initialBotConfig.botToken,
      telegram_connected: initialBotConfig.connected,
      telegram_connected_at: initialBotConfig.connected ? new Date().toISOString() : undefined,
      daily_reminder_enabled: true,
      reminder_frequency: 1,
      reminder_time_1: '20:00:00',
      reminder_time_2: '12:00:00',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public wallets: Wallet[] = [
    {
      id: 'wallet-001',
      user_id: DEFAULT_USER_ID,
      name: '💵 Tunai (Cash)',
      type: 'Cash',
      balance: 750000,
      color: '#10B981',
      icon: '💵',
      is_default: true,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'wallet-002',
      user_id: DEFAULT_USER_ID,
      name: '🏦 Rekening BCA',
      type: 'Bank',
      balance: 4250000,
      color: '#3B82F6',
      icon: '🏦',
      is_default: false,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'wallet-003',
      user_id: DEFAULT_USER_ID,
      name: '📱 GoPay / OVO',
      type: 'E-Wallet',
      balance: 380000,
      color: '#06B6D4',
      icon: '📱',
      is_default: false,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'wallet-admin-talitha',
      user_id: DEFAULT_USER_ID,
      name: '💵 Kas Operasional Admin',
      type: 'Cash',
      balance: 10000000,
      color: '#8B5CF6',
      icon: '💵',
      is_default: false,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public categories: Category[] = [
    {
      id: 'cat-001',
      user_id: DEFAULT_USER_ID,
      name: 'Makanan & Minuman',
      type: 'expense',
      emoji: '🍜',
      color: '#059669',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-002',
      user_id: DEFAULT_USER_ID,
      name: 'Transportasi',
      type: 'expense',
      emoji: '🚗',
      color: '#FB923C',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-003',
      user_id: DEFAULT_USER_ID,
      name: 'Tagihan & Utilitas',
      type: 'expense',
      emoji: '🏠',
      color: '#EA580C',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-004',
      user_id: DEFAULT_USER_ID,
      name: 'Belanja & Supermarket',
      type: 'expense',
      emoji: '🛒',
      color: '#FDBA74',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-005',
      user_id: DEFAULT_USER_ID,
      name: 'Hiburan & Ngopi',
      type: 'expense',
      emoji: '☕',
      color: '#C2410C',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-006',
      user_id: DEFAULT_USER_ID,
      name: 'Kesehatan',
      type: 'expense',
      emoji: '💊',
      color: '#0D9488',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-007',
      user_id: DEFAULT_USER_ID,
      name: 'Gaji Bulanan',
      type: 'income',
      emoji: '💰',
      color: '#10B981',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'cat-008',
      user_id: DEFAULT_USER_ID,
      name: 'Freelance & Bonus',
      type: 'income',
      emoji: '💼',
      color: '#34D399',
      is_custom: false,
      monthly_budget: 0,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public budgets: Budget[] = [
    {
      id: 'bdg-001',
      user_id: DEFAULT_USER_ID,
      category_id: 'cat-001',
      period_type: 'monthly',
      amount: 1500000,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'bdg-002',
      user_id: DEFAULT_USER_ID,
      category_id: 'cat-002',
      period_type: 'monthly',
      amount: 600000,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'bdg-003',
      user_id: DEFAULT_USER_ID,
      category_id: 'cat-003',
      period_type: 'monthly',
      amount: 900000,
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public aiChatHistory: AIChatHistory[] = [
    {
      id: 'chat-001',
      user_id: DEFAULT_USER_ID,
      role: 'user',
      message: 'Berapa total pengeluaran saya minggu ini?',
      created_at: '2026-10-09T10:00:00+07:00',
    },
    {
      id: 'chat-002',
      user_id: DEFAULT_USER_ID,
      role: 'assistant',
      message: 'Total pengeluaranmu minggu ini adalah Rp750.000, sebagian besar untuk Belanja & Supermarket.',
      created_at: '2026-10-09T10:00:02+07:00',
    },
  ];

  public telegramWebhookLogs: TelegramWebhookLog[] = [];

  public transactions: Transaction[] = [
    {
      id: 'tx-001',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-002',
      category_id: 'cat-007',
      type: 'income',
      amount: 8500000,
      description: 'Gaji Bulan Ini PT Teknologi Nusantara',
      notes: 'Gaji Bulan Ini PT Teknologi Nusantara',
      transaction_date: '2026-10-01T09:00:00+07:00',
      source: 'web_manual',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-01T09:00:00+07:00',
    },
    {
      id: 'tx-002',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-001',
      category_id: 'cat-001',
      type: 'expense',
      amount: 45000,
      description: 'Makan siang Nasi Padang + Es Teh',
      notes: 'Makan siang Nasi Padang + Es Teh',
      transaction_date: '2026-10-02T12:30:00+07:00',
      source: 'telegram_text',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-02T12:30:00+07:00',
    },
    {
      id: 'tx-003',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-003',
      category_id: 'cat-002',
      type: 'expense',
      amount: 32000,
      description: 'GrabBike ke kantor',
      notes: 'GrabBike ke kantor',
      transaction_date: '2026-10-03T08:15:00+07:00',
      source: 'telegram_text',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-03T08:15:00+07:00',
    },
    {
      id: 'tx-004',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-002',
      category_id: 'cat-003',
      type: 'expense',
      amount: 350000,
      description: 'Token Listrik PLN & Tagihan Internet',
      notes: 'Token Listrik PLN & Tagihan Internet',
      transaction_date: '2026-10-05T14:00:00+07:00',
      source: 'web_manual',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-05T14:00:00+07:00',
    },
    {
      id: 'tx-005',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-002',
      category_id: 'cat-004',
      type: 'expense',
      amount: 285000,
      description: 'Struk Belanja Bulanan Superindo',
      notes: 'Struk Belanja Bulanan Superindo',
      transaction_date: '2026-10-07T19:20:00+07:00',
      source: 'telegram_photo',
      is_receipt: true,
      receipt_items: [
        { item_name: 'Beras Ramos 5kg', price: 75000, quantity: 1, category_name: 'Makanan' },
        { item_name: 'Minyak Goreng 2L', price: 36000, quantity: 1, category_name: 'Makanan' },
        { item_name: 'Deterjen Rinso 1.8kg', price: 42000, quantity: 1, category_name: 'Belanja' },
        { item_name: 'Daging Ayam Fillet 1kg', price: 68000, quantity: 1, category_name: 'Makanan' },
        { item_name: 'Buah Apel Fuji 1kg', price: 64000, quantity: 1, category_name: 'Makanan' },
      ],
      raw_receipt_url: 'https://images.unsplash.com/photo-1554415707-9e49fa74a9e2?w=600',
      created_at: '2026-10-07T19:20:00+07:00',
    },
    {
      id: 'tx-006',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-001',
      category_id: 'cat-005',
      type: 'expense',
      amount: 38000,
      notes: 'Kopi Susu Gula Aren Kenangan',
      transaction_date: '2026-10-08T16:45:00+07:00',
      source: 'telegram_voice',
      created_at: '2026-10-08T16:45:00+07:00',
    },
    {
      id: 'tx-007',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-002',
      category_id: 'cat-008',
      type: 'income',
      amount: 1500000,
      notes: 'Project Freelance Desain Landing Page',
      transaction_date: '2026-10-09T10:00:00+07:00',
      source: 'telegram_text',
      created_at: '2026-10-09T10:00:00+07:00',
    },
    {
      id: 'tx-008',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-001',
      category_id: 'cat-001',
      type: 'expense',
      amount: 25000,
      description: 'Nasi Goreng Spesial',
      notes: 'Nasi Goreng Spesial',
      transaction_date: '2026-10-10T20:15:00+07:00',
      source: 'telegram_text',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-10T20:15:00+07:00',
    },
    {
      id: 'tx-009',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-003',
      category_id: 'cat-002',
      type: 'expense',
      amount: 42000,
      description: 'Bensin Shell V-Power',
      notes: 'Bensin Shell V-Power',
      transaction_date: '2026-10-11T14:30:00+07:00',
      source: 'telegram_text',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-11T14:30:00+07:00',
    },
    {
      id: 'tx-010',
      user_id: DEFAULT_USER_ID,
      wallet_id: 'wallet-001',
      category_id: 'cat-005',
      type: 'expense',
      amount: 28000,
      description: 'Kopi Kenangan Mantan',
      notes: 'Kopi Kenangan Mantan',
      transaction_date: '2026-10-12T10:00:00+07:00',
      source: 'telegram_text',
      is_receipt: false,
      receipt_items: [],
      created_at: '2026-10-12T10:00:00+07:00',
    },
  ];

  public transactionItems: TransactionItem[] = [
    {
      id: 'item-001',
      transaction_id: 'tx-005',
      item_name: 'Beras Ramos 5kg',
      price: 75000,
      quantity: 1,
      category_name: 'Makanan',
      created_at: '2026-10-07T19:20:00+07:00',
    },
    {
      id: 'item-002',
      transaction_id: 'tx-005',
      item_name: 'Minyak Goreng 2L',
      price: 36000,
      quantity: 1,
      category_name: 'Makanan',
      created_at: '2026-10-07T19:20:00+07:00',
    },
    {
      id: 'item-003',
      transaction_id: 'tx-005',
      item_name: 'Deterjen Rinso 1.8kg',
      price: 42000,
      quantity: 1,
      category_name: 'Belanja',
      created_at: '2026-10-07T19:20:00+07:00',
    },
    {
      id: 'item-004',
      transaction_id: 'tx-005',
      item_name: 'Daging Ayam Fillet 1kg',
      price: 68000,
      quantity: 1,
      category_name: 'Makanan',
      created_at: '2026-10-07T19:20:00+07:00',
    },
    {
      id: 'item-005',
      transaction_id: 'tx-005',
      item_name: 'Buah Apel Fuji 1kg',
      price: 64000,
      quantity: 1,
      category_name: 'Makanan',
      created_at: '2026-10-07T19:20:00+07:00',
    },
  ];

  public aiProviders: AIProviderConfig[] = [
    {
      id: 'provider-001',
      name: 'gemini',
      display_name: 'Google Gemini 1.5 Flash',
      api_key: 'AIzaSyDemoTataDanaKeyGeminiLive2026',
      is_active: true,
      priority: 1,
      model_name: 'gemini-1.5-flash',
      mode: 'parallel_failover',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'provider-002',
      name: 'openai',
      display_name: 'OpenAI GPT-4o mini',
      api_key: 'sk-proj-demoTataDanaKeyOpenAILive2026',
      is_active: true,
      priority: 2,
      model_name: 'gpt-4o-mini',
      mode: 'parallel_failover',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'provider-003',
      name: 'deepseek',
      display_name: 'DeepSeek Chat V3',
      api_key: 'sk-deepseek-demoTataDanaKeyDeepSeek2026',
      is_active: true,
      priority: 3,
      model_name: 'deepseek-chat',
      mode: 'parallel_failover',
      created_at: new Date('2026-01-01').toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  public aiLogs: AILog[] = [
    {
      id: 'log-001',
      user_id: DEFAULT_USER_ID,
      user_name: 'Alex Pratama',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      feature: 'text_parsing',
      prompt_tokens: 184,
      completion_tokens: 42,
      latency_ms: 320,
      status: 'success',
      created_at: '2026-10-09T10:00:00+07:00',
    },
    {
      id: 'log-002',
      user_id: DEFAULT_USER_ID,
      user_name: 'Alex Pratama',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      feature: 'voice_stt',
      prompt_tokens: 310,
      completion_tokens: 65,
      latency_ms: 610,
      status: 'success',
      created_at: '2026-10-08T16:45:00+07:00',
    },
    {
      id: 'log-003',
      user_id: DEFAULT_USER_ID,
      user_name: 'Alex Pratama',
      provider: 'gemini',
      model: 'gemini-1.5-flash',
      feature: 'photo_ocr',
      prompt_tokens: 1240,
      completion_tokens: 280,
      latency_ms: 1250,
      status: 'success',
      created_at: '2026-10-07T19:20:00+07:00',
    },
  ];

  public payments: SubscriptionPayment[] = [];

  public processedTelegramUpdates = new Set<number>();
  public verificationCodes: Map<string, { code: string; expiresAt: Date }> = new Map();
  public emailVerificationCodes: Map<string, { code: string; expiresAt: Date }> = new Map();
  public auditLogs: AuditLog[] = [];
  public zeroStateApplied: boolean = false;

  constructor() {
    this.hydratePersistedAdmin();
    this.hydrateRegisteredUsers();
    this.hydrateCustomUsers();
    this.hydrateFinancialData();
    this.hydratePayments();
  }

  public hydrateFinancialData(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const financialPath = path.join(process.cwd(), '.data-financial.json');
        if (fs.existsSync(financialPath)) {
          const raw = fs.readFileSync(financialPath, 'utf-8');
          const data = JSON.parse(raw);
          if (data && typeof data === 'object') {
            if (Array.isArray(data.wallets)) {
              this.wallets = data.wallets;
            }
            if (Array.isArray(data.transactions)) {
              this.transactions = data.transactions;
            }
            if (Array.isArray(data.categories) && data.categories.length > 0) {
              this.categories = data.categories;
            }
            if (Array.isArray(data.budgets)) {
              this.budgets = data.budgets;
              // Sinkronkan monthly_budget kategori dengan budget aktif
              for (const b of this.budgets) {
                const cat = this.categories.find((c) => c.id === b.category_id && c.user_id === b.user_id);
                if (cat && typeof b.amount === 'number' && b.amount > 0) {
                  cat.monthly_budget = b.amount;
                }
              }
            }
            if (Array.isArray(data.transactionItems)) {
              this.transactionItems = data.transactionItems;
            }
            if (data.zeroStateApplied) {
              this.zeroStateApplied = true;
            }
          }
        }
      } catch (err) {
        console.error('Failed to hydrate financial data from disk:', err);
      }
    }
  }

  public persistFinancialData(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const financialPath = path.join(process.cwd(), '.data-financial.json');
        const payload = {
          version: 1,
          zeroStateApplied: this.zeroStateApplied,
          lastUpdated: new Date().toISOString(),
          wallets: this.wallets,
          transactions: this.transactions,
          budgets: this.budgets,
          categories: this.categories,
          transactionItems: this.transactionItems,
        };
        const tmpPath = `${financialPath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
        fs.renameSync(tmpPath, financialPath);
      } catch (err) {
        console.error('Failed to persist financial data to disk:', err);
      }
    }
  }

  public applyOneTimeZeroState(): { success: boolean; message: string; timestamp: string } {
    if (this.zeroStateApplied) {
      return {
        success: false,
        message: 'Kondisi awal nol sudah pernah diterapkan sebelumnya. Fitur ini terkunci dan tidak dapat dijalankan ulang demi melindungi data pengguna.',
        timestamp: new Date().toISOString(),
      };
    }
    const timestamp = new Date().toISOString();

    // 1. Reset seluruh saldo dompet ke Rp0
    this.wallets.forEach((w) => {
      w.balance = 0;
      w.updated_at = timestamp;
    });

    // 2. Kosongkan seluruh transaksi & mutasi lama
    this.transactions = [];
    this.transactionItems = [];

    // 3. Kosongkan seluruh budget lama dan reset batas bulanan kategori ke 0
    this.budgets = [];
    this.categories.forEach((c) => {
      c.monthly_budget = 0;
      c.updated_at = timestamp;
    });

    // 4. Tandai bahwa zero state telah diterapkan satu kali
    this.zeroStateApplied = true;

    // 5. Simpan permanen ke disk (.data-financial.json)
    this.persistFinancialData();

    return {
      success: true,
      message: 'Kondisi awal keuangan nol (Rp0) berhasil diterapkan dan disimpan permanen.',
      timestamp,
    };
  }

  public hydratePayments(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const paymentsPath = path.join(process.cwd(), '.data-payments.json');
        if (fs.existsSync(paymentsPath)) {
          const raw = fs.readFileSync(paymentsPath, 'utf-8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            // Bersihkan data dummy seed bawaan prototipe
            this.payments = data.filter(
              (p) => p && p.order_id && !p.order_id.startsWith('TD-PRO-') && p.id !== 'pay-001' && p.id !== 'pay-002'
            );
          }
        }
      } catch (err) {
        console.error('Failed to hydrate payments from disk:', err);
      }
    }
  }

  public persistPayments(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const paymentsPath = path.join(process.cwd(), '.data-payments.json');
        const tmpPath = `${paymentsPath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(this.payments, null, 2), 'utf-8');
        fs.renameSync(tmpPath, paymentsPath);
      } catch (err) {
        console.error('Failed to persist payments to disk:', err);
      }
    }
  }

  public persistAdminAccount(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const adminUser = this.profiles.find((p) => p.id === 'admin-owner-talitha');
        if (adminUser) {
          fs.writeFileSync(
            path.join(process.cwd(), '.admin-account.json'),
            JSON.stringify(adminUser, null, 2),
            'utf-8'
          );
        }
      } catch (err) {
        console.error('Failed to update persisted admin account:', err);
      }
    }
  }

  public getPayments(): SubscriptionPayment[] {
    this.hydratePayments();
    // Validasi integritas ketat: Hanya tampilkan pengajuan dari akun pengguna yang sah terdaftar di database
    return this.payments.filter((p) => {
      if (!p || !p.user_id || !p.order_id) return false;
      if (p.order_id.startsWith('TD-PRO-') || p.id === 'pay-001' || p.id === 'pay-002') return false;
      const user = this.getUser(p.user_id);
      return Boolean(user);
    });
  }

  public createPaymentSubmission(
    userId: string,
    plan: 'starter' | 'pro' = 'pro',
    amount: number = 99000,
    paymentType: 'manual_transfer' | 'midtrans' = 'manual_transfer'
  ): { payment: SubscriptionPayment; isExisting: boolean } {
    this.hydratePayments();
    const user = this.getUser(userId);
    if (!user) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    // 1. Cek apakah pengguna sudah memiliki pengajuan PENDING untuk paket ini (cegah duplikasi / klik ganda)
    const existingPending = this.payments.find(
      (p) => p.user_id === user.id && p.status === 'pending' && p.plan === plan
    );
    if (existingPending) {
      return { payment: existingPending, isExisting: true };
    }

    // 2. Buat ID pengajuan unik otomatis dengan format PRO-<ID_UNIK>
    const uniqueSuffix = Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
    const orderId = `PRO-${uniqueSuffix}`;

    const newPayment: SubscriptionPayment = {
      id: `pay-${Date.now()}`,
      order_id: orderId,
      user_id: user.id,
      user_name: user.full_name,
      user_email: user.email,
      plan: plan,
      amount: amount,
      status: 'pending',
      payment_type: paymentType,
      created_at: new Date().toISOString(),
    };

    this.payments.unshift(newPayment);
    this.persistPayments();

    return { payment: newPayment, isExisting: false };
  }

  public approvePayment(
    orderId: string,
    adminId: string = DEFAULT_USER_ID
  ): { success: boolean; payment?: SubscriptionPayment; message: string } {
    this.hydratePayments();
    const payment = this.payments.find((p) => p.order_id === orderId);
    if (!payment) {
      return { success: false, message: 'ID pengajuan tidak ditemukan.' };
    }

    payment.status = 'settlement';
    payment.approved_by = adminId;
    payment.approved_at = new Date().toISOString();

    const targetUser = this.getUser(payment.user_id);
    if (targetUser) {
      targetUser.plan = payment.plan;
      targetUser.updated_at = new Date().toISOString();
      if (targetUser.id === 'admin-owner-talitha') {
        this.persistAdminAccount();
      } else {
        this.persistRegisteredUsers();
      }
    }

    this.persistPayments();

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: adminId,
      admin_name: 'Admin Utama',
      target_user_id: payment.user_id,
      target_user_name: payment.user_name || 'Pengguna',
      action: 'approve_payment',
      notes: `Menyetujui pembayaran ${payment.plan.toUpperCase()} (ID Pengajuan: ${payment.order_id}, Nominal: Rp${payment.amount.toLocaleString('id-ID')}). Akun berhasil diupgrade ke ${payment.plan.toUpperCase()}.`,
      created_at: new Date().toISOString(),
    });

    return { success: true, payment, message: `Pengajuan pembayaran ${orderId} berhasil disetujui.` };
  }

  public rejectPayment(
    orderId: string,
    reason: string = 'Bukti transfer tidak valid',
    adminId: string = DEFAULT_USER_ID
  ): { success: boolean; payment?: SubscriptionPayment; message: string } {
    this.hydratePayments();
    const payment = this.payments.find((p) => p.order_id === orderId);
    if (!payment) {
      return { success: false, message: 'ID pengajuan tidak ditemukan.' };
    }

    payment.status = 'rejected';
    payment.rejection_reason = reason;

    this.persistPayments();

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: adminId,
      admin_name: 'Admin Utama',
      target_user_id: payment.user_id,
      target_user_name: payment.user_name || 'Pengguna',
      action: 'reject_payment',
      notes: `Menolak pembayaran ${payment.plan.toUpperCase()} (ID Pengajuan: ${payment.order_id}). Alasan: ${reason}`,
      created_at: new Date().toISOString(),
    });

    return { success: true, payment, message: `Pengajuan pembayaran ${orderId} ditolak.` };
  }

  public hydrateRegisteredUsers(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const registeredPath = path.join(process.cwd(), '.users-registered.json');
        if (fs.existsSync(registeredPath)) {
          const raw = fs.readFileSync(registeredPath, 'utf-8');
          const list: UserProfile[] = JSON.parse(raw);
          if (Array.isArray(list)) {
            for (const registeredUser of list) {
              const existingIdx = this.profiles.findIndex(
                (p) => p.id === registeredUser.id || (p.email && registeredUser.email && p.email.toLowerCase() === registeredUser.email.toLowerCase())
              );
              if (existingIdx >= 0) {
                this.profiles[existingIdx] = { ...this.profiles[existingIdx], ...registeredUser };
              } else {
                this.profiles.push(registeredUser);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to hydrate registered users from disk:', err);
      }
    }
  }

  public persistRegisteredUsers(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const registeredPath = path.join(process.cwd(), '.users-registered.json');
        const nonAdmins = this.profiles.filter((p) => p.role !== 'superadmin');
        fs.writeFileSync(registeredPath, JSON.stringify(nonAdmins, null, 2), 'utf-8');
      } catch (err) {
        console.error('Failed to persist registered users to disk:', err);
      }
    }
  }

  public hydrateCustomUsers(): void {
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const customPath = path.join(process.cwd(), '.users-custom.json');
        if (fs.existsSync(customPath)) {
          const map = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
          for (const [id, customFields] of Object.entries(map)) {
            const user = this.profiles.find((p) => p.id === id);
            if (user && customFields && typeof customFields === 'object') {
              Object.assign(user, customFields);
            }
          }
        }
      } catch {}
    }
  }

  public hydratePersistedAdmin(): void {
    const persisted = getInitialPersistedAdmin();
    if (persisted) {
      const existingIdx = this.profiles.findIndex(
        (p) => p.id === persisted.id || p.email?.toLowerCase() === persisted.email?.toLowerCase()
      );
      if (existingIdx >= 0) {
        this.profiles[existingIdx] = { ...this.profiles[existingIdx], ...persisted };
      } else {
        this.profiles.unshift(persisted);
      }

      // Pastikan dompet operasional admin selalu tersedia
      if (!this.wallets.some((w) => w.id === 'wallet-admin-talitha')) {
        this.wallets.push({
          id: 'wallet-admin-talitha',
          user_id: persisted.id,
          name: '💵 Kas Operasional Admin',
          type: 'Cash',
          balance: this.zeroStateApplied ? 0 : 10000000,
          color: '#8B5CF6',
          icon: '💵',
          is_default: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    this.migrateLegacyDataToOwner();
  }

  public migrateLegacyDataToOwner(): void {
    const ownerId = DEFAULT_USER_ID;
    const legacyId = DEMO_USER_ID;

    // 1. Migrasikan kepemilikan dompet legacy ke akun pemilik jika belum dimigrasikan
    this.wallets.forEach((w) => {
      if (w.user_id === legacyId || ['wallet-001', 'wallet-002', 'wallet-003', 'wallet-admin-talitha'].includes(w.id)) {
        w.user_id = ownerId;
      }
    });

    // 2. Migrasikan kategori
    this.categories.forEach((c) => {
      if (c.user_id === legacyId) {
        c.user_id = ownerId;
      }
    });

    // 3. Migrasikan budget
    this.budgets.forEach((b) => {
      if (b.user_id === legacyId) {
        b.user_id = ownerId;
      }
    });

    // 4. Migrasikan transaksi (tetap pertahankan id transaksi, relasi, dan isi deskripsi/notes)
    this.transactions.forEach((t) => {
      if (t.user_id === legacyId) {
        t.user_id = ownerId;
      }
    });

    // 5. Migrasikan riwayat chat AI
    this.aiChatHistory.forEach((ch) => {
      if (ch.user_id === legacyId) {
        ch.user_id = ownerId;
      }
    });
  }

  public isBootstrapLocked(): boolean {
    if (checkBootstrapLock()) return true;
    return this.profiles.some(
      (p) =>
        (p.role === 'superadmin' || p.role === 'admin') &&
        (p.id === DEFAULT_USER_ID || p.email?.toLowerCase().includes('talitha') || p.email?.toLowerCase().includes('talithasukma23'))
    );
  }

  public bootstrapPrimaryAdmin(data: {
    email: string;
    password?: string;
    fullName?: string;
    phone?: string;
    telegramUsername?: string;
  }): UserProfile {
    if (this.isBootstrapLocked()) {
      throw new Error('Mekanisme bootstrap telah dikunci secara permanen. Akun Admin Utama sudah terdaftar.');
    }

    const rawEmail = (data.email || 'talithaayusukm').trim().toLowerCase();
    const finalEmail = rawEmail.includes('@') ? rawEmail : `${rawEmail}@tatadana.app`;
    const finalName = data.fullName || 'Talitha Ayu Sukma (Owner & Superadmin)';
    const finalPhone = data.phone || '088222003880';
    const finalTelegram = data.telegramUsername || 'talithaayusukm';
    const password = data.password || 'Admin@TataDana2026!';

    const salt = generateSalt();
    const hash = hashPassword(password, salt);

    const adminProfile: UserProfile = {
      id: 'admin-owner-talitha',
      email: finalEmail,
      full_name: finalName,
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      phone_number: finalPhone,
      phone_verified: true,
      email_verified: true,
      plan: 'pro',
      role: 'superadmin',
      account_status: 'approved',
      password_hash: hash,
      password_salt: salt,
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      telegram_chat_id: 8806951051,
      telegram_username: finalTelegram,
      telegram_connected: true,
      telegram_connected_at: new Date().toISOString(),
      daily_reminder_enabled: true,
      reminder_frequency: 1,
      reminder_time_1: '20:00:00',
      reminder_time_2: '12:00:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save to profiles
    const existingIdx = this.profiles.findIndex((p) => p.id === adminProfile.id || p.email === finalEmail);
    if (existingIdx >= 0) {
      this.profiles[existingIdx] = adminProfile;
    } else {
      this.profiles.unshift(adminProfile);
    }

    // Default admin wallet
    if (!this.wallets.some((w) => w.user_id === adminProfile.id)) {
      this.wallets.push({
        id: 'wallet-admin-talitha',
        user_id: adminProfile.id,
        name: '💵 Kas Operasional Admin',
        type: 'Cash',
        balance: 10000000,
        icon: '💵',
        is_default: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Persist to disk (.admin-account.json)
    if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        fs.writeFileSync(path.join(process.cwd(), '.admin-account.json'), JSON.stringify(adminProfile, null, 2), 'utf-8');
        fs.writeFileSync(
          path.join(process.cwd(), '.admin-bootstrap.lock'),
          JSON.stringify(
            {
              lockedAt: new Date().toISOString(),
              primaryAdminId: adminProfile.id,
              primaryAdminEmail: adminProfile.email,
              status: 'LOCKED_PERMANENTLY',
              message: 'Bootstrap admin telah selesai. Mekanisme ini dinonaktifkan demi keamanan.',
            },
            null,
            2
          ),
          'utf-8'
        );
      } catch (err) {
        console.error('Failed to write admin persistence file:', err);
      }
    }

    // Record Audit Log
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: adminProfile.id,
      admin_name: adminProfile.full_name,
      action: 'bootstrap_primary_admin',
      notes: `Akun Admin Utama pemilik aplikasi (${adminProfile.email}) berhasil dibuat dengan status APPROVED. Bootstrap dikunci secara permanen.`,
      created_at: new Date().toISOString(),
    });

    const { password_hash, password_salt, ...safeProfile } = adminProfile;
    return safeProfile as UserProfile;
  }

  public getUserByEmailOrUsername(identifier: string): UserProfile | undefined {
    if (!identifier) return undefined;
    const clean = identifier.toLowerCase().trim();
    let found = this.profiles.find((p) => {
      const pEmail = (p.email || '').toLowerCase().trim();
      const pUsername = (p.telegram_username || '').toLowerCase().trim();
      const pPhone = (p.phone_number || '').replace(/[^0-9]/g, '');
      const cleanPhone = clean.replace(/[^0-9]/g, '');

      return (
        pEmail === clean ||
        pUsername === clean ||
        (cleanPhone.length >= 8 && pPhone === cleanPhone) ||
        (clean.length >= 4 && pEmail.startsWith(clean)) ||
        (clean.includes('@') && clean.split('@')[0] === pEmail.split('@')[0])
      );
    });
    if (found) return found;

    if (typeof window === 'undefined') {
      this.hydratePersistedAdmin();
      this.hydrateRegisteredUsers();
      this.hydrateCustomUsers();
      return this.profiles.find((p) => {
        const pEmail = (p.email || '').toLowerCase().trim();
        const pUsername = (p.telegram_username || '').toLowerCase().trim();
        const pPhone = (p.phone_number || '').replace(/[^0-9]/g, '');
        const cleanPhone = clean.replace(/[^0-9]/g, '');

        return (
          pEmail === clean ||
          pUsername === clean ||
          (cleanPhone.length >= 8 && pPhone === cleanPhone) ||
          (clean.length >= 4 && pEmail.startsWith(clean)) ||
          (clean.includes('@') && clean.split('@')[0] === pEmail.split('@')[0])
        );
      });
    }

    return undefined;
  }

  public verifyUserPassword(user: UserProfile, inputPass: string): boolean {
    if (!user) return false;
    if (user.password_hash && user.password_salt) {
      const hashed = hashPassword(inputPass, user.password_salt);
      return hashed === user.password_hash;
    }
    // Default fallback for demo seed accounts
    return inputPass === 'password123' || inputPass === 'admin123' || inputPass === 'Admin@TataDana2026!';
  }

  public approveUser(targetUserId: string, adminId: string = DEFAULT_USER_ID): UserProfile | null {
    const user = this.profiles.find((p) => p.id === targetUserId);
    if (!user) return null;

    user.account_status = 'approved';
    user.phone_verified = true;
    user.approved_at = new Date().toISOString();
    user.approved_by = adminId;
    user.updated_at = new Date().toISOString();

    const admin = this.getUser(adminId);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: adminId,
      admin_name: admin?.full_name || 'Admin Utama',
      target_user_id: user.id,
      target_user_name: user.full_name,
      action: 'approve_user',
      notes: `Menyetujui pendaftaran akun pengguna ${user.full_name} (${user.email || user.phone_number}). Status kini AKTIF/APPROVED.`,
      created_at: new Date().toISOString(),
    });

    this.persistRegisteredUsers();
    return user;
  }

  public rejectUser(targetUserId: string, reason?: string, adminId: string = DEFAULT_USER_ID): UserProfile | null {
    const user = this.profiles.find((p) => p.id === targetUserId);
    if (!user) return null;

    user.account_status = 'rejected';
    user.rejection_reason = reason || 'Pendaftaran ditolak oleh Admin Utama';
    user.approved_by = adminId;
    user.updated_at = new Date().toISOString();

    const admin = this.getUser(adminId);
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: adminId,
      admin_name: admin?.full_name || 'Admin Utama',
      target_user_id: user.id,
      target_user_name: user.full_name,
      action: 'reject_user',
      notes: `Menolak pendaftaran akun pengguna ${user.full_name}. Alasan: ${user.rejection_reason}`,
      created_at: new Date().toISOString(),
    });

    this.persistRegisteredUsers();
    return user;
  }

  // Helper Methods
  public getUser(userId: string = DEFAULT_USER_ID): UserProfile {
    // 1. Direct ID match
    let user = this.profiles.find((p) => p.id === userId);
    if (user) return user;

    // 2. Email match (case-insensitive)
    if (userId && userId.includes('@')) {
      const cleanEmail = userId.trim().toLowerCase();
      user = this.profiles.find((p) => p.email?.toLowerCase() === cleanEmail);
      if (user) return user;
    }

    // 3. Hydrate from disk if running on server and not found in memory
    if (typeof window === 'undefined') {
      this.hydratePersistedAdmin();
      this.hydrateRegisteredUsers();
      this.hydrateCustomUsers();
      user = this.profiles.find((p) => p.id === userId || (userId.includes('@') && p.email?.toLowerCase() === userId.trim().toLowerCase()));
      if (user) return user;
    }

    // 4. Default admin lookup
    if (userId === DEFAULT_USER_ID || userId === 'admin-owner-talitha' || userId === 'admin-super-999') {
      const admin = this.profiles.find((p) => p.role === 'superadmin') || this.profiles[0];
      return admin;
    }

    // 5. Fallback for specific user ID: return safe user profile (NEVER superadmin!)
    return {
      id: userId,
      email: userId && userId.includes('@') ? userId : `${userId}@tatadana.local`,
      full_name: 'Pengguna TataDana',
      phone_number: '',
      phone_verified: false,
      email_verified: true,
      plan: 'starter',
      role: 'user',
      account_status: 'approved',
      timezone: 'Asia/Jakarta',
      currency: 'IDR',
      telegram_connected: false,
      daily_reminder_enabled: false,
      reminder_frequency: 1,
      reminder_time_1: '20:00:00',
      reminder_time_2: '12:00:00',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  public getUserByTelegramId(chatId: number): UserProfile | undefined {
    return this.profiles.find((p) => p.telegram_chat_id === chatId);
  }

  public getUserByPhone(phone: string): UserProfile | undefined {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return this.profiles.find((p) => p.phone_number?.replace(/[^0-9]/g, '') === cleanPhone);
  }

  public getWallets(userId: string): Wallet[] {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const existing = this.wallets.filter((w) => {
      if (effectiveUserId === DEFAULT_USER_ID) {
        return w.user_id === DEFAULT_USER_ID || ['wallet-001', 'wallet-002', 'wallet-003', 'wallet-admin-talitha'].includes(w.id);
      }
      return w.user_id === effectiveUserId;
    });
    if (existing.length > 0) {
      return existing.map((w) => ({
        ...w,
        user_id: effectiveUserId,
      }));
    }

    // Inisialisasi dompet default untuk user jika belum ada
    const defaultWallet: Wallet = {
      id: `wallet-${effectiveUserId}-default`,
      user_id: effectiveUserId,
      name: '💵 Tunai (Cash)',
      type: 'Cash',
      balance: 0,
      icon: '💵',
      is_default: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.wallets.push(defaultWallet);
    this.persistFinancialData();
    return [defaultWallet];
  }

  public getDefaultWallet(userId: string): Wallet {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const userWallets = this.getWallets(effectiveUserId);
    return userWallets.find((w) => w.is_default) || userWallets[0] || this.wallets[0];
  }

  public addWallet(walletData: Omit<Wallet, 'id' | 'created_at' | 'updated_at'>): Wallet {
    const newWallet: Wallet = {
      ...walletData,
      id: `wallet-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (newWallet.is_default) {
      this.wallets.forEach((w) => {
        if (w.user_id === newWallet.user_id) w.is_default = false;
      });
    }

    this.wallets.push(newWallet);
    this.persistFinancialData();
    return newWallet;
  }

  public updateWallet(walletId: string, data: Partial<Wallet>): Wallet | undefined {
    const wallet = this.wallets.find((w) => w.id === walletId);
    if (!wallet) return undefined;

    if (data.is_default) {
      this.wallets.forEach((w) => {
        if (w.user_id === wallet.user_id) w.is_default = false;
      });
    }

    Object.assign(wallet, data, { updated_at: new Date().toISOString() });
    this.persistFinancialData();
    return wallet;
  }

  public deleteWallet(walletId: string): boolean {
    const index = this.wallets.findIndex((w) => w.id === walletId);
    if (index === -1) return false;
    this.wallets.splice(index, 1);
    this.persistFinancialData();
    return true;
  }

  public setDefaultWallet(userId: string, walletId: string): void {
    this.wallets.forEach((w) => {
      if (w.user_id === userId) {
        w.is_default = w.id === walletId;
        w.updated_at = new Date().toISOString();
      }
    });
    this.persistFinancialData();
  }

  public getCategories(userId: string): Category[] {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const existing = this.categories.filter((c) => c.user_id === effectiveUserId);
    if (existing.length > 0) return existing;

    // Inisialisasi kategori standar untuk user baru / superadmin (seluruh budget awal Rp0)
    const defaultTemplates = [
      { name: 'Makanan & Minuman', type: 'expense' as const, emoji: '🍜', color: '#059669', monthly_budget: 0 },
      { name: 'Transportasi', type: 'expense' as const, emoji: '🚗', color: '#FB923C', monthly_budget: 0 },
      { name: 'Tagihan & Utilitas', type: 'expense' as const, emoji: '🏠', color: '#EA580C', monthly_budget: 0 },
      { name: 'Belanja & Supermarket', type: 'expense' as const, emoji: '🛒', color: '#FDBA74', monthly_budget: 0 },
      { name: 'Hiburan & Ngopi', type: 'expense' as const, emoji: '☕', color: '#C2410C', monthly_budget: 0 },
      { name: 'Kesehatan', type: 'expense' as const, emoji: '💊', color: '#0D9488', monthly_budget: 0 },
      { name: 'Gaji Bulanan', type: 'income' as const, emoji: '💰', color: '#10B981', monthly_budget: 0 },
      { name: 'Freelance & Usaha', type: 'income' as const, emoji: '💼', color: '#34D399', monthly_budget: 0 },
    ];

    const newCats: Category[] = defaultTemplates.map((t, idx) => ({
      id: `cat-${effectiveUserId}-${idx + 1}`,
      user_id: effectiveUserId,
      name: t.name,
      type: t.type,
      emoji: t.emoji,
      color: t.color,
      is_custom: false,
      monthly_budget: t.monthly_budget,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    this.categories.push(...newCats);
    this.persistFinancialData();
    return newCats;
  }

  public updateUserProfile(
    userId: string,
    updates: {
      fullName?: string;
      phoneNumber?: string;
      avatarUrl?: string;
      timezone?: string;
      currency?: string;
      dailyReminderEnabled?: boolean;
      reminderFrequency?: 1 | 2;
      reminderTime1?: string;
      reminderTime2?: string;
    }
  ): UserProfile | null {
    const user = this.profiles.find((p) => p.id === userId);
    if (!user) return null;

    if (updates.fullName !== undefined) user.full_name = updates.fullName.trim();
    if (updates.phoneNumber !== undefined) user.phone_number = updates.phoneNumber.trim();
    if (updates.avatarUrl !== undefined) user.avatar_url = updates.avatarUrl.trim();
    if (updates.timezone !== undefined) user.timezone = updates.timezone;
    if (updates.currency !== undefined) user.currency = updates.currency;
    if (updates.dailyReminderEnabled !== undefined) user.daily_reminder_enabled = updates.dailyReminderEnabled;
    if (updates.reminderFrequency !== undefined) user.reminder_frequency = updates.reminderFrequency;
    if (updates.reminderTime1 !== undefined) user.reminder_time_1 = updates.reminderTime1;
    if (updates.reminderTime2 !== undefined) user.reminder_time_2 = updates.reminderTime2;
    user.updated_at = new Date().toISOString();

    // Persist ke disk jika akun ini adalah Superadmin Utama
    if (user.id === 'admin-owner-talitha' && typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        fs.writeFileSync(
          path.join(process.cwd(), '.admin-account.json'),
          JSON.stringify(user, null, 2),
          'utf-8'
        );
      } catch (err) {
        console.error('Failed to update persisted admin account:', err);
      }
    } else if (typeof window === 'undefined') {
      try {
        const nodeRequire = eval('require');
        const fs = nodeRequire('fs');
        const path = nodeRequire('path');
        const customPath = path.join(process.cwd(), '.users-custom.json');
        let currentMap: Record<string, any> = {};
        if (fs.existsSync(customPath)) {
          try {
            currentMap = JSON.parse(fs.readFileSync(customPath, 'utf-8'));
          } catch {}
        }
        currentMap[user.id] = {
          full_name: user.full_name,
          phone_number: user.phone_number,
          avatar_url: user.avatar_url,
          timezone: user.timezone,
          currency: user.currency,
          updated_at: user.updated_at,
        };
        fs.writeFileSync(customPath, JSON.stringify(currentMap, null, 2), 'utf-8');
        this.persistRegisteredUsers();
      } catch (err) {
        console.error('Failed to update custom users cache:', err);
      }
    }

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: user.id,
      admin_name: user.full_name,
      target_user_id: user.id,
      target_user_name: user.full_name,
      action: 'update_profile',
      notes: `Pengguna ${user.full_name} memperbarui data profil akun.`,
      created_at: new Date().toISOString(),
    });

    return user;
  }

  public getBudgets(userId: string): Budget[] {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const userCategories = this.getCategories(effectiveUserId);
    return this.budgets
      .filter((b) => b.user_id === effectiveUserId)
      .map((b) => ({
        ...b,
        category: userCategories.find((c) => c.id === b.category_id),
      }));
  }

  public updateCategoryBudget(
    userId: string,
    categoryId: string,
    amount: number,
    periodType: BudgetPeriodType = 'monthly'
  ): Category | undefined {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const category = this.categories.find(
      (c) => c.id === categoryId && c.user_id === effectiveUserId
    );
    if (!category) return undefined;

    let monthlyTarget = amount;
    if (periodType === 'weekly') monthlyTarget = amount * 4;
    if (periodType === 'daily') monthlyTarget = amount * 30;

    category.monthly_budget = monthlyTarget;
    category.updated_at = new Date().toISOString();

    if (amount <= 0) {
      this.budgets = this.budgets.filter(
        (b) => !(b.user_id === effectiveUserId && b.category_id === categoryId && b.period_type === periodType)
      );
    } else {
      let existingBudget = this.budgets.find(
        (b) => b.user_id === effectiveUserId && b.category_id === categoryId && b.period_type === periodType
      );
      if (existingBudget) {
        existingBudget.amount = amount;
        existingBudget.user_id = effectiveUserId;
        existingBudget.updated_at = new Date().toISOString();
      } else {
        this.budgets.push({
          id: `bdg-${Date.now()}`,
          user_id: effectiveUserId,
          category_id: categoryId,
          period_type: periodType,
          amount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }

    this.persistFinancialData();
    return category;
  }

  public getTransactions(userId: string, filters?: {
    type?: string;
    categoryId?: string;
    walletId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    date?: string;
  }): Transaction[] {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    let txs = this.transactions
      .filter((t) => t.user_id === effectiveUserId)
      .map((t) => ({
        ...t,
        wallet: this.wallets.find((w) => w.id === t.wallet_id),
        category: this.categories.find((c) => c.id === t.category_id),
        items: this.transactionItems.filter((i) => i.transaction_id === t.id),
      }))
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

    if (filters?.type && filters.type !== 'all') {
      txs = txs.filter((t) => t.type === filters.type);
    }
    if (filters?.categoryId && filters.categoryId !== 'all') {
      txs = txs.filter((t) => t.category_id === filters.categoryId);
    }
    if (filters?.walletId && filters.walletId !== 'all') {
      txs = txs.filter((t) => t.wallet_id === filters.walletId);
    }
    if (filters?.startDate) {
      const s = new Date(filters.startDate);
      s.setHours(0, 0, 0, 0);
      txs = txs.filter((t) => new Date(t.transaction_date).getTime() >= s.getTime());
    }
    if (filters?.endDate) {
      const e = new Date(filters.endDate);
      e.setHours(23, 59, 59, 999);
      txs = txs.filter((t) => new Date(t.transaction_date).getTime() <= e.getTime());
    }
    if (filters?.date) {
      const targetDate = filters.date.slice(0, 10);
      txs = txs.filter((t) => t.transaction_date.slice(0, 10) === targetDate);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      txs = txs.filter((t) => {
        const notes = (t.notes || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const cat = (t.category?.name || '').toLowerCase();
        const wallet = (t.wallet?.name || '').toLowerCase();
        const amount = String(t.amount);
        const typeStr = t.type === 'income' ? 'pemasukan' : t.type === 'expense' ? 'pengeluaran' : 'transfer';
        const dateStr = t.transaction_date.toLowerCase();

        return (
          notes.includes(q) ||
          desc.includes(q) ||
          cat.includes(q) ||
          wallet.includes(q) ||
          amount.includes(q) ||
          typeStr.includes(q) ||
          dateStr.includes(q)
        );
      });
    }

    return txs;
  }

  public addTransaction(tx: Omit<Transaction, 'id' | 'created_at'>, items?: Array<{ item_name: string; price: number; quantity: number; category_name: string }>): Transaction {
    const id = 'tx-' + Date.now();
    const numericAmount = Number(tx.amount) || 0;
    const effectiveUserId = (tx.user_id === DEFAULT_USER_ID || !tx.user_id) ? DEFAULT_USER_ID : tx.user_id;

    // Pastikan wallet yang valid selalu ditemukan, fallback ke default wallet jika tidak ada
    let wallet = tx.wallet_id ? this.wallets.find((w) => w.id === tx.wallet_id) : undefined;
    if (!wallet) {
      wallet = this.getDefaultWallet(effectiveUserId);
    }
    const finalWalletId = wallet ? wallet.id : (tx.wallet_id || 'wallet-001');

    // Transaksi diproses otomatis tanpa verifikasi admin (status: approved/success)
    const txStatus = tx.status === 'rejected' ? 'rejected' : 'approved';
    const newTx: Transaction = {
      ...tx,
      id,
      user_id: effectiveUserId,
      wallet_id: finalWalletId,
      amount: numericAmount,
      status: txStatus,
      transaction_date: tx.transaction_date || new Date().toISOString(),
      is_receipt: tx.is_receipt ?? ((items && items.length > 0) || false),
      receipt_items: items ?? tx.receipt_items ?? [],
      description: tx.description || tx.notes || '',
      created_at: new Date().toISOString(),
    };

    // Update wallet balance seketika dan otomatis
    if (wallet && txStatus === 'approved') {
      if (tx.type === 'income') {
        wallet.balance += numericAmount;
      } else if (tx.type === 'expense') {
        wallet.balance -= numericAmount;
      } else if (tx.type === 'transfer' && tx.transfer_to_wallet_id) {
        wallet.balance -= numericAmount;
        const targetWallet = this.wallets.find((w) => w.id === tx.transfer_to_wallet_id);
        if (targetWallet) {
          targetWallet.balance += numericAmount;
          targetWallet.updated_at = new Date().toISOString();
        }
      }
      wallet.updated_at = new Date().toISOString();
    }

    newTx.wallet = wallet;
    newTx.category = this.categories.find((c) => c.id === tx.category_id);

    this.transactions.unshift(newTx);

    if (items && items.length > 0) {
      items.forEach((item, index) => {
        this.transactionItems.push({
          id: `item-${Date.now()}-${index}`,
          transaction_id: id,
          item_name: item.item_name,
          price: item.price,
          quantity: item.quantity,
          category_name: item.category_name,
          created_at: new Date().toISOString(),
        });
      });
    }

    // Catat audit log mutasi otomatis
    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: 'system-auto',
      admin_name: 'TataDana Engine',
      target_user_id: effectiveUserId,
      target_user_name: this.getUser(effectiveUserId)?.full_name || 'Pengguna TataDana',
      action: 'auto_transaction',
      notes: `Transaksi ${tx.type === 'expense' ? 'pengeluaran' : tx.type === 'income' ? 'pemasukan' : 'transfer'} otomatis dicatat & saldo langsung dimutasi (ID: ${id}, Nominal: Rp${numericAmount.toLocaleString('id-ID')}, Dompet: ${wallet?.name || finalWalletId}).`,
      created_at: new Date().toISOString(),
    });

    this.persistFinancialData();
    return newTx;
  }

  public updateTransaction(
    transactionId: string,
    data: {
      amount?: number;
      categoryId?: string;
      walletId?: string;
      type?: 'income' | 'expense' | 'transfer';
      notes?: string;
      description?: string;
      transaction_date?: string;
      transfer_to_wallet_id?: string;
    },
    userId: string = DEFAULT_USER_ID
  ): Transaction | undefined {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const tx = this.transactions.find((t) => t.id === transactionId && t.user_id === effectiveUserId);
    if (!tx) return undefined;

    const oldWallet = this.wallets.find((w) => w.id === tx.wallet_id);
    const oldAmount = tx.amount;
    const oldType = tx.type;

    // 1. Revert mutasi saldo lama
    if (oldWallet && tx.status === 'approved') {
      if (oldType === 'income') {
        oldWallet.balance -= oldAmount;
      } else if (oldType === 'expense') {
        oldWallet.balance += oldAmount;
      } else if (oldType === 'transfer' && tx.transfer_to_wallet_id) {
        oldWallet.balance += oldAmount;
        const oldTarget = this.wallets.find((w) => w.id === tx.transfer_to_wallet_id);
        if (oldTarget) {
          oldTarget.balance -= oldAmount;
          oldTarget.updated_at = new Date().toISOString();
        }
      }
      oldWallet.updated_at = new Date().toISOString();
    }

    // 2. Terapkan data baru
    const newAmount = data.amount !== undefined ? Number(data.amount) : tx.amount;
    const newType = data.type || tx.type;
    const newWalletId = data.walletId || tx.wallet_id;
    const newTargetWalletId = data.transfer_to_wallet_id !== undefined ? data.transfer_to_wallet_id : tx.transfer_to_wallet_id;

    tx.amount = newAmount;
    tx.type = newType;
    tx.wallet_id = newWalletId;
    tx.transfer_to_wallet_id = newTargetWalletId;
    if (data.categoryId !== undefined) tx.category_id = data.categoryId;
    if (data.notes !== undefined) tx.notes = data.notes;
    if (data.description !== undefined) tx.description = data.description;
    if (data.transaction_date) tx.transaction_date = data.transaction_date;

    // 3. Terapkan mutasi saldo baru
    const newWallet = this.wallets.find((w) => w.id === newWalletId);
    if (newWallet && tx.status === 'approved') {
      if (newType === 'income') {
        newWallet.balance += newAmount;
      } else if (newType === 'expense') {
        newWallet.balance -= newAmount;
      } else if (newType === 'transfer' && newTargetWalletId) {
        newWallet.balance -= newAmount;
        const newTarget = this.wallets.find((w) => w.id === newTargetWalletId);
        if (newTarget) {
          newTarget.balance += newAmount;
          newTarget.updated_at = new Date().toISOString();
        }
      }
      newWallet.updated_at = new Date().toISOString();
    }

    tx.wallet = newWallet;
    tx.category = this.categories.find((c) => c.id === tx.category_id);

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: 'system-auto',
      admin_name: 'TataDana Engine',
      target_user_id: tx.user_id,
      target_user_name: this.getUser(tx.user_id)?.full_name || 'Pengguna TataDana',
      action: 'update_transaction',
      notes: `Transaksi ID ${tx.id} berhasil diperbarui. Saldo dompet telah disesuaikan otomatis (Nominal: Rp${newAmount.toLocaleString('id-ID')}).`,
      created_at: new Date().toISOString(),
    });

    this.persistFinancialData();
    return tx;
  }

  public deleteTransaction(transactionId: string, userId: string = DEFAULT_USER_ID): boolean {
    const effectiveUserId = (userId === DEFAULT_USER_ID || !userId) ? DEFAULT_USER_ID : userId;
    const index = this.transactions.findIndex((t) => t.id === transactionId && t.user_id === effectiveUserId);
    if (index === -1) return false;

    const tx = this.transactions[index];
    const wallet = this.wallets.find((w) => w.id === tx.wallet_id);

    // Kembalikan saldo dompet saat transaksi dihapus
    if (wallet && tx.status === 'approved') {
      if (tx.type === 'income') {
        wallet.balance -= tx.amount;
      } else if (tx.type === 'expense') {
        wallet.balance += tx.amount;
      } else if (tx.type === 'transfer' && tx.transfer_to_wallet_id) {
        wallet.balance += tx.amount;
        const targetWallet = this.wallets.find((w) => w.id === tx.transfer_to_wallet_id);
        if (targetWallet) {
          targetWallet.balance -= tx.amount;
          targetWallet.updated_at = new Date().toISOString();
        }
      }
      wallet.updated_at = new Date().toISOString();
    }

    this.auditLogs.unshift({
      id: `audit-${Date.now()}`,
      admin_id: 'system-auto',
      admin_name: 'TataDana Engine',
      target_user_id: tx.user_id,
      target_user_name: this.getUser(tx.user_id)?.full_name || 'Pengguna TataDana',
      action: 'delete_transaction',
      notes: `Transaksi ID ${tx.id} dihapus. Saldo dompet berhasil dikembalikan (Nominal: Rp${tx.amount.toLocaleString('id-ID')}).`,
      created_at: new Date().toISOString(),
    });

    this.transactions.splice(index, 1);
    this.transactionItems = this.transactionItems.filter((i) => i.transaction_id !== transactionId);

    this.persistFinancialData();
    return true;
  }

  public approveTransaction(transactionId: string, adminId: string = DEFAULT_USER_ID): Transaction | undefined {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) return undefined;

    // Mutasi saldo tepat satu kali jika status saat ini masih 'pending'
    if (tx.status === 'pending') {
      tx.status = 'approved';
      tx.approved_by = adminId;
      tx.approved_at = new Date().toISOString();

      const wallet = this.wallets.find((w) => w.id === tx.wallet_id);
      if (wallet) {
        if (tx.type === 'income') {
          wallet.balance += tx.amount;
        } else if (tx.type === 'expense') {
          wallet.balance -= tx.amount;
        } else if (tx.type === 'transfer' && tx.transfer_to_wallet_id) {
          wallet.balance -= tx.amount;
          const targetWallet = this.wallets.find((w) => w.id === tx.transfer_to_wallet_id);
          if (targetWallet) {
            targetWallet.balance += tx.amount;
            targetWallet.updated_at = new Date().toISOString();
          }
        }
        wallet.updated_at = new Date().toISOString();
      }

      // Catat log audit persetujuan admin
      this.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        admin_id: adminId,
        admin_name: 'Super Admin',
        target_user_id: tx.user_id,
        target_user_name: this.getUser(tx.user_id)?.full_name || 'Pengguna TataDana',
        action: 'approve_transaction',
        notes: `Menyetujui transaksi ${tx.type === 'expense' ? 'pengeluaran' : 'pemasukan'} (ID: ${tx.id}, Nominal: Rp${tx.amount.toLocaleString('id-ID')}, Dompet: ${wallet?.name || tx.wallet_id}). Saldo berhasil dimutasi.`,
        created_at: new Date().toISOString(),
      });
      this.persistFinancialData();
    }

    return tx;
  }

  public rejectTransaction(transactionId: string, reason: string = 'Ditolak oleh admin', adminId: string = DEFAULT_USER_ID): Transaction | undefined {
    const tx = this.transactions.find((t) => t.id === transactionId);
    if (!tx) return undefined;

    if (tx.status === 'pending') {
      tx.status = 'rejected';
      tx.approved_by = adminId;
      tx.approved_at = new Date().toISOString();

      // Saldo TIDAK dimutasi
      this.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        admin_id: adminId,
        admin_name: 'Super Admin',
        target_user_id: tx.user_id,
        target_user_name: this.getUser(tx.user_id)?.full_name || 'Pengguna TataDana',
        action: 'reject_transaction',
        notes: `Menolak transaksi (ID: ${tx.id}, Alasan: ${reason}). Saldo tidak dimutasi.`,
        created_at: new Date().toISOString(),
      });
      this.persistFinancialData();
    }

    return tx;
  }

  public getMonthlyTransactionCount(userId: string): number {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.transactions.filter((t) => {
      if (t.user_id !== userId) return false;
      const d = new Date(t.transaction_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
  }

  public isTelegramUpdateProcessed(updateId: number): boolean {
    if (!this.processedTelegramUpdates) this.processedTelegramUpdates = new Set();
    return this.processedTelegramUpdates.has(updateId);
  }

  public markTelegramUpdateProcessed(updateId: number): void {
    if (!this.processedTelegramUpdates) this.processedTelegramUpdates = new Set();
    this.processedTelegramUpdates.add(updateId);
  }

  public logTelegramWebhook(log: TelegramWebhookLog): void {
    if (!this.telegramWebhookLogs) this.telegramWebhookLogs = [];
    this.telegramWebhookLogs.unshift(log);
  }

  public generateOTP(phone: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    this.verificationCodes.set(phone.replace(/[^0-9]/g, ''), { code, expiresAt });
    return code;
  }

  public verifyOTP(phone: string, inputCode: string): boolean {
    const clean = phone.replace(/[^0-9]/g, '');
    const entry = this.verificationCodes.get(clean);
    // Support universal dev test code 123456
    if (inputCode === '123456') return true;
    if (!entry) return false;
    if (new Date() > entry.expiresAt) return false;
    return entry.code === inputCode;
  }

  public generateEmailOTP(email: string): string {
    if (!this.emailVerificationCodes) this.emailVerificationCodes = new Map();
    const cleanEmail = email.trim().toLowerCase();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit
    this.emailVerificationCodes.set(cleanEmail, { code, expiresAt });
    return code;
  }

  public verifyEmailOTP(email: string, inputCode: string): boolean {
    if (!this.emailVerificationCodes) this.emailVerificationCodes = new Map();
    const cleanEmail = email.trim().toLowerCase();
    const entry = this.emailVerificationCodes.get(cleanEmail);
    // Support universal dev test code 123456
    if (inputCode === '123456') {
      this.markEmailVerified(cleanEmail);
      return true;
    }
    if (!entry) return false;
    if (new Date() > entry.expiresAt) return false;
    if (entry.code === inputCode) {
      this.markEmailVerified(cleanEmail);
      return true;
    }
    return false;
  }

  public markEmailVerified(email: string): boolean {
    const cleanEmail = email.trim().toLowerCase();
    const user = this.profiles.find((p) => p.email?.toLowerCase() === cleanEmail);
    if (user) {
      user.email_verified = true;
      user.updated_at = new Date().toISOString();
      return true;
    }
    return false;
  }
}

// Global Singleton for in-memory persistence in development server
const globalForTataDana = global as unknown as { tatadanaDb: TataDanaStore };
export const db = globalForTataDana.tatadanaDb || new TataDanaStore();
if (globalForTataDana.tatadanaDb) {
  Object.setPrototypeOf(globalForTataDana.tatadanaDb, TataDanaStore.prototype);
  if (!globalForTataDana.tatadanaDb.emailVerificationCodes) {
    globalForTataDana.tatadanaDb.emailVerificationCodes = new Map();
  }
  globalForTataDana.tatadanaDb.hydratePersistedAdmin();
  globalForTataDana.tatadanaDb.hydrateRegisteredUsers();
  globalForTataDana.tatadanaDb.hydrateCustomUsers();
  globalForTataDana.tatadanaDb.profiles?.forEach((p) => {
    if (typeof p.email_verified === 'undefined') {
      p.email_verified = true;
    }
  });
}
if (process.env.NODE_ENV !== 'production') globalForTataDana.tatadanaDb = db;
