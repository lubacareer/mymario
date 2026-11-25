import { afterEach, expect, it, vi } from "vitest";
import { createRouteProgress } from "../../src/route-progress";

afterEach(() => vi.unstubAllGlobals());

it("restores a completed delivery for either courier on the next visit", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const first = createRouteProgress(storage);
  expect(first.carnivalUnlocked).toBe(false);
  first.unlockCarnival();
  expect(first.carnivalUnlocked).toBe(true);
  expect(createRouteProgress(storage).carnivalUnlocked).toBe(true);
});

it("begins with Morning Delivery if the route flag is malformed", () => {
  const storage = { getItem: () => "damaged save", setItem: vi.fn() };
  expect(createRouteProgress(storage).carnivalUnlocked).toBe(false);
});

it("keeps the unlock for this visit if reading or writing storage fails", () => {
  const denied = () => { throw new Error("Storage unavailable"); };
  const store = createRouteProgress({ getItem: denied, setItem: denied });
  expect(store.carnivalUnlocked).toBe(false);
  store.unlockCarnival();
  expect(store.carnivalUnlocked).toBe(true);
  vi.stubGlobal("window", { get localStorage() { return denied(); } });
  const sessionOnly = createRouteProgress();
  sessionOnly.unlockCarnival();
  expect(sessionOnly.carnivalUnlocked).toBe(true);
});
