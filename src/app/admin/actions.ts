"use server";

import { refresh, updateTag } from "next/cache";
import { CAMPSITE_IMAGES_TAG, CAMPSITE_IMAGE_BUCKET, MAX_CAMPSITE_IMAGES } from "@/lib/campsite-images";
import { parseFacilities } from "@/lib/facility-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLACE_ID_ERROR, parsePlaceId } from "@/lib/place-id";

// どの操作も DB の RLS で「運営だけ」に制限している。ここでも先に確かめて、わかりやすいエラーにする
async function adminClient() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("運営としてログインしていません");
  return supabase;
}

function changed() {
  updateTag(CAMPSITE_IMAGES_TAG);
  refresh();
}

async function nextSortOrder(supabase: Awaited<ReturnType<typeof adminClient>>, campsiteId: string) {
  const { data } = await supabase
    .from("campsite_images")
    .select("sort_order")
    .eq("campsite_id", campsiteId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return { next: (data?.[0]?.sort_order ?? -1) + 1 };
}

async function countImages(supabase: Awaited<ReturnType<typeof adminClient>>, campsiteId: string) {
  const { count } = await supabase
    .from("campsite_images")
    .select("id", { count: "exact", head: true })
    .eq("campsite_id", campsiteId);
  return count ?? 0;
}

/** ブラウザからアップロード済みの写真（自分で撮った写真）を登録する。最後尾に足す */
export async function addOwnImages(
  campsiteId: string,
  paths: string[],
  credit: string,
): Promise<{ error: string | null }> {
  const supabase = await adminClient();
  const valid = paths.filter((p) => new RegExp(`^${campsiteId}/[\\w-]+\\.jpg$`).test(p));
  if (valid.length === 0) return { error: "登録できる写真がありません。" };

  const current = await countImages(supabase, campsiteId);
  if (current + valid.length > MAX_CAMPSITE_IMAGES) {
    await supabase.storage.from(CAMPSITE_IMAGE_BUCKET).remove(valid);
    return { error: `写真は1キャンプ場につき${MAX_CAMPSITE_IMAGES}枚までです（今 ${current} 枚）。` };
  }

  const trimmed = credit.trim().slice(0, 40) || null;
  const { next } = await nextSortOrder(supabase, campsiteId);
  const { error } = await supabase.from("campsite_images").insert(
    valid.map((path, i) => ({
      campsite_id: campsiteId,
      source: "own",
      storage_path: path,
      credit: trimmed,
      sort_order: next + i,
    })),
  );
  if (error) {
    console.error("campsite image insert failed", error);
    await supabase.storage.from(CAMPSITE_IMAGE_BUCKET).remove(valid);
    return { error: "登録に失敗しました。時間をおいてもう一度お試しください。" };
  }
  changed();
  return { error: null };
}

/** 投稿者が許可したソト活の写真を採用する（ファイルはコピーせず、元の写真を参照する） */
export async function adoptCheckinPhoto(campsiteId: string, checkinPhotoId: string) {
  const supabase = await adminClient();
  if ((await countImages(supabase, campsiteId)) >= MAX_CAMPSITE_IMAGES) {
    throw new Error(`写真は1キャンプ場につき${MAX_CAMPSITE_IMAGES}枚までです`);
  }
  const { next } = await nextSortOrder(supabase, campsiteId);
  // 許可があるか・同じキャンプ場の投稿かは RLS で確かめている
  const { error } = await supabase.from("campsite_images").insert({
    campsite_id: campsiteId,
    source: "checkin",
    checkin_photo_id: checkinPhotoId,
    sort_order: next,
  });
  if (error) throw new Error(`採用に失敗しました: ${error.message}`);
  changed();
}

/** 1つ上（-1）・1つ下（+1）に動かす。並び順は 0, 1, 2… に振り直す */
export async function moveImage(campsiteId: string, imageId: string, direction: -1 | 1) {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("campsite_images")
    .select("id")
    .eq("campsite_id", campsiteId)
    .order("sort_order")
    .order("created_at");
  const ids = (data ?? []).map((r) => r.id as string);
  const i = ids.indexOf(imageId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(
    ids.map((id, order) => supabase.from("campsite_images").update({ sort_order: order }).eq("id", id)),
  );
  changed();
}

/** 自分で撮った写真の撮影者の表示を変える（空なら「ソトアソビ」と表示） */
export async function updateCredit(imageId: string, formData: FormData) {
  const supabase = await adminClient();
  const credit = String(formData.get("credit") ?? "").trim().slice(0, 40) || null;
  const { error } = await supabase
    .from("campsite_images")
    .update({ credit })
    .eq("id", imageId)
    .eq("source", "own");
  if (error) throw new Error(`保存に失敗しました: ${error.message}`);
  changed();
}

/**
 * 写真を外す。自分で撮った写真はファイルも消す。
 * ソト活から採用した写真は、紹介写真から外すだけ（投稿の写真はそのまま残る）
 */
export async function deleteImage(imageId: string) {
  const supabase = await adminClient();
  const { data: row } = await supabase
    .from("campsite_images")
    .select("source, storage_path")
    .eq("id", imageId)
    .maybeSingle();
  if (!row) return;
  const { error } = await supabase.from("campsite_images").delete().eq("id", imageId);
  if (error) throw new Error(`削除に失敗しました: ${error.message}`);
  if (row.source === "own" && row.storage_path) {
    const { error: removeError } = await supabase.storage.from(CAMPSITE_IMAGE_BUCKET).remove([row.storage_path]);
    if (removeError) console.error("campsite image file remove failed", removeError);
  }
  changed();
}

export type FacilitiesState = { error: string | null; saved: boolean };

/** キャンプ場の設備を直す（運営だけ。DB でも設備の列しか更新できないようにしている） */
export async function updateFacilities(
  campsiteId: string,
  _prev: FacilitiesState,
  formData: FormData,
): Promise<FacilitiesState> {
  const supabase = await adminClient();
  const parsed = parseFacilities(formData);
  if (!parsed.ok) return { error: parsed.error, saved: false };
  const placeId = parsePlaceId(formData.get("google_place_id"));
  if (placeId === undefined) return { error: PLACE_ID_ERROR, saved: false };

  const { error } = await supabase
    .from("campsites")
    .update({
      car_access: formData.get("car_access") === "yes",
      has_hot_water: formData.get("has_hot_water") === "yes",
      has_shower: formData.get("has_shower") === "yes",
      has_bath: formData.get("has_bath") === "yes",
      ...parsed.values,
      google_place_id: placeId,
    })
    .eq("id", campsiteId);
  if (error) {
    console.error("update facilities failed", error);
    return { error: `保存に失敗しました：${error.message}`, saved: false };
  }
  // キャンプ場ページ・一覧に、すぐ反映する
  updateTag("campsites");
  return { error: null, saved: true };
}
