import { describe, expect, it } from 'vitest'
import { createGame, LEVEL, stepGame, type GameState, type InputFrame } from '../../src/game/simulation'

const idle: InputFrame = { direction: 0, jumpPressed: false, jumpHeld: false }
const running: InputFrame = { ...idle, direction: 1 }
const jump: InputFrame = { ...idle, jumpPressed: true, jumpHeld: true }

function advance(state: GameState, frames: number, input: InputFrame = idle) {
  for (let i = 0; i < frames; i++) stepGame(state, input)
}

function fall(state: GameState) {
  state.player.y = LEVEL.height + 100
  return stepGame(state, idle)
}

describe('courier movement', () => {
  it('gives both heroes identical starts, acceleration, jumps, and hitboxes', () => {
    const nia = createGame('nia')
    const finn = createGame('finn')
    advance(nia, 20, running)
    advance(finn, 20, running)
    expect(nia.player.vx).toBe(240)
    expect(stepGame(nia, jump)).toContain('jump')
    stepGame(finn, jump)
    expect(nia.player).toEqual(finn.player)
    expect(nia.player.vy).toBeLessThan(0)
    expect(nia.player.grounded).toBe(false)
  })

  it('produces a roughly 80px held jump and a shorter tap, then lands on the same floor', () => {
    const apex = (hold: boolean) => {
      const state = createGame('nia')
      const startY = state.player.y
      let minY = startY
      stepGame(state, jump)
      for (let i = 0; i < 75; i++) {
        stepGame(state, { ...idle, jumpHeld: hold })
        minY = Math.min(minY, state.player.y)
      }
      expect(state.player.y).toBeCloseTo(startY)
      expect(state.player.grounded).toBe(true)
      return startY - minY
    }
    expect(apex(true)).toBeCloseTo(80, 0)
    expect(apex(false)).toBeLessThan(45)
  })

  it('allows a jump shortly after stepping off a ledge, then expires the grace period', () => {
    const walkOff = (airFrames: number) => {
      const state = createGame('nia')
      const floor = LEVEL.platforms[0]!
      state.player.x = floor.x + floor.w - 1
      state.player.vx = 240
      advance(state, airFrames, running)
      expect(state.player.grounded).toBe(false)
      return stepGame(state, { ...jump, direction: 1 })
    }
    expect(walkOff(5)).toContain('jump')
    expect(walkOff(9)).not.toContain('jump')
  })

  it('buffers a jump just before landing and rejects a second midair jump', () => {
    const state = createGame('nia')
    stepGame(state, jump)
    advance(state, 8, { ...idle, jumpHeld: true })
    expect(stepGame(state, jump)).not.toContain('jump')
    for (let i = 0; i < 90 && !state.player.grounded; i++) stepGame(state, idle)
    expect(state.player.grounded).toBe(true)
    stepGame(state, jump)
    const floorY = LEVEL.platforms[0]!.y
    const almostLanded = () => state.player.vy > 0 && state.player.y + state.player.h > floorY - 9
    for (let i = 0; i < 90 && !almostLanded(); i++) {
      stepGame(state, { ...idle, jumpHeld: true })
    }
    expect(almostLanded()).toBe(true)
    const events = [...stepGame(state, jump)]
    for (let i = 0; i < 5; i++) events.push(...stepGame(state, { ...idle, jumpHeld: true }))
    expect(events.filter(e => e === 'jump')).toHaveLength(1)
    expect(state.player.vy).toBeLessThan(0)
  })
})

