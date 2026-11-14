"use client";

import { startTransition, useActionState, useState } from "react";
import {
  BUG_LEVEL,
  FIRE_STATUS,
  GROUND_TYPE,
  PEG_NEEDED,
  SLEEP_QUALITY,
} from "@/lib/labels";
import type { CheckinFormState } from "./actions";
import { PhotoPicker } from "./photo-picker";

type Props = {
  action: (prev: CheckinFormState, formData: FormData) => Promise<CheckinFormState>;
  userId: string;
};

// 気温は iPhone のテンキーでマイナスが打てないため、選択式にする
const TEMPS = Array.from({ length: 51 }, (_, i) => 25 - i); // 25 〜 -25
const BAG_TEMPS = Array.from({ length: 36 }, (_, i) => 15 - i); // 15 〜 -20

function todayInJapan() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export function CheckinForm({ action, userId }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [uploading, setUploading] = useState(false);
  const [today] = useState(todayInJapan);

  return (
    <form
      // action= を使うと送信後にフォームが空になるため、onSubmit から呼んで入力を残す
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="space-y-8"
    >
      <Field label="行った日">
        <input
          type="date"
          name="visited_on"
          required
          defaultValue={today}
          max={today}
          className="h-11 rounded-lg border border-stone-300 bg-white px-3"
        />
      </Field>

      <Section number="①" title="気温と睡眠">
        <Field label="夜の最低気温">
          <div className="flex flex-wrap items-center gap-3">
            <select name="min_temp_c" defaultValue="" className="h-11 rounded-lg border border-stone-300 bg-white px-3">
              <option value="">わからない</option>
              {TEMPS.map((t) => (
                <option key={t} value={t}>
                  {t}℃
                </option>
              ))}
            </select>
            <Chips name="temp_measured" options={{ yes: "温度計で実測", no: "体感" }} defaultValue="no" />
          </div>
        </Field>
        <Field label="いつの気温？">
          <Chips name="temp_at_dawn" options={{ yes: "明け方", no: "それ以外" }} defaultValue="yes" />
        </Field>
        <Field label="寝袋の快適温度" hint="わかれば。寝袋のタグに書いてあります">
          <select
            name="sleeping_bag_comfort_c"
            defaultValue=""
            className="h-11 rounded-lg border border-stone-300 bg-white px-3"
          >
            <option value="">わからない</option>
            {BAG_TEMPS.map((t) => (
              <option key={t} value={t}>
                {t}℃
              </option>
            ))}
          </select>
        </Field>
        <Field label="眠れた？">
          <Chips name="sleep_quality" options={SLEEP_QUALITY} />
        </Field>
      </Section>

      <Section number="②" title="地面とペグ">
        <Field label="地面" required>
          <Chips name="ground_type" options={GROUND_TYPE} required />
        </Field>
        <Field label="必要だったペグ" required>
          <Chips name="peg_needed" options={PEG_NEEDED} required />
        </Field>
      </Section>

      <Section number="③" title="焚き火">
        <Field label="焚き火できた？" required>
          <Chips name="fire_status" options={FIRE_STATUS} required />
        </Field>
      </Section>

      <Section title="そのほか（任意）">
        <Field label="虫">
          <Chips name="bug_level" options={BUG_LEVEL} />
        </Field>
        <Field label="サイトに車を乗り入れできた？">
          <Chips name="car_access_ok" options={{ yes: "できた", no: "できなかった" }} />
        </Field>
        <Field label="炊事場でお湯は出た？">
          <Chips name="hot_water_ok" options={{ yes: "出た", no: "出なかった" }} />
        </Field>
        <Field label="ひとこと">
          <textarea
            name="comment"
            maxLength={500}
            rows={3}
            placeholder="例：夜中に風が強くなり、焚き火は早めに切り上げました"
            className="w-full rounded-lg border border-stone-300 bg-white p-3"
          />
        </Field>
        <Field label="写真（4枚まで）">
          <PhotoPicker userId={userId} onUploadingChange={setUploading} />
        </Field>
      </Section>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <button
        disabled={pending || uploading}
        className="h-12 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "投稿しています…" : uploading ? "写真をアップロード中…" : "キャン活を投稿する"}
      </button>
    </form>
  );
}

function Section({ number, title, children }: { number?: string; title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-5 rounded-xl border border-stone-200 bg-white p-4">
      <legend className="px-1 font-bold">
        {number && <span className="mr-1 text-emerald-700">{number}</span>}
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-xs text-red-600">必須</span>}
        {hint && <span className="ml-2 text-xs font-normal text-stone-500">{hint}</span>}
      </p>
      {children}
    </div>
  );
}

/** タップで選ぶボタン（中身はラジオボタン） */
function Chips({
  name,
  options,
  required,
  defaultValue,
}: {
  name: string;
  options: Record<string | number, string>;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={value}
            required={required}
            defaultChecked={defaultValue === value}
            className="peer sr-only"
          />
          <span className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}
