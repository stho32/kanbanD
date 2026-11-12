// R00138 Der gehaltene Fokus trifft nach einer fremden Listenänderung dasselbe Element (Karte #40, ADR-0007 Nachtrag N3)
// Grundbestand: Aufgabe #1 offen im Aufgabenfenster, Teilaufgaben „eins“, „zwei“, „drei“; eine zweite Karte mit denselben
// Verweisen; Menschen und ein Agent. „Dasselbe Element“ heißt: derselbe Inhalt, auch wenn er an einer anderen Stelle steht.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, reiter, mutanteEinsetzen } = require('./hilfen');

const ALS_CL = { headers: { 'X-KanbanD-Wer': 'cl' } };

/** Eine Aufgabe mit Teilaufgaben und Herkünften; die zweite Karte trägt dieselben Herkünfte (Grundbestand der Anforderung). */
const bestand = ({ teilaufgaben = ['eins', 'zwei', 'drei'], herkunft = [] } = {}) => ({
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\n${herkunft.length ? `origins: [${herkunft.join(', ')}]\n` : ''}---\n${teilaufgaben.map(t => `- [ ] ${t}`).join('\n')}\n`,
  'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: zwei\n${herkunft.length ? `origins: [${herkunft.join(', ')}]\n` : ''}---\n`,
});

/** Teilaufgabentexte der Datei #1 in der Reihenfolge der Datei. */
const teilaufgabenDerDatei = k => k.lies('aufgaben/0001-eins.md').split('\n').filter(z => /^- \[[ x]\] /.test(z)).map(z => z.slice(6));

