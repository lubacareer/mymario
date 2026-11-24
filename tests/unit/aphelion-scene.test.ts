import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createProjector } from '../../src/aphelion/scene'

it.each([[1200, 675], [375, 520]])('projects readable depth and elevation in a %s x %s viewport', (width, height) => {
  const project = createProjector(width, height, 0, 100)
  const here = project(0, 0, 100)
  const ahead = project(0, 0, 150)
  expect(here.x).toBeCloseTo(width / 2)
  expect(here.y).toBeGreaterThan(height / 2)
  expect(here.y).toBeLessThan(height)
  expect(ahead.y).toBeLessThan(here.y)
  expect(project(3, 0, 150).x - ahead.x).toBeLessThan(project(3, 0, 100).x - here.x)
  expect(project(0, 2, 100).y).toBeLessThan(here.y)
})

it.each(['dawn-array', 'iceglass-relay', 'ember-foundry'])('ships a real WebP panorama for %s', name => {
  const data = readFileSync(`public/art/aphelion/${name}.webp`)
  expect(data.toString('ascii', 0, 4)).toBe('RIFF')
  expect(data.toString('ascii', 8, 12)).toBe('WEBP')
  expect(data.length).toBeGreaterThan(20_000)
})
