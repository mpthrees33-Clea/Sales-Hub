/** Server-side session helpers for actions and route handlers. */
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { REP } from "@/lib/rep";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function getSession(): Promise<{ userId: string } | null> {
  const jar = await cookies();
  const payload = await verifySession(jar.get(SESSION_COOKIE)?.value, env.SESSION_SECRET);
  return payload ? { userId: payload.sub } : null;
}

/** Throws for unauthenticated server actions/handlers (401 at the boundary). */
export async function requireSession(): Promise<{ userId: string }> {
  const s = await getSession();
  if (!s) throw new Error("unauthenticated");
  if (s.userId !== REP.id) throw new Error("unknown session subject");
  return s;
}
