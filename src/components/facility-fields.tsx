"use client";

import { useState } from "react";
import { AC_POWER, GARBAGE, PAYMENT, SAUNA, SHOP_ITEM, TOILET, type Facilities } from "@/lib/labels";

const chip =
  "inline-flex min-h-10 items-center rounded-full border border-stone-300 bg-white px-4 text-sm peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500";

const toForm = (v: boolean | null) => (v === true ? "yes" : v === false ? "no" : "");

/** もとからある4項目（車乗り入れ・お湯・シャワー・風呂）。1つのボタンで、押せば「あり」 */
export type BasicFacilities = {
  car_access: boolean | null;
  has_hot_water: boolean | null;
  has_shower: boolean | null;
  has_bath: boolean | null;
};

/**
 * 設備の入力欄。キャンプ場ページと同じ5ジャンル（サイト・水まわり・温浴・売店とゴミ・支払いと通信）で並べる。
 * 申請フォーム・承認フォーム・設備の編集画面で共通（読み取りは lib/facility-input.ts）。
 * unknownLabel は「未入力」を表す選択肢の名前（運営は「未入力」、申請者は「わからない」）。
 * もとからある4項目は押さなければ、運営の画面では「なし」、申請では「わからない」になる（basicOffLabel）
 */
export function FacilityFields({
  initial,
  unknownLabel,
  basicOffLabel,
}: {
  initial?: (Partial<Facilities> & Partial<BasicFacilities>) | null;
  unknownLabel: string;
  basicOffLabel: string;
}) {
  const [hasShop, setHasShop] = useState(toForm(initial?.has_shop ?? null));
  const basic = (name: keyof BasicFacilities, label: string) => (
    <label className="cursor-pointer">
      <input
        type="checkbox"
        name={name}
        value="yes"
        defaultChecked={initial?.[name] === true}
        className="peer sr-only"
      />
      <span className={chip}>{label}</span>
    </label>
  );

  return (
    <div className="space-y-5">
      <p className="text-xs text-stone-500">
        「できる」「あり」の1つだけのボタン（車乗り入れ・お湯・シャワー・風呂）は、押さなければ「{basicOffLabel}」になります。
      </p>

      <Genre title="サイト">
        <Row label="車乗り入れ">{basic("car_access", "できる")}</Row>
        <Row label="AC電源" hint="複数選べます">
          <ExclusiveMany name="ac_power" options={AC_POWER} defaultValues={initial?.ac_power ?? []} />
        </Row>
      </Genre>

      <Genre title="水まわり">
        <Row label="炊事場">
          <div className="flex flex-wrap items-center gap-2">
            <YesNo name="has_kitchen" defaultValue={toForm(initial?.has_kitchen ?? null)} unknownLabel={unknownLabel} />
            {basic("has_hot_water", "お湯が出る")}
          </div>
        </Row>
        <Row label="トイレ" hint="複数選べます">
          <ExclusiveMany name="toilet_types" options={TOILET} defaultValues={initial?.toilet_types ?? []} />
        </Row>
      </Genre>

      <Genre title="温浴">
        <Row label="シャワー">{basic("has_shower", "あり")}</Row>
        <Row label="風呂">{basic("has_bath", "あり")}</Row>
        <Row label="サウナ" hint="複数選べます">
          <ExclusiveMany name="sauna_types" options={SAUNA} defaultValues={initial?.sauna_types ?? []} />
        </Row>
      </Genre>

      <Genre title="売店・ゴミ">
        <Row label="売店">
          <YesNo name="has_shop" value={hasShop} onChange={setHasShop} unknownLabel={unknownLabel} />
          {hasShop === "yes" && (
            <div className="mt-2 rounded-lg bg-stone-50 p-3">
              <p className="mb-2 text-xs text-stone-600">売っているもの（複数選べます）</p>
              <Many name="shop_items" options={SHOP_ITEM} defaultValues={initial?.shop_items ?? []} />
            </div>
          )}
        </Row>
        <Row label="ゴミ" hint="複数選べます">
          <Many name="garbage" options={GARBAGE} defaultValues={initial?.garbage ?? []} />
        </Row>
      </Genre>

      <Genre title="支払い・通信">
        <Row label="決済方法" hint="複数選べます">
          <Many name="payment_methods" options={PAYMENT} defaultValues={initial?.payment_methods ?? []} />
        </Row>
        <Row label="Wi-Fi">
          <YesNo name="has_wifi" defaultValue={toForm(initial?.has_wifi ?? null)} unknownLabel={unknownLabel} />
        </Row>
      </Genre>
    </div>
  );
}

function Genre({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-stone-200 pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      <h4 className="text-sm font-bold text-stone-900">{title}</h4>
      {children}
    </section>
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

/** 複数選べるが、「なし」（none）はほかと一緒に選べない。あとから選んだほうを残す */
function ExclusiveMany({
  name,
  options,
  defaultValues,
}: {
  name: string;
  options: Record<string, string>;
  defaultValues: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValues);
  function toggle(key: string, checked: boolean) {
    if (!checked) return setSelected((prev) => prev.filter((k) => k !== key));
    setSelected((prev) => (key === "none" ? ["none"] : [...prev.filter((k) => k !== "none"), key]));
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([key, label]) => (
        <label key={key} className="cursor-pointer">
          <input
            type="checkbox"
            name={name}
            value={key}
            checked={selected.includes(key)}
            onChange={(e) => toggle(key, e.target.checked)}
            className="peer sr-only"
          />
          <span className={chip}>{label}</span>
        </label>
      ))}
    </div>
  );
}
