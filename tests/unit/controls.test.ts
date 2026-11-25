import { expect, it } from 'vitest'
import { Controls } from '../../src/controls'

it('keeps movement down while a second finger jumps, consuming the press once', () => {
  const input = new Controls()
  input.press('finger-1', 'right')
  input.press('finger-2', 'jump')
  expect(input.frame()).toEqual({ direction: 1, jumpPressed: true, jumpHeld: true })
  expect(input.frame().jumpPressed).toBe(false)
  input.release('finger-2')
  expect(input.frame()).toEqual({ direction: 1, jumpPressed: false, jumpHeld: false })
})

it('resolves opposing inputs by recency and clears them when the game pauses', () => {
  const input = new Controls()
  input.press('ArrowRight', 'right')
  input.press('KeyA', 'left')
  input.press('ArrowRight', 'right')
  expect(input.frame().direction).toBe(-1)
  input.release('KeyA')
  expect(input.frame().direction).toBe(1)
  input.press('Space', 'jump')
  input.clear()
  expect(input.frame()).toEqual({ direction: 0, jumpPressed: false, jumpHeld: false })
})

it('retains a quick jump tap between animation frames', () => {
  const input = new Controls()
  input.press('finger', 'jump')
  input.release('finger')
  expect(input.frame()).toEqual({ direction: 0, jumpPressed: true, jumpHeld: false })
})
