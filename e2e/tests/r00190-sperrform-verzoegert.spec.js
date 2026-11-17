// R00190 Sperrform erst nach 200 ms sichtbar, das ✕ eines Anhangs behält beim Lesen den Fokus (Karte #151, I0180).
// Die Sperre wirkt sofort (R00148), nur ihre sichtbare Form wartet 200 ms ab dem Auslösen. Die Zeit läuft über
// `page.clock` (angehalten, dann in Schritten von 100 und 300 ms vorgerückt) — nie über die Wanduhr der Probe (ADR-0026).
// Die Antworten hält `page.route` an der Grenze des Browsers fest, bis die Probe sie freigibt.
// ERWARTET ROT bis B0932 (Verzögerung der Form) und B0933 (✕ des Anhangs auf der Sperrform) stehen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, reiter, mutanteEinsetzen } = require('./hilfen');

test.beforeEach(({ page }) => mutanteEinsetzen(page));

const KARTE = 'aufgaben/0001-abnahme-pruefen.md';
const BOARD = 'boards/entwicklung.md';

/** Board „entwicklung“ mit Karte #1: drei offene Teilaufgaben und die Anhänge `plan.pdf` und `notiz.txt`. */
const bestand = () => ({
  [BOARD]: '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n\n## In Arbeit\n\n## Erledigt\n',
  [KARTE]: '---\nid: 1\ntitle: Abnahme prüfen\n---\n- [ ] eins\n- [ ] zwei\n- [ ] drei\n',
  'aufgaben/0001-abnahme-pruefen/plan.pdf': Buffer.alloc(2048, 7),
  'aufgaben/0001-abnahme-pruefen/notiz.txt': Buffer.from('notiz'),
});

/**
 * Hält jede Anfrage `methode` auf einen Pfad, für den `passt` gilt, bis `freigeben()` sie hinauslässt
 * (`'abbrechen'` reißt sie ab). `anzahl` zählt die Anfragen dieser Methode — ohne Sperre sind es zwei.
 */
async function anfragenHalten(page, passt, methode) {
  let scharf = true, anzahl = 0, oeffnen, ausgang = 'durch';
  const tor = new Promise(ok => { oeffnen = ok; });
  await page.route(url => passt(url.pathname), async route => {
    if (route.request().method() !== methode) return route.fallback();
    anzahl++;
    if (!scharf) return route.fallback();
    await tor;
    if (ausgang === 'abbrechen') return route.abort();
    await route.fallback();
  });
  return { anzahl: () => anzahl, freigeben: (wie = 'durch') => { ausgang = wie; scharf = false; oeffnen(); } };
}

const bisAnfrageLaeuft = halte => expect.poll(() => halte.anzahl(), { message: 'die erste Anfrage läuft' }).toBeGreaterThanOrEqual(1);

/**
 * Die sichtbare Form eines Auslösers in einem Schritt gelesen: Schrift, Kontur und Fläche des Knotens — beim Kästchen
 * des Kästchens selbst, bei der Kartenleiste dazu die ihres Kastens — und ob er gesperrt ist.
 */
function formLesen(ausloeser) {
  return ausloeser.evaluate(e => {
    const teil = x => { const s = getComputedStyle(x); return `${s.color} | ${s.borderColor} | ${s.backgroundColor}`; };
    const kasten = e.querySelector('.naechste-box');
    return { gesperrt: e.getAttribute('aria-disabled') === 'true', form: teil(e) + (kasten ? ` · ${teil(kasten)}` : '') };
  });
}

/** Rückt die angehaltene Uhr um `ms` vor und prüft dann: gesperrt und noch in Ruheform bzw. schon gedämpft. */
async function nachZeit(page, ausloeser, ms, ruhe, gedaempft, familie) {
  await page.clock.runFor(ms);
  const jetzt = await formLesen(ausloeser);
  expect(jetzt.gesperrt, `${familie}: die Sperre wirkt`).toBe(true);
  if (gedaempft) expect(jetzt.form, `${familie}: gedämpft`).not.toBe(ruhe);
  else expect(jetzt.form, `${familie}: Ruheform`).toBe(ruhe);
}

