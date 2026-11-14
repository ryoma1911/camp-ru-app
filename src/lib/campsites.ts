import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Campsite, Checkin } from "@/lib/labels";

const CAMPSITE_COLUMNS =
  "id, slug, name, prefecture, address, lat, lng, location_type, site_style, car_access, has_hot_water, has_shower, has_bath, fire_rule, official_url";

export const CHECKIN_COLUMNS =
  "id, user_id, campsite_id, visited_on, min_temp_c, temp_measured, temp_at_dawn, sleeping_bag_comfort_c, sleep_quality, ground_type, peg_needed, fire_status, bug_level, car_access_ok, hot_water_ok, comment, created_at, profiles(display_name, avatar_url), checkin_photos(storage_path, sort_order)";

export const checkinsTag = (campsiteId: string) => `checkins-${campsiteId}`;
/** ニックネーム変更など、全キャンプ場のキャン活表示に影響する変更で使う */
export const ALL_CHECKINS_TAG = "checkins";
/** トップの一覧に出す簡易集計。投稿・編集・削除のたびに入れ替える */
export const SUMMARIES_TAG = "checkin-summaries";

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
    .select(CAMPSITE_COLUMNS)
    .order("prefecture")
    .order("name");
  if (error) throw new Error(`キャンプ場の取得に失敗しました: ${error.message}`);
  return data as Campsite[];
}

export async function getCampsite(slug: string): Promise<Campsite | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("campsites");

  if (!isSupabaseConfigured) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("campsites")
    .select(CAMPSITE_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`キャンプ場の取得に失敗しました: ${error.message}`);
  return data as Campsite | null;
}

/** キャンプ場の新しい順のキャン活。投稿されたら updateTag で即座に入れ替える */
export async function getRecentCheckins(campsiteId: string): Promise<Checkin[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(checkinsTag(campsiteId), ALL_CHECKINS_TAG);

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("checkins")
    .select(CHECKIN_COLUMNS)
    .eq("campsite_id", campsiteId)
    .order("visited_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`キャン活の取得に失敗しました: ${error.message}`);
  return data as unknown as Checkin[];
}
