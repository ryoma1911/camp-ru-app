// 「条件で探す」：URL の条件を読み取り、キャンプ場の一覧を絞り込む。
// キャンプ場は多くても数百件なので、キャッシュ済みの一覧と集計をアプリ側で絞り込む（DBに毎回問い合わせない）
import type { CheckinSummary } from "@/lib/campsite-stats";
import { FIRE_RULE, GROUND_TYPE, LOCATION_TYPE, PEG_NEEDED, SITE_STYLE, type Campsite } from "@/lib/labels";

export const TEMP_OPTIONS = [-10, -5, 0, 5] as const;
export const WIND_MAX_RATE = 20; // 「風で控えた日が少ない」とみなす上限（%）

export type SortKey = "posts" | "warm" | "pref";

/** 都道府県コード順（北から南）。漢字の並べ替えは読み順にならないため、この順で並べる */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

const prefIndex = (p: string) => {
  const i = (PREFECTURES as readonly string[]).indexOf(p);
  return i === -1 ? PREFECTURES.length : i;
};
export const byPrefecture = (a: string, b: string) => prefIndex(a) - prefIndex(b);

export type Filters = {
  q: string;
  pref: string;
  types: (keyof typeof LOCATION_TYPE)[];
  site: "sectioned" | "free" | "";
  car: boolean;
  hotwater: boolean;
  shower: boolean;
  bath: boolean;
  fire: "open" | "ok" | "";
  // ここから下はキャン活の集計にもとづく条件
  month: number | null;
  minTemp: number | null;
  peg: "plastic" | "steel" | "";
  wind: boolean;
  grounds: (keyof typeof GROUND_TYPE)[];
  sort: SortKey;
  nodata: boolean; // 集計がなく判定できないキャンプ場も表示する
};

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);
const keysOf = <T extends Record<string, unknown>>(labels: T, values: string[]) =>
  values.filter((v): v is keyof T & string => v in labels);

export function parseFilters(params: Params): Filters {
  const month = Number(one(params.month));
  const minTemp = Number(one(params.minTemp));
  const sort = one(params.sort);
  const site = one(params.site);
  const fire = one(params.fire);
  const peg = one(params.peg);
  return {
    q: one(params.q).trim().slice(0, 50),
    pref: one(params.pref),
    types: keysOf(LOCATION_TYPE, many(params.type)),
    site: site === "sectioned" || site === "free" ? site : "",
    car: one(params.car) === "1",
    hotwater: one(params.hotwater) === "1",
    shower: one(params.shower) === "1",
    bath: one(params.bath) === "1",
    fire: fire === "open" || fire === "ok" ? fire : "",
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : null,
    minTemp: (TEMP_OPTIONS as readonly number[]).includes(minTemp) && one(params.minTemp) !== "" ? minTemp : null,
    peg: peg === "plastic" || peg === "steel" ? peg : "",
    wind: one(params.wind) === "1",
    grounds: keysOf(GROUND_TYPE, many(params.ground)),
    sort: sort === "warm" || sort === "pref" ? sort : "posts",
    nodata: one(params.nodata) === "1",
  };
}

/** 条件を URL のクエリにする（空の条件は入れない） */
export function toQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.pref) p.set("pref", f.pref);
  f.types?.forEach((t) => p.append("type", t));
  if (f.site) p.set("site", f.site);
  if (f.car) p.set("car", "1");
  if (f.hotwater) p.set("hotwater", "1");
  if (f.shower) p.set("shower", "1");
  if (f.bath) p.set("bath", "1");
  if (f.fire) p.set("fire", f.fire);
  if (f.month) p.set("month", String(f.month));
  if (f.minTemp != null) p.set("minTemp", String(f.minTemp));
  if (f.peg) p.set("peg", f.peg);
  if (f.wind) p.set("wind", "1");
  f.grounds?.forEach((g) => p.append("ground", g));
  if (f.sort && f.sort !== "posts") p.set("sort", f.sort);
  if (f.nodata) p.set("nodata", "1");
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

/* ---------- 条件ごとの判定 ---------- */

type Check = {
  id: string;
  label: string;
  /** キャン活の集計にもとづく条件か（集計がないと判定できない） */
  needsData: boolean;
  /** true=合う / false=合わない / null=データがなく判定できない */
  test: (c: Campsite, s: CheckinSummary | undefined) => boolean | null;
  /** この条件だけ外したときの条件 */
  without: (f: Filters) => Filters;
};

