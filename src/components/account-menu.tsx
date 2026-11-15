"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

/**
 * ログイン後のヘッダーのメニュー（PC・スマホ共通）。「☰ ニックネーム」を押すと開く。
 * もう一度押す・外を押す・Esc・ページを移る、で閉じる
 */
export function AccountMenu({ name, admin }: { name: string; admin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const pathname = usePathname();

  // ページを移ったら閉じる
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex h-11 items-center gap-2 px-4 text-sm hover:bg-stone-100";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 max-w-[12rem] items-center gap-2 rounded-full border border-stone-300 pl-3 pr-4 text-sm hover:bg-stone-100"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <span className="truncate">{name}</span>
        <span className="sr-only">のメニュー</span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
        >
          <Link href="/me" className={item}>
            マイページ
          </Link>
          <Link href="/checkins/new" className={item}>
            ソト活登録
          </Link>
          <Link href="/campsites/new" className={item}>
            キャンプ場登録
          </Link>
          {admin && (
            <Link href="/admin" className={`${item} text-amber-900`}>
              管理
            </Link>
          )}
          <form action={signOut} className="border-t border-stone-200">
            <button className={`${item} w-full text-left text-stone-600`}>ログアウト</button>
          </form>
        </div>
      )}
    </div>
  );
}
