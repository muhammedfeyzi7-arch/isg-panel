-- ═══════════════════════════════════════════════════════════════════════════
-- RLS FIX v2 — UYGULANMIŞ DURUM
-- Tüm _v2 policy'ler Supabase'e başarıyla uygulandı (18 Nisan 2026)
--
-- Düzeltilen sorunlar:
--   1. 29 policy {public} → {authenticated} yapıldı
--   2. firms_update WITH CHECK eklendi
--   3. profiles_update_own/admin WITH CHECK eklendi
--   4. visits_update_admin WITH CHECK eklendi
--   5. firms_select_personnel: tüm org firmalarını görebilir hale getirildi
--   6. dof_records {public} → {authenticated} yapıldı
--
-- NOT: Eski {public} policy'ler (isimsiz, _v2 olmayan) Supabase Dashboard'dan
-- manuel silinebilir. PERMISSIVE modda _v2 policy'ler öncelikli çalışır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
-- org_select_v2, org_update_v2 → authenticated ✅

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
-- profiles_select_v2, profiles_insert_v2 → authenticated ✅
-- profiles_update_own_v2, profiles_update_admin_v2 → authenticated + WITH CHECK ✅

-- ─── FIRMS ────────────────────────────────────────────────────────────────────
-- firms_select_admin_v2 → authenticated, sadece admin ✅
-- firms_select_personnel_v2 → authenticated, tüm org firmaları ✅
-- firms_insert_v2, firms_update_v2 (WITH CHECK), firms_delete_v2 → authenticated ✅

-- ─── FIRM ASSIGNMENTS ─────────────────────────────────────────────────────────
-- fa_select_admin_v2, fa_select_own_v2 → authenticated ✅
-- fa_insert_v2, fa_delete_v2 → authenticated ✅

-- ─── VISITS ───────────────────────────────────────────────────────────────────
-- visits_select_admin_v2, visits_select_own_v2 → authenticated ✅
-- visits_insert_v2, visits_update_own_v2, visits_update_admin_v2 (WITH CHECK) → authenticated ✅
-- visits_delete_v2 → authenticated ✅

-- ─── REPORTS ──────────────────────────────────────────────────────────────────
-- reports_select_admin_v2, reports_select_own_v2 → authenticated ✅
-- reports_insert_v2, reports_delete_v2 → authenticated ✅

-- ─── DOF RECORDS ──────────────────────────────────────────────────────────────
-- dof_select_v2, dof_insert_v2, dof_update_v2, dof_delete_v2 → authenticated ✅

-- ─── TRAININGS, EQUIPMENT, WORK_PERMITS, HEALTH_RECORDS, FIRM_DOCUMENTS ──────
-- Tüm _v2 policy'ler authenticated + WITH CHECK ile oluşturuldu ✅

-- ─── Eski {public} policy'leri temizlemek için (Supabase Dashboard > SQL Editor) ───
-- DROP POLICY IF EXISTS "org_select" ON organizations;
-- DROP POLICY IF EXISTS "org_update" ON organizations;
-- DROP POLICY IF EXISTS "profiles_select" ON profiles;
-- DROP POLICY IF EXISTS "profiles_insert_service" ON profiles;
-- DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
-- DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
-- DROP POLICY IF EXISTS "firms_select_admin" ON firms;
-- DROP POLICY IF EXISTS "firms_select_personnel" ON firms;
-- DROP POLICY IF EXISTS "firms_insert" ON firms;
-- DROP POLICY IF EXISTS "firms_update" ON firms;
-- DROP POLICY IF EXISTS "firms_delete" ON firms;
-- DROP POLICY IF EXISTS "fa_select_admin" ON firm_assignments;
-- DROP POLICY IF EXISTS "fa_select_own" ON firm_assignments;
-- DROP POLICY IF EXISTS "fa_insert" ON firm_assignments;
-- DROP POLICY IF EXISTS "fa_delete" ON firm_assignments;
-- DROP POLICY IF EXISTS "visits_select_admin" ON visits;
-- DROP POLICY IF EXISTS "visits_select_own" ON visits;
-- DROP POLICY IF EXISTS "visits_insert" ON visits;
-- DROP POLICY IF EXISTS "visits_update_own" ON visits;
-- DROP POLICY IF EXISTS "visits_update_admin" ON visits;
-- DROP POLICY IF EXISTS "visits_delete" ON visits;
-- DROP POLICY IF EXISTS "reports_select_admin" ON reports;
-- DROP POLICY IF EXISTS "reports_select_own" ON reports;
-- DROP POLICY IF EXISTS "reports_insert" ON reports;
-- DROP POLICY IF EXISTS "reports_delete" ON reports;
-- DROP POLICY IF EXISTS "dof_select" ON dof_records;
-- DROP POLICY IF EXISTS "dof_insert" ON dof_records;
-- DROP POLICY IF EXISTS "dof_update" ON dof_records;
-- DROP POLICY IF EXISTS "dof_delete" ON dof_records;
