import { describe, expect, it } from 'vitest'
import { cameraLayout, islandSlices } from '../../src/scene-layout'

describe('camera layout', () => {
  it('keeps the start and finish inside the authored stage', () => {
    const start = cameraLayout(960, 540, 20, 3200)
    const finish = cameraLayout(960, 540, 3190, 3200)
    expect(start.cameraX).toBe(0)
    expect(finish.cameraX + finish.width).toBeCloseTo(3200)
    expect(start.height).toBe(360)
  })

  it('leaves room to see a landing on a narrow phone', () => {
    const view = cameraLayout(375, 667, 980, 3200)
    expect(view.width).toBeGreaterThanOrEqual(375)
    expect(view.cameraX + view.width - 980).toBeGreaterThan(170)
    expect(view.offsetY + 260).toBeLessThan(view.height - 64)
  })

  it('fits the full stage height on short landscape screens', () => {
    const view = cameraLayout(667, 285, 980, 3200)
    expect(view.height).toBeCloseTo(360)
    expect(view.width * view.scale).toBeCloseTo(667)
    expect(view.offsetY).toBe(0)
  })
})

describe('island surface mapping', () => {
  it('ends the mirrored grass pattern in the right-facing orientation', () => {
    const middleSegments = islandSlices(800, 950, 120).length - 2
    expect(middleSegments % 2).toBe(1)
  })
  it.each([40, 95, 380, 1120])('covers a %i px platform without gaps or overshooting the collider', width => {
    const parts = islandSlices(width, 880, 300)
    let end = 0
    for (const part of parts) {
      expect(part.x).toBeCloseTo(end)
      expect(part.width).toBeGreaterThan(0)
      expect(part.sourceWidth).toBeGreaterThan(0)
      expect(part.sourceX + part.sourceWidth).toBeLessThanOrEqual(880)
      end += part.width
    }
    expect(end).toBeCloseTo(width)
  })
})
