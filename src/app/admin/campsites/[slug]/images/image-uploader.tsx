"use client";

import { useState } from "react";
import { addOwnImages } from "@/app/admin/actions";
import { compress } from "@/lib/image-compress";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** 自分で撮った写真をアップロードして登録する（長辺 1600px の JPEG にしてから送る） */
export function ImageUploader({ campsiteId, room }: { campsiteId: string; room: number }) {
  const [credit, setCredit] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`あと${room}枚まで登録できます。先頭の${room}枚だけ使います。`);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const paths: string[] = [];
    try {
      for (const [i, file] of picked.entries()) {
        setStatus(`写真を処理しています（${i + 1} / ${picked.length}）…`);
        const blob = await compress(file);
        const path = `${campsiteId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("campsite-images")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        paths.push(path);
      }
      setStatus("登録しています…");
      const result = await addOwnImages(campsiteId, paths, credit);
      if (result.error) setError(result.error);
    } catch (e) {
      console.error("campsite image upload failed", e);
      setError("アップロードに失敗しました。別の写真を選ぶか、時間をおいてもう一度お試しください。");
      if (paths.length > 0) await supabase.storage.from("campsite-images").remove(paths);
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  if (room <= 0) {
    return <p className="text-sm text-stone-500">上限の枚数まで登録しています。外してから追加してください。</p>;
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">撮影者の表示</span>
        <input
          value={credit}
          onChange={(e) => setCredit(e.target.value)}
          maxLength={40}
          placeholder="空なら「ソトアソビ」"
          className="h-11 w-full rounded-lg border border-stone-300 bg-white px-3"
        />
      </label>
      <label
        className={`flex h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-sm text-stone-600 hover:bg-stone-50 ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        {busy ? status : `＋ 写真を選ぶ（あと${room}枚）`}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-stone-500">
        使えるのは自分で撮った写真だけです。公式サイト・予約サイト・SNS の写真は使いません。
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
