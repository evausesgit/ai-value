// Garde globale (convention Next 16 : proxy.ts, ex-middleware).
// - Pages : sans cookie de session → /login. La validité réelle du cookie est
//   vérifiée par l'API (un cookie expiré renvoie 401 et le client redirige).
// - Relais /api/* : on ajoute le jeton interne attendu par FastAPI.
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "aivalue_session";
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";
const PUBLIC_PAGES = ["/login", "/invitation"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Toujours écrasé : une valeur venue du navigateur ne doit jamais passer.
    const headers = new Headers(req.headers);
    headers.set("x-internal-token", INTERNAL_TOKEN);
    return NextResponse.next({ request: { headers } });
  }

  const isPublic = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname + search !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico|icon\\.svg).*)"],
};
