import Link from "next/link";
import {
  BUG_LEVEL,
  FIRE_STATUS,
  HEATER,
  PARTY_TYPE,
  PEG_NEEDED,
  SLEEPING_BAG_TYPE,
  SLEEP_QUALITY,
  WEATHER,
  type Checkin,
} from "@/lib/labels";
import { EST_TEMP_NOTE, stayLabel, tempOf } from "@/lib/stay";
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
  const t = tempOf(c);
  const photos = [...c.checkin_photos].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <li className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{heading}</span>
        {/* 日付から、この投稿1件のページ（シェア用）に移れる */}
        <Link href={`/checkins/${c.id}`} className="shrink-0 text-stone-500 underline-offset-4 hover:underline">
          <time dateTime={c.visited_on}>{stayLabel(c)}</time>
        </Link>
      </div>

      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        {c.weather && (
          <>
            <dt className="text-stone-500">天気</dt>
            <dd>{c.weather.map((w) => WEATHER[w]).join("・")}</dd>
          </>
        )}
        <dt className="text-stone-500">気温</dt>
        <dd>
          {!t ? (
            "記録なし"
          ) : t.estimated ? (
            // 本人の記録ではないので、点線の枠で区別する
            <span title={EST_TEMP_NOTE} className="rounded border border-dashed border-stone-400 px-1.5 py-0.5 text-stone-700">
              {t.label} {t.value}℃（気象データからの推定）
            </span>
          ) : (
            `${t.label} ${t.value}℃（${c.temp_measured ? "実測" : "体感"}）`
          )}
          {c.sleep_quality && (
            <span className="ml-2 text-stone-600">
              {c.sleeping_bag_type && `${SLEEPING_BAG_TYPE[c.sleeping_bag_type]}の寝袋で`}
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
  const t = tempOf(c);
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
            <time dateTime={c.visited_on} className="shrink-0 text-xs text-stone-500">
              {stayLabel(c)}
            </time>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {c.party_type && (
              <span className="rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{PARTY_TYPE[c.party_type]}</span>
            )}
            {!t ? (
              <span className="text-stone-400">気温の記録なし</span>
            ) : t.estimated ? (
              <span title={EST_TEMP_NOTE} className="rounded border border-dashed border-stone-400 px-1.5 text-stone-700">
                {t.label} {t.value}℃（推定）
              </span>
            ) : (
              <span>
                {t.label} {t.value}℃
              </span>
            )}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-stone-400">
          ›
        </span>
      </Link>
    </li>
  );
}
