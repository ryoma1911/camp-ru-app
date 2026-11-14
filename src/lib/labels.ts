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

export const SLEEP_QUALITY = {
  comfortable: "快適に眠れた",
  cold: "寒かった",
  sleepless: "眠れなかった",
} as const;

export const BUG_LEVEL = {
  1: "虫は少ない",
  2: "虫はふつう",
  3: "虫が多い",
} as const;

export type Campsite = {
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
  /** 数字があれば「おすすめ」。小さいほど先に表示する */
  featured_rank: number | null;
  created_at: string;
};

export type Checkin = {
  id: string;
  user_id: string;
  campsite_id: string;
  visited_on: string;
  min_temp_c: number | null;
  temp_measured: boolean;
  temp_at_dawn: boolean;
  sleeping_bag_comfort_c: number | null;
  sleep_quality: keyof typeof SLEEP_QUALITY | null;
  ground_type: keyof typeof GROUND_TYPE;
  peg_needed: keyof typeof PEG_NEEDED;
  fire_status: keyof typeof FIRE_STATUS;
  bug_level: keyof typeof BUG_LEVEL | null;
  car_access_ok: boolean | null;
  hot_water_ok: boolean | null;
  comment: string | null;
  /** 投稿者が写真をキャンプ場の紹介写真に使ってよいと許可したか */
  photo_reuse_ok: boolean;
  created_at: string;
  profiles: { display_name: string; avatar_url: string | null } | null;
  checkin_photos: { storage_path: string; sort_order: number }[];
};
