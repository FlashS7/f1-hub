import type { ReactNode } from "react";
import { team } from "@/lib/teams";

export function PageTitle({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="display mt-1 text-[40px] italic sm:text-[52px]">{title}</h1>
      {children}
      <div className="racing-line mt-4" />
    </div>
  );
}

export function TeamBar({ teamId, className = "h-6" }: { teamId: string; className?: string }) {
  return <span className={`w-1 shrink-0 -skew-x-12 ${className}`} style={{ background: team(teamId).color }} aria-hidden />;
}

export function SetupNeeded() {
  return (
    <div className="panel border-l-2 border-yellow p-6">
      <p className="eyebrow">Setup</p>
      <h1 className="display mt-1 text-3xl">Database not connected</h1>
      <p className="mt-2 text-muted">
        Set <code className="font-mono text-text">SUPABASE_URL</code> and <code className="font-mono text-text">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
        in the environment, then reload.
      </p>
    </div>
  );
}
