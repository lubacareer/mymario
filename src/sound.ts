import type { GameEvent } from "./game/simulation";

const notes: Record<Exclude<GameEvent, "victory">, [number, number]> = {
  jump: [235, 360],
  stamp: [700, 1047],
  stomp: [170, 85],
  hurt: [235, 110],
  checkpoint: [440, 660],
  gameover: [180, 90],
};

interface Voice {
  frequency: number;
  peak: number;
  duration: number;
  glideTo?: number;
  type?: OscillatorType;
}

// The low hum, strike pitch and minor third linger after the clapper's bright
// upper modes fade. Their imperfect frequency ratios give the bell its metal tone.
const bellPartials: Voice[] = [
  { frequency: 329, peak: 0.038, duration: 1.95 },
  { frequency: 659, peak: 0.1, duration: 1.75 },
  { frequency: 784, peak: 0.052, duration: 1.25 },
  { frequency: 1330, peak: 0.072, duration: 0.95 },
  { frequency: 1907, peak: 0.036, duration: 0.45 },
  { frequency: 2762, peak: 0.023, duration: 0.22 },
];

function playVoice(
  ctx: AudioContext,
  output: GainNode,
  now: number,
  voice: Voice,
  attack: number,
) {
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = voice.type ?? "sine";
  oscillator.frequency.setValueAtTime(voice.frequency, now);
  if (voice.glideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(
      voice.glideTo,
      now + voice.duration * 0.6,
    );
  }
  envelope.gain.setValueAtTime(0.001, now);
  envelope.gain.exponentialRampToValueAtTime(voice.peak, now + attack);
  envelope.gain.exponentialRampToValueAtTime(0.001, now + voice.duration);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + voice.duration);
}

export class PostalAudio {
  muted = false;
  private context?: AudioContext;
  private output?: GainNode;

  unlock() {
    try {
      this.context ??= new AudioContext();
      if (!this.output) {
        this.output = this.context.createGain();
        this.output.gain.value = this.muted ? 0 : 1;
        this.output.connect(this.context.destination);
      }
      void this.context.resume().catch(() => {});
    } catch {
      /* Browsers without Web Audio still support the complete game. */
    }
  }

  toggle() {
    this.muted = !this.muted;
    if (this.output) this.output.gain.value = this.muted ? 0 : 1;
  }

  play(event: GameEvent) {
    const ctx = this.context;
    if (!ctx || !this.output || this.muted || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (event === "victory") {
      for (const partial of bellPartials)
        playVoice(ctx, this.output, now, partial, 0.003);
      return;
    }
    const [frequency, glideTo] = notes[event];
    playVoice(
      ctx,
      this.output,
      now,
      {
        frequency,
        glideTo,
        peak: 0.1,
        duration: event === "checkpoint" ? 0.34 : 0.14,
        type: event === "stomp" ? "triangle" : "sine",
      },
      0.008,
    );
  }
}
