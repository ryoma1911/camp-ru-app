"use client";

import { useActionState } from "react";
import { updateNickname, type NicknameFormState } from "./actions";

export function NicknameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<NicknameFormState, FormData>(updateNickname, {
    error: null,
    saved: false,
  });

  return (
    <form action={action} className="space-y-2">
      <label htmlFor="display_name" className="text-sm font-medium">
        ニックネーム
        <span className="ml-2 text-xs font-normal text-stone-500">投稿に表示されます（1〜20文字）</span>
      </label>
      <div className="flex gap-2">
        <input
          id="display_name"
          name="display_name"
          defaultValue={current}
          required
          maxLength={20}
          className="h-11 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3"
        />
        <button
          disabled={pending}
          className="h-11 shrink-0 rounded-full bg-emerald-700 px-5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.saved && !pending && <p className="text-sm text-emerald-700">保存しました。</p>}
      <p className="text-xs text-stone-500">Googleアカウントの名前やアイコンは、サイトには表示されません。</p>
    </form>
  );
}
