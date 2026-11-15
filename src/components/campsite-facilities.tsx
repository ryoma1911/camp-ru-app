import { AC_POWER, GARBAGE, PAYMENT, SHOP_ITEM, type Campsite } from "@/lib/labels";

/**
 * 1行の値。items は「・」でつなぐ。prefix（あり：）と note（（お湯が出る））は前後に付ける。
 * スマホで折り返すとき語の途中で切らないよう、まとまりごとに分けて持つ
 */
type Value = { items: string[]; prefix?: string; note?: string };
type Row = { label: string; value: Value };

const names = <T extends string>(values: T[] | null, labels: Record<T, string>): Value => ({
  items: values ? values.map((v) => labels[v]) : [],
});
const yesNo = (v: boolean | null): Value => ({ items: v === true ? ["あり"] : v === false ? ["なし"] : [] });

/** AC電源。両方あるときは「設置サイトあり（別料金・料金に含む）」と1つにまとめる */
function acPower(values: Campsite["ac_power"]): Value {
  if (values?.includes("extra_fee") && values.includes("included")) {
    return { items: ["設置サイトあり"], note: "（別料金・料金に含む）" };
  }
  return names(values, AC_POWER);
}

/** 設備の行（追加の6項目は、未入力なら値を空欄にする） */
export function facilityRows(c: Campsite): Row[] {
  // 炊事場でお湯が出るなら、炊事場は「あり」とみなす
  const kitchen: Value =
    c.has_kitchen === false
      ? { items: ["なし"] }
      : c.has_kitchen === true || c.has_hot_water
        ? { items: ["あり"], note: c.has_hot_water ? "（お湯が出る）" : undefined }
        : { items: [] };
  const bathing = [c.has_shower && "シャワー", c.has_bath && "風呂"].filter((v): v is string => !!v);
  const shop: Value =
    c.has_shop === true && c.shop_items ? { prefix: "あり：", ...names(c.shop_items, SHOP_ITEM) } : yesNo(c.has_shop);

  return [
    { label: "車乗り入れ", value: { items: [c.car_access ? "できる" : "できない"] } },
    { label: "炊事場", value: kitchen },
    { label: "シャワー・風呂", value: { items: bathing.length ? bathing : ["なし"] } },
    { label: "ゴミ", value: names(c.garbage, GARBAGE) },
    { label: "AC電源", value: acPower(c.ac_power) },
    { label: "売店", value: shop },
    { label: "Wi-Fi", value: yesNo(c.has_wifi) },
    { label: "決済方法", value: names(c.payment_methods, PAYMENT) },
  ];
}

/** キャンプ場ページの「設備」（公式サイトの情報）。PC は2列、スマホは1列のリスト */
export function CampsiteFacilities({ campsite }: { campsite: Campsite }) {
  const rows = facilityRows(campsite);
  const half = Math.ceil(rows.length / 2);
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">
        設備<span className="ml-2 text-xs font-normal text-stone-500">公式サイトの情報</span>
      </h2>
      <div className="grid rounded-xl border border-stone-200 bg-white px-4 sm:grid-cols-2 sm:gap-x-8">
        {[rows.slice(0, half), rows.slice(half)].map((group, i) => (
          <dl key={i} className={`divide-y divide-stone-100 text-sm ${i === 1 ? "border-t border-stone-100 sm:border-t-0" : ""}`}>
            {group.map((r) => (
              <div key={r.label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2.5">
                <dt className="text-stone-500">{r.label}</dt>
                <dd className="text-stone-900">
                  {r.value.prefix}
                  {r.value.items.map((item, j) => (
                    <span key={item} className="inline-block">
                      {item}
                      {/* 「・」は前の語に付けて、行の頭に来ないようにする */}
                      {j < r.value.items.length - 1 && "・"}
                    </span>
                  ))}
                  {r.value.note && <span className="inline-block">{r.value.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </section>
  );
}
