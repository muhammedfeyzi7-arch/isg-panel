-- ============================================================
-- ISG DENETİM — SECURITY FIX v2 (PRODUCTION SAFE)
-- Supabase SQL Editor'da çalıştır:
-- https://app.supabase.com/project/_/sql/new
-- ============================================================

-- ─── 0. HELPER: get_my_role() ────────────────────────────────
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

-- ─── 1. ORGANIZATIONS — Spam engeli (max 3 org per user) ─────
DROP POLICY IF EXISTS "orgs_insert" ON public.organizations;
DROP POLICY IF EXISTS "org_creator_insert" ON public.organizations;

CREATE POLICY "orgs_insert" ON public.organizations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      SELECT COUNT(*) FROM public.organizations
      WHERE created_by = auth.uid()
    ) < 3
  );

-- ─── 2. ENTITY TABLOLARI — Rol bazlı RLS + Policy temizliği ──
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'personeller', 'firmalar', 'evraklar', 'egitimler',
    'muayeneler', 'tutanaklar', 'uygunsuzluklar', 'ekipmanlar',
    'gorevler', 'is_izinleri'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- Tüm eski policy'leri temizle (çakışan policy'ler dahil)
    EXECUTE format('DROP POLICY IF EXISTS "%s_org_all" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_rbac" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_rbac" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_rbac" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_rbac" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own org data" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_v2" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_v2" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_v2" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_v2" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_own_old_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own_old_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_own_old_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_own_old_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_org_old_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_org_old_%s" ON public.%I', tbl, tbl);

    -- SELECT: tüm org üyeleri okuyabilir (denetci dahil)
    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT
       USING (organization_id = public.get_my_org_id())',
      tbl, tbl
    );

    -- INSERT: sadece admin ve member (denetci yapamaz)
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON public.%I FOR INSERT
       WITH CHECK (
         organization_id = public.get_my_org_id()
         AND public.get_my_role() IN (''admin'', ''member'')
       )',
      tbl, tbl
    );

    -- UPDATE: sadece admin ve member (denetci yapamaz)
    EXECUTE format(
      'CREATE POLICY "%s_update" ON public.%I FOR UPDATE
       USING (
         organization_id = public.get_my_org_id()
         AND public.get_my_role() IN (''admin'', ''member'')
       )',
      tbl, tbl
    );

    -- DELETE: sadece admin (member ve denetci yapamaz)
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON public.%I FOR DELETE
       USING (
         organization_id = public.get_my_org_id()
         AND public.get_my_role() = ''admin''
       )',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─── 3. ACTIVITY LOGS — Sahte log engeli ─────────────────────
DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_service" ON public.activity_logs;
DROP POLICY IF EXISTS "al_insert_own" ON public.activity_logs;

-- user_id zorunlu olarak auth.uid() olmalı
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND organization_id = public.get_my_org_id()
  );

-- ─── 4. APP_DATA — Denetci yazamaz ───────────────────────────
DROP POLICY IF EXISTS "app_data_all" ON public.app_data;
DROP POLICY IF EXISTS "app_data_select" ON public.app_data;
DROP POLICY IF EXISTS "app_data_insert" ON public.app_data;
DROP POLICY IF EXISTS "app_data_update" ON public.app_data;
DROP POLICY IF EXISTS "app_data_upsert" ON public.app_data;
DROP POLICY IF EXISTS "app_data_write" ON public.app_data;

CREATE POLICY "app_data_select" ON public.app_data
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "app_data_write" ON public.app_data
  FOR ALL USING (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('admin', 'member')
  ) WITH CHECK (
    organization_id = public.get_my_org_id()
    AND public.get_my_role() IN ('admin', 'member')
  );

-- ─── 5. STORAGE — Org izolasyonu ─────────────────────────────
-- uploads bucket: kullanıcı sadece kendi org klasörüne upload yapabilir
-- Path format: {orgId}/{module}/{file}
-- auth.uid() ile org_id eşleşmesi get_my_org_id() üzerinden yapılır

DROP POLICY IF EXISTS "uploads_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_public_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_delete" ON storage.objects;

-- SELECT: sadece kendi org dosyalarını görebilir
CREATE POLICY "uploads_org_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- INSERT: sadece kendi org klasörüne yükleyebilir
CREATE POLICY "uploads_org_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- UPDATE: sadece kendi org dosyalarını güncelleyebilir
CREATE POLICY "uploads_org_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- DELETE: sadece kendi org dosyalarını silebilir
CREATE POLICY "uploads_org_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- evraklar bucket için de aynı izolasyon
DROP POLICY IF EXISTS "evraklar_select" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_insert" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_update" ON storage.objects;
DROP POLICY IF EXISTS "evraklar_delete" ON storage.objects;

CREATE POLICY "evraklar_org_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'evraklar'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

CREATE POLICY "evraklar_org_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'evraklar'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

CREATE POLICY "evraklar_org_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'evraklar'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

CREATE POLICY "evraklar_org_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'evraklar'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
  );

-- ─── 6. BUCKET'LARI PRIVATE YAP ──────────────────────────────
-- Supabase Dashboard > Storage > uploads > Edit > Public: OFF
-- VEYA aşağıdaki SQL:
UPDATE storage.buckets SET public = false WHERE id IN ('uploads', 'evraklar');

-- ─── Doğrulama ────────────────────────────────────────────────
SELECT 'Security fix v2 applied successfully!' as result;

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('firmalar', 'personeller', 'organizations', 'activity_logs', 'app_data')
ORDER BY tablename, cmd;
