"use client";

import { GROUND_TYPE, LOCATION_TYPE } from "@/lib/labels";
import { FACILITIES, REALS, REGIONS, TEMP_OPTIONS, toggle, type Filters } from "@/lib/search";

/** 「この選択肢を足したら何件になるか」。省略すると件数は出さない */
export type CountFor = (next: Filters) => number;

type FieldProps = {
  filters: Filters;
  onChange: (next: Filters) => void;
  countFor?: CountFor;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function CheckItem({
  label,
  checked,
  count,
  onToggle,
}: {
  label: string;
  checked: boolean;
  count?: number;
  onToggle: () => void;
}) {
  // 足すと0件になる選択肢は選べないようにする（外す操作はいつでもできる）
  const disabled = !checked && count === 0;
  return (
    <label className={`flex items-center gap-2 py-1 text-sm ${disabled ? "text-stone-300" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 accent-emerald-700"
      />
      <span className="min-w-0">
        {label}
        {count != null && <span className={`ml-1 ${disabled ? "" : "text-stone-500"}`}>({count})</span>}
      </span>
    </label>
  );
}

export function GroupTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <p className="mb-1 text-xs font-bold text-stone-600">
      {children}
      {note && <span className="ml-1 font-normal text-stone-400">{note}</span>}
    </p>
  );
}

/** 都道府県のチェック（地方ごと）。counts は県ごとの件数 */
export function PrefectureFields({
  filters,
  onChange,
  counts,
  openRegions,
}: FieldProps & { counts: Record<string, number>; openRegions?: "withCampsites" | "all" }) {
  return (
    <div className="space-y-2">
      {REGIONS.map((region) => {
        const total = region.prefs.reduce((n, p) => n + (counts[p] ?? 0), 0);
        const selectable = region.prefs.filter((p) => (counts[p] ?? 0) > 0);
        const allOn = selectable.length > 0 && selectable.every((p) => filters.prefs.includes(p));
        const open =
          openRegions === "all" || region.prefs.some((p) => filters.prefs.includes(p)) || total > 0;
        return (
          <details key={region.name} open={open} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-bold text-stone-700">
              <span>
                {region.name}
                <span className="ml-1 font-normal text-stone-400">({total})</span>
              </span>
              <span className="text-stone-400 group-open:rotate-180">▾</span>
            </summary>
            {selectable.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...filters,
                    prefs: allOn
                      ? filters.prefs.filter((p) => !selectable.includes(p))
                      : [...new Set([...filters.prefs, ...selectable])],
                  })
                }
                className="mb-1 text-xs text-emerald-700 underline"
              >
                {allOn ? "この地方をすべて外す" : "この地方をすべて選ぶ"}
              </button>
            )}
            <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-4">
              {region.prefs.map((p) => (
                <CheckItem
                  key={p}
                  label={p}
                  count={counts[p] ?? 0}
                  checked={filters.prefs.includes(p)}
                  onToggle={() => onChange({ ...filters, prefs: toggle(filters.prefs, p) })}
                />
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** 特徴のチェック（公式の情報と、ソト活の集計） */
export function FeatureFields({ filters, onChange, countFor, compact }: FieldProps & { compact?: boolean }) {
  const count = (next: Filters) => (countFor ? countFor(next) : undefined);
  const grid = compact ? "grid grid-cols-1" : "grid grid-cols-2 gap-x-3 sm:grid-cols-3";
  return (
    <div className="space-y-4">
      <div>
        <GroupTitle note="すべて満たす">設備</GroupTitle>
        <div className={grid}>
          {(Object.keys(FACILITIES) as (keyof typeof FACILITIES)[]).map((k) => {
            const next = { ...filters, facilities: toggle(filters.facilities, k) };
            return (
              <CheckItem key={k} label={FACILITIES[k]} checked={filters.facilities.includes(k)} count={count(next)} onToggle={() => onChange(next)} />
            );
          })}
        </div>
      </div>
      <div>
        <GroupTitle note="どれか">ロケーション</GroupTitle>
        <div className={grid}>
          {(Object.keys(LOCATION_TYPE) as (keyof typeof LOCATION_TYPE)[]).map((k) => {
            const next = { ...filters, types: toggle(filters.types, k) };
            return (
              <CheckItem key={k} label={LOCATION_TYPE[k]} checked={filters.types.includes(k)} count={count(next)} onToggle={() => onChange(next)} />
            );
          })}
        </div>
      </div>
      <div>
        <GroupTitle note="どれか">サイト形式</GroupTitle>
        <div className={grid}>
          {(["sectioned", "free"] as const).map((k) => {
            const next = { ...filters, sites: toggle(filters.sites, k) };
            return (
              <CheckItem
                key={k}
                label={k === "sectioned" ? "区画サイト" : "フリーサイト"}
                checked={filters.sites.includes(k)}
                count={count(next)}
                onToggle={() => onChange(next)}
              />
            );
          })}
        </div>
      </div>
      <div className="rounded-lg bg-emerald-50 p-3">
        <GroupTitle note="ソト活の集計。データがないキャンプ場は結果から外れます">現地のリアル</GroupTitle>
        <div className={grid}>
          {(Object.keys(REALS) as (keyof typeof REALS)[]).map((k) => {
            const next = { ...filters, reals: toggle(filters.reals, k) };
            return (
              <CheckItem key={k} label={REALS[k]} checked={filters.reals.includes(k)} count={count(next)} onToggle={() => onChange(next)} />
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">地面（どれか）</p>
        <div className={grid}>
          {(Object.keys(GROUND_TYPE) as (keyof typeof GROUND_TYPE)[]).map((k) => {
            const next = { ...filters, grounds: toggle(filters.grounds, k) };
            return (
              <CheckItem key={k} label={GROUND_TYPE[k]} checked={filters.grounds.includes(k)} count={count(next)} onToggle={() => onChange(next)} />
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <select
            aria-label="行く月"
            value={filters.month ?? ""}
            onChange={(e) => onChange({ ...filters, month: e.target.value ? Number(e.target.value) : null })}
            className="h-9 rounded-lg border border-stone-300 bg-white px-2"
          >
            <option value="">行く月</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          <span>の明け方が</span>
          <select
            aria-label="最低気温"
            value={filters.minTemp ?? ""}
            onChange={(e) => onChange({ ...filters, minTemp: e.target.value === "" ? null : Number(e.target.value) })}
            className="h-9 rounded-lg border border-stone-300 bg-white px-2"
          >
            <option value="">指定なし</option>
            {TEMP_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}℃以上
              </option>
            ))}
          </select>
        </div>
        {filters.minTemp != null && !filters.month && (
          <p className="mt-1 text-xs text-amber-700">気温で絞るには、行く月も選んでください。</p>
        )}
      </div>
    </div>
  );
}
