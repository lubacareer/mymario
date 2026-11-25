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

it('loads carnival props and shared sprites only when the carnival route is opened', async () => {
  const requests: string[] = []
  vi.stubGlobal('Image', class {
    src = ''
    async decode() { requests.push(new URL(this.src, 'http://localhost').pathname) }
  })
  await loadGraphics()
  expect(requests.some(path => path.includes('/carnival/'))).toBe(false)
  requests.length = 0
  await loadGraphics('carnival')
  expect(requests).toEqual(expect.arrayContaining([
    '/art/carnival/sky.webp', '/art/carnival/bandstand.webp', '/art/carnival/kite-booth.webp',
    '/art/carnival/grandstand.webp', '/art/carnival/float.webp', '/art/carnival/crowd.webp',
    '/art/carnival/arch.webp', '/art/nia.webp', '/art/finn.webp', '/art/stamp.webp',
  ]))
  expect(requests).not.toContain('/art/sky.webp')
  expect(requests).not.toContain('/art/windmill.webp')
  for (const path of requests) expect(existsSync('public' + path), path).toBe(true)
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
