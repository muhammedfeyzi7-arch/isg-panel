-- ============================================================
-- RLS GÜVENLİK DENETİMİ — KRİTİK DÜZELTMELER
-- Tarih: 2026-04-12
-- Bu SQL'i Supabase SQL Editor'da çalıştırın
-- ============================================================

-- -------------------------------------------------------
-- FIX 1: organizations INSERT — Zayıf politikaları güçlendir
-- Risk: Herhangi authenticated user yeni org yaratabiliyordu
-- -------------------------------------------------------
DROP POLICY IF EXISTS "orgs_insert" ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert_v2" ON public.organizations;

CREATE POLICY "orgs_insert_secure" ON public.organizations
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    -- Onboarding: Kullanıcı henüz herhangi aktif org'da değilse
    NOT EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid() AND is_active = true
    )
    OR
    -- Mevcut admin: Kendi org'u varsa alt org oluşturabilir
    EXISTS (
      SELECT 1 FROM user_organizations
      WHERE user_id = auth.uid()
        AND role = 'admin'
        AND is_active = true
    )
  )
);

-- -------------------------------------------------------
-- FIX 2: user_organizations UPDATE — Self privilege escalation engelle
-- Risk: Kullanıcı kendi role alanını 'admin' yapabiliyordu
-- -------------------------------------------------------
DROP POLICY IF EXISTS "user_orgs_update" ON public.user_organizations;

-- Yeni güvenli update politikası: service_role veya org_admin değiştirebilir
-- Kullanıcı sadece active_firm_id, active_firm_ids ve is_active gibi alanları güncelleyebilir
CREATE POLICY "user_orgs_update_secure" ON public.user_organizations
FOR UPDATE
USING (
  (user_id = auth.uid() AND is_active = true)
  OR is_org_admin(organization_id)
  OR (auth.role() = 'service_role')
)
WITH CHECK (
  -- Service role: her şeyi değiştirebilir
  (auth.role() = 'service_role')
  OR
  -- Org admin: her şeyi değiştirebilir
  is_org_admin(organization_id)
  OR
  -- Kullanıcı kendi kaydı: role ve osgb_role DEĞİŞTİREMEZ
  (
    user_id = auth.uid()
    AND role = OLD.role
    AND (osgb_role IS NOT DISTINCT FROM OLD.osgb_role)
  )
);

-- -------------------------------------------------------
-- FIX 3: companies tablosu — Org izolasyonu ekle
-- Risk: Tüm firmalar herkese görünüyordu (auth.uid() IS NOT NULL)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "companies_select_all" ON public.companies;

CREATE POLICY "companies_select_org" ON public.companies
FOR SELECT
USING (
  -- Kullanıcı bu firmaya ait bir org'un üyesi
  id IN (
    SELECT c.id FROM companies c
    JOIN user_organizations uo ON uo.organization_id::text = c.id::text
    WHERE uo.user_id = auth.uid() AND uo.is_active = true
  )
  OR
  -- Super admin tümünü görebilir
  EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND is_super_admin = true
  )
);

-- -------------------------------------------------------
-- FIX 4: get_my_osgb_role() — Deterministik sıralama (DONE VIA SQL TOOL)
-- Bu zaten uygulandı, tekrar çalıştırmaya gerek yok
-- -------------------------------------------------------

-- -------------------------------------------------------
-- FIX 5: osgb_ziyaretler UPDATE — Politika çakışması gider
-- Risk: osgb_update politikası çok geniş, tüm üyeler güncelleme yapabiliyordu
-- -------------------------------------------------------
DROP POLICY IF EXISTS "osgb_update" ON public.osgb_ziyaretler;

-- Sadece kendi ziyaretini veya osgb_admin tüm ziyaretleri güncelleyebilir
-- ziyaretler_update_own politikası yeterli, osgb_update fazla genişti

-- -------------------------------------------------------
-- FIX 6: is_kazalari DELETE — Eksik politika eklendi (DONE VIA SQL TOOL)
-- Bu zaten uygulandı
-- -------------------------------------------------------

-- -------------------------------------------------------
-- FIX 7: is_kazalari UPDATE WITH CHECK — Eklendi (DONE VIA SQL TOOL)
-- Bu zaten uygulandı
-- -------------------------------------------------------

-- -------------------------------------------------------
-- FIX 8: muayeneler — isyeri_hekimi UPDATE politikası (DONE VIA SQL TOOL)
-- Bu zaten uygulandı
-- -------------------------------------------------------

-- -------------------------------------------------------
-- DOĞRULAMA: Tüm tablolarda RLS aktif mi?
-- -------------------------------------------------------
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;
-- Bu sorgu sonuç dönmemeli (tüm tablolarda RLS aktif olmalı)

-- -------------------------------------------------------
-- DOĞRULAMA: is_kazalari DELETE politikası var mı?
-- -------------------------------------------------------
SELECT cmd, policyname FROM pg_policies WHERE tablename = 'is_kazalari' ORDER BY cmd;
