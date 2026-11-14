import "server-only";

/**
 * カード画像に日本語を描くためのフォントを Google Fonts から取ってくる。
 * 画像に使う文字だけを指定して取るので、数十KB程度で済む（日本語フォント全体は数MBある）
 */
export async function loadJapaneseFont(text: string, weight: 500 | 700): Promise<ArrayBuffer> {
  const chars = [...new Set(text)].join("");
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(chars)}`;
  const css = await (await fetch(cssUrl)).text();
  // 画像の生成ライブラリは woff2 を読めないので、TTF/OTF の URL を探す
  const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("カード画像用のフォントを取得できませんでした");
  return (await fetch(url)).arrayBuffer();
}
