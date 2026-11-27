import { afterEach, expect, it, vi } from "vitest";
import { PostalAudio } from "../../src/sound";

function parameter() {
  return {
    value: 1,
    setValueAtTime: vi.fn<(value: number, when: number) => void>(),
    exponentialRampToValueAtTime:
      vi.fn<(value: number, when: number) => void>(),
  };
}

function gainNode() {
  return { gain: parameter(), connect: vi.fn(), disconnect: vi.fn() };
}

function oscillatorNode() {
  return {
    type: "sine",
    frequency: parameter(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn<(when: number) => void>(),
    onended: null as (() => void) | null,
  };
}

function instrumentAudio() {
  const context = {
    currentTime: 5,
    state: "running",
    destination: {},
    resume: async () => {},
    createGain: vi.fn(gainNode),
    createOscillator: vi.fn(oscillatorNode),
  };
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        return context;
      }
    },
  );
  const audio = new PostalAudio();
  audio.unlock();
  return { audio, context };
}

afterEach(() => vi.unstubAllGlobals());

it("strikes simultaneous fixed bell partials with a sustained body and faster fading overtones", () => {
  const { audio, context } = instrumentAudio();
  audio.play("victory");
  const voices = context.createOscillator.mock.results.map(
    ({ value }) => value,
  );
  expect(voices.length).toBeGreaterThanOrEqual(3);
  const partials = voices
    .map((voice) => {
      expect(voice.start).toHaveBeenCalledWith(context.currentTime);
      expect(
        voice.frequency.exponentialRampToValueAtTime,
      ).not.toHaveBeenCalled();
      const envelope = voice.connect.mock.calls[0][0] as ReturnType<
        typeof gainNode
      >;
      const [attack, release] =
        envelope.gain.exponentialRampToValueAtTime.mock.calls;
      expect(attack[1] - context.currentTime).toBeLessThan(0.02);
      expect(release[0]).toBeLessThan(attack[0] * 0.1);
      expect(voice.stop).toHaveBeenCalledWith(release[1]);
      return {
        hz: voice.frequency.setValueAtTime.mock.calls[0][0],
        duration: release[1] - context.currentTime,
      };
    })
    .sort((a, b) => a.hz - b.hz);
  const low = partials[0];
  const high = partials[partials.length - 1];
  expect(low.duration).toBeGreaterThan(1);
  expect(high.duration).toBeLessThan(low.duration / 2);
  expect(
    partials.some(
      ({ hz }) => Math.abs(hz / low.hz - Math.round(hz / low.hz)) > 0.15,
    ),
  ).toBe(true);
});

it("mutes every ringing voice through the master gain and releases its nodes when it ends", () => {
  const { audio, context } = instrumentAudio();
  audio.play("victory");
  const voices = context.createOscillator.mock.results.map(
    ({ value }) => value,
  );
  const master = context.createGain.mock.results[0].value;
  audio.toggle();
  expect(master.gain.value).toBe(0);
  expect(master.connect).toHaveBeenCalledWith(context.destination);
  for (const voice of voices) {
    const envelope = voice.connect.mock.calls[0][0] as ReturnType<
      typeof gainNode
    >;
    expect(envelope.connect).toHaveBeenCalledWith(master);
    voice.onended?.();
    expect(voice.disconnect).toHaveBeenCalledOnce();
    expect(envelope.disconnect).toHaveBeenCalledOnce();
  }
  audio.play("victory");
  expect(context.createOscillator).toHaveBeenCalledTimes(voices.length);
});

it("retains the short single-voice jump cue", () => {
  const { audio, context } = instrumentAudio();
  audio.play("jump");
  expect(context.createOscillator).toHaveBeenCalledOnce();
  const voice = context.createOscillator.mock.results[0].value;
  expect(voice.frequency.exponentialRampToValueAtTime).toHaveBeenCalledOnce();
  expect(voice.stop.mock.calls[0][0] - context.currentTime).toBeLessThan(0.2);
});

it.each(["drum", "ribbon", "lantern"] as const)("plays audible voices for the %s booth cue through the mute control", cue => {
  const { audio, context } = instrumentAudio();
  audio.play(cue);
  const voices = context.createOscillator.mock.results;
  expect(voices.length).toBeGreaterThanOrEqual(2);
  const master = context.createGain.mock.results[0].value;
  for (const { value: voice } of voices) {
    expect(voice.frequency.setValueAtTime).toHaveBeenCalled();
    const pitches = [
      ...voice.frequency.setValueAtTime.mock.calls,
      ...voice.frequency.exponentialRampToValueAtTime.mock.calls,
    ];
    for (const [hz] of pitches) {
      expect(hz).toBeGreaterThanOrEqual(20);
      expect(hz).toBeLessThanOrEqual(20_000);
    }
    const envelope = voice.connect.mock.calls[0][0] as ReturnType<typeof gainNode>;
    const [[initialGain]] = envelope.gain.setValueAtTime.mock.calls;
    const [[peak, attackTime], [releaseGain, releaseTime]] = envelope.gain.exponentialRampToValueAtTime.mock.calls;
    expect(peak).toBeGreaterThan(Math.max(0, initialGain, releaseGain));
    expect(attackTime).toBeLessThan(releaseTime);
    expect(envelope.connect).toHaveBeenCalledWith(master);
  }
  const count = voices.length;
  audio.toggle();
  audio.play(cue);
  expect(context.createOscillator).toHaveBeenCalledTimes(count);
  expect(master.gain.value).toBe(0);
});
