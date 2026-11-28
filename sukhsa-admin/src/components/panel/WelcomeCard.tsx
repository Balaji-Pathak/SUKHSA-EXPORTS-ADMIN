import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { ROLE_LABEL, type PanelRole } from "@/lib/access";

export interface ModuleTile {
  icon: LucideIcon;
  title: string;
  description: string;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** First signed-in screen: greeting, role, and the modules that will appear here. */
export function WelcomeCard({
  name,
  email,
  role,
  modules,
}: {
  name?: string | null;
  email?: string | null;
  role: PanelRole;
  modules: ModuleTile[];
}) {
  const first = (name ?? email ?? "").split(/[\s@]/)[0];
  return (
    <div className="animate-rise space-y-8">
      <section className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
          <ShieldCheck className="size-3.5" />
          Signed in as {ROLE_LABEL[role]}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {greeting()}, {first}
        </h1>
        <p className="mt-2 text-ink-soft">{email}</p>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-faint">Coming next</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <div className="font-semibold text-ink">{title}</div>
              <p className="mt-1 text-sm text-ink-soft">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
