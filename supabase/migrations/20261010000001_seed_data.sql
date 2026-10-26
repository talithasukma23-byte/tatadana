-- ====================================================================
-- TataDana Seed Data & Default Settings
-- Supabase Postgres Migration
-- ====================================================================

-- 1. SEED DEFAULT AI PROVIDERS
INSERT INTO public.ai_providers (id, name, display_name, api_key, is_active, priority, model_name, mode)
VALUES 
    (gen_random_uuid(), 'gemini', 'Google Gemini 1.5 Flash / Pro', 'GEMINI_API_KEY_PLACEHOLDER', TRUE, 1, 'gemini-1.5-flash', 'parallel_failover'),
    (gen_random_uuid(), 'openai', 'OpenAI GPT-4o mini', 'OPENAI_API_KEY_PLACEHOLDER', TRUE, 2, 'gpt-4o-mini', 'parallel_failover'),
    (gen_random_uuid(), 'deepseek', 'DeepSeek V3 / Chat', 'DEEPSEEK_API_KEY_PLACEHOLDER', TRUE, 3, 'deepseek-chat', 'parallel_failover')
ON CONFLICT (name) DO NOTHING;

-- 2. FUNCTION: Onboard New User Structure
-- Called automatically upon user registration to create default wallets and AI-recommended categories
CREATE OR REPLACE FUNCTION public.handle_new_user_onboarding(new_user_id UUID, user_name TEXT, user_phone TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Insert default wallets
    INSERT INTO public.wallets (user_id, name, balance, icon, is_default)
    VALUES 
        (new_user_id, 'Tunai (Cash)', 500000.00, '💵', TRUE),
        (new_user_id, 'BCA', 2500000.00, '🏦', FALSE),
        (new_user_id, 'GoPay / OVO', 350000.00, '📱', FALSE);

    -- 2. Insert recommended default categories
    INSERT INTO public.categories (user_id, name, type, emoji, color, monthly_budget)
    VALUES 
        (new_user_id, 'Makanan & Minuman', 'expense', '🍜', '#F97316', 1500000.00),
        (new_user_id, 'Transportasi', 'expense', '🚗', '#FB923C', 500000.00),
        (new_user_id, 'Tagihan & Utilitas', 'expense', '🏠', '#EA580C', 800000.00),
        (new_user_id, 'Belanja Kebutuhan', 'expense', '👕', '#FDBA74', 600000.00),
        (new_user_id, 'Hiburan & Santai', 'expense', '🎮', '#C2410C', 400000.00),
        (new_user_id, 'Kesehatan & Obat', 'expense', '💊', '#FB923C', 300000.00),
        (new_user_id, 'Gaji Utama', 'income', '💰', '#10B981', 0.00),
        (new_user_id, 'Freelance / Bisnis', 'income', '💼', '#34D399', 0.00),
        (new_user_id, 'Investasi & Lainnya', 'income', '📈', '#059669', 0.00);

    -- 3. Insert initial welcome transaction
    INSERT INTO public.transactions (user_id, wallet_id, type, amount, notes, transaction_date, source)
    SELECT new_user_id, id, 'income', 3350000.00, 'Saldo Awal TataDana', (now() AT TIME ZONE 'Asia/Jakarta'), 'web_manual'
    FROM public.wallets 
    WHERE user_id = new_user_id AND is_default = TRUE
    LIMIT 1;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
