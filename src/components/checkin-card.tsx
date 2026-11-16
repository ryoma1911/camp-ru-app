import Link from "next/link";
import {
  BUG_LEVEL,
  FIRE_STATUS,
  HEATER,
  PARTY_TYPE,
  PEG_NEEDED,
  SLEEP_QUALITY,
  type Checkin,
} from "@/lib/labels";
import { supabaseUrl } from "@/lib/supabase/env";

/** ソト活1件の表示。heading（投稿者名やキャンプ場名）と actions（編集・削除）は呼び出し側で決める */
export function CheckinCard({
  checkin: c,
  heading,
  actions,
}: {
  checkin: Checkin;
  heading: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const temp =
    c.min_temp_c != null
      ? `${c.temp_at_dawn ? "明け方" : "最低"} ${Number(c.min_temp_c)}℃（${c.temp_measured ? "実測" : "体感"}）`
      : null;
  const photos = [...c.checkin_photos].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <li className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{heading}</span>
        {/* 日付から、この投稿1件のページ（シェア用）に移れる */}
        <Link href={`/checkins/${c.id}`} className="shrink-0 text-stone-500 underline-offset-4 hover:underline">
          <time>{c.visited_on.replaceAll("-", "/")}</time>
        </Link>
      </div>

      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-stone-500">気温</dt>
        <dd>
          {temp ?? "記録なし"}
          {c.sleep_quality && (
            <span className="ml-2 text-stone-600">
              {c.sleeping_bag_comfort_c != null && `快適${c.sleeping_bag_comfort_c}℃の寝袋で`}
              {SLEEP_QUALITY[c.sleep_quality]}
            </span>
          )}
        </dd>
        <dt className="text-stone-500">地面の固さ</dt>
        <dd>{PEG_NEEDED[c.peg_needed]}</dd>
        <dt className="text-stone-500">焚き火</dt>
        <dd>{FIRE_STATUS[c.fire_status]}</dd>
        {c.bug_level && (
          <>
            <dt className="text-stone-500">虫</dt>
            <dd>{BUG_LEVEL[c.bug_level]}</dd>
          </>
        )}
        {c.party_type && (
          <>
            <dt className="text-stone-500">同行</dt>
            <dd>{PARTY_TYPE[c.party_type]}</dd>
          </>
        )}
        {c.heaters && (
          <>
            <dt className="text-stone-500">暖房</dt>
            <dd>{c.heaters.map((h) => HEATER[h]).join("・")}</dd>
          </>
        )}
      </dl>

      {c.comment && <p className="whitespace-pre-wrap text-sm leading-6">{c.comment}</p>}

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p) => (
            // Supabase Storage の公開URLをそのまま表示（MVPでは画像最適化は使わない）
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.storage_path}
              src={`${supabaseUrl}/storage/v1/object/public/checkin-photos/${p.storage_path}`}
              alt=""
              loading="lazy"
              className="aspect-square w-full rounded object-cover"
            />
          ))}
        </div>
      )}

      {actions}
    </li>
  );
}

/**
 * キャンプ場ページの一覧用の簡易表示（写真・ユーザー名・日付・同行・気温）。
 * 押すと投稿1件のページに移り、全部の項目と、本人なら編集・削除を出す
 */
export function CheckinRow({ checkin: c }: { checkin: Checkin }) {
  const photo = [...c.checkin_photos].sort((a, b) => a.sort_order - b.sort_order)[0];
  const temp = c.min_temp_c != null ? `${c.temp_at_dawn ? "明け方" : "最低"} ${Number(c.min_temp_c)}℃` : null;
  return (
    <li>
      <Link href={`/checkins/${c.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-stone-50">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${supabaseUrl}/storage/v1/object/public/checkin-photos/${photo.storage_path}`}
            alt=""
            loading="lazy"
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span aria-hidden className="h-14 w-14 shrink-0 rounded-lg bg-stone-100" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{c.profiles?.display_name ?? "キャンパー"}</span>
            <time className="shrink-0 text-xs text-stone-500">{c.visited_on.replaceAll("-", "/")}</time>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {c.party_type && (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{PARTY_TYPE[c.party_type]}</span>
            )}
            <span className={temp ? "" : "text-stone-400"}>{temp ?? "気温の記録なし"}</span>
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-stone-400">
          ›
        </span>
      </Link>
    </li>
  );
}
