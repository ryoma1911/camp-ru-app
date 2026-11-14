"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { checkinsTag } from "@/lib/campsites";
import { FIRE_STATUS, GROUND_TYPE, PEG_NEEDED, SLEEP_QUALITY } from "@/lib/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CheckinFormState = { error: string | null };

const MAX_PHOTOS = 4;

function pick<T extends Record<string, unknown>>(labels: T, value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v in labels ? (v as keyof T & string) : null;
}

function intInRange(value: FormDataEntryValue | null, min: number, max: number) {
  if (typeof value !== "string" || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined; // undefined = 不正な値
}

function triState(value: FormDataEntryValue | null) {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

export async function createCheckin(
  campsite: { id: string; slug: string },
  _prev: CheckinFormState,
  formData: FormData,
): Promise<CheckinFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { error: "ログインが切れました。もう一度ログインしてください。" };

  // ---- 入力チェック ----
  const visitedOn = String(formData.get("visited_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedOn) || Number.isNaN(Date.parse(visitedOn))) {
    return { error: "行った日を選んでください。" };
  }
  const groundType = pick(GROUND_TYPE, formData.get("ground_type"));
  const pegNeeded = pick(PEG_NEEDED, formData.get("peg_needed"));
  const fireStatus = pick(FIRE_STATUS, formData.get("fire_status"));
  if (!groundType || !pegNeeded || !fireStatus) {
    return { error: "地面・ペグ・焚き火は必ず選んでください。" };
  }
  const minTemp = intInRange(formData.get("min_temp_c"), -40, 45);
  const bagComfort = intInRange(formData.get("sleeping_bag_comfort_c"), -40, 30);
  const bugLevel = intInRange(formData.get("bug_level"), 1, 3);
  if (minTemp === undefined || bagComfort === undefined || bugLevel === undefined) {
    return { error: "入力値が正しくありません。選び直してください。" };
  }
  const comment = String(formData.get("comment") ?? "").trim();
  if (comment.length > 500) return { error: "ひとことは500文字以内にしてください。" };

  // 写真は事前にブラウザからアップロード済み。自分のフォルダのものだけ受け付ける
  const photoPaths = formData
    .getAll("photo_paths")
    .map(String)
    .filter((p) => p.startsWith(`${userId}/`) && /^[\w-]+\/[\w-]+\.jpg$/.test(p))
    .slice(0, MAX_PHOTOS);

  // ---- 保存 ----
  const { data: checkin, error } = await supabase
    .from("checkins")
    .insert({
      user_id: userId,
      campsite_id: campsite.id,
      visited_on: visitedOn,
      min_temp_c: minTemp,
      temp_measured: formData.get("temp_measured") === "yes",
      temp_at_dawn: formData.get("temp_at_dawn") !== "no",
      sleeping_bag_comfort_c: bagComfort,
      sleep_quality: pick(SLEEP_QUALITY, formData.get("sleep_quality")),
      ground_type: groundType,
      peg_needed: pegNeeded,
      fire_status: fireStatus,
      bug_level: bugLevel,
      car_access_ok: triState(formData.get("car_access_ok")),
      hot_water_ok: triState(formData.get("hot_water_ok")),
      comment: comment || null,
    })
    .select("id")
    .single();
  if (error || !checkin) {
    console.error("checkin insert failed", error);
    return { error: "保存に失敗しました。時間をおいてもう一度お試しください。" };
  }

  if (photoPaths.length > 0) {
    const { error: photoError } = await supabase
      .from("checkin_photos")
      .insert(photoPaths.map((path, i) => ({ checkin_id: checkin.id, storage_path: path, sort_order: i })));
    if (photoError) console.error("checkin photos insert failed", photoError);
  }

  updateTag(checkinsTag(campsite.id));
  redirect(`/campsites/${campsite.slug}?posted=1`);
}
