-- =============================================
-- Ziyaret RLS Düzeltmesi
-- Supabase Dashboard > SQL Editor'a yapıştır ve Run'a bas
-- =============================================

-- 1. Eski çakışan politikaları kaldır
DROP POLICY IF EXISTS uzman_insert ON osgb_ziyaretler;
DROP POLICY IF EXISTS ziyaretler_insert ON osgb_ziyaretler;
DROP POLICY IF EXISTS ziyaretler_select ON osgb_ziyaretler;
DROP POLICY IF EXISTS ziyaretler_update_own ON osgb_ziyaretler;
DROP POLICY IF EXISTS osgb_update ON osgb_ziyaretler;
DROP POLICY IF EXISTS osgb_members_select ON osgb_ziyaretler;
DROP POLICY IF EXISTS ziyaret_insert_uzman ON osgb_ziyaretler;
DROP POLICY IF EXISTS ziyaret_select_all ON osgb_ziyaretler;
DROP POLICY IF EXISTS ziyaret_update_own ON osgb_ziyaretler;

-- 2. INSERT: Gezici uzman veya işyeri hekimi ziyaret başlatabilir
CREATE POLICY ziyaret_insert_uzman ON osgb_ziyaretler
  FOR INSERT
  WITH CHECK (
    auth.uid() = uzman_user_id
    AND EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role IN ('gezici_uzman', 'isyeri_hekimi')
    )
  );

-- 3. SELECT: Kendi ziyareti VEYA aynı OSGB org'una üye olanlar görebilir
CREATE POLICY ziyaret_select_all ON osgb_ziyaretler
  FOR SELECT
  USING (
    uzman_user_id = auth.uid()
    OR
    osgb_org_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
    )
  );

-- 4. UPDATE: Kendi ziyaretini bitirebilir VEYA aynı org admin'i güncelleyebilir
CREATE POLICY ziyaret_update_own ON osgb_ziyaretler
  FOR UPDATE
  USING (
    uzman_user_id = auth.uid()
    OR
    osgb_org_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (osgb_role = 'osgb_admin' OR role IN ('admin', 'owner'))
    )
  );
