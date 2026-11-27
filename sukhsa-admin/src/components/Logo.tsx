/** Sukhsa Export monogram: an "S" folded like an export crate. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="11" className="fill-brand" />
      <path
        d="M27 13.5c-1.6-1.7-4-2.5-6.8-2.5-4 0-6.7 2-6.7 5 0 6.4 13.5 3.6 13.5 9.6 0 3-2.9 5.4-7.1 5.4-3 0-5.5-1-7.2-2.9"
        fill="none"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="29.5" cy="29.5" r="2.6" className="fill-accent" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-ink">Sukhsa Export</div>
        <div className="text-xs font-medium text-ink-faint">Admin & ERP</div>
      </div>
    </div>
  );
}
