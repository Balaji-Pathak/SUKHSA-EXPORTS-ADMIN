import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Info, KeyRound, User } from "lucide-react";
import { BrandLogo } from "@/components/Logo";
import { ROLES, roleBySlug } from "@/lib/roles";

export function generateStaticParams() {
  return ROLES.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ role: string }> }): Promise<Metadata> {
  const role = roleBySlug((await params).role);
  return { title: role ? `${role.title} sign in · Sukhsa Exports` : "Sign in · Sukhsa Exports" };
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.5 5.5 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.37-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  );
}

export default async function LoginPage({ params }: { params: Promise<{ role: string }> }) {
  const role = roleBySlug((await params).role);
  if (!role) notFound();
  const Icon = role.icon;

  return (
    <div className="bg-mesh relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0" />

      <div className="animate-rise relative w-full max-w-md">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-soft transition hover:text-brand">
          <ArrowLeft className="size-4" />
          Back to welcome
        </Link>

        <div className="rounded-3xl border border-line bg-surface p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex justify-center">
            <BrandLogo width={200} priority />
          </div>
          <h1 className="mb-6 flex items-center justify-center gap-2 text-xl font-bold text-ink">
            <Icon className="size-5 text-brand" />
            {role.title} sign in
          </h1>

          {role.method === "google" ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-soft">
                Sign in with your Google account. Only emails approved by a Super Admin can open the {role.title.toLowerCase()} dashboard.
              </p>
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink shadow-sm transition enabled:hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </div>
          ) : (
            <form className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Username</span>
                <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand">
                  <User className="size-4 text-ink-faint" />
                  <input name="username" autoComplete="username" disabled className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed" placeholder="gate-desk" />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
                <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand">
                  <KeyRound className="size-4 text-ink-faint" />
                  <input name="password" type="password" autoComplete="current-password" disabled className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed" placeholder="••••••••" />
                </span>
              </label>
              <button type="submit" disabled className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60">
                Sign in to Gate Desk
              </button>
            </form>
          )}

          <div className="mt-6 flex gap-2.5 rounded-xl bg-accent-soft p-3 text-xs leading-relaxed text-ink-soft">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>Sign-in is being connected to the central user list. This screen is a preview until then.</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Signing in as someone else?{" "}
          {ROLES.filter((r) => r.slug !== role.slug).map((r, i) => (
            <span key={r.slug}>
              {i > 0 && " · "}
              <Link href={`/login/${r.slug}`} className="font-medium text-ink-soft hover:text-brand">
                {r.title}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
