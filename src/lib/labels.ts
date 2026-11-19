// DB の列挙値 ⇔ 画面に出す日本語ラベル（supabase/migrations の enum と揃えること）

export const LOCATION_TYPE = {
  forest: "林間",
  river: "河原",
  lake: "湖畔",
  highland: "高原",
  sea: "海沿い",
  meadow: "草原",
  view: "展望",
} as const;

export const SITE_STYLE = {
  sectioned: "区画サイト",
  free: "フリーサイト",
  both: "区画・フリー",
} as const;

export const FIRE_RULE = {
  open_fire_ok: "直火OK",
  stand_required: "焚き火台が必要",
  prohibited: "焚き火禁止",
} as const;

// 地面はソト活のフォーム・集計・検索から外した。DB の列（checkins.ground_type）と enum は過去の投稿のために残している
export const GROUND_TYPE = {
  grass: "芝",
  soil: "土",
  gravel: "砂利",
  sand: "砂",
  wood_deck: "ウッドデッキ",
} as const;

export const PEG_NEEDED = {
  plastic: "プラペグで刺さる",
  steel: "スチールペグが必要",
  forged: "鍛造ペグでないと無理",
  rocky: "石が多く場所を選ぶ",
} as const;

export const FIRE_STATUS = {
  done: "焚き火できた",
  skipped_wind: "風で控えた",
  prohibited: "ルールで禁止",
} as const;

/** 使った寝袋のタイプ。DB の enum sleeping_bag_type と揃えること（未選択 =「わからない」） */
export const SLEEPING_BAG_TYPE = {
  summer: "夏用",
  three_season: "3シーズン用",
  winter: "冬用",
  extreme: "厳冬期用",
} as const;

/** 選ぶときの目安（寝袋の快適温度） */
export const SLEEPING_BAG_HINT: Record<keyof typeof SLEEPING_BAG_TYPE, string> = {
  summer: "快適温度 10℃〜",
  three_season: "0〜10℃",
  winter: "-10〜0℃",
  extreme: "〜-10℃",
};

export const SLEEP_QUALITY = {
  comfortable: "快適に眠れた",
  cold: "寒かった",
  sleepless: "眠れなかった",
} as const;

/** 誰と行ったか（ソト活・任意） */
export const PARTY_TYPE = {
  solo: "ソロ",
  couple: "カップル",
  family: "ファミリー",
  group: "グループ",
} as const;

/** 使った暖房（ソト活・任意・複数）。none（使わなかった）はほかと一緒に選べない */
export const HEATER = {
  wood_stove: "薪ストーブ",
  kerosene_stove: "石油ストーブ",
  none: "使わなかった",
} as const;

/** 天気（ソト活・任意・複数）。連泊でも滞在中をまとめて選ぶ。DB の domain weather_options と揃えること */
export const WEATHER = {
  sunny: "晴れ",
  cloudy: "くもり",
  rain: "雨",
  snow: "雪",
  windy: "強風",
} as const;

/** 泊数の選択肢（1〜7泊） */
export const MAX_NIGHTS = 7;

export const BUG_LEVEL = {
  1: "虫は少ない",
  2: "虫はふつう",
  3: "虫が多い",
} as const;

// 設備（複数選べる項目）。DB の domain（garbage_options など）と揃えること
export const GARBAGE = {
  paid: "有料",
  free: "無料",
  take_home: "持ち帰り",
} as const;

export const AC_POWER = {
  extra_fee: "設置サイトあり（別料金）",
  included: "設置サイトあり（料金に含む）",
  none: "なし",
} as const;

export const SHOP_ITEM = {
  gas: "ガス",
  firewood: "薪",
  charcoal: "炭",
  towel: "タオル",
  meal_kit: "ミールキット",
  toothbrush: "歯ブラシ",
  other: "その他",
} as const;

export const PAYMENT = {
  cash: "現金",
  card: "カード",
} as const;

/** トイレ。none（なし）はほかと一緒に選べない */
export const TOILET = {
  flush: "水洗",
  simple: "簡易（汲み取り・仮設）",
  none: "なし",
} as const;

/** サウナ。none（なし）はほかと一緒に選べない */
export const SAUNA = {
  public: "パブリック",
  private: "貸切",
  none: "なし",
} as const;

/** あとから足した設備（炊事場〜サウナ）。どれも null =「未入力」（画面では空欄） */
export type Facilities = {
  has_kitchen: boolean | null;
  garbage: (keyof typeof GARBAGE)[] | null;
  ac_power: (keyof typeof AC_POWER)[] | null;
  has_shop: boolean | null;
  /** 売店で買えるもの（売店ありのときだけ） */
  shop_items: (keyof typeof SHOP_ITEM)[] | null;
  has_wifi: boolean | null;
  payment_methods: (keyof typeof PAYMENT)[] | null;
  toilet_types: (keyof typeof TOILET)[] | null;
  sauna_types: (keyof typeof SAUNA)[] | null;
};

export const FACILITY_COLUMNS =
  "has_kitchen, garbage, ac_power, has_shop, shop_items, has_wifi, payment_methods, toilet_types, sauna_types";

export type Campsite = Facilities & {
  id: string;
  slug: string;
  name: string;
  prefecture: string;
  address: string;
  lat: number | null;
  lng: number | null;
  location_type: keyof typeof LOCATION_TYPE;
  site_style: keyof typeof SITE_STYLE;
  car_access: boolean;
  has_hot_water: boolean;
  has_shower: boolean;
  has_bath: boolean;
  fire_rule: keyof typeof FIRE_RULE;
  official_url: string | null;
  /** Googleマップの Place ID。null = 未登録（地図リンクは座標で開く） */
  google_place_id: string | null;
  /** 冬季閉鎖（毎年同じ月日 'MM-DD'。両方 null = 閉鎖なし） */
  winter_closed_from: string | null;
  winter_closed_to: string | null;
  winter_closure_note: string | null;
  /** 数字があれば「おすすめ」。小さいほど先に表示する */
  featured_rank: number | null;
  created_at: string;
};

export type Checkin = {
  id: string;
  user_id: string;
  campsite_id: string;
  /** 1泊目の日 */
  visited_on: string;
  /** 泊数（1〜7） */
  nights: number;
  min_temp_c: number | null;
  /** 気温が「わからない」ときに、気象データ（Open-Meteo）で推定した最低気温。集計には使わない */
  est_min_temp_c: number | null;
  temp_measured: boolean;
  temp_at_dawn: boolean;
  /** 快適温度（sleeping_bag_comfort_c）はタイプに移したので使わない */
  sleeping_bag_type: keyof typeof SLEEPING_BAG_TYPE | null;
  sleep_quality: keyof typeof SLEEP_QUALITY | null;
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: keyof typeof BUG_LEVEL | null;
  party_type: keyof typeof PARTY_TYPE | null;
  heaters: (keyof typeof HEATER)[] | null;
  weather: (keyof typeof WEATHER)[] | null;
  comment: string | null;
  /** 投稿者が写真をキャンプ場の紹介写真に使ってよいと許可したか */
  photo_reuse_ok: boolean;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
  checkin_photos: { storage_path: string; sort_order: number }[];
};
