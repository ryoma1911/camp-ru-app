import "server-only";
import { ImageResponse } from "next/og";
import { cardTiles, visitedMonth, type CheckinWithCampsite } from "@/lib/checkin-share";
import { loadJapaneseFont } from "@/lib/og-font";
import { SITE_NAME, TAGLINE } from "@/lib/site";
import { supabaseUrl } from "@/lib/supabase/env";

// X で大きな画像として表示される比率（1.91:1）
export const OG_SIZE = { width: 1200, height: 630 };

const GREEN = "#085041";
const MINT = "#9FE1CB";
const PALE = "#E1F5EE";

/**
 * ソト活1件のシェア用カード。
 * 写真がある投稿は B（左に1枚目の写真、右に3指標）、ない投稿は A（3指標を大きく）
 */
export async function renderCheckinCard(c: CheckinWithCampsite): Promise<ImageResponse> {

  const tiles = cardTiles(c);
  // 長いキャンプ場名ははみ出さないよう文字を小さくする（英字は日本語の約半分の幅として数える）
  const nameLen = [...c.campsites.name].reduce((n, ch) => n + (/[ -~]/.test(ch) ? 0.55 : 1), 0);
  const nameSizeA = nameLen > 26 ? 46 : nameLen > 17 ? 54 : 64;
  const nameSizeB = nameLen > 22 ? 32 : nameLen > 14 ? 38 : nameLen > 9 ? 44 : 50;
  const month = visitedMonth(c);
  const photo = [...c.checkin_photos].sort((a, b) => a.sort_order - b.sort_order)[0];
  const photoUrl = photo ? `${supabaseUrl}/storage/v1/object/public/checkin-photos/${photo.storage_path}` : null;

  const allText = [
    SITE_NAME, TAGLINE, c.campsites.name, c.campsites.prefecture, `${month}月のソト活`, `${month}月・`,
    ...tiles.flatMap((t) => [t.label, t.value, t.sub]),
  ].join("");
  const [regular, bold] = await Promise.all([loadJapaneseFont(allText, 500), loadJapaneseFont(allText, 700)]);
  const fonts = [
    { name: "NotoSansJP", data: regular, weight: 500 as const, style: "normal" as const },
    { name: "NotoSansJP", data: bold, weight: 700 as const, style: "normal" as const },
  ];

  const body = photoUrl ? (
    // B：写真＋数字型
    <div style={{ display: "flex", width: "100%", height: "100%", background: GREEN }}>
      {/* カード画像の生成では next/image は使えないので、ふつうの img で写真を描く */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt="" width={540} height={630} style={{ width: 540, height: 630, objectFit: "cover" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, padding: "44px 48px", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 26, color: MINT }}>{`${month}月・${c.campsites.prefecture}`}</span>
          <span style={{ fontSize: 34, fontWeight: 700 }}>{SITE_NAME}</span>
        </div>
        <div style={{ display: "flex", fontSize: nameSizeB, fontWeight: 700, lineHeight: 1.25 }}>{c.campsites.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <span style={{ width: 170, fontSize: 24, color: MINT }}>{t.label.replace(/明け方の|夜の最低/, "")}</span>
              <span style={{ fontSize: 46, fontWeight: 700 }}>{t.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : (
    // A：数字を大きく見せる型
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: GREEN, color: "#fff", padding: "52px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 28, color: MINT }}>{`${month}月のソト活　${c.campsites.prefecture}`}</span>
        <span style={{ fontSize: 38, fontWeight: 700 }}>{SITE_NAME}</span>
      </div>
      <div style={{ display: "flex", fontSize: nameSizeA, fontWeight: 700, lineHeight: 1.2 }}>{c.campsites.name}</div>
      <div style={{ display: "flex", gap: 24 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{ display: "flex", flexDirection: "column", flex: 1, background: "rgba(255,255,255,0.1)", borderRadius: 20, padding: "22px 28px" }}>
            <span style={{ fontSize: 24, color: MINT }}>{t.label}</span>
            <span style={{ fontSize: 62, fontWeight: 700, marginTop: 6 }}>{t.value}</span>
            <span style={{ fontSize: 24, color: PALE, marginTop: 6, height: 30 }}>{t.sub}</span>
          </div>
        ))}
      </div>
      <span style={{ fontSize: 24, color: MINT }}>{TAGLINE}</span>
    </div>
  );

  return new ImageResponse(body, { ...OG_SIZE, fonts });
}
