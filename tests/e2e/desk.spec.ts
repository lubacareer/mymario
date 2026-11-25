import { expect, test, type Page } from '@playwright/test'

test('courier selection, field guide, mute, and pause work from the dispatch desk', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('games/bellwind-post/')
  await expect(page).toHaveTitle(/Bellwind Post/)
  await page.getByRole('button', { name: 'Field guide' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: /Finn/ }).click()
  await expect(page.getByRole('button', { name: /Finn/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
  await page.getByRole('button', { name: 'Start delivery' }).click()
  await expect(page.locator('#stage')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume delivery' }).click()
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeHidden()
  await expect(page.locator('#lives')).toHaveText('3')
  expect(errors).toEqual([])
})

test('Space clears the first gap immediately after muting during a delivery', async ({ page }) => {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:01:00Z'))
  await page.goto('games/bellwind-post/')
  await page.getByRole('button', { name: 'Start delivery' }).click({ force: true })
  await expect(page.locator('#stage')).toBeVisible()
  await page.keyboard.down('ArrowRight')
  await page.clock.runFor(2017) // 121 ticks to the first takeoff.
  await page.getByRole('button', { name: 'Mute sound' }).click({ force: true })
  await page.keyboard.down('Space')
  await page.clock.runFor(600)
  await page.keyboard.up('Space')
  await page.clock.runFor(900)
  await page.keyboard.up('ArrowRight')
  await expect(page.locator('#lives')).toHaveText('3')
  await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
})

test('landscape players can mute beside Pause and retain their preference at the desk', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 })
  await page.goto('games/bellwind-post/')
  await page.getByRole('button', { name: 'Start delivery' }).click()
  const hud = page.locator('.hud')
  await expect(hud.getByRole('button', { name: 'Mute sound' })).toBeInViewport()
  await hud.getByRole('button', { name: 'Mute sound' }).click()
  await expect(hud.getByRole('button', { name: 'Enable sound' })).toBeInViewport()
  const pause = hud.getByRole('button', { name: 'Pause delivery' })
  await pause.focus()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Choose courier' }).click()
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Enable sound' })).toBeVisible()
})

test('the stamp total stays on one line and the HUD fits narrow phones', async ({ page }) => {
  await page.goto('games/bellwind-post/')
  await page.getByRole('button', { name: 'Start delivery' }).click()
  await expect(page.locator('#stage')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 760 })
    const layout = await page.locator('[aria-label="Stamps"] small').evaluate(total => {
      const text = document.createRange()
      text.selectNodeContents(total)
      const hud = total.closest('.hud')!
      return {
        lines: text.getClientRects().length,
        width: document.documentElement.scrollWidth,
        fitsHeader: hud.getBoundingClientRect().right <= hud.parentElement!.getBoundingClientRect().right + 0.5,
      }
    })
    expect(layout, `Gameplay HUD at ${width}px`).toEqual({ lines: 1, width, fitsHeader: true })
    await expect(page.getByRole('button', { name: 'Pause delivery' })).toBeInViewport({ ratio: 1 })
    await expect(page.getByRole('button', { name: 'Mute sound' })).toBeInViewport({ ratio: 1 })
  }
})

async function delaySceneLoad(page: Page) {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const artwork = '**/art/beetle.webp'
  await page.route(artwork, async route => {
    await gate
    await route.continue()
  })
  await page.goto('games/bellwind-post/')
  const requested = page.waitForRequest(artwork)
  await page.getByRole('button', { name: 'Start delivery' }).click()
  await requested
  return release
}

test('opening the field guide while scene art loads requires an explicit resume', async ({ page }) => {
  const finishLoading = await delaySceneLoad(page)
  try {
    await page.getByRole('button', { name: 'Field guide' }).click()
  } finally {
    finishLoading()
  }
  await expect(page.locator('#stage')).toBeVisible()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume delivery' }).click()
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeHidden()
})

test('a delivery loaded in a hidden tab is paused when the player returns', async ({ page }) => {
  const finishLoading = await delaySceneLoad(page)
  try {
    // Headless tabs stay visible. Model the browser property and its event together.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
  } finally {
    finishLoading()
  }
  await expect(page.locator('#stage')).toBeVisible()
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume delivery' }).click()
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeHidden()
})
