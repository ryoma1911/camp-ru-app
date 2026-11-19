// キャンプ場CSVから、あとから足した項目（設備・Place ID・冬季閉鎖・トイレ・サウナ）だけを更新するSQLを作る。
// 使い方: node data/update-campsites.mjs data/campsites_update_20261117.csv
//   → 同じフォルダに update_campsites_20261117.sql を作る。Supabase の SQL エディタで実行する
//
// ・slug でキャンプ場を探して更新する。名前・住所・種類など、もとからある列には触れない
// ・空欄の項目は変えない（管理画面で入れた値を消さないため。消したいときは管理画面から）
// ・CSV の slug が1件でもDBになければ、何も更新せずにエラーにする
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// 更新する列（テンプレートの並び順）
const BOOLS = ["has_kitchen", "has_shop", "has_wifi"];
const ARRAYS = ["garbage", "ac_power", "shop_items", "payment_methods", "toilet_types", "sauna_types"];
const TEXTS = ["google_place_id", "winter_closed_from", "winter_closed_to", "winter_closure_note"];
const REQUIRED_COLUMNS = ["has_kitchen", "garbage", "ac_power", "has_shop", "shop_items", "has_wifi", "payment_methods", ...TEXTS];
// トイレ・サウナはあとから足した列。ひとつ前のテンプレートの CSV（この2列がない）でも使えるようにする
const OPTIONAL_COLUMNS = ["toilet_types", "sauna_types"];

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((v) => v !== "")) rows.push(row);
  return rows;
}

const quote = (v) => `'${v.replaceAll("'", "''")}'`;

function sqlValue(column, value) {
  if (BOOLS.includes(column)) return value === "true" ? "true" : "false";
  if (ARRAYS.includes(column)) return `${quote(value)}::text[]`;
  return quote(value);
}

const file = process.argv[2];
if (!file) {
  console.error("使い方: node data/update-campsites.mjs <CSVファイル>");
  process.exit(1);
}

// まず値をチェックする（取り込みと同じルール）。問題があればここで止める
try {
  execFileSync(process.execPath, [join(dirname(new URL(import.meta.url).pathname), "check-campsites.mjs"), file], {
    stdio: "inherit",
  });
} catch {
  console.error("\nCSV に問題があるため、SQL は作りませんでした。");
  process.exit(1);
}

const [header, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
if (missing.length) {
  console.error(`新しい項目の列がありません: ${missing.join(", ")}（data/campsites_template.csv の見出しを使ってください）`);
  process.exit(1);
}
const COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS.filter((c) => header.includes(c))];

const updates = [];
let skipped = 0;
for (const cells of rows) {
  const r = Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? "").trim()]));
  const sets = COLUMNS.filter((c) => r[c] !== "").map((c) => `${c} = ${sqlValue(c, r[c])}`);
  if (sets.length === 0) {
    skipped++;
    continue;
  }
  updates.push({ slug: r.slug, sql: `update public.campsites set ${sets.join(", ")} where slug = ${quote(r.slug)};` });
}

const slugs = rows.map((cells) => (cells[header.indexOf("slug")] ?? "").trim());
const out = join(dirname(file), basename(file, ".csv").replace(/^campsites_update/, "update_campsites") + ".sql");
writeFileSync(
  out,
  `-- ${basename(file)} から作ったSQL（node data/update-campsites.mjs）。Supabase の SQL エディタで実行する
-- 更新する列：${COLUMNS.join(", ")}（空欄の項目は変えない）
-- CSV の slug が1件でもDBになければ、何も更新せずにエラーで止まる

begin;

do $$
declare
  v_missing text;
begin
  select string_agg(s, ', ') into v_missing
  from unnest(array[${slugs.map(quote).join(", ")}]) as s
  where not exists (select 1 from public.campsites c where c.slug = s);
  if v_missing is not null then
    raise exception 'DBにない slug があります: %', v_missing;
  end if;
end $$;

${updates.map((u) => u.sql).join("\n")}

commit;

-- 確認用：CSV のキャンプ場の、更新後の値
select slug, ${COLUMNS.join(", ")}
from public.campsites
where slug in (${slugs.map(quote).join(", ")})
order by prefecture, slug;
`,
);

console.log(`\nSQL を作りました: ${out}`);
console.log(`  更新するキャンプ場: ${updates.length} 件（新しい項目がすべて空欄で、更新しないもの: ${skipped} 件）`);
