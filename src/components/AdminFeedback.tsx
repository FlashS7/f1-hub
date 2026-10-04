"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bug, Check, Lightbulb, RotateCcw, Trash2 } from "lucide-react";
import { api } from "./league/forms";
import { LocalTime } from "./Timezone";

export interface FeedbackItem {
  id: string;
  kind: "idea" | "bug";
  message: string;
  contact: string | null;
  page: string | null;
  user_agent: string | null;
  status: "new" | "done";
  created_at: string;
  nickname: string | null;
}

function device(ua: string | null) {
  if (!ua) return "";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : "";
  const br = /CriOS|Chrome/.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ");
}

export function AdminFeedback({ items }: { items: FeedbackItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) return <p className="py-6 text-sm text-muted">No feedback yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((f) => (
        <li key={f.id} className={`cut-sm bg-surface-2 p-4 ${f.status === "done" ? "opacity-55" : ""}`}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className={`chip cut-sm ${f.kind === "bug" ? "bg-red/20 text-text" : "bg-yellow/15 text-yellow"}`}>
              {f.kind === "bug" ? <Bug size={11} aria-hidden /> : <Lightbulb size={11} aria-hidden />} {f.kind}
            </span>
            <LocalTime iso={f.created_at} opts={{ day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }} />
            {f.nickname && <span>· {f.nickname}</span>}
            {f.page && <span className="font-mono">· {f.page}</span>}
            {f.user_agent && <span>· {device(f.user_agent)}</span>}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{f.message}</p>
          {f.contact && <p className="mt-2 text-xs text-muted">Contact: <span className="text-text">{f.contact}</span></p>}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-ghost !px-3 !py-1.5 text-xs"
              disabled={busy === f.id}
              onClick={() => act(f.id, () => api(`/api/admin/feedback/${f.id}`, "PATCH", { status: f.status === "done" ? "new" : "done" }))}
            >
              {f.status === "done" ? <RotateCcw size={13} aria-hidden /> : <Check size={13} aria-hidden />}
              {f.status === "done" ? "Reopen" : "Done"}
            </button>
            <button
              className="btn-ghost !px-3 !py-1.5 text-xs text-red"
              disabled={busy === f.id}
              onClick={() => confirm("Delete this message?") && act(f.id, () => api(`/api/admin/feedback/${f.id}`, "DELETE"))}
            >
              <Trash2 size={13} aria-hidden /> Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
