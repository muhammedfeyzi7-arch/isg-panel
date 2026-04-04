-- ============================================================
-- PRODUCTION SECURITY FIX — FINAL
-- Tarih: 2026-04-04
-- Kapsam: Storage, RLS, Rol, Policy Temizliği, Activity Log
-- ============================================================
-- NASIL ÇALIŞTIRILIR:
-- 1. https://app.supabase.com/project/_/sql/new adresine git
-- 2. Bu dosyanın tüm içeriğini yapıştır
-- 3. "Run" butonuna bas
-- ============================================================


-- ============================================================
-- BÖLÜM 1: STORAGE — BUCKET'LARI PRIVATE YAP
-- ============================================================

UPDATE storage.buckets
SET public = false
WHERE id IN ('uploads', 'evraklar');


-- ============================================================
-- BÖLÜM 2: STORAGE — ESKİ POLİCY'LERİ TEMİZLE
-- ============================================================

-- uploads bucket eski policy'leri
DROP POLICY IF EXISTS "uploads_public_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_delete" ON storage.objects;

-- evraklar bucket eski policy'leri
DROP POLICY IF EXISTS "evraklar_select" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_insert" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_update" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_delete" ON storage.objects;

-- Önceki fix denemelerinden kalanlar
DROP POLICY IF EXISTS "uploads_org_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_org_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_org_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_org_delete" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_org_select" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_org_insert" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_org_update" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_org_delete" ON storage.objects;


-- ============================================================
-- BÖLÜM 3: STORAGE — ORG İZOLASYONLU YENİ POLİCY'LER
-- uploads bucket: sadece kendi org klasörüne erişim
-- ============================================================

-- uploads: SELECT (sadece kendi org dosyaları)
CREATE POLICY "uploads_org_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);

-- uploads: INSERT (sadece kendi org klasörüne)
CREATE POLICY "uploads_org_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);

-- uploads: UPDATE (sadece kendi org dosyaları)
CREATE POLICY "uploads_org_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);

-- uploads: DELETE (sadece kendi org dosyaları)
CREATE POLICY "uploads_org_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);


-- ============================================================
-- BÖLÜM 4: STORAGE — evraklar bucket org izolasyonu
-- ============================================================

-- evraklar: SELECT
CREATE POLICY "evraklar_org_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'evraklar'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);

-- evraklar: INSERT
CREATE POLICY "evraklar_org_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evraklar'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);

-- evraklar: UPDATE
CREATE POLICY "evraklar_org_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evraklar'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
)
WITH CHECK (
  bucket_id = 'evraklar'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);

-- evraklar: DELETE
CREATE POLICY "evraklar_org_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'evraklar'
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text
);


-- ============================================================
-- BÖLÜM 5: ROL BAZLI HELPER FONKSİYON
-- get_my_role() zaten var, ama SECURITY DEFINER olduğundan emin ol
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_organizations
  WHERE user_id = auth.uid()
    AND organization_id = public.get_my_org_id()
  LIMIT 1;
$$;


-- ============================================================
-- BÖLÜM 6: POLICY TEMİZLİĞİ — firmalar tablosu
-- Çakışan tüm eski policy'leri kaldır, tek net policy bırak
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.firmalar;
DROP POLICY IF EXISTS "delete_own_old_firmalar" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_delete_v2" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_insert_v2" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_org_all" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_select_v2" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_update_v2" ON public.firmalar;
DROP POLICY IF EXISTS "insert_org_old_firmalar" ON public.firmalar;
DROP POLICY IF EXISTS "insert_own_old_firmalar" ON public.firmalar;
DROP POLICY IF EXISTS "select_org" ON public.firmalar;
DROP POLICY IF EXISTS "select_own_old_firmalar" ON public.firmalar;
DROP POLICY IF EXISTS "update_org" ON public.firmalar;
DROP POLICY IF EXISTS "update_own_old_firmalar" ON public.firmalar;

-- Önceki fix denemelerinden kalanlar
DROP POLICY IF EXISTS "firmalar_select_role" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_insert_role" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_update_role" ON public.firmalar;
DROP POLICY IF EXISTS "firmalar_delete_role" ON public.firmalar;

-- firmalar: SELECT — tüm roller okuyabilir
CREATE POLICY "firmalar_select_role"
ON public.firmalar FOR SELECT
TO authenticated
USING (organization_id = public.get_my_org_id());

-- firmalar: INSERT — admin ve member yazabilir, denetci yazamaz
CREATE POLICY "firmalar_insert_role"
ON public.firmalar FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() IN ('admin', 'member')
);

