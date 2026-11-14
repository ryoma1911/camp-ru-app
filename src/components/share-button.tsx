"use client";

/** X の投稿画面を開く。文面とキャン活ページの URL を最初から入れておく（投稿前に書き換えられる） */
export function ShareButton({
  path,
  text,
  variant = "outline",
}: {
  /** 共有するページ（例：/checkins/xxx） */
  path: string;
  text: string;
  variant?: "primary" | "outline";
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const url = new URL(path, window.location.origin).toString();
        const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(intent, "_blank", "noopener,noreferrer");
      }}
      className={
        variant === "primary"
          ? "inline-flex h-11 items-center gap-2 rounded-full bg-stone-900 px-6 font-bold text-white hover:bg-stone-700"
          : "rounded-full border border-stone-300 px-3 py-1 hover:bg-stone-100"
      }
    >
      <span aria-hidden className="font-bold">𝕏</span>
      {variant === "primary" ? "Xでシェアする" : "シェア"}
    </button>
  );
}
