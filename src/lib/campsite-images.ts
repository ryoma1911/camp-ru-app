import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { storageUrl } from "@/lib/image-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/server";

/** キャンプ場の画像の読み出しに付けるタグ。登録・並べ替え・削除、投稿の削除・許可の取り消しで入れ替える */
export const CAMPSITE_IMAGES_TAG = "campsite-images";
export const CAMPSITE_IMAGE_BUCKET = "campsite-images";
/** 1キャンプ場あたりの上限 */
export const MAX_CAMPSITE_IMAGES = 10;

export type CampsiteImage = {
  id: string;
  source: "own" | "checkin";
  url: string;
  /** 写真の下に出す撮影者の表示（例：「撮影：Campる」「撮影：キャン活／キャンパー1234」） */
  credit: string;
  /** own のときだけ。管理画面で撮影者の表示を編集するのに使う */
  rawCredit: string | null;
  /** own のときだけ。削除するときに Storage のファイルも消すのに使う */
  storagePath: string | null;
};

const IMAGE_COLUMNS =
  "id, campsite_id, source, storage_path, credit, sort_order, checkin_photos(storage_path, checkins(profiles(display_name)))";

type Row = {
  id: string;
  campsite_id: string;
  source: "own" | "checkin";
  storage_path: string | null;
  credit: string | null;
  sort_order: number;
  checkin_photos: { storage_path: string; checkins: { profiles: { display_name: string } | null } | null } | null;
};

function toImage(r: Row): CampsiteImage | null {
  if (r.source === "own" && r.storage_path) {
    return {
      id: r.id,
      source: "own",
      url: storageUrl("campsite-images", r.storage_path),
      credit: `撮影：${r.credit || "Campる"}`,
      rawCredit: r.credit,
      storagePath: r.storage_path,
    };
  }
  if (r.source === "checkin" && r.checkin_photos) {
    const name = r.checkin_photos.checkins?.profiles?.display_name ?? "キャンパー";
    return {
      id: r.id,
      source: "checkin",
      url: storageUrl("checkin-photos", r.checkin_photos.storage_path),
      credit: `撮影：キャン活／${name}`,
      rawCredit: null,
      storagePath: null,
    };
  }
  return null;
}

/** 1キャンプ場の画像を並び順に（先頭がカバー写真）。管理画面はキャッシュせずに直接呼ぶ */
export async function loadCampsiteImages(supabase: SupabaseClient, campsiteId: string): Promise<CampsiteImage[]> {
  const { data, error } = await supabase
    .from("campsite_images")
    .select(IMAGE_COLUMNS)
    .eq("campsite_id", campsiteId)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`キャンプ場の画像の取得に失敗しました: ${error.message}`);
  return ((data ?? []) as unknown as Row[]).map(toImage).filter((i): i is CampsiteImage => i != null);
}

/** キャンプ場ページに出す画像 */
export async function getCampsiteImages(campsiteId: string): Promise<CampsiteImage[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CAMPSITE_IMAGES_TAG);

  if (!isSupabaseConfigured) return [];
  return loadCampsiteImages(createSupabasePublicClient(), campsiteId);
}

/**
 * 全キャンプ場のカバー写真の URL（キャンプ場 ID → URL）。写真がないキャンプ場は入らない。
 * トップのカードと検索結果の一覧で使う
 */
export async function getCampsiteCovers(): Promise<Record<string, string>> {
  "use cache";
  cacheLife("hours");
  cacheTag(CAMPSITE_IMAGES_TAG);

  if (!isSupabaseConfigured) return {};
  const { data, error } = await createSupabasePublicClient()
    .from("campsite_images")
    .select(IMAGE_COLUMNS)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`カバー写真の取得に失敗しました: ${error.message}`);

  const covers: Record<string, string> = {};
  for (const r of (data ?? []) as unknown as Row[]) {
    if (covers[r.campsite_id]) continue;
    const image = toImage(r);
    if (image) covers[r.campsite_id] = image.url;
  }
  return covers;
}
