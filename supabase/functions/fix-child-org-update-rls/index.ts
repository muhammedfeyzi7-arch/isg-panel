import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);

Deno.serve(async (_req) => {
  try {
    const queries = [
      // Drop existing update policy
      `DROP POLICY IF EXISTS orgs_update ON organizations`,
      // Recreate with parent_org_id support
      `CREATE POLICY orgs_update ON organizations
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
        )`
    ];

    const results = [];
    for (const sql of queries) {
      // Use service role to run raw SQL via Supabase Management API
      const projectRef = Deno.env.get('SUPABASE_URL')!.replace('https://', '').replace('.supabase.co', '');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      const resp = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ query: sql }),
        }
      );

      const result = await resp.json();
      results.push({ sql: sql.substring(0, 60), status: resp.status, result });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