-- firmalar: UPDATE — admin ve member güncelleyebilir
CREATE POLICY "firmalar_update_role"
ON public.firmalar FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() IN ('admin', 'member')
)
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() IN ('admin', 'member')
);

-- firmalar: DELETE — sadece admin silebilir
CREATE POLICY "firmalar_delete_role"
ON public.firmalar FOR DELETE
TO authenticated
USING (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() = 'admin'
);


-- ============================================================
-- BÖLÜM 7: POLICY TEMİZLİĞİ — personeller tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.personeller;
DROP POLICY IF EXISTS "delete_own_old_personeller" ON public.personeller;
DROP POLICY IF EXISTS "insert_org_old_personeller" ON public.personeller;
DROP POLICY IF EXISTS "insert_own_old_personeller" ON public.personeller;
DROP POLICY IF EXISTS "personeller_delete_v2" ON public.personeller;
DROP POLICY IF EXISTS "personeller_insert_v2" ON public.personeller;
DROP POLICY IF EXISTS "personeller_org_all" ON public.personeller;
DROP POLICY IF EXISTS "personeller_select_v2" ON public.personeller;
DROP POLICY IF EXISTS "personeller_update_v2" ON public.personeller;
DROP POLICY IF EXISTS "select_org" ON public.personeller;
DROP POLICY IF EXISTS "select_own_old_personeller" ON public.personeller;
DROP POLICY IF EXISTS "update_org" ON public.personeller;
DROP POLICY IF EXISTS "update_own_old_personeller" ON public.personeller;

-- Önceki fix denemelerinden kalanlar
DROP POLICY IF EXISTS "personeller_select_role" ON public.personeller;
DROP POLICY IF EXISTS "personeller_insert_role" ON public.personeller;
DROP POLICY IF EXISTS "personeller_update_role" ON public.personeller;
DROP POLICY IF EXISTS "personeller_delete_role" ON public.personeller;

-- personeller: SELECT
CREATE POLICY "personeller_select_role"
ON public.personeller FOR SELECT
TO authenticated
USING (organization_id = public.get_my_org_id());

-- personeller: INSERT
CREATE POLICY "personeller_insert_role"
ON public.personeller FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() IN ('admin', 'member')
);

-- personeller: UPDATE
CREATE POLICY "personeller_update_role"
ON public.personeller FOR UPDATE
TO authenticated
USING (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() IN ('admin', 'member')
)
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() IN ('admin', 'member')
);

-- personeller: DELETE
CREATE POLICY "personeller_delete_role"
ON public.personeller FOR DELETE
TO authenticated
USING (
  organization_id = public.get_my_org_id()
  AND public.get_my_role() = 'admin'
);


-- ============================================================
-- BÖLÜM 8: POLICY TEMİZLİĞİ — egitimler tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.egitimler;
DROP POLICY IF EXISTS "delete_own" ON public.egitimler;
DROP POLICY IF EXISTS "egitimler_org_all" ON public.egitimler;
DROP POLICY IF EXISTS "insert_org" ON public.egitimler;
DROP POLICY IF EXISTS "insert_own" ON public.egitimler;
DROP POLICY IF EXISTS "select_org" ON public.egitimler;
DROP POLICY IF EXISTS "select_own" ON public.egitimler;
DROP POLICY IF EXISTS "update_org" ON public.egitimler;
DROP POLICY IF EXISTS "update_own" ON public.egitimler;

DROP POLICY IF EXISTS "egitimler_select_role" ON public.egitimler;
DROP POLICY IF EXISTS "egitimler_insert_role" ON public.egitimler;
DROP POLICY IF EXISTS "egitimler_update_role" ON public.egitimler;
DROP POLICY IF EXISTS "egitimler_delete_role" ON public.egitimler;

CREATE POLICY "egitimler_select_role"
ON public.egitimler FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "egitimler_insert_role"
ON public.egitimler FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "egitimler_update_role"
ON public.egitimler FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "egitimler_delete_role"
ON public.egitimler FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 9: POLICY TEMİZLİĞİ — ekipmanlar tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.ekipmanlar;
DROP POLICY IF EXISTS "delete_own" ON public.ekipmanlar;
DROP POLICY IF EXISTS "ekipmanlar_org_all" ON public.ekipmanlar;
DROP POLICY IF EXISTS "insert_org" ON public.ekipmanlar;
DROP POLICY IF EXISTS "insert_own" ON public.ekipmanlar;
DROP POLICY IF EXISTS "select_org" ON public.ekipmanlar;
DROP POLICY IF EXISTS "select_own" ON public.ekipmanlar;
DROP POLICY IF EXISTS "update_org" ON public.ekipmanlar;
DROP POLICY IF EXISTS "update_own" ON public.ekipmanlar;

