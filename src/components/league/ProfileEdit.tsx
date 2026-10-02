"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Smartphone, Trash2, UserX } from "lucide-react";
import { FormError, TeamPicker, api } from "./forms";

export function ProfileEdit({ nickname: initialNick, teamId: initialTeam, isAdmin }: { nickname: string; teamId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNick);
  const [teamId, setTeamId] = useState(initialTeam);
  const [busy, setBusy] = useState<"" | "save" | "delete" | "logout">("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const dirty = nickname !== initialNick || teamId !== initialTeam;

  const run = async (kind: "save" | "delete" | "logout", fn: () => Promise<void>) => {
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
              await api("/api/profile", "PATCH", { nickname, teamId });
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
        <h2 id="acct-h" className="display text-2xl">Account</h2>
        <button
          className="btn-ghost justify-start"
          disabled={busy !== ""}
          onClick={() =>
            run("logout", async () => {
              if (!confirm("Log out on this device? You can log back in with your nickname and PIN.")) return;
              await api("/api/profile/logout", "POST");
              router.push("/");
              router.refresh();
            })
          }
        >
          <Smartphone size={16} aria-hidden /> Log out on this device
        </button>
        {isAdmin ? (
          <p className="text-xs text-faint">The admin profile can&apos;t be deleted.</p>
        ) : (
          <button
            className="btn-ghost justify-start text-red"
            disabled={busy !== ""}
            onClick={() =>
              run("delete", async () => {
                if (!confirm("Delete your profile? All your picks and points are removed from every league. This can't be undone.")) return;
                await api("/api/profile", "DELETE");
                router.push("/");
                router.refresh();
              })
            }
          >
            <Trash2 size={16} aria-hidden /> Delete profile
          </button>
        )}
      </section>
    </div>
  );
}

/** Moderation for the app admin. The API re-checks admin rights. */
export function AdminControls({ profileId, nickname }: { profileId: string; nickname: string }) {
  const router = useRouter();
  const [name, setName] = useState(nickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const call = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel flex flex-col gap-3 border-l-2 border-yellow p-5" aria-labelledby="mod-h">
      <h2 id="mod-h" className="display text-2xl">Moderation</h2>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          call(async () => {
            await api(`/api/admin/profiles/${profileId}`, "PATCH", { nickname: name });
            router.refresh();
          });
        }}
      >
        <label htmlFor="mod-nick" className="sr-only">New nickname</label>
        <input id="mod-nick" className="field" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={20} />
        <button className="btn-ghost shrink-0" disabled={busy || name === nickname}>Rename</button>
      </form>
      <button
        className="btn-ghost justify-start text-red"
        disabled={busy}
        onClick={() =>
          call(async () => {
            if (!confirm(`Remove ${nickname} completely? Their profile, picks and points are deleted.`)) return;
            await api(`/api/admin/profiles/${profileId}`, "DELETE");
            router.back();
            router.refresh();
          })
        }
      >
        <UserX size={16} aria-hidden /> Remove player
      </button>
      <FormError>{error}</FormError>
    </section>
  );
}