test.describe('R00190 Sperrform erst nach 200 ms (AK 1, AK 2)', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await page.clock.install();
    await page.goto(k.adresse);
    await liveBereit(page);
  });
  test.afterEach(() => k.stoppen());

  async function neueAufgabe(page, titel) {
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await dialog.getByLabel('Titel der neuen Aufgabe').fill(titel);
    return dialog.getByRole('button', { name: 'Anlegen', exact: true });
  }

  test('AK 1 / US-1: Antwort nach 100 ms — „Anlegen“ bleibt durchgehend in Ruheform, zwei Klicks legen eine Aufgabe an', async ({ page }) => {
    const anlegen = await neueAufgabe(page, 'Probe');
    const ruhe = (await formLesen(anlegen)).form;
    await page.clock.pauseAt(Date.now() + 1000);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben', 'POST');

    await anlegen.click();
    // der zweite Klick als eigene Handlung (detail 1), nicht als Doppelklick — er prüft die Sperre, nicht die Geste;
    // `force`, weil Playwright einen Knoten mit `aria-disabled` sonst nicht klickt
    await anlegen.click({ force: true });
    await bisAnfrageLaeuft(halte);
    await nachZeit(page, anlegen, 0, ruhe, false, 'gleich nach dem Klick');
    await nachZeit(page, anlegen, 100, ruhe, false, 'nach 100 ms');
    halte.freigeben();

    await expect(page.locator('.ka', { hasText: 'Probe' })).toHaveCount(1);
    expect(halte.anzahl(), 'genau ein POST /api/aufgaben').toBe(1);
  });

  test('AK 2 / US-2: Antwort gehalten — nach 100 ms Ruheform, nach 400 ms gedämpft, Fokus bleibt auf dem Knopf', async ({ page }) => {
    const anlegen = await neueAufgabe(page, 'Probe');
    const ruhe = (await formLesen(anlegen)).form;
    await page.clock.pauseAt(Date.now() + 1000);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben', 'POST');

    await anlegen.focus();
    await page.keyboard.press('Enter');
    await bisAnfrageLaeuft(halte);
    await nachZeit(page, anlegen, 100, ruhe, false, 'Textknopf');
    await nachZeit(page, anlegen, 300, ruhe, true, 'Textknopf');
    await expect(anlegen, 'der Fokus bleibt auf „Anlegen“').toBeFocused();
    halte.freigeben();
    await expect(page.locator('.ka', { hasText: 'Probe' })).toHaveCount(1);
    expect(halte.anzahl()).toBe(1);
  });

  test('AK 2: jede Familie — Kartenleiste, Symbolknopf ✕, Kästchen — erst nach 200 ms gedämpft, mit der Antwort sofort in Ruheform', async ({ page }) => {
    // Kartenleiste (D0002)
    const leiste = page.locator('.ka[data-id="1"] .naechste-ziel');
    const ruheLeiste = (await formLesen(leiste)).form;
    await page.clock.pauseAt(Date.now() + 1000);
    let halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/'), 'PATCH');
    await leiste.click();
    await bisAnfrageLaeuft(halte);
    await nachZeit(page, leiste, 100, ruheLeiste, false, 'Kartenleiste');
    await nachZeit(page, leiste, 300, ruheLeiste, true, 'Kartenleiste');
    halte.freigeben();
    // Ende sofort: Sperre und Form in einem Schritt gelesen, ohne dass die Uhr weiterläuft
    await expect.poll(async () => (await formLesen(leiste)).gesperrt, { message: 'die Sperre endet mit der Antwort' }).toBe(false);
    expect((await formLesen(leiste)).form, 'Kartenleiste: mit der Antwort sofort Ruheform').toBe(ruheLeiste);
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins');
    await page.unrouteAll({ behavior: 'wait' });

    // Symbolknopf ✕ und Kästchen (D0003) im Aufgabenfenster
    await page.locator('.ka[data-id="1"] .t').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await reiter(page, 'Inhalt');
    const kreuz = page.getByLabel('Teilaufgabe drei entfernen');
    const ruheKreuz = (await formLesen(kreuz)).form;
    halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/'), 'DELETE');
    await kreuz.click();
    await bisAnfrageLaeuft(halte);
    await nachZeit(page, kreuz, 100, ruheKreuz, false, 'Symbolknopf ✕');
    await nachZeit(page, kreuz, 300, ruheKreuz, true, 'Symbolknopf ✕');
    halte.freigeben();
    await expect.poll(() => k.lies(KARTE)).not.toContain('drei');
    await page.unrouteAll({ behavior: 'wait' });

    const kaestchen = page.locator('#fenster .chk i[role="checkbox"][aria-label="zwei"]');
    const ruheKaestchen = (await formLesen(kaestchen)).form;
    halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/'), 'PATCH');
    await kaestchen.click();
    await bisAnfrageLaeuft(halte);
    await nachZeit(page, kaestchen, 100, ruheKaestchen, false, 'Kästchen');
    await nachZeit(page, kaestchen, 300, ruheKaestchen, true, 'Kästchen');
    halte.freigeben();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] zwei');
  });
});

