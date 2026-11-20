import { test, expect } from '@playwright/test';

test.describe('Authentication & Landing Flow', () => {
  test('landing page loads with headline and navigation', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/CodePulse/);
    const getStartedBtn = page.getByRole('link', { name: /Get Started|Sign In/i }).first();
    await expect(getStartedBtn).toBeVisible();
  });

  test('navigates to login page and displays GitHub OAuth button', async ({ page }) => {
    await page.goto('/login');

    const githubBtn = page.getByRole('button', { name: /Continue with GitHub/i }).first();
    await expect(githubBtn).toBeVisible();
  });
});
