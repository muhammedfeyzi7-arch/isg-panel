import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('[delete-ekipman] body:', JSON.stringify(body));

    const { ids } = body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      console.error('[delete-ekipman] ids missing or empty');
      return new Response(JSON.stringify({ error: 'ids required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceKey) {
      console.error('[delete-ekipman] Missing env vars');
      return new Response(JSON.stringify({ error: 'Server config error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service role — RLS tamamen bypass
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    console.log('[delete-ekipman] Deleting ids:', ids);

    const { data, error, count } = await supabase
      .from('ekipmanlar')
      .delete()
      .in('id', ids)
      .select();

    if (error) {
      console.error('[delete-ekipman] Supabase error:', JSON.stringify(error));
      return new Response(JSON.stringify({ error: error.message, details: error.details, code: error.code }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[delete-ekipman] Deleted rows:', data?.length ?? 0);

    return new Response(JSON.stringify({ success: true, deleted: data?.length ?? 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[delete-ekipman] Unexpected error:', String(err));
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
