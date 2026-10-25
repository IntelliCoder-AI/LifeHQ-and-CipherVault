import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  getClaims: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
vi.mock("../../apps/lifehq/lib/supabase", () => ({
  supabase: async () => ({ auth: mock, rpc: mock.rpc }),
}));
import { POST } from "../../apps/lifehq/app/api/auth/route";
import { GET } from "../../apps/lifehq/app/auth/callback/route";
import { appOrigin } from "../../apps/lifehq/lib/api";
const live = "https://lifehq-three.vercel.app";
function request(body: object) {
  return new Request("https://preview.example.test/api/auth", {
    method: "POST",
    headers: {
      Origin: "https://preview.example.test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", live);
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "private-preview.vercel.app");
  mock.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mock.signInWithPassword.mockResolvedValue({ error: null });
  mock.resend.mockResolvedValue({ error: null });
  mock.resetPasswordForEmail.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("public auth URLs and feedback", () => {
  it("uses the configured public origin for signup, recovery and resend even from a preview", async () => {
    const password = "dummy-password-only";
    await POST(
      request({
        action: "signup",
        email: "dummy@example.test",
        password,
        confirmPassword: password,
      }),
    );
    expect(mock.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${live}/auth/callback`,
    );
    await POST(request({ action: "reset", email: "dummy@example.test" }));
    expect(mock.resetPasswordForEmail).toHaveBeenCalledWith(
      "dummy@example.test",
      { redirectTo: `${live}/auth/callback?next=/reset` },
    );
    await POST(request({ action: "resend", email: "dummy@example.test" }));
    expect(mock.resend.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${live}/auth/callback`,
    );
  });
  it("keeps invalid-login feedback useful without revealing whether an account exists", async () => {
    mock.signInWithPassword.mockResolvedValue({
      error: {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      },
    });
    const response = await POST(
      request({
        action: "login",
        email: "dummy@example.test",
        password: "dummy-password-only",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain(
      "If you deleted your account, create a new one",
    );
  });
  it("expired callbacks stay on the public domain and reject arbitrary next URLs", async () => {
    const response = await GET(
      new Request(
        "https://private-preview.vercel.app/auth/callback?next=https://attacker.example",
      ),
    );
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe(live);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toContain("expired");
  });
  it("only exchanges callback codes into a session on an allowed local path", async () => {
    mock.exchangeCodeForSession.mockResolvedValue({ error: null });
    const success = await GET(
      new Request(`${live}/auth/callback?code=dummy&next=/reset`),
    );
    expect(success.headers.get("location")).toBe(`${live}/reset`);
    const unsafe = await GET(
      new Request(
        `${live}/auth/callback?code=dummy&next=https://attacker.example`,
      ),
    );
    expect(unsafe.headers.get("location")).toBe(
      `${live}/workspace?notice=email-confirmed`,
    );
    mock.exchangeCodeForSession.mockResolvedValue({
      error: { code: "bad_code_verifier" },
    });
    const failure = await GET(new Request(`${live}/auth/callback?code=dummy`));
    expect(
      new URL(failure.headers.get("location")!).searchParams.get("error"),
    ).toContain("this browser");
  });
  it("deletes an account only after password reauthentication and clears its local session", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { email: "dummy@example.test" } },
    });
    mock.rpc.mockResolvedValue({ error: null });
    const response = await POST(
      request({
        action: "delete",
        password: "dummy-password-only",
        confirmation: "DELETE MY ACCOUNT",
      }),
    );
    expect(response.status).toBe(200);
    expect(mock.signInWithPassword).toHaveBeenCalledWith({
      email: "dummy@example.test",
      password: "dummy-password-only",
    });
    expect(mock.rpc).toHaveBeenCalledWith("delete_own_account");
    expect(mock.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("rejects malformed configured origins", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.test/other/path");
    expect(() => appOrigin(request({}))).toThrow("valid public");
  });
  it("checks the current password before changing either account credential", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { id: "test-user", email: "dummy@example.test" } },
    });
    mock.signInWithPassword.mockResolvedValue({
      error: { code: "invalid_credentials" },
    });
    for (const action of ["change_email", "change_password"]) {
      const response = await POST(
        request({
          action,
          email: "new@example.test",
          currentPassword: "wrong",
          password: "a-new-test-password",
          confirmPassword: "a-new-test-password",
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(mock.updateUser).not.toHaveBeenCalled();
  });
  it("updates credentials after reauthentication and sends email changes to the public callback", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { id: "test-user", email: "dummy@example.test" } },
    });
    mock.updateUser.mockResolvedValue({
      data: { user: { email: "dummy@example.test" } },
      error: null,
    });
    const changed = await POST(
      request({
        action: "change_email",
        email: "new@example.test",
        currentPassword: "current-test-password",
      }),
    );
    expect((await changed.json()).message).toContain("inboxes");
    expect(mock.updateUser).toHaveBeenCalledWith(
      { email: "new@example.test" },
      { emailRedirectTo: `${live}/auth/callback` },
    );
    await POST(
      request({
        action: "change_password",
        currentPassword: "current-test-password",
        password: "new-test-password",
        confirmPassword: "new-test-password",
      }),
    );
    expect(mock.updateUser).toHaveBeenCalledWith({
      password: "new-test-password",
      current_password: "current-test-password",
    });
  });
  it("only permits the reset endpoint for a fresh, verified recovery session", async () => {
    mock.getUser.mockResolvedValue({
      data: { user: { id: "test-user", email: "dummy@example.test" } },
    });
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      action: "update",
      password: "new-test-password",
      confirmPassword: "new-test-password",
    };
    for (const claims of [
      { sub: "test-user", amr: [{ method: "password", timestamp: now }] },
      {
        sub: "test-user",
        amr: [{ method: "recovery", timestamp: now - 4000 }],
      },
      { sub: "other-user", amr: [{ method: "recovery", timestamp: now }] },
    ]) {
      mock.getClaims.mockResolvedValue({ data: { claims }, error: null });
      expect((await POST(request(payload))).status).toBe(403);
    }
    expect(mock.updateUser).not.toHaveBeenCalled();
    mock.getClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "test-user",
          amr: [{ method: "recovery", timestamp: now }],
        },
      },
      error: null,
    });
    mock.updateUser.mockResolvedValue({ error: null });
    expect((await POST(request(payload))).status).toBe(200);
  });
  it("explains an email rate limit without treating it as a bad password", async () => {
    mock.resetPasswordForEmail.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", status: 429 },
    });
    const response = await POST(
      request({ action: "reset", email: "dummy@example.test" }),
    );
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain(
      "does not mean your account or password is invalid",
    );
  });
  it("resend gives the same response for absent and pending accounts", async () => {
    const first = await (
      await POST(request({ action: "resend", email: "dummy@example.test" }))
    ).json();
    mock.resend.mockResolvedValue({
      error: { code: "user_not_found", status: 400 },
    });
    const second = await (
      await POST(request({ action: "resend", email: "absent@example.test" }))
    ).json();
    expect(first).toEqual(second);
  });
});
