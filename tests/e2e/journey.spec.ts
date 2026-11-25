import { expect, test, type Page } from '@playwright/test'

async function startDelivery(page: Page, hero: 'Nia' | 'Finn') {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:01:00Z'))
  await page.goto('games/bellwind-post/')
  await page.getByRole('button', { name: new RegExp(hero, 'i') }).click({ force: true })
  await page.getByRole('button', { name: /start delivery/i }).click({ force: true })
  await expect(page.locator('#stage')).toBeVisible()
  await expect(page.locator('#lives')).toContainText('3')
}

// Times from a real forward run. All interactions pass through the game's
// regular input listeners; the clock keeps the route repeatable on CI.
const takeoffs = [121, 230, 341, 416, 496, 591, 643, 706, 783, 833]

async function flyRoute(page: Page, pressJump: () => Promise<void>, releaseJump: () => Promise<void>) {
  let elapsed = 0
  const advanceTo = async (tick: number) => {
    const end = Math.round(tick * 1000 / 60)
    await page.clock.runFor(end - elapsed)
    elapsed = end
  }
  for (const takeoff of takeoffs) {
    await advanceTo(takeoff)
    await pressJump()
    await advanceTo(takeoff + 35)
    await releaseJump()
  }
  await advanceTo(900)
}

test('Nia delivers all the way to the bell with the keyboard', async ({ page }) => {
  await startDelivery(page, 'Nia')
  await page.keyboard.down('ArrowRight')
  await flyRoute(page, () => page.keyboard.down('Space'), () => page.keyboard.up('Space'))
  await page.keyboard.up('ArrowRight')
  await expect(page.getByRole('heading', { name: /delivery complete/i })).toBeVisible()
  await page.getByRole('button', { name: /choose courier/i }).click({ force: true })
  await expect(page.getByRole('button', { name: /finn/i })).toBeVisible()
})

test('three falls lead to game over and a clean retry', async ({ page }) => {
  await startDelivery(page, 'Nia')
  // Walking straight off the first island is enough to lose all three lives.
  for (const lives of [2, 1, 0]) {
    await page.keyboard.down('ArrowRight')
    await page.clock.runFor(3_200)
    await page.keyboard.up('ArrowRight')
    await expect(page.locator('#lives')).toHaveText(String(lives))
  }
  await expect(page.getByRole('heading', { name: /out of lives/i })).toBeVisible()
  await page.getByRole('button', { name: /try again/i }).click({ force: true })
  await expect(page.locator('#lives')).toContainText('3')
  await expect(page.locator('#stamps')).toHaveText(/^\s*0(?:\s*\/\s*12)?\s*$/)
})

test.describe('375px touchscreen', () => {
  test.use({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true })

  test('Finn reaches the bell using two fingers on the touch controls', async ({ page, context }) => {
    await startDelivery(page, 'Finn')
    const client = await context.newCDPSession(page)
    const contact = async (selector: string, id: number) => {
      const button = page.locator(selector)
      await expect(button).toBeInViewport()
      const rect = await button.boundingBox()
      if (!rect) throw new Error(`Missing touch target ${selector}`)
      return { id, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    }
    const right = await contact('#right', 1)
    const jump = await contact('#jump', 2)
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right] })
    await flyRoute(page,
      async () => { await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [right, jump] }) },
      async () => {
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [jump] })
        await expect(page.locator('#right')).toHaveAttribute('data-held', 'true')
        await expect(page.locator('#jump')).not.toHaveAttribute('data-held', 'true')
      },
    )
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('heading', { name: /delivery complete/i })).toBeVisible()
    expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([0, 0])
  })
})
