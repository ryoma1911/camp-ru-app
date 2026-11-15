import { getCheckin } from "@/lib/checkin-share";
import { OG_SIZE, renderCheckinCard } from "@/lib/og-card";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "ソトアソビ のソト活：明け方の気温・ペグ・焚き火";

/** ソト活1件のシェア用カード（写真があれば B、なければ A。描き方は lib/og-card.tsx） */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCheckin(id);
  if (!c) return new Response("Not found", { status: 404 });
  return renderCheckinCard(c);
}
