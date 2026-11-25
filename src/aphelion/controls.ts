import type { FlightInput } from "./simulation";

export type Action = "left" | "right" | "faster" | "slower" | "jump";

const keys: Partial<Record<string, Action>> = {
  ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
  ArrowUp: "faster", KeyW: "faster", ArrowDown: "slower", KeyS: "slower", Space: "jump",
};

export function actionForKey(code: string) {
  return keys[code];
}

export class FlightControls {
  private held = new Map<string, Action>();
  private pending = new Set<"left" | "right" | "jump">();

  activate(action: "left" | "right" | "jump") {
    this.pending.add(action);
  }

  press(source: string, action: Action) {
    if (this.held.has(source)) return;
    if (action === "jump") this.activate(action);
    this.held.set(source, action);
  }

  release(source: string) {
    this.held.delete(source);
  }

  clear() {
    this.held.clear();
    this.pending.clear();
  }

  frame(): FlightInput {
    let left = this.pending.has("left"), right = this.pending.has("right");
    let faster = false, slower = false;
    for (const action of this.held.values()) {
      left ||= action === "left";
      right ||= action === "right";
      faster ||= action === "faster";
      slower ||= action === "slower";
    }
    const jump = this.pending.has("jump");
    this.pending.clear();
    return { steer: axis(left, right), throttle: axis(slower, faster), jump };
  }
}

function axis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  if (negative === positive) return 0;
  return positive ? 1 : -1;
}

export class FixedClock {
  private previous?: number;
  private remainder = 0;

  constructor(private readonly stepSeconds: number) {}

  reset() {
    this.previous = undefined;
    this.remainder = 0;
  }

  ticks(timestamp: number) {
    if (this.previous !== undefined) {
      // Bound work after a stalled frame. Focus and visibility pauses reset the clock entirely.
      this.remainder += Math.min((timestamp - this.previous) / 1000, 0.25);
    }
    this.previous = timestamp;
    const count = Math.floor((this.remainder + 1e-9) / this.stepSeconds);
    this.remainder -= count * this.stepSeconds;
    return count;
  }
}
