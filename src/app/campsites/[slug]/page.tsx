import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Tag } from "@/components/tag";
import { getCampsite, getCampsites, getRecentCheckins } from "@/lib/campsites";
import { CheckinCard } from "@/components/checkin-card";
import { CheckinOwnerActions } from "@/components/checkin-owner-actions";
import { getCurrentUserId } from "@/lib/auth";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE } from "@/lib/labels";

export async function generateStaticParams() {
  const campsites = await getCampsites();
  return campsites.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/campsites/[slug]">) {
  const { slug } = await props.params;
  const campsite = await getCampsite(slug);
  return { title: campsite ? `${campsite.name}の現地コンディション` : "キャンプ場が見つかりません" };
}

type Props = PageProps<"/campsites/[slug]">;

// URL（params / searchParams）を読む部分は <Suspense> の内側に置く（Next.js 16 の即時ナビゲーションのため）
export default function CampsitePage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <CampsiteContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CampsiteContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { slug } = await params;
  const campsite = await getCampsite(slug);
  if (!campsite) notFound();

  const mapUrl =
    campsite.lat != null && campsite.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${campsite.lat},${campsite.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(campsite.address)}`;

  return (
    <div className="space-y-8">
      <Suspense>
        <PostedNotice searchParams={searchParams} />
      </Suspense>

      <section className="space-y-3">
        <p className="text-sm text-stone-500">{campsite.prefecture}</p>
        <h1 className="text-2xl font-bold">{campsite.name}</h1>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Tag>{LOCATION_TYPE[campsite.location_type]}</Tag>
          <Tag>{SITE_STYLE[campsite.site_style]}</Tag>
          <Tag>{FIRE_RULE[campsite.fire_rule]}</Tag>
          {campsite.car_access && <Tag>車乗り入れ可</Tag>}
          {campsite.has_hot_water && <Tag>炊事場お湯</Tag>}
          {campsite.has_shower && <Tag>シャワー</Tag>}
          {campsite.has_bath && <Tag>風呂</Tag>}
        </div>
        <p className="text-sm text-stone-600">
          {campsite.address}
          {" ・ "}
          <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">
            地図
          </a>
          {campsite.official_url && (
            <>
              {" ・ "}
              <a href={campsite.official_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">
                公式サイト
              </a>
            </>
          )}
        </p>
        <Link
          href={`/campsites/${campsite.slug}/checkin`}
          className="inline-flex h-11 items-center rounded-full bg-emerald-700 px-6 font-medium text-white hover:bg-emerald-800"
        >
          キャン活を投稿する
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">みんなのキャン活</h2>
        <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
          <CheckinList campsiteId={campsite.id} />
        </Suspense>
      </section>
    </div>
  );
}

async function PostedNotice({ searchParams }: Pick<Props, "searchParams">) {
  const { posted, updated } = await searchParams;
  const message =
    posted === "1" ? "キャン活を投稿しました。ありがとうございます！" : updated === "1" ? "キャン活を更新しました。" : null;
  if (!message) return null;
  return (
    <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>
  );
}

async function CheckinList({ campsiteId }: { campsiteId: string }) {
  const [checkins, userId] = await Promise.all([getRecentCheckins(campsiteId), getCurrentUserId()]);
  if (checkins.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
        まだキャン活がありません。最初の投稿をお待ちしています。
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {checkins.map((c) => (
        <CheckinCard
          key={c.id}
          checkin={c}
          heading={c.profiles?.display_name ?? "キャンパー"}
          actions={c.user_id === userId ? <CheckinOwnerActions id={c.id} campsiteId={campsiteId} /> : null}
        />
      ))}
    </ul>
  );
}
