/**
 * Session enforcement for the authenticated shell and sensitive APIs
 * (WO-01 task 6, docs/02 §5). Verifies the HMAC-signed cookie; tampered or
 * expired cookies are rejected. Pages redirect to /login; APIs get JSON 401.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const PROTECTED_PAGES = [
  "/dashboard",
  "/approvals",
  "/crm",
  "/email",
  "/po-intake",
  "/meetings",
  "/samples",
  "/catalog",
  "/scenes",
  "/routes",
  "/submittals",
  "/settings",
  "/demo-control",
];
const PROTECTED_APIS = ["/api/agents", "/api/demo", "/api/blob", "/api/meetings", "/api/workflows", "/api/runs"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPage = PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isApi = PROTECTED_APIS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isPage && !isApi) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  if (!secret) return new NextResponse("server misconfigured", { status: 500 });
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value, secret);
  if (session) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
