// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Modal, Field, Progress } from "../../packages/ui";
import { useState } from "react";
afterEach(cleanup);
describe("accessible UI primitives", () => {
  it("labels form inputs and exposes real progress values", () => {
    render(
      <>
        <Field label="Display name">
          <input />
        </Field>
        <Progress value={42} label="Goal progress" />
      </>,
    );
    expect(screen.getByLabelText("Display name")).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Goal progress" })
        .getAttribute("aria-valuenow"),
    ).toBe("42");
  });
  it("exposes a named dialog and closes on Escape", () => {
    function Fixture() {
      const [open, setOpen] = useState(true);
      return (
        <Modal open={open} onOpenChange={setOpen} title="New task">
          <input aria-label="Title" />
        </Modal>
      );
    }
    render(<Fixture />);
    expect(screen.getByRole("dialog", { name: "New task" })).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
