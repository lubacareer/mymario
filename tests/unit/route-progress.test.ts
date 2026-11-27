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

it("accepts a saved unlock from the same storage area once and keeps it for the visit", () => {
  const storage = { getItem: () => null, setItem: vi.fn() };
  const progress = createRouteProgress(storage);
  const saved = { storageArea: storage, key: "bellwind-post.cloud-carnival.v1", newValue: "unlocked" };
  for (const change of [
    { ...saved, storageArea: { ...storage } },
    { ...saved, key: "another-game" },
    { ...saved, newValue: "invalid" },
    { ...saved, key: null, newValue: null },
  ]) {
    expect(progress.syncUnlock(change)).toBe(false);
    expect(progress.carnivalUnlocked).toBe(false);
  }
  expect(progress.syncUnlock(saved)).toBe(true);
  expect(progress.syncUnlock(saved)).toBe(false);
  expect(progress.syncUnlock({ ...saved, newValue: null })).toBe(false);
  expect(progress.carnivalUnlocked).toBe(true);
  expect(storage.setItem).not.toHaveBeenCalled();

  const sessionOnly = createRouteProgress(null);
  expect(sessionOnly.syncUnlock({ ...saved, storageArea: null })).toBe(false);
  expect(sessionOnly.carnivalUnlocked).toBe(false);
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
