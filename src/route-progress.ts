type SaveStorage = Pick<Storage, "getItem" | "setItem">;
const SAVE_KEY = "bellwind-post.cloud-carnival.v1";

export function createRouteProgress(storage?: SaveStorage | null) {
  let unlocked = false;
  try {
    if (storage === undefined) storage = window.localStorage;
    unlocked = storage?.getItem(SAVE_KEY) === "unlocked";
  } catch {
    // An unavailable save starts the visit on Morning Delivery.
  }

  return {
    get carnivalUnlocked() { return unlocked; },
    unlockCarnival() {
      if (unlocked) return;
      unlocked = true;
      try {
        storage?.setItem(SAVE_KEY, "unlocked");
      } catch {
        // Keep the earned route playable for this visit.
      }
    },
  };
}