test.describe('R00190 Das ✕ eines Anhangs behält beim Lesen den Fokus (AK 3)', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="1"] .t').click();
    await reiter(page, 'Inhalt');
    await expect(page.locator('#anhaenge .anh-z a')).toHaveCount(2);
  });
  test.afterEach(() => k.stoppen());

  const plan = page => page.getByLabel('Anhang plan.pdf entfernen');
  const PLAN = '/api/aufgaben/1/anhaenge/plan.pdf';

  test('US-3: zweimal Enter, Lesen gehalten — Fokus bleibt, gesperrt ohne natives disabled, genau ein Entfernen', async ({ page }) => {
    const lesen = await anfragenHalten(page, p => p === PLAN, 'GET');
    const loeschen = await anfragenHalten(page, p => p === PLAN, 'DELETE');
    loeschen.freigeben();
    await plan(page).focus();
    await page.keyboard.press('Enter');
    await bisAnfrageLaeuft(lesen);

    await expect(plan(page), 'der Fokus steht während des Lesens auf dem ✕').toBeFocused();
    await expect(plan(page)).toHaveAttribute('aria-disabled', 'true');
    expect(await plan(page).evaluate(e => ({ nativ: e.disabled, busy: e.getAttribute('aria-busy') })), 'kein natives disabled, kein aria-busy').toEqual({ nativ: false, busy: null });
    await page.keyboard.press('Enter');
    await expect(plan(page), 'das zweite Enter lässt den Fokus, wo er ist').toBeFocused();
    lesen.freigeben();

    const hinweis = page.locator('[aria-modal="true"] .toast[role="status"]');
    await expect(hinweis).toContainText('Anhang „plan.pdf“ entfernt');
    await expect(hinweis.getByRole('button', { name: 'rückgängig' })).toBeVisible();
    await expect(page.getByLabel('Anhang notiz.txt entfernen'), 'Fokus auf dem ✕ des Nachbarn').toBeFocused();
    await expect(page.locator('#anhaenge .anh-z a')).toHaveText(['notiz.txt']);
    expect(lesen.anzahl(), 'genau ein Lesen').toBe(1);
    expect(loeschen.anzahl(), 'genau ein DELETE').toBe(1);
  });

  test('US-4: das Lesen bricht ab — plan.pdf bleibt, Meldung im Fensterfuß, Fokus auf seinem ✕', async ({ page }) => {
    const lesen = await anfragenHalten(page, p => p === PLAN, 'GET');
    await plan(page).focus();
    await page.keyboard.press('Enter');
    await bisAnfrageLaeuft(lesen);
    await expect(plan(page), 'der Fokus steht während des Lesens auf dem ✕').toBeFocused();
    lesen.freigeben('abbrechen');

    await expect(page.locator('#fenster .mod-fuss [role="alert"]')).toContainText('Anhang „plan.pdf“ nicht entfernt: ');
    await expect(plan(page)).toBeFocused();
    await expect(page.locator('#anhaenge .anh-z a')).toHaveText(['notiz.txt', 'plan.pdf']);
    expect(k.git('ls-files', 'aufgaben')).toContain('plan.pdf');
  });
});
