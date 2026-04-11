-- ═══════════════════════════════════════════════════
-- ROL BAZLI RLS — Supabase SQL Editor'da çalıştırın
-- ═══════════════════════════════════════════════════

-- ── 1. can_access_firm helper ──
CREATE OR REPLACE FUNCTION can_access_firm(firm_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_organizations
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (
        organization_id = firm_id
        OR (active_firm_ids IS NOT NULL AND firm_id = ANY(active_firm_ids))
      )
  );
$$;

-- ── 2. get_my_osgb_role helper ──
CREATE OR REPLACE FUNCTION get_my_osgb_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT osgb_role FROM user_organizations
  WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- ── 3. personeller RLS ──
ALTER TABLE personeller ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personeller_select_by_firm" ON personeller;
CREATE POLICY "personeller_select_by_firm" ON personeller
  FOR SELECT USING (can_access_firm(organization_id));

DROP POLICY IF EXISTS "personeller_update_admin_uzman" ON personeller;
CREATE POLICY "personeller_update_admin_uzman" ON personeller
  FOR UPDATE USING (
    can_access_firm(organization_id)
    AND get_my_osgb_role() IN ('osgb_admin', 'gezici_uzman')
  );

-- hekim sadece sağlık alanlarını güncelleyebilir (app_data JSON üzerinden kontrol frontend'de)
DROP POLICY IF EXISTS "personeller_update_hekim" ON personeller;
CREATE POLICY "personeller_update_hekim" ON personeller
  FOR UPDATE USING (
    can_access_firm(organization_id)
    AND get_my_osgb_role() = 'isyeri_hekimi'
  );

-- ── 4. osgb_ziyaretler RLS ──
ALTER TABLE osgb_ziyaretler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ziyaretler_select" ON osgb_ziyaretler;
CREATE POLICY "ziyaretler_select" ON osgb_ziyaretler
  FOR SELECT USING (
    get_my_osgb_role() = 'osgb_admin'
    OR can_access_firm(firma_id)
  );

DROP POLICY IF EXISTS "ziyaretler_insert" ON osgb_ziyaretler;
CREATE POLICY "ziyaretler_insert" ON osgb_ziyaretler
  FOR INSERT WITH CHECK (
    get_my_osgb_role() IN ('gezici_uzman', 'isyeri_hekimi')
    AND can_access_firm(firma_id)
  );

DROP POLICY IF EXISTS "ziyaretler_update_own" ON osgb_ziyaretler;
CREATE POLICY "ziyaretler_update_own" ON osgb_ziyaretler
  FOR UPDATE USING (
    uzman_id = auth.uid()
    AND can_access_firm(firma_id)
  );
