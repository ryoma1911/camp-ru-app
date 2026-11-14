"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CheckinSummary } from "@/lib/campsite-stats";
import type { Campsite } from "@/lib/labels";
import { EMPTY_FILTERS, countMatches, toQuery, type Filters, type SearchTab } from "@/lib/search";
import { FeatureFields, PrefectureFields } from "./fields";

const TABS: { key: SearchTab; label: string; short: string }[] = [
  { key: "keyword", label: "キーワードから探す", short: "キーワード" },
  { key: "pref", label: "都道府県から探す", short: "都道府県" },
  { key: "feature", label: "特徴から探す", short: "特徴" },
];

/**
 * トップの検索エリア。タブごとに「新しく探す」ためのもので、検索すると
 * そのタブの条件だけで結果を出す（条件の組み合わせは結果画面の絞り込み欄で行う）
 */
export function HeroSearch({
  campsites,
  summaries,
  currentTab,
  compact,
}: {
  campsites: Campsite[];
  summaries: Record<string, CheckinSummary>;
  /** 今の結果がどのタブから来たか（結果画面でタブを選んだ状態にする） */
  currentTab: SearchTab | null;
  /** 結果画面では小さく表示し、タブを押すまでパネルを閉じておく */
  compact: boolean;
}) {
  const router = useRouter();
  const [openTab, setOpenTab] = useState<SearchTab | null>(compact ? null : "keyword");
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [keyword, setKeyword] = useState("");

  const prefCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of campsites) counts[c.prefecture] = (counts[c.prefecture] ?? 0) + 1;
    return counts;
  }, [campsites]);

  const highlighted = openTab ?? currentTab;
  const liveCount = countMatches(campsites, summaries, draft);

  function selectTab(tab: SearchTab) {
    // タブを切り替えたら、そのタブの条件だけで新しく探す
    setDraft(EMPTY_FILTERS);
    setKeyword("");
    setOpenTab(compact && openTab === tab ? null : tab);
  }

  function search(tab: SearchTab, f: Partial<Filters>) {
    router.push(toQuery({ ...EMPTY_FILTERS, ...f, tab }));
    if (compact) setOpenTab(null);
  }

  return (
    <section className={`rounded-2xl bg-emerald-800 text-white ${compact ? "px-3 py-3" : "px-4 py-8 sm:py-12"}`}>
      {!compact && (
        <div className="mb-6 text-center">
          <p className="text-sm text-emerald-100">行った人のリアルでわかる、キャンプ場の現地コンディション</p>
          <p className="mt-2 text-4xl font-bold tracking-wide sm:text-5xl">Campる</p>
        </div>
      )}

      <div role="tablist" aria-label="探し方" className="mx-auto grid max-w-2xl grid-cols-3 overflow-hidden rounded-lg border-2 border-white">
        {TABS.map((t, i) => {
          const on = highlighted === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => selectTab(t.key)}
              className={`relative py-2.5 text-sm font-bold ${i > 0 ? "border-l border-white/70" : ""} ${
                on ? "bg-white text-emerald-900" : "text-white hover:bg-white/10"
              }`}
            >
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {openTab === "keyword" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            search("keyword", { q: keyword.trim() });
          }}
          className="mx-auto mt-4 flex max-w-2xl overflow-hidden rounded-lg"
        >
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="キャンプ場名・エリア（例：富士、山梨、湖畔）"
            aria-label="キーワード"
            className="h-12 min-w-0 flex-1 bg-white px-4 text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <button className="h-12 shrink-0 bg-amber-700 px-6 font-bold text-white hover:bg-amber-800">検索</button>
        </form>
      )}

      {openTab === "pref" && (
        <Panel
          count={liveCount}
          selected={draft.prefs.length ? `${draft.prefs.length}県を選択中` : "都道府県を選んでください"}
          onClear={() => setDraft(EMPTY_FILTERS)}
          onSearch={() => search("pref", { prefs: draft.prefs })}
          canSearch={draft.prefs.length > 0}
        >
          <PrefectureFields filters={draft} onChange={setDraft} counts={prefCounts} />
        </Panel>
      )}

      {openTab === "feature" && (
        <Panel
          count={liveCount}
          selected={`${countSelected(draft)}つを選択中`}
          onClear={() => setDraft(EMPTY_FILTERS)}
          onSearch={() => search("feature", draft)}
          canSearch={countSelected(draft) > 0}
        >
          <FeatureFields filters={draft} onChange={setDraft} />
        </Panel>
      )}
    </section>
  );
}

const countSelected = (f: Filters) =>
  f.facilities.length + f.types.length + f.sites.length + f.reals.length + f.grounds.length +
  (f.month && f.minTemp != null ? 1 : 0);

function Panel({
  children,
  count,
  selected,
  onClear,
  onSearch,
  canSearch,
}: {
  children: React.ReactNode;
  count: number;
  selected: string;
  onClear: () => void;
  onSearch: () => void;
  canSearch: boolean;
}) {
  return (
    <div className="mx-auto mt-4 max-w-2xl rounded-lg bg-white text-stone-900">
      <div className="max-h-[60vh] overflow-y-auto p-4">{children}</div>
      {/* スマホでもスクロール位置に関係なく押せるよう、パネルの下端に固定する */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-lg border-t border-stone-200 bg-white px-4 py-3">
        <span className="text-sm text-stone-600">
          {selected}
          <button type="button" onClick={onClear} className="ml-2 text-emerald-700 underline">
            クリア
          </button>
        </span>
        <button
          type="button"
          onClick={onSearch}
          disabled={!canSearch || count === 0}
          className="h-11 shrink-0 rounded-lg bg-amber-700 px-5 font-bold text-white hover:bg-amber-800 disabled:bg-stone-300"
        >
          {count === 0 ? "条件に合うキャンプ場がありません" : `${count}件を表示`}
        </button>
      </div>
    </div>
  );
}
