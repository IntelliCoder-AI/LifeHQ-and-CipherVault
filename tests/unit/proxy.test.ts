import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { claims, create } = vi.hoisted(() => ({
  claims: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: create }));
import { proxy } from "../../apps/lifehq/proxy";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_dummy");
  create.mockReturnValue({ auth: { getClaims: claims } });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("auth routing and session work", () => {
  it("public login, signup API and companion pages skip session work but retain CSP", async () => {
    for (const path of [
      "/login",
      "/api/auth",
      "/ciphervault",
      "/demo",
      "/api/workspace",
    ]) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`, {
          headers: { cookie: "sb-dummy-auth-token=invalid" },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Security-Policy")).toContain(
        "frame-ancestors 'none'",
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
    expect(create).not.toHaveBeenCalled();
  });
  it("protected workspace still rejects a missing verified identity", async () => {
    claims.mockResolvedValue({ data: null });
    const response = await proxy(
      new NextRequest("http://localhost:3000/workspace/projects"),
    );
    expect(claims).toHaveBeenCalledOnce();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login",
    );
  });
  it("starts production auth on the canonical origin to preserve PKCE cookies", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lifehq-three.vercel.app");
    for (const environment of ["production", "preview"]) {
      vi.stubEnv("VERCEL_ENV", environment);
      const response = await proxy(
        new NextRequest(
          "https://old-alias.example/login?notice=account-deleted",
        ),
      );
      expect(response.headers.get("location")).toBe(
        "https://lifehq-three.vercel.app/login?notice=account-deleted",
      );
    }
    expect(create).not.toHaveBeenCalled();
  });
  it("a verified session may enter the workspace", async () => {
    claims.mockResolvedValue({ data: { claims: { sub: "dummy-user" } } });
    const response = await proxy(
      new NextRequest("http://localhost:3000/workspace"),
    );
    expect(response.status).toBe(200);
    expect(claims).toHaveBeenCalledOnce();
  });
});