describe('stage rules', () => {
  it.each([0, 1, 5])('marks the jump across gap %i with an ascent, apex and descent', gap => {
    const islands = LEVEL.platforms.filter(platform => platform.kind === 'island')
    const edge = islands[gap].x + islands[gap].w
    const landing = islands[gap + 1].x
    const arc = LEVEL.stamps.filter(stamp => stamp.x >= edge - 48 && stamp.x <= landing + 48)
      .sort((a, b) => a.x - b.x)
    expect(arc).toHaveLength(3)
    const [ascent, apex, descent] = arc
    expect(ascent.x).toBeLessThan(edge)
    expect(apex.x).toBeGreaterThan(edge)
    expect(apex.x).toBeLessThan(landing)
    expect(descent.x).toBeGreaterThan(landing)
    expect(apex.y).toBeLessThanOrEqual(Math.min(ascent.y, descent.y) - 30)
  })

  const fullRoute = [45, 121, 230, 341, 431, 477, 591, 643, 706, 783, 833]
  it.each([
    { hero: 'nia', stamps: 10, takeoffs: [121, 230, 341, 416, 496, 591, 643, 706, 783, 833] },
    { hero: 'nia', stamps: 12, takeoffs: fullRoute },
    { hero: 'finn', stamps: 12, takeoffs: fullRoute },
  ] as const)('lets $hero deliver with $stamps stamps using real controls', ({ hero, stamps, takeoffs }) => {
    const state = createGame(hero)
    // The full route also visits the two optional rooftop stamps.
    const jumps = new Set<number>(takeoffs)
    let releaseAt = 0
    for (let frame = 0; frame < 960 && state.status === 'playing'; frame++) {
      const jumpPressed = jumps.has(frame)
      if (jumpPressed) releaseAt = frame + 35
      stepGame(state, { direction: 1, jumpPressed, jumpHeld: frame < releaseAt })
    }
    expect(state.status).toBe('won')
    expect(state.lives).toBe(3)
    expect(state.checkpoint).toBe(true)
    expect(state.collected.size).toBe(stamps)
  })

  it('awards each of twelve distinct stamps once and retains earned stamps across checkpoint respawns', () => {
    const state = createGame('finn')
    expect(new Set(LEVEL.stamps.map(stamp => stamp.id)).size).toBe(12)
    const stamp = LEVEL.stamps[0]!
    state.player.x = stamp.x - state.player.w / 2
    state.player.y = stamp.y - state.player.h / 2
    expect(stepGame(state, idle)).toContain('stamp')
    expect(stepGame(state, idle)).not.toContain('stamp')
    state.player.x = LEVEL.checkpoint.x
    state.player.y = LEVEL.checkpoint.y - state.player.h
    expect(stepGame(state, idle)).toContain('checkpoint')
    expect(fall(state)).toContain('hurt')
    expect(state.lives).toBe(2)
    expect(Math.abs(state.player.x - LEVEL.checkpoint.x)).toBeLessThan(48)
    expect(state.collected.has(stamp.id)).toBe(true)
    expect(state.checkpoint).toBe(true)
  })

  it('bounces on falling contact from above, takes damage from the side and restores patrols on respawn', () => {
    const state = createGame('finn')
    const beetle = state.enemies[0]!
    state.player.x = beetle.x
    state.player.y = beetle.y - state.player.h - 1
    state.player.vy = 160
    state.player.grounded = false
    expect(stepGame(state, idle)).toContain('stomp')
    expect(state.player.vy).toBeLessThan(0)
    expect(beetle.alive).toBe(false)
    const next = state.enemies[1]!
    state.player.x = next.x - state.player.w + 3
    state.player.y = next.y + next.h - state.player.h
    state.player.vy = 0
    expect(stepGame(state, idle)).toContain('hurt')
    expect(state.lives).toBe(2)
    expect(state.enemies.every(enemy => enemy.alive)).toBe(true)
  })

  it('ends on the third lost life and a new run clears all old state', () => {
    const state = createGame('nia')
    fall(state)
    fall(state)
    expect(fall(state)).toContain('gameover')
    expect(state.status).toBe('lost')
    const ticks = state.ticks
    expect(stepGame(state, jump)).toEqual([])
    expect(state.ticks).toBe(ticks)
    const fresh = createGame('finn')
    expect(fresh.status).toBe('playing')
    expect(fresh.lives).toBe(3)
    expect(fresh.collected.size).toBe(0)
    expect(fresh.checkpoint).toBe(false)
  })

  it('rings the bell once even with zero stamps', () => {
    const state = createGame('finn')
    state.player.x = LEVEL.bell.x
    state.player.y = LEVEL.bell.y - state.player.h
    expect(stepGame(state, idle)).toContain('victory')
    expect(state.status).toBe('won')
    expect(state.collected.size).toBe(0)
    expect(stepGame(state, idle)).toEqual([])
  })
})
