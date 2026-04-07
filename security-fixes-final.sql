-- ============================================================
-- URGENT PRODUCTION FIXES - Apply these in Supabase SQL Editor
-- ============================================================

-- FIX 1: Create RLS policy for denetci to UPDATE ekipmanlar
-- This allows denetci role to perform QR control operations
-- Application layer restricts fields to: sonKontrolTarihi, durum, kontrolGecmisi

CREATE POLICY "ekipmanlar_denetci_update" 
ON "ekipmanlar" 
FOR UPDATE 
TO authenticated 
USING (
  organization_id = get_my_org_id() 
  AND get_my_role() IN ('admin', 'member', 'denetci')
)
WITH CHECK (
  organization_id = get_my_org_id() 
  AND get_my_role() IN ('admin', 'member', 'denetci')
);

-- FIX 2: Fix activity_logs INSERT policy to prevent user_id spoofing
-- Drop the old policy that allowed any authenticated user to set any user_id
DROP POLICY IF EXISTS "activity_logs_insert_service" ON "activity_logs";

-- Create new policy that enforces user_id = auth.uid()
CREATE POLICY "activity_logs_insert_enforced" 
ON "activity_logs" 
FOR INSERT 
TO authenticated 
WITH CHECK (
  organization_id = get_my_org_id() 
  AND user_id = auth.uid()
);

-- FIX 8: Add index on kontrol_formlari for faster queries
CREATE INDEX IF NOT EXISTS idx_kontrol_formlari_org 
ON "kontrol_formlari"(organization_id);

-- ============================================================
-- MANUAL STEP REQUIRED: Storage Bucket Configuration
-- ============================================================
-- Go to Supabase Dashboard → Storage → uploads bucket → Settings
-- Set Max file size: 10MB (10485760 bytes)
-- Set Allowed MIME types: image/jpeg, image/png, application/pdf
-- ============================================================