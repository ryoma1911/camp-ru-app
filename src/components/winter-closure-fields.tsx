"use client";

import { useState } from "react";
import type { ClosureValues } from "@/lib/closure";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const select = "h-10 rounded-lg border border-stone-300 bg-white px-2 text-sm";

const split = (md: string | null | undefined, fallback: [number, number]) =>
  md ? [Number(md.slice(0, 2)), Number(md.slice(3, 5))] : fallback;

/** 運営が入れる冬季閉鎖の期間（毎年同じ月日）。チェックを外して保存すると「閉鎖なし」に戻る */
export function WinterClosureFields({ initial }: { initial?: Partial<ClosureValues> }) {
  const [on, setOn] = useState(Boolean(initial?.winter_closed_from));
  const [fm, fd] = split(initial?.winter_closed_from, [12, 1]);
  const [tm, td] = split(initial?.winter_closed_to, [3, 31]);

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium text-stone-700">冬季閉鎖</legend>
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          name="winter_closed"
          value="yes"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 accent-emerald-700"
        />
        冬季閉鎖あり
      </label>
      <p className="text-xs text-stone-500">毎年同じ期間として扱います（年をまたいでよい）。閉鎖中と、閉鎖の30日前から表示されます</p>
      {on && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <MonthDay prefix="from" month={fm} day={fd} />
            <span>〜</span>
            <MonthDay prefix="to" month={tm} day={td} />
          </div>
          <input
            name="winter_closure_note"
            defaultValue={initial?.winter_closure_note ?? ""}
            maxLength={100}
            placeholder="補足（例：積雪により変わることがあります）"
            aria-label="冬季閉鎖の補足"
            className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm"
          />
        </>
      )}
    </fieldset>
  );
}

function MonthDay({ prefix, month, day }: { prefix: "from" | "to"; month: number; day: number }) {
  const label = prefix === "from" ? "閉鎖の始まり" : "閉鎖の終わり";
  return (
    <span className="flex items-center gap-1">
      <select name={`closed_${prefix}_month`} defaultValue={month} aria-label={`${label}（月）`} className={select}>
        {MONTHS.map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
      <select name={`closed_${prefix}_day`} defaultValue={day} aria-label={`${label}（日）`} className={select}>
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d}日
          </option>
        ))}
      </select>
    </span>
  );
}
