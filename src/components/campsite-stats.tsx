import Link from "next/link";
import {
  BUG_BARS,
  TEMP_BANDS,
  type Breakdown,
  type CampsiteStats as Stats,
  type MonthConditions,
  type MonthTemp,
} from "@/lib/campsite-stats";
import { FIRE_STATUS, HEATER, PARTY_TYPE, PEG_NEEDED, SLEEPING_BAG_TYPE } from "@/lib/labels";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/**
 * キャンプ場ページ上部の「現地コンディション」。投稿の羅列より先に結論が見えるようにする。
 * 気温・焚き火・寝袋・暖房・虫・誰とは今月（month）の分を出し、月別のページへ案内する
 */
export function CampsiteStats({ stats, month, slug }: { stats: Stats; month: number; slug: string }) {
  if (stats.total === 0) {
    return (
      <section className="rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
        まだソト活がないため、現地コンディションは集計できていません。最初の1件を投稿すると、ここに気温・ペグ・焚き火の傾向が表示されます。
      </section>
    );
  }
  const current = stats.conditions[month - 1];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">現地コンディション</h2>
        <p className="text-sm text-stone-500">{stats.total}件のソト活から</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TempTile stats={stats} />
        <PegTile stats={stats} />
        <FireTile conditions={current} />
      </div>

      <Card title="② 地面の固さ" note="必要だったペグ・全期間">
        <MeterList items={stats.peg} labels={PEG_NEEDED} total={stats.total} />
      </Card>

      <MonthConditionsSection conditions={current} moreHref={`/campsites/${slug}/conditions`} />
    </section>
  );
}

/**
 * ある月の気温・焚き火・寝袋・暖房・虫・誰と。キャンプ場ページ（今月）と月別ページで使う。
 * 任意の項目は記録した投稿の数を分母にする（「わからない」は数えない。暖房は複数選べるので合計が100%を超えることがある）
 */
