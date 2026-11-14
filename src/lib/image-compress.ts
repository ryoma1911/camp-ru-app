// 写真をブラウザで縮小して JPEG にする（キャン活の写真・キャンプ場の画像で共通）
// ブラウザの API を使うので、クライアントコンポーネントからだけ呼ぶ

const MAX_EDGE = 1600; // 長辺のピクセル数
const JPEG_QUALITY = 0.8;

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

/** 長辺 1600px の JPEG にする（HEIC も読める） */
export async function compress(file: File): Promise<Blob> {
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
