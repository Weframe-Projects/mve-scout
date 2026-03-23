import { createClient } from "@supabase/supabase-js";

// Server-side client with service role key (for logging — bypasses RLS)
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.warn("[Supabase] Missing env vars — logging disabled");
    return null;
  }
  return createClient(url, key);
}

// Log a search action to the search_logs table
export async function logSearch(params: {
  action: string;
  platform?: string;
  query?: string;
  filters?: Record<string, unknown>;
  resultCount?: number;
  userAgent?: string;
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    await supabase.from("search_logs").insert({
      action: params.action,
      platform: params.platform || null,
      query: params.query || null,
      filters: params.filters || null,
      result_count: params.resultCount ?? null,
      user_agent: params.userAgent || null,
    });
  } catch (err) {
    console.error("[Supabase] Failed to log search:", err);
  }
}
