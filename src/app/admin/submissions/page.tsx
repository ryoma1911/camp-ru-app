import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { requireAdmin } from "@/lib/admin";
import { isSimilarName } from "@/lib/campsite-match";
import { getCampsites } from "@/lib/campsites";
import { FIRE_RULE, LOCATION_TYPE, SITE_STYLE } from "@/lib/labels";
import { rejectSubmission, approveSubmission } from "./actions";
import { ApproveForm, type SubmissionDraft } from "./approve-form";

export const metadata = { title: "キャンプ場登録の申請", robots: { index: false } };

type Props = PageProps<"/admin/submissions">;
type Status = "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<Status, string> = { pending: "確認待ち", approved: "公開", rejected: "見送り" };
const REJECT_LABEL = { duplicate: "登録済み", not_campsite: "キャンプ場ではない", insufficient: "情報が足りない" } as const;
const FACILITY_LABEL = { car_access: "車乗り入れ", has_hot_water: "炊事場お湯", has_shower: "シャワー", has_bath: "風呂" } as const;

type Submission = SubmissionDraft & {
  id: string;
  status: Status;
  note: string | null;
  postal_code: string | null;
  reject_reason: keyof typeof REJECT_LABEL | null;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles: { display_name: string } | null;
  campsites: { slug: string; name: string } | null;
};

const date = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric" }).format(new Date(iso));

