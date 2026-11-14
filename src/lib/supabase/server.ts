import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseKey, supabaseUrl } from "./env";

/**
 * ログイン中のユーザーとして DB にアクセスするクライアント。
 * cookies() を読むので、使うコンポーネントは <Suspense> の内側に置くこと。
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component からは cookie を書けない。セッション更新は proxy.ts が担う。
        }
      },
    },
  });
}

/**
 * 誰が見ても同じ公開データ（キャンプ場など）を読むためのクライアント。
 * cookie を使わないので "use cache" の内側で使える。
 */
export function createSupabasePublicClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
