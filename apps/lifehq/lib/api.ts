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
  return process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}
