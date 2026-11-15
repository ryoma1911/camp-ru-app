import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CampsiteShelf } from "@/components/campsite-shelf";
import { HeroSearch } from "@/components/search/hero-search";
import { RefinePanel } from "@/components/search/refine-panel";
import { CampsiteThumb } from "@/components/campsite-thumb";
import { Tag } from "@/components/tag";
import { getCampsiteCovers } from "@/lib/campsite-images";
import { getCheckinSummaries, type CheckinSummary } from "@/lib/campsite-stats";
import { getCampsites } from "@/lib/campsites";
import { SITE_NAME } from "@/lib/site";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE, type Campsite } from "@/lib/labels";
import {
  NEW_DAYS,
  byNewest,
  hasConditions,
  parseFilters,
  pickRecommended,
  searchCampsites,
  toQuery,
  type Filters,
  type SortKey,
} from "@/lib/search";
import { currentMonthInJapan, isWithinDays } from "@/lib/time";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type Props = PageProps<"/">;

/** トップの「おすすめ」「最近登録された」に出す件数（PC・スマホ共通） */
const SHELF_SIZE = 6;

export default function Home(props: Props) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  // 条件は URL から読むので <Suspense> の内側に置く（Next.js 16 の即時ナビゲーションのため）
  return (
    <Suspense fallback={<div className="h-64 rounded-2xl bg-emerald-800" />}>
      <SearchSection searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SearchSection({ searchParams }: Pick<Props, "searchParams">) {
  const [params, campsites, summaries, covers] = await Promise.all([
    searchParams,
    getCampsites(),
    getCheckinSummaries(),
    getCampsiteCovers(),
  ]);
  // ここから先は「今月」「登録から30日以内」など現在時刻を使うので、リクエスト時にだけ動かす
  await connection();
  const month = currentMonthInJapan();
  const filters = parseFilters(params);
  const result = searchCampsites(campsites, summaries, filters, month);
  const searched = hasConditions(filters);

  if (campsites.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
        まだキャンプ場が登録されていません。data/README.md の手順で CSV を取り込んでください。
      </p>
    );
  }

  const hero = (
    // key：検索するたびに検索エリアを閉じた状態に戻す
    <HeroSearch
      key={toQuery(filters)}
      campsites={campsites}
      summaries={summaries}
      currentTab={filters.tab}
      compact={searched}
    />
  );

  // トップ（まだ検索していない状態）は、検索エリアの下に「おすすめ」「最近登録された」の欄だけを出す。
  // 一覧と絞り込み欄は検索したあとに出す
  if (!searched) {
    const recommended = pickRecommended(campsites, summaries, month, SHELF_SIZE);
    const recent = [...campsites].sort(byNewest).slice(0, SHELF_SIZE);
    return (
      <div className="space-y-10">
        {hero}
        <CampsiteShelf
          title="おすすめのキャンプ場"
          note={recommended.hasAuto ? `${month}月に行く人に人気` : `${SITE_NAME}のおすすめ`}
          moreHref={toQuery({ sort: "recommend" })}
          month={month}
          items={recommended.items.map((c) => ({ campsite: c, summary: summaries[c.id], cover: covers[c.id] }))}
        />
        <CampsiteShelf
          title="最近登録されたキャンプ場"
          note="新しく追加された順"
          moreHref={toQuery({ sort: "new" })}
          month={month}
          items={recent.map((c) => ({
            campsite: c,
            summary: summaries[c.id],
            cover: covers[c.id],
            isNew: isWithinDays(c.created_at, NEW_DAYS),
          }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hero}

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <RefinePanel campsites={campsites} summaries={summaries} filters={filters} active={result.active} />

        <div className="min-w-0 space-y-4">
          {/* スマホでは、選んでいる条件を結果の上に並べる（PC は左の絞り込み欄に出す） */}
          {result.active.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 lg:hidden">
              {result.active.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  scroll={false}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-800"
                  aria-label={`条件「${a.label}」を外す`}
                >
                  {a.label} <span aria-hidden>✕</span>
                </Link>
              ))}
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
            <CampsiteList campsites={result.matched} summaries={summaries} covers={covers} month={filters.month} />
          )}

          {result.noData.length > 0 && (
            <div className="space-y-3 rounded-lg bg-stone-100 p-4 text-sm text-stone-600">
              <p>
                ソト活のデータがなく、判定できないキャンプ場：<span className="font-bold">{result.noData.length}件</span>
                <Link
                  href={toQuery({ ...filters, nodata: !filters.nodata })}
                  className="ml-2 text-emerald-700 underline"
                  scroll={false}
                >
                  {filters.nodata ? "隠す" : "表示する"}
                </Link>
              </p>
              {filters.nodata && <CampsiteList campsites={result.noData} summaries={summaries} covers={covers} month={filters.month} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SortLinks({ filters }: { filters: Filters }) {
  const options: { key: SortKey; label: string; disabled?: boolean }[] = [
    { key: "posts", label: "ソト活が多い順" },
    { key: "warm", label: filters.month ? `${filters.month}月に暖かい順` : "暖かい順", disabled: !filters.month },
    { key: "pref", label: "都道府県順" },
    { key: "recommend", label: "おすすめ順" },
    { key: "new", label: "新着順" },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {options.map((o) =>
        o.disabled ? (
          <span key={o.key} className="text-stone-300" title="絞り込みで「行く月」を選ぶと使えます">
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
  covers,
  month,
}: {
  campsites: Campsite[];
  summaries: Record<string, CheckinSummary>;
  covers: Record<string, string>;
  month: number | null;
}) {
  return (
    <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
      {campsites.map((c) => (
        <li key={c.id}>
          <Link href={`/campsites/${c.slug}`} className="flex gap-3 p-4 hover:bg-stone-50 sm:gap-4">
            {/* カバー写真（運営が登録した写真）。なければ種類の色 */}
            <CampsiteThumb
              campsite={c}
              cover={covers[c.id]}
              className="h-16 w-16 shrink-0 rounded-lg sm:h-24 sm:w-32"
              labelClassName="text-xs sm:text-sm"
            />
            <div className="min-w-0 flex-1">
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
            </div>
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
 * ソト活の簡易集計（主役の3指標）。施設の公式情報（タグ）と区別するため色付きの帯にする。
 * 月で絞り込んでいるときは、気温をその月の平均に切り替える
 */
function SummaryRow({ summary, month }: { summary?: CheckinSummary; month: number | null }) {
  if (!summary) {
    return <p className="mt-3 text-xs text-stone-400">ソト活はまだありません</p>;
  }
  const monthAvg = month ? summary.monthAvgTemp[month] : undefined;
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2">
      <p className="text-[11px] text-emerald-900/70">ソト活{summary.count}件の集計</p>
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
