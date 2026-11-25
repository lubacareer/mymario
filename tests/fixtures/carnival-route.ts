interface CarnivalInputChange {
  tick: number
  direction: -1 | 0 | 1
  jump: boolean
}

/** Held controls starting immediately before each numbered 60 Hz simulation step. */
export const carnivalInputTrace: readonly CarnivalInputChange[] = [
  // Bandstand and drum.
  { tick: 0, direction: 1, jump: false },
  { tick: 36, direction: 1, jump: true },
  { tick: 75, direction: 1, jump: false },
  // Puffbeetle bridge.
  { tick: 165, direction: 1, jump: true },
  { tick: 201, direction: 1, jump: false },
  // Board the kite float, then ride hands-free.
  { tick: 269, direction: 1, jump: true },
  { tick: 301, direction: 0, jump: false },
  // Hop for the high ribbon and stamp.
  { tick: 368, direction: 0, jump: true },
  { tick: 404, direction: 0, jump: false },
  // Disembark at the checkpoint.
  { tick: 508, direction: 1, jump: false },
  { tick: 567, direction: 1, jump: true },
  { tick: 602, direction: 1, jump: false },
  // Tap the first lantern.
  { tick: 614, direction: 1, jump: true },
  { tick: 619, direction: 1, jump: false },
  { tick: 706, direction: 1, jump: true },
  { tick: 741, direction: 1, jump: false },
  // Tap the second lantern.
  { tick: 759, direction: 1, jump: true },
  { tick: 764, direction: 1, jump: false },
  // Cross to the parade bell.
  { tick: 844, direction: 1, jump: true },
  { tick: 879, direction: 1, jump: false },
]

export const carnivalFinishTick = 995

// Stay on the deck past the gold ribbon, overshoot the checkpoint, then walk
// back along the lower promenade and board the returning float to retrieve it.
export const carnivalRecoveryTrace: readonly CarnivalInputChange[] = [
  ...carnivalInputTrace.filter(({ tick }) => tick < 368 || tick === 508),
  { tick: 557, direction: -1, jump: false },
  { tick: 689, direction: 0, jump: false },
  { tick: 865, direction: 0, jump: true },
  { tick: 900, direction: 0, jump: false },
  { tick: 902, direction: 0, jump: true },
  { tick: 936, direction: 0, jump: false },
]
