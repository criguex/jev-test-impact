import { expect, test } from '@playwright/test';

test.describe('catalog', () => {
  test('home page lists every book @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByTestId('book-card')).toHaveCount(12);
  });

  test('search narrows results by title @search', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search books' }).or(page.getByLabel('Search books')).fill('pipeline');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('book-card')).toHaveCount(1);
    await expect(page.getByTestId('book-card')).toContainText('The Calm Pipeline');
  });

  test('search without matches shows the empty state @search', async ({ page }) => {
    await page.goto('/search?q=cooking');
    await expect(page.getByTestId('empty-results')).toBeVisible();
  });

  test('book page shows price and add button', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'TypeScript in Depth' }).click();
    await expect(page.getByTestId('price')).toHaveText('$45.00');
    await expect(page.getByTestId('add-to-cart')).toBeEnabled();
  });

  test('sold out book cannot be added', async ({ page }) => {
    await page.goto('/book/b06');
    await expect(page.getByTestId('sold-out')).toBeVisible();
    await expect(page.getByTestId('add-to-cart')).toHaveCount(0);
  });
});