function checksFor(f: Filters): Check[] {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  if (f.q) {
    add({
      id: "q",
      label: `「${f.q}」`,
      needsData: false,
      test: (c) => c.name.toLowerCase().includes(f.q.toLowerCase()),
      without: (x) => ({ ...x, q: "" }),
    });
  }
  if (f.pref) {
    add({ id: "pref", label: f.pref, needsData: false, test: (c) => c.prefecture === f.pref, without: (x) => ({ ...x, pref: "" }) });
  }
  if (f.types.length) {
    add({
      id: "type",
      label: f.types.map((t) => LOCATION_TYPE[t]).join("・"),
      needsData: false,
      test: (c) => f.types.includes(c.location_type),
      without: (x) => ({ ...x, types: [] }),
    });
  }
  if (f.site) {
    add({
      id: "site",
      label: SITE_STYLE[f.site],
      needsData: false,
      test: (c) => c.site_style === f.site || c.site_style === "both",
      without: (x) => ({ ...x, site: "" }),
    });
  }
  const bool = (key: "car" | "hotwater" | "shower" | "bath", label: string, field: keyof Campsite) => {
    if (f[key]) add({ id: key, label, needsData: false, test: (c) => Boolean(c[field]), without: (x) => ({ ...x, [key]: false }) });
  };
  bool("car", "車乗り入れ可", "car_access");
  bool("hotwater", "炊事場お湯", "has_hot_water");
  bool("shower", "シャワー", "has_shower");
  bool("bath", "風呂", "has_bath");
  if (f.fire) {
    add({
      id: "fire",
      label: f.fire === "open" ? FIRE_RULE.open_fire_ok : "焚き火OK",
      needsData: false,
      test: (c) => (f.fire === "open" ? c.fire_rule === "open_fire_ok" : c.fire_rule !== "prohibited"),
      without: (x) => ({ ...x, fire: "" }),
    });
  }

  if (f.month && f.minTemp != null) {
    const month = f.month;
    const min = f.minTemp;
    add({
      id: "temp",
      label: `${month}月の最低気温 ${min}℃以上`,
      needsData: true,
      test: (_c, s) => {
        const t = s?.monthAvgTemp[month];
        return t == null ? null : t >= min;
      },
      without: (x) => ({ ...x, minTemp: null }),
    });
  }
  if (f.peg) {
    const ok: (keyof typeof PEG_NEEDED)[] = f.peg === "plastic" ? ["plastic"] : ["plastic", "steel"];
    add({
      id: "peg",
      label: f.peg === "plastic" ? "プラペグでOK" : "スチールまででOK",
      needsData: true,
      test: (_c, s) => (s?.topPeg ? ok.includes(s.topPeg) : null),
      without: (x) => ({ ...x, peg: "" }),
    });
  }
  if (f.wind) {
    add({
      id: "wind",
      label: `風で焚き火を控えた日 ${WIND_MAX_RATE}%以下`,
      needsData: true,
      test: (_c, s) => (s?.windSkipRate == null ? null : s.windSkipRate <= WIND_MAX_RATE),
      without: (x) => ({ ...x, wind: false }),
    });
  }
  if (f.grounds.length) {
    add({
      id: "ground",
      label: `地面：${f.grounds.map((g) => GROUND_TYPE[g]).join("・")}`,
      needsData: true,
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

export function searchCampsites(
  campsites: Campsite[],
  summaries: Record<string, CheckinSummary>,
  f: Filters,
): SearchResult {
  const { checks, matched, noData } = run(campsites, summaries, f);

  const warmest = (c: Campsite) => (f.month ? summaries[c.id]?.monthAvgTemp[f.month] ?? -Infinity : -Infinity);
  const sorted = [...matched].sort((a, b) => {
    if (f.sort === "pref") return byPrefecture(a.prefecture, b.prefecture) || a.name.localeCompare(b.name, "ja");
    if (f.sort === "warm" && f.month) return warmest(b) - warmest(a);
    return (summaries[b.id]?.count ?? 0) - (summaries[a.id]?.count ?? 0) || a.name.localeCompare(b.name, "ja");
  });

  let suggestion: SearchResult["suggestion"] = null;
  if (sorted.length === 0) {
    for (const ch of checks) {
      const next = ch.without(f);
      const count = run(campsites, summaries, next).matched.length;
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
