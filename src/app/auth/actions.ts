"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "use server" のファイルからは関数しか export できないので、定数はここだけで使う
const NEXT_PATH_COOKIE = "post_login_next";

/** フォームに hidden の next（例: /campsites/xxx/checkin）があれば、ログイン後にそこへ戻す */
export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get("next") ?? "");
  if (next.startsWith("/") && !next.startsWith("//")) {
    (await cookies()).set(NEXT_PATH_COOKIE, next, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
  }

  const supabase = await createSupabaseServerClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/?login_error=1");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
