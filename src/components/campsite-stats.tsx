import type { Breakdown, CampsiteStats as Stats, MonthStat, SleepStat } from "@/lib/campsite-stats";
import { BUG_LEVEL, FIRE_STATUS, GROUND_TYPE, PEG_NEEDED } from "@/lib/labels";

// 0℃を境に、寒い側＝青・暖かい側＝オレンジ（色覚の違いがあっても区別できる組み合わせを検証済み）
const COLD = "#0369a1";
const WARM = "#c2410c";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

/** キャンプ場ページ上部の「現地コンディション」。投稿の羅列より先に結論が見えるようにする */
export function CampsiteStats({ stats }: { stats: Stats }) {
  if (stats.total === 0) {
    return (
      <section className="rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
        まだキャン活がないため、現地コンディションは集計できていません。最初の1件を投稿すると、ここに気温・ペグ・焚き火の傾向が表示されます。
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">現地コンディション</h2>
        <p className="text-sm text-stone-500">{stats.total}件のキャン活から</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TempTile months={stats.months} />
        <PegTile stats={stats} />
        <FireTile fire={stats.fire} />
      </div>

      <Card title="① 月別の明け方の最低気温" note="各月の平均（℃）。記録のない月は薄い文字">
        <MonthlyTempChart months={stats.months} />
      </Card>

      {stats.sleep.length > 0 && (
        <Card title="① 寝袋の目安" note="その寝袋で快適に眠れた人の割合">
          <SleepTable sleep={stats.sleep} />
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card title="② 必要だったペグ">
          <MeterList items={stats.peg} labels={PEG_NEEDED} total={stats.total} />
        </Card>
        <Card title="② 地面">
          <MeterList items={stats.ground} labels={GROUND_TYPE} total={stats.total} />
        </Card>
        <Card title="③ 焚き火">
          <MeterList items={stats.fire} labels={FIRE_STATUS} total={stats.total} />
        </Card>
        <Card title="そのほか">
          <Others stats={stats} />
        </Card>
      </div>
    </section>
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

function TempTile({ months }: { months: MonthStat[] }) {
  const withTemp = months.filter((m) => m.coldest != null);
  if (withTemp.length === 0) return <Tile label="① 気温" value="記録なし" sub="気温の入った投稿がまだありません" />;
  const coldest = withTemp.reduce((a, b) => ((b.coldest ?? 0) < (a.coldest ?? 0) ? b : a));
  return (
    <Tile
      label="① いちばん冷えた記録"
      value={`${coldest.coldest}℃`}
      sub={`${coldest.month}月・気温の記録 ${withTemp.reduce((n, m) => n + m.tempCount, 0)}件`}
    />
  );
}

function PegTile({ stats }: { stats: Stats }) {
  const topPeg = stats.peg[0];
  const topGround = stats.ground[0];
  return (
    <Tile
      label="② ペグ"
      value={PEG_NEEDED[topPeg.key]}
      sub={`${stats.total}件中${topPeg.count}件・地面は${GROUND_TYPE[topGround.key]}が多い`}
    />
  );
}

function FireTile({ fire }: { fire: Breakdown<keyof typeof FIRE_STATUS> }) {
  const count = (k: keyof typeof FIRE_STATUS) => fire.find((f) => f.key === k)?.count ?? 0;
  // ルールで禁止の日は除き、「焚き火をしようとした日のうち風で控えた割合」を出す
  const tried = count("done") + count("skipped_wind");
  if (tried === 0) return <Tile label="③ 焚き火" value="できた記録なし" sub="ルールで禁止の記録のみ" />;
  return (
    <Tile
      label="③ 風で焚き火を控えた日"
      value={`${pct(count("skipped_wind"), tried)}%`}
      sub={`焚き火をしようとした${tried}件中${count("skipped_wind")}件`}
    />
  );
}

/* ---------- 月別の気温（0℃を境にした上下の棒） ---------- */

function MonthlyTempChart({ months }: { months: MonthStat[] }) {
  const values = months.map((m) => m.avgMinTemp).filter((v): v is number => v != null);
  // 目盛りは最低でも ±10℃ を確保し、0℃の線が常に見えるようにする
  const hi = Math.max(10, ...values.map((v) => Math.ceil(v / 5) * 5));
  const lo = Math.min(-10, ...values.map((v) => Math.floor(v / 5) * 5));
  const H = 160;
  const y = (v: number) => ((hi - v) / (hi - lo)) * H;
  const zero = y(0);

  return (
    <figure>
      <div className="relative" style={{ height: H + 24 }}>
        {/* 0℃の基準線と目盛り */}
        <div className="absolute inset-x-0 border-t border-stone-300" style={{ top: zero }} />
        <span className="absolute -top-2 right-0 text-[10px] text-stone-400">{hi}℃</span>
        <span className="absolute right-0 text-[10px] text-stone-400" style={{ top: zero - 14 }}>
          0℃
        </span>
        <span className="absolute right-0 text-[10px] text-stone-400" style={{ top: H - 12 }}>
          {lo}℃
        </span>

        <div className="absolute inset-0 grid grid-cols-12 gap-1 pr-8">
          {months.map((m) => {
            const v = m.avgMinTemp;
            const tip =
              v == null
                ? `${m.month}月：記録なし`
                : `${m.month}月：平均 ${v}℃（最低 ${m.coldest}℃・${m.tempCount}件）`;
            return (
              <div key={m.month} className="group relative" title={tip}>
                {v != null && (
                  <>
                    <div
                      className="absolute inset-x-[15%] group-hover:opacity-80"
                      style={{
                        top: Math.min(y(v), zero),
                        height: Math.max(2, Math.abs(y(v) - zero)),
                        background: v < 0 ? COLD : WARM,
                        // データ側の端だけ丸める（基準線側は平ら）
                        borderRadius: v < 0 ? "0 0 4px 4px" : "4px 4px 0 0",
                      }}
                    />
                    <span
                      className="absolute inset-x-0 text-center text-[11px] font-medium text-stone-700"
                      style={{ top: v < 0 ? y(v) + 2 : y(v) - 16 }}
                    >
                      {v}
                    </span>
                  </>
                )}
                <span
                  className={`absolute inset-x-0 text-center text-[11px] ${v == null ? "text-stone-300" : "text-stone-600"}`}
                  style={{ top: H + 6 }}
                >
                  {m.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="mt-1 text-right text-[11px] text-stone-400">月</figcaption>

      {/* 画面読み上げ用の表 */}
      <table className="sr-only">
        <caption>月別の明け方の最低気温（平均）</caption>
        <thead>
          <tr>
            <th>月</th>
            <th>平均</th>
            <th>最低</th>
            <th>件数</th>
          </tr>
        </thead>
        <tbody>
          {months
            .filter((m) => m.avgMinTemp != null)
            .map((m) => (
              <tr key={m.month}>
                <td>{m.month}月</td>
                <td>{m.avgMinTemp}℃</td>
                <td>{m.coldest}℃</td>
                <td>{m.tempCount}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------- 寝袋の目安 ---------- */

function SleepTable({ sleep }: { sleep: SleepStat[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
          <th className="py-1.5 font-medium">月</th>
          <th className="py-1.5 font-medium">寝袋の快適温度</th>
          <th className="py-1.5 text-right font-medium">快適に眠れた</th>
        </tr>
      </thead>
      <tbody>
        {sleep.map((s) => (
          <tr key={`${s.month}:${s.bagBand}`} className="border-b border-stone-100 last:border-0">
            <td className="py-1.5">{s.month}月</td>
            <td className="py-1.5">
              {s.bagBand}〜{s.bagBand + 4}℃
            </td>
            <td className="py-1.5 text-right">
              <span className="font-medium">{pct(s.comfortable, s.count)}%</span>
              <span className="ml-1 text-xs text-stone-500">
                （{s.count}件中{s.comfortable}件）
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------- 内訳（名前・棒・件数を1行ずつ） ---------- */

function MeterList<K extends string>({
  items,
  labels,
  total,
}: {
  items: Breakdown<K>;
  labels: Record<K, string>;
  total: number;
}) {
  const shown = items.filter((i) => i.count > 0);
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
              className={`h-1.5 rounded-full ${idx === 0 ? "bg-emerald-700" : "bg-stone-400"}`}
              style={{ width: `${pct(i.count, total)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Others({ stats }: { stats: Stats }) {
  const yesNo = (s: { yes: number; no: number }, yes: string, no: string) =>
    s.yes + s.no === 0 ? "記録なし" : `${yes} ${s.yes}件・${no} ${s.no}件`;
  const bugLabel =
    stats.bug.avg == null ? "記録なし" : BUG_LEVEL[Math.round(stats.bug.avg) as keyof typeof BUG_LEVEL];
  return (
    <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
      <dt className="text-stone-500">虫</dt>
      <dd>
        {bugLabel}
        {stats.bug.count > 0 && <span className="ml-1 text-xs text-stone-500">（{stats.bug.count}件）</span>}
      </dd>
      <dt className="text-stone-500">炊事場のお湯</dt>
      <dd>{yesNo(stats.hotWater, "出た", "出なかった")}</dd>
      <dt className="text-stone-500">車の乗り入れ</dt>
      <dd>{yesNo(stats.carAccess, "できた", "できなかった")}</dd>
    </dl>
  );
}

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
