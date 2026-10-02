"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { inkOn } from "@/lib/accent";
import { TEAMS } from "@/lib/teams";

export async function api<T = Record<string, unknown>>(url: string, method: string, data?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Request failed (${res.status})`);
  return j as T;
}

export function TeamPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-2">Favourite team</legend>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {Object.values(TEAMS).map((t) => {
          const on = value === t.id;
          return (
            <label
              key={t.id}
              className={`cut-sm relative flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm font-semibold transition-all has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 ${
                on ? "scale-[1.02]" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-text"
              }`}
              style={on ? { background: t.color, color: inkOn(t.color) } : undefined}
            >
              <input type="radio" name="team" value={t.id} checked={on} onChange={() => onChange(t.id)} className="sr-only" />
              <span className="h-5 w-1 -skew-x-12" style={{ background: on ? "currentColor" : t.color }} aria-hidden />
              <span className="flex-1 truncate">{t.name}</span>
              {on && <Check size={15} strokeWidth={3} aria-hidden />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function PinInput({ value, onChange, id = "pin" }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block">
        4-digit PIN
      </label>
      <input
        id={id}
        className="field font-mono text-2xl tracking-[0.6em]"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4}"
        maxLength={4}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="••••"
      />
      <p className="mt-1.5 text-xs text-faint">You need it to log in on another device. There&apos;s no reset, so remember it.</p>
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="border-l-2 border-red bg-red/10 px-3 py-2 text-sm">
      {children}
    </p>
  );
}

export function Submit({ busy, children, disabled }: { busy: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="submit" className="btn-primary w-full" disabled={busy || disabled}>
      {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (e: FormEvent, fn: () => Promise<void>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        run(e, async () => {
          const r = await api<{ leagueId: string }>("/api/leagues", "POST", { name, nickname, pin, teamId });
          router.push(`/league/${r.leagueId}?welcome=1`);
        })
      }
    >
      <div>
        <label htmlFor="lname" className="eyebrow mb-2 block">League name</label>
        <input id="lname" className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Pit Wall" />
      </div>
      <div>
        <label htmlFor="nick" className="eyebrow mb-2 block">Your nickname</label>
        <input id="nick" className="field" required minLength={2} maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" />
      </div>
      <PinInput value={pin} onChange={setPin} />
      <TeamPicker value={teamId} onChange={setTeamId} />
      <FormError>{error}</FormError>
      <Submit busy={busy} disabled={!teamId || pin.length !== 4}>Create league</Submit>
    </form>
  );
}

export function JoinForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        run(e, async () => {
          await api(`/api/leagues/${leagueId}/join`, "POST", { nickname, pin, teamId });
          router.push(`/league/${leagueId}?welcome=1`);
        })
      }
    >
      <div>
        <label htmlFor="jnick" className="eyebrow mb-2 block">Nickname</label>
        <input id="jnick" className="field" required minLength={2} maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />
      </div>
      <PinInput value={pin} onChange={setPin} id="jpin" />
      <TeamPicker value={teamId} onChange={setTeamId} />
      <FormError>{error}</FormError>
      <Submit busy={busy} disabled={!teamId || pin.length !== 4}>Join league</Submit>
    </form>
  );
}

export function ClaimForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        run(e, async () => {
          await api(`/api/leagues/${leagueId}/claim`, "POST", { nickname, pin });
          router.push(`/league/${leagueId}`);
          router.refresh();
        })
      }
    >
      <div>
        <label htmlFor="cnick" className="eyebrow mb-2 block">Nickname</label>
        <input id="cnick" className="field" required value={nickname} onChange={(e) => setNickname(e.target.value)} />
      </div>
      <PinInput value={pin} onChange={setPin} id="cpin" />
      <FormError>{error}</FormError>
      <Submit busy={busy} disabled={pin.length !== 4}>Log in</Submit>
    </form>
  );
}

export function CodeJump() {
  const router = useRouter();
  const [code, setCode] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) router.push(`/join/${code}`);
      }}
    >
      <label htmlFor="code" className="sr-only">Invite code</label>
      <input
        id="code"
        className="field font-mono uppercase tracking-[0.35em]"
        placeholder="CODE"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
      />
      <button className="btn-ghost shrink-0" disabled={code.length !== 6}>Go</button>
    </form>
  );
}
