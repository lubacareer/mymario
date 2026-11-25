import { expect, it } from 'vitest'
import { createGame, stepGame, type GameState, type InputFrame } from '../../src/game/simulation'
import { boothSeals, CARNIVAL_PROPS as props, floatAt } from '../../src/game/carnival'
import type { Rect } from '../../src/game/level'
import { carnivalInputTrace, carnivalFinishTick, carnivalRecoveryTrace } from '../fixtures/carnival-route'

const idle: InputFrame = { direction: 0, jumpHeld: false, jumpPressed: false }
function land(state: GameState, top: Rect) {
  Object.assign(state.player, { x: top.x + top.w / 2 - state.player.w / 2, y: top.y - state.player.h - 1,
    vx: 0, vy: 155, grounded: false })
  return stepGame(state, idle)
}

it('starts either courier on the chosen route, with Morning Delivery as the default', () => {
  expect(createGame('nia').level.id).toBe('morning')
  const carnival = createGame('finn', 'carnival')
  expect(carnival.level.name).toBe('Cloud Carnival')
  expect(carnival.level.stamps).toHaveLength(12)
  expect(carnival.booths.drum).toBe(false)
})

it('springs the courier from the drum on every landing and awards the band seal only once', () => {
  const state = createGame('nia', 'carnival')
  for (let bounce = 0; bounce < 2; bounce++) {
    expect(land(state, props.drum)).toContain('drum')
    expect(state.player.vy).toBeLessThan(-400)
    expect(state.player.grounded).toBe(false)
    expect(boothSeals(state.booths)).toBe(1)
  }
})

it('carries a stationary rider over the turnaround; jumping leaves the float', () => {
  const state = createGame('finn', 'carnival')
  state.ticks = 10
  land(state, floatAt(state.ticks))
  const offset = state.player.x - floatAt(state.ticks).x
  for (let frame = 0; frame < 60; frame++) {
    stepGame(state, idle)
    expect(state.player.x - floatAt(state.ticks).x).toBeCloseTo(offset)
    expect(state.player.y + state.player.h).toBe(floatAt(state.ticks).y)
  }
  stepGame(state, { ...idle, jumpPressed: true, jumpHeld: true })
  const airborneX = state.player.x
  stepGame(state, { ...idle, jumpHeld: true })
  expect(state.player.x).toBe(airborneX)
  expect(state.player.grounded).toBe(false)
})

it('requires three distinct ribbons and both lanterns, which can be lit in reverse order', () => {
  const state = createGame('nia', 'carnival')
  for (const ribbon of props.ribbons) {
    Object.assign(state.player, { x: ribbon.x - 8, y: ribbon.y - 16, vy: 0 })
    expect(stepGame(state, idle)).toContain('ribbon')
    expect(stepGame(state, idle)).not.toContain('ribbon')
  }
  expect(boothSeals(state.booths)).toBe(1)
  expect(land(state, props.lanterns[1])).toContain('lantern')
  expect(boothSeals(state.booths)).toBe(1)
  expect(land(state, props.lanterns[1])).not.toContain('lantern')
  expect(land(state, props.lanterns[0])).toContain('lantern')
  expect(boothSeals(state.booths)).toBe(2)
})

it('blocks the rooftop arch until all three seals, then lets the courier walk to the bell', () => {
  const state = createGame('nia', 'carnival')
  Object.assign(state.player, { x: props.gate.x - state.player.w - 1, y: state.level.bell.y - state.player.h })
  const right: InputFrame = { ...idle, direction: 1 }
  for (let frame = 0; frame < 90; frame++) stepGame(state, right)
  expect(state.player.x + state.player.w).toBeLessThanOrEqual(props.gate.x)
  state.booths.drum = true
  props.ribbons.forEach(({ id }) => state.booths.ribbons.add(id))
  props.lanterns.forEach(({ id }) => state.booths.lanterns.add(id))
  for (let frame = 0; frame < 90; frame++) stepGame(state, right)
  expect(state.status).toBe('won')
})

it('keeps partial booth progress and stamps at the checkpoint; a fresh attempt starts empty', () => {
  const state = createGame('finn', 'carnival')
  land(state, props.drum)
  const kite = props.ribbons[0]
  Object.assign(state.player, { x: kite.x - 8, y: kite.y - 16, vy: 0 })
  stepGame(state, idle)
  Object.assign(state.player, { x: state.level.checkpoint.x, y: state.level.checkpoint.y - state.player.h, vy: 0 })
  stepGame(state, idle)
  expect(state.checkpoint).toBe(true)
  expect(state.collected.size).toBeGreaterThan(0)
  state.player.y = state.level.height + 100
  expect(stepGame(state, idle)).toContain('hurt')
  expect(state.lives).toBe(2)
  expect(state.player.x + state.player.w / 2).toBe(state.level.checkpoint.x)
  expect(state.booths.drum).toBe(true)
  expect(state.booths.ribbons.has(kite.id)).toBe(true)
  expect(state.collected.size).toBeGreaterThan(0)
  const fresh = createGame('finn', 'carnival')
  expect(boothSeals(fresh.booths)).toBe(0)
  expect(fresh.booths.ribbons.size).toBe(0)
  expect(fresh.collected.size).toBe(0)
})

function* replay(state: GameState, trace: typeof carnivalInputTrace, ticks: number) {
  let input = idle
  let next = 0
  for (let tick = 0; tick < ticks; tick++) {
    const change = trace[next]?.tick === tick ? trace[next++] : undefined
    const jump = change?.jump ?? input.jumpHeld
    input = { direction: change?.direction ?? input.direction, jumpHeld: jump, jumpPressed: jump && !input.jumpHeld }
    yield* stepGame(state, input)
  }
}

it.each(['nia', 'finn'] as const)('delivers with %s using ordinary inputs and collects all 12 stamps', hero => {
  const state = createGame(hero, 'carnival')
  expect([...replay(state, carnivalInputTrace, carnivalFinishTick)]).toContain('victory')
  expect(state.status).toBe('won')
  expect(state.lives).toBe(3)
  expect(state.checkpoint).toBe(true)
  expect(boothSeals(state.booths)).toBe(3)
  expect(state.collected.size).toBe(12)
})

it('can recover a missed high ribbon after falling and backtracking from the checkpoint', () => {
  const state = createGame('nia', 'carnival')
  const events = replay(state, carnivalRecoveryTrace, 960)
  for (const event of events) {
    if (event === 'hurt') {
      expect(state.checkpoint).toBe(true)
      expect(state.player.x + state.player.w / 2).toBe(state.level.checkpoint.x)
      expect(state.booths.ribbons).toEqual(new Set(['kite-blue', 'kite-coral']))
    }
  }
  expect(state.lives).toBe(2)
  expect(boothSeals(state.booths)).toBe(2)
  expect(state.booths.ribbons.has('kite-gold')).toBe(true)
})
