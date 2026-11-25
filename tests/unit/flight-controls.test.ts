import { describe, expect, it } from "vitest";
import { FlightControls, FixedClock, actionForKey } from "../../src/aphelion/controls";

describe("flight controls", () => {
  it("consumes click-only steering for one tick and clears pending activations on reset", () => {
    const controls = new FlightControls();
    controls.activate("left");
    expect(controls.frame().steer).toBe(-1);
    expect(controls.frame().steer).toBe(0);
    controls.press("KeyA", "left");
    controls.activate("right");
    expect(controls.frame().steer).toBe(0);
    expect(controls.frame().steer).toBe(-1);
    controls.activate("right");
    controls.clear();
    expect(controls.frame().steer).toBe(0);
  });

  it("steers while a second finger taps and releases jump between simulation ticks", () => {
    const controls = new FlightControls();
    controls.press("finger:1", "left");
    controls.press("finger:2", "jump");
    controls.release("finger:2");
    expect(controls.frame()).toEqual({ steer: -1, throttle: 0, jump: true });
    expect(controls.frame()).toEqual({ steer: -1, throttle: 0, jump: false });
    controls.release("finger:1");
    expect(controls.frame().steer).toBe(0);
  });

  it("keeps independent keys held, cancels opposing directions, and does not repeat jump", () => {
    const controls = new FlightControls();
    controls.press("KeyA", "left");
    controls.press("ArrowLeft", "left");
    controls.release("KeyA");
    controls.press("KeyW", "faster");
    controls.press("Space", "jump");
    expect(controls.frame()).toEqual({ steer: -1, throttle: 1, jump: true });
    controls.press("Space", "jump");
    controls.press("KeyD", "right");
    expect(controls.frame()).toEqual({ steer: 0, throttle: 1, jump: false });
    controls.clear();
    controls.press("KeyS", "slower");
    expect(controls.frame()).toEqual({ steer: 0, throttle: -1, jump: false });
    controls.release("KeyS");
    expect(controls.frame().throttle).toEqual(0);
  });

  it("maps both keyboard layouts", () => {
    expect(["ArrowLeft","KeyA","ArrowRight","KeyD","ArrowUp","KeyW","ArrowDown","KeyS","Space","Tab"].map(actionForKey))
      .toEqual(["left","left","right","right","faster","faster","slower","slower","jump",undefined]);
  });
});

it("steps at 60 Hz across uneven refreshes and discards time spent paused", () => {
  const clock = new FixedClock(1 / 60);
  expect(clock.ticks(1000)).toBe(0);
  expect(clock.ticks(1007)).toBe(0);
  expect(clock.ticks(1040)).toBe(2);
  expect(clock.ticks(1050)).toBe(1);
  clock.reset();
  expect(clock.ticks(9000)).toBe(0);
  expect(clock.ticks(9017)).toBe(1);
});
