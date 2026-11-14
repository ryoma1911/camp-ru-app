// キャンプ場名の照合（サーバー・ブラウザ共通）
// 「〇〇キャンプ場」「〇〇オートキャンプ場」「〇〇 キャンプ場」などの違いで別物と判定しないよう、
// よくある言葉・空白・記号を除いてから比べる

const GENERIC = /(オート)?キャンプ(場|フィールド|サイト|ランド|村)?|campground|camp|ｷｬﾝﾌﾟ場/gi;

export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(GENERIC, "")
    .replace(/[\s・･,、。.\-ー－_()（）「」]/g, "");
}

/** 入力した名前と、キャンプ場の名前が似ているか（どちらかがもう一方を含む） */
export function isSimilarName(input: string, name: string): boolean {
  const a = normalizeName(input);
  const b = normalizeName(name);
  if (a.length < 2 || b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}

/** 検索用：名前・都道府県・住所のどれかに含まれるか（空白区切りで AND） */
export function matchesKeyword(keyword: string, c: { name: string; prefecture: string; address: string }): boolean {
  const words = keyword.normalize("NFKC").toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${c.name} ${c.prefecture} ${c.address}`.normalize("NFKC").toLowerCase();
  return words.every((w) => text.includes(w));
}
