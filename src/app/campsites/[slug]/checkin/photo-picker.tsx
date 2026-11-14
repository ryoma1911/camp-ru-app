"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const MAX_PHOTOS = 4;
const MAX_EDGE = 1600; // 長辺のピクセル数
const JPEG_QUALITY = 0.8;

type Photo = { key: string; preview: string; path: string | null; failed: boolean };

/** 選んだ写真をブラウザで縮小してから Supabase Storage に直接アップロードする */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圧縮に失敗しました"))), "image/jpeg", JPEG_QUALITY),
  );
}

export function PhotoPicker({
  userId,
  onUploadingChange,
}: {
  userId: string;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const uploading = photos.some((p) => !p.path && !p.failed);

  useEffect(() => onUploadingChange(uploading), [uploading, onUploadingChange]);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, room);
    const added = picked.map((file) => ({
      key: crypto.randomUUID(),
      preview: URL.createObjectURL(file),
      path: null,
      failed: false,
      file,
    }));
    setPhotos((prev) => [
      ...prev,
      ...added.map((a) => ({ key: a.key, preview: a.preview, path: a.path, failed: a.failed })),
    ]);

    const supabase = createSupabaseBrowserClient();
    await Promise.all(
      added.map(async ({ key, file }) => {
        try {
          const blob = await compress(file);
          const path = `${userId}/${key}.jpg`;
          const { error } = await supabase.storage
            .from("checkin-photos")
            .upload(path, blob, { contentType: "image/jpeg" });
          if (error) throw error;
          setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, path } : p)));
        } catch (e) {
          console.error("photo upload failed", e);
          setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, failed: true } : p)));
        }
      }),
    );
  }

  function remove(key: string) {
    setPhotos((prev) => prev.filter((p) => p.key !== key));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {photos.map((p) => (
          <div key={p.key} className="relative aspect-square overflow-hidden rounded-lg bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            {!p.path && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                {p.failed ? "失敗" : "送信中…"}
              </span>
            )}
            <button
              type="button"
              onClick={() => remove(p.key)}
              aria-label="この写真を外す"
              className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 text-xs text-white"
            >
              ✕
            </button>
            {p.path && <input type="hidden" name="photo_paths" value={p.path} />}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 text-2xl text-stone-400 hover:bg-stone-50">
            ＋
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      {photos.some((p) => p.failed) && (
        <p className="text-xs text-red-700">アップロードに失敗した写真があります。✕で外して選び直してください。</p>
      )}
    </div>
  );
}
