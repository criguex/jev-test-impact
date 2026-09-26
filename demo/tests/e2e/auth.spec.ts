import { expect, test, type Page } from '@playwright/test';

async function logIn(page: Page, password: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('login-link').click();
  await page.getByLabel('Email').fill('reader@example.com');
  await page.getByLabel('Password').fill(password);
  await page.getByTestId('login-submit').click();
}

test.describe('auth', () => {
  test('a reader can log in and is greeted @auth @smoke', async ({ page }) => {
    await logIn(page, 'open-sesame1');
    await expect(page.getByTestId('greeting')).toHaveText('Hi, Reader');
  });

  test('a wrong password shows an error @auth', async ({ page }) => {
    await logIn(page, 'not-it');
    await expect(page.getByTestId('login-error')).toHaveText('Email or password is incorrect');
  });

  test('logging out returns to anonymous browsing @auth', async ({ page }) => {
    await logIn(page, 'open-sesame1');
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('login-link')).toBeVisible();
  });
});
