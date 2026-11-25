import type { FlightEvent } from "./simulation";

interface Note {
  wave: OscillatorType;
  hz: number;
  endHz: number;
  seconds: number;
  delay?: number;
}

const cues: Record<FlightEvent, Note[]> = {
  jump: [{ wave: "triangle", hz: 170, endHz: 580, seconds: 0.21 }],
  refill: [
    { wave: "sine", hz: 440, endHz: 660, seconds: 0.14 },
    { wave: "sine", hz: 880, endHz: 990, seconds: 0.22, delay: 0.09 },
  ],
  crash: [
    { wave: "sawtooth", hz: 96, endHz: 26, seconds: 0.42 },
    { wave: "triangle", hz: 153, endHz: 35, seconds: 0.31 },
  ],
  finish: [392, 494, 587, 784].map((hz, i) => ({
    wave: "triangle", hz, endHz: hz, seconds: i === 3 ? 0.49 : 0.21, delay: i * 0.09,
  })),
};

export class FlightAudio {
  muted = false;
  private context?: AudioContext;
  private master?: GainNode;
  private motor?: OscillatorNode;
  private pitch = 0;

  unlock() {
    try {
      this.context ??= new AudioContext();
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        this.master.connect(this.context.destination);
      }
      if (this.context.state !== "running") void this.context.resume().catch(() => {});
    } catch {
      // The race remains playable when Web Audio is unavailable.
    }
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
  }

  engine(speed: number | null) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    if (speed === null) {
      this.motor?.stop();
      this.motor = undefined;
      this.pitch = 0;
      return;
    }
    if (!this.motor) {
      const motor = ctx.createOscillator();
      const volume = ctx.createGain();
      motor.type = "triangle";
      volume.gain.value = 0.036;
      motor.connect(volume);
      volume.connect(this.master);
      motor.onended = () => { motor.disconnect(); volume.disconnect(); };
      motor.start();
      this.motor = motor;
    }
    const pitch = Math.round(34 + speed * 2);
    if (pitch !== this.pitch) {
      this.pitch = pitch;
      this.motor.frequency.setTargetAtTime(pitch, ctx.currentTime, 0.06);
    }
  }

  play(event: FlightEvent) {
    const ctx = this.context;
    if (!ctx || !this.master || this.muted) return;
    for (const note of cues[event]) {
      const start = ctx.currentTime + (note.delay ?? 0);
      const end = start + note.seconds;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.hz, start);
      oscillator.frequency.exponentialRampToValueAtTime(note.endHz, end);
      envelope.gain.setValueAtTime(0.001, start);
      envelope.gain.exponentialRampToValueAtTime(0.09, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.001, end);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(start);
      oscillator.stop(end);
    }
  }
}
