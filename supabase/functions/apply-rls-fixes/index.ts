import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Only allow internal calls
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: Record<string, string> = {};

  // ─── AŞAMA 0: orgs_update — parent_org_id desteği ekle ──────────────────
  // OSGB admin, kendi alt firmalarını (child orgs) güncelleyebilsin
  // Örnek: çöp kutusundan geri alma, is_active değiştirme
  const { error: e0 } = await adminClient.rpc('exec_sql' as never, {
    sql: `
      DO $$
      BEGIN
        DROP POLICY IF EXISTS orgs_update ON organizations;
        CREATE POLICY orgs_update ON organizations
          FOR UPDATE
          TO public
          USING (
            (id IN (
              SELECT uo.organization_id FROM user_organizations uo
              WHERE uo.user_id = auth.uid() AND uo.role = 'admin'
            ))
            OR
            (parent_org_id IN (
              SELECT uo.organization_id FROM user_organizations uo
              WHERE uo.user_id = auth.uid() AND uo.role = 'admin'
            ))
            OR
            (EXISTS (
              SELECT 1 FROM profiles p
              WHERE p.user_id = auth.uid() AND p.is_super_admin = true
            ))
          )
          WITH CHECK (
            (id IN (
              SELECT uo.organization_id FROM user_organizations uo
              WHERE uo.user_id = auth.uid() AND uo.role = 'admin'
            ))
            OR
            (parent_org_id IN (
              SELECT uo.organization_id FROM user_organizations uo
              WHERE uo.user_id = auth.uid() AND uo.role = 'admin'
            ))
            OR
            (EXISTS (
              SELECT 1 FROM profiles p
              WHERE p.user_id = auth.uid() AND p.is_super_admin = true
            ))
          );
      END $$;
    `
  });
  results['orgs_update_parent_fix'] = e0 ? `ERROR: ${e0.message}` : 'OK';

  // ─── AŞAMA 1: firmalar — gezici uzman SELECT policy ───────────────────────
  const { error: e1 } = await adminClient.rpc('exec_sql' as never, {
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename  = 'firmalar'
            AND policyname = 'firmalar_gezici_uzman_select'
        ) THEN
          CREATE POLICY firmalar_gezici_uzman_select
            ON public.firmalar
            FOR SELECT
            TO authenticated
            USING (
              can_access_org(organization_id)
              AND EXISTS (
                SELECT 1 FROM user_organizations
                WHERE user_id   = auth.uid()
                  AND is_active = true
                  AND osgb_role = 'gezici_uzman'
              )
            );
        END IF;
      END $$;
    `
  });
  results['firmalar_gezici_uzman_select'] = e1 ? `ERROR: ${e1.message}` : 'OK';

  // ─── AŞAMA 2: activity_logs — trigger'ları kaldır, sadece RLS ile çalış ──
  const { error: e2 } = await adminClient.rpc('exec_sql' as never, {
    sql: `
      DO $$
      BEGIN
        DROP TRIGGER IF EXISTS activity_logs_enforce_user ON public.activity_logs;
        DROP TRIGGER IF EXISTS enforce_activity_log_user_trigger ON public.activity_logs;
      END $$;
    `
  });
  results['activity_logs_triggers_dropped'] = e2 ? `ERROR: ${e2.message}` : 'OK';

  // ─── AŞAMA 3: activity_logs RLS — can_access_org modeline geç ─────────────
  const { error: e3 } = await adminClient.rpc('exec_sql' as never, {
    sql: `
      DO $$
      BEGIN
        DROP POLICY IF EXISTS activity_logs_insert_service ON public.activity_logs;
        DROP POLICY IF EXISTS activity_logs_select         ON public.activity_logs;

        CREATE POLICY activity_logs_select
          ON public.activity_logs
          FOR SELECT
          TO authenticated
          USING (
            organization_id = get_my_org_id()
            OR can_access_org(organization_id)
          );

        CREATE POLICY activity_logs_insert
          ON public.activity_logs
          FOR INSERT
          TO authenticated
          WITH CHECK (
            can_access_org(organization_id)
            AND auth.uid() IS NOT NULL
          );
      END $$;
    `
  });
  results['activity_logs_rls_updated'] = e3 ? `ERROR: ${e3.message}` : 'OK';

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
