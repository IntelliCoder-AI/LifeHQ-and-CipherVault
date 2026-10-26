import { afterEach, describe, it, expect, vi } from "vitest";
const store = vi.hoisted(() => ({ getAll: () => [], set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => store }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
describe("server-only Supabase session cookies", () => {
  it("keeps tokens HttpOnly, Secure, SameSite=Lax and scoped to the host on production sign-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "publishable-test-placeholder",
    );
    const payload = btoa(
      JSON.stringify({
        sub: "00000000-0000-4000-8000-000000000091",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.signature`,
              refresh_token: "dummy-refresh-token",
              token_type: "bearer",
              expires_in: 3600,
              user: {
                id: "00000000-0000-4000-8000-000000000091",
                email: "dummy@example.test",
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    const { supabase } = await import("../../apps/lifehq/lib/supabase");
    const db = await supabase();
    const { error } = await db.auth.signInWithPassword({
      email: "dummy@example.test",
      password: "fake-test-password-only",
    });
    expect(error).toBeNull();
    const cookies = store.set.mock.calls.filter(([, value]) => value);
    expect(cookies.length).toBeGreaterThan(0);
    for (const [, , options] of cookies) {
      expect(options).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
      expect(options.domain).toBeUndefined();
    }
  });
});
