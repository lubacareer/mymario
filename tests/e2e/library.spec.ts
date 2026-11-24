import { expect, test } from '@playwright/test'

const games = [
  { title: 'Bellwind Post', path: 'games/bellwind-post/' },
  { title: 'Aphelion Run', path: 'games/aphelion-run/' },
]

test('the library launches both games and supports direct visits, refresh and Back', async ({ page, baseURL }) => {
  const missing: string[] = []
  page.on('pageerror', error => missing.push(error.message))
  page.on('response', response => {
    if (response.status() >= 400) missing.push(response.url())
  })
  for (const game of games) {
    await page.goto('.')
    await expect(page.getByRole('heading', { name: 'Orbit Arcade', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Play ' + game.title }).click()
    await expect(page).toHaveURL(new URL(game.path, baseURL).href)
    await expect(page).toHaveTitle(new RegExp(game.title))
    await page.goBack()
    await expect(page.getByRole('link', { name: 'Play ' + game.title })).toBeVisible()
    await page.goto(game.path)
    await page.reload()
    await expect(page).toHaveTitle(new RegExp(game.title))
    await page.getByRole('link', { name: 'Library', exact: true }).click()
    await expect(page).toHaveURL(new URL('.', baseURL).href)
  }
  expect(missing).toEqual([])
})

test('the library artwork loads and the game cards stack on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 750 })
  await page.goto('.')
  const cards = page.locator('main a')
  await expect(cards).toHaveCount(2)
  const [first, second] = await Promise.all([cards.first().boundingBox(), cards.last().boundingBox()])
  expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height)
  expect(await page.locator('main img').evaluateAll(async images => {
    await Promise.all(images.map(image => (image as HTMLImageElement).decode()))
    return images.length
  })).toBeGreaterThanOrEqual(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
})

test('Library is reachable from a paused Bellwind delivery in short landscape', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 })
  await page.goto('games/bellwind-post/')
  await page.getByRole('button', { name: 'Start delivery' }).click()
  await page.getByRole('button', { name: 'Pause delivery' }).click()
  const library = page.getByRole('link', { name: 'Library', exact: true })
  await expect(library).toBeInViewport({ ratio: 1 })
  await library.click()
  await expect(page).toHaveTitle(/Orbit Arcade/)
})
