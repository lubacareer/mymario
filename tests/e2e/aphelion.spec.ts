import { expect, test, type Page } from '@playwright/test'
import { routes } from '../fixtures/aphelion-routes'

type Control = 'left' | 'right' | 'jump'
type SendControl = (control: Control, pressed: boolean) => Promise<void>

async function enterCockpit(page: Page) {
  await page.clock.install({ time: new Date('2030-01-01T12:00:00Z') })
  await page.clock.pauseAt(new Date('2030-01-01T12:01:00Z'))
  await page.goto('games/aphelion-run/')
  await expect(page.getByRole('button', { name: 'Dawn Array', exact: true })).toBeEnabled()
}

function keyboardControls(page: Page): SendControl {
  const keys = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'Space' }
  return async (control, pressed) => {
    if (pressed) await page.keyboard.down(keys[control])
    else await page.keyboard.up(keys[control])
  }
}

async function touchControls(page: Page): Promise<SendControl> {
  const client = await page.context().newCDPSession(page)
  const contacts = new Map<Control, { id: number, x: number, y: number }>()
  return async (control, pressed) => {
    if (pressed) {
      const button = page.getByRole('button', { name: control === 'jump' ? 'Jump' : 'Steer ' + control, exact: true })
      await expect(button).toBeInViewport({ ratio: 1 })
      const box = await button.boundingBox()
      if (!box) throw new Error('Missing touch target: ' + control)
      contacts.set(control, { id: control === 'jump' ? 2 : 1, x: box.x + box.width / 2, y: box.y + box.height / 2 })
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...contacts.values()] })
    } else {
      const point = contacts.get(control)!
      contacts.delete(control)
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: contacts.size ? [point] : [] })
    }
  }
}

async function flyCourse(page: Page, id: keyof typeof routes, input: SendControl) {
  const route = routes[id]
  const events: { time: number, control: Control, pressed: boolean }[] = []
  for (const [start, end, direction] of route.steering) {
    const control = direction < 0 ? 'left' : 'right'
    events.push({ time: start, control, pressed: true }, { time: end, control, pressed: false })
  }
  for (const time of route.jumps) {
    events.push({ time, control: 'jump', pressed: true }, { time: time + 0.06, control: 'jump', pressed: false })
  }
  let elapsed = 0
  for (const event of events.sort((a, b) => a.time - b.time)) {
    const next = Math.round(event.time * 1000)
    if (next > elapsed) await page.clock.runFor(next - elapsed)
    await input(event.control, event.pressed)
    elapsed = next
  }
  await page.clock.runFor(26_000 - elapsed)
  await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'finished')
}

async function completeCup(page: Page, touch: boolean) {
  await enterCockpit(page)
  await expect(page.getByRole('button', { name: 'Iceglass Relay', exact: true })).toBeDisabled()
  const launch = async (name: string) => {
    const button = page.getByRole('button', { name, exact: true })
    if (touch) await button.tap({ force: true })
    else await button.click({ force: true })
  }
  await launch('Launch course')
  const send = touch ? await touchControls(page) : keyboardControls(page)
  await flyCourse(page, 'dawn', send)
  await launch('Next course')
  await flyCourse(page, 'iceglass', send)
  await launch('Next course')
  await flyCourse(page, 'ember', send)
  await expect(page.getByRole('heading', { name: 'Cup complete' })).toBeVisible()
}

test('a keyboard pilot finishes all three courses and retains best times after reload', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 960, height: 640 })
  await completeCup(page, false)
  await page.reload()
  for (const title of ['Dawn Array', 'Iceglass Relay', 'Ember Foundry']) {
    const course = page.getByRole('button', { name: title, exact: true })
    await expect(course).toBeEnabled()
    await course.click({ force: true })
    await expect(page.locator('#course-best')).toHaveText(/\d[.:]\d{2}/)
  }
})