export function MonthConditionsSection({
  conditions: c,
  moreHref,
}: {
  conditions: MonthConditions;
  /** 「月別で見る」のリンク先（月別ページでは出さない） */
  moreHref?: string;
}) {
  return (
    <div className="space-y-3 rounded-xl border-2 border-emerald-700/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-bold">{c.month}月のコンディション</h3>
        <p className="text-sm text-stone-500">
          {c.count ? `${c.count}件の記録から` : null}
          {moreHref && (
            <Link href={moreHref} className="ml-3 text-emerald-700 underline">
              月別で見る →
            </Link>
          )}
        </p>
      </div>
      {c.count === 0 ? (
        <p className="rounded-lg bg-stone-50 p-4 text-sm text-stone-600">
          {c.month}月の記録はまだありません。
          {moreHref && "ほかの月のコンディションは「月別で見る」から確認できます。"}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TempCard temp={c.temp} />
          <Card title="③ 焚き火" note={recorded(c.fire.total)}>
            <MeterList items={c.fire.items} labels={FIRE_STATUS} total={c.fire.total} />
          </Card>
          <Card title="寝袋" note={recorded(c.bag.total)}>
            <MeterList items={c.bag.items} labels={SLEEPING_BAG_TYPE} total={c.bag.total} />
          </Card>
          <Card title="暖房" note={recorded(c.heaters.total)}>
            <MeterList items={c.heaters.items} labels={HEATER} total={c.heaters.total} />
          </Card>
          <Card title="虫" note={recorded(c.bug.total)}>
            <MeterList items={c.bug.items} labels={BUG_BARS} total={c.bug.total} />
          </Card>
          <Card title="誰と" note={recorded(c.party.total)}>
            <MeterList items={c.party.items} labels={PARTY_TYPE} total={c.party.total} />
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- 主役3指標のタイル ---------- */

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
      <p className="mt-1 text-xs text-stone-500">{sub}</p>
    </div>
  );
}

function TempTile({ stats: { coldest, tempCount } }: { stats: Stats }) {
  if (!coldest) return <Tile label="① 気温" value="記録なし" sub="気温の入った投稿がまだありません" />;
  return <Tile label="① いちばん冷えた記録" value={`${coldest.temp}℃`} sub={`${coldest.month}月・気温の記録 ${tempCount}件`} />;
}

function PegTile({ stats }: { stats: Stats }) {
  const topPeg = stats.peg[0];
  return <Tile label="② 地面の固さ" value={PEG_NEEDED[topPeg.key]} sub={`${stats.total}件中${topPeg.count}件`} />;
}

function FireTile({ conditions: c }: { conditions: MonthConditions }) {
  const label = `③ 風で焚き火を控えた日（${c.month}月）`;
  if (c.count === 0) return <Tile label={label} value="記録なし" sub={`${c.month}月のソト活がまだありません`} />;
  const count = (k: keyof typeof FIRE_STATUS) => c.fire.items.find((f) => f.key === k)?.count ?? 0;
  // ルールで禁止の日は除き、「焚き火をしようとした日のうち風で控えた割合」を出す
  const tried = count("done") + count("skipped_wind");
  if (tried === 0) return <Tile label={label} value="できた記録なし" sub="ルールで禁止の記録のみ" />;
  return (
    <Tile
      label={label}
      value={`${pct(count("skipped_wind"), tried)}%`}
      sub={`焚き火をしようとした${tried}件中${count("skipped_wind")}件`}
    />
  );
}

/* ---------- その月の気温（数字と気温帯の横棒） ---------- */

/** 本人が入れた気温と、ないときは気象データの推定値で数える（推定の件数を添える） */
function TempCard({ temp: t }: { temp: MonthTemp }) {
  const note = t.count ? `${t.count}件の記録から${t.estimated ? `（うち推定${t.estimated}件）` : ""}` : undefined;
  return (
    <Card title="気温（夜の最低）" note={note}>
      {t.count === 0 ? (
        <p className="text-sm text-stone-400">記録なし</p>
      ) : (
        <>
          <div>
            <p className="text-xl font-bold leading-tight">平均 {t.avg}℃</p>
            <p className="mt-1 text-xs text-stone-500">
              いちばん冷えた {t.coldest}℃・いちばん暖かい {t.warmest}℃
            </p>
          </div>
          <MeterList items={t.bands} labels={TEMP_BANDS} total={t.count} showEmpty />
        </>
      )}
    </Card>
  );
}

/* ---------- 内訳（名前・棒・件数を1行ずつ） ---------- */

function MeterList<K extends string>({
  items,
  labels,
  total,
  showEmpty = false,
}: {
  items: Breakdown<K>;
  labels: Record<K, string>;
  total: number;
  /** 0件の行も出す（気温帯のように、並びに意味があるとき） */
  showEmpty?: boolean;
}) {
  const shown = showEmpty ? items : items.filter((i) => i.count > 0);
  if (!items.some((i) => i.count > 0)) return <p className="text-sm text-stone-400">記録なし</p>;
  // 一番多いもの（同数なら上のもの）を強調する。気温帯は並べ替えないので位置ではなく件数で決める
  const top = shown.reduce((best, i, idx) => (i.count > shown[best].count ? idx : best), 0);
  return (
    <ul className="space-y-2">
      {shown.map((i, idx) => (
        <li key={i.key} className="text-sm" title={`${labels[i.key]}：${total}件中${i.count}件`}>
          <div className="flex justify-between gap-2">
            <span>{labels[i.key]}</span>
            <span className="shrink-0 text-stone-500">
              {i.count}件（{pct(i.count, total)}%）
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-stone-100">
            {/* 一番多いものだけ濃い色で強調し、他は控えめにする */}
            <div
              className={`h-1.5 rounded-full ${idx === top ? "bg-emerald-700" : "bg-stone-400"}`}
              style={{ width: `${pct(i.count, total)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const recorded = (n: number) => (n ? `${n}件の記録から` : undefined);

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        {note && <p className="text-xs text-stone-500">{note}</p>}
      </div>
      {children}
    </div>
  );
}
