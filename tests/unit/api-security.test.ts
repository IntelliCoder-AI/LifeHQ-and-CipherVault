import { describe, it, expect } from "vitest";
import { schemas } from "../../packages/shared";
import {
  body,
  failure,
  originAllowed,
  json,
  InputError,
} from "../../apps/lifehq/lib/api";
const endpoint = "https://lifehq.example/api/auth";
const request = (text: string, headers = {}) =>
  new Request(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: text,
  });
describe("API security boundaries", () => {
  it("rejects forged forwarding headers and opaque, missing, or cross-origin origins", () => {
    for (const origin of [
      "https://attacker.example",
      "null",
      "https://lifehq.example.attacker.example",
      "http://lifehq.example",
    ]) {
      expect(
        originAllowed(
          request("{}", {
            Origin: origin,
            Host: "attacker.example",
            "X-Forwarded-Host": "attacker.example",
          }),
        ),
      ).toBe(false);
    }
    expect(originAllowed(request("{}"))).toBe(false);
    expect(
      originAllowed(request("{}", { Origin: "https://lifehq.example" })),
    ).toBe(true);
    expect(
      originAllowed(
        new Request("http://0.0.0.0:3000/api/auth", {
          headers: { Origin: "http://localhost:3000" },
        }),
      ),
    ).toBe(true);
    expect(
      originAllowed(
        new Request("http://0.0.0.0:3000/api/auth", {
          headers: {
            Origin: "http://attacker.example:3000",
            "X-Forwarded-Host": "attacker.example:3000",
          },
        }),
      ),
    ).toBe(false);
  });
  it("bounds actual streamed bytes even without or with a dishonest Content-Length", async () => {
    let canceled = false;
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new TextEncoder().encode("é".repeat(60)));
      },
      cancel() {
        canceled = true;
      },
    });
    const input = new Request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": "1" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(body(input, 100)).rejects.toMatchObject({ status: 413 });
    expect(canceled).toBe(true);
    await expect(
      body(request("{}", { "Content-Length": "999999" }), 100),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects non-JSON, malformed JSON and invalid UTF-8 without reflecting their contents", async () => {
    await expect(
      body(request("{}", { "Content-Type": "text/plain" })),
    ).rejects.toMatchObject({ status: 415 });
    await expect(body(request('{"secret-password":'))).rejects.toThrow(
      "Send valid UTF-8 JSON",
    );
    await expect(
      body(
        new Request(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: new Uint8Array([0xff]),
        }),
      ),
    ).rejects.toThrow("Send valid UTF-8 JSON");
    expect(await body(request('{"ok":true}'))).toEqual({ ok: true });
  });
  it("exposes only deliberate validation messages, never internal exception text", async () => {
    for (const error of [
      new Error("password=secret; postgres-internal-host"),
      { message: "database details", code: "XX000" },
    ]) {
      const response = failure(error);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        error: "Something went wrong. Please try again.",
      });
    }
    expect(
      await failure(new InputError("Choose a valid date.")).json(),
    ).toEqual({ error: "Choose a valid date." });
    const parsed = schemas.notes.array().safeParse(Array(1000).fill(null));
    if (!parsed.success)
      expect(
        JSON.stringify(await failure(parsed.error).json()).length,
      ).toBeLessThan(1500);
  });
  it("marks every JSON response as private and uncacheable", () => {
    const response = json({ ok: true });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("Pragma")).toBe("no-cache");
  });
});
