-- ================================================================
-- GÜVENLİK DÜZELTMELERİ - Supabase SQL Editor'da çalıştır
-- Storage policy rol kontrolü + companies org izolasyonu
-- ================================================================

-- ============================================================
-- 1. STORAGE - evraklar bucket rol kontrolü
-- ============================================================

-- INSERT: sadece admin ve member yükleyebilir (denetci yükleyemez)
DROP POLICY IF EXISTS "evraklar_insert" ON storage.objects;
CREATE POLICY "evraklar_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'evraklar'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  );

-- UPDATE: sadece admin ve member güncelleyebilir
DROP POLICY IF EXISTS "evraklar_update" ON storage.objects;
CREATE POLICY "evraklar_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'evraklar'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  )
  WITH CHECK (
    bucket_id = 'evraklar'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  );

-- DELETE: sadece admin silebilir
DROP POLICY IF EXISTS "evraklar_delete" ON storage.objects;
CREATE POLICY "evraklar_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'evraklar'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = 'admin'
  );

-- ============================================================
-- 2. STORAGE - uploads bucket rol kontrolü
-- ============================================================

-- INSERT: sadece admin ve member yükleyebilir
DROP POLICY IF EXISTS "uploads_authenticated_insert" ON storage.objects;
CREATE POLICY "uploads_authenticated_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  );

-- UPDATE: sadece admin ve member güncelleyebilir
DROP POLICY IF EXISTS "uploads_authenticated_update" ON storage.objects;
CREATE POLICY "uploads_authenticated_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  )
  WITH CHECK (
    bucket_id = 'uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = ANY (ARRAY['admin', 'member'])
  );

-- DELETE: sadece admin silebilir
DROP POLICY IF EXISTS "uploads_authenticated_delete" ON storage.objects;
CREATE POLICY "uploads_authenticated_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = get_my_org_id()::text
    AND get_my_role() = 'admin'
  );

-- ============================================================
-- 3. COMPANIES - org bazlı izolasyon
-- ============================================================
DROP POLICY IF EXISTS "companies_select_all" ON companies;
CREATE POLICY "companies_select_org" ON companies
  FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ============================================================
-- DOĞRULAMA
-- ============================================================
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'companies';
