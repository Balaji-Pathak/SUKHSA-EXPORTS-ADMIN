/**
 * Auth.js settings that are safe to run in middleware (no database access here).
 * The database checks live in src/auth.ts.
 */
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { ADMIN_ROLES, SUPERVISOR_ROLES, type PanelRole } from "@/lib/access";

export default {
  // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment.
  providers: [Google],
  pages: {
    signIn: "/", // not signed in -> back to the welcome page
    error: "/auth/error",
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // stay signed in for 12 hours
  callbacks: {
    /** Runs in middleware for protected paths: who may open which section. */
    authorized({ auth, request }) {
      const role = auth?.user?.role as PanelRole | undefined;
      if (!role) return false; // -> welcome page
      const path = request.nextUrl.pathname;
      const allowed =
        path.startsWith("/admin") ? ADMIN_ROLES.includes(role) :
        path.startsWith("/supervisor") ? SUPERVISOR_ROLES.includes(role) :
        true;
      return allowed ? true : Response.redirect(new URL("/dashboard", request.nextUrl));
    },
    /** What the app can read about the signed-in user. */
    session({ session, token }) {
      if (token.role) session.user.role = token.role;
      if (token.uid) session.user.id = token.uid;
      return session;
    },
  },
} satisfies NextAuthConfig;
