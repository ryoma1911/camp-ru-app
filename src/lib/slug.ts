import "server-only";
import { randomInt } from "node:crypto";

// 申請から公開するキャンプ場の slug を自動で作る。
// キャンプ場名（漢字）をローマ字にするには大きな辞書が必要で、地名は読み間違いも多い。
// slug は一度公開したら変えない（URL が切れる）ので、読み間違いの心配がない「都道府県のローマ字＋ランダムな6文字」にする
// 例：nagano-k3f9a2

const PREFECTURE_ROMAJI: Record<string, string> = {
  北海道: "hokkaido", 青森県: "aomori", 岩手県: "iwate", 宮城県: "miyagi", 秋田県: "akita",
  山形県: "yamagata", 福島県: "fukushima", 茨城県: "ibaraki", 栃木県: "tochigi", 群馬県: "gunma",
  埼玉県: "saitama", 千葉県: "chiba", 東京都: "tokyo", 神奈川県: "kanagawa", 新潟県: "niigata",
  富山県: "toyama", 石川県: "ishikawa", 福井県: "fukui", 山梨県: "yamanashi", 長野県: "nagano",
  岐阜県: "gifu", 静岡県: "shizuoka", 愛知県: "aichi", 三重県: "mie", 滋賀県: "shiga",
  京都府: "kyoto", 大阪府: "osaka", 兵庫県: "hyogo", 奈良県: "nara", 和歌山県: "wakayama",
  鳥取県: "tottori", 島根県: "shimane", 岡山県: "okayama", 広島県: "hiroshima", 山口県: "yamaguchi",
  徳島県: "tokushima", 香川県: "kagawa", 愛媛県: "ehime", 高知県: "kochi", 福岡県: "fukuoka",
  佐賀県: "saga", 長崎県: "nagasaki", 熊本県: "kumamoto", 大分県: "oita", 宮崎県: "miyazaki",
  鹿児島県: "kagoshima", 沖縄県: "okinawa",
};

// 見間違えやすい文字（0/o、1/l/i）は使わない
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateSlug(prefecture: string): string {
  const prefix = PREFECTURE_ROMAJI[prefecture] ?? "camp";
  const suffix = Array.from({ length: 6 }, () => CHARS[randomInt(CHARS.length)]).join("");
  return `${prefix}-${suffix}`;
}
