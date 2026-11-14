"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteCheckin } from "@/app/checkins/actions";

/** 自分の投稿にだけ出す「編集」「削除」 */
export function CheckinOwnerActions({
  id,
  campsiteId,
  afterDeleteHref,
}: {
  id: string;
  campsiteId: string;
  /** 削除したあとに移るページ（投稿1件のページで削除したときは、そのページがなくなるため） */
  afterDeleteHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/checkins/${id}/edit`}
        className="rounded-full border border-stone-300 px-3 py-1 hover:bg-stone-100"
      >
        編集
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm("このキャン活を削除しますか？\n写真も一緒に消え、元に戻せません。")) return;
          setError(null);
          startTransition(async () => {
            const result = await deleteCheckin({ id, campsiteId });
            if (result.error) setError(result.error);
            else if (afterDeleteHref) router.push(afterDeleteHref);
          });
        }}
        className="rounded-full border border-red-300 px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "削除中…" : "削除"}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
