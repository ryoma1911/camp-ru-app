import { signInWithGoogle, signOut } from "@/app/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** cookie を読むので、呼び出し側で <Suspense> に包むこと */
export async function UserMenu() {
  if (!isSupabaseConfigured) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!claims) {
    return (
      <form action={signInWithGoogle}>
        <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          Googleでログイン
        </button>
      </form>
    );
  }

  const meta = (claims.user_metadata ?? {}) as { full_name?: string; name?: string };
  return (
    <form action={signOut} className="flex items-center gap-3 text-sm">
      <span className="text-stone-600">{meta.full_name ?? meta.name ?? "ログイン中"}</span>
      <button className="rounded-full border border-stone-300 px-3 py-1.5 hover:bg-stone-100">
        ログアウト
      </button>
    </form>
  );
}
