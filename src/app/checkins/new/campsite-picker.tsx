"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { matchesKeyword } from "@/lib/campsite-match";
import { LOCATION_TYPE } from "@/lib/labels";

export type PickerCampsite = {
  slug: string;
  name: string;
  prefecture: string;
  address: string;
  location_type: keyof typeof LOCATION_TYPE;
};

const MAX_RESULTS = 30;

/** ソト活を投稿するキャンプ場を選ぶ。前に投稿したキャンプ場を上に出す */
export function CampsitePicker({
  campsites,
  visitedSlugs,
  prefectures,
}: {
  campsites: PickerCampsite[];
  visitedSlugs: string[];
  prefectures: string[];
}) {
  const [keyword, setKeyword] = useState("");
  const [pref, setPref] = useState("");

  const visited = useMemo(
    () => visitedSlugs.map((s) => campsites.find((c) => c.slug === s)).filter((c): c is PickerCampsite => !!c),
    [campsites, visitedSlugs],
  );
  const searching = keyword.trim() !== "" || pref !== "";
  const results = useMemo(
    () => campsites.filter((c) => (!pref || c.prefecture === pref) && matchesKeyword(keyword, c)),
    [campsites, keyword, pref],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="キャンプ場名・地名"
          aria-label="キャンプ場名・地名で探す"
          className="h-11 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3"
        />
        <select
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          aria-label="都道府県"
          className="h-11 rounded-lg border border-stone-300 bg-white px-3 sm:w-40"
        >
          <option value="">すべての都道府県</option>
          {prefectures.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {!searching && visited.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-stone-600">前に投稿したキャンプ場</h2>
          <List items={visited} />
        </section>
      )}

      {searching ? (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-stone-600">
            {results.length}件{results.length > MAX_RESULTS && `（上位${MAX_RESULTS}件を表示）`}
          </h2>
          {results.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
              見つかりません。
              <Link href="/campsites/new" className="ml-1 text-emerald-700 underline">
                キャンプ場登録
              </Link>
              から登録を申請できます。
            </p>
          ) : (
            <List items={results.slice(0, MAX_RESULTS)} />
          )}
        </section>
      ) : (
        <p className="text-sm text-stone-500">キャンプ場名・地名を入れるか、都道府県を選んでください。</p>
      )}
    </div>
  );
}

function List({ items }: { items: PickerCampsite[] }) {
  return (
    <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
      {items.map((c) => (
        <li key={c.slug}>
          <Link
            href={`/campsites/${c.slug}/checkin`}
            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="text-xs text-stone-500">
                {c.prefecture}・{LOCATION_TYPE[c.location_type]}
              </span>
            </span>
            <span aria-hidden className="shrink-0 text-stone-400">
              ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
