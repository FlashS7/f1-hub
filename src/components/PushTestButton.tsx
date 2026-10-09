"use client";

import { useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { api } from "./league/forms";

export function PushTestButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        className="btn-ghost !px-3 !py-1.5 text-xs"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            const r = await api<{ devices: number; ok: number }>("/api/admin/push-test", "POST");
            setMsg(`Sent to ${r.ok} of ${r.devices} device${r.devices === 1 ? "" : "s"}.`);
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <BellRing size={13} aria-hidden />} Send test to my devices
      </button>
      {msg && <span role="status" className="text-xs text-muted">{msg}</span>}
    </div>
  );
}