test.describe('375px flight deck', () => {
  test.use({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true })
  for (const keys of [
    { layout: 'Arrow', faster: 'ArrowUp', slower: 'ArrowDown', right: 'ArrowRight', activate: 'Space' },
    { layout: 'WASD', faster: 'w', slower: 's', right: 'd', activate: 'Enter' },
  ]) {
    test(`${keys.layout} controls work while a flight pad is focused`, async ({ page }) => {
      await enterCockpit(page)
      await page.getByRole('button', { name: 'Launch course' }).tap({ force: true })
      await page.keyboard.press('Tab')
      const pad = page.getByRole('button', { name: 'Steer left' })
      await expect(pad).toBeFocused()

      await page.keyboard.down(keys.right)
      await page.keyboard.down(keys.faster)
      await page.clock.runFor(300)
      await page.keyboard.up(keys.faster)
      expect(Number(await page.locator('#speed').textContent())).toBeGreaterThan(20)
      await page.keyboard.down(keys.slower)
      await page.clock.runFor(300)
      await page.keyboard.up(keys.slower)
      await page.keyboard.up(keys.right)
      await expect(page.locator('#speed')).toHaveText('20')
      await expect(pad).toBeFocused()

      // Jump the first gap. The barrier beyond it requires the steering input above.
      await page.clock.runFor(2200)
      await page.getByRole('button', { name: 'Jump', exact: true }).press(keys.activate)
      await page.clock.runFor(4000)
      await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'running')
      expect(parseInt(await page.locator('#progress').innerText(), 10)).toBeGreaterThan(26)
    })
  }

  test('click-only steering clears the first Dawn Array barrier', async ({ page }) => {
    await enterCockpit(page)
    await page.getByRole('button', { name: 'Launch course' }).tap({ force: true })
    const right = page.getByRole('button', { name: 'Steer right' })
    // Each keyboard activation of the pad has no pointerdown or held direction.
    for (let i = 0; i < 24; i++) {
      await right.press('Enter')
      await page.clock.runFor(32)
    }
    await page.clock.runFor(2800 - 24 * 32)
    await page.getByRole('button', { name: 'Jump', exact: true }).press('Enter')
    await page.clock.runFor(4000)
    await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'running')
    expect(parseInt(await page.locator('#progress').innerText(), 10)).toBeGreaterThan(26)
  })

  test('a two-finger pilot completes the cup and can replay with storage denied', async ({ page }) => {
    test.setTimeout(180_000)
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Unavailable', 'SecurityError') } })
    })
    await completeCup(page, true)
    await page.getByRole('button', { name: 'Replay', exact: true }).tap({ force: true })
    await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'running')
    await expect(page.locator('#fuel')).toHaveText('100%')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
  })
})

test.describe('short landscape touchscreen', () => {
  test.use({ viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true })
  test('speed, sound and the pause menu stay within reach', async ({ page }) => {
    await enterCockpit(page)
    await page.getByRole('button', { name: 'Launch course' }).tap({ force: true })
    const faster = page.getByRole('button', { name: 'Increase speed' })
    await expect(faster).toBeInViewport({ ratio: 1 })
    await faster.tap({ force: true })
    await page.clock.runFor(200)
    expect(Number(await page.locator('#speed').textContent())).toBeGreaterThan(20)
    const mute = page.getByRole('button', { name: 'Mute sound', exact: true })
    await expect(mute).toBeInViewport({ ratio: 1 })
    await mute.tap({ force: true })
    await expect(page.getByRole('button', { name: 'Unmute sound' })).toBeVisible()
    await page.getByRole('button', { name: 'Pause', exact: true }).tap({ force: true })
    const library = page.getByRole('link', { name: 'Library' })
    await expect(library).toBeInViewport({ ratio: 1 })
    await library.tap({ force: true })
    await expect(page).toHaveTitle(/Orbit Arcade/)
  })
})

test('Space activates focused flight buttons and jumps after a pointer mute', async ({ page }) => {
  await enterCockpit(page)
  await page.getByRole('button', { name: 'Launch course' }).click({ force: true })
  await page.getByRole('button', { name: 'Pause', exact: true }).press('Space')
  await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'paused')
  await page.getByRole('button', { name: 'Resume', exact: true }).press('Space')
  const mute = page.locator('#mute')
  await mute.press('Space')
  await expect(mute).toHaveAccessibleName('Unmute sound')
  await expect(mute).toBeFocused()
  await mute.press('Space')
  await expect(mute).toHaveAccessibleName('Mute sound')
  await page.clock.runFor(2800)
  await mute.click({ force: true })
  await expect(page.locator('#flight-scene')).toBeFocused()
  await page.keyboard.press('Space')
  await page.clock.runFor(1800)
  await expect(mute).toHaveAccessibleName('Unmute sound')
  await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'running')
})

test('throttle holds, pause freezes instruments, and a crash can be retried immediately', async ({ page }) => {
  await enterCockpit(page)
  await page.getByRole('button', { name: 'Launch course' }).click({ force: true })
  await page.keyboard.down('ArrowUp')
  await page.clock.runFor(450)
  await page.keyboard.up('ArrowUp')
  const speed = await page.locator('#speed').textContent()
  expect(Number(speed)).toBeGreaterThan(20)
  await page.clock.runFor(450)
  await expect(page.locator('#speed')).toHaveText(speed!)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  const instruments = page.locator('#clock, #fuel, #oxygen, #progress')
  const paused = await instruments.allTextContents()
  await page.clock.runFor(2400)
  expect(await instruments.allTextContents()).toEqual(paused)
  await expect(page.getByRole('link', { name: 'Library' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume', exact: true }).click({ force: true })
  await page.clock.runFor(6500)
  await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'crashed')
  await page.keyboard.press('r')
  await expect(page.locator('#cockpit')).toHaveAttribute('data-state', 'running')
  await expect(page.locator('#progress')).toHaveText('0%')
})
