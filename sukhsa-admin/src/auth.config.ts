/**
 * Auth.js settings that are safe to run in middleware (no database access here).
 * The database checks live in src/auth.ts.
 */
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { ADMIN_ROLES, CEO_ROLES, GATE_ROLES, SUPERVISOR_ROLES, homeFor, type AppRole } from "@/lib/access";

export default {
  // Google (Admins / Supervisors). Guard username+password is added in src/auth.ts.
  providers: [Google],
  pages: {
    signIn: "/", // not signed in -> back to the welcome page
    error: "/auth/error",
  },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // stay signed in for 12 hours
  callbacks: {
    /** Runs in middleware for protected paths: who may open which section. */
    authorized({ auth, request }) {
      const role = auth?.user?.role as AppRole | undefined;
      const path = request.nextUrl.pathname;
      if (!role) {
        // The Gate Desk has its own login page; everything else goes to the welcome page.
        return path.startsWith("/gate") ? Response.redirect(new URL("/login/guard", request.nextUrl)) : false;
      }
      const allowed =
        path.startsWith("/ceo") ? CEO_ROLES.includes(role) :
        path.startsWith("/admin") ? ADMIN_ROLES.includes(role) :
        path.startsWith("/supervisor") ? SUPERVISOR_ROLES.includes(role) :
        path.startsWith("/gate") ? GATE_ROLES.includes(role) :
        true;
      return allowed ? true : Response.redirect(new URL(homeFor(role), request.nextUrl));
    },
    /** What the app can read about the signed-in user. */
    session({ session, token }) {
      if (token.role) session.user.role = token.role;
      if (token.uid) session.user.id = token.uid;
      if (token.username) session.user.username = token.username;
      return session;
    },
  },
} satisfies NextAuthConfig;
