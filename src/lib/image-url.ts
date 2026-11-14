import { supabaseUrl } from "@/lib/supabase/env";

/** Supabase Storage の公開バケットにあるファイルの URL（サーバー・ブラウザ共通） */
export function storageUrl(bucket: "checkin-photos" | "campsite-images", path: string) {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
