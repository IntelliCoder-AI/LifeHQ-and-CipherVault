import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
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
    expect(unsafe.headers.get("location")).toBe(`${live}/workspace`);
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