test.describe('R00138 fremde Listenänderung', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.afterEach(() => k && k.stoppen());

  /** Öffnet #1 im Aufgabenfenster, wartet auf die Live-Verbindung und gibt die Adresse zurück. */
  async function fensterAuf(page, dateien) {
    k = await kanbanStarten(einrichten(dateien));
    await alsPerson(page, 'st');
    await mutanteEinsetzen(page);
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.locator('#fenster')).toBeVisible();
  }

  test('US-1: fremde Löschung von „eins“ lässt den Fokus auf dem ✕ von „zwei“, nie auf „drei“ (#40)', async ({ page }) => {
    await fensterAuf(page, bestand());
    const zwei = page.getByLabel('Teilaufgabe zwei entfernen');
    await zwei.focus();
    await expect(zwei).toBeFocused();

    const entfernt = await page.request.delete(k.adresse + 'api/aufgaben/1/teilaufgaben/0', ALS_CL);
    expect(entfernt.status()).toBe(200);

    // Erst muss das Live-Ereignis die Liste auf den neuen Stand zeichnen („eins“ ist fort) — sonst adressiert der
    // nächste Tastendruck die alte Stelle (eigener Strang #106).
    await expect(page.locator('#fenster .chk')).toHaveText(['zwei✕', 'drei✕']);
    // Abnahme-Probe der Karte #40 wörtlich: nach dem Live-Ereignis (≤ 1 s) steht der Fokus auf „zwei“, nicht auf „drei“.
    await expect(zwei).toBeFocused();
    await expect(page.getByLabel('Teilaufgabe drei entfernen')).not.toBeFocused();
    expect(teilaufgabenDerDatei(k)).toEqual(['zwei', 'drei']);

    // Ein anschließendes Enter entfernt „zwei“, nie „drei“ (der gehaltene Fokus steht auf dem richtigen Eintrag).
    await page.keyboard.press('Enter');
    await expect(page.locator('#fenster .chk')).toHaveText(['drei✕']);
    expect(teilaufgabenDerDatei(k)).toEqual(['drei']);
  });

  test('US-1: auch die bearbeitbare Zeile hält über ihren Inhalt, nicht über die Stelle (#40)', async ({ page }) => {
    await fensterAuf(page, bestand());
    const zweiZeile = page.getByRole('button', { name: 'zwei', exact: true });
    await zweiZeile.focus();
    await expect(zweiZeile).toBeFocused();

    const entfernt = await page.request.delete(k.adresse + 'api/aufgaben/1/teilaufgaben/0', ALS_CL);
    expect(entfernt.status()).toBe(200);

    await expect(page.locator('#fenster .chk')).toHaveText(['zwei✕', 'drei✕']);
    await expect(zweiZeile).toBeFocused(); // nicht die Zeile von „drei“ (die Stelle hätte geraten)
  });

  test('US-2: bei doppeltem Inhalt hält das ✕ nichts — der Fokus fällt auf #teil-neu, nie auf ein fremdes ✕ (#40)', async ({ page }) => {
    await fensterAuf(page, bestand({ teilaufgaben: ['gleich', 'gleich', 'dritte'] }));
    await page.locator('#fenster .chk .x').nth(1).focus(); // das ✕ der zweiten „gleich“

    const entfernt = await page.request.delete(k.adresse + 'api/aufgaben/1/teilaufgaben/0', ALS_CL); // der Bot entfernt die erste „gleich“
    expect(entfernt.status()).toBe(200);

    await expect(page.locator('#teil-neu')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement.matches('#fenster .chk .x'))).toBe(false);
    expect(teilaufgabenDerDatei(k)).toEqual(['gleich', 'dritte']);
  });

  test('US-2 (#134): bei doppeltem Inhalt hält auch die bearbeitbare Zeile nichts — der Fokus fällt auf #teil-neu, nie auf „dritte“', async ({ page }) => {
    await fensterAuf(page, bestand({ teilaufgaben: ['gleich', 'gleich', 'dritte'] }));
    const zweiteGleich = page.locator('#fenster .chk [data-act="teil-bearbeiten"]').nth(1);
    await zweiteGleich.focus();
    await expect(zweiteGleich).toBeFocused();

    const entfernt = await page.request.delete(k.adresse + 'api/aufgaben/1/teilaufgaben/0', ALS_CL); // der Bot entfernt die erste „gleich“
    expect(entfernt.status()).toBe(200);

    // Nicht über die Stelle gehalten: sonst stünde der Fokus auf der Zeile von „dritte“, und die nächste Eingabe bearbeitete sie.
    await expect(page.getByRole('button', { name: 'dritte', exact: true })).not.toBeFocused();
    await expect(page.locator('#teil-neu')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement.matches('#fenster .chk [data-act="teil-bearbeiten"]'))).toBe(false);
    expect(teilaufgabenDerDatei(k)).toEqual(['gleich', 'dritte']);
  });

  test('US-1 (#134 A1): ein fremd geänderter Text lässt den Fokus in den Abschnitt fallen, nicht ins Fenster', async ({ page }) => {
    await fensterAuf(page, bestand());
    const zwei = page.getByLabel('Teilaufgabe zwei entfernen');
    await zwei.focus();
    await expect(zwei).toBeFocused();

    const geaendert = await page.request.patch(k.adresse + 'api/aufgaben/1/teilaufgaben/1', { ...ALS_CL, data: { text: 'zweix' } });
    expect(geaendert.status()).toBe(200);

    await expect(page.locator('#fenster .chk [data-act="teil-bearbeiten"]')).toHaveText(['eins', 'zweix', 'drei']);
    // Der Inhalt ist ein anderer geworden (ADR-0007 N3 Pre-Mortem): der Fokus fällt in den Abschnitt, nicht auf das Fenster.
    await expect(page.locator('#teil-neu')).toBeFocused();
  });

  test('US-1 (#134 A1): auch die bearbeitbare Zeile fällt bei fremdem Textwechsel in den Abschnitt', async ({ page }) => {
    await fensterAuf(page, bestand());
    const zweiZeile = page.getByRole('button', { name: 'zwei', exact: true });
    await zweiZeile.focus();
    await expect(zweiZeile).toBeFocused();

    const geaendert = await page.request.patch(k.adresse + 'api/aufgaben/1/teilaufgaben/1', { ...ALS_CL, data: { text: 'zweix' } });
    expect(geaendert.status()).toBe(200);

    await expect(page.getByRole('button', { name: 'zweix', exact: true })).toBeVisible();
    await expect(page.locator('#teil-neu')).toBeFocused();
  });

  test('US-3: eine fremde Herkunftslöschung lässt den Fokus auf dem ✕ derselben Herkunft (#40)', async ({ page }) => {
    await fensterAuf(page, bestand({ herkunft: ['I0001', 'I0002', 'I0003'] }));
    await reiter(page, 'Details');
    const i0002 = page.getByLabel('Herkunft I0002 entfernen');
    await i0002.focus();
    await expect(i0002).toBeFocused();

    const geaendert = await page.request.patch(k.adresse + 'api/aufgaben/1', { ...ALS_CL, data: { herkunft: ['I0002', 'I0003'] } });
    expect(geaendert.status()).toBe(200);

    // Erst muss das Live-Ereignis die Liste neu gezeichnet haben (I0001 ist fort), dann zählt der gehaltene Fokus.
    await expect(page.getByLabel('Herkunft I0001 entfernen')).toHaveCount(0);
    await expect(i0002).toBeFocused();
    await expect(page.getByLabel('Herkunft I0003 entfernen')).not.toBeFocused();
  });

  test('US-3: zwei gleiche Verweise — der Fokus fällt ins Herkunftsfeld, nie auf ein fremdes ✕ (#40)', async ({ page }) => {
    await fensterAuf(page, bestand({ herkunft: ['I0001', 'I0001', 'I0003'] }));
    await reiter(page, 'Details');
    await expect(page.locator('.ochip button')).toHaveCount(3);
    await page.locator('.ochip button').nth(1).focus(); // das ✕ der zweiten „I0001“

    const geaendert = await page.request.patch(k.adresse + 'api/aufgaben/1', { ...ALS_CL, data: { herkunft: ['I0001', 'I0003'] } });
    expect(geaendert.status()).toBe(200);

    await expect(page.locator('#herkunft-neu')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement.matches('.ochip button'))).toBe(false);
  });

  test('US-4: die eigene Aktion bleibt unverändert — nach dem Entfernen von „zwei“ steht der Fokus auf dem ✕ von „drei“ (#40)', async ({ page }) => {
    await fensterAuf(page, bestand());
    await page.getByLabel('Teilaufgabe zwei entfernen').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[aria-modal="true"] .toast[role="status"]')).toContainText('Teilaufgabe „zwei“ entfernt');
    await expect(page.getByLabel('Teilaufgabe drei entfernen')).toBeFocused();
  });
});

