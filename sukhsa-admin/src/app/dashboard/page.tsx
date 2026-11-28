import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { homeFor } from "@/lib/access";

/** After sign-in everyone lands here, then goes to the dashboard for their role. */
export default async function DashboardRouter() {
  const session = await auth();
  if (!session?.user?.role) redirect("/");
  redirect(homeFor(session.user.role));
}
