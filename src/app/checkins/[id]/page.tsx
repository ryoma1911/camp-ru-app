import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CheckinCard } from "@/components/checkin-card";
import { CheckinOwnerActions } from "@/components/checkin-owner-actions";
import { ShareButton } from "@/components/share-button";
import { getCurrentUserId } from "@/lib/auth";
import { cardTiles, getCheckin, shareText, visitedMonth } from "@/lib/checkin-share";

type Props = PageProps<"/checkins/[id]">;

export async function generateMetadata(props: Props) {
  const { id } = await props.params;
  const c = await getCheckin(id);
  if (!c) return { title: "キャン活が見つかりません" };
  const title = `${c.campsites.name}のキャン活（${visitedMonth(c)}月）`;
  const description = cardTiles(c)
    .map((t) => `${t.label.replace(/^[①②③] /, "")}：${t.value}`)
    .join(" / ");
  // 画像は同じ場所の opengraph-image.tsx が自動で付く。X では大きな画像のカードで表示する
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

// URL（params / searchParams）を読む部分は <Suspense> の内側に置く（Next.js 16 の即時ナビゲーションのため）
export default function CheckinPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <CheckinContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CheckinContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const [{ id }, sp, userId] = await Promise.all([params, searchParams, getCurrentUserId()]);
  const c = await getCheckin(id);
  if (!c) notFound();

  const path = `/checkins/${c.id}`;
  const text = shareText(c, c.campsites.name);
  const mine = c.user_id === userId;

  return (
    <div className="space-y-6">
      {sp.posted === "1" && mine && (
        <section className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center">
          <p className="font-bold text-emerald-900">キャン活を投稿しました。ありがとうございます！</p>
          <p className="text-sm text-emerald-900">次に行く人のために、Xでも共有してみませんか？</p>
          <ShareButton path={path} text={text} variant="primary" />
        </section>
      )}

      <div>
        <Link href={`/campsites/${c.campsites.slug}`} className="text-sm text-emerald-700 underline">
          ← {c.campsites.name}（{c.campsites.prefecture}）
        </Link>
        <h1 className="mt-2 text-2xl font-bold">
          {c.campsites.name}のキャン活
          <span className="ml-2 text-base font-normal text-stone-500">{visitedMonth(c)}月</span>
        </h1>
      </div>

      <ul>
        <CheckinCard
          checkin={c}
          heading={c.profiles?.display_name ?? "キャンパー"}
          actions={
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ShareButton path={path} text={text} />
              {mine && <CheckinOwnerActions id={c.id} campsiteId={c.campsites.id} afterDeleteHref="/me" />}
            </div>
          }
        />
      </ul>

      <Link
        href={`/campsites/${c.campsites.slug}`}
        className="block rounded-xl border border-stone-200 bg-white p-4 text-sm hover:bg-stone-50"
      >
        {c.campsites.name}の現地コンディション（みんなのキャン活の集計）を見る →
      </Link>
    </div>
  );
}
