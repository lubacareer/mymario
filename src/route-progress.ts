type SaveStorage = Pick<Storage, "getItem" | "setItem">;
interface SaveChange {
  storageArea: SaveStorage | null;
  key: string | null;
  newValue: string | null;
}
const SAVE_KEY = "bellwind-post.cloud-carnival.v1";
const UNLOCKED = "unlocked";

export function createRouteProgress(storage?: SaveStorage | null) {
  let unlocked = false;
  try {
    if (storage === undefined) storage = window.localStorage;
    unlocked = storage?.getItem(SAVE_KEY) === UNLOCKED;
  } catch {
    // An unavailable save starts the visit on Morning Delivery.
  }

  return {
    get carnivalUnlocked() { return unlocked; },
    syncUnlock({ storageArea, key, newValue }: SaveChange) {
      if (unlocked || !storage || storageArea !== storage || key !== SAVE_KEY || newValue !== UNLOCKED) return false;
      unlocked = true;
      return true;
    },
    unlockCarnival() {
      if (unlocked) return;
      unlocked = true;
      try {
        storage?.setItem(SAVE_KEY, UNLOCKED);
      } catch {
        // Keep the earned route playable for this visit.
      }
    },
  };
}
