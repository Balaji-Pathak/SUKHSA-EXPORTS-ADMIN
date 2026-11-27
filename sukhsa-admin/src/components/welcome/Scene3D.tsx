"use client";

import { useRef, type PointerEvent } from "react";
import { Users, CalendarCheck, IndianRupee, Factory, LogIn, Pause, Play, LogOut } from "lucide-react";

const MODULES = [
  { icon: Users, label: "Employees" },
  { icon: CalendarCheck, label: "Attendance" },
  { icon: IndianRupee, label: "Payroll" },
  { icon: Factory, label: "Production" },
];

function Cube({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`cube ${className}`} style={style} aria-hidden="true">
      <span /><span /><span /><span /><span /><span />
    </div>
  );
}

/** Pure-CSS 3D scene: floating module board, Gate Desk card, payroll bars and export crates. Tilts with the pointer. */
export function Scene3D() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${x * 16}deg`);
    el.style.setProperty("--rx", `${-y * 12}deg`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--ry", "0deg");
    ref.current?.style.setProperty("--rx", "0deg");
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="scene relative mx-auto grid h-[440px] w-full max-w-[520px] place-items-center select-none"
      aria-hidden="true"
    >
      <div className="stage relative size-[340px]">
        {/* Base board: modules */}
        <div
          className="layer absolute inset-0 rounded-[28px] border border-glass-line bg-glass p-6 shadow-soft backdrop-blur-xl"
          style={{ transform: "translateZ(0px)" }}
        >
          <div className="mb-5 flex items-center justify-between">
            <div className="h-2.5 w-24 rounded-full bg-ink/10" />
            <div className="flex gap-1.5">
              <span className="size-2.5 rounded-full bg-brand/60" />
              <span className="size-2.5 rounded-full bg-accent/60" />
              <span className="size-2.5 rounded-full bg-ink/15" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MODULES.map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-line bg-surface p-4">
                <Icon className="mb-6 size-5 text-brand" strokeWidth={2} />
                <div className="text-sm font-semibold text-ink">{label}</div>
                <div className="mt-2 h-1.5 w-14 rounded-full bg-ink/10" />
              </div>
            ))}
          </div>
        </div>

        {/* Gate Desk card */}
        <div
          className="layer absolute -right-16 top-6 w-52 rounded-2xl border border-glass-line bg-surface p-4 shadow-soft"
          style={{ transform: "translateZ(90px)" }}
        >
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">Gate Desk</div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1.5 rounded-lg bg-brand-soft px-2 py-1.5 text-brand"><LogIn className="size-3.5" />In</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-accent-soft px-2 py-1.5 text-accent"><Pause className="size-3.5" />Pause</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1.5 text-ink-soft"><Play className="size-3.5" />Resume</span>
            <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1.5 text-ink-soft"><LogOut className="size-3.5" />Out</span>
          </div>
        </div>

        {/* Payroll bars */}
        <div
          className="layer absolute -bottom-10 -left-14 w-56 rounded-2xl border border-glass-line bg-surface p-4 shadow-soft"
          style={{ transform: "translateZ(140px)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Payroll</span>
            <IndianRupee className="size-4 text-accent" />
          </div>
          <div className="flex h-16 items-end gap-2">
            {[38, 62, 48, 80, 56, 92, 70].map((h, i) => (
              <div key={i} className={`flex-1 rounded-md ${i === 5 ? "bg-brand" : "bg-brand/25"}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>

        {/* Export crates */}
        <div className="layer absolute -left-6 -top-8" style={{ transform: "translateZ(200px)" }}>
          <div className="layer animate-float"><Cube className="teal" /></div>
        </div>
        <div className="layer absolute -right-4 bottom-10" style={{ transform: "translateZ(60px)" }}>
          <div className="layer animate-float" style={{ animationDelay: "-3s" }}>
            <Cube style={{ ["--s" as string]: "44px", animationDuration: "14s", animationDirection: "reverse" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
