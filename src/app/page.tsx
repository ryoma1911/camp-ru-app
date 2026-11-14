import { getCampsites } from "@/lib/campsites";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE } from "@/lib/labels";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function Home() {
  if (!isSupabaseConfigured) return <SetupNotice />;

  const campsites = await getCampsites();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">キャンプ場をさがす</h1>
        <p className="mt-1 text-sm text-stone-600">
          行った人の投稿でわかる、明け方の気温・地面とペグ・焚き火のリアル。
        </p>
      </section>

      {campsites.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          まだキャンプ場が登録されていません。data/README.md の手順で CSV を取り込んでください。
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {campsites.map((c) => (
            <li key={c.id} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">{c.name}</h2>
                <span className="shrink-0 text-xs text-stone-500">{c.prefecture}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Tag>{LOCATION_TYPE[c.location_type]}</Tag>
                <Tag>{SITE_STYLE[c.site_style]}</Tag>
                <Tag>{FIRE_RULE[c.fire_rule]}</Tag>
                {c.car_access && <Tag>車乗り入れ可</Tag>}
                {c.has_hot_water && <Tag>炊事場お湯</Tag>}
                {c.has_shower && <Tag>シャワー</Tag>}
                {c.has_bath && <Tag>風呂</Tag>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-stone-100 px-2 py-0.5 text-stone-700">{children}</span>;
}

function SetupNotice() {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm leading-7">
      <h1 className="mb-2 text-base font-bold">Supabase の接続設定がまだです</h1>
      <ol className="list-decimal pl-5">
        <li>
          <code>.env.local.example</code> を <code>.env.local</code> にコピー
        </li>
        <li>Supabase の URL とキーを書き込む</li>
        <li>開発サーバーを再起動</li>
      </ol>
    </div>
  );
}
