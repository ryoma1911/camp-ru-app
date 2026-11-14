"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient, photoPublicUrl } from "@/lib/supabase/client";

const MAX_PHOTOS = 4;
const MAX_EDGE = 1600; // 長辺のピクセル数
const JPEG_QUALITY = 0.8;

type Photo = { key: string; preview: string; path: string | null; failed: boolean };

const looksLikeHeic = (file: File) =>
  /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/**
 * 写真を読み込む。まずブラウザ自身に任せ（Safari は HEIC も読める）、
 * 読めなかった HEIC だけ変換ライブラリを使う。ライブラリは大きいので、必要なときだけ読み込む
 */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (nativeError) {
    const { heicTo, isHeic } = await import("heic-to");
    if (!looksLikeHeic(file) && !(await isHeic(file))) throw nativeError;
    return heicTo({ blob: file, type: "bitmap" });
  }
}

/** 選んだ写真をブラウザで縮小して JPEG にしてから Supabase Storage に直接アップロードする */
async function compress(file: File): Promise<Blob> {
  const bitmap = await decode(file);
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
  initialPaths = [],
  onUploadingChange,
}: {
  userId: string;
  /** 編集時にすでに付いている写真 */
  initialPaths?: string[];
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    initialPaths.map((path) => ({ key: path, preview: photoPublicUrl(path), path, failed: false })),
  );
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
          // HEIC はブラウザによってはそのまま表示できないので、変換後の JPEG でプレビューし直す
          const preview = URL.createObjectURL(blob);
          setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, preview } : p)));

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
                {p.failed ? "失敗" : "処理中…"}
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
              // PC のブラウザでも iPhone の写真（.heic）を選べるように拡張子も指定する
              accept="image/*,.heic,.heif"
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
        <p className="text-xs text-red-700">
          読み込めなかった写真があります。✕で外して、別の写真を選んでください。
        </p>
      )}
    </div>
  );
}
