import "server-only";
import { FIRE_STATUS, GROUND_TYPE, PEG_NEEDED, SLEEP_QUALITY } from "@/lib/labels";

export type CheckinFormState = { error: string | null };

export const MAX_PHOTOS = 4;
export const PHOTO_BUCKET = "checkin-photos";

export type CheckinFields = {
  visited_on: string;
  min_temp_c: number | null;
  temp_measured: boolean;
  temp_at_dawn: boolean;
  sleeping_bag_comfort_c: number | null;
  sleep_quality: keyof typeof SLEEP_QUALITY | null;
  ground_type: keyof typeof GROUND_TYPE;
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: number | null;
  car_access_ok: boolean | null;
  hot_water_ok: boolean | null;
  comment: string | null;
  photo_reuse_ok: boolean;
};

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

/** 投稿フォームの値をチェックして DB に入れる形にする。問題があればエラー文を返す */
export function parseCheckinForm(
  formData: FormData,
  userId: string,
): { ok: true; fields: CheckinFields; photoPaths: string[] } | { ok: false; error: string } {
  const visitedOn = String(formData.get("visited_on") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitedOn) || Number.isNaN(Date.parse(visitedOn))) {
    return { ok: false, error: "行った日を選んでください。" };
  }
  const groundType = pick(GROUND_TYPE, formData.get("ground_type"));
  const pegNeeded = pick(PEG_NEEDED, formData.get("peg_needed"));
  const fireStatus = pick(FIRE_STATUS, formData.get("fire_status"));
  if (!groundType || !pegNeeded || !fireStatus) {
    return { ok: false, error: "地面・ペグ・焚き火は必ず選んでください。" };
  }
  const minTemp = intInRange(formData.get("min_temp_c"), -40, 45);
  const bagComfort = intInRange(formData.get("sleeping_bag_comfort_c"), -40, 30);
  const bugLevel = intInRange(formData.get("bug_level"), 1, 3);
  if (minTemp === undefined || bagComfort === undefined || bugLevel === undefined) {
    return { ok: false, error: "入力値が正しくありません。選び直してください。" };
  }
  const comment = String(formData.get("comment") ?? "").trim();
  if (comment.length > 500) return { ok: false, error: "ひとことは500文字以内にしてください。" };

  // 写真は事前にブラウザからアップロード済み。自分のフォルダのものだけ受け付ける
  const photoPaths = [
    ...new Set(
      formData
        .getAll("photo_paths")
        .map(String)
        .filter((p) => p.startsWith(`${userId}/`) && /^[\w-]+\/[\w-]+\.jpg$/.test(p)),
    ),
  ].slice(0, MAX_PHOTOS);

  return {
    ok: true,
    photoPaths,
    fields: {
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
      // 写真がない投稿は許可しても意味がないので false にする
      photo_reuse_ok: formData.get("photo_reuse_ok") === "yes" && photoPaths.length > 0,
    },
  };
}
