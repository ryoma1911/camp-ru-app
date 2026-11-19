"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useState } from "react";
import type { CheckinFormState } from "@/lib/checkin-input";
import {
  BUG_LEVEL,
  FIRE_STATUS,
  HEATER,
  MAX_NIGHTS,
  PARTY_TYPE,
  PEG_NEEDED,
  SLEEPING_BAG_HINT,
  SLEEPING_BAG_TYPE,
  SLEEP_QUALITY,
  WEATHER,
  type Checkin,
} from "@/lib/labels";
import { stayLabel } from "@/lib/stay";
import { PhotoPicker } from "./photo-picker";

type Props = {
  action: (prev: CheckinFormState, formData: FormData) => Promise<CheckinFormState>;
  userId: string;
  /** 編集のときは前回の内容を入れて開く */
  initial?: Checkin;
  submitLabel?: string;
  /** キャンセルで戻る先（ブラウザの履歴がないとき） */
  cancelHref: string;
};

// 気温は iPhone のテンキーでマイナスが打てないため、選択式にする
const TEMPS = Array.from({ length: 51 }, (_, i) => 25 - i); // 25 〜 -25

function todayInJapan() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}

const yesNo = (v: boolean | null | undefined) => (v == null ? undefined : v ? "yes" : "no");
const str = (v: number | string | null | undefined) => (v == null ? undefined : String(v));

