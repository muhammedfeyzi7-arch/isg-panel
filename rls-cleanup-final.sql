-- ================================================================
-- RLS TEMİZLİK SCRIPTI - Supabase SQL Editor'da çalıştır
-- Tarih: 2026-04-06
-- ================================================================

-- =============================================
-- FİRMALAR - Duplicate policy temizliği
-- Ana policy: firmalar_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON firmalar;
DROP POLICY IF EXISTS "delete_own_old_firmalar" ON firmalar;
DROP POLICY IF EXISTS "firmalar_delete_v2" ON firmalar;
DROP POLICY IF EXISTS "insert_org_old_firmalar" ON firmalar;
DROP POLICY IF EXISTS "insert_own_old_firmalar" ON firmalar;
DROP POLICY IF EXISTS "firmalar_insert_v2" ON firmalar;
DROP POLICY IF EXISTS "select_org" ON firmalar;
DROP POLICY IF EXISTS "select_own_old_firmalar" ON firmalar;
DROP POLICY IF EXISTS "firmalar_select_v2" ON firmalar;
DROP POLICY IF EXISTS "update_org" ON firmalar;
DROP POLICY IF EXISTS "update_own_old_firmalar" ON firmalar;
DROP POLICY IF EXISTS "firmalar_update_v2" ON firmalar;

-- =============================================
-- PERSONELLER - Duplicate policy temizliği
-- Ana policy: personeller_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON personeller;
DROP POLICY IF EXISTS "delete_own_old_personeller" ON personeller;
DROP POLICY IF EXISTS "personeller_delete_v2" ON personeller;
DROP POLICY IF EXISTS "insert_org_old_personeller" ON personeller;
DROP POLICY IF EXISTS "insert_own_old_personeller" ON personeller;
DROP POLICY IF EXISTS "personeller_insert_v2" ON personeller;
DROP POLICY IF EXISTS "select_org" ON personeller;
DROP POLICY IF EXISTS "select_own_old_personeller" ON personeller;
DROP POLICY IF EXISTS "personeller_select_v2" ON personeller;
DROP POLICY IF EXISTS "update_org" ON personeller;
DROP POLICY IF EXISTS "update_own_old_personeller" ON personeller;
DROP POLICY IF EXISTS "personeller_update_v2" ON personeller;

-- =============================================
-- EGİTİMLER - Duplicate policy temizliği
-- Ana policy: egitimler_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON egitimler;
DROP POLICY IF EXISTS "delete_own" ON egitimler;
DROP POLICY IF EXISTS "insert_org" ON egitimler;
DROP POLICY IF EXISTS "insert_own" ON egitimler;
DROP POLICY IF EXISTS "select_org" ON egitimler;
DROP POLICY IF EXISTS "select_own" ON egitimler;
DROP POLICY IF EXISTS "update_org" ON egitimler;
DROP POLICY IF EXISTS "update_own" ON egitimler;

-- =============================================
-- EKİPMANLAR - Duplicate policy temizliği
-- Ana policy: ekipmanlar_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON ekipmanlar;
DROP POLICY IF EXISTS "delete_own" ON ekipmanlar;
DROP POLICY IF EXISTS "insert_org" ON ekipmanlar;
DROP POLICY IF EXISTS "insert_own" ON ekipmanlar;
DROP POLICY IF EXISTS "select_org" ON ekipmanlar;
DROP POLICY IF EXISTS "select_own" ON ekipmanlar;
DROP POLICY IF EXISTS "update_org" ON ekipmanlar;
DROP POLICY IF EXISTS "update_own" ON ekipmanlar;

-- =============================================
-- MUAYENELER - Duplicate policy temizliği
-- Ana policy: muayeneler_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON muayeneler;
DROP POLICY IF EXISTS "delete_own" ON muayeneler;
DROP POLICY IF EXISTS "insert_org" ON muayeneler;
DROP POLICY IF EXISTS "insert_own" ON muayeneler;
DROP POLICY IF EXISTS "select_org" ON muayeneler;
DROP POLICY IF EXISTS "select_own" ON muayeneler;
DROP POLICY IF EXISTS "update_org" ON muayeneler;
DROP POLICY IF EXISTS "update_own" ON muayeneler;

-- =============================================
-- TUTANAKLAR - Duplicate policy temizliği
-- Ana policy: tutanaklar_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON tutanaklar;
DROP POLICY IF EXISTS "delete_own" ON tutanaklar;
DROP POLICY IF EXISTS "insert_org" ON tutanaklar;
DROP POLICY IF EXISTS "insert_own" ON tutanaklar;
DROP POLICY IF EXISTS "select_org" ON tutanaklar;
DROP POLICY IF EXISTS "select_own" ON tutanaklar;
DROP POLICY IF EXISTS "update_org" ON tutanaklar;
DROP POLICY IF EXISTS "update_own" ON tutanaklar;

