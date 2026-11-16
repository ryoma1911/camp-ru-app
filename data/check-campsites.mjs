// キャンプ場CSVを取り込む前に、DBが受け付ける値になっているかをチェックする
// 使い方: node data/check-campsites.mjs data/campsites.csv
import { readFileSync } from "node:fs";

const ENUMS = {
  location_type: ["forest", "river", "lake", "highland", "sea", "meadow", "view"],
  site_style: ["sectioned", "free", "both"],
  fire_rule: ["open_fire_ok", "stand_required", "prohibited"],
};
const BOOLS = ["car_access", "has_hot_water", "has_shower", "has_bath"];
// 追加の設備（空欄 = 未入力）。true / false か、{a,b} の形で複数の値
const OPTIONAL_BOOLS = ["has_kitchen", "has_shop", "has_wifi"];
const ARRAYS = {
  garbage: ["paid", "free", "take_home"],
  ac_power: ["extra_fee", "included", "none"],
  shop_items: ["gas", "firewood", "charcoal", "towel", "meal_kit", "toothbrush", "other"],
  payment_methods: ["cash", "card"],
};
const REQUIRED = ["slug", "name", "prefecture", "address", "location_type", "site_style", "fire_rule"];
const HEADER = [
  "slug", "name", "prefecture", "address", "lat", "lng", "location_type", "site_style",
  "car_access", "has_hot_water", "has_shower", "has_bath", "fire_rule", "official_url",
];
// 設備の列を足した新しいテンプレート（古いテンプレートの CSV もそのまま使える）
const HEADER_FULL = [
  ...HEADER,
  "has_kitchen", "garbage", "ac_power", "has_shop", "shop_items", "has_wifi", "payment_methods",
];
// Googleマップの Place ID の列を足した最新のテンプレート
const HEADER_LATEST = [...HEADER_FULL, "google_place_id"];
const HEADERS = [HEADER, HEADER_FULL, HEADER_LATEST].map((h) => h.join(","));

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

const file = process.argv[2];
if (!file) {
  console.error("使い方: node data/check-campsites.mjs <CSVファイル>");
  process.exit(1);
}

const [header, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
const errors = [];
if (!HEADERS.includes(header.join(","))) {
  errors.push(`1行目の見出しがテンプレートと違います\n    期待: ${HEADER_LATEST.join(",")}\n    実際: ${header.join(",")}`);
}

const slugs = new Set();
rows.forEach((cells, i) => {
  const line = i + 2;
  const r = Object.fromEntries(header.map((h, j) => [h, (cells[j] ?? "").trim()]));
  const err = (msg) => errors.push(`${line}行目 (${r.name || r.slug || "?"}): ${msg}`);

  if (cells.length !== header.length) err(`列の数が ${cells.length} 個です（${header.length} 個必要）`);
  for (const k of REQUIRED) if (!r[k]) err(`${k} が空です`);
  if (r.slug && !/^[a-z0-9-]+$/.test(r.slug)) err(`slug は英小文字・数字・ハイフンだけにしてください: "${r.slug}"`);
  if (r.slug === "new") err(`slug "new" は使えません（キャンプ場登録のページの URL と同じになるため）`);
  if (slugs.has(r.slug)) err(`slug "${r.slug}" が重複しています`);
  slugs.add(r.slug);
  for (const [k, allowed] of Object.entries(ENUMS)) {
    if (r[k] && !allowed.includes(r[k])) err(`${k} は ${allowed.join(" / ")} のどれか1つ: "${r[k]}"`);
  }
  for (const k of BOOLS) {
    if (r[k] && !["true", "false"].includes(r[k])) err(`${k} は true / false: "${r[k]}"`);
  }
  for (const k of OPTIONAL_BOOLS) {
    if (r[k] && !["true", "false"].includes(r[k])) err(`${k} は true / false か空欄: "${r[k]}"`);
  }
  for (const [k, allowed] of Object.entries(ARRAYS)) {
    if (!r[k]) continue;
    const m = /^\{([a-z_,]+)\}$/.exec(r[k]);
    const values = m ? m[1].split(",") : [];
    if (!m || values.some((v) => !allowed.includes(v)) || new Set(values).size !== values.length) {
      err(`${k} は {${allowed.join(",")}} から選んで {a,b} の形で書く（重複なし）: "${r[k]}"`);
    } else if (k === "ac_power" && values.includes("none") && values.length > 1) {
      err(`ac_power の none はほかと一緒に書けません: "${r[k]}"`);
    }
  }
  if (r.shop_items && r.has_shop !== "true") err("shop_items は has_shop が true のときだけ書けます");
  for (const [k, lo, hi] of [["lat", 20, 46], ["lng", 122, 154]]) {
    if (r[k] && !(Number(r[k]) >= lo && Number(r[k]) <= hi)) err(`${k} が日本の範囲外か数字ではありません: "${r[k]}"`);
  }
  if (r.official_url && !/^https?:\/\//.test(r.official_url)) err(`official_url は http で始めてください: "${r.official_url}"`);
  if (r.google_place_id && !/^[A-Za-z0-9_-]{10,300}$/.test(r.google_place_id)) {
    err(`google_place_id の形が正しくありません（「ChIJ」から始まる英数字）: "${r.google_place_id}"`);
  }
});

if (errors.length) {
  console.log(`NG: ${errors.length} 件の問題があります\n`);
  for (const e of errors) console.log(`  - ${e}`);
  process.exit(1);
}
console.log(`OK: ${rows.length} 件、すべて取り込める値です`);
