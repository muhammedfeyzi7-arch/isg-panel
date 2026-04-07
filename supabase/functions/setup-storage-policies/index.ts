import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const policies = [
    {
      name: 'uploads_authenticated_insert',
      sql: `CREATE POLICY IF NOT EXISTS "uploads_authenticated_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'uploads');`,
    },
    {
      name: 'uploads_authenticated_update',
      sql: `CREATE POLICY IF NOT EXISTS "uploads_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'uploads');`,
    },
    {
      name: 'uploads_public_select',
      sql: `CREATE POLICY IF NOT EXISTS "uploads_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');`,
    },
  ];

  const results: { name: string; status: string; error?: string }[] = [];

  for (const policy of policies) {
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: policy.sql }).maybeSingle();
    if (error) {
      // Try direct query
      const { error: err2 } = await supabaseAdmin.from('_sql').select('*').limit(0);
      results.push({ name: policy.name, status: error ? 'skipped' : 'ok', error: error?.message });
    } else {
      results.push({ name: policy.name, status: 'ok' });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
