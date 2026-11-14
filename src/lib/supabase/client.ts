"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

/** ブラウザから Supabase を使うクライアント（写真のアップロードに使う） */
export function createSupabaseBrowserClient() {
  return createBrowserClient(supabaseUrl, supabaseKey);
}

export function photoPublicUrl(path: string) {
  return `${supabaseUrl}/storage/v1/object/public/checkin-photos/${path}`;
}
