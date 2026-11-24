import { expect, test } from '@playwright/test'

test('courier selection, field guide, mute, and pause work from the dispatch desk', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
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
