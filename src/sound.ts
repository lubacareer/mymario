import type { GameEvent } from "./game/simulation";

const notes: Record<GameEvent, [number, number]> = {
  jump: [235, 360],
  stamp: [700, 1047],
  stomp: [170, 85],
  hurt: [235, 110],
  checkpoint: [440, 660],
  victory: [660, 990],
  gameover: [180, 90],
};

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
    const [start, finish] = notes[event];
    const duration =
      event === "victory" ? 0.85 : event === "checkpoint" ? 0.34 : 0.14;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const now = ctx.currentTime;
    oscillator.type = event === "stomp" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      finish,
      now + duration * 0.6,
    );
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.exponentialRampToValueAtTime(0.1, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(this.output);
    oscillator.start();
    oscillator.stop(now + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
}
