import { existsSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { loadGraphics } from '../../src/graphics'
import { courierFrame } from '../../src/scene-layout'

afterEach(() => vi.unstubAllGlobals())

it('loads the bundled post office as part of the playable scene', async () => {
  vi.stubGlobal('Image', class {
    src = ''
    async decode() {
      expect(existsSync('public' + new URL(this.src, 'http://localhost').pathname)).toBe(true)
    }
  })
  const graphics = await loadGraphics()
  expect(graphics['post-office']?.src).toMatch(/\/art\/post-office\.webp$/)
})

it('cycles two grounded idle poses, retaining a steady pose for reduced motion', () => {
  const idle = { grounded: true, vx: 0, vy: 0 }
  const frames = (reduced: boolean) => new Set(Array.from({ length: 120 }, (_, tick) =>
    courierFrame(idle, tick, reduced)))
  expect(frames(false)).toEqual(new Set([0, 4]))
  expect(frames(true)).toEqual(new Set([0]))
})

it('chooses separate ascent, apex and descent poses based on vertical velocity', () => {
  const air = (vy: number) => courierFrame({ grounded: false, vx: 150, vy }, 0, false)
  expect([air(-350), air(0), air(280)]).toEqual([3, 5, 6])
  expect(air(-18)).toBe(air(18))
})

it('keeps the original run frames and cadence', () => {
  const running = { grounded: true, vx: -120, vy: 0 }
  expect([0, 8, 16].map(tick => courierFrame(running, tick, false))).toEqual([1, 2, 1])
})
