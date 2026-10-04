import Link from "next/link";

export function Signature() {
  return (
    <footer className="pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center">
      <div className="mx-auto mb-5 h-px max-w-6xl bg-gradient-to-r from-transparent via-line to-transparent" />
      <span
        lang="cs"
        className="inline-block -rotate-3 select-none text-[22px] leading-none text-faint/70"
        style={{ fontFamily: "var(--font-script), 'Dancing Script', 'Segoe Script', cursive" }}
      >
        S.J.ŠEVC
      </span>
      <p className="mt-3 text-[11px] text-faint">
        <Link href="/feedback" className="underline-offset-4 hover:text-text hover:underline">
          Idea or bug? Tell me
        </Link>
      </p>
    </footer>
  );
}
