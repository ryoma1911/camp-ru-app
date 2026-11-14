"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CheckinSummary } from "@/lib/campsite-stats";
import type { Campsite } from "@/lib/labels";
import { PREFECTURES, countMatches, toQuery, type Filters } from "@/lib/search";
import { FeatureFields, GroupTitle, PrefectureFields, type CountFor } from "./fields";

type Props = {
  campsites: Campsite[];
  summaries: Record<string, CheckinSummary>;
  filters: Filters;
  active: { id: string; label: string; href: string }[];
};

/**
 * 結果画面の絞り込み欄。上のタブで探した結果に、他のタブの条件を足していく。
 * PC は左側に常に表示してすぐ反映、スマホは「絞り込み」から開くパネルで「〇件を表示」を押して反映する
 */
export function RefinePanel(props: Props) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const apply = (next: Filters) => router.push(toQuery(next), { scroll: false });

  return (
    <>
      {/* PC：左側に常に表示 */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-stone-200 bg-white p-4">
          <Fields {...props} filters={props.filters} onChange={apply} />
        </div>
      </aside>

      {/* スマホ：ボタンからパネルを開く */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="h-10 w-full rounded-lg border border-emerald-700 font-bold text-emerald-800"
        >
          絞り込み{props.active.length > 0 && ` (${props.active.length})`}
        </button>
        {sheetOpen && (
          <Sheet
            {...props}
            onClose={() => setSheetOpen(false)}
            onApply={(next) => {
              apply(next);
              setSheetOpen(false);
            }}
          />
        )}
      </div>
    </>
  );
}

function Sheet({
  campsites,
  summaries,
  filters,
  onClose,
  onApply,
}: Props & { onClose: () => void; onApply: (next: Filters) => void }) {
  const [draft, setDraft] = useState(filters);
  const count = countMatches(campsites, summaries, draft);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" role="dialog" aria-modal="true" aria-label="絞り込み">
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <button type="button" onClick={onClose} className="text-sm text-stone-600">
          閉じる
        </button>
        <p className="font-bold">絞り込み</p>
        <button
          type="button"
          onClick={() => setDraft({ ...filters, q: "", prefs: [], types: [], sites: [], facilities: [], reals: [], grounds: [], month: null, minTemp: null })}
          className="text-sm text-emerald-700 underline"
        >
          すべて解除
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <Fields campsites={campsites} summaries={summaries} filters={draft} onChange={setDraft} hideChips />
      </div>
      <div className="border-t border-stone-200 p-3">
        <button
          type="button"
          onClick={() => onApply(draft)}
          disabled={count === 0}
          className="h-12 w-full rounded-lg bg-amber-700 font-bold text-white disabled:bg-stone-300"
        >
          {count === 0 ? "条件に合うキャンプ場がありません" : `${count}件を表示`}
        </button>
      </div>
    </div>
  );
}

function Fields({
  campsites,
  summaries,
  filters,
  active,
  onChange,
  hideChips,
}: Omit<Props, "active"> & {
  active?: Props["active"];
  onChange: (next: Filters) => void;
  hideChips?: boolean;
}) {
  const [editPrefs, setEditPrefs] = useState(false);
  const countFor: CountFor = (next) => countMatches(campsites, summaries, next);

  // 都道府県の横の数字：その県だけに絞ったときの件数（他の条件はそのまま）
  const prefCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PREFECTURES) counts[p] = countMatches(campsites, summaries, { ...filters, prefs: [p] });
    return counts;
  }, [campsites, summaries, filters]);

  return (
    <div className="space-y-5">
      {!hideChips && active && active.length > 0 && (
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <GroupTitle>選んでいる条件</GroupTitle>
            <Link href={toQuery({ tab: filters.tab })} className="text-xs text-emerald-700 underline">
              すべて解除
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {active.map((a) => (
              <Link
                key={a.id}
                href={a.href}
                scroll={false}
                className="rounded-full border border-stone-300 bg-stone-50 px-2.5 py-0.5 text-xs hover:bg-stone-100"
                aria-label={`条件「${a.label}」を外す`}
              >
                {a.label} ✕
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* URL のキーワードが変わったら入力欄も入れ直す */}
      <KeywordField key={filters.q} initial={filters.q} onSubmit={(q) => onChange({ ...filters, q })} />

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <GroupTitle note="どれか">都道府県</GroupTitle>
          <button type="button" onClick={() => setEditPrefs(!editPrefs)} className="text-xs text-emerald-700 underline">
            {editPrefs ? "閉じる" : "変更"}
          </button>
        </div>
        {editPrefs ? (
          <PrefectureFields filters={filters} onChange={onChange} counts={prefCounts} />
        ) : (
          <p className="text-sm text-stone-600">{filters.prefs.length ? filters.prefs.join("・") : "指定なし"}</p>
        )}
      </div>

      <FeatureFields filters={filters} onChange={onChange} countFor={countFor} compact />
    </div>
  );
}

function KeywordField({ initial, onSubmit }: { initial: string; onSubmit: (q: string) => void }) {
  const [keyword, setKeyword] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(keyword.trim());
      }}
    >
      <GroupTitle>キーワード</GroupTitle>
      <div className="flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="名前・エリアで絞る"
          aria-label="キーワードで絞る"
          className="h-9 min-w-0 flex-1 rounded-lg border border-stone-300 px-2 text-sm"
        />
        <button className="h-9 shrink-0 rounded-lg border border-stone-300 px-3 text-sm hover:bg-stone-100">絞る</button>
      </div>
    </form>
  );
}
