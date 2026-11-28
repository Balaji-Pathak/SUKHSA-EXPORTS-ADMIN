"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, User } from "lucide-react";
import { guardLogin, type GuardLoginState } from "@/app/login/actions";

export function GuardLoginForm() {
  const [state, action, pending] = useActionState<GuardLoginState, FormData>(guardLogin, { error: null });
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <label>
        <span className="mb-1.5 block text-sm font-medium text-ink">Guard username</span>
        <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <User className="size-4 shrink-0 text-ink-faint" />
          <input
            name="username"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="e.g. gate1"
            className="w-full min-w-0 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </span>
      </label>
      <label>
        <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
        <span className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
          <KeyRound className="size-4 shrink-0 text-ink-faint" />
          <input
            name="password"
            type={show ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter guard password"
            className="w-full min-w-0 bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="text-ink-faint hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </span>
      </label>
      {state.error && <div className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600" role="alert">{state.error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in to Gate Desk"}
      </button>
    </form>
  );
}