-- =============================================
-- GÖREVLER - Duplicate policy temizliği
-- Ana policy: gorevler_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON gorevler;
DROP POLICY IF EXISTS "delete_own" ON gorevler;
DROP POLICY IF EXISTS "insert_org" ON gorevler;
DROP POLICY IF EXISTS "insert_own" ON gorevler;
DROP POLICY IF EXISTS "select_org" ON gorevler;
DROP POLICY IF EXISTS "select_own" ON gorevler;
DROP POLICY IF EXISTS "update_org" ON gorevler;
DROP POLICY IF EXISTS "update_own" ON gorevler;

-- =============================================
-- UYGUNSUZLUKLAR - Duplicate policy temizliği
-- Ana policy: uygunsuzluklar_org_all (ALL) kalıyor
-- Denetci policy'leri gereksiz (org_all zaten kapsamlı)
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON uygunsuzluklar;
DROP POLICY IF EXISTS "delete_own" ON uygunsuzluklar;
DROP POLICY IF EXISTS "insert_org" ON uygunsuzluklar;
DROP POLICY IF EXISTS "insert_own" ON uygunsuzluklar;
DROP POLICY IF EXISTS "uygunsuzluklar_denetci_insert" ON uygunsuzluklar;
DROP POLICY IF EXISTS "select_org" ON uygunsuzluklar;
DROP POLICY IF EXISTS "select_own" ON uygunsuzluklar;
DROP POLICY IF EXISTS "update_org" ON uygunsuzluklar;
DROP POLICY IF EXISTS "update_own" ON uygunsuzluklar;
DROP POLICY IF EXISTS "uygunsuzluklar_denetci_update" ON uygunsuzluklar;

-- =============================================
-- EVRAKLAR - Duplicate policy temizliği
-- Ana policy: evraklar_org_all (ALL) kalıyor
-- =============================================
DROP POLICY IF EXISTS "delete_org" ON evraklar;
DROP POLICY IF EXISTS "delete_own" ON evraklar;
DROP POLICY IF EXISTS "insert_org" ON evraklar;
DROP POLICY IF EXISTS "insert_own" ON evraklar;
DROP POLICY IF EXISTS "select_org" ON evraklar;
DROP POLICY IF EXISTS "select_own" ON evraklar;
DROP POLICY IF EXISTS "update_org" ON evraklar;
DROP POLICY IF EXISTS "update_own" ON evraklar;

-- ================================================================
-- KONTROL_FORMLARI - Rol bazlı güçlendirme
-- Eski policy'leri kaldır, get_my_role() ile yenile
-- ================================================================
DROP POLICY IF EXISTS "kontrol_formlari_org_select" ON kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_org_insert" ON kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_org_update" ON kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_org_delete" ON kontrol_formlari;

-- SELECT: Tüm org üyeleri görebilir
CREATE POLICY "kontrol_formlari_select"
  ON kontrol_formlari FOR SELECT
  USING (organization_id = get_my_org_id());

-- INSERT: Sadece admin ve member ekleyebilir (denetci ekleyemez)
CREATE POLICY "kontrol_formlari_insert"
  ON kontrol_formlari FOR INSERT
  WITH CHECK (
    organization_id = get_my_org_id()
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  );

-- UPDATE: Sadece admin ve member güncelleyebilir
CREATE POLICY "kontrol_formlari_update"
  ON kontrol_formlari FOR UPDATE
  USING (
    organization_id = get_my_org_id()
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  )
  WITH CHECK (
    organization_id = get_my_org_id()
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  );

-- DELETE: Sadece admin silebilir
CREATE POLICY "kontrol_formlari_delete"
  ON kontrol_formlari FOR DELETE
  USING (
    organization_id = get_my_org_id()
    AND get_my_role() = 'admin'
  );

-- ================================================================
-- DOĞRULAMA: Temizlik sonrası policy sayılarını kontrol et
-- ================================================================
SELECT 
  tablename,
  COUNT(*) as policy_count,
  STRING_AGG(policyname || ' (' || cmd || ')', ', ' ORDER BY cmd, policyname) as policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'firmalar', 'personeller', 'egitimler', 'ekipmanlar',
    'muayeneler', 'tutanaklar', 'gorevler', 'uygunsuzluklar',
    'evraklar', 'kontrol_formlari'
  )
GROUP BY tablename
ORDER BY tablename;
