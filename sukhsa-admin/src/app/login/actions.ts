"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type GuardLoginState = { error: string | null };

/** Guard username + password sign-in. On success Auth.js redirects to the Gate Desk. */
export async function guardLogin(_prev: GuardLoginState, fd: FormData): Promise<GuardLoginState> {
  try {
    await signIn("guard", {
      username: String(fd.get("username") ?? ""),
      password: String(fd.get("password") ?? ""),
      redirectTo: "/gate",
    });
    return { error: null };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Wrong username or password. After 8 wrong tries the account is paused for 15 minutes." };
    }
    throw err; // the success redirect is thrown as a special error; let Next.js handle it
  }
}
