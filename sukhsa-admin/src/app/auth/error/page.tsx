import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ShieldX, TriangleAlert } from "lucide-react";
import { BrandLogo } from "@/components/Logo";

export const metadata: Metadata = { title: "Sign-in problem · Sukhsa Exports" };

const MESSAGES: Record<string, { title: string; body: string }> = {
  AccessDenied: {
    title: "This account isn't approved",
    body: "Your Google account signed in correctly, but it isn't on the Sukhsa Exports approved user list, or it has been deactivated. Ask your Super Admin to add your email.",
  },
  Configuration: {
    title: "Sign-in is not set up correctly",
    body: "The server's sign-in settings are incomplete. Please tell the IT team.",
  },
};

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const code = (await searchParams).error ?? "";
  const msg = MESSAGES[code] ?? {
    title: "Sign-in didn't complete",
    body: "Something went wrong while signing in. Please try again.",
  };
  const Icon = code === "AccessDenied" ? ShieldX : TriangleAlert;

  return (
    <div className="bg-mesh relative grid min-h-dvh place-items-center px-4 py-10">
      <div className="bg-grid pointer-events-none absolute inset-0" />
      <div className="animate-rise relative w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-center shadow-soft sm:p-8">
        <div className="mb-6 flex justify-center">
          <BrandLogo width={180} />
        </div>
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-red-500/10 text-red-600">
          <Icon className="size-6" />
        </span>
        <h1 className="text-xl font-bold text-ink">{msg.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{msg.body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <ArrowLeft className="size-4" />
          Back to welcome
        </Link>
      </div>
    </div>
  );
}
