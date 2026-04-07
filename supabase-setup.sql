-- ============================================================
-- ISG Denetim — Supabase Full Setup Script
-- Run this in Supabase SQL Editor: https://app.supabase.com
-- ============================================================

-- ── 1. ENTITY TABLE CREATION ──────────────────────────────────
CREATE OR REPLACE FUNCTION create_entity_table(tbl TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id              TEXT PRIMARY KEY,
      user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      data            JSONB NOT NULL DEFAULT ''{}''::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS %I ON %I (user_id, organization_id);
    CREATE INDEX IF NOT EXISTS %I ON %I (organization_id);
  ',
    tbl,
    tbl || ''_user_org_idx'', tbl,
    tbl || ''_org_idx'', tbl
  );
END;
$$ LANGUAGE plpgsql;

SELECT create_entity_table(''firmalar'');
SELECT create_entity_table(''personeller'');
SELECT create_entity_table(''evraklar'');
SELECT create_entity_table(''egitimler'');
SELECT create_entity_table(''muayeneler'');
SELECT create_entity_table(''uygunsuzluklar'');
SELECT create_entity_table(''ekipmanlar'');
SELECT create_entity_table(''gorevler'');
SELECT create_entity_table(''tutanaklar'');
SELECT create_entity_table(''is_izinleri'');

DROP FUNCTION IF EXISTS create_entity_table(TEXT);

-- ── 2. ENABLE RLS ─────────────────────────────────────────────
ALTER TABLE firmalar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE personeller     ENABLE ROW LEVEL SECURITY;
ALTER TABLE evraklar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE egitimler       ENABLE ROW LEVEL SECURITY;
ALTER TABLE muayeneler      ENABLE ROW LEVEL SECURITY;
ALTER TABLE uygunsuzluklar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekipmanlar      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorevler        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutanaklar      ENABLE ROW LEVEL SECURITY;
ALTER TABLE is_izinleri     ENABLE ROW LEVEL SECURITY;

-- ── 3. ENTITY TABLE RLS POLICIES ──────────────────────────────
-- SELECT: Any ACTIVE member of the same organization can read all org data
-- INSERT: User must use their own user_id and be an active org member
-- UPDATE/DELETE: Any active org member can modify org records
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
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own org data" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_org" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_org" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_org" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_org" ON %I', tbl);

    -- SELECT: any active org member sees ALL org records (shared workspace)
    EXECUTE format('
      CREATE POLICY "select_org" ON %I FOR SELECT
      USING (
        organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    ', tbl);

    -- INSERT: active org member, must set own user_id
    EXECUTE format('
      CREATE POLICY "insert_org" ON %I FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    ', tbl);

    -- UPDATE: any active org member
    EXECUTE format('
      CREATE POLICY "update_org" ON %I FOR UPDATE
      USING (
        organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    ', tbl);

    -- DELETE: any active org member
    EXECUTE format('
      CREATE POLICY "delete_org" ON %I FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM user_organizations
          WHERE user_id = auth.uid() AND is_active = true
        )
      )
    ', tbl);
  END LOOP;
END $$;

-- ── 4. user_organizations TABLE RLS ───────────────────────────
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_org_select"    ON user_organizations;
DROP POLICY IF EXISTS "users_own_org_insert"    ON user_organizations;
DROP POLICY IF EXISTS "users_own_org_update"    ON user_organizations;
DROP POLICY IF EXISTS "admin_select_org_members" ON user_organizations;

-- Users can read their own membership rows
CREATE POLICY "users_own_org_select" ON user_organizations
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own membership (join via invite code / auto-create org)
CREATE POLICY "users_own_org_insert" ON user_organizations
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own membership (e.g., clearMustChangePassword)
CREATE POLICY "users_own_org_update" ON user_organizations
  FOR UPDATE USING (user_id = auth.uid());

-- Admins in same org can also SELECT all members (for Settings > User Management)
CREATE POLICY "admin_select_org_members" ON user_organizations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ── 5. organizations TABLE RLS ────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_member_select" ON organizations;
DROP POLICY IF EXISTS "org_creator_insert" ON organizations;
DROP POLICY IF EXISTS "org_admin_update"  ON organizations;

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

-- ── 6. activity_logs TABLE RLS ────────────────────────────────
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "al_select_org" ON activity_logs;
DROP POLICY IF EXISTS "al_insert_own" ON activity_logs;

CREATE POLICY "al_select_org" ON activity_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "al_insert_own" ON activity_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── 7. VERIFY ─────────────────────────────────────────────────
SELECT
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
