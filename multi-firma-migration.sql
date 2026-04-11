-- ═══════════════════════════════════════════════════════════════════════════
-- MULTI-FIRMA MIGRATION v2 — Final Production-Ready
-- Supabase Dashboard → SQL Editor → Çalıştır
--
-- Bu migration 5 şeyi yapar:
--   1. firmalar gezici uzman SELECT policy
--   2. activity_logs trigger'larını TAMAMEN kaldırır
--   3. activity_logs INSERT policy can_access_org modeline geçer
--   4. activity_logs SELECT policy güncellenir
--   5. user_organizations.active_firm_id NULL ise active_firm_ids[0] ile doldurulur
--
-- Güvenli: Her adım idempotent (defalarca çalıştırılabilir).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ADIM 1: firmalar tablosu — gezici uzman SELECT ───────────────────────
--
-- Sorun: Gezici uzman active_firm_ids'deki firmaları göremiyordu.
-- Çözüm: can_access_org() tüm active_firm_ids listesini kontrol eder.
-- Kısıt: INSERT/UPDATE/DELETE kapalı — sadece okuma.

DROP POLICY IF EXISTS firmalar_gezici_uzman_select ON public.firmalar;

CREATE POLICY firmalar_gezici_uzman_select
  ON public.firmalar
  FOR SELECT
  TO authenticated
  USING (
    can_access_org(organization_id)
  );

-- ─── ADIM 2: activity_logs trigger'larını TAMAMEN kaldır ──────────────────
--
-- Sorun: Trigger'lar get_my_org_id() ile organization_id'yi override ediyordu.
--        Gezici uzman B firmasında çalışsa bile log A'ya (active_firm_ids[0]) yazılıyordu.
-- Çözüm: Trigger yok → override yok → frontend'den gelen organization_id kullanılır.
--
-- Migration olmadan da sistem çalışır (trigger active_firm_id'yi doğru okur)
-- AMA trigger dependency tehlikeli — kalıcı çözüm: kaldır.

-- Trigger function'larını bırakıyoruz (başka yerde kullanılıyor olabilir)
-- Sadece TRIGGER tanımlarını kaldırıyoruz.
DROP TRIGGER IF EXISTS activity_logs_enforce_user         ON public.activity_logs;
DROP TRIGGER IF EXISTS enforce_activity_log_user_trigger  ON public.activity_logs;
DROP TRIGGER IF EXISTS activity_logs_set_user_fields_trig ON public.activity_logs;

-- Ek ihtimal: başka isimle tanımlanmış trigger'lar
DO $$
DECLARE
  trig RECORD;
BEGIN
  FOR trig IN
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_table = 'activity_logs'
      AND event_object_schema = 'public'
      AND trigger_name NOT LIKE 'RI_%'  -- FK constraint trigger'larına dokunma
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.activity_logs', trig.trigger_name);
    RAISE NOTICE '[Migration] Dropped trigger: %', trig.trigger_name;
  END LOOP;
END $$;

-- ─── ADIM 3: activity_logs RLS — can_access_org modeline geç ──────────────
--
-- Sorun: Mevcut INSERT policy get_my_org_id() kullanıyor.
--        Gezici uzman aktif firmaya (B) log yazamıyordu.
-- Çözüm: can_access_org() — tüm active_firm_ids için TRUE döner.

DROP POLICY IF EXISTS activity_logs_insert_service ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_insert         ON public.activity_logs;
DROP POLICY IF EXISTS activity_logs_select         ON public.activity_logs;

-- SELECT: kendi org'u VEYA erişim yetkisi olan org
CREATE POLICY activity_logs_select
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id = get_my_org_id()
    OR can_access_org(organization_id)
  );

-- INSERT: can_access_org ile doğrula
-- Frontend explicit organizationId gönderir → RLS burada doğrular
-- Yanlış org gönderilirse → WITH CHECK FALSE → 403
CREATE POLICY activity_logs_insert
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    can_access_org(organization_id)
    AND auth.uid() IS NOT NULL
  );

-- ─── ADIM 4: active_firm_id NULL olan gezici uzman kayıtlarını düzelt ──────
--
-- Bazı gezici uzmanların active_firm_id'si NULL olabilir (eski kayıtlar).
-- active_firm_ids[1] (ilk eleman) ile doldur.
-- useOrganization.ts de bunu yapıyor ama DB'de de düzeltmek daha güvenli.

UPDATE public.user_organizations
SET active_firm_id = (active_firm_ids[1])  -- PostgreSQL 1-indexed
WHERE osgb_role     = 'gezici_uzman'
  AND is_active     = true
  AND active_firm_id IS NULL
  AND active_firm_ids IS NOT NULL
  AND array_length(active_firm_ids, 1) > 0;

-- ─── ADIM 5: Doğrulama — Sonuçları kontrol et ────────────────────────────

-- Firmalar policy'leri
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'firmalar'
  AND schemaname = 'public'
ORDER BY policyname;

-- Activity_logs policy'leri
SELECT policyname, cmd, qual::text
FROM pg_policies
WHERE tablename = 'activity_logs'
  AND schemaname = 'public'
ORDER BY policyname;

-- Activity_logs trigger'ları (0 satır bekleniyor)
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table  = 'activity_logs'
  AND event_object_schema = 'public'
  AND trigger_name NOT LIKE 'RI_%';

-- NULL active_firm_id kalan gezici uzman (0 bekleniyor)
SELECT COUNT(*) AS null_active_firm_count
FROM public.user_organizations
WHERE osgb_role     = 'gezici_uzman'
  AND is_active     = true
  AND active_firm_id IS NULL;

-- ─── TAMAMLANDI ───────────────────────────────────────────────────────────
--
-- Sistem durumu (migration sonrası):
-- ✔ Gezici uzman atandığı TÜM firmaları görebilir (can_access_org)
-- ✔ Trigger override yok — organization_id her zaman frontend'den gelir
-- ✔ Yanlış org'a log yazmak RLS tarafından engellenir (403)
-- ✔ Race condition: useOrganization.ts ref-first pattern ile çözüldü
-- ✔ isSwitching guard: useStore tüm write ops'u bloke eder
-- ✔ setup-organization edge function: yeni kurulumlarda otomatik bootstrap
-- ══════════════════════════════════════════════════════════════════════════
