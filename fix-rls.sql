-- ============================================================
-- ISG Denetim — RLS FIX SCRIPT
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql
--
-- ROOT CAUSE: Old SELECT policies used "auth.uid() = user_id"
-- which blocked org members from seeing each other's records.
-- FIX: SELECT now allows ANY org member to read ALL org data.
-- INSERT/UPDATE/DELETE still properly scoped.
-- ============================================================

-- ── 1. FIX ENTITY TABLE POLICIES ──────────────────────────────
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'firmalar','personeller','evraklar','egitimler',
    'muayeneler','uygunsuzluklar','ekipmanlar',
    'gorevler','tutanaklar','is_izinleri'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Remove all old policies
    EXECUTE format('DROP POLICY IF EXISTS "select_own"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_own"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_own"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_org"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_org"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_org"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_org"       ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own org data" ON %I', tbl);

    -- SELECT: ANY member of the organization can read all org rows
    -- Removed "auth.uid() = user_id" - this was the bug blocking shared data
    EXECUTE format('
      CREATE POLICY "select_org" ON %I FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id
          FROM user_organizations
          WHERE user_id = auth.uid()
            AND is_active = true
        )
      )
    ', tbl);

    -- INSERT: user can insert into their org, must use their own user_id
    EXECUTE format('
      CREATE POLICY "insert_org" ON %I FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND organization_id IN (
          SELECT organization_id
          FROM user_organizations
          WHERE user_id = auth.uid()
            AND is_active = true
        )
      )
    ', tbl);

    -- UPDATE: any active org member can update org records
    EXECUTE format('
      CREATE POLICY "update_org" ON %I FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id
          FROM user_organizations
          WHERE user_id = auth.uid()
            AND is_active = true
        )
      )
    ', tbl);

    -- DELETE: any active org member can delete org records
    EXECUTE format('
      CREATE POLICY "delete_org" ON %I FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id
          FROM user_organizations
          WHERE user_id = auth.uid()
            AND is_active = true
        )
      )
    ', tbl);
  END LOOP;
END $$;

-- ── 2. FIX user_organizations TABLE RLS ──────────────────────
-- Ensure users can only read their own org memberships
-- (This fixes the autoCreateOrg duplicate org bug on different devices)

ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_org_select" ON user_organizations;
DROP POLICY IF EXISTS "users_own_org_insert" ON user_organizations;
DROP POLICY IF EXISTS "users_own_org_update" ON user_organizations;

-- Users can read their own membership rows
CREATE POLICY "users_own_org_select" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own membership (for join via invite code)
CREATE POLICY "users_own_org_insert" ON user_organizations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own membership (for clearMustChangePassword etc.)
CREATE POLICY "users_own_org_update" ON user_organizations
  FOR UPDATE USING (user_id = auth.uid());

-- Admins in the same org can also SELECT (to list members)
DROP POLICY IF EXISTS "admin_select_org_members" ON user_organizations;
CREATE POLICY "admin_select_org_members" ON user_organizations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 3. FIX organizations TABLE RLS ───────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_member_select" ON organizations;
DROP POLICY IF EXISTS "org_creator_insert" ON organizations;
DROP POLICY IF EXISTS "org_admin_update" ON organizations;

CREATE POLICY "org_member_select" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_creator_insert" ON organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "org_admin_update" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 4. ENSURE is_izinleri TABLE EXISTS WITH RLS ──────────────
CREATE TABLE IF NOT EXISTS is_izinleri (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS is_izinleri_user_org_idx ON is_izinleri (user_id, organization_id);
CREATE INDEX IF NOT EXISTS is_izinleri_org_idx ON is_izinleri (organization_id);

ALTER TABLE is_izinleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own" ON is_izinleri;
DROP POLICY IF EXISTS "insert_own" ON is_izinleri;
DROP POLICY IF EXISTS "update_own" ON is_izinleri;
DROP POLICY IF EXISTS "delete_own" ON is_izinleri;
DROP POLICY IF EXISTS "select_org" ON is_izinleri;
DROP POLICY IF EXISTS "insert_org" ON is_izinleri;
DROP POLICY IF EXISTS "update_org" ON is_izinleri;
DROP POLICY IF EXISTS "delete_org" ON is_izinleri;

CREATE POLICY "select_org" ON is_izinleri FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "insert_org" ON is_izinleri FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "update_org" ON is_izinleri FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "delete_org" ON is_izinleri FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid() AND is_active = true
  ));

-- ── 5. ENSURE activity_logs TABLE RLS ───────────────────────
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "al_select_org" ON activity_logs;
DROP POLICY IF EXISTS "al_insert_own" ON activity_logs;

CREATE POLICY "al_select_org" ON activity_logs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
  ));

CREATE POLICY "al_insert_own" ON activity_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── 6. VERIFY: List all policies ─────────────────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'firmalar','personeller','evraklar','egitimler',
    'muayeneler','uygunsuzluklar','ekipmanlar',
    'gorevler','tutanaklar','is_izinleri',
    'user_organizations','organizations','activity_logs'
  )
ORDER BY tablename, cmd;
