import Link from "next/link";
import { Suspense } from "react";
import { FilterPanel } from "@/components/search/filter-panel";
import { Tag } from "@/components/tag";
import { getCheckinSummaries, type CheckinSummary } from "@/lib/campsite-stats";
import { getCampsites } from "@/lib/campsites";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE, type Campsite } from "@/lib/labels";
import { byPrefecture, parseFilters, searchCampsites, toQuery, type Filters, type SortKey } from "@/lib/search";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Props = PageProps<"/">;

export default function Home(props: Props) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <div className="space-y-5">
      <section>
        <h1 className="text-2xl font-bold">キャンプ場をさがす</h1>
        <p className="mt-1 text-sm text-stone-600">
          行った人の投稿でわかる、明け方の気温・地面とペグ・焚き火のリアル。
        </p>
      </section>
      {/* 条件は URL から読むので <Suspense> の内側に置く（Next.js 16 の即時ナビゲーションのため） */}
      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
        <SearchSection searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchSection({ searchParams }: Pick<Props, "searchParams">) {
  const [params, campsites, summaries] = await Promise.all([searchParams, getCampsites(), getCheckinSummaries()]);
  const filters = parseFilters(params);
  const result = searchCampsites(campsites, summaries, filters);
  const prefectures = [...new Set(campsites.map((c) => c.prefecture))].sort(byPrefecture);

  if (campsites.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
        まだキャンプ場が登録されていません。data/README.md の手順で CSV を取り込んでください。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <QuickFilters filters={filters} />
      <FilterPanel filters={filters} prefectures={prefectures} />

      {result.active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {result.active.map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-800 hover:bg-stone-300"
              aria-label={`条件「${a.label}」を外す`}
            >
              {a.label} <span aria-hidden>✕</span>
            </Link>
          ))}
          <Link href="/" className="text-xs text-emerald-700 underline">
            すべて解除
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="text-lg font-bold">{result.matched.length}</span>件のキャンプ場
        </p>
        <SortLinks filters={filters} />
      </div>

      {result.matched.length === 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          <p>条件に合うキャンプ場がありません。</p>
          {result.suggestion && (
            <p>
              <Link href={result.suggestion.href} className="text-emerald-700 underline">
                「{result.suggestion.label}」を外す
              </Link>
              と{result.suggestion.count}件見つかります。
            </p>
          )}
        </div>
      ) : (
        <CampsiteList campsites={result.matched} summaries={summaries} month={filters.month} />
      )}

      {result.noData.length > 0 && (
        <div className="space-y-3 rounded-lg bg-stone-100 p-4 text-sm text-stone-600">
          <p>
            キャン活のデータがなく、判定できないキャンプ場：<span className="font-bold">{result.noData.length}件</span>
            <Link
              href={toQuery({ ...filters, nodata: !filters.nodata })}
              className="ml-2 text-emerald-700 underline"
              scroll={false}
            >
              {filters.nodata ? "隠す" : "表示する"}
            </Link>
          </p>
          {filters.nodata && <CampsiteList campsites={result.noData} summaries={summaries} month={filters.month} />}
        </div>
      )}
    </div>
  );
}

