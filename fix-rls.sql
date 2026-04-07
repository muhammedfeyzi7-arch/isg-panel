-- ============================================================
-- ISG DENETİM — RLS & POLICY FIX (v4 - FINAL)
-- Supabase SQL Editor'da çalıştır:
-- https://app.supabase.com/project/_/sql/new
-- ============================================================

-- ─── 1. SECURITY DEFINER helper fonksiyonlar (recursion önler) ───────────────

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.user_organizations
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_organizations
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND role = 'admin'
  );
$$;

-- ─── 2. user_organizations — tüm eski policy'leri sil, yeniden yaz ───────────

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_orgs_select"          ON public.user_organizations;
DROP POLICY IF EXISTS "user_orgs_insert"          ON public.user_organizations;
DROP POLICY IF EXISTS "user_orgs_update"          ON public.user_organizations;
DROP POLICY IF EXISTS "user_orgs_delete"          ON public.user_organizations;
DROP POLICY IF EXISTS "users_own_org_select"      ON public.user_organizations;
DROP POLICY IF EXISTS "users_own_org_insert"      ON public.user_organizations;
DROP POLICY IF EXISTS "users_own_org_update"      ON public.user_organizations;
DROP POLICY IF EXISTS "admin_select_org_members"  ON public.user_organizations;

-- SELECT: kendi satırını VEYA aynı org'daki satırları görebilir
-- get_my_org_id() SECURITY DEFINER olduğu için recursion olmaz
CREATE POLICY "user_orgs_select" ON public.user_organizations
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id = public.get_my_org_id()
  );

-- INSERT: kendi satırını ekleyebilir VEYA admin org'una ekleyebilir
CREATE POLICY "user_orgs_insert" ON public.user_organizations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_org_admin(organization_id)
  );

-- UPDATE: kendi satırını güncelleyebilir VEYA admin
CREATE POLICY "user_orgs_update" ON public.user_organizations
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.is_org_admin(organization_id)
  );

-- DELETE: sadece admin silebilir
CREATE POLICY "user_orgs_delete" ON public.user_organizations
  FOR DELETE USING (
    public.is_org_admin(organization_id)
  );

-- ─── 3. organizations tablosu ─────────────────────────────────────────────────

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_select"        ON public.organizations;
DROP POLICY IF EXISTS "orgs_insert"        ON public.organizations;
DROP POLICY IF EXISTS "orgs_update"        ON public.organizations;
DROP POLICY IF EXISTS "org_member_select"  ON public.organizations;
DROP POLICY IF EXISTS "org_creator_insert" ON public.organizations;
DROP POLICY IF EXISTS "org_admin_update"   ON public.organizations;

CREATE POLICY "orgs_select" ON public.organizations
  FOR SELECT USING (id = public.get_my_org_id());

CREATE POLICY "orgs_insert" ON public.organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "orgs_update" ON public.organizations
  FOR UPDATE USING (public.is_org_admin(id));

-- ─── 4. app_data tablosu ──────────────────────────────────────────────────────

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_data_select" ON public.app_data;
DROP POLICY IF EXISTS "app_data_insert" ON public.app_data;
DROP POLICY IF EXISTS "app_data_update" ON public.app_data;
DROP POLICY IF EXISTS "app_data_upsert" ON public.app_data;

CREATE POLICY "app_data_select" ON public.app_data
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "app_data_insert" ON public.app_data
  FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());

CREATE POLICY "app_data_update" ON public.app_data
  FOR UPDATE USING (organization_id = public.get_my_org_id());

-- ─── 5. activity_logs tablosu ─────────────────────────────────────────────────

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
DROP POLICY IF EXISTS "al_select_org"        ON public.activity_logs;
DROP POLICY IF EXISTS "al_insert_own"        ON public.activity_logs;

CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT USING (organization_id = public.get_my_org_id());

CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (organization_id = public.get_my_org_id());

-- ─── 6. Diğer entity tabloları ────────────────────────────────────────────────

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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Eski policy'leri temizle
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_own" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "select_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "insert_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "update_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "delete_org" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Users can manage own org data" ON public.%I', tbl);

    -- Yeni doğru policy'ler
    EXECUTE format(
      'CREATE POLICY "%s_select" ON public.%I FOR SELECT USING (organization_id = public.get_my_org_id())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_insert" ON public.%I FOR INSERT WITH CHECK (organization_id = public.get_my_org_id())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_update" ON public.%I FOR UPDATE USING (organization_id = public.get_my_org_id())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_delete" ON public.%I FOR DELETE USING (organization_id = public.get_my_org_id())',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ─── Tamamlandı ───────────────────────────────────────────────────────────────
SELECT 'RLS policies v4 fixed successfully!' as result;