export function CheckinForm({ action, userId, initial, submitLabel = "ソト活を投稿する", cancelHref }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, { error: null });
  const [uploading, setUploading] = useState(false);
  const [photoCount, setPhotoCount] = useState(initial?.checkin_photos.length ?? 0);
  const [dirty, setDirty] = useState(false);
  const [today] = useState(todayInJapan);
  const [visitedOn, setVisitedOn] = useState(initial?.visited_on ?? "");
  const [nights, setNights] = useState(initial?.nights ?? 1);

  /** 入力があれば確認してから、元のページに戻る */
  function cancel() {
    if (dirty && !confirm("入力した内容は保存されません。キャンセルしますか？")) return;
    if (window.history.length > 1) router.back();
    else router.push(cancelHref);
  }
  const initialPhotos = [...(initial?.checkin_photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => p.storage_path);

  return (
    <form
      // action= を使うと送信後にフォームが空になるため、onSubmit から呼んで入力を残す
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      onChange={() => setDirty(true)}
      className="space-y-8"
    >
      <Field label="行った日（1泊目）・泊数" required>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            name="visited_on"
            required
            aria-label="1泊目の日"
            defaultValue={initial?.visited_on ?? today}
            max={today}
            onChange={(e) => setVisitedOn(e.target.value)}
            className="h-11 rounded-lg border border-stone-300 bg-white px-3"
          />
          <select
            name="nights"
            aria-label="泊数"
            value={nights}
            onChange={(e) => setNights(Number(e.target.value))}
            className="h-11 rounded-lg border border-stone-300 bg-white px-3"
          >
            {Array.from({ length: MAX_NIGHTS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}泊
              </option>
            ))}
          </select>
          {nights > 1 && (
            <span className="text-sm text-stone-600">{stayLabel({ visited_on: visitedOn || today, nights })}</span>
          )}
        </div>
      </Field>

      <Field label="天気" hint="滞在中をまとめて・複数選べます">
        <CheckChips name="weather" options={WEATHER} defaultValues={initial?.weather ?? []} />
      </Field>

      <Section number="①" title="気温と睡眠">
        <Field label="夜の最低気温" hint="連泊はいちばん冷えた夜">
          <div className="flex flex-wrap items-center gap-3">
            <select
              name="min_temp_c"
              defaultValue={initial?.min_temp_c != null ? String(Number(initial.min_temp_c)) : ""}
              className="h-11 rounded-lg border border-stone-300 bg-white px-3"
            >
              <option value="">わからない</option>
              {TEMPS.map((t) => (
                <option key={t} value={t}>
                  {t}℃
                </option>
              ))}
            </select>
            <Chips
              name="temp_measured"
              options={{ yes: "温度計で実測", no: "体感" }}
              defaultValue={yesNo(initial?.temp_measured) ?? "no"}
            />
          </div>
          <p className="text-xs text-stone-500">
            「わからない」のときは、気象データからこの場所の夜の最低気温を推定して表示します（集計には入れません）。
          </p>
        </Field>
        <Field label="いつの気温？">
          <Chips
            name="temp_at_dawn"
            options={{ yes: "明け方", no: "それ以外" }}
            defaultValue={yesNo(initial?.temp_at_dawn) ?? "yes"}
          />
        </Field>
        <Field label="使った寝袋" hint="目安は寝袋のタグにある快適温度">
          <Chips
            name="sleeping_bag_type"
            options={{ ...SLEEPING_BAG_TYPE, "": "わからない" }}
            hints={SLEEPING_BAG_HINT}
            defaultValue={initial?.sleeping_bag_type ?? ""}
          />
        </Field>
        <Field label="眠れた？">
          <Chips name="sleep_quality" options={SLEEP_QUALITY} defaultValue={str(initial?.sleep_quality)} />
        </Field>
      </Section>

      <Section number="②" title="地面の固さ">
        <Field label="地面の固さ（必要だったペグ）" required>
          <Chips name="peg_needed" options={PEG_NEEDED} required defaultValue={initial?.peg_needed} />
        </Field>
      </Section>

      <Section number="③" title="焚き火">
        <Field label="焚き火できた？" required>
          <Chips name="fire_status" options={FIRE_STATUS} required defaultValue={initial?.fire_status} />
        </Field>
      </Section>

      <Section title="そのほか（任意）">
        <Field label="虫">
          <Chips name="bug_level" options={BUG_LEVEL} defaultValue={str(initial?.bug_level)} />
        </Field>
        <Field label="誰と行った？">
          <Chips name="party_type" options={PARTY_TYPE} defaultValue={str(initial?.party_type)} />
        </Field>
        <Field label="使った暖房（複数選べます）">
          <HeaterChips defaultValues={initial?.heaters ?? []} />
        </Field>
        <Field label="ひとこと">
          <textarea
            name="comment"
            maxLength={500}
            rows={3}
            defaultValue={initial?.comment ?? ""}
            placeholder="例：夜中に風が強くなり、焚き火は早めに切り上げました"
            className="w-full rounded-lg border border-stone-300 bg-white p-3"
          />
        </Field>
        <Field label="写真（4枚まで）">
          <PhotoPicker
            userId={userId}
            initialPaths={initialPhotos}
            onUploadingChange={setUploading}
            onCountChange={setPhotoCount}
          />
          {photoCount > 0 && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-stone-50 p-3 text-sm">
              <input
                type="checkbox"
                name="photo_reuse_ok"
                value="yes"
                defaultChecked={initial?.photo_reuse_ok ?? false}
                className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
              />
              <span>
                この写真をキャンプ場の紹介写真に使ってよい
                <span className="block text-xs text-stone-500">
                  運営が選んだ写真だけ、ニックネーム付きでキャンプ場ページの上部に載ります。チェックを外すか投稿を消すと、紹介写真からも外れます。
                </span>
              </span>
            </label>
          )}
        </Field>
      </Section>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      {/*
        ボタンの並び（Apple / Google のガイドラインや主要サイトの定番に合わせる）
        ・スマホ：保存を上・キャンセルを下に、どちらも横幅いっぱい（親指で押しやすい位置に主な操作）
        ・PC：右寄せで［キャンセル］［保存］の順。主な操作（保存）を一番右に置く
      */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          disabled={pending || uploading}
          className="h-12 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 disabled:opacity-50 sm:w-auto sm:min-w-48 sm:px-8"
        >
          {pending ? "保存しています…" : uploading ? "写真をアップロード中…" : submitLabel}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className="h-12 w-full rounded-full border border-stone-300 bg-white font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50 sm:w-auto sm:px-8"
        >
          キャンセル
        </button>
      </div>
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
  hints,
}: {
  name: string;
  options: Record<string | number, string>;
  required?: boolean;
  defaultValue?: string;
  /** ボタンの中に小さく添える補足（値ごと） */
  hints?: Record<string, string>;
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
          <span className="inline-flex min-h-11 flex-col items-center justify-center rounded-full border border-stone-300 bg-white px-4 text-sm leading-tight peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500">
            {label}
            {hints?.[value] && <span className="text-[10px] opacity-75">{hints[value]}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/** 複数選べるボタン（中身はチェックボックス） */
function CheckChips({
  name,
  options,
  defaultValues,
}: {
  name: string;
  options: Record<string, string>;
  defaultValues: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={value}
            defaultChecked={defaultValues.includes(value)}
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

/** 使った暖房（複数）。「使わなかった」を選ぶとストーブの選択を外し、ストーブを選ぶと「使わなかった」を外す */
function HeaterChips({ defaultValues }: { defaultValues: string[] }) {
  const [selected, setSelected] = useState<string[]>(defaultValues);
  function toggle(key: string, checked: boolean) {
    if (!checked) return setSelected((prev) => prev.filter((k) => k !== key));
    setSelected((prev) => (key === "none" ? ["none"] : [...prev.filter((k) => k !== "none"), key]));
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(HEATER).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input
            type="checkbox"
            name="heaters"
            value={value}
            checked={selected.includes(value)}
            onChange={(e) => toggle(value, e.target.checked)}
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
