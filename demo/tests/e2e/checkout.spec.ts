import { expect, test, type Page } from '@playwright/test';

async function cartWith(page: Page, ...ids: string[]): Promise<void> {
  for (const id of ids) {
    await page.goto(`/book/${id}`);
    await page.getByTestId('add-to-cart').click();
  }
  await page.getByTestId('go-checkout').click();
}

test.describe('checkout', () => {
  test('shows standard shipping totals by default @checkout', async ({ page }) => {
    await cartWith(page, 'b01', 'b02');
    await expect(page.getByTestId('shipping')).toHaveText('$6.00');
    await expect(page.getByTestId('total')).toHaveText('$70.20');
  });

  test('switching to store pickup removes shipping @checkout', async ({ page }) => {
    await cartWith(page, 'b01');
    await page.getByLabel('Store pickup').check();
    await page.getByTestId('update-shipping').click();
    await expect(page.getByTestId('shipping')).toHaveText('$0.00');
  });

  test('placing an order confirms and empties the cart @checkout @smoke', async ({ page }) => {
    await cartWith(page, 'b09');
    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('confirmation')).toContainText('We charged $40.31');
    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });
});
