-- SOLOFIN — başlangıç şeması
-- Tüm parasal tutarlar kuruş (bigint) olarak saklanır.
-- Her kullanıcı tablosunda Row Level Security etkindir; kullanıcı yalnızca kendi satırlarına erişir.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- app_settings
create table public.app_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  currency text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR', 'GBP')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  locale text not null default 'tr',
  cash_balance bigint not null default 0,
  monthly_personal_spend bigint not null default 0 check (monthly_personal_spend >= 0),
  emergency_months smallint not null default 6 check (emergency_months between 0 and 24),
  safety_buffer bigint not null default 0 check (safety_buffer >= 0),
  notifications jsonb not null default '{"upcomingPayments": true, "taxReminders": true, "weeklySummary": false}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- tax_rule_versions (herkese okunur, yalnızca servis rolü yazar)
create table public.tax_rule_versions (
  id text primary key,                       -- ör. 'TR-2026-v1'
  country char(2) not null,
  tax_year smallint not null,
  rules jsonb not null,                      -- dilimler, oranlar, eşikler
  source text not null,
  source_url text,
  effective_from date not null,
  effective_to date,
  last_verified_at date,
  verification text not null check (verification in ('official', 'secondary', 'unverified')),
  created_at timestamptz not null default now(),
  unique (country, tax_year, id)
);

-- ---------------------------------------------------------------- tax_profiles
create table public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  country char(2) not null default 'TR',
  tax_year smallint not null,
  taxpayer_type text not null check (taxpayer_type in ('serbest_meslek', 'ticari_bilanco', 'ticari_isletme')),
  rule_version_id text references public.tax_rule_versions (id),
  deduct_social_security boolean not null default true,
  young_entrepreneur boolean not null default false,
  provisional_tax_paid bigint not null default 0 check (provisional_tax_paid >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, tax_year)
);

-- ---------------------------------------------------------------- recurring_items
create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  label text not null check (char_length(label) between 1 and 80),
  category text not null,
  amount bigint not null check (amount > 0),
  recurrence text not null check (recurrence in ('monthly', 'quarterly', 'yearly')),
  day_of_month smallint not null check (day_of_month between 1 and 28),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,                -- Supabase Storage yolu: <user_id>/<dosya>
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  extracted jsonb,                           -- OCR/AI ile çıkarılan alanlar (kullanıcı onayı bekler)
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/%')
);

-- ---------------------------------------------------------------- işlemler (gelir ve gider ayrı tablolar)
create table public.income_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tx_date date not null,
  due_date date,
  amount bigint not null check (amount > 0),         -- KDV hariç, kuruş
  currency text not null default 'TRY',
  vat_rate numeric(4, 3) not null default 0.2 check (vat_rate between 0 and 1),
  withholding_rate numeric(4, 3) not null default 0 check (withholding_rate between 0 and 1),
  category text not null,
  counterparty text not null default '' check (char_length(counterparty) <= 120),
  description text not null default '' check (char_length(description) <= 200),
  status text not null check (status in ('paid', 'pending', 'overdue')),
  document_id uuid references public.documents (id) on delete set null,
  document_ref text,
  recurring_id uuid references public.recurring_items (id) on delete set null,
  source text not null default 'user' check (source in ('user', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expense_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tx_date date not null,
  due_date date,
  amount bigint not null check (amount > 0),
  currency text not null default 'TRY',
  vat_rate numeric(4, 3) not null default 0.2 check (vat_rate between 0 and 1),
  category text not null,
  counterparty text not null default '' check (char_length(counterparty) <= 120),
  description text not null default '' check (char_length(description) <= 200),
  status text not null check (status in ('paid', 'pending', 'overdue')),
  -- Vergisel sınıflandırma, kullanıcı kategorisinden ayrı tutulur
  deductibility text not null default 'unknown'
    check (deductibility in ('unknown', 'assumed_deductible', 'confirmed_deductible', 'non_deductible')),
  document_id uuid references public.documents (id) on delete set null,
  document_ref text,
  recurring_id uuid references public.recurring_items (id) on delete set null,
  source text not null default 'user' check (source in ('user', 'import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index income_user_date_idx on public.income_transactions (user_id, tx_date desc);
create index expense_user_date_idx on public.expense_transactions (user_id, tx_date desc);

-- ---------------------------------------------------------------- scenarios
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  levers jsonb not null,
  created_at timestamptz not null default now()
);

create table public.scenario_results (
  id uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.scenarios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_version_id text references public.tax_rule_versions (id),
  computed_at timestamptz not null default now(),
  result jsonb not null                      -- motorun deterministik çıktısı (önbellek / rapor)
);

-- ---------------------------------------------------------------- financial_goals
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('retirement', 'emergency_fund', 'custom')),
  params jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- Row Level Security
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.tax_rule_versions enable row level security;
alter table public.tax_profiles enable row level security;
alter table public.recurring_items enable row level security;
alter table public.documents enable row level security;
alter table public.income_transactions enable row level security;
alter table public.expense_transactions enable row level security;
alter table public.scenarios enable row level security;
alter table public.scenario_results enable row level security;
alter table public.financial_goals enable row level security;

create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "app_settings_own" on public.app_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tax_profiles_own" on public.tax_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recurring_items_own" on public.recurring_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "documents_own" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "income_transactions_own" on public.income_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expense_transactions_own" on public.expense_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "scenarios_own" on public.scenarios
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "scenario_results_own" on public.scenario_results
  for all using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (select 1 from public.scenarios s where s.id = scenario_id and s.user_id = auth.uid())
  );

create policy "financial_goals_own" on public.financial_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Vergi kuralları: oturum açmış herkes okuyabilir; yazma yalnızca servis rolüyle (RLS politikası yok = reddedilir)
create policy "tax_rule_versions_read" on public.tax_rule_versions
  for select to authenticated using (true);

-- ---------------------------------------------------------------- updated_at tetikleyicisi
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_income before update on public.income_transactions for each row execute function public.touch_updated_at();
create trigger touch_expense before update on public.expense_transactions for each row execute function public.touch_updated_at();
create trigger touch_tax_profiles before update on public.tax_profiles for each row execute function public.touch_updated_at();
create trigger touch_goals before update on public.financial_goals for each row execute function public.touch_updated_at();
