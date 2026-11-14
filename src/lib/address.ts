// 住所と都道府県の扱い（サーバー・ブラウザ共通）
// 都道府県はプルダウンで選ぶので、住所の欄には「都道府県のあと」だけを入れてもらう。
// 都道府県から入れてしまっても二重にならないよう、先頭の都道府県を取り除いてから組み立てる
import { PREFECTURES } from "@/lib/search";

/** 住所の先頭にある都道府県と、そのあとの部分に分ける（先頭が都道府県でなければ prefecture は null） */
export function splitPrefecture(address: string): { prefecture: string | null; rest: string } {
  const value = address.normalize("NFKC").trim();
  const prefecture = PREFECTURES.find((p) => value.startsWith(p)) ?? null;
  return { prefecture, rest: (prefecture ? value.slice(prefecture.length) : value).trim() };
}

/**
 * 選んだ都道府県と住所から、DB に入れる住所（都道府県から始まる形）を作る。
 * 住所が別の都道府県から始まっていたらエラー
 */
export function joinAddress(
  prefecture: string,
  address: string,
): { ok: true; address: string } | { ok: false; error: string } {
  const { prefecture: written, rest } = splitPrefecture(address);
  if (written && written !== prefecture) {
    return { ok: false, error: `住所が「${written}」から始まっていますが、都道府県は「${prefecture}」が選ばれています。` };
  }
  if (!rest) return { ok: false, error: "住所を入れてください（市区町村まででOK）。" };
  return { ok: true, address: `${prefecture}${rest}` };
}
