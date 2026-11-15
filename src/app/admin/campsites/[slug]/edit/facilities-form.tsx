"use client";

import { useActionState } from "react";
import type { FacilitiesState } from "@/app/admin/actions";
import { FacilityFields } from "@/components/facility-fields";
import type { Campsite } from "@/lib/labels";

/** 今ある4項目は「あり・なし」だけ（チェックしなければなし） */
export const BASIC_FACILITIES = {
  car_access: "車乗り入れ",
  has_hot_water: "炊事場お湯",
  has_shower: "シャワー",
  has_bath: "風呂",
} as const;

export function FacilitiesForm({
  campsite,
  action,
}: {
  campsite: Campsite;
  action: (prev: FacilitiesState, formData: FormData) => Promise<FacilitiesState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, saved: false });

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-stone-200 bg-white p-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-stone-700">
          あるもの<span className="ml-2 text-xs font-normal text-stone-500">チェックしないものは「なし」</span>
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {Object.entries(BASIC_FACILITIES).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name={key}
                value="yes"
                defaultChecked={campsite[key as keyof typeof BASIC_FACILITIES]}
                className="h-4 w-4 accent-emerald-700"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <FacilityFields initial={campsite} unknownLabel="未入力" />

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.saved && !pending && (
        <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          保存しました。キャンプ場ページに反映されています。
        </p>
      )}
      <button
        disabled={pending}
        className="h-11 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 disabled:opacity-50 sm:ml-auto sm:block sm:w-auto sm:px-8"
      >
        {pending ? "保存しています…" : "保存する"}
      </button>
    </form>
  );
}
