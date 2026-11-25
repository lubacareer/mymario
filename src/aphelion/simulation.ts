import { topSurfaceAt, type Course, type Surface } from './courses'

export const STEP = 1 / 60
export const MIN_SPEED = 12
export const MAX_SPEED = 30
const CRUISE_SPEED = 20
const ACCELERATION = 8
const STEERING_SPEED = 6
const JUMP_SPEED = 10.8
const FALL_LIMIT = -4
const OXYGEN_PER_SECOND = 4.2
const BASE_FUEL_PER_SECOND = 1.7
const SPEED_FUEL_FACTOR = 0.0029

export interface FlightInput {
  steer: -1 | 0 | 1
  throttle: -1 | 0 | 1
  jump: boolean
}
export type FlightEvent = 'jump' | 'refill' | 'crash' | 'finish'
export type Failure = 'impact' | 'fall' | 'fuel' | 'oxygen'
export interface RunState {
  course: Course
  x: number
  y: number
  z: number
  vy: number
  speed: number
  grounded: boolean
  elapsed: number
  fuel: number
  oxygen: number
  status: 'racing' | 'crashed' | 'finished'
  failure: Failure | null
  supplyContact: Surface | null
}

export function createRun(course: Course): RunState {
  return {
    course, x: 0, y: 0, z: 0, vy: 0, speed: CRUISE_SPEED, grounded: true,
    elapsed: 0, fuel: 100, oxygen: 100, status: 'racing', failure: null, supplyContact: null,
  }
}

function crash(run: RunState, cause: Failure, events: FlightEvent[]) {
  run.status = 'crashed'
  run.failure = cause
  events.push('crash')
}

// The endpoint is inside the footprint. At a corner both axes must have entered it.
function deckEntryFraction(deck: Surface, x0: number, z0: number, x1: number, z1: number) {
  let entry = Math.max(0, (deck.zMin - z0) / (z1 - z0))
  if (x0 < deck.xMin) entry = Math.max(entry, (deck.xMin - x0) / (x1 - x0))
  else if (x0 >= deck.xMax) entry = Math.max(entry, (deck.xMax - x0) / (x1 - x0))
  return entry
}

/** Integrate one fixed tick. A raised surface has a solid front and sides; land only from above. */
export function stepRun(run: RunState, input: FlightInput): FlightEvent[] {
  const events: FlightEvent[] = []
  if (run.status !== 'racing') return events

  run.elapsed += STEP
  const speedLimit = run.supplyContact?.speedLimit ?? MAX_SPEED
  run.speed = Math.max(MIN_SPEED, Math.min(speedLimit, run.speed + input.throttle * ACCELERATION * STEP))
  const priorX = run.x
  const priorZ = run.z
  run.x += input.steer * STEERING_SPEED * STEP
  run.z += run.speed * STEP
  if (run.grounded && input.jump) {
    run.vy = JUMP_SPEED
    run.grounded = false
    events.push('jump')
  }
  const priorY = run.y
  const startedGrounded = run.grounded
  run.vy -= run.course.gravity * STEP
  const verticalTravel = run.vy * STEP
  run.y += verticalTravel
  const deck = topSurfaceAt(run.course, run.x, run.z)
  run.grounded = false
  if (deck) {
    // A rolling skid stays level across seams between adjacent coplanar decks.
    const entryY = startedGrounded ? priorY
      : priorY + deckEntryFraction(deck, priorX, priorZ, run.x, run.z) * verticalTravel
    if (entryY < deck.height || (deck.kind === 'barrier' && run.y <= deck.height)) {
      crash(run, 'impact', events)
      return events
    }
    if (run.y <= deck.height) {
      run.y = deck.height
      run.vy = 0
      run.grounded = true
    }
  }

  run.oxygen = Math.max(0, run.oxygen - OXYGEN_PER_SECOND * STEP)
  run.fuel = Math.max(0, run.fuel - (BASE_FUEL_PER_SECOND + SPEED_FUEL_FACTOR * run.speed ** 2) * STEP)
  const supply = run.grounded && deck?.kind === 'supply' ? deck : null
  if (supply && supply !== run.supplyContact) {
    run.speed = Math.min(run.speed, supply.speedLimit ?? MAX_SPEED)
    run.fuel = run.oxygen = 100
    events.push('refill')
  }
  run.supplyContact = supply

  if (run.y < FALL_LIMIT) crash(run, 'fall', events)
  else if (run.fuel === 0) crash(run, 'fuel', events)
  else if (run.oxygen === 0) crash(run, 'oxygen', events)
  else if (priorZ < run.course.length && run.z >= run.course.length) {
    // Sample the line itself: a steering tick can straddle both its end and a side edge.
    const fraction = (run.course.length - priorZ) / (run.z - priorZ)
    const crossingX = priorX + fraction * (run.x - priorX)
    const crossingY = priorY + fraction * verticalTravel
    const gate = topSurfaceAt(run.course, crossingX, run.course.length)
    if (gate && gate.kind !== 'barrier') {
      // The deck supports an earlier landing, or a rolling skid that leaves just past the line.
      const supported = (run.grounded && deck === gate)
        || (startedGrounded && topSurfaceAt(run.course, priorX, priorZ) === gate)
      if (crossingY >= gate.height || supported) {
        run.status = 'finished'
        events.push('finish')
      }
    }
  }
  return events
}
