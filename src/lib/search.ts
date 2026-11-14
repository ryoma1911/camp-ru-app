// 「条件で探す」：URL の条件を読み取り、キャンプ場の一覧を絞り込む。
// キャンプ場は多くても数百件なので、キャッシュ済みの一覧と集計をアプリ側で絞り込む（DBに毎回問い合わせない）。
// ブラウザでも件数を数えるため、このファイルはサーバー専用にしない
import type { CheckinSummary } from "@/lib/campsite-stats";
import { GROUND_TYPE, LOCATION_TYPE, PEG_NEEDED, SITE_STYLE, type Campsite } from "@/lib/labels";

export const TEMP_OPTIONS = [-10, -5, 0, 5] as const;
export const WIND_MAX_RATE = 20; // 「風で控えた日が少ない」とみなす上限（%）

export type SortKey = "posts" | "warm" | "pref" | "new" | "recommend";
/** どの探し方（タブ）から来たか */
export type SearchTab = "keyword" | "pref" | "feature";

/** 都道府県コード順（北から南）。漢字の並べ替えは読み順にならないため、この順で並べる */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export const REGIONS: { name: string; prefs: string[] }[] = [
  { name: "北海道・東北", prefs: ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"] },
  { name: "関東", prefs: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"] },
  { name: "甲信越", prefs: ["新潟県", "山梨県", "長野県"] },
  { name: "北陸", prefs: ["富山県", "石川県", "福井県"] },
  { name: "東海", prefs: ["岐阜県", "静岡県", "愛知県", "三重県"] },
  { name: "近畿", prefs: ["滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"] },
  { name: "中国", prefs: ["鳥取県", "島根県", "岡山県", "広島県", "山口県"] },
  { name: "四国", prefs: ["徳島県", "香川県", "愛媛県", "高知県"] },
  { name: "九州・沖縄", prefs: ["福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"] },
];

const prefIndex = (p: string) => {
  const i = (PREFECTURES as readonly string[]).indexOf(p);
  return i === -1 ? PREFECTURES.length : i;
};
export const byPrefecture = (a: string, b: string) => prefIndex(a) - prefIndex(b);

/** 設備（公式の情報）。複数選んだら「すべて満たす」 */
export const FACILITIES = {
  car: "車乗り入れ可",
  hotwater: "炊事場お湯",
  shower: "シャワー",
  bath: "風呂",
  fire: "焚き火OK",
  openfire: "直火OK",
} as const;
export type Facility = keyof typeof FACILITIES;

/** 現地のリアル（キャン活の集計）。複数選んだら「すべて満たす」 */
export const REALS = {
  plastic: "プラペグでOK",
  steel: "スチールまででOK",
  wind: `風で焚き火を控えた日が少ない（${WIND_MAX_RATE}%以下）`,
} as const;
export type Real = keyof typeof REALS;

export type Filters = {
  tab: SearchTab | null;
  q: string;
  prefs: string[]; // どれか
  types: (keyof typeof LOCATION_TYPE)[]; // どれか
  sites: ("sectioned" | "free")[]; // どれか
  facilities: Facility[]; // すべて
  reals: Real[]; // すべて
  grounds: (keyof typeof GROUND_TYPE)[]; // どれか
  month: number | null;
  minTemp: number | null;
  sort: SortKey;
  nodata: boolean; // 集計がなく判定できないキャンプ場も表示する
};

export const EMPTY_FILTERS: Filters = {
  tab: null, q: "", prefs: [], types: [], sites: [], facilities: [], reals: [], grounds: [],
  month: null, minTemp: null, sort: "posts", nodata: false,
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const pickAll = <K extends string>(allowed: readonly K[] | Record<K, unknown>, values: string[]) => {
  const keys = (Array.isArray(allowed) ? allowed : Object.keys(allowed)) as string[];
  return [...new Set(values.filter((v): v is K => keys.includes(v)))];
};

export function parseFilters(params: Params): Filters {
  const month = Number(one(params.month));
  const minTemp = one(params.minTemp);
  const sort = one(params.sort);
  const tab = one(params.tab);
  return {
    tab: tab === "keyword" || tab === "pref" || tab === "feature" ? tab : null,
    q: one(params.q).trim().slice(0, 50),
    prefs: pickAll(PREFECTURES as readonly string[], many(params.pref)).sort(byPrefecture),
    types: pickAll(LOCATION_TYPE, many(params.type)),
    sites: pickAll(["sectioned", "free"] as const, many(params.site)),
    facilities: pickAll(FACILITIES, many(params.fac)),
    reals: pickAll(REALS, many(params.real)),
    grounds: pickAll(GROUND_TYPE, many(params.ground)),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    minTemp: minTemp !== "" && (TEMP_OPTIONS as readonly number[]).includes(Number(minTemp)) ? Number(minTemp) : null,
    sort: sort === "warm" || sort === "pref" || sort === "new" || sort === "recommend" ? sort : "posts",
    nodata: one(params.nodata) === "1",
  };
}

/** 条件を URL にする（空の条件は入れない） */
export function toQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.tab) p.set("tab", f.tab);
  if (f.q) p.set("q", f.q);
  f.prefs?.forEach((v) => p.append("pref", v));
  f.types?.forEach((v) => p.append("type", v));
  f.sites?.forEach((v) => p.append("site", v));
  f.facilities?.forEach((v) => p.append("fac", v));
  f.reals?.forEach((v) => p.append("real", v));
  f.grounds?.forEach((v) => p.append("ground", v));
  if (f.month) p.set("month", String(f.month));
  if (f.minTemp != null) p.set("minTemp", String(f.minTemp));
  if (f.sort && f.sort !== "posts") p.set("sort", f.sort);
  if (f.nodata) p.set("nodata", "1");
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

/** 検索結果の画面を出すか（何か条件があるか、タブから検索したか、並び順を指定したか） */
export const hasConditions = (f: Filters) => toQuery({ ...f, nodata: false }) !== "/";

/* ---------- 新着・おすすめの並び順（トップの欄と、検索結果の並べ替えで共通） ---------- */

/** 登録から何日以内を「NEW」とするか */
export const NEW_DAYS = 30;

/** 登録日時の新しい順 */
export const byNewest = (a: Campsite, b: Campsite) =>
  b.created_at.localeCompare(a.created_at) || a.name.localeCompare(b.name, "ja");

/**
 * おすすめ順：運営が選んだもの（featured_rank の小さい順）→ 今月のキャン活が多い順 → 全期間のキャン活が多い順。
 * month は日本時間の今月（1〜12）
 */
export function byRecommended(summaries: Record<string, CheckinSummary>, month: number) {
  const rank = (c: Campsite) => c.featured_rank ?? Number.POSITIVE_INFINITY;
  const inMonth = (c: Campsite) => summaries[c.id]?.monthCount[month] ?? 0;
  const total = (c: Campsite) => summaries[c.id]?.count ?? 0;
  return (a: Campsite, b: Campsite) =>
    rank(a) - rank(b) || inMonth(b) - inMonth(a) || total(b) - total(a) || a.name.localeCompare(b.name, "ja");
}

/**
 * トップの「おすすめのキャンプ場」。運営が選んだものを先に出し、残りの枠を自動で埋める。
 * 自動の枠には、キャン活が1件以上あるキャンプ場だけを使う（投稿のないキャンプ場はおすすめしない）
 */
export function pickRecommended(
  campsites: Campsite[],
  summaries: Record<string, CheckinSummary>,
  month: number,
  limit: number,
): { items: Campsite[]; hasAuto: boolean } {
  const items = [...campsites]
    .filter((c) => c.featured_rank != null || (summaries[c.id]?.count ?? 0) > 0)
    .sort(byRecommended(summaries, month))
    .slice(0, limit);
  return { items, hasAuto: items.some((c) => c.featured_rank == null) };
}

/** 配列の値を付け外しする */
export const toggle = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/* ---------- 条件ごとの判定 ---------- */

type Check = {
  id: string;
  label: string;
  /** true=合う / false=合わない / null=データがなく判定できない */
  test: (c: Campsite, s: CheckinSummary | undefined) => boolean | null;
  /** この条件だけ外したときの条件 */
  without: (f: Filters) => Filters;
};

function checksFor(f: Filters): Check[] {
  const checks: Check[] = [];

  if (f.q) {
    const q = f.q.toLowerCase();
    checks.push({
      id: "q",
      label: `「${f.q}」`,
      // 名前だけでなく、都道府県・住所でもヒットさせる（「富士」「山梨」などエリアでも探せる）
      test: (c) => [c.name, c.prefecture, c.address].some((v) => v.toLowerCase().includes(q)),
      without: (x) => ({ ...x, q: "" }),
    });
  }
  if (f.prefs.length) {
    checks.push({
      id: "pref",
      label: f.prefs.join("・"),
      test: (c) => f.prefs.includes(c.prefecture),
      without: (x) => ({ ...x, prefs: [] }),
    });
  }
  if (f.types.length) {
    checks.push({
      id: "type",
      label: f.types.map((t) => LOCATION_TYPE[t]).join("・"),
      test: (c) => f.types.includes(c.location_type),
      without: (x) => ({ ...x, types: [] }),
    });
  }
  if (f.sites.length) {
    checks.push({
      id: "site",
      label: f.sites.map((s) => SITE_STYLE[s]).join("・"),
      test: (c) => c.site_style === "both" || f.sites.includes(c.site_style),
      without: (x) => ({ ...x, sites: [] }),
    });
  }
  const facilityTest: Record<Facility, (c: Campsite) => boolean> = {
    car: (c) => c.car_access,
    hotwater: (c) => c.has_hot_water,
    shower: (c) => c.has_shower,
    bath: (c) => c.has_bath,
    fire: (c) => c.fire_rule !== "prohibited",
    openfire: (c) => c.fire_rule === "open_fire_ok",
  };
  for (const fac of f.facilities) {
    checks.push({
      id: `fac-${fac}`,
      label: FACILITIES[fac],
      test: (c) => facilityTest[fac](c),
      without: (x) => ({ ...x, facilities: x.facilities.filter((v) => v !== fac) }),
    });
  }

  if (f.month && f.minTemp != null) {
    const month = f.month;
    const min = f.minTemp;
    checks.push({
      id: "temp",
      label: `${month}月の最低気温 ${min}℃以上`,
      test: (_c, s) => {
        const t = s?.monthAvgTemp[month];
        return t == null ? null : t >= min;
      },
      without: (x) => ({ ...x, minTemp: null }),
    });
  }
  const pegOk: Record<"plastic" | "steel", (keyof typeof PEG_NEEDED)[]> = {
    plastic: ["plastic"],
    steel: ["plastic", "steel"],
  };
  for (const real of f.reals) {
    checks.push({
      id: `real-${real}`,
      label: real === "wind" ? `風で焚き火控え ${WIND_MAX_RATE}%以下` : REALS[real],
      test: (_c, s) => {
        if (real === "wind") return s?.windSkipRate == null ? null : s.windSkipRate <= WIND_MAX_RATE;
        return s?.topPeg ? pegOk[real].includes(s.topPeg) : null;
      },
      without: (x) => ({ ...x, reals: x.reals.filter((v) => v !== real) }),
    });
  }
  if (f.grounds.length) {
    checks.push({
      id: "ground",
      label: `地面：${f.grounds.map((g) => GROUND_TYPE[g]).join("・")}`,
      test: (_c, s) => (s?.topGround ? f.grounds.includes(s.topGround) : null),
      without: (x) => ({ ...x, grounds: [] }),
    });
  }
  return checks;
}

export type SearchResult = {
  matched: Campsite[];
  /** 集計がなく判定できなかったキャンプ場（公式情報の条件には合っている） */
  noData: Campsite[];
  active: { id: string; label: string; href: string }[];
  /** 0件のとき、外すと一番結果が増える条件 */
  suggestion: { label: string; href: string; count: number } | null;
};

function run(campsites: Campsite[], summaries: Record<string, CheckinSummary>, f: Filters) {
  const checks = checksFor(f);
  const matched: Campsite[] = [];
  const noData: Campsite[] = [];
  for (const c of campsites) {
    const results = checks.map((ch) => ch.test(c, summaries[c.id]));
    if (results.some((r) => r === false)) continue;
    if (results.some((r) => r === null)) noData.push(c);
    else matched.push(c);
  }
  return { checks, matched, noData };
}

/** その条件で何件見つかるか（絞り込み欄の件数表示に使う） */
export const countMatches = (campsites: Campsite[], summaries: Record<string, CheckinSummary>, f: Filters) =>
  run(campsites, summaries, f).matched.length;

export function searchCampsites(
  campsites: Campsite[],
  summaries: Record<string, CheckinSummary>,
  f: Filters,
  /** 日本時間の今月（おすすめ順で使う） */
  currentMonth: number,
): SearchResult {
  const { checks, matched, noData } = run(campsites, summaries, f);

  const warmest = (c: Campsite) => (f.month ? summaries[c.id]?.monthAvgTemp[f.month] ?? -Infinity : -Infinity);
  const recommended = byRecommended(summaries, currentMonth);
  const sorted = [...matched].sort((a, b) => {
    if (f.sort === "new") return byNewest(a, b);
    if (f.sort === "recommend") return recommended(a, b);
    if (f.sort === "pref") return byPrefecture(a.prefecture, b.prefecture) || a.name.localeCompare(b.name, "ja");
    if (f.sort === "warm" && f.month) return warmest(b) - warmest(a);
    return (summaries[b.id]?.count ?? 0) - (summaries[a.id]?.count ?? 0) || a.name.localeCompare(b.name, "ja");
  });

  let suggestion: SearchResult["suggestion"] = null;
  if (sorted.length === 0) {
    for (const ch of checks) {
      const next = ch.without(f);
      const count = countMatches(campsites, summaries, next);
      if (count > 0 && (!suggestion || count > suggestion.count)) {
        suggestion = { label: ch.label, href: toQuery(next), count };
      }
    }
  }

  return {
    matched: sorted,
    noData: noData.sort((a, b) => byPrefecture(a.prefecture, b.prefecture) || a.name.localeCompare(b.name, "ja")),
    active: checks.map((ch) => ({ id: ch.id, label: ch.label, href: toQuery(ch.without(f)) })),
    suggestion,
  };
}
