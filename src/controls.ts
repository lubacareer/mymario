import type { InputFrame } from "./game/simulation";

export type Action = "left" | "right" | "jump";

export class Controls {
  private readonly active = new Map<string, Action>();
  private pendingJump = false;

  press(source: string, action: Action) {
    if (this.active.has(source)) return;
    if (action === "jump" && ![...this.active.values()].includes("jump"))
      this.pendingJump = true;
    this.active.set(source, action);
  }

  release(source: string) {
    this.active.delete(source);
  }

  clear() {
    this.active.clear();
    this.pendingJump = false;
  }

  frame(): InputFrame {
    let direction: InputFrame["direction"] = 0;
    let jumpHeld = false;
    for (const action of this.active.values()) {
      if (action === "jump") jumpHeld = true;
      else direction = action === "left" ? -1 : 1;
    }
    const jumpPressed = this.pendingJump;
    this.pendingJump = false;
    return { direction, jumpHeld, jumpPressed };
  }
}
