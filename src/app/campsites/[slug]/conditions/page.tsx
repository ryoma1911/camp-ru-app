import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MonthConditionsSection } from "@/components/campsite-stats";
import { getCampsiteStats } from "@/lib/campsite-stats";
import { getCampsite, getCampsites } from "@/lib/campsites";
import { currentMonthInJapan } from "@/lib/time";

export async function generateStaticParams() {
  const campsites = await getCampsites();
  return campsites.map((c) => ({ slug: c.slug }));
}

type Props = PageProps<"/campsites/[slug]/conditions">;

const parseMonth = (v: string | string[] | undefined) => {
  const m = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
};

export async function generateMetadata(props: Props) {
  const [{ slug }, { month }] = await Promise.all([props.params, props.searchParams]);
  const campsite = await getCampsite(slug);
  if (!campsite) return { title: "キャンプ場が見つかりません" };
  const m = parseMonth(month);
  return { title: `${campsite.name}の${m ? `${m}月の` : "月別の"}現地コンディション` };
}

export default function CampsiteConditionsPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <ConditionsContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

/** 月別の現地コンディション。月のタブで切り替える（?month=1〜12。なければ今月） */
async function ConditionsContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const campsite = await getCampsite(slug);
  if (!campsite) notFound();
  const stats = await getCampsiteStats(campsite.id);
  // 月の指定がなければ今月（日付で変わるので、リクエストのたびに決める）
  await connection();
  const month = parseMonth(query.month) ?? currentMonthInJapan();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/campsites/${campsite.slug}`} className="text-sm text-emerald-700 underline">
          ← {campsite.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">月別の現地コンディション</h1>
        <p className="mt-1 text-sm text-stone-600">
          {campsite.name}のソト活{stats.total}件を、行った月ごとにまとめています（年をまたいで同じ月を合わせて数えます）。
        </p>
      </div>

      {stats.total === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          <p>まだソト活がないため、月別のコンディションは集計できていません。</p>
          <Link
            href={`/campsites/${campsite.slug}/checkin`}
            className="inline-flex h-11 items-center rounded-full bg-emerald-700 px-6 font-medium text-white hover:bg-emerald-800"
          >
            ソト活を投稿する
          </Link>
        </div>
      ) : (
        <>
          {/* 月のタブ。件数を添え、0件の月は薄く（押すと「記録はまだありません」）。
              スマホは6か月×2段にして、選んだ月が画面の外に隠れないようにする */}
          <nav aria-label="月">
            <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {stats.conditions.map((c) => {
                const on = c.month === month;
                return (
                  <li key={c.month}>
                    <Link
                      href={`/campsites/${campsite.slug}/conditions?month=${c.month}`}
                      scroll={false}
                      aria-current={on ? "page" : undefined}
                      className={`flex flex-col items-center rounded-lg border py-1.5 text-sm ${
                        on
                          ? "border-emerald-700 bg-emerald-700 font-bold text-white"
                          : c.count
                            ? "border-stone-300 bg-white hover:bg-stone-50"
                            : "border-stone-200 bg-white text-stone-400 hover:bg-stone-50"
                      }`}
                    >
                      {c.month}月
                      <span className={`text-[11px] ${on ? "text-white/80" : c.count ? "text-stone-500" : "text-stone-300"}`}>
                        {c.count}件
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <MonthConditionsSection conditions={stats.conditions[month - 1]} />
        </>
      )}
    </div>
  );
}
