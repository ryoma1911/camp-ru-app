import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { getCurrentUserId } from "@/lib/auth";
import { getCampsite, getCampsites } from "@/lib/campsites";
import type { Campsite } from "@/lib/labels";
import { createCheckin } from "./actions";
import { CheckinForm } from "./checkin-form";

export const metadata = { title: "キャン活を投稿" };

export async function generateStaticParams() {
  const campsites = await getCampsites();
  return campsites.map((c) => ({ slug: c.slug }));
}

type Props = PageProps<"/campsites/[slug]/checkin">;

// URL（params）を読む部分は <Suspense> の内側に置く（Next.js 16 の即時ナビゲーションのため）
export default function CheckinPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <CheckinContent params={props.params} />
    </Suspense>
  );
}

async function CheckinContent({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const campsite = await getCampsite(slug);
  if (!campsite) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/campsites/${campsite.slug}`} className="text-sm text-emerald-700 underline">
          ← {campsite.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">キャン活を投稿</h1>
        <p className="mt-1 text-sm text-stone-600">
          タップで選ぶだけ。①〜③が次に行く人の一番の手がかりになります。
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
        <FormOrLogin campsite={campsite} />
      </Suspense>
    </div>
  );
}

async function FormOrLogin({ campsite }: { campsite: Campsite }) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <form action={signInWithGoogle} className="space-y-3 rounded-xl border border-stone-200 bg-white p-6 text-center">
        <p className="text-sm">投稿するにはログインが必要です。</p>
        <input type="hidden" name="next" value={`/campsites/${campsite.slug}/checkin`} />
        <button className="h-11 rounded-full bg-emerald-700 px-6 font-medium text-white hover:bg-emerald-800">
          Googleでログインして投稿
        </button>
      </form>
    );
  }
  const action = createCheckin.bind(null, { id: campsite.id, slug: campsite.slug });
  return <CheckinForm action={action} userId={userId} cancelHref={`/campsites/${campsite.slug}`} />;
}
