import { afterEach, expect, it, vi } from "vitest";
import { FlightAudio } from "../../src/aphelion/sound";

function parameter() {
  return {
    value: 0,
    setTargetAtTime: vi.fn<(value: number, when: number, constant: number) => void>(),
    setValueAtTime: vi.fn<(value: number, when: number) => void>(),
    exponentialRampToValueAtTime: vi.fn<(value: number, when: number) => void>(),
  };
}
function instrument() {
  const context = {
    currentTime: 1, state: "running", destination: {}, resume: vi.fn(async () => {}),
    createGain: vi.fn(() => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() })),
    createOscillator: vi.fn(() => ({ frequency: parameter(), type: "", connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as null | (() => void) })),
  };
  vi.stubGlobal("AudioContext", class { constructor() { return context; } });
  const audio = new FlightAudio();
  audio.unlock();
  return { audio, context };
}
afterEach(() => vi.unstubAllGlobals());

it("runs one persistent engine with speed-sensitive pitch and stops it between flights", () => {
  const { audio, context } = instrument();
  audio.engine(12);
  audio.engine(30);
  expect(context.createOscillator).toHaveBeenCalledTimes(1);
  const engine = context.createOscillator.mock.results[0].value as ReturnType<typeof context.createOscillator>;
  const pitches = engine.frequency.setTargetAtTime.mock.calls.map(([value]) => value);
  expect(pitches.at(-1)).toBeGreaterThan(pitches[0]);
  audio.engine(null);
  expect(engine.stop).toHaveBeenCalledOnce();
  audio.engine(null);
  expect(engine.stop).toHaveBeenCalledOnce();
});

it("gives each event a distinct sound and cuts all sound when muted", () => {
  const { audio, context } = instrument();
  const signatures = (["jump", "refill", "crash", "finish"] as const).map(event => {
    const start = context.createOscillator.mock.results.length;
    audio.play(event);
    return context.createOscillator.mock.results.slice(start).map(({ value }) =>
      [value.type, value.frequency.setValueAtTime.mock.calls, value.start.mock.calls]);
  });
  expect(new Set(signatures.map(signature => JSON.stringify(signature))).size).toBe(4);
  audio.toggle();
  expect(context.createGain.mock.results[0].value.gain.value).toBe(0);
  const count = context.createOscillator.mock.calls.length;
  audio.play("finish");
  expect(context.createOscillator).toHaveBeenCalledTimes(count);
});
