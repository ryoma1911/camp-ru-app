import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NEXT_PATH_COOKIE = "post_login_next";

/** Google ログイン後に Supabase から戻ってくる先。code をセッションに交換する */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = request.cookies.get(NEXT_PATH_COOKIE)?.value ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  let response = NextResponse.redirect(`${origin}/?login_error=1`);
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) response = NextResponse.redirect(`${origin}${safeNext}`);
  }
  response.cookies.delete(NEXT_PATH_COOKIE);
  return response;
}
