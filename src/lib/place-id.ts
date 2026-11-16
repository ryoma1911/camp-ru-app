import type { Campsite } from "./labels";

// Googleマップの Place ID（例：ChIJN1t_tDeuEmsRUsoyG83frY4）。DB の check と揃えること
const PLACE_ID = /^[A-Za-z0-9_-]{10,300}$/;

/** 空なら null（Googleマップ未登録）。形が正しくなければ undefined */
export function parsePlaceId(raw: FormDataEntryValue | null): string | null | undefined {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  return PLACE_ID.test(v) ? v : undefined;
}

export const PLACE_ID_ERROR = "Place ID の形が正しくありません（「ChIJ」から始まる英数字です）。";

/**
 * 地図リンク。Place ID があれば施設のページ（施設名で表示）、なければ座標、座標もなければ住所で開く
 * https://developers.google.com/maps/documentation/urls/get-started#search-action
 */
export function mapUrl(c: Pick<Campsite, "name" | "address" | "lat" | "lng" | "google_place_id">) {
  const base = "https://www.google.com/maps/search/?api=1";
  if (c.google_place_id) {
    return `${base}&query=${encodeURIComponent(c.name)}&query_place_id=${encodeURIComponent(c.google_place_id)}`;
  }
  if (c.lat != null && c.lng != null) return `${base}&query=${c.lat},${c.lng}`;
  return `${base}&query=${encodeURIComponent(c.address)}`;
}
