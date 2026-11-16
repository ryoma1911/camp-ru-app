"use client";

import { useActionState, useState } from "react";
import { splitPrefecture } from "@/lib/address";
import { FacilityFields } from "@/components/facility-fields";
import { PlaceIdField } from "@/components/place-id-field";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE, type Facilities } from "@/lib/labels";
import { PREFECTURES } from "@/lib/search";
import type { ApproveState } from "./actions";

export type SubmissionDraft = Facilities & {
  name: string;
  prefecture: string;
  address: string;
  official_url: string | null;
  location_type: string | null;
  site_style: string | null;
  fire_rule: string | null;
  car_access: boolean | null;
  has_hot_water: boolean | null;
  has_shower: boolean | null;
  has_bath: boolean | null;
};

const FACILITIES = {
  car_access: "車乗り入れ",
  has_hot_water: "炊事場お湯",
  has_shower: "シャワー",
  has_bath: "風呂",
} as const;

const input = "h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm";

/** 公開する内容（申請の内容を初期値にして、運営が公式サイトで確認して直す） */
export function ApproveForm({
  draft,
  action,
}: {
  draft: SubmissionDraft;
  action: (prev: ApproveState, formData: FormData) => Promise<ApproveState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [prefecture, setPrefecture] = useState(draft.prefecture);
  // 申請の住所は都道府県から始まる形で保存しているので、欄には続きだけを出す
  const [address, setAddress] = useState(() => splitPrefecture(draft.address).rest);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-stone-200 p-4">
      <h3 className="font-bold">公開する内容</h3>
      <p className="text-xs text-stone-500">公式サイトで確認して直してください。URL（slug）は公開するときに自動で作られます（例：nagano-k3f9a2）。</p>
      <Label text="正式名">
        <input name="name" defaultValue={draft.name} required maxLength={80} className={input} />
      </Label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Label text="都道府県">
          <select
            name="prefecture"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            required
            className={input}
          >
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Label>
        <Label text="住所（都道府県のあと、番地まで）">
          <span className="flex h-10 overflow-hidden rounded-lg border border-stone-300 bg-white text-sm focus-within:ring-2 focus-within:ring-emerald-500">
            <span className="flex shrink-0 items-center border-r border-stone-200 bg-stone-50 px-3 text-stone-700">
              {prefecture}
            </span>
            <input
              name="address"
              value={address}
              onChange={(e) => {
                const { prefecture: written, rest } = splitPrefecture(e.target.value);
                setAddress(written === prefecture ? rest : e.target.value);
              }}
              required
              maxLength={200}
              className="min-w-0 flex-1 px-3 outline-none"
            />
          </span>
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
        <Label text="緯度">
          <input name="lat" inputMode="decimal" placeholder="36.1234" className={input} />
        </Label>
        <Label text="経度">
          <input name="lng" inputMode="decimal" placeholder="138.1234" className={input} />
        </Label>
        <div className="col-span-2 sm:col-span-1">
          <Label text="公式サイト">
            <input name="official_url" type="url" defaultValue={draft.official_url ?? ""} className={input} />
          </Label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Label text="種類" required>
          <Select name="location_type" options={LOCATION_TYPE} value={draft.location_type} />
        </Label>
        <Label text="サイト" required>
          <Select name="site_style" options={SITE_STYLE} value={draft.site_style} />
        </Label>
        <Label text="焚き火" required>
          <Select name="fire_rule" options={FIRE_RULE} value={draft.fire_rule} />
        </Label>
      </div>
      <fieldset>
        <legend className="mb-1 text-xs text-stone-600">設備（公式サイトで確認できたものだけ）</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {Object.entries(FACILITIES).map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name={key}
                value="yes"
                defaultChecked={draft[key as keyof typeof FACILITIES] === true}
                className="h-4 w-4 accent-emerald-700"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <FacilityFields initial={draft} unknownLabel="未入力" />
      <PlaceIdField />
      <Label text="運営のメモ">
        <input name="admin_note" maxLength={500} className={input} />
      </Label>
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="h-11 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 disabled:opacity-50 sm:ml-auto sm:block sm:w-auto sm:px-8"
      >
        {pending ? "公開しています…" : "承認して公開"}
      </button>
    </form>
  );
}

function Label({ text, required, children }: { text: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-stone-600">
        {text}
        {required && <span className="ml-1 text-red-600">必須</span>}
      </span>
      {children}
    </label>
  );
}

function Select({ name, options, value }: { name: string; options: Record<string, string>; value: string | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} required className={input}>
      <option value="">選んでください</option>
      {Object.entries(options).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
