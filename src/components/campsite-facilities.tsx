import { AC_POWER, GARBAGE, PAYMENT, SAUNA, SHOP_ITEM, TOILET, type Campsite } from "@/lib/labels";

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

type Genre = { title: string; rows: Row[] };

/** 設備を5ジャンルに分けた行（あとから足した項目は、未入力なら値を空欄にする） */
export function facilityGenres(c: Campsite): Genre[] {
  // 炊事場でお湯が出るなら、炊事場は「あり」とみなす
  const kitchen: Value =
    c.has_kitchen === false
      ? { items: ["なし"] }
      : c.has_kitchen === true || c.has_hot_water
        ? { items: ["あり"], note: c.has_hot_water ? "（お湯が出る）" : undefined }
        : { items: [] };
  const shop: Value =
    c.has_shop === true && c.shop_items ? { prefix: "あり：", ...names(c.shop_items, SHOP_ITEM) } : yesNo(c.has_shop);

  return [
    {
      title: "サイト",
      rows: [
        { label: "車乗り入れ", value: { items: [c.car_access ? "できる" : "できない"] } },
        { label: "AC電源", value: acPower(c.ac_power) },
      ],
    },
    {
      title: "水まわり",
      rows: [
        { label: "炊事場", value: kitchen },
        { label: "トイレ", value: names(c.toilet_types, TOILET) },
      ],
    },
    {
      title: "温浴",
      rows: [
        { label: "シャワー", value: { items: [c.has_shower ? "あり" : "なし"] } },
        { label: "風呂", value: { items: [c.has_bath ? "あり" : "なし"] } },
        { label: "サウナ", value: names(c.sauna_types, SAUNA) },
      ],
    },
    {
      title: "売店・ゴミ",
      rows: [
        { label: "売店", value: shop },
        { label: "ゴミ", value: names(c.garbage, GARBAGE) },
      ],
    },
    {
      title: "支払い・通信",
      rows: [
        { label: "決済方法", value: names(c.payment_methods, PAYMENT) },
        { label: "Wi-Fi", value: yesNo(c.has_wifi) },
      ],
    },
  ];
}

/**
 * キャンプ場ページの「設備」（公式サイトの情報）。5ジャンルに分け、PC は2列（左：サイト・水まわり・温浴、
 * 右：売店・ゴミ・支払い・通信）、スマホは1列
 */
export function CampsiteFacilities({ campsite }: { campsite: Campsite }) {
  const genres = facilityGenres(campsite);
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">
        設備<span className="ml-2 text-xs font-normal text-stone-500">公式サイトの情報</span>
      </h2>
      <div className="grid rounded-xl border border-stone-200 bg-white px-4 pb-1 sm:grid-cols-2 sm:gap-x-8">
        {[genres.slice(0, 3), genres.slice(3)].map((column, i) => (
          <div key={i}>
            {column.map((g) => (
              <div key={g.title} className="pt-3">
                <h3 className="text-sm font-bold text-stone-900">{g.title}</h3>
                <dl className="mt-1 divide-y divide-stone-100 border-t border-stone-100 text-sm">
                  {g.rows.map((r) => (
                    <div key={r.label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 py-2">
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
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
