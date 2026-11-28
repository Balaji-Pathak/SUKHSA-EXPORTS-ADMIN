/**
 * Full Auth.js setup (Node.js only): Google sign-in + the approved-user check in MongoDB.
 *
 * Flow
 *  1. "Continue with Google" -> Google confirms who the person is.
 *  2. signIn(): the email must be verified by Google AND be an active panel user in
 *     sukhsa_central.users. Otherwise -> /auth/error?error=AccessDenied.
 *  3. jwt(): the role is stored in an encrypted, httpOnly session cookie and re-checked
 *     against MongoDB every 5 minutes, so removing or deactivating a user takes effect
 *     within 5 minutes without waiting for the 12-hour session to end.
 */
import NextAuth, { type DefaultSession } from "next-auth";
import authConfig from "./auth.config";
import { findPanelUser, recordSignIn } from "@/lib/users";
import type { PanelRole } from "@/lib/access";

const RECHECK_MS = 5 * 60 * 1000;

declare module "next-auth" {
  interface Session {
    user: { id: string; role: PanelRole } & DefaultSession["user"];
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    uid?: string;
    role?: PanelRole;
    checkedAt?: number;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;
      if (!profile?.email || profile.email_verified !== true) return false;
      const user = await findPanelUser(profile.email);
      if (!user) return false;
      await recordSignIn(user.email, profile.name);
      return true;
    },

    async jwt({ token }) {
      const stale = !token.checkedAt || Date.now() - token.checkedAt > RECHECK_MS;
      if (token.role && !stale) return token;

      const user = await findPanelUser(token.email);
      if (!user) return null; // removed or deactivated -> signed out
      token.uid = user.id;
      token.role = user.role;
      token.checkedAt = Date.now();
      return token;
    },
  },
});
