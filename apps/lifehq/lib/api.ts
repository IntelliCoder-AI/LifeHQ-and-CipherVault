import { NextResponse } from "next/server";
import { ZodError } from "zod";
export function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin),
      url = new URL(request.url);
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      url.host;
    return source.host === host && source.protocol === url.protocol;
  } catch {
    return false;
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 200000) throw new Error("Request is too large");
  return JSON.parse(raw);
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      400,
    );
  return json(
    {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    },
    400,
  );
}

export function appOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const url = new URL(configured || new URL(request.url).origin);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" &&
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("Configure a valid public application origin.");
  return url.origin;
}
