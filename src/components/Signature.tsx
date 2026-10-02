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
    </footer>
  );
}