DROP POLICY IF EXISTS "ekipmanlar_select_role" ON public.ekipmanlar;
DROP POLICY IF EXISTS "ekipmanlar_insert_role" ON public.ekipmanlar;
DROP POLICY IF EXISTS "ekipmanlar_update_role" ON public.ekipmanlar;
DROP POLICY IF EXISTS "ekipmanlar_delete_role" ON public.ekipmanlar;

CREATE POLICY "ekipmanlar_select_role"
ON public.ekipmanlar FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "ekipmanlar_insert_role"
ON public.ekipmanlar FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "ekipmanlar_update_role"
ON public.ekipmanlar FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "ekipmanlar_delete_role"
ON public.ekipmanlar FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 10: POLICY TEMİZLİĞİ — evraklar tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.evraklar;
DROP POLICY IF EXISTS "delete_own" ON public.evraklar;
DROP POLICY IF EXISTS "evraklar_org_all" ON public.evraklar;
DROP POLICY IF EXISTS "insert_org" ON public.evraklar;
DROP POLICY IF EXISTS "insert_own" ON public.evraklar;
DROP POLICY IF EXISTS "select_org" ON public.evraklar;
DROP POLICY IF EXISTS "select_own" ON public.evraklar;
DROP POLICY IF EXISTS "update_org" ON public.evraklar;
DROP POLICY IF EXISTS "update_own" ON public.evraklar;

DROP POLICY IF EXISTS "evraklar_select_role" ON public.evraklar;
DROP POLICY IF EXISTS "evraklar_insert_role" ON public.evraklar;
DROP POLICY IF EXISTS "evraklar_update_role" ON public.evraklar;
DROP POLICY IF EXISTS "evraklar_delete_role" ON public.evraklar;

CREATE POLICY "evraklar_select_role"
ON public.evraklar FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "evraklar_insert_role"
ON public.evraklar FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "evraklar_update_role"
ON public.evraklar FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "evraklar_delete_role"
ON public.evraklar FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 11: POLICY TEMİZLİĞİ — muayeneler tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.muayeneler;
DROP POLICY IF EXISTS "delete_own" ON public.muayeneler;
DROP POLICY IF EXISTS "muayeneler_org_all" ON public.muayeneler;
DROP POLICY IF EXISTS "insert_org" ON public.muayeneler;
DROP POLICY IF EXISTS "insert_own" ON public.muayeneler;
DROP POLICY IF EXISTS "select_org" ON public.muayeneler;
DROP POLICY IF EXISTS "select_own" ON public.muayeneler;
DROP POLICY IF EXISTS "update_org" ON public.muayeneler;
DROP POLICY IF EXISTS "update_own" ON public.muayeneler;

DROP POLICY IF EXISTS "muayeneler_select_role" ON public.muayeneler;
DROP POLICY IF EXISTS "muayeneler_insert_role" ON public.muayeneler;
DROP POLICY IF EXISTS "muayeneler_update_role" ON public.muayeneler;
DROP POLICY IF EXISTS "muayeneler_delete_role" ON public.muayeneler;

CREATE POLICY "muayeneler_select_role"
ON public.muayeneler FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "muayeneler_insert_role"
ON public.muayeneler FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "muayeneler_update_role"
ON public.muayeneler FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "muayeneler_delete_role"
ON public.muayeneler FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 12: POLICY TEMİZLİĞİ — tutanaklar tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.tutanaklar;
DROP POLICY IF EXISTS "delete_own" ON public.tutanaklar;
DROP POLICY IF EXISTS "tutanaklar_org_all" ON public.tutanaklar;
DROP POLICY IF EXISTS "insert_org" ON public.tutanaklar;
DROP POLICY IF EXISTS "insert_own" ON public.tutanaklar;
DROP POLICY IF EXISTS "select_org" ON public.tutanaklar;
DROP POLICY IF EXISTS "select_own" ON public.tutanaklar;
DROP POLICY IF EXISTS "update_org" ON public.tutanaklar;
DROP POLICY IF EXISTS "update_own" ON public.tutanaklar;

DROP POLICY IF EXISTS "tutanaklar_select_role" ON public.tutanaklar;
DROP POLICY IF EXISTS "tutanaklar_insert_role" ON public.tutanaklar;
DROP POLICY IF EXISTS "tutanaklar_update_role" ON public.tutanaklar;
DROP POLICY IF EXISTS "tutanaklar_delete_role" ON public.tutanaklar;

