"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Trophy } from "lucide-react";

const NAV = [
  { href: "/", label: "Hub", icon: Gauge, match: (p: string) => p === "/" },
  { href: "/league", label: "League", icon: Trophy, match: (p: string) => p.startsWith("/league") || p.startsWith("/join") },
];

export function Mark({ className = "" }: { className?: string }) {
  // Original mark: three raked speed bars.
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden>
      <path d="M10 2h28l-6 6H4z" fill="var(--red)" />
      <path d="M8 10h20l-6 6H2z" fill="currentColor" opacity=".9" />
      <path d="M6 18h10l-6 6H0z" fill="currentColor" opacity=".55" />
    </svg>
  );
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" title="Home">
          <Mark className="h-5 w-auto text-text transition-transform duration-200 group-hover:translate-x-0.5" />
          <span className="display text-[26px] italic tracking-tight">
            F1<span className="text-red">/</span>HUB
          </span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon, match }) => {
              const active = match(path);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`cut-sm relative flex items-center gap-2 px-3 py-2 text-[15px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface hover:text-text"
                    }`}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    <Icon size={16} strokeWidth={2.4} className={active ? "text-red" : ""} aria-hidden />
                    {label}
                    {active && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-red" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
