import Link from "next/link";
import { Tag } from "@/components/tag";
import { getCheckinSummaries, type CheckinSummary } from "@/lib/campsite-stats";
import { getCampsites } from "@/lib/campsites";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE } from "@/lib/labels";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const [campsites, summaries] = await Promise.all([getCampsites(), getCheckinSummaries()]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">キャンプ場をさがす</h1>
        <p className="mt-1 text-sm text-stone-600">
          行った人の投稿でわかる、明け方の気温・地面とペグ・焚き火のリアル。
        </p>
      </section>

      {campsites.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          まだキャンプ場が登録されていません。data/README.md の手順で CSV を取り込んでください。
        </p>
      ) : (
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
              <SummaryRow summary={summaries[c.id]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 一覧で横に並べるため、ペグは短い言い方にする
const PEG_SHORT = {
  plastic: "プラペグでOK",
  steel: "スチール",
  forged: "鍛造",
  rocky: "石が多い",
} as const;

/** キャン活の簡易集計（主役の3指標）。施設の公式情報（タグ）と区別するため色付きの帯にする */
function SummaryRow({ summary }: { summary?: CheckinSummary }) {
  if (!summary) {
    return <p className="mt-3 text-xs text-stone-400">キャン活はまだありません</p>;
  }
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2">
      <p className="text-[11px] text-emerald-900/70">キャン活{summary.count}件の集計</p>
      <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
        <Stat
          label="最低気温"
          value={summary.coldest != null ? `${summary.coldest}℃` : "–"}
          sub={summary.coldestMonth ? `${summary.coldestMonth}月` : undefined}
        />
        <Stat label="ペグ" value={summary.topPeg ? PEG_SHORT[summary.topPeg] : "–"} />
        <Stat
          label="風で焚き火控え"
          value={summary.windSkipRate != null ? `${summary.windSkipRate}%` : "–"}
        />
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
