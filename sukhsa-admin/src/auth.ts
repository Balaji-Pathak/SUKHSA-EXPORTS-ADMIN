/**
 * Full Auth.js setup (Node.js only).
 *
 * Admins / Supervisors: Google sign-in. The verified email must be an active panel user in
 *   sukhsa_central.users, otherwise -> /auth/error?error=AccessDenied.
 * Guards: username + password (same password hashes as the old attendance app).
 *
 * The role is kept in an encrypted, httpOnly session cookie and re-checked against MongoDB
 * every 5 minutes, so removing or deactivating someone takes effect within 5 minutes.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import authConfig from "./auth.config";
import { findPanelUser, recordSignIn } from "@/lib/users";
import { guardStillActive, verifyGuard } from "@/lib/services/guards";
import type { AppRole } from "@/lib/access";

const RECHECK_MS = 5 * 60 * 1000;

declare module "next-auth" {
  interface Session {
    user: { id: string; role: AppRole; username?: string } & DefaultSession["user"];
  }
  interface User {
    role?: AppRole;
    username?: string;
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
    username?: string;
    checkedAt?: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      id: "guard",
      name: "Guard",
      credentials: { username: {}, password: {} },
      async authorize(creds) {
        const g = await verifyGuard(String(creds?.username ?? ""), String(creds?.password ?? ""));
        return g ? { id: g.id, name: g.name, email: null, role: "guard", username: g.username } : null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile }) {
      if (account?.provider === "guard") return true; // password already checked in authorize()
      if (account?.provider !== "google") return false;
      if (!profile?.email || profile.email_verified !== true) return false;
      const user = await findPanelUser(profile.email);
      if (!user) return false;
      await recordSignIn(user.email, profile.name);
      return true;
    },

    async jwt({ token, user }) {
      if (user?.role === "guard") {
        token.uid = user.id;
        token.role = "guard";
        token.username = user.username;
        token.checkedAt = Date.now();
        return token;
      }
      const stale = !token.checkedAt || Date.now() - token.checkedAt > RECHECK_MS;
      if (token.role && !stale) return token;

      if (token.role === "guard") {
        const g = token.uid ? await guardStillActive(token.uid) : null;
        if (!g) return null; // deactivated or deleted -> signed out
        token.checkedAt = Date.now();
        return token;
      }
      const panel = await findPanelUser(token.email);
      if (!panel) return null;
      token.uid = panel.id;
      token.role = panel.role;
      token.checkedAt = Date.now();
      return token;
    },
  },
});