export default function SubmissionsPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-sm text-stone-500">読み込み中…</p>}>
      <SubmissionsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SubmissionsContent({ searchParams }: Pick<Props, "searchParams">) {
  const supabase = await requireAdmin();
  const params = await searchParams;
  const status: Status =
    params.status === "approved" || params.status === "rejected" ? params.status : "pending";
  const selectedId = typeof params.id === "string" && /^[0-9a-f-]{36}$/.test(params.id) ? params.id : null;

  const count = (s: Status) =>
    supabase.from("campsite_submissions").select("id", { count: "exact", head: true }).eq("status", s);
  const [{ data: list }, pending, approved, rejected, selected, campsites] = await Promise.all([
    supabase
      .from("campsite_submissions")
      .select("id, name, prefecture, created_at")
      .eq("status", status)
      // 確認待ちは古い順（待たせている順）、それ以外は新しい順
      .order("created_at", { ascending: status === "pending" })
      .limit(100),
    count("pending"),
    count("approved"),
    count("rejected"),
    selectedId
      ? supabase
          .from("campsite_submissions")
          .select("*, profiles(display_name), campsites(slug, name)")
          .eq("id", selectedId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getCampsites(),
  ]);
  const counts = { pending: pending.count ?? 0, approved: approved.count ?? 0, rejected: rejected.count ?? 0 };
  const submission = selected.data as Submission | null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin" className="text-sm text-emerald-700 underline">
          ← 管理
        </Link>
        <h1 className="mt-2 text-2xl font-bold">キャンプ場登録の申請</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* スマホでは、詳細を開いているあいだ一覧を隠す */}
        <section className={`space-y-3 ${submission ? "hidden lg:block" : ""}`}>
          <nav className="flex gap-2 text-sm" aria-label="状態で切り替え">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <Link
                key={s}
                href={`/admin/submissions?status=${s}`}
                aria-current={s === status ? "page" : undefined}
                className={`rounded-full px-3 py-1 ${s === status ? "bg-emerald-700 text-white" : "border border-stone-300 bg-white"}`}
              >
                {STATUS_LABEL[s]} {counts[s]}
              </Link>
            ))}
          </nav>
          {(list ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 p-6 text-sm text-stone-600">
              {STATUS_LABEL[status]}の申請はありません。
            </p>
          ) : (
            <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {(list ?? []).map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/admin/submissions?status=${status}&id=${s.id}`}
                    aria-current={s.id === selectedId ? "true" : undefined}
                    className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50 ${s.id === selectedId ? "bg-emerald-50" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.name}</span>
                      <span className="text-xs text-stone-500">
                        {s.prefecture}・{date(s.created_at)}
                      </span>
                    </span>
                    <span aria-hidden className="shrink-0 text-stone-400 lg:hidden">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {submission ? (
          <Detail submission={submission} status={status} campsites={campsites} />
        ) : (
          <p className="hidden rounded-lg border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500 lg:block">
            左の一覧から申請を選んでください。
          </p>
        )}
      </div>
    </div>
  );
}

function Detail({
  submission: s,
  status,
  campsites,
}: {
  submission: Submission;
  status: Status;
  campsites: { slug: string; name: string; prefecture: string }[];
}) {
  const similar = campsites
    .filter((c) => isSimilarName(s.name, c.name))
    .sort((a, b) => Number(b.prefecture === s.prefecture) - Number(a.prefecture === s.prefecture))
    .slice(0, 5);
  const facilities = (Object.keys(FACILITY_LABEL) as (keyof typeof FACILITY_LABEL)[])
    .filter((k) => s[k])
    .map((k) => FACILITY_LABEL[k]);
  const unknown = "わからない";

  return (
    <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <Link href={`/admin/submissions?status=${status}`} className="text-sm text-emerald-700 underline lg:hidden">
        ← 一覧
      </Link>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">{s.name}</h2>
        <span className="text-xs text-stone-500">
          {STATUS_LABEL[s.status]}・{date(s.created_at)} 申請・{s.profiles?.display_name ?? "キャンパー"}
        </span>
      </div>

      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-stone-500">住所</dt>
        <dd>
          {s.postal_code && <span className="mr-2 text-stone-500">〒{s.postal_code.slice(0, 3)}-{s.postal_code.slice(3)}</span>}
          {s.address}
        </dd>
        <dt className="text-stone-500">公式サイト</dt>
        <dd className="truncate">
          {s.official_url ? (
            <a href={s.official_url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">
              {s.official_url}
            </a>
          ) : (
            "なし"
          )}
        </dd>
        <dt className="text-stone-500">種類・サイト・焚き火</dt>
        <dd>
          {[
            s.location_type ? LOCATION_TYPE[s.location_type as keyof typeof LOCATION_TYPE] : unknown,
            s.site_style ? SITE_STYLE[s.site_style as keyof typeof SITE_STYLE] : unknown,
            s.fire_rule ? FIRE_RULE[s.fire_rule as keyof typeof FIRE_RULE] : unknown,
          ].join("・")}
        </dd>
        <dt className="text-stone-500">設備（あり）</dt>
        <dd>{facilities.length ? facilities.join("・") : "なし（わからない）"}</dd>
        <dt className="text-stone-500">ひとこと</dt>
        <dd className="whitespace-pre-wrap">{s.note ?? "なし"}</dd>
      </dl>

      <div
        className={`rounded-lg p-3 text-sm ${similar.length ? "border border-amber-300 bg-amber-50 text-amber-900" : "bg-stone-50 text-stone-600"}`}
      >
        <p className="font-medium">似ている登録済みのキャンプ場</p>
        {similar.length === 0 ? (
          <p>なし</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {similar.map((c) => (
              <li key={c.slug}>
                <Link href={`/campsites/${c.slug}`} target="_blank" className="underline">
                  {c.name}（{c.prefecture}）
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {s.status === "pending" && (
        <>
          <ApproveForm draft={s} action={approveSubmission.bind(null, s.id)} />
          <form action={rejectSubmission.bind(null, s.id)} className="space-y-3 rounded-xl border border-stone-200 p-4">
            <h3 className="font-bold">見送る</h3>
            <p className="text-xs text-stone-500">申請者には知らせません。理由は運営のメモとして残ります。</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(REJECT_LABEL).map(([value, label]) => (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="reject_reason"
                    value={value}
                    required
                    defaultChecked={value === "duplicate" && similar.length > 0}
                    className="peer sr-only"
                  />
                  <span className="inline-flex min-h-10 items-center rounded-full border border-stone-300 px-4 text-sm peer-checked:border-red-700 peer-checked:bg-red-700 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-red-400">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <input
              name="admin_note"
              maxLength={500}
              placeholder="メモ（任意）"
              aria-label="運営のメモ"
              className="h-10 w-full rounded-lg border border-stone-300 px-3 text-sm"
            />
            <ConfirmButton
              message="この申請を見送りますか？"
              className="h-11 w-full rounded-full border border-red-300 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 sm:ml-auto sm:block sm:w-auto sm:px-8"
            >
              見送る
            </ConfirmButton>
          </form>
        </>
      )}

      {s.status === "approved" && (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {s.reviewed_at && `${date(s.reviewed_at)} に`}公開しました。
          {s.campsites && (
            <Link href={`/campsites/${s.campsites.slug}`} className="ml-1 underline">
              {s.campsites.name}のページを見る
            </Link>
          )}
          {s.campsites && (
            <span className="mt-1 block font-mono text-xs">URL：/campsites/{s.campsites.slug}</span>
          )}
          {s.admin_note && <span className="mt-1 block text-xs">メモ：{s.admin_note}</span>}
        </p>
      )}

      {s.status === "rejected" && (
        <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
          {s.reviewed_at && `${date(s.reviewed_at)} に`}見送りました（
          {s.reject_reason ? REJECT_LABEL[s.reject_reason] : "理由なし"}）。
          {s.admin_note && <span className="mt-1 block text-xs">メモ：{s.admin_note}</span>}
        </p>
      )}
    </section>
  );
}
