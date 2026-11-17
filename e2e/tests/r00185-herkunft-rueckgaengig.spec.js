// R00185 Herkunft entfernen mit Rückgängig, Fußmeldung bleibt stehen, Kartenname des vergessenen Timers (Paket #102 mit
// #108 und #114). Jede Probe trägt die Nummer ihrer Karte und ihres Kriteriums; US-1 bis US-5 aus user-stories/R00185.md.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter } = require('./hilfen');

const ALS_CL = { headers: { 'X-KanbanD-Wer': 'cl' } };
const gestern = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(Date.now() - 864e5);

/** Die Ausgangslage der Anforderung: #1 mit zwei Herkünften, #2 mit einer und „a“, „b“, #3 mit „c“, einer Zeit und „a.txt“. */
const ausgangslage = () => ({
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\norigins: [I0001, R00014]\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\norigins: [I0001]\n---\n- [ ] a\n- [ ] b\n',
  'aufgaben/0003-drei.md': `---\nid: 3\ntitle: drei\n---\n- [ ] c\n\n\`\`\`kanbanD-time\n${gestern()} 09:00 · ${gestern()} 10:00 · st\n\`\`\`\n`,
  'aufgaben/0003-drei/a.txt': 'a\n',
});
const DATEI = { 1: 'aufgaben/0001-eins.md', 2: 'aufgaben/0002-zwei.md', 3: 'aufgaben/0003-drei.md' };

let k;
test.afterEach(() => k.stoppen());

const commits = () => +k.git('rev-list', '--count', 'HEAD');
/** Die Herkünfte der Datei in ihrer Reihenfolge; ohne Zeile `origins:` eine leere Liste. */
function herkunftDerDatei(nummer) {
  const zeile = /^origins: *\[(.*)\]$/m.exec(k.lies(DATEI[nummer]));
  if (!zeile) return [];
  return zeile[1].split(',').map(x => x.trim());
}
const hinweis = page => page.locator('[aria-modal="true"] .toast[role="status"]');
const rueckgaengigKnopf = page => page.locator('.toast [data-act="rueckgaengig"]');
const fussMeldung = page => page.locator('#fenster .mod-fuss [role="alert"]');
const kreuz = (page, herkunft) => page.getByLabel(`Herkunft ${herkunft} entfernen`);
/** Die im Fenster gezeigten Herkünfte, gelesen an ihren ✕. */
const gezeigteHerkunft = page => page.locator('#fenster [data-act="herkunft-weg"]').evaluateAll(l => l.map(e => e.getAttribute('aria-label').replace(/^Herkunft (.*) entfernen$/, '$1')));

async function starten(page) {
  k = await kanbanStarten(einrichten(ausgangslage()));
  await alsPerson(page, 'st');
  await page.goto(k.adresse);
}
async function fensterOeffnen(page, nummer, ansicht) {
  await page.locator(`.ka[data-id="${nummer}"] .id`).click();
  await reiter(page, ansicht);
}
/** Entfernt die Herkunft und wartet, bis Datei und Hinweis es zeigen. */
async function herkunftEntfernt(page, nummer, herkunft, bleibt, ausloesen = () => kreuz(page, herkunft).click()) {
  await ausloesen();
  await expect.poll(() => herkunftDerDatei(nummer)).toEqual(bleibt);
  await expect(hinweis(page)).toContainText(`Herkunft ${herkunft} entfernt`);
  await expect(rueckgaengigKnopf(page)).toBeVisible();
}
/** Enter auf dem fokussierten ✕ — der Weg ohne Maus. */
const perEnter = (page, herkunft) => async () => { await kreuz(page, herkunft).focus(); await page.keyboard.press('Enter'); };

