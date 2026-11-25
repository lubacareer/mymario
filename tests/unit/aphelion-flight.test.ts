import { describe, expect, it } from 'vitest'
import { COURSES, topSurfaceAt, type Course, type Surface } from '../../src/aphelion/courses'
import { createRun, MAX_SPEED, MIN_SPEED, STEP, stepRun, type FlightInput, type RunState } from '../../src/aphelion/simulation'
import { createProgressStore } from '../../src/aphelion/progress'
import { routes } from '../fixtures/aphelion-routes'

const idle: FlightInput = { steer: 0, throttle: 0, jump: false }
const road: Surface = { xMin: -6, xMax: 6, zMin: 0, zMax: 1000, height: 0, kind: 'road' }
const testCourse: Course = { id: 'dawn', name: 'Test', description: '', gravity: 18, length: 950, surfaces: [road] }
const advance = (run: RunState, ticks: number, input = idle) => {
  for (let i = 0; i < ticks; i++) stepRun(run, input)
}

describe('flight dynamics', () => {
  it('steers continuously, bounds the throttle and retains the selected speed on release', () => {
    const run = createRun(testCourse)
    advance(run, 30, { ...idle, steer: 1 })
    expect(run.x).toBeCloseTo(3)
    advance(run, 120, { ...idle, throttle: 1 })
    expect(run.speed).toBe(MAX_SPEED)
    advance(run, 30)
    expect(run.speed).toBe(MAX_SPEED)
    advance(run, 240, { ...idle, throttle: -1 })
    expect(run.speed).toBe(MIN_SPEED)
  })

  it('gives the same jump height at both speeds and a longer jump at higher speed', () => {
    const jump = (speed: number) => {
      const run = createRun(testCourse)
      run.speed = speed
      expect(stepRun(run, { ...idle, jump: true })).toContain('jump')
      expect(stepRun(run, { ...idle, jump: true })).not.toContain('jump')
      let apex = run.y
      while (!run.grounded && run.status === 'racing') {
        stepRun(run, idle)
        apex = Math.max(apex, run.y)
      }
      expect(run.grounded).toBe(true)
      expect(run.y).toBe(0)
      return { apex, distance: run.z }
    }
    const slow = jump(MIN_SPEED)
    const fast = jump(MAX_SPEED)
    expect(fast.apex).toBeCloseTo(slow.apex)
    expect(fast.distance).toBeCloseTo(slow.distance * MAX_SPEED / MIN_SPEED)
  })

  it('uses the same elevated deck for landing, shadow, and high front face impacts', () => {
    const ledge: Surface = { ...road, height: 1.25, zMin: 9, zMax: 90 }
    const course: Course = { ...testCourse, surfaces: [road, ledge] }
    expect(topSurfaceAt(course, 0, 14)).toBe(ledge)
    const hit = createRun(course)
    advance(hit, 100)
    expect(hit.failure).toBe('impact')
    const clear = createRun(course)
    stepRun(clear, { ...idle, jump: true })
    advance(clear, 90)
    expect(clear.status).toBe('racing')
    expect(clear.grounded).toBe(true)
    expect(clear.y).toBe(1.25)
  })

  it.each([
    { edge: 'front', x: 4, z: 82.733333, steer: 0 },
    { edge: 'left side', x: 2.92, z: 84, steer: 1 },
    { edge: 'right side at the front corner', x: 5.08, z: 82.94, steer: -1 },
  ] as const)('hits the Iceglass spur when the skid enters its $edge below the top', ({ x, z, steer }) => {
    const run = Object.assign(createRun(COURSES[1]), { x, z, y: 1.00125, vy: -9.225, grounded: false })
    expect(stepRun(run, { ...idle, steer })).toContain('crash')
    expect(run.failure).toBe('impact')
  })

  it('lands after clearing the front of the same spur earlier in the tick', () => {
    const run = Object.assign(createRun(COURSES[1]), { x: 4, z: 82.94, y: 1.00125, vy: -9.225, grounded: false })
    stepRun(run, idle)
    expect(run).toMatchObject({ status: 'racing', y: 0.9, grounded: true })
  })

  it('hits a raised face when ascending from below even if the tick ends above it', () => {
    const run = Object.assign(createRun(COURSES[1]), { x: 4, z: 82.95, y: 0.83, vy: 6.225, grounded: false })
    expect(stepRun(run, idle)).toContain('crash')
    expect(run.failure).toBe('impact')
  })

  it('ends a run from a fall or barrier contact and restarts with full meters', () => {
    const run = createRun({ ...testCourse, surfaces: [{ ...road, zMax: 5 }] })
    advance(run, 150)
    expect(run.failure).toBe('fall')
    const barrier: Surface = { ...road, zMin: 4, height: 4, kind: 'barrier' }
    const blocked = createRun({ ...testCourse, surfaces: [road, barrier] })
    advance(blocked, 40)
    expect(blocked.failure).toBe('impact')
    const after = { ...blocked }
    expect(stepRun(blocked, { ...idle, jump: true })).toEqual([])
    expect(blocked).toEqual(after)
    expect(createRun(blocked.course)).toMatchObject({ x: 0, z: 0, elapsed: 0, fuel: 100, oxygen: 100, status: 'racing' })
  })

  it('burns more fuel at speed while oxygen depends only on time, and ends on either depletion', () => {
    const slower = createRun(testCourse)
    const faster = createRun(testCourse)
    faster.speed = MAX_SPEED
    advance(slower, 60)
    advance(faster, 60)
    expect(faster.oxygen).toBeCloseTo(slower.oxygen)
    expect(faster.fuel).toBeLessThan(slower.fuel)
    slower.oxygen = 0.01
    faster.fuel = 0.01
    expect(stepRun(slower, idle)).toContain('crash')
    expect(stepRun(faster, idle)).toContain('crash')
    expect(slower).toMatchObject({ failure: 'oxygen', oxygen: 0 })
    expect(faster).toMatchObject({ failure: 'fuel', fuel: 0 })
  })

  it('refills once on contact and skips a strip cleared in the air', () => {
    const supply: Surface = { ...road, zMin: 3, zMax: 12, kind: 'supply' }
    const course: Course = { ...testCourse, surfaces: [road, supply] }
    const run = createRun(course)
    const events = []
    for (let n = 0; n < 45; n++) events.push(...stepRun(run, idle))
    expect(events).toEqual(['refill'])
    expect(run.fuel).toBeLessThan(100)
    const airborne = createRun(course)
    stepRun(airborne, { ...idle, jump: true })
    for (let n = 0; n < 45; n++) expect(stepRun(airborne, idle)).not.toContain('refill')
  })

  it('awards a finish only for crossing the painted stripe inside its edges', () => {
    const launchAtEdge = (x: number) => Object.assign(createRun(testCourse), {
      x, y: 1, z: testCourse.length - 0.01, grounded: false,
    })
    const missed = launchAtEdge(6.05)
    advance(missed, 3, { ...idle, steer: -1 })
    expect(missed.x).toBeLessThan(6)
    expect(missed.status).not.toBe('finished')
    const clear = launchAtEdge(5.95)
    expect(stepRun(clear, { ...idle, steer: 1 })).toContain('finish')
  })

  it.each([
    { approach: 'airborne below', y: 0.015, vy: -3, grounded: false, expected: false },
    { approach: 'airborne above', y: 0.15, vy: -3, grounded: false, expected: true },
    { approach: 'on the deck', y: 0, vy: 0, grounded: true, expected: true },
  ])('checks the $approach crossing before steering off the Ember finish deck', ({ y, vy, grounded, expected }) => {
    const run = Object.assign(createRun(COURSES[2]), { x: -0.775, z: 499.84, y, vy, grounded })
    const events = stepRun(run, { ...idle, steer: 1 })
    expect(events.includes('finish')).toBe(expected)
  })

  it('finishes when a descent lands on the finish deck before crossing the stripe', () => {
    const run = Object.assign(createRun(COURSES[2]), { x: -2, z: 499.75, y: 0.01, vy: -3, grounded: false })
    expect(stepRun(run, idle)).toContain('finish')
    expect(run.grounded).toBe(true)
  })
})

