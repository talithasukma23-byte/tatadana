-- ====================================================================
-- TataDana Initial Database Schema
-- Supabase Postgres Migration
-- Timezone: Asia/Jakarta (WIB)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAINS
CREATE TYPE user_plan_type AS ENUM ('starter', 'pro');
CREATE TYPE user_role_type AS ENUM ('user', 'superadmin');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE transaction_source AS ENUM ('telegram_text', 'telegram_photo', 'telegram_voice', 'web_manual');
CREATE TYPE payment_status AS ENUM ('pending', 'settlement', 'rejected', 'expire', 'cancel');
CREATE TYPE payment_method AS ENUM ('midtrans', 'manual_transfer');
CREATE TYPE ai_feature_type AS ENUM ('text_parsing', 'photo_ocr', 'voice_stt', 'financial_advisor', 'category_recommendation');

-- 3. PROFILES TABLE (Extensions to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT NOT NULL DEFAULT 'Pengguna TataDana',
    avatar_url TEXT,
    phone_number TEXT UNIQUE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    plan user_plan_type NOT NULL DEFAULT 'starter',
    role user_role_type NOT NULL DEFAULT 'user',
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    currency TEXT NOT NULL DEFAULT 'IDR',
    telegram_chat_id BIGINT UNIQUE,
    telegram_username TEXT,
    telegram_bot_token TEXT,
    telegram_connected BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_connected_at TIMESTAMPTZ,
    daily_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_frequency INT NOT NULL DEFAULT 1 CHECK (reminder_frequency IN (1, 2)),
    reminder_time_1 TIME NOT NULL DEFAULT '20:00:00',
    reminder_time_2 TIME NOT NULL DEFAULT '12:00:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- Indexing for fast search
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat ON public.profiles(telegram_chat_id);

-- 4. WALLETS TABLE (Multi-wallet: Cash, BCA, Mandiri, GoPay, OVO, dll)
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    icon TEXT NOT NULL DEFAULT '👛',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);

-- 5. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type transaction_type NOT NULL CHECK (type IN ('income', 'expense')),
    emoji TEXT NOT NULL DEFAULT '🏷️',
    color TEXT NOT NULL DEFAULT '#F97316',
    monthly_budget NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(type);

-- 6. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    notes TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    source transaction_source NOT NULL DEFAULT 'web_manual',
    transfer_to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    raw_receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);

-- 7. TRANSACTION_ITEMS TABLE (Receipt detail multi-item)
CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    category_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_tx ON public.transaction_items(transaction_id);

-- 8. TELEGRAM_UPDATES TABLE (Idempotency check)
CREATE TABLE IF NOT EXISTS public.telegram_updates (
    update_id BIGINT PRIMARY KEY,
    chat_id BIGINT,
    message_text TEXT,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 9. AI_PROVIDERS TABLE (Multi-provider configuration)
CREATE TABLE IF NOT EXISTS public.ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'gemini', 'openai', 'deepseek'
    display_name TEXT NOT NULL,
    api_key TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 1,
    model_name TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'single' CHECK (mode IN ('single', 'parallel_failover')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

-- 10. AI_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    feature ai_feature_type NOT NULL,
    prompt_tokens INT NOT NULL DEFAULT 0,
    completion_tokens INT NOT NULL DEFAULT 0,
    latency_ms INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_user ON public.ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_logs(created_at DESC);

-- 11. SUBSCRIPTION_PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan user_plan_type NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    payment_type payment_method NOT NULL DEFAULT 'midtrans',
    proof_image_url TEXT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    midtrans_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.subscription_payments(order_id);

-- 12. EXPORT_HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.export_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'xlsx')),
    date_range TEXT NOT NULL,
    file_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_export_history_user ON public.export_history(user_id);

-- 13. AUDIT_LOGS TABLE (For Admin transaction data access & impersonation)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.audit_logs(target_user_id);

-- 14. VERIFICATION_CODES TABLE (Dual OTP)
CREATE TABLE IF NOT EXISTS public.verification_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_verification_phone ON public.verification_codes(phone_number);

-- 15. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for Wallets
CREATE POLICY "Users can manage own wallets" ON public.wallets FOR ALL USING (auth.uid() = user_id);

-- Policies for Categories
CREATE POLICY "Users can manage own categories" ON public.categories FOR ALL USING (auth.uid() = user_id);

-- Policies for Transactions
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);

-- Policies for Transaction Items
CREATE POLICY "Users can view transaction items" ON public.transaction_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.transactions WHERE id = transaction_items.transaction_id AND user_id = auth.uid())
);

-- Policies for Payments
CREATE POLICY "Users can view own payments" ON public.subscription_payments FOR SELECT USING (auth.uid() = user_id);

-- Policies for Export History
CREATE POLICY "Users can view own export history" ON public.export_history FOR SELECT USING (auth.uid() = user_id);

-- Superadmin bypass policies
CREATE POLICY "Superadmins can manage everything" ON public.profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'superadmin')
);
