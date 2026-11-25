import type { Rect } from './level'

export const CARNIVAL_PROPS = {
  drum: { x: 316, y: 244, w: 76, h: 20 },
  ribbons: [
    { id: 'kite-blue', x: 1214, y: 202 },
    { id: 'kite-gold', x: 1388, y: 148 },
    { id: 'kite-coral', x: 1550, y: 202 },
  ],
  lanterns: [
    { id: 'star-rose', x: 2090, y: 244, w: 76, h: 20 },
    { id: 'star-gold', x: 2680, y: 238, w: 76, h: 20 },
  ],
  gate: { x: 3176, y: 42, w: 32, h: 206 },
}

export interface Booths {
  drum: boolean
  ribbons: Set<string>
  lanterns: Set<string>
}

export function boothSeals(booths: Booths): number {
  return Number(booths.drum) + Number(booths.ribbons.size === CARNIVAL_PROPS.ribbons.length)
    + Number(booths.lanterns.size === CARNIVAL_PROPS.lanterns.length)
}

const FLOAT_TRIP_TICKS = 256
const FLOAT_PHASE = 232
const FLOAT_TRAVEL = 500

/** The renderer, rider and collision checks all sample the same fixed-tick deck. */
export function floatAt(ticks: number): Rect {
  const phase = (ticks + FLOAT_PHASE) % (2 * FLOAT_TRIP_TICKS)
  const distance = Math.min(phase, 2 * FLOAT_TRIP_TICKS - phase) / FLOAT_TRIP_TICKS
  return { x: 1080 + distance * FLOAT_TRAVEL, y: 222, w: 150, h: 16 }
}
