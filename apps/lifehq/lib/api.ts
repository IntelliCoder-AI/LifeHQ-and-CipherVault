import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { InputError } from "@lifehq/shared/errors";
export { InputError } from "@lifehq/shared/errors";
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};
export function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    // Do not trust caller-controlled Host / X-Forwarded-Host headers.
    const target = new URL(request.url);
    if (origin === target.origin) return true;
    const source = new URL(origin);
    // Next's local server uses its wildcard bind address in Request.url.
    // Permit only loopback aliases of that same local port and protocol.
    return (
      ["0.0.0.0", "[::]"].includes(target.hostname) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname) &&
      source.origin === origin &&
      source.port === target.port &&
      source.protocol === target.protocol
    );
  } catch {
    return false;
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: privateHeaders,
  });
}
export async function body(request: Request, limit = 200_000) {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  )
    throw new InputError("Send a JSON request.", 415);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new InputError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Send a JSON request.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new InputError("Request is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new InputError("Send valid UTF-8 JSON.");
  }
}
export function failure(error: unknown) {
  if (error instanceof InputError)
    return json({ error: error.message }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`.slice(0, 250))
          .join("; "),
      },
      400,
    );
  return json(
    {
      error: "Something went wrong. Please try again.",
    },
    500,
  );
}
export function privateRedirect(destination: URL) {
  return NextResponse.redirect(destination, { headers: privateHeaders });
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
