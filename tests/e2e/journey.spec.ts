import { expect, test, type Page } from '@playwright/test'
import { carnivalFinishTick, carnivalInputTrace } from '../fixtures/carnival-route'

async function startDelivery(page: Page, hero: 'Nia' | 'Finn', touch = false) {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:01:00Z'))
  await page.goto('games/bellwind-post/')
  await expect(page.getByRole('button', { name: 'Cloud Carnival', exact: true })).toBeDisabled()
  for (const name of [new RegExp(hero, 'i'), /start delivery/i]) {
    const button = page.getByRole('button', { name })
    if (touch) await button.tap({ force: true })
    else await button.click({ force: true })
  }
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

type CarnivalControl = 'left' | 'right' | 'jump'
type SendControl = (control: CarnivalControl, held: boolean) => Promise<void>

async function playCarnival(page: Page, send: SendControl) {
  let elapsed = 0
  let direction = 0
  let jumping = false
  const release = { tick: carnivalFinishTick + 12, direction: 0, jump: false }
  for (const input of [...carnivalInputTrace, release]) {
    const time = Math.round(input.tick * 1000 / 60)
    if (time > elapsed) await page.clock.runFor(time - elapsed)
    elapsed = time
    if (direction !== input.direction) {
      if (direction) await send(direction < 0 ? 'left' : 'right', false)
      direction = input.direction
      if (direction) await send(direction < 0 ? 'left' : 'right', true)
    }
    if (jumping !== input.jump) {
      jumping = input.jump
      await send('jump', jumping)
    }
  }
  await expect(page.getByRole('heading', { name: 'Parade mail delivered!' })).toBeVisible()
  await expect(page.locator('#seals')).toHaveText('3')
  await expect(page.locator('#stamps')).toHaveText('12')
}

async function checkCarnivalStart(page: Page) {
  await expect(page.getByRole('heading', { name: 'Cloud Carnival', exact: true })).toBeVisible()
  await expect(page.locator('#seals')).toHaveText('0')
  await expect(page.locator('#objective')).toContainText(/drum|bandstand/i)
}

test('Nia finishes Morning Delivery and Cloud Carnival with the keyboard', async ({ page }) => {
  test.setTimeout(180_000)
  await startDelivery(page, 'Nia')
  await page.keyboard.down('ArrowRight')
  await flyRoute(page, () => page.keyboard.down('Space'), () => page.keyboard.up('Space'))
  await page.keyboard.up('ArrowRight')
  await expect(page.getByRole('heading', { name: /delivery complete/i })).toBeVisible()
  const next = page.getByRole('button', { name: 'Continue to Cloud Carnival' })
  await page.route('**/art/carnival/bandstand.webp', route => route.abort(), { times: 1 })
  await next.click({ force: true })
  await expect(page.getByRole('alert')).toContainText('Cloud Carnival')
  await expect(page.getByRole('heading', { name: /delivery complete/i })).toBeVisible()
  await next.click({ force: true })
  await checkCarnivalStart(page)
  // Pausing consumes no course ticks, so the same input trace works after resuming.
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Delivery paused' })).toBeVisible()
  await page.clock.runFor(1500)
  await page.getByRole('button', { name: 'Resume delivery' }).click({ force: true })
  const keys = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space' }
  await playCarnival(page, async (control, held) => {
    if (held) await page.keyboard.down(keys[control])
    else await page.keyboard.up(keys[control])
  })
  await page.getByRole('button', { name: /choose courier/i }).click({ force: true })
  await expect(page.getByRole('button', { name: /finn/i })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Cloud Carnival', exact: true })).toBeEnabled()
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

  test('Finn completes both routes with two fingers and storage disabled', async ({ page, context }) => {
    test.setTimeout(180_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError') } })
    })
    await startDelivery(page, 'Finn', true)
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
    await page.getByRole('button', { name: 'Continue to Cloud Carnival' }).tap({ force: true })
    await checkCarnivalStart(page)
    await page.getByRole('button', { name: 'Mute sound', exact: true }).tap({ force: true })
    await expect(page.getByRole('button', { name: 'Enable sound' })).toBeVisible()
    const contacts = new Map<CarnivalControl, Awaited<ReturnType<typeof contact>>>()
    await playCarnival(page, async (control, held) => {
      if (held) {
        contacts.set(control, await contact('#' + control, control === 'jump' ? 2 : 1))
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...contacts.values()] })
      } else {
        const released = contacts.get(control)!
        contacts.delete(control)
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: contacts.size ? [released] : [] })
      }
    })
    await page.getByRole('button', { name: /choose courier/i }).tap({ force: true })
    await expect(page.getByRole('button', { name: 'Cloud Carnival', exact: true })).toBeEnabled()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Cloud Carnival', exact: true })).toBeDisabled()
  })
})
