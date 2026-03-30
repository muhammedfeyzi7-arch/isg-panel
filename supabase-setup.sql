-- ============================================================
-- ISG Denetim — Supabase Entity Tables Setup
-- Run this in Supabase SQL Editor: https://app.supabase.com
-- ============================================================

-- Helper function to create entity tables
CREATE OR REPLACE FUNCTION create_entity_table(tbl TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I (
      id            TEXT PRIMARY KEY,
      user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      organization_id UUID NOT NULL,
      data          JSONB NOT NULL DEFAULT ''{}''::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS %I ON %I (user_id, organization_id);
    CREATE INDEX IF NOT EXISTS %I ON %I (organization_id);
  ',
    tbl,
    tbl || '_user_org_idx', tbl,
    tbl || '_org_idx', tbl
  );
END;
$$ LANGUAGE plpgsql;

-- Create all entity tables
SELECT create_entity_table('firmalar');
SELECT create_entity_table('personeller');
SELECT create_entity_table('evraklar');
SELECT create_entity_table('egitimler');
SELECT create_entity_table('muayeneler');
SELECT create_entity_table('uygunsuzluklar');
SELECT create_entity_table('ekipmanlar');
SELECT create_entity_table('gorevler');
SELECT create_entity_table('tutanaklar');

-- Drop helper function
DROP FUNCTION IF EXISTS create_entity_table(TEXT);

-- ============================================================
-- Enable Row Level Security
-- ============================================================
ALTER TABLE firmalar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE personeller     ENABLE ROW LEVEL SECURITY;
ALTER TABLE evraklar        ENABLE ROW LEVEL SECURITY;
ALTER TABLE egitimler       ENABLE ROW LEVEL SECURITY;
ALTER TABLE muayeneler      ENABLE ROW LEVEL SECURITY;
ALTER TABLE uygunsuzluklar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekipmanlar      ENABLE ROW LEVEL SECURITY;
ALTER TABLE gorevler        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutanaklar      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies — Users can only access their own org's data
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['firmalar','personeller','evraklar','egitimler','muayeneler','uygunsuzluklar','ekipmanlar','gorevler','tutanaklar'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- DROP existing policies to avoid duplicates
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own org data" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_own" ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_own" ON %I', tbl);

    -- SELECT: user must own the org membership
    EXECUTE format('
      CREATE POLICY "select_own" ON %I FOR SELECT
      USING (
        auth.uid() = user_id
        AND organization_id IN (
          SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
        )
      )
    ', tbl);

    -- INSERT
    EXECUTE format('
      CREATE POLICY "insert_own" ON %I FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND organization_id IN (
          SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
        )
      )
    ', tbl);

    -- UPDATE
    EXECUTE format('
      CREATE POLICY "update_own" ON %I FOR UPDATE
      USING (
        auth.uid() = user_id
        AND organization_id IN (
          SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
        )
      )
    ', tbl);

    -- DELETE
    EXECUTE format('
      CREATE POLICY "delete_own" ON %I FOR DELETE
      USING (
        auth.uid() = user_id
        AND organization_id IN (
          SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
        )
      )
    ', tbl);
  END LOOP;
END $$;

-- ============================================================
-- Verify setup
-- ============================================================
SELECT
  t.table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS col_count,
  obj_description(pgc.oid, 'pg_class') AS description
FROM information_schema.tables t
LEFT JOIN pg_class pgc ON pgc.relname = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN ('firmalar','personeller','evraklar','egitimler','muayeneler','uygunsuzluklar','ekipmanlar','gorevler','tutanaklar')
ORDER BY t.table_name;
