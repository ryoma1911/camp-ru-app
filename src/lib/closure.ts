import type { Campsite } from "./labels";

// 冬季閉鎖。毎年同じ月日の期間（'MM-DD'。12-01 〜 03-31 のように年をまたいでよい）

/** 閉鎖が始まる何日前から予告を出すか */
export const CLOSURE_NOTICE_DAYS = 30;

type ClosureFields = Pick<Campsite, "winter_closed_from" | "winter_closed_to" | "winter_closure_note">;

export type ClosureStatus =
  /** 閉鎖中。reopen は営業を再開する日（例：「4/1」） */
  | { kind: "closed"; period: string; reopen: string; note: string | null }
  /** 予告（閉鎖が始まる30日前から前日まで） */
  | { kind: "soon"; period: string; start: string; end: string; note: string | null };

const DAY = 24 * 60 * 60 * 1000;
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 'MM-DD' を「12/1」の形にする */
export const formatMonthDay = (md: string) => `${Number(md.slice(0, 2))}/${Number(md.slice(3, 5))}`;

/** 日本時間の今日（年・月・日） */
function todayInJapan(now: Date) {
  const [y, m, d] = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now).split("-").map(Number);
  return { y, m, d };
}

/**
 * 今日の冬季閉鎖の状態。閉鎖なし・営業中なら null。
 * 現在時刻を使うので、リクエスト時の処理（connection() のあと）で呼ぶこと
 */
export function closureStatus(c: ClosureFields, now = new Date()): ClosureStatus | null {
  const from = c.winter_closed_from;
  const to = c.winter_closed_to;
  if (!from || !to) return null;

  const t = todayInJapan(now);
  const today = `${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
  const period = `${formatMonthDay(from)}〜${formatMonthDay(to)}`;
  const note = c.winter_closure_note;

  // 年をまたがない期間（例：01-10〜03-20）と、またぐ期間（例：12-01〜03-31）
  const closed = from <= to ? from <= today && today <= to : today >= from || today <= to;
  if (closed) {
    const [tm, td] = to.split("-").map(Number);
    const next = new Date(Date.UTC(2001, tm - 1, td) + DAY); // 再開日（閏年の 2/29 は気にしない）
    return { kind: "closed", period, reopen: `${next.getUTCMonth() + 1}/${next.getUTCDate()}`, note };
  }

  // 次に閉鎖が始まる日までの日数
  const [fm, fd] = from.split("-").map(Number);
  const todayUtc = Date.UTC(t.y, t.m - 1, t.d);
  let start = Date.UTC(t.y, fm - 1, fd);
  if (start < todayUtc) start = Date.UTC(t.y + 1, fm - 1, fd);
  const days = Math.round((start - todayUtc) / DAY);
  if (days >= 1 && days <= CLOSURE_NOTICE_DAYS) {
    return { kind: "soon", period, start: formatMonthDay(from), end: formatMonthDay(to), note };
  }
  return null;
}

/** 今日が閉鎖中か（一覧の並び・おすすめの選定に使う） */
export const isClosedNow = (c: ClosureFields, now = new Date()) => closureStatus(c, now)?.kind === "closed";

/* ---------- 管理画面の入力 ---------- */

export type ClosureValues = {
  winter_closed_from: string | null;
  winter_closed_to: string | null;
  winter_closure_note: string | null;
};

function monthDay(formData: FormData, prefix: "from" | "to"): string | undefined {
  const m = Number(formData.get(`closed_${prefix}_month`));
  const d = Number(formData.get(`closed_${prefix}_day`));
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > MAX_DAY[m - 1]) return undefined;
  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 「冬季閉鎖あり」のチェックと月日・補足を、DB に入れる形にする */
export function parseWinterClosure(
  formData: FormData,
): { ok: true; values: ClosureValues } | { ok: false; error: string } {
  if (formData.get("winter_closed") !== "yes") {
    return { ok: true, values: { winter_closed_from: null, winter_closed_to: null, winter_closure_note: null } };
  }
  const from = monthDay(formData, "from");
  const to = monthDay(formData, "to");
  if (!from || !to) return { ok: false, error: "冬季閉鎖の期間を、ある日付で選んでください（例：2月30日は選べません）。" };
  if (from === to) return { ok: false, error: "冬季閉鎖の始まりと終わりが同じ日です。" };
  const note = String(formData.get("winter_closure_note") ?? "").trim();
  if (note.length > 100) return { ok: false, error: "冬季閉鎖の補足は100文字以内にしてください。" };
  return { ok: true, values: { winter_closed_from: from, winter_closed_to: to, winter_closure_note: note || null } };
}
