import "server-only";
import { joinAddress } from "@/lib/address";
import { parseFacilities } from "@/lib/facility-input";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE, type Facilities } from "@/lib/labels";
import { normalizePostal } from "@/lib/postal";
import { PREFECTURES } from "@/lib/search";

export const MAX_PENDING_SUBMISSIONS = 5;

export const SUBMISSION_FACILITIES = {
  car_access: "車乗り入れ",
  has_hot_water: "炊事場お湯",
  has_shower: "シャワー",
  has_bath: "風呂",
} as const;

export type SubmissionFields = Facilities & {
  name: string;
  prefecture: string;
  address: string;
  postal_code: string | null;
  official_url: string | null;
  location_type: keyof typeof LOCATION_TYPE | null;
  site_style: keyof typeof SITE_STYLE | null;
  fire_rule: keyof typeof FIRE_RULE | null;
  car_access: boolean | null;
  has_hot_water: boolean | null;
  has_shower: boolean | null;
  has_bath: boolean | null;
  note: string | null;
};

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").normalize("NFKC").trim();

function pick<T extends Record<string, unknown>>(labels: T, value: string) {
  return value in labels ? (value as keyof T & string) : null;
}

export function parseUrl(value: string): string | null | undefined {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined; // undefined = 不正な値
  }
}

/** キャンプ場登録フォームの値をチェックする（任意の項目は空 =「わからない」で null） */
export function parseSubmissionForm(
  formData: FormData,
): { ok: true; fields: SubmissionFields } | { ok: false; error: string } {
  const name = text(formData, "name");
  const prefecture = text(formData, "prefecture");
  const city = text(formData, "city");
  const street = text(formData, "street");
  const postalInput = text(formData, "postal_code");
  const postalCode = postalInput ? normalizePostal(postalInput) : null;
  if (!name || name.length > 80) return { ok: false, error: "キャンプ場名を80文字以内で入れてください。" };
  if (!(PREFECTURES as readonly string[]).includes(prefecture)) return { ok: false, error: "都道府県を選んでください。" };
  if (postalInput && !postalCode) return { ok: false, error: "郵便番号は7桁の数字で入れてください（例：123-4567）。" };
  if (!city) return { ok: false, error: "市区町村を入れてください。" };
  if (city.length > 100 || street.length > 100) return { ok: false, error: "住所が長すぎます。" };
  // 住所は「都道府県＋市区町村＋丁目番地号」を1つにして、都道府県から始まる形で保存する
  // （市区町村の欄に都道府県から入れていても二重にしない）
  const joined = joinAddress(prefecture, `${city}${street}`);
  if (!joined.ok) return { ok: false, error: joined.error };
  const officialUrl = parseUrl(text(formData, "official_url"));
  if (officialUrl === undefined) return { ok: false, error: "公式サイトは https:// から始まるURLを入れてください。" };
  const note = text(formData, "note");
  if (note.length > 500) return { ok: false, error: "運営へのひとことは500文字以内にしてください。" };

  // 設備はチェックしたものだけ「あり」。チェックしていないものは「わからない」として運営が確認する
  const facility = (key: keyof typeof SUBMISSION_FACILITIES) => (formData.get(key) === "yes" ? true : null);
  // 追加の6項目（あり・なし・わからない、複数選べる項目）
  const facilities = parseFacilities(formData);
  if (!facilities.ok) return { ok: false, error: facilities.error };

  return {
    ok: true,
    fields: {
      name,
      prefecture,
      address: joined.address,
      postal_code: postalCode,
      official_url: officialUrl,
      location_type: pick(LOCATION_TYPE, text(formData, "location_type")),
      site_style: pick(SITE_STYLE, text(formData, "site_style")),
      fire_rule: pick(FIRE_RULE, text(formData, "fire_rule")),
      car_access: facility("car_access"),
      has_hot_water: facility("has_hot_water"),
      has_shower: facility("has_shower"),
      has_bath: facility("has_bath"),
      ...facilities.values,
      note: note || null,
    },
  };
}
