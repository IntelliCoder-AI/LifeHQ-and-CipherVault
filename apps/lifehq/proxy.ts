import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "./lib/auth-cookies";
export async function proxy(request: NextRequest) {
  // Keep PKCE verifier cookies and email callbacks on the same public origin.
  if (
    ["production", "preview"].includes(process.env.VERCEL_ENV || "") &&
    process.env.NEXT_PUBLIC_APP_URL &&
    request.method === "GET" &&
    ["/login", "/reset"].includes(request.nextUrl.pathname)
  ) {
    const canonical = new URL(process.env.NEXT_PUBLIC_APP_URL);
    if (canonical.origin !== request.nextUrl.origin) {
      const destination = new URL(
        request.nextUrl.pathname + request.nextUrl.search,
        canonical.origin,
      );
      const redirect = NextResponse.redirect(destination);
      redirect.headers.set("Cache-Control", "private, no-store");
      return redirect;
    }
  }
  const nonce = btoa(crypto.randomUUID());
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  headers.set("Content-Security-Policy", csp);
  let response = NextResponse.next({ request: { headers } });
  if (
    supabaseUrl &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    (request.nextUrl.pathname === "/workspace" ||
      request.nextUrl.pathname.startsWith("/workspace/"))
  ) {
    const db = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions: authCookieOptions,
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(values, cacheHeaders) {
            values.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            headers.set("cookie", request.cookies.toString());
            response = NextResponse.next({ request: { headers } });
            values.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
            Object.entries(cacheHeaders || {}).forEach(([key, value]) =>
              response.headers.set(key, value),
            );
          },
        },
      },
    );
    const { data } = await db.auth.getClaims();
    if (!data?.claims && request.nextUrl.pathname.startsWith("/workspace")) {
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      response.cookies
        .getAll()
        .forEach((cookie) => redirect.cookies.set(cookie));
      response = redirect;
    }
  }
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|woff2?)$).*)",
  ],
};
