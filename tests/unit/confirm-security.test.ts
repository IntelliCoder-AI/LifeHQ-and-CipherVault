import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock("../../apps/lifehq/lib/supabase", () => ({
  supabase: async () => ({ auth: mock }),
}));
import { POST } from "../../apps/lifehq/app/api/confirm/route";
const token_hash = "a".repeat(64);
function request(value: object, origin = "https://lifehq-three.vercel.app") {
  return new Request("https://lifehq-three.vercel.app/api/confirm", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.verifyOtp.mockResolvedValue({ error: null });
});
describe("explicit email-link confirmation", () => {
  it("rejects cross-site consumption of an attacker-controlled account link", async () => {
    expect(
      (
        await POST(
          request({ token_hash, type: "signup" }, "https://attacker.example"),
        )
      ).status,
    ).toBe(403);
    expect(mock.verifyOtp).not.toHaveBeenCalled();
  });
  it("rejects arbitrary OTP types and malformed or oversized hashes before Auth", async () => {
    for (const value of [
      { token_hash, type: "sms" },
      { token_hash: "a".repeat(129), type: "signup" },
      { token_hash: "<script>", type: "signup" },
    ])
      expect((await POST(request(value))).status).toBe(400);
    expect(mock.verifyOtp).not.toHaveBeenCalled();
  });
  it("only returns a fixed destination after successful explicit verification", async () => {
    const response = await POST(request({ token_hash, type: "recovery" }));
    expect(response.status).toBe(200);
    expect((await response.json()).destination).toBe(
      "https://lifehq-three.vercel.app/reset",
    );
    mock.verifyOtp.mockResolvedValue({
      error: { message: "internal token contents" },
    });
    const rejected = await POST(request({ token_hash, type: "signup" }));
    expect(rejected.status).toBe(400);
    expect(await rejected.text()).not.toContain("internal");
  });
});
