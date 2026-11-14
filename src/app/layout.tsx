import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Campる | キャンプ場の現地コンディションがわかる",
    template: "%s | Campる",
  },
  description:
    "実際に行った人の投稿で、キャンプ場の明け方の気温・地面とペグ・焚き火できたかがわかる。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <Link href="/" className="text-lg font-bold tracking-tight text-emerald-800">
              Campる
            </Link>
            <Suspense fallback={<div className="h-9 w-32" />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
