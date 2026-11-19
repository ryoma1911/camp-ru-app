// あとから足した設備（炊事場・ゴミ・AC電源・売店・Wi-Fi・決済方法・トイレ・サウナ）をフォームから読み取る。
// 申請フォーム・承認フォーム・設備の編集画面で共通（入力欄は components/facility-fields.tsx）
import { AC_POWER, GARBAGE, PAYMENT, SAUNA, SHOP_ITEM, TOILET, type Facilities } from "@/lib/labels";

/** あり / なし / 未入力 の3択。フォームの値は "yes" / "no" / "" */
function yesNo(formData: FormData, key: string): boolean | null {
  const value = formData.get(key);
  return value === "yes" ? true : value === "no" ? false : null;
}

/** 複数選べる項目。決まった値だけを、重複なく、決まった順に並べる。1つも選んでいなければ未入力（null） */
function many<T extends Record<string, string>>(formData: FormData, key: string, labels: T): (keyof T & string)[] | null {
  const picked = new Set(formData.getAll(key).map(String));
  const values = (Object.keys(labels) as (keyof T & string)[]).filter((k) => picked.has(k));
  return values.length ? values : null;
}

export function parseFacilities(formData: FormData): { ok: true; values: Facilities } | { ok: false; error: string } {
  const acPower = many(formData, "ac_power", AC_POWER);
  if (acPower?.includes("none") && acPower.length > 1) {
    return { ok: false, error: "AC電源の「なし」は、ほかと一緒に選べません。" };
  }
  const toilets = many(formData, "toilet_types", TOILET);
  if (toilets?.includes("none") && toilets.length > 1) {
    return { ok: false, error: "トイレの「なし」は、ほかと一緒に選べません。" };
  }
  const saunas = many(formData, "sauna_types", SAUNA);
  if (saunas?.includes("none") && saunas.length > 1) {
    return { ok: false, error: "サウナの「なし」は、ほかと一緒に選べません。" };
  }
  const hasShop = yesNo(formData, "has_shop");
  return {
    ok: true,
    values: {
      has_kitchen: yesNo(formData, "has_kitchen"),
      garbage: many(formData, "garbage", GARBAGE),
      ac_power: acPower,
      has_shop: hasShop,
      // 売店が「あり」のときだけ品物を残す（なし・未入力なら品物の選択は捨てる）
      shop_items: hasShop === true ? many(formData, "shop_items", SHOP_ITEM) : null,
      has_wifi: yesNo(formData, "has_wifi"),
      payment_methods: many(formData, "payment_methods", PAYMENT),
      toilet_types: toilets,
      sauna_types: saunas,
    },
  };
}
