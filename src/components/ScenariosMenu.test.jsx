import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ScenariosMenu from "./ScenariosMenu.jsx";
const mocks = vi.hoisted(() => ({ load: vi.fn(), token: vi.fn() }));
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ isSignedIn: true, getToken: mocks.token }),
  SignedIn: ({ children }) => children,
  SignedOut: () => null,
  SignInButton: () => null,
}));
vi.mock("../lib/supabase", () => ({
  supabaseConfigured: true,
  makeSupabaseClient: () => ({}),
}));
vi.mock("../lib/scenarios", () => ({
  listScenarios: async () => [
    { id: "saved", name: "Saved case", updated_at: "2026-10-21" },
  ],
  loadScenario: mocks.load,
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}));
afterEach(cleanup);
it("ignores a delayed mocked cloud load after switching away from its local case", async () => {
  let resolve;
  mocks.load.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const apply = vi.fn();
  const view = render(
    <ScenariosMenu
      clerkConfigured
      getScenarioState={() => ({})}
      applyScenarioState={apply}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "CLOUD SAVES ▾" }));
  fireEvent.click(await screen.findByRole("button", { name: /Saved case/ }));
  view.unmount();
  await act(async () =>
    resolve({ id: "saved", name: "Saved case", data: { hypothetical: true } }),
  );
  expect(apply).not.toHaveBeenCalled();
});
