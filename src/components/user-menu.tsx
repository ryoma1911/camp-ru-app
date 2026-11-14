import { signInWithGoogle } from "@/app/auth/actions";
import { AccountMenu } from "@/components/account-menu";
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

  return <AccountMenu name={profile.display_name} admin={admin} />;
}
