import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateFacilities } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/admin";
import { getCampsite, getCampsites } from "@/lib/campsites";
import { FacilitiesForm } from "./facilities-form";

export const metadata = { title: "キャンプ場の設備・地図の編集", robots: { index: false } };

export async function generateStaticParams() {
  const campsites = await getCampsites();
  return campsites.map((c) => ({ slug: c.slug }));
}

type Props = PageProps<"/admin/campsites/[slug]/edit">;

export default function AdminFacilitiesPage(props: Props) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-3xl text-sm text-stone-500">読み込み中…</p>}>
      <AdminFacilitiesContent params={props.params} />
    </Suspense>
  );
}

async function AdminFacilitiesContent({ params }: Pick<Props, "params">) {
  await requireAdmin();
  const { slug } = await params;
  const campsite = await getCampsite(slug);
  if (!campsite) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← 管理
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{campsite.name}の設備・地図</h1>
        <p className="mt-1 text-sm text-stone-600">
          公式サイトで確認できたものを入れてください。わからない項目は「未入力」のままにすると、キャンプ場ページでは空欄になります。
          {campsite.official_url && (
            <a href={campsite.official_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-emerald-700 underline">
              公式サイト
            </a>
          )}
          <Link href={`/campsites/${campsite.slug}`} className="ml-2 text-emerald-700 underline">
            キャンプ場ページを見る
          </Link>
        </p>
      </div>
      <FacilitiesForm campsite={campsite} action={updateFacilities.bind(null, campsite.id)} />
    </div>
  );
}
