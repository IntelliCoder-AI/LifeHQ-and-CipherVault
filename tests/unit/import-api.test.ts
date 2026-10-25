import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { schemas, defaults } from "../../packages/shared/index";
const mock = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("../../apps/lifehq/lib/supabase", () => ({
  supabase: async () => ({ auth: { getUser: mock.getUser }, rpc: mock.rpc }),
}));
import { POST } from "../../apps/lifehq/app/api/import/route";
const owner = "00000000-0000-4000-8000-000000000091";
function request(value: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/import", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}
beforeEach(() => {
  mock.getUser.mockResolvedValue({ data: { user: { id: owner } } });
  mock.rpc.mockResolvedValue({ data: { imported: 1 }, error: null });
});
afterEach(() => vi.resetAllMocks());
describe("authenticated import endpoint", () => {
  it("rejects cross-origin and anonymous requests before writing any records", async () => {
    expect((await POST(request({}, "https://attacker.example"))).status).toBe(
      403,
    );
    mock.getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(request({}))).status).toBe(401);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it("ignores the exported owner and IDs, and opts out of preferences by default", async () => {
    const sourceId = "00000000-0000-4000-8000-000000000092";
    const backup = {
      format: "lifehq",
      version: 1,
      preferences: defaults,
      data: {
        projects: [
          {
            ...schemas.projects.parse({ title: "Owned copy" }),
            id: sourceId,
            user_id: "someone-else",
          },
        ],
      },
    };
    const response = await POST(request({ backup }));
    expect(response.status).toBe(200);
    const payload = mock.rpc.mock.calls[0][1].payload;
    expect(payload.data.projects[0].user_id).toBe(owner);
    expect(payload.data.projects[0].id).not.toBe(sourceId);
    expect(payload.preferences).toBeNull();
  });
  it("rejects oversized and malformed input before the transactional RPC", async () => {
    expect((await POST(request({ backup: {} }))).status).toBe(400);
    expect(
      (await POST(request({ backup: "x".repeat(5 * 1024 * 1024) }))).status,
    ).toBe(400);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
});
