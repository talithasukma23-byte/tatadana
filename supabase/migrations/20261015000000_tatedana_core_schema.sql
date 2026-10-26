-- ====================================================================
-- TataDana Comprehensive Production Database Schema
-- Supabase PostgreSQL Migration
-- Timezone: Asia/Jakarta (WIB)
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & DOMAIN TYPES
DO $$ BEGIN
    CREATE TYPE user_plan_type AS ENUM ('starter', 'pro');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wallet_type AS ENUM ('Cash', 'Bank', 'E-Wallet', 'Investasi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE transaction_type_enum AS ENUM ('income', 'expense', 'transfer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE budget_period_type AS ENUM ('daily', 'weekly', 'monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_approval_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_role_type AS ENUM ('user', 'assistant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TRIGGER FUNCTION: UPDATED_AT WIB
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = (now() AT TIME ZONE 'Asia/Jakarta');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. TABEL PROFIL & PENGGUNA (users / profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT NOT NULL DEFAULT 'Pengguna TataDana',
    phone_number TEXT UNIQUE,
    avatar_url TEXT,
    plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro')),
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'superadmin')),
    timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    currency TEXT NOT NULL DEFAULT 'IDR',
    telegram_chat_id BIGINT UNIQUE,
    telegram_token_encrypted TEXT,
    telegram_connected BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_connected_at TIMESTAMPTZ,
    daily_reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_frequency INT NOT NULL DEFAULT 1 CHECK (reminder_frequency IN (1, 2)),
    reminder_time_1 TIME NOT NULL DEFAULT '20:00:00',
    reminder_time_2 TIME NOT NULL DEFAULT '12:00:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_telegram ON public.profiles(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. TABEL DOMPET (wallets) - Multi-Wallet Support
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Cash' CHECK (type IN ('Cash', 'Bank', 'E-Wallet', 'Investasi')),
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    color TEXT NOT NULL DEFAULT '#F97316',
    icon TEXT NOT NULL DEFAULT '👛',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_type ON public.wallets(type);

-- Constraint: Maksimal 1 dompet default per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_one_default_per_user 
ON public.wallets (user_id) WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 6. TABEL KATEGORI (categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL jika kategori sistem bawaan
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    emoji TEXT NOT NULL DEFAULT '🏷️',
    color TEXT NOT NULL DEFAULT '#F97316',
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(type);
CREATE INDEX IF NOT EXISTS idx_categories_is_custom ON public.categories(is_custom);

-- 7. TABEL BUDGET (budgets) - Harian + Mingguan + Bulanan
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    UNIQUE (user_id, category_id, period_type)
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON public.budgets(category_id);

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON public.budgets;
CREATE TRIGGER trg_budgets_updated_at
BEFORE UPDATE ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Constraint Trigger: Starter maksimal 5 budget per user
CREATE OR REPLACE FUNCTION public.check_starter_budget_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_user_plan TEXT;
    existing_budget_count INT;
BEGIN
    SELECT plan INTO current_user_plan FROM public.profiles WHERE id = NEW.user_id;
    
    IF current_user_plan = 'starter' THEN
        SELECT COUNT(*) INTO existing_budget_count 
        FROM public.budgets 
        WHERE user_id = NEW.user_id;

        IF existing_budget_count >= 5 THEN
            RAISE EXCEPTION 'Pengguna paket Starter dibatasi maksimal 5 budget per kategori. Silakan upgrade ke paket Pro untuk unlimited budget.'
            USING ERRCODE = 'P0001';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_starter_budget_limit ON public.budgets;
CREATE TRIGGER trg_check_starter_budget_limit
BEFORE INSERT ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.check_starter_budget_limit();

-- 8. TABEL TRANSAKSI (transactions)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta'),
    is_receipt BOOLEAN NOT NULL DEFAULT FALSE,
    receipt_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    transfer_to_wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    raw_receipt_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON public.transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

-- 9. TABEL TELEGRAM WEBHOOK LOGS & IDEMPOTENCY (telegram_webhook_logs)
CREATE TABLE IF NOT EXISTS public.telegram_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id BIGINT NOT NULL UNIQUE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_telegram_logs_update_id ON public.telegram_webhook_logs(update_id);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_user ON public.telegram_webhook_logs(user_id);

-- 10. TABEL RIWAYAT CHAT TATA AI (ai_chat_history)
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON public.ai_chat_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_created_at ON public.ai_chat_history(created_at DESC);

-- 11. TABEL PEMBAYARAN & ADMIN (payment_approvals & admin_audit_logs)
CREATE TABLE IF NOT EXISTS public.payment_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    proof_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    plan_target TEXT NOT NULL DEFAULT 'pro' CHECK (plan_target IN ('starter', 'pro')),
    order_id TEXT UNIQUE,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_payment_approvals_user ON public.payment_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_status ON public.payment_approvals(status);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Jakarta')
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.admin_audit_logs(target_user_id);

-- 12. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: User hanya bisa membaca & memperbarui profilnya sendiri
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles 
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles 
FOR UPDATE USING (auth.uid() = id);

-- Wallets: User hanya bisa mengakses dompet miliknya sendiri
DROP POLICY IF EXISTS "Users can manage own wallets" ON public.wallets;
CREATE POLICY "Users can manage own wallets" ON public.wallets 
FOR ALL USING (auth.uid() = user_id);

-- Categories: User bisa melihat kategori sistem (user_id IS NULL) dan kategori custom miliknya
DROP POLICY IF EXISTS "Users can view system and own categories" ON public.categories;
CREATE POLICY "Users can view system and own categories" ON public.categories 
FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
CREATE POLICY "Users can insert own categories" ON public.categories 
FOR INSERT WITH CHECK (auth.uid() = user_id AND is_custom = TRUE);

DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
CREATE POLICY "Users can update own categories" ON public.categories 
FOR UPDATE USING (auth.uid() = user_id AND is_custom = TRUE);

DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can delete own categories" ON public.categories 
FOR DELETE USING (auth.uid() = user_id AND is_custom = TRUE);

-- Budgets: User hanya bisa mengelola budget miliknya sendiri
DROP POLICY IF EXISTS "Users can manage own budgets" ON public.budgets;
CREATE POLICY "Users can manage own budgets" ON public.budgets 
FOR ALL USING (auth.uid() = user_id);

-- Transactions: User hanya bisa mengelola transaksi miliknya sendiri
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;
CREATE POLICY "Users can manage own transactions" ON public.transactions 
FOR ALL USING (auth.uid() = user_id);

-- AI Chat History: User hanya bisa melihat dan mengelola riwayat chat miliknya
DROP POLICY IF EXISTS "Users can manage own chat history" ON public.ai_chat_history;
CREATE POLICY "Users can manage own chat history" ON public.ai_chat_history 
FOR ALL USING (auth.uid() = user_id);

-- Payment Approvals: User bisa melihat riwayat pembayaran miliknya, insert pembayaran baru
DROP POLICY IF EXISTS "Users can view own payment approvals" ON public.payment_approvals;
CREATE POLICY "Users can view own payment approvals" ON public.payment_approvals 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can request payment approval" ON public.payment_approvals;
CREATE POLICY "Users can request payment approval" ON public.payment_approvals 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Superadmin Bypass Policies untuk semua tabel
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'superadmin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Superadmin full access to profiles" ON public.profiles;
CREATE POLICY "Superadmin full access to profiles" ON public.profiles 
FOR ALL USING (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin full access to payments" ON public.payment_approvals;
CREATE POLICY "Superadmin full access to payments" ON public.payment_approvals 
FOR ALL USING (public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin full access to audit logs" ON public.admin_audit_logs;
CREATE POLICY "Superadmin full access to audit logs" ON public.admin_audit_logs 
FOR ALL USING (public.is_superadmin());

-- 13. SEED DEFAULT SYSTEM CATEGORIES (user_id IS NULL)
INSERT INTO public.categories (id, user_id, name, type, emoji, color, is_custom)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', NULL, 'Makanan & Minuman', 'expense', '🍜', '#F97316', FALSE),
    ('c0000000-0000-0000-0000-000000000002', NULL, 'Transportasi', 'expense', '🚗', '#FB923C', FALSE),
    ('c0000000-0000-0000-0000-000000000003', NULL, 'Tagihan & Utilitas', 'expense', '🏠', '#EA580C', FALSE),
    ('c0000000-0000-0000-0000-000000000004', NULL, 'Belanja Kebutuhan', 'expense', '🛒', '#FDBA74', FALSE),
    ('c0000000-0000-0000-0000-000000000005', NULL, 'Hiburan & Ngopi', 'expense', '☕', '#C2410C', FALSE),
    ('c0000000-0000-0000-0000-000000000006', NULL, 'Kesehatan & Obat', 'expense', '💊', '#FB923C', FALSE),
    ('c0000000-0000-0000-0000-000000000007', NULL, 'Gaji Utama', 'income', '💰', '#10B981', FALSE),
    ('c0000000-0000-0000-0000-000000000008', NULL, 'Freelance & Bonus', 'income', '💼', '#34D399', FALSE),
    ('c0000000-0000-0000-0000-000000000009', NULL, 'Investasi & Passive', 'income', '📈', '#059669', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 14. AUTH HOOK: OTOMATIS ONBOARDING USER BARU
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
DECLARE
    new_wallet_id UUID;
BEGIN
    -- 1. Insert Profile
    INSERT INTO public.profiles (id, email, full_name, phone_number, plan, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Pengguna TataDana'),
        NEW.raw_user_meta_data->>'phone_number',
        'starter',
        'user'
    );

    -- 2. Insert Default Wallets (Tunai default, BCA, GoPay)
    INSERT INTO public.wallets (user_id, name, type, balance, icon, color, is_default)
    VALUES (NEW.id, 'Tunai (Cash)', 'Cash', 0.00, '💵', '#10B981', TRUE)
    RETURNING id INTO new_wallet_id;

    INSERT INTO public.wallets (user_id, name, type, balance, icon, color, is_default)
    VALUES 
        (NEW.id, 'BCA', 'Bank', 0.00, '🏦', '#3B82F6', FALSE),
        (NEW.id, 'GoPay / OVO', 'E-Wallet', 0.00, '📱', '#06B6D4', FALSE);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_created();