describe('authored courses', () => {
  for (const course of COURSES) {
    it(`clears ${course.name} using only player inputs and the supply line`, () => {
      const run = createRun(course)
      const route = routes[course.id]
      const events = []
      for (let frame = 0; frame < 2400 && run.status === 'racing'; frame++) {
        const steer = route.steering.find(([start, end]) => frame >= Math.round(start / STEP) && frame < Math.round(end / STEP))?.[2] ?? 0
        const jump = route.jumps.some(time => frame === Math.round(time / STEP))
        events.push(...stepRun(run, { steer, throttle: 0, jump }))
      }
      expect({ status: run.status, z: Math.round(run.z), failure: run.failure }).toMatchObject({ status: 'finished' })
      expect(events).toContain('refill')
      expect(events.at(-1)).toBe('finish')
      expect(run.fuel).toBeGreaterThan(0)
      expect(run.oxygen).toBeGreaterThan(0)
      expect(run.elapsed).toBeCloseTo(course.length / 20, 1)
    })
  }

  it('offers a full-throttle clear via the raised Iceglass spurs', () => {
    const run = createRun(COURSES[1])
    const jumps = [62, 267, 371]
    let next = 0
    let spurLandings = 0
    while (run.status === 'racing') {
      const jump = run.z >= jumps[next]
      if (jump) next++
      const wasAirborne = !run.grounded
      stepRun(run, { steer: run.x < 4 ? 1 : 0, throttle: 1, jump })
      if (wasAirborne && run.grounded && run.y > 0) spurLandings++
    }
    expect(run.status).toBe('finished')
    expect(spurLandings).toBe(2)
    expect(run.oxygen).toBeGreaterThan(0)
  })

  it('offers a full-speed Ember bypass that avoids the service lane speed limit', () => {
    const course = COURSES[2]
    const fast = createRun(course)
    const jumps = [70, 194, 282, 378]
    const events = []
    let next = 0
    while (fast.status === 'racing') {
      const jump = fast.z >= jumps[next]
      if (jump) next++
      const target = fast.z < 245 ? 4 : -4
      const steer = Math.abs(fast.x - target) < 0.1 ? 0 : fast.x < target ? 1 : -1
      events.push(...stepRun(fast, { steer, throttle: 1, jump }))
    }
    expect(fast.status).toBe('finished')
    expect(events).not.toContain('refill')
    expect(fast.speed).toBe(MAX_SPEED)
    const service = createRun(course)
    Object.assign(service, { z: 209.9, x: -4, speed: MAX_SPEED, oxygen: 10 })
    expect(stepRun(service, idle)).toContain('refill')
    expect(service.oxygen).toBe(100)
    expect(service.speed).toBeLessThan(fast.speed)
    const dockSpeed = service.speed
    advance(service, 10, { ...idle, throttle: 1 })
    expect(service.speed).toBe(dockSpeed)
  })
})

