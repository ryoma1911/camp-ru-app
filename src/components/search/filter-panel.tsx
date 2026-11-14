"use client";

import { useRouter } from "next/navigation";
import { FIRE_RULE, GROUND_TYPE, LOCATION_TYPE } from "@/lib/labels";
import { TEMP_OPTIONS, WIND_MAX_RATE, toQuery, type Filters } from "@/lib/search";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 詳しい条件。送信すると条件を URL に入れて同じトップ画面を開き直す（空の条件は URL に入れない） */
export function FilterPanel({ filters, prefectures }: { filters: Filters; prefectures: string[] }) {
  const router = useRouter();
  const activeCount = [
    filters.q, filters.pref, filters.types.length, filters.site, filters.car, filters.hotwater, filters.shower,
    // 月と気温はそろって1つの条件（月だけなら並べ替え用なので数えない）。一覧の上の条件チップと数を揃える
    filters.bath, filters.fire, filters.month != null && filters.minTemp != null, filters.peg, filters.wind, filters.grounds.length,
  ].filter(Boolean).length;

  return (
    <details className="group rounded-xl border border-stone-200 bg-white" open={false}>
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium">
        <span>
          詳しい条件で絞り込む
          {activeCount > 0 && <span className="ml-2 rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">{activeCount}</span>}
        </span>
        <span className="text-stone-400 transition group-open:rotate-180">▾</span>
      </summary>

      <form
        // key で条件が変わるたびに入れ直し、URL と入力欄を一致させる
        key={toQuery(filters)}
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          const str = (k: string) => String(d.get(k) ?? "");
          const minTemp = str("minTemp");
          router.push(
            toQuery({
              q: str("q").trim(),
              pref: str("pref"),
              types: d.getAll("type").map(String) as Filters["types"],
              site: str("site") as Filters["site"],
              car: d.has("car"),
              hotwater: d.has("hotwater"),
              shower: d.has("shower"),
              bath: d.has("bath"),
              fire: str("fire") as Filters["fire"],
              month: str("month") ? Number(str("month")) : null,
              minTemp: minTemp === "" ? null : Number(minTemp),
              peg: str("peg") as Filters["peg"],
              wind: d.has("wind"),
              grounds: d.getAll("ground").map(String) as Filters["grounds"],
              sort: filters.sort,
            }),
          );
          (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
        }}
        className="space-y-6 border-t border-stone-200 p-4"
      >
        <Group title="公式の情報" note="キャンプ場が公開している情報">
          <Row label="キャンプ場名">
            <input name="q" defaultValue={filters.q} placeholder="名前の一部" className={inputCls} />
          </Row>
          <Row label="都道府県">
            <select name="pref" defaultValue={filters.pref} className={inputCls}>
              <option value="">すべて</option>
              {prefectures.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Row>
          <Row label="種類">
            <Checks name="type" options={LOCATION_TYPE} selected={filters.types} />
          </Row>
          <Row label="サイト形式">
            <Radios name="site" options={{ "": "指定なし", sectioned: "区画サイト", free: "フリーサイト" }} selected={filters.site} />
          </Row>
          <Row label="設備">
            <div className="flex flex-wrap gap-2">
              <Check name="car" label="車乗り入れ可" checked={filters.car} />
              <Check name="hotwater" label="炊事場お湯" checked={filters.hotwater} />
              <Check name="shower" label="シャワー" checked={filters.shower} />
              <Check name="bath" label="風呂" checked={filters.bath} />
            </div>
          </Row>
          <Row label="焚き火">
            <Radios
              name="fire"
              options={{ "": "指定なし", ok: "焚き火OK（台が必要でも可）", open: FIRE_RULE.open_fire_ok }}
              selected={filters.fire}
            />
          </Row>
        </Group>

        <Group title="キャン活の集計" note="行った人の投稿から計算。データがないキャンプ場は結果から外れます">
          <Row label="行く月と最低気温">
            <div className="flex flex-wrap items-center gap-2">
              <select name="month" defaultValue={filters.month ?? ""} className={inputCls}>
                <option value="">月を選ぶ</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                ))}
              </select>
              <span className="text-sm">の明け方が</span>
              <select name="minTemp" defaultValue={filters.minTemp ?? ""} className={inputCls}>
                <option value="">指定なし</option>
                {TEMP_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}℃以上
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-stone-500">気温で絞るには月も選んでください（月だけなら「暖かい順」に並べ替えできます）</p>
          </Row>
          <Row label="ペグ">
            <Radios
              name="peg"
              options={{ "": "指定なし", plastic: "プラペグでOK", steel: "スチールまででOK" }}
              selected={filters.peg}
            />
          </Row>
          <Row label="焚き火のしやすさ">
            <Check name="wind" label={`風で控えた日が少ない（${WIND_MAX_RATE}%以下）`} checked={filters.wind} />
          </Row>
          <Row label="地面">
            <Checks name="ground" options={GROUND_TYPE} selected={filters.grounds} />
          </Row>
        </Group>

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button className="h-11 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 sm:w-auto sm:px-8">
            この条件で探す
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-11 w-full rounded-full border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 sm:w-auto sm:px-8"
          >
            すべて解除
          </button>
        </div>
      </form>
    </details>
  );
}

const inputCls = "h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm";
const chipCls =
  "inline-flex min-h-9 items-center rounded-full border border-stone-300 bg-white px-3 text-sm peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500";

function Group({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2">
        <span className="font-bold">{title}</span>
        <span className="ml-2 text-xs text-stone-500">{note}</span>
      </legend>
      {children}
    </fieldset>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="peer sr-only" />
      <span className={chipCls}>{label}</span>
    </label>
  );
}

function Checks({ name, options, selected }: { name: string; options: Record<string, string>; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)} className="peer sr-only" />
          <span className={chipCls}>{label}</span>
        </label>
      ))}
    </div>
  );
}

function Radios({ name, options, selected }: { name: string; options: Record<string, string>; selected: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, label]) => (
        <label key={value} className="cursor-pointer">
          <input type="radio" name={name} value={value} defaultChecked={selected === value} className="peer sr-only" />
          <span className={chipCls}>{label}</span>
        </label>
      ))}
    </div>
  );
}
