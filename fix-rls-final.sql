-- =====================================================
-- ADIM 1: Önce can_access_firm'i kullanan politikaları sil
-- =====================================================
DROP POLICY IF EXISTS "personeller_org_all" ON public.personeller;
DROP POLICY IF EXISTS "personeller_firma_user_insert" ON public.personeller;
DROP POLICY IF EXISTS "personeller_firma_user_select" ON public.personeller;
DROP POLICY IF EXISTS "personeller_firma_user_update" ON public.personeller;
DROP POLICY IF EXISTS "personeller_gezici_uzman_delete" ON public.personeller;
DROP POLICY IF EXISTS "personeller_gezici_uzman_insert" ON public.personeller;
DROP POLICY IF EXISTS "personeller_gezici_uzman_select" ON public.personeller;
DROP POLICY IF EXISTS "personeller_gezici_uzman_update" ON public.personeller;
DROP POLICY IF EXISTS "personeller_select_by_firm" ON public.personeller;
DROP POLICY IF EXISTS "personeller_update_admin_uzman" ON public.personeller;
DROP POLICY IF EXISTS "personeller_update_hekim" ON public.personeller;
DROP POLICY IF EXISTS "personeller_delete_policy" ON public.personeller;
DROP POLICY IF EXISTS "personeller_select" ON public.personeller;
DROP POLICY IF EXISTS "personeller_insert" ON public.personeller;
DROP POLICY IF EXISTS "personeller_update" ON public.personeller;
DROP POLICY IF EXISTS "personeller_delete" ON public.personeller;

-- =====================================================
-- ADIM 2: Diğer tablolardaki can_access_firm politikalarını da sil
-- =====================================================
DROP POLICY IF EXISTS "osgb_ziyaretler_select" ON public.osgb_ziyaretler;
DROP POLICY IF EXISTS "osgb_ziyaretler_insert" ON public.osgb_ziyaretler;
DROP POLICY IF EXISTS "osgb_ziyaretler_update" ON public.osgb_ziyaretler;

-- =====================================================
-- ADIM 3: can_access_firm fonksiyonunu DROP et ve yeniden oluştur
-- =====================================================
DROP FUNCTION IF EXISTS public.can_access_firm(uuid);

CREATE OR REPLACE FUNCTION public.can_access_firm(p_firm_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = auth.uid()
      AND is_active = true
      AND (
        organization_id = p_firm_id
        OR (active_firm_ids IS NOT NULL AND p_firm_id = ANY(active_firm_ids))
      )
  );
END;
$$;

-- =====================================================
-- ADIM 4: get_my_org_id'yi isyeri_hekimi destekli güncelle
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT active_firm_id
      FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role = 'gezici_uzman'
        AND active_firm_id IS NOT NULL
      LIMIT 1
    ),
    (
      SELECT active_firm_ids[1]
      FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role = 'gezici_uzman'
        AND active_firm_id IS NULL
        AND active_firm_ids IS NOT NULL
        AND cardinality(active_firm_ids) > 0
      LIMIT 1
    ),
    (
      SELECT active_firm_ids[1]
      FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role = 'isyeri_hekimi'
        AND active_firm_ids IS NOT NULL
        AND cardinality(active_firm_ids) > 0
      LIMIT 1
    ),
    (
      SELECT organization_id
      FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (osgb_role IS NULL OR osgb_role NOT IN ('gezici_uzman', 'isyeri_hekimi'))
      ORDER BY joined_at ASC
      LIMIT 1
    ),
    (
      SELECT organization_id
      FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
      ORDER BY joined_at ASC
      LIMIT 1
    )
  );
$$;

-- =====================================================
-- ADIM 5: Personeller politikalarını yeniden oluştur
-- =====================================================
CREATE POLICY "personeller_select" ON public.personeller
  FOR SELECT USING (
    (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'firma_user')
    OR
    (organization_id = public.get_my_org_id() AND public.get_my_role() = 'firma_user'
      AND (data ->> 'firmaId') = public.get_my_firm_id())
    OR
    public.can_access_firm(organization_id)
  );

CREATE POLICY "personeller_insert" ON public.personeller
  FOR INSERT WITH CHECK (
    (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'firma_user')
    OR
    (public.can_access_firm(organization_id) AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role IN ('gezici_uzman', 'isyeri_hekimi')
    ))
  );

CREATE POLICY "personeller_update" ON public.personeller
  FOR UPDATE USING (
    (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'firma_user')
    OR
    public.can_access_firm(organization_id)
  )
  WITH CHECK (
    (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
    OR
    (public.can_access_firm(organization_id) AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role IN ('gezici_uzman', 'isyeri_hekimi')
    ))
  );

CREATE POLICY "personeller_delete" ON public.personeller
  FOR DELETE USING (
    (organization_id = public.get_my_org_id() AND public.get_my_role() <> 'firma_user')
    OR
    (public.can_access_firm(organization_id) AND EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role = 'gezici_uzman'
    ))
  );

-- =====================================================
-- ADIM 6: osgb_ziyaretler politikalarını geri yükle
-- =====================================================
CREATE POLICY "osgb_ziyaretler_select" ON public.osgb_ziyaretler
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND (
          osgb_role = 'osgb_admin'
          OR (osgb_role IN ('gezici_uzman', 'isyeri_hekimi') AND public.can_access_firm(osgb_ziyaretler.firma_id))
        )
    )
  );

CREATE POLICY "osgb_ziyaretler_insert" ON public.osgb_ziyaretler
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role IN ('gezici_uzman', 'isyeri_hekimi')
        AND public.can_access_firm(osgb_ziyaretler.firma_id)
    )
  );

CREATE POLICY "osgb_ziyaretler_update" ON public.osgb_ziyaretler
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_organizations
      WHERE user_id = auth.uid()
        AND is_active = true
        AND osgb_role = 'osgb_admin'
    )
  );
