export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Platform extends Rect {
  kind: 'island' | 'ledge'
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
export const LEVEL = {
  width: 3640,
  height: 360,
  spawn: { x: 56, y: 264 },
  checkpoint: { x: 1600, y: 250 },
  bell: { x: 3552, y: 256 },
  platforms,
  stamps: [
    stamp('yard', 188, 240), stamp('rooftop', 372, 176),
    stamp('first-gap', 608, 171), stamp('post-road', 874, 230),
    stamp('blue-gap', 1054, 162), stamp('lookout', 1410, 218),
    stamp('windmill', 1600, 223), stamp('windmill-roof', 1960, 162),
    stamp('windward', 2108, 158), stamp('beetle-trail', 2780, 218),
    stamp('final-crossing', 2950, 168), stamp('bell-approach', 3262, 156),
  ],
  patrols: [
    { id: 'mill', left: 1730, right: 1822, floorY: 250, speed: 34 },
    { id: 'meadow', left: 2638, right: 2748, floorY: 262, speed: 42 },
    { id: 'tower', left: 3390, right: 3482, floorY: 256, speed: 38 },
  ],
}
