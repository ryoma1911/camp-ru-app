/** 運営が入れる Googleマップの Place ID。空なら地図リンクは座標で開く */
export function PlaceIdField({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-stone-600">
        Googleマップの Place ID
        <a
          href="https://developers.google.com/maps/documentation/places/web-service/place-id#find-id"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-emerald-700 underline"
        >
          Place ID Finder で調べる
        </a>
      </span>
      <input
        name="google_place_id"
        defaultValue={defaultValue ?? ""}
        maxLength={300}
        placeholder="ChIJ…（Googleマップに登録がなければ空のまま）"
        className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 font-mono text-sm"
      />
      <span className="block text-xs text-stone-500">
        入れると、地図リンクが施設名で開きます。空のときは座標で開きます。
      </span>
    </label>
  );
}
