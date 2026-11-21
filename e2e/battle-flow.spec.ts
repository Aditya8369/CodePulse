import { test, expect } from '@playwright/test';

test.describe('DevBattles authentication boundary', () => {
  test('redirects an unauthenticated battle visitor to login', async ({ page }) => {
    await page.goto('/battles');
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get('redirectTo')).toBe('/battles');
    await expect(page.getByRole('button', { name: /Continue with GitHub/i })).toBeVisible();
  });
});
