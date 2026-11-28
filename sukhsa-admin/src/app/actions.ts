"use server";

import { auth, signOut } from "@/auth";

/** Sign out from any page. Guards go back to the guard login, everyone else to the welcome page. */
export async function signOutAction() {
  const session = await auth();
  await signOut({ redirectTo: session?.user?.role === "guard" ? "/login/guard" : "/" });
}
