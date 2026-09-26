import { expect, test } from '@playwright/test';

test('health endpoint reports the catalog size @smoke', async ({ request }) => {
  const response = await request.get('/health');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: 'ok', books: 12 });
});
