"use client";

import { useActionState } from "react";
import type { FacilitiesState } from "@/app/admin/actions";
import { FacilityFields } from "@/components/facility-fields";
import { PlaceIdField } from "@/components/place-id-field";
import type { Campsite } from "@/lib/labels";
import { WinterClosureFields } from "@/components/winter-closure-fields";

export function FacilitiesForm({
  campsite,
  action,
}: {
  campsite: Campsite;
  action: (prev: FacilitiesState, formData: FormData) => Promise<FacilitiesState>;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null, saved: false });

  return (
    <form action={formAction} className="space-y-6 rounded-xl border border-stone-200 bg-white p-4">
      <FacilityFields initial={campsite} unknownLabel="未入力" basicOffLabel="なし" />

      <PlaceIdField defaultValue={campsite.google_place_id} />

      <WinterClosureFields initial={campsite} />

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      {state.saved && !pending && (
        <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          保存しました。キャンプ場ページに反映されています。
        </p>
      )}
      <button
        disabled={pending}
        className="h-11 w-full rounded-full bg-emerald-700 font-bold text-white hover:bg-emerald-800 disabled:opacity-50 sm:ml-auto sm:block sm:w-auto sm:px-8"
      >
        {pending ? "保存しています…" : "保存する"}
      </button>
    </form>
  );
}