CREATE POLICY "tutanaklar_select_role"
ON public.tutanaklar FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "tutanaklar_insert_role"
ON public.tutanaklar FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "tutanaklar_update_role"
ON public.tutanaklar FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "tutanaklar_delete_role"
ON public.tutanaklar FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 13: POLICY TEMİZLİĞİ — gorevler tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.gorevler;
DROP POLICY IF EXISTS "delete_own" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_org_all" ON public.gorevler;
DROP POLICY IF EXISTS "insert_org" ON public.gorevler;
DROP POLICY IF EXISTS "insert_own" ON public.gorevler;
DROP POLICY IF EXISTS "select_org" ON public.gorevler;
DROP POLICY IF EXISTS "select_own" ON public.gorevler;
DROP POLICY IF EXISTS "update_org" ON public.gorevler;
DROP POLICY IF EXISTS "update_own" ON public.gorevler;

DROP POLICY IF EXISTS "gorevler_select_role" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_insert_role" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_update_role" ON public.gorevler;
DROP POLICY IF EXISTS "gorevler_delete_role" ON public.gorevler;

CREATE POLICY "gorevler_select_role"
ON public.gorevler FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "gorevler_insert_role"
ON public.gorevler FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "gorevler_update_role"
ON public.gorevler FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "gorevler_delete_role"
ON public.gorevler FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 14: POLICY TEMİZLİĞİ — uygunsuzluklar tablosu
-- ============================================================

DROP POLICY IF EXISTS "delete_org" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "delete_own" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "uygunsuzluklar_org_all" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "insert_org" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "insert_own" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "select_org" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "select_own" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "update_org" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "update_own" ON public.uygunsuzluklar;

DROP POLICY IF EXISTS "uygunsuzluklar_select_role" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "uygunsuzluklar_insert_role" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "uygunsuzluklar_update_role" ON public.uygunsuzluklar;
DROP POLICY IF EXISTS "uygunsuzluklar_delete_role" ON public.uygunsuzluklar;

CREATE POLICY "uygunsuzluklar_select_role"
ON public.uygunsuzluklar FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "uygunsuzluklar_insert_role"
ON public.uygunsuzluklar FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "uygunsuzluklar_update_role"
ON public.uygunsuzluklar FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "uygunsuzluklar_delete_role"
ON public.uygunsuzluklar FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 15: is_izinleri — rol bazlı güncelleme
-- ============================================================

DROP POLICY IF EXISTS "org_members_delete_is_izinleri" ON public.is_izinleri;
DROP POLICY IF EXISTS "org_members_insert_is_izinleri" ON public.is_izinleri;
DROP POLICY IF EXISTS "org_members_select_is_izinleri" ON public.is_izinleri;
DROP POLICY IF EXISTS "org_members_update_is_izinleri" ON public.is_izinleri;

DROP POLICY IF EXISTS "is_izinleri_select_role" ON public.is_izinleri;
DROP POLICY IF EXISTS "is_izinleri_insert_role" ON public.is_izinleri;
DROP POLICY IF EXISTS "is_izinleri_update_role" ON public.is_izinleri;
DROP POLICY IF EXISTS "is_izinleri_delete_role" ON public.is_izinleri;

CREATE POLICY "is_izinleri_select_role"
ON public.is_izinleri FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id() AND deleted_at IS NULL);

CREATE POLICY "is_izinleri_insert_role"
ON public.is_izinleri FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "is_izinleri_update_role"
ON public.is_izinleri FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "is_izinleri_delete_role"
ON public.is_izinleri FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 16: company_documents — rol bazlı güncelleme
-- ============================================================

DROP POLICY IF EXISTS "company_documents_delete" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_insert" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_select" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_update" ON public.company_documents;

DROP POLICY IF EXISTS "company_documents_select_role" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_insert_role" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_update_role" ON public.company_documents;
DROP POLICY IF EXISTS "company_documents_delete_role" ON public.company_documents;

CREATE POLICY "company_documents_select_role"
ON public.company_documents FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "company_documents_insert_role"
ON public.company_documents FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "company_documents_update_role"
ON public.company_documents FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "company_documents_delete_role"
ON public.company_documents FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 17: kontrol_formlari — get_my_org_id() ile güncelle
-- (subquery yerine helper fonksiyon kullan — daha güvenli)
-- ============================================================

DROP POLICY IF EXISTS "kontrol_formlari_org_delete" ON public.kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_org_insert" ON public.kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_org_select" ON public.kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_org_update" ON public.kontrol_formlari;

