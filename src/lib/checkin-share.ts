// ソト活1件の共有まわり（ページの取得、Xに投稿する文面、カード画像に載せる短い言い方）
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ALL_CHECKINS_TAG, CHECKIN_COLUMNS } from "@/lib/campsites";
import { BUG_LEVEL, GROUND_TYPE, SLEEP_QUALITY, type Checkin } from "@/lib/labels";
import { SITE_NAME } from "@/lib/site";
import { createSupabasePublicClient } from "@/lib/supabase/server";

export type CheckinWithCampsite = Checkin & {
  campsites: { id: string; slug: string; name: string; prefecture: string };
};

export const checkinTag = (id: string) => `checkin-${id}`;

/** ソト活1件（公開ページとカード画像用）。編集・削除で updateTag(checkinTag(id)) して入れ替える */
export async function getCheckin(id: string): Promise<CheckinWithCampsite | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(checkinTag(id), ALL_CHECKINS_TAG);

  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("checkins")
    .select(`${CHECKIN_COLUMNS}, campsites(id, slug, name, prefecture)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`ソト活の取得に失敗しました: ${error.message}`);
  return data as unknown as CheckinWithCampsite | null;
}

const PEG_SHORT = { plastic: "プラペグ", steel: "スチール", forged: "鍛造", rocky: "石が多い" } as const;
const FIRE_SHORT = { done: "できた", skipped_wind: "風で控えた", prohibited: "禁止" } as const;
const PEG_PHRASE = {
  plastic: "プラペグでOK",
  steel: "スチールペグが必要",
  forged: "鍛造ペグが必要",
  rocky: "石が多くペグは場所を選ぶ",
} as const;

export const visitedMonth = (c: Checkin) => Number(c.visited_on.slice(5, 7));

/** カード画像の3つの枠。気温の記録がなければ気温の枠は出さない */
export function cardTiles(c: Checkin): { label: string; value: string; sub: string }[] {
  const tiles = [];
  if (c.min_temp_c != null) {
    tiles.push({
      label: "① 明け方の気温",
      value: `${Number(c.min_temp_c)}℃`,
      sub: c.sleep_quality ? SLEEP_QUALITY[c.sleep_quality] : c.temp_measured ? "温度計で実測" : "体感",
    });
  }
  tiles.push({ label: "② ペグ", value: PEG_SHORT[c.peg_needed], sub: `地面は${GROUND_TYPE[c.ground_type]}` });
  tiles.push({ label: "③ 焚き火", value: FIRE_SHORT[c.fire_status], sub: c.bug_level ? BUG_LEVEL[c.bug_level] : "" });
  return tiles;
}

/** X に投稿する文面（投稿前に自由に書き換えられる） */
export function shareText(c: Checkin, campsiteName: string): string {
  const parts: string[] = [];
  if (c.min_temp_c != null) parts.push(`${c.temp_at_dawn ? "明け方" : "最低"}${Number(c.min_temp_c)}℃`);
  parts.push(PEG_PHRASE[c.peg_needed]);
  parts.push(
    c.fire_status === "done" ? "焚き火できた" : c.fire_status === "skipped_wind" ? "風で焚き火は断念" : "焚き火は禁止",
  );
  return `${campsiteName}、${parts.join("。")}。 #ソト活 #${SITE_NAME}`;
}