describe('cup progress', () => {
  it('unlocks roads in order, retains best times, and restores them on reload', () => {
    let saved: string | null = null
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
    const store = createProgressStore(storage)
    expect(store.isUnlocked('dawn')).toBe(true)
    expect(store.isUnlocked('iceglass')).toBe(false)
    store.recordClear('iceglass', 20)
    expect(store.bestTimes.iceglass).toBeUndefined()
    store.recordClear('dawn', 25)
    store.recordClear('dawn', 28)
    store.recordClear('dawn', 24)
    const next = createProgressStore(storage)
    expect(next.bestTimes.dawn).toBe(24)
    expect(next.isUnlocked('iceglass')).toBe(true)
    next.recordClear('iceglass', 23)
    expect(next.isUnlocked('ember')).toBe(true)
  })

  it('keeps the entire cup playable in memory with denied reads and writes', () => {
    const denied = () => { throw new Error('Storage denied') }
    const store = createProgressStore({ getItem: denied, setItem: denied })
    for (const course of COURSES) {
      expect(store.isUnlocked(course.id)).toBe(true)
      store.recordClear(course.id, 27)
      expect(store.bestTimes[course.id]).toBe(27)
    }
  })

  it.each(['invalid json', 'null', '[]', '{"dawn":-2,"iceglass":1}', '{"dawn":"bad"}', '{"iceglass":2}'])(
    'handles malformed or nonsequential progress %s', raw => {
      const store = createProgressStore({ getItem: () => raw, setItem: () => {} })
      expect(store.bestTimes).toEqual({})
      expect(store.isUnlocked('ember')).toBe(false)
    },
  )
})
