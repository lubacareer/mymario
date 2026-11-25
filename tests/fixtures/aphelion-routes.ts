import type { CourseId } from '../../src/aphelion/courses'

interface Route {
  steering: [number, number, -1 | 1][]
  jumps: number[]
}

/** Real input times in seconds, measured from launch at the default 20 m/s. */
export const routes: Record<CourseId, Route> = {
  dawn: { steering: [[0, 0.60, 1]], jumps: [2.8, 11.75, 18.95] },
  iceglass: { steering: [[0, 0.60, -1], [17.80, 19.00, 1]], jumps: [3.3, 13.75, 18.85] },
  ember: { steering: [[0, 0.65, 1], [7.0, 8.35, -1]], jumps: [3.75, 14.325, 19.125] },
}