/** よく使う条件。1タップでオン／オフする */
function QuickFilters({ filters }: { filters: Filters }) {
  const chips: { label: string; on: boolean; toggle: Partial<Filters> }[] = [
    { label: "車乗り入れ可", on: filters.car, toggle: { car: !filters.car } },
    { label: "炊事場お湯", on: filters.hotwater, toggle: { hotwater: !filters.hotwater } },
    { label: "焚き火OK", on: filters.fire === "ok", toggle: { fire: filters.fire === "ok" ? "" : "ok" } },
    { label: "プラペグでOK", on: filters.peg === "plastic", toggle: { peg: filters.peg === "plastic" ? "" : "plastic" } },
  ];
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {chips.map((c) => (
        <Link
          key={c.label}
          href={toQuery({ ...filters, ...c.toggle })}
          scroll={false}
          aria-pressed={c.on}
          className={`inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-sm ${
            c.on
              ? "border-emerald-700 bg-emerald-700 text-white"
              : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

function SortLinks({ filters }: { filters: Filters }) {
  const options: { key: SortKey; label: string; disabled?: boolean }[] = [
    { key: "posts", label: "キャン活が多い順" },
    { key: "warm", label: filters.month ? `${filters.month}月に暖かい順` : "暖かい順（月を選ぶと使えます）", disabled: !filters.month },
    { key: "pref", label: "都道府県順" },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {options.map((o) =>
        o.disabled ? (
          <span key={o.key} className="text-stone-300">
            {o.label}
          </span>
        ) : (
          <Link
            key={o.key}
            href={toQuery({ ...filters, sort: o.key })}
            scroll={false}
            className={filters.sort === o.key ? "font-bold text-stone-900" : "text-emerald-700 underline"}
          >
            {o.label}
          </Link>
        ),
      )}
    </div>
  );
}

function CampsiteList({
  campsites,
  summaries,
  month,
}: {
  campsites: Campsite[];
  summaries: Record<string, CheckinSummary>;
  month: number | null;
}) {
  return (
    <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
      {campsites.map((c) => (
        <li key={c.id}>
          <Link href={`/campsites/${c.slug}`} className="block p-4 hover:bg-stone-50">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-semibold">{c.name}</h2>
              <span className="shrink-0 text-xs text-stone-500">{c.prefecture}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Tag>{LOCATION_TYPE[c.location_type]}</Tag>
              <Tag>{SITE_STYLE[c.site_style]}</Tag>
              <Tag>{FIRE_RULE[c.fire_rule]}</Tag>
              {c.car_access && <Tag>車乗り入れ可</Tag>}
              {c.has_hot_water && <Tag>炊事場お湯</Tag>}
              {c.has_shower && <Tag>シャワー</Tag>}
              {c.has_bath && <Tag>風呂</Tag>}
            </div>
            <SummaryRow summary={summaries[c.id]} month={month} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// 一覧で横に並べるため、ペグは短い言い方にする
const PEG_SHORT = {
  plastic: "プラペグでOK",
  steel: "スチール",
  forged: "鍛造",
  rocky: "石が多い",
} as const;

/**
 * キャン活の簡易集計（主役の3指標）。施設の公式情報（タグ）と区別するため色付きの帯にする。
 * 月で絞り込んでいるときは、気温をその月の平均に切り替える
 */
function SummaryRow({ summary, month }: { summary?: CheckinSummary; month: number | null }) {
  if (!summary) {
    return <p className="mt-3 text-xs text-stone-400">キャン活はまだありません</p>;
  }
  const monthAvg = month ? summary.monthAvgTemp[month] : undefined;
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2">
      <p className="text-[11px] text-emerald-900/70">キャン活{summary.count}件の集計</p>
      <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
        {month ? (
          <Stat label={`${month}月の最低気温`} value={monthAvg != null ? `${monthAvg}℃` : "–"} sub="平均" />
        ) : (
          <Stat
            label="最低気温"
            value={summary.coldest != null ? `${summary.coldest}℃` : "–"}
            sub={summary.coldestMonth ? `${summary.coldestMonth}月` : undefined}
          />
        )}
        <Stat label="ペグ" value={summary.topPeg ? PEG_SHORT[summary.topPeg] : "–"} />
        <Stat label="風で焚き火控え" value={summary.windSkipRate != null ? `${summary.windSkipRate}%` : "–"} />
      </dl>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] text-stone-500">{label}</dt>
      <dd className="truncate font-bold text-stone-900">
        {value}
        {sub && <span className="ml-1 text-[11px] font-normal text-stone-500">{sub}</span>}
      </dd>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm leading-7">
      <h1 className="mb-2 text-base font-bold">Supabase の接続設定がまだです</h1>
      <ol className="list-decimal pl-5">
        <li>
          <code>.env.local.example</code> を <code>.env.local</code> にコピー
        </li>
        <li>Supabase の URL とキーを書き込む</li>
        <li>開発サーバーを再起動</li>
      </ol>
    </div>
  );
}
