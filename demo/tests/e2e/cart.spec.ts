import { expect, test, type Page } from '@playwright/test';

async function addBook(page: Page, id: string, quantity = 1): Promise<void> {
  await page.goto(`/book/${id}`);
  await page.getByLabel('Quantity').fill(String(quantity));
  await page.getByTestId('add-to-cart').click();
}

test.describe('cart', () => {
  test('adding a book updates the header counter @cart', async ({ page }) => {
    await addBook(page, 'b01', 2);
    await expect(page.getByTestId('cart-count')).toHaveText('2');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
  });

  test('changing quantity recalculates the subtotal @cart', async ({ page }) => {
    await addBook(page, 'b05');
    await page.getByLabel('Quantity for The Calm Pipeline').fill('3');
    await page.getByRole('button', { name: 'Update' }).click();
    await expect(page.getByTestId('subtotal')).toHaveText('$75.00');
  });

  test('removing the last line empties the cart @cart', async ({ page }) => {
    await addBook(page, 'b02');
    await page.getByTestId('remove').click();
    await expect(page.getByTestId('empty-cart')).toBeVisible();
    await expect(page.getByTestId('cart-count')).toHaveText('0');
  });

  test('a valid discount code lowers the total @cart', async ({ page }) => {
    await addBook(page, 'b03');
    await page.getByLabel('Discount code').fill('welcome10');
    await page.getByTestId('apply-discount').click();
    await expect(page.getByTestId('discount')).toHaveText('-$4.50');
    await expect(page.getByTestId('total')).toHaveText('$48.34');
  });

  test('an invalid discount code is rejected @cart', async ({ page }) => {
    await addBook(page, 'b03');
    await page.getByLabel('Discount code').fill('FREEBOOKS');
    await page.getByTestId('apply-discount').click();
    await expect(page.getByTestId('cart-message')).toHaveText('Code FREEBOOKS is not valid');
  });

  test('asking for more than the stock shows an error @cart', async ({ page }) => {
    await addBook(page, 'b10', 2);
    await expect(page.getByTestId('cart-message')).toHaveText('Not enough stock');
  });
});
