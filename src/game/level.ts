export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Platform extends Rect {
  kind: 'island' | 'ledge'
}

export type RouteId = 'morning' | 'carnival'
interface Point { x: number; y: number }
export interface Level {
  id: RouteId
  name: string
  width: number
  height: number
  spawn: Point
  checkpoint: Point
  bell: Point
  platforms: Platform[]
  stamps: (Point & { id: string })[]
  patrols: { id: string; left: number; right: number; floorY: number; speed: number }[]
}

const island = (x: number, y: number, w: number, h: number): Platform =>
  ({ kind: 'island', x, y, w, h })
const ledge = (x: number, y: number, w: number): Platform =>
  ({ kind: 'ledge', x, y, w, h: 14 })

const platforms = [
  island(0, 264, 580, 80),
  island(648, 254, 370, 84),
  island(1090, 264, 370, 74),
  island(1526, 250, 544, 94),
  island(2140, 240, 320, 88),
  island(2530, 262, 390, 82),
  island(2990, 248, 226, 76),
  island(3292, 256, 348, 90),
  ledge(300, 204, 108),
  ledge(1910, 190, 90),
]

const stamp = (id: string, x: number, y: number) => ({ id, x, y })

// Platform rectangles double as the visible landing surfaces. Prop coordinates
// are bottom centres, while collectible coordinates are circle centres.
export const LEVEL: Level = {
  id: 'morning',
  name: 'Morning Delivery',
  width: 3640,
  height: 360,
  spawn: { x: 56, y: 264 },
  checkpoint: { x: 1600, y: 250 },
  bell: { x: 3552, y: 256 },
  platforms,
  stamps: [
    stamp('yard', 188, 240), stamp('rooftop', 372, 176),
    stamp('first-ascent', 556, 204), stamp('first-gap', 624, 168), stamp('first-descent', 692, 211),
    stamp('blue-ascent', 992, 194), stamp('blue-gap', 1060, 158), stamp('blue-descent', 1128, 201),
    stamp('windmill-roof', 1960, 162),
    stamp('final-ascent', 2896, 202), stamp('final-crossing', 2964, 166), stamp('final-descent', 3032, 209),
  ],
  patrols: [
    { id: 'mill', left: 1730, right: 1822, floorY: 250, speed: 34 },
    { id: 'meadow', left: 2638, right: 2748, floorY: 262, speed: 42 },
    { id: 'tower', left: 3390, right: 3482, floorY: 256, speed: 38 },
  ],
}

const carnival: Level = {
  id: 'carnival', name: 'Cloud Carnival', width: 3520, height: 360,
  spawn: { x: 56, y: 264 }, checkpoint: { x: 1782, y: 292 }, bell: { x: 3434, y: 248 },
  platforms: [
    island(0, 264, 734, 84), island(798, 258, 234, 82),
    // The long low promenade is a safe way back to either end of the moving float.
    island(1032, 292, 818, 64), island(1918, 264, 502, 86),
    island(2484, 258, 486, 80), island(3038, 248, 482, 88),
  ],
  stamps: [
    stamp('ticket', 132, 242), stamp('band-note', 256, 168), stamp('bass-clef', 478, 106),
    stamp('midway-gap', 768, 170), stamp('dock-ticket', 986, 237), stamp('kite-tail', 1190, 195),
    stamp('float-mail', 1390, 169), stamp('checkpoint-card', 1780, 266), stamp('starlight-gap', 1882, 200),
    stamp('star-post', 2135, 220), stamp('lantern-gap', 2452, 170), stamp('royal-post', 3340, 222),
  ],
  patrols: [
    { id: 'ticket-taker', left: 806, right: 840, floorY: 258, speed: 24 },
    { id: 'usher', left: 3038, right: 3072, floorY: 248, speed: 28 },
  ],
}

export const ROUTES: Record<RouteId, Level> = { morning: LEVEL, carnival }
