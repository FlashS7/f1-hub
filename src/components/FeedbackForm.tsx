"use client";

import { useState } from "react";
import { Bug, Check, Lightbulb } from "lucide-react";
import { FormError, Submit, api, useSubmit } from "./league/forms";

export function FeedbackForm() {
  const [kind, setKind] = useState<"idea" | "bug">("idea");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [sent, setSent] = useState(false);
  const { busy, error, run } = useSubmit();

  if (sent) {
    return (
      <div role="status" className="panel flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-green/15 text-green">
          <Check size={24} strokeWidth={3} aria-hidden />
        </span>
        <p className="display text-2xl italic">Thanks, got it</p>
        <p className="text-sm text-muted">Every message gets read.</p>
      </div>
    );
  }

  return (
    <form
      className="panel flex flex-col gap-4 p-5"
      onSubmit={(e) =>
        run(e, async () => {
          // Where they came from, so a bug can be reproduced. Only same-site paths.
          let page: string | null = null;
          try {
            const ref = new URL(document.referrer);
            if (ref.origin === location.origin) page = ref.pathname;
          } catch {}
          await api("/api/feedback", "POST", { kind, message, contact, page, website });
          setSent(true);
        })
      }
    >
      <fieldset>
        <legend className="eyebrow mb-2">What is it?</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              ["idea", "Idea", Lightbulb],
              ["bug", "Bug", Bug],
            ] as const
          ).map(([v, label, Icon]) => (
            <label
              key={v}
              className={`cut-sm flex cursor-pointer items-center justify-center gap-2 py-3 font-bold uppercase tracking-[0.12em] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 ${
                kind === v ? "bg-accent text-[var(--accent-ink)]" : "bg-surface-2 text-muted hover:text-text"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />
              <Icon size={16} aria-hidden /> {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="fb-msg" className="eyebrow mb-2 block">
          {kind === "bug" ? "What went wrong?" : "Your idea"}
        </label>
        <textarea
          id="fb-msg"
          className="field min-h-36 resize-y"
          required
          minLength={3}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind === "bug" ? "What did you do, what did you expect, what happened instead?" : "What would make F1 HUB better?"}
        />
        <p className="mt-1 text-right font-mono text-[11px] text-faint">{message.length}/2000</p>
      </div>
      <div>
        <label htmlFor="fb-contact" className="eyebrow mb-2 block">
          Contact <span className="normal-case tracking-normal text-faint">(optional, if you want a reply)</span>
        </label>
        <input id="fb-contact" className="field" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email, Instagram, TikTok…" />
      </div>
      {/* Honeypot for bots: hidden from people and screen readers. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <FormError>{error}</FormError>
      <Submit busy={busy} disabled={message.trim().length < 3}>Send</Submit>
    </form>
  );
}
