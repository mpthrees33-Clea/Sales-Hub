"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { REP } from "@/lib/rep";
import { SESSION_COOKIE, signSession } from "@/lib/session";

export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");
  if (password !== env.DEMO_LOGIN_PASSWORD) {
    return { error: "Incorrect password." };
  }
  const token = await signSession(REP.id, env.SESSION_SECRET);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 3600,
    path: "/",
  });
  try {
    await audit({ actor: `user:${REP.id}`, action: "session.login" });
  } catch {
    // pre-seed DB may not exist yet; login still works
  }
  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
