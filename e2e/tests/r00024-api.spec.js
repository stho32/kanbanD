// R00024 Agent arbeitet über die API
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten } = require('./hilfen');

test('US-1 und US-2: API-Seite aus der Statuszeile, Agent arbeitet unter eigenem Namen', async ({ page, context, request }) => {
  const k = await kanbanStarten(einrichten());
  try {
    await page.goto(k.adresse);
    const [api] = await Promise.all([context.waitForEvent('page'), page.getByRole('link', { name: 'API für Agenten' }).click()]);
    await expect(api).toHaveTitle('kanbanD · API');
    await expect(api.getByText('/api/boards/{slug}/bewegen', { exact: true })).toBeVisible();
    const neu = await request.post(k.adresse + 'api/aufgaben', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'vom Agenten', board: 'entwicklung' } });
    expect(neu.status()).toBe(201);
    await expect(page.locator('.ka .t')).toHaveText(['vom Agenten']);
    expect(k.git('log', '-1', '--format=%an')).toBe('Claude');
  } finally { await k.stoppen(); }
});
