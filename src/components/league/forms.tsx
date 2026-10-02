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

export function PinInput({ value, onChange, id = "pin", hint = true }: { value: string; onChange: (v: string) => void; id?: string; hint?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow mb-2 block">
        4-digit PIN
      </label>
      <input
        id={id}
        className="field font-mono text-2xl tracking-[0.6em]"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        pattern="\d{4}"
        maxLength={4}
        required
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        placeholder="••••"
      />
      {hint && <p className="mt-1.5 text-xs text-faint">Only needed to log in on another device. There&apos;s no reset, so remember it.</p>}
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

export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (e: FormEvent | null, fn: () => Promise<void>) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

/**
 * Shown only when an action needs a profile (making a pick, creating/joining a league).
 * New players fill three fields once; returning players log in with nickname + PIN.
 * With `joinLeagueId`, the device also joins that league once logged in and goes there.
 */
export function ProfileGate({
  title,
  subtitle,
  joinLeagueId,
  submitLabel = "Let's go",
}: {
  title: string;
  subtitle?: ReactNode;
  joinLeagueId?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"new" | "back">("new");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [teamId, setTeamId] = useState("");
  const { busy, error, run } = useSubmit();

  const done = async () => {
    if (joinLeagueId) {
      await api(`/api/leagues/${joinLeagueId}/join`, "POST");
      router.push(`/league/${joinLeagueId}?welcome=1`);
    }
    router.refresh();
  };

  return (
    <section className="panel mx-auto w-full max-w-xl p-5" aria-labelledby="gate-h">
      <h2 id="gate-h" className="display text-2xl italic">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="racing-line my-4" />
      {tab === "new" ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) =>
            run(e, async () => {
              await api("/api/profile", "POST", { nickname, pin, teamId });
              await done();
            })
          }
        >
          <div>
            <label htmlFor="g-nick" className="eyebrow mb-2 block">Nickname</label>
            <input id="g-nick" className="field" required minLength={2} maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" />
          </div>
          <PinInput value={pin} onChange={setPin} id="g-pin" />
          <TeamPicker value={teamId} onChange={setTeamId} />
          <FormError>{error}</FormError>
          <Submit busy={busy} disabled={!teamId || pin.length !== 4}>{submitLabel}</Submit>
          <p className="text-center text-sm text-muted">
            Already playing?{" "}
            <button type="button" className="font-semibold text-text underline underline-offset-4" onClick={() => setTab("back")}>
              Log in with your PIN
            </button>
          </p>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) =>
            run(e, async () => {
              await api("/api/profile/login", "POST", { nickname, pin });
              await done();
            })
          }
        >
          <div>
            <label htmlFor="g-lnick" className="eyebrow mb-2 block">Nickname</label>
            <input id="g-lnick" className="field" required value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <PinInput value={pin} onChange={setPin} id="g-lpin" hint={false} />
          <FormError>{error}</FormError>
          <Submit busy={busy} disabled={pin.length !== 4}>Log in</Submit>
          <p className="text-center text-sm text-muted">
            New here?{" "}
            <button type="button" className="font-semibold text-text underline underline-offset-4" onClick={() => setTab("new")}>
              Create a profile
            </button>
          </p>
        </form>
      )}
    </section>
  );
}

export function CreateLeagueForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) =>
        run(e, async () => {
          const r = await api<{ leagueId: string }>("/api/leagues", "POST", { name });
          router.push(`/league/${r.leagueId}?welcome=1`);
        })
      }
    >
      <label htmlFor="lname" className="sr-only">League name</label>
      <div className="flex gap-2">
        <input id="lname" className="field" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="League name, e.g. Sunday Pit Wall" />
        <button className="btn-primary shrink-0" disabled={busy || !name.trim()}>
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Create
        </button>
      </div>
      <FormError>{error}</FormError>
    </form>
  );
}

export function JoinLeagueButton({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const { busy, error, run } = useSubmit();
  return (
    <div className="flex flex-col gap-3">
      <button
        className="btn-primary w-full"
        disabled={busy}
        onClick={() =>
          run(null, async () => {
            await api(`/api/leagues/${leagueId}/join`, "POST");
            router.push(`/league/${leagueId}?welcome=1`);
            router.refresh();
          })
        }
      >
        {busy && <Loader2 size={16} className="animate-spin" aria-hidden />} Join league
      </button>
      <FormError>{error}</FormError>
    </div>
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
