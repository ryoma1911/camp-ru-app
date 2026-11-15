"use client";

import { useState } from "react";
import { AC_POWER, GARBAGE, PAYMENT, SHOP_ITEM, type Facilities } from "@/lib/labels";

const chip =
  "inline-flex min-h-10 items-center rounded-full border border-stone-300 bg-white px-4 text-sm peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500";

const toForm = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "");

/**
 * 設備6項目の入力欄（申請フォーム・承認フォーム・設備の編集画面で共通。読み取りは lib/facility-input.ts）。
 * unknownLabel は「未入力」を表す選択肢の名前（運営は「未入力」、申請者は「わからない」）
 */
export function FacilityFields({
  initial,
  unknownLabel,
}: {
  initial?: Partial<Facilities> | null;
  unknownLabel: string;
}) {
  const [hasShop, setHasShop] = useState(toForm(initial?.has_shop ?? null));
  const [acPower, setAcPower] = useState<string[]>(initial?.ac_power ?? []);

  // AC電源の「なし」はほかと一緒に選べない。選んだほうを残す
  function toggleAc(key: string, checked: boolean) {
    if (!checked) return setAcPower((prev) => prev.filter((k) => k !== key));
    setAcPower((prev) => (key === "none" ? ["none"] : [...prev.filter((k) => k !== "none"), key]));
  }

  return (
    <div className="space-y-4">
      <Row label="炊事場">
        <YesNo name="has_kitchen" defaultValue={toForm(initial?.has_kitchen ?? null)} unknownLabel={unknownLabel} />
      </Row>
      <Row label="ゴミ" hint="複数選べます">
        <Many name="garbage" options={GARBAGE} defaultValues={initial?.garbage ?? []} />
      </Row>
      <Row label="AC電源" hint="複数選べます">
        <div className="flex flex-wrap gap-2">
          {Object.entries(AC_POWER).map(([key, label]) => (
            <label key={key} className="cursor-pointer">
              <input
                type="checkbox"
                name="ac_power"
                value={key}
                checked={acPower.includes(key)}
                onChange={(e) => toggleAc(key, e.target.checked)}
                className="peer sr-only"
              />
              <span className={chip}>{label}</span>
            </label>
          ))}
        </div>
      </Row>
      <Row label="売店">
        <YesNo name="has_shop" value={hasShop} onChange={setHasShop} unknownLabel={unknownLabel} />
        {hasShop === "yes" && (
          <div className="mt-2 rounded-lg bg-stone-50 p-3">
            <p className="mb-2 text-xs text-stone-600">売っているもの（複数選べます）</p>
            <Many name="shop_items" options={SHOP_ITEM} defaultValues={initial?.shop_items ?? []} />
          </div>
        )}
      </Row>
      <Row label="Wi-Fi">
        <YesNo name="has_wifi" defaultValue={toForm(initial?.has_wifi ?? null)} unknownLabel={unknownLabel} />
      </Row>
      <Row label="決済方法" hint="複数選べます">
        <Many name="payment_methods" options={PAYMENT} defaultValues={initial?.payment_methods ?? []} />
      </Row>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-stone-700">
        {label}
        {hint && <span className="ml-2 text-xs font-normal text-stone-500">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

/** あり / なし / 未入力 の3択（value を渡すと親が状態を持つ） */
function YesNo({
  name,
  unknownLabel,
  defaultValue,
  value,
  onChange,
}: {
  name: string;
  unknownLabel: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const options: [string, string][] = [
    ["yes", "あり"],
    ["no", "なし"],
    ["", unknownLabel],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v || "unknown"} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={v}
            {...(value !== undefined
              ? { checked: value === v, onChange: () => onChange?.(v) }
              : { defaultChecked: (defaultValue ?? "") === v })}
            className="peer sr-only"
          />
          <span className={chip}>{label}</span>
        </label>
      ))}
    </div>
  );
}

function Many({ name, options, defaultValues }: { name: string; options: Record<string, string>; defaultValues: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([key, label]) => (
        <label key={key} className="cursor-pointer">
          <input type="checkbox" name={name} value={key} defaultChecked={defaultValues.includes(key)} className="peer sr-only" />
          <span className={chip}>{label}</span>
        </label>
      ))}
    </div>
  );
}
