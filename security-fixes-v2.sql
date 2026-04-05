-- ============================================================
-- PRODUCTION SECURITY FIXES v2
-- Apply these in Supabase SQL Editor → Run each block
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Allow denetci to UPDATE ekipmanlar
-- Field restriction (only durum/sonKontrolTarihi/kontrolGecmisi)
-- is enforced at application level in QrDetailPage.tsx
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "ekipmanlar_denetci_update"
ON ekipmanlar
FOR UPDATE
TO public
USING (
  organization_id = get_my_org_id()
  AND get_my_role() = 'denetci'
)
WITH CHECK (
  organization_id = get_my_org_id()
  AND get_my_role() = 'denetci'
);

-- ─────────────────────────────────────────────────────────────
-- FIX 5: Fix activity_logs INSERT — enforce user_id = auth.uid()
-- Prevents malicious users from spoofing other users' audit logs
-- ─────────────────────────────────────────────────────────────
ALTER POLICY "activity_logs_insert_service"
ON activity_logs
WITH CHECK (
  organization_id = get_my_org_id()
  AND auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- ─────────────────────────────────────────────────────────────
-- FIX 8: Index on kontrol_formlari (already applied, idempotent)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kontrol_formlari_org
ON kontrol_formlari(organization_id);

-- ─────────────────────────────────────────────────────────────
-- BONUS: Additional indexes for performance at scale
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created
ON activity_logs(organization_id, created_at DESC);

-- Verify policies applied correctly:
-- SELECT tablename, policyname, cmd, with_check
-- FROM pg_policies
-- WHERE tablename IN ('ekipmanlar', 'activity_logs')
-- ORDER BY tablename, policyname;
