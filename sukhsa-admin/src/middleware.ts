/**
 * Runs before every request to a protected section. Not signed in -> welcome page.
 * Wrong role for the section -> their own dashboard. (Rules: authorized() in src/auth.config.ts)
 */
import NextAuth from "next-auth";
import authConfig from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/supervisor/:path*"],
};
