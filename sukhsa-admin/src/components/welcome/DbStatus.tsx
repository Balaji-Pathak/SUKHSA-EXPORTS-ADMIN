import { getDb } from "@/lib/mongodb";

async function isDbOnline(): Promise<boolean> {
  try {
    const ping = getDb().then((db) => db.command({ ping: 1 }));
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500));
    await Promise.race([ping, timeout]);
    return true;
  } catch {
    return false;
  }
}

/** Small live indicator: can the server reach the central database? */
export async function DbStatus() {
  const online = await isDbOnline();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft">
      <span className="relative flex size-2">
        {online && <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />}
        <span className={`relative inline-flex size-2 rounded-full ${online ? "bg-brand" : "bg-red-500"}`} />
      </span>
      <span className="hidden sm:inline">{online ? "Central database" : "Database"}</span>
      {online ? "Online" : "Unreachable"}
    </span>
  );
}
