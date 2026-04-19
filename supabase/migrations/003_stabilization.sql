-- ═══════════════════════════════════════════════════════════════════════════
-- STABILIZATION MIGRATION v3
-- Uygulama tarihi: 18 Nisan 2026
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. visits: ended_via_qr kolonu ──────────────────────────────────────────
ALTER TABLE visits ADD COLUMN IF NOT EXISTS ended_via_qr boolean NOT NULL DEFAULT false;

-- ─── 2. visits: tek aktif ziyaret constraint (partial unique index) ───────────
-- Aynı personel aynı anda sadece 1 aktif ziyaret açabilir
CREATE UNIQUE INDEX IF NOT EXISTS visits_one_active_per_personnel
  ON visits (personnel_id)
  WHERE status = 'active';

-- ─── 3. firm_assignments: unique constraint (zaten var, IF NOT EXISTS ile) ───
-- Aynı personel aynı firmaya 2 kez atanamaz
-- (Migration 001'de UNIQUE(firm_id, personnel_id) zaten tanımlı)

-- ─── 4. activity_logs tablosu ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       text,
  meta            jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_logs_org_idx  ON activity_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON activity_logs(user_id, created_at DESC);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select_org" ON activity_logs
  FOR SELECT TO authenticated
  USING (organization_id = my_org_id());

CREATE POLICY "activity_logs_insert_org" ON activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = my_org_id());

-- ─── 5. Eski {public} policy temizliği ───────────────────────────────────────
-- NOT: Bu DROP'lar Supabase Management API üzerinden çalıştırılmalı.
-- Tool kısıtlaması nedeniyle _v2 policy'ler aktif, eskiler zararsız durumda.
-- Supabase Dashboard > SQL Editor'da çalıştırın:

-- DROP POLICY IF EXISTS "dof_delete" ON dof_records;
-- DROP POLICY IF EXISTS "dof_insert" ON dof_records;
-- DROP POLICY IF EXISTS "dof_select" ON dof_records;
-- DROP POLICY IF EXISTS "dof_update" ON dof_records;
-- DROP POLICY IF EXISTS "fa_delete" ON firm_assignments;
-- DROP POLICY IF EXISTS "fa_insert" ON firm_assignments;
-- DROP POLICY IF EXISTS "fa_select_admin" ON firm_assignments;
-- DROP POLICY IF EXISTS "fa_select_own" ON firm_assignments;
-- DROP POLICY IF EXISTS "firms_delete" ON firms;
-- DROP POLICY IF EXISTS "firms_insert" ON firms;
-- DROP POLICY IF EXISTS "firms_select_admin" ON firms;
-- DROP POLICY IF EXISTS "firms_select_personnel" ON firms;
-- DROP POLICY IF EXISTS "firms_update" ON firms;
-- DROP POLICY IF EXISTS "org_select" ON organizations;
-- DROP POLICY IF EXISTS "org_update" ON organizations;
-- DROP POLICY IF EXISTS "profiles_insert_service" ON profiles;
-- DROP POLICY IF EXISTS "profiles_select" ON profiles;
-- DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
-- DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
-- DROP POLICY IF EXISTS "reports_delete" ON reports;
-- DROP POLICY IF EXISTS "reports_insert" ON reports;
-- DROP POLICY IF EXISTS "reports_select_admin" ON reports;
-- DROP POLICY IF EXISTS "reports_select_own" ON reports;
-- DROP POLICY IF EXISTS "visits_delete" ON visits;
-- DROP POLICY IF EXISTS "visits_insert" ON visits;
-- DROP POLICY IF EXISTS "visits_select_admin" ON visits;
-- DROP POLICY IF EXISTS "visits_select_own" ON visits;
-- DROP POLICY IF EXISTS "visits_update_admin" ON visits;
-- DROP POLICY IF EXISTS "visits_update_own" ON visits;
