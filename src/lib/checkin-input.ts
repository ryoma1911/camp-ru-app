import "server-only";
import { FIRE_STATUS, HEATER, PARTY_TYPE, PEG_NEEDED, SLEEP_QUALITY } from "@/lib/labels";

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
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: number | null;
  party_type: keyof typeof PARTY_TYPE | null;
  heaters: (keyof typeof HEATER)[] | null;
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

/** 使った暖房（複数）。決まった値だけを決まった順に。1つも選んでいなければ記録なし（null） */
function heaters(formData: FormData): (keyof typeof HEATER)[] | null | undefined {
  const picked = new Set(formData.getAll("heaters").map(String));
  const values = (Object.keys(HEATER) as (keyof typeof HEATER)[]).filter((k) => picked.has(k));
  if (values.includes("none") && values.length > 1) return undefined; // undefined = 不正な組み合わせ
  return values.length ? values : null;
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
  const pegNeeded = pick(PEG_NEEDED, formData.get("peg_needed"));
  const fireStatus = pick(FIRE_STATUS, formData.get("fire_status"));
  if (!pegNeeded || !fireStatus) {
    return { ok: false, error: "地面の固さ・焚き火は必ず選んでください。" };
  }
  const minTemp = intInRange(formData.get("min_temp_c"), -40, 45);
  const bagComfort = intInRange(formData.get("sleeping_bag_comfort_c"), -40, 30);
  const bugLevel = intInRange(formData.get("bug_level"), 1, 3);
  if (minTemp === undefined || bagComfort === undefined || bugLevel === undefined) {
    return { ok: false, error: "入力値が正しくありません。選び直してください。" };
  }
  const heaterValues = heaters(formData);
  if (heaterValues === undefined) {
    return { ok: false, error: "暖房の「使わなかった」は、ストーブと一緒に選べません。" };
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
      // 地面（ground_type）はフォームから外した。新しい投稿は空欄、編集では元の値に触らない
      peg_needed: pegNeeded,
      fire_status: fireStatus,
      bug_level: bugLevel,
      // 車の乗り入れ・炊事場のお湯はフォームから外した（列は残すが、ここでは触らない）
      party_type: pick(PARTY_TYPE, formData.get("party_type")),
      heaters: heaterValues,
      comment: comment || null,
      // 写真がない投稿は許可しても意味がないので false にする
      photo_reuse_ok: formData.get("photo_reuse_ok") === "yes" && photoPaths.length > 0,
    },
  };
}
