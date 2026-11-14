"use client";

import { useFormStatus } from "react-dom";

/** 押すと確認してからフォームを送るボタン（削除など） */
export function ConfirmButton({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={className}
    >
      {pending ? "処理中…" : children}
    </button>
  );
}
