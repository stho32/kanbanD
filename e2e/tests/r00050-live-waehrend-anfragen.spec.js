// R00050 Live-Ereignisse während eigener Anfragen (Nachtrag)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

test('US-1: die Liste verliert beim schnellen Tippen keinen Eintrag', async ({ page }) => {
  const k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' }));
  try {
    await alsPerson(page, 'st');
    // Antworten verzögern: der Server committet sofort (Live-Ereignis), die Seite erfährt es erst später
    let ausgeliefert = 0;
    await page.route('**/api/aufgaben/1/teilaufgaben', async route => { const antwort = await route.fetch(); await new Promise(r => setTimeout(r, 250)); await route.fulfill({ response: antwort }); ausgeliefert++; });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    // jede Änderung der Liste mitschreiben: die Anzahl darf nie sinken
    await page.evaluate(() => {
      window.anzahlen = [];
      new MutationObserver(() => window.anzahlen.push(document.querySelectorAll('[role="dialog"] .chk').length)).observe(document.body, { childList: true, subtree: true });
    });
    // das eine Neuladen bei leerer Schlange: erst nach der zehnten ausgelieferten Antwort; vor dem Tippen abonniert, damit es nicht
    // vorbeigeht. Beim Absenden die Zahl der bisherigen Zeichnungen merken — erst was danach gezeichnet wird, zeigt den neu geladenen Stand.
    // Eigene Frist unter dem Test-Timeout: bleibt das Neuladen aus, wird der Test mit einer Meldung rot und räumt noch auf.
    let zeichnungenVorDemNeuladen;
    const neuGeladen = page.waitForRequest(async r => {
      if (new URL(r.url()).pathname !== '/api/aufgaben' || r.method() !== 'GET' || ausgeliefert !== 10) return false;
      zeichnungenVorDemNeuladen = await page.evaluate(() => window.anzahlen.length);
      return true;
    }, { timeout: 15000 });
    neuGeladen.catch(() => {}); // scheitert vorher etwas anderes, bleibt die Ablehnung nicht unbehandelt
    await page.getByLabel('Neue Teilaufgabe').focus();
    for (let i = 1; i <= 10; i++) { await page.keyboard.type('t' + i); await page.keyboard.press('Enter'); }
    await expect.poll(() => k.lies('aufgaben/0001-eins.md'), { timeout: 20000 }).toContain('- [ ] t10\n');
    await neuGeladen.catch(f => { throw new Error('kein Neuladen der Seite nach der zehnten ausgelieferten Antwort — ' + f.message); });
    await expect.poll(() => page.evaluate(() => window.anzahlen.length), { message: 'nach dem Neuladen nicht neu gezeichnet' }).toBeGreaterThan(zeichnungenVorDemNeuladen);
    await expect(page.locator('[role="dialog"] .chk')).toHaveCount(10);
    const anzahlen = await page.evaluate(() => window.anzahlen.filter(n => n > 0));
    expect(anzahlen.every((n, i) => i === 0 || n >= anzahlen[i - 1])).toBe(true);
    expect(k.git('rev-list', '--count', 'HEAD', '--', 'aufgaben/0001-eins.md')).toBe('11');
  } finally {
    // der Server wird auch gestoppt, wenn die Seite nach einem Timeout schon geschlossen ist und unrouteAll wirft
    try { await page.unrouteAll({ behavior: 'wait' }); } finally { await k.stoppen(); }
  }
});
