import "server-only";
import { cacheLife } from "next/cache";

export type PostalResult = { prefecture: string; city: string };

/**
 * 郵便番号（7桁の数字）から都道府県と市区町村（町域まで）を調べる。
 * 外部の無料 API（zipcloud）を使う。送るのはキャンプ場の郵便番号だけで、ユーザーの情報は送らない。
 * 同じ郵便番号は何度も調べないよう、1日キャッシュする。見つからない・失敗したときは null
 */
export async function lookupPostal(code: string): Promise<PostalResult[] | null> {
  "use cache";
  cacheLife("days");

  if (!/^\d{7}$/.test(code)) return null;
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${code}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      status: number;
      results: { address1: string; address2: string; address3: string }[] | null;
    };
    if (json.status !== 200 || !json.results?.length) return null;
    return json.results.map((r) => ({ prefecture: r.address1, city: `${r.address2}${r.address3}` }));
  } catch (e) {
    console.error("postal lookup failed", e);
    return null;
  }
}

/** 入力された郵便番号を 7桁の数字にする（全角・ハイフン・〒を取り除く）。7桁でなければ null */
export function normalizePostal(value: string): string | null {
  const digits = value.normalize("NFKC").replace(/[^\d]/g, "");
  return digits.length === 7 ? digits : null;
}
