import type { ClosureStatus } from "@/lib/closure";

/** キャンプ場ページの名前の下に出す、冬季閉鎖の札（閉鎖中・予告） */
export function ClosureNotice({ status }: { status: ClosureStatus | null }) {
  if (!status) return null;
  const closed = status.kind === "closed";
  return (
    <div
      role="status"
      className={`rounded-lg border p-3 text-sm ${closed ? "border-sky-300 bg-sky-50 text-sky-900" : "border-amber-300 bg-amber-50 text-amber-900"}`}
    >
      <p className="font-bold">
        <span aria-hidden className="mr-1">❄</span>
        {closed ? "冬季閉鎖中" : `${status.start}から冬季閉鎖`}
      </p>
      <p className="mt-0.5 text-xs">
        {closed ? `${status.period}・${status.reopen}から営業` : `閉鎖期間：${status.period}`}
        {status.note && <span className="block">{status.note}</span>}
      </p>
    </div>
  );
}

/** 一覧のカードの写真の上に出す小さな札 */
export function ClosureChip({ status, className = "" }: { status: ClosureStatus | null; className?: string }) {
  if (!status) return null;
  return status.kind === "closed" ? (
    <span className={`rounded-full bg-sky-800 px-2 py-0.5 text-xs font-bold text-white ${className}`}>
      ❄ 冬季閉鎖中・{status.reopen}から
    </span>
  ) : (
    <span className={`rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 ${className}`}>
      {status.start}から冬季閉鎖
    </span>
  );
}