test.describe('R00185 #102 Herkunft entfernen mit Rückgängig', () => {
  test.beforeEach(async ({ page }) => { await starten(page); });

  test('102-1/US-1: ✕ an I0001, Strg+Z → Datei wieder [I0001, R00014], je ein Commit, Fokus auf dem ✕ an I0001', async ({ page }) => {
    await fensterOeffnen(page, 1, 'Details');
    const vorher = commits();
    await herkunftEntfernt(page, 1, 'I0001', ['R00014']);
    await expect.poll(commits).toBe(vorher + 1);
    await page.keyboard.press('Control+z');
    await expect.poll(() => herkunftDerDatei(1)).toEqual(['I0001', 'R00014']);
    await expect(hinweis(page)).toHaveText('Herkunft I0001 wiederhergestellt');
    await expect(rueckgaengigKnopf(page)).toHaveCount(0);
    await expect.poll(() => gezeigteHerkunft(page)).toEqual(['I0001', 'R00014']);
    await expect(kreuz(page, 'I0001')).toBeFocused();
    await expect.poll(commits).toBe(vorher + 2);
  });

  test('102-1: Knopf „rückgängig“ nach ✕ an R00014 → sie kommt an die zweite Stelle zurück', async ({ page }) => {
    await fensterOeffnen(page, 1, 'Details');
    const vorher = commits();
    await herkunftEntfernt(page, 1, 'R00014', ['I0001']);
    await hinweis(page).getByRole('button', { name: 'rückgängig' }).click();
    await expect.poll(() => herkunftDerDatei(1)).toEqual(['I0001', 'R00014']);
    await expect(hinweis(page)).toHaveText('Herkunft R00014 wiederhergestellt');
    await expect(kreuz(page, 'R00014')).toBeFocused();
    await expect.poll(commits).toBe(vorher + 2);
  });

  test('102-2: die letzte Herkunft → „ohne Herkunft“, Rückgängig → [I0001], kein thin air', async ({ page }) => {
    await fensterOeffnen(page, 2, 'Details');
    await herkunftEntfernt(page, 2, 'I0001', []);
    await expect(page.locator('#fenster .felder-details')).toContainText('ohne Herkunft');
    expect(k.lies(DATEI[2])).not.toContain('I0001');
    await hinweis(page).getByRole('button', { name: 'rückgängig' }).click();
    await expect.poll(() => herkunftDerDatei(2)).toEqual(['I0001']);
    expect(k.lies(DATEI[2])).not.toContain('thin air');
    await expect(page.locator('#fenster .felder-details')).not.toContainText('ohne Herkunft');
  });

  test('102-2: ergänzt der Agent dazwischen R00020, ergibt Rückgängig [I0001, R00014, R00020] — seine Herkunft bleibt', async ({ page }) => {
    await fensterOeffnen(page, 1, 'Details');
    await herkunftEntfernt(page, 1, 'I0001', ['R00014']);
    const ergaenzt = await page.request.patch(k.adresse + 'api/aufgaben/1', { ...ALS_CL, data: { herkunft: ['R00014', 'R00020'] } });
    expect(ergaenzt.status()).toBe(200);
    await expect.poll(() => gezeigteHerkunft(page), 'im Fenster angekommen').toEqual(['R00014', 'R00020']);
    await page.keyboard.press('Control+z');
    await expect.poll(() => herkunftDerDatei(1)).toEqual(['I0001', 'R00014', 'R00020']);
    await expect(hinweis(page)).toHaveText('Herkunft I0001 wiederhergestellt');
  });

  test('102-3: nach dem ✕ steht der Fokus auf dem ✕ der Nachbarin', async ({ page }) => {
    await fensterOeffnen(page, 1, 'Details');
    await herkunftEntfernt(page, 1, 'I0001', ['R00014'], perEnter(page, 'I0001'));
    await expect(kreuz(page, 'R00014')).toBeFocused();
  });

  test('102-3/US-2: die letzte Herkunft per Enter → Fokus im leeren Feld „Neue Herkunft“, Strg+Z wirkt dort, Fokus danach auf ihrem ✕', async ({ page }) => {
    await fensterOeffnen(page, 2, 'Details');
    await herkunftEntfernt(page, 2, 'I0001', [], perEnter(page, 'I0001'));
    await expect(page.getByLabel('Neue Herkunft')).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect.poll(() => herkunftDerDatei(2)).toEqual(['I0001']);
    await expect(kreuz(page, 'I0001')).toBeFocused();
  });

  test('102-3: ist im Feld „R0“ getippt, gehört Strg+Z dem Feld und nimmt nichts zurück', async ({ page }) => {
    await fensterOeffnen(page, 2, 'Details');
    await herkunftEntfernt(page, 2, 'I0001', [], perEnter(page, 'I0001'));
    await expect(page.getByLabel('Neue Herkunft')).toBeFocused();
    const nachDemEntfernen = commits();
    await page.keyboard.type('R0');
    await page.keyboard.press('Control+z');
    // Frist für das Ausbleiben: es darf nichts geschrieben werden (ADR-0026 Regel 5)
    await page.waitForTimeout(500);
    await expect(rueckgaengigKnopf(page)).toBeVisible();
    expect(herkunftDerDatei(2)).toEqual([]);
    expect(commits()).toBe(nachDemEntfernen);
  });
});

test.describe('R00185 #102 Ablauf des Hinweises', () => {
  test('102-3/US-2: nach 8 s ist der Knopf fort und Strg+Z ohne Wirkung', async ({ page }) => {
    await page.clock.install();
    await starten(page);
    await fensterOeffnen(page, 2, 'Details');
    await herkunftEntfernt(page, 2, 'I0001', []);
    const nachDemEntfernen = commits();
    await page.clock.runFor(5000);
    await expect(rueckgaengigKnopf(page)).toBeVisible();
    await page.clock.runFor(7000);
    await expect(rueckgaengigKnopf(page)).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    expect(herkunftDerDatei(2)).toEqual([]);
    expect(commits()).toBe(nachDemEntfernen);
  });
});

