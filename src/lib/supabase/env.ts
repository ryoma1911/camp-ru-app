export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

/** .env.local が未設定でも画面が落ちないようにするための判定 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
