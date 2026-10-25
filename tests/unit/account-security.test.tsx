// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
const state = vi.hoisted(() => ({
  demo: false,
  email: "dummy@example.test",
  pendingEmail: "",
  refresh: vi.fn(),
}));
vi.mock("../../apps/lifehq/lib/store", () => ({ useWorkspace: () => state }));
import { AccountSecurity } from "../../apps/lifehq/components/account-security";
beforeEach(() => {
  state.demo = false;
  state.pendingEmail = "";
  state.refresh.mockResolvedValue(undefined);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Password updated." }),
      }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("account settings forms", () => {
  it("rejects mismatched passwords locally and submits current/new passwords without persisting them", async () => {
    const { container } = render(<AccountSecurity />);
    fireEvent.change(
      screen.getByLabelText("Current password", { exact: true }),
      { target: { value: "current-test-password" } },
    );
    fireEvent.change(screen.getByLabelText("New password", { exact: true }), {
      target: { value: "new-test-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-password" },
    });
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("alert").textContent).toContain("do not match");
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-test-password" },
    });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce());
    expect(
      JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string),
    ).toEqual({
      action: "change_password",
      currentPassword: "current-test-password",
      password: "new-test-password",
      confirmPassword: "new-test-password",
    });
    expect(
      (
        screen.getByLabelText("Current password", {
          exact: true,
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });
  it("submits email changes separately and exposes confirmation instructions", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ message: "Check both inboxes." }),
    } as Response);
    const { container } = render(<AccountSecurity />);
    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.test" },
    });
    fireEvent.change(
      screen.getByLabelText("Current password to change email"),
      { target: { value: "current-test-password" } },
    );
    fireEvent.submit(container.querySelectorAll("form")[1]);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "Check both inboxes",
      ),
    );
    expect(
      JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string),
    ).toEqual({
      action: "change_email",
      email: "new@example.test",
      currentPassword: "current-test-password",
    });
  });
  it("explains why account credentials are unavailable in the demo", () => {
    state.demo = true;
    render(<AccountSecurity />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.getByText(/local demo has no account credentials/),
    ).toBeTruthy();
  });
});
