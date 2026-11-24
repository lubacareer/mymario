export type CourseId = 'dawn' | 'iceglass' | 'ember'

/** World coordinates are metres. Z increases down the road and Y increases upwards. */
export interface Surface {
  xMin: number
  xMax: number
  zMin: number
  zMax: number
  height: number
  kind: 'road' | 'supply' | 'barrier'
  speedLimit?: number
}

export interface Course {
  id: CourseId
  name: string
  description: string
  length: number
  gravity: number
  surfaces: Surface[]
}

const road = (zMin: number, zMax: number, xMin = -6, xMax = 6, height = 0): Surface =>
  ({ zMin, zMax, xMin, xMax, height, kind: 'road' })
const supply = (zMin: number, zMax: number, xMin = -6, xMax = 6): Surface =>
  ({ ...road(zMin, zMax, xMin, xMax), kind: 'supply' })
const barrier = (zMin: number, zMax: number, xMin: number, xMax: number): Surface =>
  ({ ...road(zMin, zMax, xMin, xMax, 4.5), kind: 'barrier' })

export const COURSES: Course[] = [
  {
    id: 'dawn', name: 'Dawn Array', length: 480, gravity: 18,
    description: 'Wide decks, three sunlit gaps, and a full-width supply strip.',
    surfaces: [
      road(0, 64), road(76, 152), barrier(117, 125, -1.9, 1.9),
      supply(152, 164), road(164, 240), road(255, 328, -1.5, 7),
      road(328, 385), road(398, 492),
    ],
  },
  {
    id: 'iceglass', name: 'Iceglass Relay', length: 480, gravity: 13.5,
    description: 'Float farther in low gravity. Wide left landings offer a safer line.',
    surfaces: [
      road(0, 73),
      // A raised right-hand spur offers an earlier but narrower landing.
      road(90, 167, -7, 1.7), road(83, 153, 3, 5, 0.9), road(153, 167, 3, 5),
      road(167, 213), supply(213, 227, -6, -0.6), road(213, 227, -0.6, 6),
      road(227, 280), road(302, 330, -7, 1.7), road(293, 330, 3, 5, 0.9),
      road(330, 385), barrier(340, 352, -1.4, 1.4), road(401, 492, -1, 7),
    ],
  },
  {
    id: 'ember', name: 'Ember Foundry', length: 500, gravity: 22.5,
    description: 'Heavy gravity. Refuel at 20 m/s on the left or jump right at full speed.',
    surfaces: [
      road(0, 79), road(91, 145, -1.3, 6.4), barrier(120, 128, -1.9, 1.9),
      road(145, 198),
      // The service viaduct stays level through the fork. The direct line must clear a gap.
      road(198, 210, -6, -1), { ...supply(210, 223, -6, -1), speedLimit: 20 }, road(223, 244, -6, -1),
      road(198, 200, 0.3, 6), road(216, 244, 0.3, 6), road(244, 290),
      road(303, 336, -6.4, 0.75), road(336, 386), barrier(356, 368, -2.8, 0.3),
      road(399, 512, -6, -0.7),
    ],
  },
]

/** The ship's central landing skid and the rendered shadow query these same deck edges. */
export function topSurfaceAt(course: Course, x: number, z: number): Surface | undefined {
  let top: Surface | undefined
  for (const surface of course.surfaces) {
    if (z >= surface.zMin && z < surface.zMax && x >= surface.xMin && x < surface.xMax
      && (!top || surface.height >= top.height)) top = surface
  }
  return top
}
