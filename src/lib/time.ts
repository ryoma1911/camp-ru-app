// 日本時間での「今」。リクエストのたびに計算する（呼ぶ前に connection() などでリクエスト時の処理にしておく）

/** 日本時間の今月（1〜12） */
export function currentMonthInJapan(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(now));
}

/** iso の日時から days 日以内か */
export function isWithinDays(iso: string, days: number, now = new Date()): boolean {
  return now.getTime() - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
}