DROP POLICY IF EXISTS "kontrol_formlari_select_role" ON public.kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_insert_role" ON public.kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_update_role" ON public.kontrol_formlari;
DROP POLICY IF EXISTS "kontrol_formlari_delete_role" ON public.kontrol_formlari;

CREATE POLICY "kontrol_formlari_select_role"
ON public.kontrol_formlari FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "kontrol_formlari_insert_role"
ON public.kontrol_formlari FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "kontrol_formlari_update_role"
ON public.kontrol_formlari FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "kontrol_formlari_delete_role"
ON public.kontrol_formlari FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 18: app_data — sadece admin yazabilsin
-- (tüm org verisi tek satırda, overwrite riski var)
-- ============================================================

DROP POLICY IF EXISTS "app_data_all" ON public.app_data;
DROP POLICY IF EXISTS "app_data_select_role" ON public.app_data;
DROP POLICY IF EXISTS "app_data_insert_role" ON public.app_data;
DROP POLICY IF EXISTS "app_data_update_role" ON public.app_data;
DROP POLICY IF EXISTS "app_data_delete_role" ON public.app_data;

CREATE POLICY "app_data_select_role"
ON public.app_data FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

CREATE POLICY "app_data_insert_role"
ON public.app_data FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "app_data_update_role"
ON public.app_data FOR UPDATE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'))
WITH CHECK (organization_id = public.get_my_org_id() AND public.get_my_role() IN ('admin', 'member'));

CREATE POLICY "app_data_delete_role"
ON public.app_data FOR DELETE TO authenticated
USING (organization_id = public.get_my_org_id() AND public.get_my_role() = 'admin');


-- ============================================================
-- BÖLÜM 19: ORGANIZATIONS — SPAM KORUMASI
-- Rate-limit: 5 dakika içinde 5'ten fazla org oluşturulamaz
-- ============================================================

DROP POLICY IF EXISTS "orgs_insert" ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert_ratelimit" ON public.organizations;

CREATE POLICY "orgs_insert_ratelimit"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM public.organizations o
    JOIN public.user_organizations uo ON uo.organization_id = o.id
    WHERE uo.user_id = auth.uid()
      AND uo.role = 'admin'
      AND o.created_at > NOW() - INTERVAL '5 minutes'
  ) < 5
);


-- ============================================================
-- BÖLÜM 20: ACTIVITY LOGS — SAHTECİLİK ENGELİ
-- user_id, user_name, user_role backend'den alınmalı
-- Trigger ile client'tan gelen değerleri override et
-- ============================================================

DROP POLICY IF EXISTS "activity_logs_insert_service" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_secure" ON public.activity_logs;

-- Yeni güvenli INSERT policy
CREATE POLICY "activity_logs_insert_secure"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.get_my_org_id()
  AND auth.uid() IS NOT NULL
);

-- Trigger: user_id'yi her zaman auth.uid() ile override et
CREATE OR REPLACE FUNCTION public.enforce_activity_log_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_role text;
BEGIN
  -- user_id'yi her zaman gerçek auth kullanıcısından al
  NEW.user_id := auth.uid();
  
  -- organization_id'yi her zaman gerçek org'dan al
  NEW.organization_id := public.get_my_org_id();
  
  -- Profil bilgilerini çek
  SELECT full_name INTO v_profile
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  -- Rolü çek
  v_role := public.get_my_role();
  
  -- Client'tan gelen user_name ve user_role'ü override et
  IF v_profile.full_name IS NOT NULL THEN
    NEW.user_name := v_profile.full_name;
  END IF;
  
  IF v_role IS NOT NULL THEN
    NEW.user_role := v_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Eski trigger varsa kaldır
DROP TRIGGER IF EXISTS enforce_activity_log_user_trigger ON public.activity_logs;

-- Yeni trigger oluştur
CREATE TRIGGER enforce_activity_log_user_trigger
BEFORE INSERT ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_activity_log_user();


-- ============================================================
-- BÖLÜM 21: DOĞRULAMA — Sonuçları kontrol et
-- ============================================================

-- Bucket'ların private olduğunu doğrula
SELECT id, name, public AS is_public
FROM storage.buckets
WHERE id IN ('uploads', 'evraklar');

-- Storage policy sayısını doğrula
SELECT COUNT(*) AS storage_policy_count
FROM pg_policies
WHERE schemaname = 'storage';

-- firmalar policy'lerini doğrula (sadece 4 olmalı)
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'firmalar'
ORDER BY cmd;

-- ============================================================
-- TAMAMLANDI
-- ============================================================
