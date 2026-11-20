import { test, expect } from '@playwright/test';

test.describe('DevBattles Arena Flow', () => {
  test('renders battles overview page and quick match button', async ({ page }) => {
    await page.goto('/battles');

    const battleHeader = page.getByRole('heading', { name: /Battles|Arena/i }).first();
    await expect(battleHeader).toBeVisible();

    const createMatchBtn = page.getByRole('button', { name: /Create Battle|Quick Match/i }).first();
    await expect(createMatchBtn).toBeVisible();
  });
});
