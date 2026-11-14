import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Campsite } from "@/lib/labels";

/** キャンプ場一覧（公開データなのでサーバーでキャッシュする） */
export async function getCampsites(): Promise<Campsite[]> {
  "use cache";
  // ダッシュボードから CSV を取り込むので、1分ほどで反映されるようにしておく
  cacheLife("minutes");
  cacheTag("campsites");

  if (!isSupabaseConfigured) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("campsites")
    .select(
      "id, slug, name, prefecture, address, location_type, site_style, car_access, has_hot_water, has_shower, has_bath, fire_rule, official_url",
    )
    .order("prefecture")
    .order("name");
  if (error) throw new Error(`キャンプ場の取得に失敗しました: ${error.message}`);
  return data as Campsite[];
}
