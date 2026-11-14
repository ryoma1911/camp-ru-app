import Link from "next/link";
import { signInWithGoogle, signOut } from "@/app/auth/actions";
import { isAdmin } from "@/lib/admin";
import { getMyProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** cookie を読むので、呼び出し側で <Suspense> に包むこと */
export async function UserMenu() {
  if (!isSupabaseConfigured) return null;

  const [profile, admin] = await Promise.all([getMyProfile(), isAdmin()]);
  if (!profile) {
    return (
      <form action={signInWithGoogle}>
        <button className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          Googleでログイン
        </button>
      </form>
    );
  }

  return (
    <form action={signOut} className="flex items-center gap-3 text-sm">
      {admin && (
        <Link href="/admin" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-200">
          管理
        </Link>
      )}
      <Link href="/me" className="max-w-[10rem] truncate text-stone-700 underline-offset-4 hover:underline">
        {profile.display_name}
      </Link>
      <button className="rounded-full border border-stone-300 px-3 py-1.5 hover:bg-stone-100">ログアウト</button>
    </form>
  );
}
