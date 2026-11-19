"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useMemo, useState, useTransition } from "react";
import { splitPrefecture } from "@/lib/address";
import { isSimilarName } from "@/lib/campsite-match";
import { FacilityFields } from "@/components/facility-fields";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE } from "@/lib/labels";
import { PREFECTURES } from "@/lib/search";
import { findAddressByPostal, submitCampsite, type SubmissionFormState } from "./actions";

export type ExistingCampsite = { slug: string; name: string; prefecture: string };

const INITIAL: SubmissionFormState = { error: null, done: false };

/** フォームと完了画面。「続けて登録する」で key を変えて、空のフォームに戻す */
export function SubmissionArea({ existing, limitReached }: { existing: ExistingCampsite[]; limitReached: boolean }) {
  const [round, setRound] = useState(0);
  return <SubmissionForm key={round} existing={existing} limitReached={limitReached} onAgain={() => setRound((r) => r + 1)} />;
}

function SubmissionForm({
  existing,
  limitReached,
  onAgain,
}: {
  existing: ExistingCampsite[];
  limitReached: boolean;
  onAgain: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(submitCampsite, INITIAL);
  const [name, setName] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [postal, setPostal] = useState("");
  const [city, setCity] = useState("");
  const [postalMessage, setPostalMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ prefecture: string; city: string }[]>([]);
  const [lookingUp, startLookup] = useTransition();
  // 市区町村の欄が、選んだのと別の都道府県から始まっているとき
  const mismatched = splitPrefecture(city).prefecture;

  function applyAddress(found: { prefecture: string; city: string }) {
    setPrefecture(found.prefecture);
    setCity(found.city);
    setCandidates([]);
  }

  /** 郵便番号が7桁になったら、都道府県と市区町村（町域まで）を自動で入れる */
  function changePostal(value: string) {
    setPostal(value);
    setPostalMessage(null);
    setCandidates([]);
    const digits = value.normalize("NFKC").replace(/[^\d]/g, "");
    if (digits.length !== 7) return;
    startLookup(async () => {
      const found = await findAddressByPostal(digits);
      if (!found?.length) {
        setPostalMessage("郵便番号から住所が見つかりませんでした。都道府県と市区町村を入れてください。");
        return;
      }
      applyAddress(found[0]);
      // 1つの郵便番号に町域が複数あるときは、選び直せるようにする
      if (found.length > 1) setCandidates(found);
    });
  }

  /**
   * 市区町村の欄に都道府県から入れてしまったら、都道府県の部分を取り除く（二重にしない）。
   * まだ都道府県を選んでいなければ、入れた都道府県を選んだ状態にする
   */
  function changeCity(value: string) {
    const { prefecture: written, rest } = splitPrefecture(value);
    if (written && (!prefecture || written === prefecture)) {
      if (!prefecture) setPrefecture(written);
      setCity(rest);
    } else {
      setCity(value);
    }
  }
  const [dirty, setDirty] = useState(false);

  // 似た名前の登録済みキャンプ場（同じ都道府県を先に）
  const similar = useMemo(() => {
    if (name.trim().length < 2) return [];
    return existing
      .filter((c) => isSimilarName(name, c.name))
      .sort((a, b) => Number(b.prefecture === prefecture) - Number(a.prefecture === prefecture))
      .slice(0, 3);
  }, [existing, name, prefecture]);

  if (state.done) {
    return (
      <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-3xl text-emerald-700" aria-hidden>
          ✓
        </p>
        <h2 className="text-lg font-bold">登録の申請を受け付けました</h2>
        <p className="text-sm text-stone-600">
          運営が公式サイトで確認してから公開します。
          <br className="hidden sm:inline" />
          公開されたら、トップの「最近登録されたキャンプ場」に表示されます。
        </p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onAgain}
            className="h-12 rounded-full bg-emerald-700 px-8 font-bold text-white hover:bg-emerald-800 sm:order-2"
          >
            続けて登録する
          </button>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-full border border-stone-300 bg-white px-8 font-medium text-stone-700 hover:bg-stone-100 sm:order-1"
          >
            トップへ
          </Link>
        </div>
      </div>
    );
  }

  function cancel() {
    if (dirty && !confirm("入力した内容は保存されません。キャンセルしますか？")) return;
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
      onChange={() => setDirty(true)}
      className="space-y-6"
    >
      {limitReached && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          確認待ちの申請が5件あります。運営が確認するまで、新しい申請はできません。
        </p>
      )}

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
        <legend className="px-1 font-bold">基本情報</legend>
        <Field label="キャンプ場名" required>
          <input
            name="name"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="〇〇高原オートキャンプ場"
            className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
          />
        </Field>
        {similar.length > 0 && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">似た名前のキャンプ場がすでに登録されています。これですか？</p>
            <ul className="mt-1 space-y-0.5">
              {similar.map((c) => (
                <li key={c.slug}>
                  <Link href={`/campsites/${c.slug}`} className="underline">
                    {c.name}（{c.prefecture}）
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Field label="郵便番号" hint="入れると都道府県と市区町村が自動で入ります">
          <div className="flex items-center gap-3">
            <input
              name="postal_code"
              value={postal}
              onChange={(e) => changePostal(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              maxLength={8}
              placeholder="123-4567"
              className="h-11 w-36 rounded-lg border border-stone-300 bg-white px-3"
            />
            {lookingUp && <span className="text-xs text-stone-500">住所を調べています…</span>}
          </div>
          {postalMessage && <p className="text-xs text-amber-800">{postalMessage}</p>}
          {candidates.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-500">候補：</span>
              {candidates.map((c) => (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => applyAddress(c)}
                  className={`rounded-full border px-3 py-1 ${c.city === city ? "border-emerald-700 bg-emerald-50 text-emerald-900" : "border-stone-300"}`}
                >
                  {c.city}
                </button>
              ))}
            </div>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Field label="都道府県" required>
            <select
              name="prefecture"
              required
              value={prefecture}
              onChange={(e) => setPrefecture(e.target.value)}
              className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
            >
              <option value="">選んでください</option>
              {PREFECTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="市区町村" required>
            <input
              name="city"
              required
              maxLength={100}
              value={city}
              onChange={(e) => changeCity(e.target.value)}
              placeholder="〇〇郡〇〇村"
              className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
            />
            {mismatched && mismatched !== prefecture && (
              <p className="text-xs text-red-700">
                「{mismatched}」から始まっています。都道府県の選択と合わせてください。
              </p>
            )}
          </Field>
        </div>
        <Field label="丁目・番地・号" hint="わかれば">
          <input
            name="street"
            maxLength={100}
            placeholder="1234-5"
            className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
          />
        </Field>
        <Field label="公式サイト">
          <input
            name="official_url"
            type="url"
            inputMode="url"
            maxLength={500}
            placeholder="https://"
            className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
        <legend className="px-1 font-bold">わかる範囲で（任意）</legend>
        <Field label="種類">
          <Chips name="location_type" options={LOCATION_TYPE} />
        </Field>
        <Field label="サイト">
          <Chips name="site_style" options={SITE_STYLE} />
        </Field>
        <Field label="焚き火">
          <Chips name="fire_rule" options={FIRE_RULE} />
        </Field>
        <FacilityFields unknownLabel="わからない" basicOffLabel="わからない" />
        <Field label="運営へのひとこと">
          <textarea
            name="note"
            maxLength={500}
            rows={3}
            placeholder="例：2025年にリニューアルしました"
            className="w-full rounded-lg border border-stone-300 bg-white p-3"
          />
        </Field>
      </fieldset>

      <p className="text-xs text-stone-500">申請者の名前は表示されません。</p>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      {/* 投稿フォームと同じ並び：スマホは申請が上で横幅いっぱい、PCは右寄せで［キャンセル］［申請］ */}
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <button
          disabled={pending || limitReached}
          className="h-12 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 disabled:opacity-50 sm:w-auto sm:min-w-48 sm:px-8"
        >
          {pending ? "送信しています…" : "申請する"}
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

/** 選択式。最初は「わからない」を選んだ状態にする */
function Chips({ name, options }: { name: string; options: Record<string, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[...Object.entries(options), ["", "わからない"] as const].map(([value, label]) => (
        <label key={value || "unknown"} className="cursor-pointer">
          <input type="radio" name={name} value={value} defaultChecked={value === ""} className="peer sr-only" />
          <span className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}
