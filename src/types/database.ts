// ====================================================================
// TataDana TypeScript Data Models & Types (Step 1 Schema Aligned)
// ====================================================================

export type UserPlan = 'starter' | 'pro';
export type UserRole = 'user' | 'superadmin' | 'admin';
export type AccountStatus = 'pending' | 'approved' | 'active' | 'rejected' | 'suspended';
export type WalletType = 'Cash' | 'Bank' | 'E-Wallet' | 'Investasi';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionSource = 'telegram_text' | 'telegram_photo' | 'telegram_voice' | 'web_manual';
export type BudgetPeriodType = 'daily' | 'weekly' | 'monthly';
export type PaymentStatus = 'pending' | 'settlement' | 'approved' | 'rejected' | 'expire' | 'cancel';
export type PaymentMethod = 'midtrans' | 'manual_transfer';
export type AIFeatureType = 'text_parsing' | 'photo_ocr' | 'voice_stt' | 'financial_advisor' | 'category_recommendation';

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  avatar_url?: string;
  phone_number?: string;
  phone_verified: boolean;
  email_verified: boolean;
  email_verification_code?: string;
  plan: UserPlan;
  role: UserRole;
  account_status?: AccountStatus;
  password_hash?: string;
  password_salt?: string;
  approved_at?: string;
  approved_by?: string;
  rejection_reason?: string;
  timezone: string; // 'Asia/Jakarta'
  currency: string; // 'IDR'
  telegram_chat_id?: number;
  telegram_username?: string;
  telegram_token_encrypted?: string;
  telegram_bot_token?: string;
  telegram_connected: boolean;
  telegram_connected_at?: string;
  daily_reminder_enabled: boolean;
  reminder_frequency: 1 | 2;
  reminder_time_1: string; // '20:00:00'
  reminder_time_2: string; // '12:00:00'
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  name: string;
  type?: WalletType;
  balance: number;
  color?: string;
  icon: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  type: 'income' | 'expense';
  emoji: string;
  color: string;
  is_custom?: boolean;
  monthly_budget?: number;
  created_at: string;
  updated_at?: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  period_type: BudgetPeriodType;
  amount: number;
  created_at: string;
  updated_at: string;
  // Hydrated joins
  category?: Category;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_name: string;
  price: number;
  quantity: number;
  category_name?: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  category_id?: string;
  type: TransactionType;
  amount: number;
  description?: string;
  notes?: string;
  transaction_date: string; // ISO string in WIB
  source: TransactionSource;
  is_receipt?: boolean;
  receipt_items?: any[];
  transfer_to_wallet_id?: string;
  raw_receipt_url?: string;
  status?: 'approved' | 'success' | 'pending' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  // Hydrated joins
  wallet?: Wallet;
  category?: Category;
  items?: TransactionItem[];
  transfer_wallet?: Wallet;
}

export interface TelegramWebhookLog {
  id: string;
  update_id: number;
  user_id?: string;
  payload: any;
  processed_at: string;
}

export interface AIChatHistory {
  id: string;
  user_id: string;
  role: 'user' | 'assistant';
  message: string;
  created_at: string;
}

export interface PaymentApproval {
  id: string;
  user_id: string;
  amount: number;
  proof_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  plan_target: 'starter' | 'pro';
  order_id?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  admin_name?: string;
  action: string;
  target_user_id?: string;
  target_user_name?: string;
  details?: any;
  notes?: string;
  created_at: string;
}

export type AuditLog = AdminAuditLog;

export interface AIProviderConfig {
  id: string;
  name: 'gemini' | 'openai' | 'deepseek' | 'custom' | string;
  display_name: string;
  api_key?: string;
  is_active: boolean;
  priority: number;
  model_name: string;
  mode: 'single' | 'parallel_failover';
  created_at?: string;
  updated_at?: string;
}

export interface AILog {
  id: string;
  user_id?: string;
  user_name?: string;
  provider: string;
  model: string;
  feature: AIFeatureType;
  prompt_tokens: number;
  completion_tokens: number;
  latency_ms: number;
  status: 'success' | 'error';
  error_message?: string;
  created_at: string;
}

export interface SubscriptionPayment {
  id: string;
  order_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  plan: UserPlan;
  amount: number;
  status: PaymentStatus;
  payment_type: PaymentMethod;
  proof_url?: string;
  proof_image_url?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  midtrans_response?: any;
  created_at: string;
}

export interface ExportHistory {
  id: string;
  user_id: string;
  file_name: string;
  file_type: 'pdf' | 'xlsx';
  date_range: string;
  file_url: string;
  expires_at: string;
  created_at: string;
}

export interface ParsedTransactionAI {
  jenis: 'pemasukan' | 'pengeluaran' | 'transfer';
  nominal: number;
  kategori: string;
  catatan: string;
  items?: Array<{ item_name: string; price: number; quantity: number; category_name: string }>;
  confidence?: number;
}