test.describe('R00185 #108 Rückgängig ohne Aufgabe', () => {
  let seitenfehler;
  test.beforeEach(async ({ page }) => {
    seitenfehler = [];
    page.on('pageerror', f => seitenfehler.push(f.message));
    await starten(page);
  });

  /** Der Agent löscht #2 endgültig, das Fenster ist fort; Strg+Z meldet, statt zu werfen. */
  async function geloeschtUndRueckgaengig(page) {
    const geloescht = await page.request.delete(k.adresse + 'api/aufgaben/2', ALS_CL);
    expect(geloescht.ok()).toBe(true);
    await expect(page.locator('#fenster')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="2"]')).toHaveCount(0);
    await expect(rueckgaengigKnopf(page)).toBeVisible();
    const vorher = commits();
    await page.keyboard.press('Control+z');
    await expect(page.locator('.toast, .mod-fuss [role="alert"]').filter({ hasText: /^nicht rückgängig:/ })).toBeVisible();
    expect(seitenfehler).toEqual([]);
    expect(commits()).toBe(vorher);
  }

  test('108-1/US-3: ✕ an Teilaufgabe „b“, der Agent löscht #2, Strg+Z → „nicht rückgängig: …“, kein Seitenfehler, kein Commit', async ({ page }) => {
    await fensterOeffnen(page, 2, 'Inhalt');
    await page.getByLabel('Teilaufgabe b entfernen').click();
    await expect(hinweis(page)).toContainText('Teilaufgabe „b“ entfernt');
    await geloeschtUndRueckgaengig(page);
  });

  test('108-1: dasselbe nach ✕ an der Herkunft I0001 von #2', async ({ page }) => {
    await fensterOeffnen(page, 2, 'Details');
    await herkunftEntfernt(page, 2, 'I0001', []);
    await geloeschtUndRueckgaengig(page);
  });
});