/** Fügt Text ein wie aus der Zwischenablage (R00027). */
async function einfuegen(page, selektor, text) {
  await page.locator(selektor).evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

test.describe('R00134 Härtung: auch nicht zerstörende Inhaltsträger halten nie über die Stelle', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.afterEach(() => k && k.stoppen());

  /** Board mit neutralen Teilaufgaben; das Fenster „Neue Aufgabe“ trägt die geprüften Zeilen. */
  async function neueAufgabe(page, teilaufgaben) {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await mutanteEinsetzen(page);
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await einfuegen(page, '#neu-teil', teilaufgaben.map(t => `- ${t}`).join('\n'));
    await expect(page.locator('#neu-fenster .chk .x')).toHaveCount(teilaufgaben.length);
  }

  test('US-2: bei doppeltem Inhalt hält das ✕ „nf-teil-weg“ nichts — der Fokus fällt auf #neu-teil', async ({ page }) => {
    await neueAufgabe(page, ['gleich', 'gleich', 'dritte']);
    await page.locator('#neu-fenster .chk .x').nth(1).focus();

    const geaendert = await page.request.patch(k.adresse + 'api/aufgaben/2', { ...ALS_CL, data: { titel: 'zwei neu' } });
    expect(geaendert.status()).toBe(200);
    await expect(page.locator('.ka[data-id="2"] .t')).toHaveText('zwei neu'); // das Neuzeichnen ist durch

    await expect(page.locator('#neu-teil')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement.matches('#neu-fenster .chk .x'))).toBe(false);
  });

  test('US-1: ein eindeutiger Text hält das ✕ „nf-teil-weg“ über ein fremdes Ereignis', async ({ page }) => {
    await neueAufgabe(page, ['eins', 'zwei', 'drei']);
    const zwei = page.locator('#neu-fenster .chk .x').nth(1);
    await zwei.focus();

    const geaendert = await page.request.patch(k.adresse + 'api/aufgaben/2', { ...ALS_CL, data: { titel: 'zwei neu' } });
    expect(geaendert.status()).toBe(200);
    await expect(page.locator('.ka[data-id="2"] .t')).toHaveText('zwei neu');

    await expect(page.locator('#neu-fenster .chk .x').nth(1)).toBeFocused();
  });
});
