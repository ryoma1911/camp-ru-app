import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckinForm } from "@/app/campsites/[slug]/checkin/checkin-form";
import { updateCheckin } from "@/app/checkins/actions";
import { getCurrentUserId } from "@/lib/auth";
import { getMyCheckin } from "@/lib/my-checkins";

export const metadata = { title: "キャン活を編集" };

type Props = PageProps<"/checkins/[id]/edit">;

export default function EditCheckinPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <EditContent params={props.params} />
    </Suspense>
  );
}

async function EditContent({ params }: Pick<Props, "params">) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) redirect("/me");

  // 自分の投稿でなければ「見つからない」扱いにする
  const checkin = await getMyCheckin(id, userId);
  if (!checkin) notFound();

  const action = updateCheckin.bind(null, {
    id: checkin.id,
    campsiteId: checkin.campsites.id,
    slug: checkin.campsites.slug,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/campsites/${checkin.campsites.slug}`} className="text-sm text-emerald-700 underline">
          ← {checkin.campsites.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">キャン活を編集</h1>
      </div>
      <CheckinForm
        action={action}
        userId={userId}
        initial={checkin}
        submitLabel="変更を保存する"
        cancelHref={`/campsites/${checkin.campsites.slug}`}
      />
    </div>
  );
}
