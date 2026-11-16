"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { joinAddress } from "@/lib/address";
import { parseFacilities } from "@/lib/facility-input";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE } from "@/lib/labels";
import { PREFECTURES } from "@/lib/search";
import { generateSlug } from "@/lib/slug";
import { parseUrl } from "@/lib/submission-input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLACE_ID_ERROR, parsePlaceId } from "@/lib/place-id";

export type ApproveState = { error: string | null };

const REJECT_REASONS = ["duplicate", "not_campsite", "insufficient"] as const;

async function adminClient() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("is_admin");
  if (data !== true) throw new Error("運営としてログインしていません");
  return supabase;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").normalize("NFKC").trim();

function coordinate(value: string, min: number, max: number) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

/**
 * 運営が内容を直して公開する（campsites への追加と申請の更新を、DB の関数で1度に行う）。
 * slug は自動で作る（都道府県のローマ字＋ランダムな6文字。例：nagano-k3f9a2）
 */
export async function approveSubmission(id: string, _prev: ApproveState, formData: FormData): Promise<ApproveState> {
  const supabase = await adminClient();

  const name = text(formData, "name");
  const prefecture = text(formData, "prefecture");
  const address = text(formData, "address");
  const locationType = text(formData, "location_type");
  const siteStyle = text(formData, "site_style");
  const fireRule = text(formData, "fire_rule");
  const officialUrl = parseUrl(text(formData, "official_url"));
  const lat = coordinate(text(formData, "lat"), 20, 46);
  const lng = coordinate(text(formData, "lng"), 122, 154);
  const adminNote = text(formData, "admin_note").slice(0, 500) || null;

  if (!name) return { error: "正式名を入れてください。" };
  if (!(PREFECTURES as readonly string[]).includes(prefecture)) return { error: "都道府県を選んでください。" };
  // campsites の住所は都道府県から始める（命名規則）。欄の先頭に都道府県があってもなくても同じ形にする
  const joined = joinAddress(prefecture, address);
  if (!joined.ok) return { error: joined.error };
  if (!(locationType in LOCATION_TYPE) || !(siteStyle in SITE_STYLE) || !(fireRule in FIRE_RULE)) {
    return { error: "種類・サイト・焚き火を選んでください（公開には必須です）。" };
  }
  if (officialUrl === undefined) return { error: "公式サイトのURLが正しくありません。" };
  const placeId = parsePlaceId(formData.get("google_place_id"));
  if (placeId === undefined) return { error: PLACE_ID_ERROR };
  if (lat === undefined || lng === undefined) return { error: "緯度・経度が日本の範囲外か、数字ではありません。" };
  if ((lat == null) !== (lng == null)) return { error: "緯度と経度は両方入れるか、両方空にしてください。" };
  const facilities = parseFacilities(formData);
  if (!facilities.ok) return { error: facilities.error };
  const f = facilities.values;

  // 作った slug がたまたま使われていたら（31文字×6桁なので、まず起きない）作り直す
  let campsiteId: string | null = null;
  let error: { message: string; hint?: string; code?: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await supabase.rpc("approve_campsite_submission", {
      p_submission_id: id,
      p_slug: generateSlug(prefecture),
      p_name: name,
      p_prefecture: prefecture,
      p_address: joined.address,
      p_lat: lat,
      p_lng: lng,
      p_location_type: locationType,
      p_site_style: siteStyle,
      p_fire_rule: fireRule,
      p_car_access: formData.get("car_access") === "yes",
      p_has_hot_water: formData.get("has_hot_water") === "yes",
      p_has_shower: formData.get("has_shower") === "yes",
      p_has_bath: formData.get("has_bath") === "yes",
      p_has_kitchen: f.has_kitchen,
      p_garbage: f.garbage,
      p_ac_power: f.ac_power,
      p_has_shop: f.has_shop,
      p_shop_items: f.shop_items,
      p_has_wifi: f.has_wifi,
      p_payment_methods: f.payment_methods,
      p_official_url: officialUrl,
      p_google_place_id: placeId,
      p_admin_note: adminNote,
    });
    campsiteId = result.data;
    error = result.error;
    if (error?.code !== "23505" || !error.message.includes("slug")) break;
  }
  if (error || !campsiteId) {
    console.error("approve submission failed", error);
    if (error?.hint === "not_pending") return { error: "この申請はすでに確認済みです。" };
    return { error: `公開に失敗しました：${error?.message ?? "不明なエラー"}` };
  }

  // キャンプ場一覧・トップの「最近登録された」に出す
  updateTag("campsites");
  redirect(`/admin/submissions?status=approved&id=${id}`);
}

/** 見送る（理由は運営のメモとして残すだけで、申請者には知らせない） */
export async function rejectSubmission(id: string, formData: FormData) {
  const supabase = await adminClient();
  const reason = text(formData, "reject_reason");
  if (!(REJECT_REASONS as readonly string[]).includes(reason)) throw new Error("見送る理由を選んでください");
  const { error } = await supabase
    .from("campsite_submissions")
    .update({
      status: "rejected",
      reject_reason: reason,
      admin_note: text(formData, "admin_note").slice(0, 500) || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(`見送りに失敗しました: ${error.message}`);
  refresh();
  redirect(`/admin/submissions?status=rejected&id=${id}`);
}
