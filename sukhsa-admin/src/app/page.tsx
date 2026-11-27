import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Scene3D } from "@/components/welcome/Scene3D";
import { DbStatus } from "@/components/welcome/DbStatus";
import { ROLES, type RoleInfo } from "@/lib/roles";

export const dynamic = "force-dynamic";

const TONES: Record<RoleInfo["tone"], string> = {
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-soft text-accent",
  ink: "bg-surface-2 text-ink",
};

function RoleCard({ role, index }: { role: RoleInfo; index: number }) {
  const Icon = role.icon;
  return (
    <Link
      href={`/login/${role.slug}`}
      className="animate-rise group relative flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-soft outline-none transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-brand sm:p-5"
      style={{ animationDelay: `${150 + index * 90}ms` }}
    >
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${TONES[role.tone]}`}>
        <Icon className="size-6" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-bold text-ink">Login as {role.title}</span>
          <span className="text-xs font-medium text-ink-faint">{role.subtitle}</span>
        </span>
        <span className="mt-0.5 block text-sm text-ink-soft">{role.description}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 text-ink-faint transition group-hover:translate-x-1 group-hover:text-brand" />
    </Link>
  );
}

export default function Welcome() {
  return (
    <div className="bg-mesh relative min-h-dvh overflow-hidden">
      <div className="bg-grid pointer-events-none absolute inset-0" />

      <div className="relative mx-auto flex min-h-dvh max-w-7xl flex-col px-4 sm:px-8">
        <header className="flex items-center justify-between gap-4 py-6">
          <Logo priority />
          <DbStatus />
        </header>

        <main className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
          <section className="max-w-xl">
            <p className="animate-rise mb-5 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
              <span className="size-1.5 rounded-full bg-brand" />
              admin.sukhsa.in
            </p>
            <h1
              className="animate-rise text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[56px]"
              style={{ animationDelay: "60ms" }}
            >
              Welcome to the
              <br />
              <span className="text-brand">Sukhsa Exports</span> Admin Panel
            </h1>
            <p className="animate-rise mt-5 max-w-lg text-base leading-relaxed text-ink-soft sm:text-lg" style={{ animationDelay: "100ms" }}>
              One company-owned place for employees, attendance, payroll and production. Choose how you want to sign in.
            </p>

            <div className="mt-8 grid gap-3">
              {ROLES.map((r, i) => (
                <RoleCard key={r.slug} role={r} index={i} />
              ))}
            </div>

            <p className="mt-6 flex items-center gap-2 text-xs text-ink-faint">
              <Lock className="size-3.5" />
              Access is limited to approved Sukhsa Exports staff. Every sign-in is checked against the central user list.
            </p>
          </section>

          <section className="hidden md:block">
            <Scene3D />
          </section>
        </main>

        <footer className="flex flex-col gap-2 border-t border-line py-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Sukhsa Exports. Company-owned system.</span>
          <span>Need access? Contact your Super Admin.</span>
        </footer>
      </div>
    </div>
  );
}
