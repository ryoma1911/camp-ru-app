/** 読み物のページは、トップより狭い幅で読みやすくする（トップは絞り込み欄と2列のため広い） */
export default function NarrowLayout({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl">{children}</div>;
}
