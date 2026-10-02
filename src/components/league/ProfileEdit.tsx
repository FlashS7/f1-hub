"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogOut, Smartphone } from "lucide-react";
import { FormError, TeamPicker, api } from "./forms";

export function ProfileEdit({
  leagueId,
  nickname: initialNick,
  teamId: initialTeam,
  isOwner,
}: {
  leagueId: string;
  nickname: string;
  teamId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNick);
  const [teamId, setTeamId] = useState(initialTeam);
  const [busy, setBusy] = useState<"" | "save" | "leave" | "logout">("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const dirty = nickname !== initialNick || teamId !== initialTeam;

  const run = async (kind: "save" | "leave" | "logout", fn: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    setOk(false);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="panel p-5" aria-labelledby="edit-h">
        <h2 id="edit-h" className="display text-2xl">Edit profile</h2>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("save", async () => {
              await api(`/api/leagues/${leagueId}/me`, "PATCH", { nickname, teamId });
              setOk(true);
              router.refresh();
            });
          }}
        >
          <div>
            <label htmlFor="enick" className="eyebrow mb-2 block">Nickname</label>
            <input id="enick" className="field" minLength={2} maxLength={20} required value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <TeamPicker value={teamId} onChange={setTeamId} />
          <FormError>{error}</FormError>
          {ok && <p role="status" className="text-sm text-green">Saved.</p>}
          <button className="btn-primary" disabled={!dirty || busy !== ""}>
            {busy === "save" && <Loader2 size={16} className="animate-spin" aria-hidden />} Save changes
          </button>
        </form>
      </section>

      <section className="panel flex flex-col gap-3 p-5" aria-labelledby="acct-h">
        <h2 id="acct-h" className="display text-2xl">This device</h2>
        <button
          className="btn-ghost justify-start"
          disabled={busy !== ""}
          onClick={() =>
            run("logout", async () => {
              if (!confirm("Log out on this device? You can log back in with your nickname and PIN.")) return;
              await api(`/api/leagues/${leagueId}/logout`, "POST");
              router.push("/league");
              router.refresh();
            })
          }
        >
          <Smartphone size={16} aria-hidden /> Log out on this device
        </button>
        {isOwner ? (
          <p className="text-xs text-faint">You own this league, so you can&apos;t leave it.</p>
        ) : (
          <button
            className="btn-ghost justify-start text-red"
            disabled={busy !== ""}
            onClick={() =>
              run("leave", async () => {
                if (!confirm("Leave the league? Your profile and all your predictions will be deleted.")) return;
                await api(`/api/leagues/${leagueId}/me`, "DELETE");
                router.push("/league");
                router.refresh();
              })
            }
          >
            <LogOut size={16} aria-hidden /> Leave league
          </button>
        )}
      </section>
    </div>
  );
}
