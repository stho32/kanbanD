// R00056 WBS-Knoten anlegen und verwerfen — in der Sicht, geschrieben ins Arbeits-Repository ohne Commit.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { kanbanStarten, alsPerson, liveBereit } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

const ZEILEN = [
  zeile('A0001', 'Application', '—', 'kanbanD', 'gelb'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'gruen'),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'gruen', { fertig: 'US-1' }),
  zeile('B0001', 'Bubble', 'I0001', 'Board lesen', 'gruen', { ea: 'Datei → Board', aufwand: '0,5-1' }),
  zeile('D0002', 'Dialog', 'A0001', 'Berichte', 'rot'),
  zeile('I0007', 'Interaction', 'D0002', 'Burndown', 'rot', { fertig: 'US-1' }),
  zeile('B0002', 'Bubble', 'I0007', 'Reihe lesen', 'rot'),
  zeile('B0003', 'Bubble', 'I0007', 'Kurve zeichnen', 'rot'),
  zeile('I0008', 'Interaction', 'D0002', 'Durchlauf', 'rot', { fertig: 'US-2' }),
];
const WBS = wbsText(ZEILEN);

test.describe('R00056', () => {
  let k, arbeit;
  test.beforeEach(async ({ page }) => {
    // In der Historie gab es I0009 schon einmal — die neue Interaction bekommt I0010.
    arbeit = arbeitsRepository(wbsText([...ZEILEN, zeile('I0009', 'Interaction', 'D0002', 'Gestrichen', 'rot')]));
    fs.writeFileSync(arbeit.wbs, WBS);
    arbeit.git('-c', 'user.name=KI', '-c', 'user.email=k@k', 'commit', '-q', '-am', 'I0009 gelöscht');
    k = await kanbanStarten(mitRegister(arbeit));
    await alsPerson(page, 'st');
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });
  const z = (page, id) => page.locator(`tr.wbs-z[data-id="${id}"]`);

  test('US-1: Interaction unter einem Dialog anlegen — rot, nächste freie ID, Dialog nicht mehr grün', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    const commits = arbeit.git('rev-list', '--count', 'HEAD');
    await page.locator('tr.wbs-z[data-id="D0001"]').getByRole('button', { name: 'D0001 aufklappen' }).click();
    await expect(z(page, 'D0001').locator('.ampel')).toHaveText('gruen');
    await z(page, 'D0001').getByRole('button', { name: 'Knoten unter D0001 anlegen' }).click();
    const form = page.getByRole('dialog', { name: 'Knoten unter D0001 anlegen' });
    await expect(form.getByLabel('Ebene')).toHaveValue('Interaction');
    await form.getByLabel('Name').fill('Spalten färben');
    await form.getByRole('button', { name: 'anlegen' }).click();
    await expect(form.getByRole('alert')).toHaveText('Fertig-Kriterium fehlt — ein Knoten, ein Fertig-Kriterium');
    await form.getByLabel('Fertig').fill('US-1');
    await form.getByLabel('Fertig').press('Enter');
    await expect(form).toHaveCount(0);
    const neu = z(page, 'I0010');
    await expect(neu).toBeVisible();
    await expect(neu).toHaveClass(/\brot\b/);
    await expect(neu.locator('.n')).toHaveText('Spalten färben');
    expect(await neu.evaluate(tr => tr.previousElementSibling.dataset.id)).toBe('B0001');
    await expect(z(page, 'D0001').locator('.ampel')).toHaveText('gelb');
    await expect(page.locator('.wbs-nc')).toHaveText('nicht committet');
    expect(arbeit.lies()).toContain('| I0010 | Interaction | D0001 | Spalten färben | rot | US-1 |');
    expect(arbeit.git('rev-list', '--count', 'HEAD')).toBe(commits);
  });

  test('Bubble unter einer Interaction mit Eingabe → Ausgabe und Aufwand; Aufwand unter der Untergrenze wird abgelehnt', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await z(page, 'I0007').getByRole('button', { name: 'Knoten unter I0007 anlegen' }).click();
    const form = page.getByRole('dialog', { name: 'Knoten unter I0007 anlegen' });
    await form.getByLabel('Ebene').selectOption('Bubble');
    await form.getByLabel('Name').fill('Achse beschriften');
    await form.getByLabel('Fertig').fill('Test gruen');
    await form.getByLabel('Eingabe → Ausgabe').fill('Reihe → Achse');
    await form.getByLabel('Aufwand').fill('0,2');
    await form.getByRole('button', { name: 'anlegen' }).click();
    await expect(form.getByRole('alert')).toContainText('Untergrenze');
    await form.getByLabel('Aufwand').fill('0,5-1');
    await form.getByRole('button', { name: 'anlegen' }).click();
    await expect(z(page, 'B0004')).toBeVisible();
    await expect(z(page, 'B0004').locator('td').nth(3)).toHaveText('Reihe → Achse');
    await expect(z(page, 'B0004').locator('td').nth(4)).toHaveText('0,5-1h');
    expect(await z(page, 'B0004').evaluate(tr => tr.nextElementSibling.dataset.id)).toBe('I0008');
    await expect(z(page, 'B0003').getByRole('button', { name: /Knoten unter/ })).toHaveCount(0);
  });
});
