import { expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Modal from "./Modal.jsx";
it("names the dialog, traps tab focus, closes on Escape, and restores the trigger", () => {
  const close = vi.fn();
  const trigger = document.createElement("button");
  document.body.appendChild(trigger);
  trigger.focus();
  const view = render(
    <Modal open onClose={close} title="Save scenario">
      <label>
        Name
        <input />
      </label>
      <button>Save</button>
      <button>Cancel</button>
    </Modal>,
  );
  expect(screen.getByRole("dialog", { name: "Save scenario" })).toHaveAttribute(
    "aria-modal",
    "true",
  );
  const first = screen.getByLabelText("Name");
  const last = screen.getByRole("button", { name: "Cancel" });
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