test.describe('R00185 #108 Fußmeldung ohne Feld bleibt stehen', () => {
  test.beforeEach(async ({ page }) => { await starten(page); });

  const MELDUNG = 'nicht rückgängig: #3 hat schon eine Zeit 09:00–10:00 von Stefan';
  const haken = page => page.locator('#fenster .chk [role="checkbox"]');
  const gespeichert = page => expect(page.locator('#fenster .mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);

  /** Lage von US-4: Zeit gelöscht, vom Agenten wieder eingetragen, Strg+Z abgelehnt — die Meldung steht im Fuß. */
  async function abgelehntesRueckgaengig(page) {
    await fensterOeffnen(page, 3, 'Zeiten');
    await page.getByLabel('Zeit 1 löschen').click();
    await expect(hinweis(page)).toContainText('Zeit 09:00–10:00 von Stefan gelöscht');
    const zurueck = await page.request.post(k.adresse + 'api/aufgaben/3/zeiten', { ...ALS_CL, data: { wer: 'st', beginn: `${gestern()} 09:00`, ende: `${gestern()} 10:00` } });
    expect(zurueck.status()).toBe(200);
    await page.keyboard.press('Control+z');
    await expect(fussMeldung(page)).toHaveText(MELDUNG);
  }
  async function cAbhaken(page) {
    await reiter(page, 'Inhalt');
    await haken(page).click();
    await expect.poll(() => k.lies(DATEI[3])).toContain('- [x] c');
    await expect(haken(page)).toHaveAttribute('aria-checked', 'true');
    await gespeichert(page);
  }

  test('108-2/US-4: „nicht rückgängig: …“ übersteht das Abhaken von „c“ und steht neben „gespeichert hh:mm:ss“; neu geöffnet ist sie fort', async ({ page }) => {
    await abgelehntesRueckgaengig(page);
    await cAbhaken(page);
    await expect(fussMeldung(page)).toHaveText(MELDUNG);
    await page.locator('#fenster [data-act="schliessen"]').click();
    await expect(page.locator('#fenster')).toHaveCount(0);
    await fensterOeffnen(page, 3, 'Inhalt');
    await expect(haken(page)).toBeVisible();
    await expect(fussMeldung(page)).toHaveCount(0);
  });

  test('108-2: eine andere Meldung nimmt ihren Platz', async ({ page }) => {
    await abgelehntesRueckgaengig(page);
    await cAbhaken(page);
    await reiter(page, 'Details');
    await page.getByLabel('Neue Herkunft').fill('X1');
    await page.keyboard.press('Enter');
    await expect(fussMeldung(page)).toContainText('„X1“ ist keine Herkunft');
    await expect(fussMeldung(page)).not.toContainText('nicht rückgängig');
  });

  test('108-2: unter der stehenden Meldung bietet ein angenommenes Entfernen weiter „rückgängig“ an', async ({ page }) => {
    await abgelehntesRueckgaengig(page);
    await reiter(page, 'Inhalt');
    await page.getByLabel('Teilaufgabe c entfernen').click();
    await expect.poll(() => k.lies(DATEI[3])).not.toContain('] c');
    await expect(hinweis(page)).toContainText('Teilaufgabe „c“ entfernt');
    await expect(rueckgaengigKnopf(page)).toBeVisible();
    await expect(fussMeldung(page)).toHaveText(MELDUNG);
  });

  test('108-2: „Anhang „a.txt“ nicht entfernt: …“ übersteht das Abhaken von „c“ und geht, wenn das ✕ an „a.txt“ beim nächsten Versuch gelingt', async ({ page }) => {
    await fensterOeffnen(page, 3, 'Inhalt');
    // umgelenkte Anfrage: nur das erste Lesen scheitert
    let gescheitert = false;
    await page.route('**/api/aufgaben/3/anhaenge/a.txt', route => {
      if (route.request().method() !== 'GET' || gescheitert) return route.continue();
      gescheitert = true;
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"Platte nicht lesbar"}' });
    });
    await page.getByLabel('Anhang a.txt entfernen').click();
    await expect(fussMeldung(page)).toHaveText('Anhang „a.txt“ nicht entfernt: Platte nicht lesbar');
    await cAbhaken(page);
    await expect(fussMeldung(page)).toHaveText('Anhang „a.txt“ nicht entfernt: Platte nicht lesbar');
    await page.getByLabel('Anhang a.txt entfernen').click();
    await expect(hinweis(page)).toContainText('Anhang „a.txt“ entfernt');
    await expect(fussMeldung(page)).toHaveCount(0);
  });
});

test.describe('R00185 #114 Kartenname des vergessenen Timers', () => {
  const KOPF = '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nsources:\n  wbs: ""\n  requirements: ""\n---\n';
  /** Uhr stellen und anhalten: erst dann steht die Laufzeit auf die Sekunde fest. */
  const uhrStellen = async (page, zeit) => { await page.clock.install({ time: zeit }); await page.clock.pauseAt(zeit); };
  /** Stellt die Uhr vor und hält die Live-Verbindung dabei frisch — es kommt kein Ereignis, nur der Takt läuft. */
  async function uhrVor(page, ms) {
    for (let rest = ms; rest > 0; rest -= 30000) {
      await page.clock.runFor(Math.min(30000, rest));
      await page.evaluate(() => window.kdTest.herzschlag());
    }
  }
  const renders = page => page.evaluate(() => window.kdTest.renders());

  test('114-1/US-5: zwei Minuten später, ohne Ereignis und ohne Klick, nennen Laufchip und aria-label „seit 11 Stunden“', async ({ page }) => {
    // 12:00:00 am Probentag, der Timer läuft seit 01:01 — 10 Stunden 59 Minuten
    k = await kanbanStarten(einrichten({
      'kanbanD.md': KOPF,
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #4\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n```kanbanD-time\n2030-01-07 01:01 · ... · st\n```\n',
    }));
    await alsPerson(page, 'st');
    await uhrStellen(page, new Date(2030, 0, 7, 12, 0, 0));
    await page.goto(k.adresse);
    const karte = page.locator('.ka[data-id="4"]'), chip = karte.locator('.lauf');
    await expect(chip).toHaveText('seit 10 Stunden');
    await expect(karte).toHaveAttribute('aria-label', /Timer läuft seit 10 Stunden/);
    // bis 12:00:50 ändert sich das Wort nicht: der Hinweis auf den vergessenen Timer ist abgelaufen, danach wird nicht gezeichnet
    await uhrVor(page, 30000);
    const vorDerKante = await renders(page);
    await uhrVor(page, 20000);
    expect(await renders(page), 'kein Zeichnen je Sekunde').toBe(vorDerKante);
    await uhrVor(page, 70000);
    await expect(chip).toHaveText('seit 11 Stunden');
    await expect(karte).toHaveAttribute('aria-label', /Timer läuft seit 11 Stunden/);
    // der Name folgt im Takt wie der Chip, ohne Neuzeichnen — wie der Satz am Tageswechsel (R00114 US-2)
    expect(await renders(page), 'kein Zeichnen am Wechsel des Worts').toBe(vorDerKante);
  });
});
