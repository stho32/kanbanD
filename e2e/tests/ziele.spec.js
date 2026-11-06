// R00108 Zielgrößen 24 px bei feinem Zeiger, 44 px bei Touch (ADR-0012 Regel 6): Messprobe über die Ansichten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');
const { zieleMessen, titelPruefen, breiteMessen, zieleImInhalt } = require('./ziele-hilfen');

// Der Browser rechnet in Europe/Berlin (playwright.config.js) — die Fälligkeit ebenso.
const tag = n => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() + n * 864e5));
const ALS_ST = { headers: { 'X-KanbanD-Wer': 'st' } };

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'rot', { fertig: 'US-1' }),
]);
const einstellungen = arbeit => `---
people:
  st: {name: Stefan, kind: human}
  mi: {name: Mia, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
  feature: {label: Funktion, color: green}
signals:
  mail: {label: Neue E-Mail, color: blue}
sources:
  wbs: ""
  requirements: ""
  applications:
    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}
---
`;
const ZEIT = '```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 11:00 · st\n```\n';
const grundbestand = arbeit => ({
  'kanbanD.md': einstellungen(arbeit),
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n\n## In Arbeit\n\n- [#3](../aufgaben/0003-drei.md)\n\n## Erledigt\n\n- [#4](../aufgaben/0004-vier.md)\n',
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nclass: bug\nassignees: [st]\ndue: ${tag(-1)}\n---\n- [x] a\n- [ ] b\n- [ ] c\n\n${ZEIT}`,
  'aufgaben/0001-eins/notiz.txt': 'Anhang',
  'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: zwei\nclass: feature\nassignees: [cl]\nsignals: [mail]\n---\n${ZEIT}`,
  'aufgaben/0002-zwei/protokoll.txt': 'Anhang',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\nassignees: [mi]\nlabels: [repo:shop, nc:304]\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\narchived: 2026-10-01\n---\n',
});

let k, arbeit;
const starten = async page => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(einrichten(grundbestand(arbeit)));
  expect((await page.request.post(`${k.adresse}api/aufgaben/3/timer/start`, ALS_ST)).ok()).toBe(true);
  await alsPerson(page, 'st');
};
test.afterEach(async () => {
  if (k) await k.stoppen();
  if (arbeit) arbeit.aufraeumen();
  k = null; arbeit = null;
});

/** Öffnet das Aufgabenfenster einer Karte des Boards. */
async function fensterOeffnen(page, nummer) {
  await page.goto(k.adresse + '#/board/entwicklung');
  await page.locator(`.ka[data-id="${nummer}"] .t`).click();
  await page.getByRole('dialog', { name: `Aufgabe #${nummer}` }).waitFor();
}

test.describe('Touch, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Löschknöpfe neben Teilaufgaben, Zeiten und Anhängen sind ohne Hover sichtbar', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
    const knoepfe = fenster.locator('.chk .x, .zt .btn-sym, .anh-z .x');
    await expect(knoepfe.first()).toBeAttached();
    const art = await knoepfe.evaluateAll(liste => liste.map(e => e.closest('.chk, .zt, .anh-z').className.split(' ')[0]));
    expect(new Set(art)).toEqual(new Set(['chk', 'zt', 'anh-z']));
    const deckkraft = await knoepfe.evaluateAll(liste => liste.map(e => getComputedStyle(e).opacity));
    expect(deckkraft.every(wert => wert === '1'), deckkraft.join(' ')).toBe(true);
  });
});

test.describe('Teilaufgabe auf der Karte: Text gehört zum Ziel', () => {
  test.describe('Touch', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('Tipp auf den Text „b“ von #1 → Datei - [x] b, Karte zeigt „c“, kein Fenster', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      const eins = page.locator('.ka[data-id="1"]');
      await eins.locator('.naechste').getByText('b', { exact: true }).tap();
      await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
      await expect(eins.locator('.naechste')).toHaveText('c');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('Tipp auf den Titel von #1 öffnet weiterhin das Fenster', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await page.locator('.ka[data-id="1"] .t').tap();
      await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
      expect(k.lies('aufgaben/0001-eins.md')).toContain('- [ ] b');
    });
  });

  // Der Tipp oben bestand schon vor dem Umbau: Chromium lenkt einen Tipp auf ein nahes Ziel um (Touch Adjustment).
  // Der Mausklick auf denselben Text wird nicht umgelenkt und zeigt, ob der Text selbst zum Ziel gehört.
  test('Klick mit der Maus auf den Text „b“ von #1 → Datei - [x] b, Karte zeigt „c“, kein Fenster', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    const eins = page.locator('.ka[data-id="1"]');
    await eins.locator('.naechste').getByText('b', { exact: true }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
    await expect(eins.locator('.naechste')).toHaveText('c');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('ein Tab-Halt: Kästchen und Text sind ein Element role=checkbox, Schrift und Farbe wie der Kartentext', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    const naechste = page.locator('.ka[data-id="1"] .naechste');
    const halte = naechste.locator('button, a[href], input, select, [tabindex]:not([tabindex="-1"])');
    await expect(halte).toHaveCount(1);
    await expect(halte).toHaveAttribute('role', 'checkbox');
    await expect(halte).toHaveAttribute('aria-checked', 'false');
    await expect(halte).toHaveAccessibleName('b abhaken');
    await expect(halte).toHaveText('b');
    const stil = loc => loc.evaluate(e => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.fontWeight, s.color, s.textAlign]; });
    const [ziel, umgebung] = await Promise.all([stil(halte), stil(naechste)]);
    expect(ziel).toEqual(umgebung.slice(0, 4).concat(['start']));
  });

  test('Leertaste hakt ab und setzt den Fokus auf die nächste offene Teilaufgabe, danach auf die Karte', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await page.getByRole('checkbox', { name: 'b abhaken' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: 'c abhaken' })).toBeFocused();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] c');
  });
});

test.describe('Klickflächen ohne Knopf tragen eine Rolle und gehen mit der Tastatur', () => {
  test('Aufgabenfenster #1: Enter auf dem Text der Teilaufgabe „b“ öffnet die Bearbeitung', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    const text = page.getByRole('dialog', { name: 'Aufgabe #1' }).getByRole('button', { name: 'b', exact: true });
    await text.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#teil-edit')).toHaveValue('b');
    await expect(page.locator('#teil-edit')).toBeFocused();
  });

  test('Aufgabenfenster #1: Leertaste auf dem Text der Teilaufgabe „b“ öffnet die Bearbeitung wie bei jedem Knopf', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await expect(page.locator('#teil-edit')).toHaveCount(0);
    const text = page.getByRole('dialog', { name: 'Aufgabe #1' }).getByRole('button', { name: 'b', exact: true });
    await text.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#teil-edit')).toHaveValue('b');
    await expect(page.locator('#teil-edit')).toBeFocused();
  });

  test('Einrichten: die Art von Mia ist eine Radiogruppe, Pfeil rechts wählt „Agent“', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/einrichten');
    const art = page.getByRole('radiogroup', { name: 'Art mi' });
    await expect(art.getByRole('radio', { name: 'Mensch' })).toHaveAttribute('aria-checked', 'true');
    await art.getByRole('radio', { name: 'Mensch' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radiogroup', { name: 'Art mi' }).getByRole('radio', { name: 'Agent' })).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Basisregel: Bedienelemente mindestens --kd-ziel', () => {
  test('Aufgabenliste mit Maus: der Titel-Link von #1, allein in seiner Zelle, mindestens 24 × 24', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    const box = await page.locator('td.tt a[data-arg="1"]').boundingBox();
    expect(box.width, 'Breite').toBeGreaterThanOrEqual(24);
    expect(box.height, 'Höhe').toBeGreaterThanOrEqual(24);
  });

  test('Einrichten mit Maus: jedes Farbfeld der offenen Palette mindestens 24 × 24', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/einrichten');
    await page.getByRole('button', { name: 'Farbe bug' }).click();
    const felder = await page.locator('.pal .g [role=button]').evaluateAll(l => l.map(e => e.getBoundingClientRect()).map(r => [r.width, r.height]));
    expect(felder.length).toBe(await page.locator('.pal .g [role=button]').count());
    expect(felder.filter(([b, h]) => b < 24 || h < 24)).toEqual([]);
  });

  test('Personen mit Maus: die Nummer „#3“ neben dem laufenden Timer mindestens 24 × 24', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/personen');
    const [breite, hoehe] = await groesse(page.locator('.akt a.id', { hasText: '#3' }));
    expect(Math.min(breite, hoehe), `${breite} × ${hoehe}`).toBeGreaterThanOrEqual(24);
  });

  test.describe('Links neben Elementen, Touch, 390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mindestens44 = async loc => {
      const [breite, hoehe] = await groesse(loc);
      expect(Math.min(breite, hoehe), `${breite} × ${hoehe}`).toBeGreaterThanOrEqual(44);
    };

    test('Anhang „notiz.txt“ im Aufgabenfenster #1 und „API für Agenten“ in der Fußzeile mindestens 44', async ({ page }) => {
      await starten(page);
      await fensterOeffnen(page, 1);
      await mindestens44(page.locator('.anh-z a', { hasText: 'notiz.txt' }));
      await page.keyboard.press('Escape');
      await mindestens44(page.locator('#stat a', { hasText: 'API für Agenten' }));
    });

    test('Aufgabenliste: Titel „vier“ neben dem Etikett „archiviert“ mindestens 44', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/aufgaben');
      await page.getByRole('radio', { name: /archiviert/ }).tap();
      await mindestens44(page.locator('td.tt a[data-arg="4"]'));
    });

    test('Personen: die Nummer „#3“ neben dem laufenden Timer mindestens 44', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/personen');
      await mindestens44(page.locator('.akt a.id', { hasText: '#3' }));
    });
  });

  test.describe('Touch, 320 px', () => {
    test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

    test('die Palette bricht um: jedes Feld mindestens 44, keins ragt über den Rand, keins überlappt ein anderes', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/einrichten');
      await page.getByRole('button', { name: 'Farbe bug' }).tap();
      const felder = await page.locator('.pal .g [role=button]').evaluateAll(l => l.map(e => e.getBoundingClientRect().toJSON()));
      expect(felder.length).toBeGreaterThan(0);
      expect(felder.filter(r => r.width < 44 || r.height < 44).length, 'kleiner als 44').toBe(0);
      expect(felder.filter(r => r.right > 320).length, 'über den Rand').toBe(0);
      const ueberlappt = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      expect(felder.filter((a, i) => felder.some((b, j) => i !== j && ueberlappt(a, b))).length, 'überlappend').toBe(0);
    });
  });
});

// Die fünf kleinen Zeichen: Zeichnung bleibt klein, bei feinem Zeiger trägt ein Hof die Trefferfläche, bei Touch wachsen sie selbst.
// Die Leisten um sie herum (Statuszeile, Spaltenkopf) wachsen mit dem Token (B0404) und gehören zur Messprobe über die Ansichten.
const ZEICHEN = /\.lnk-x\[|\.kopf-plus|\.signal\[|\.sigz|\.kl\[/;
const zeichenVerstoesse = async (page, zeiger, ansicht) => (await zieleMessen(page, { zeiger, ansicht, ohneKreis: true })).filter(v => ZEICHEN.test(v.selektor));
const groesse = async loc => { const b = await loc.boundingBox(); return [Math.round(b.width), Math.round(b.height)]; };

test.describe('Trefferhof für kleine Zeichen', () => {
  test('Board mit Maus: Signal, Spalten-„+“, Signal-Chip und Timer-Stopp treffen auf mindestens 24 × 24, gezeichnet bleiben sie klein', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await expect(page.locator('.ka[data-id="3"] .kl')).toBeVisible();
    expect(await zeichenVerstoesse(page, 'fein', 'board')).toEqual([]);
    expect(await groesse(page.locator('.kopf-plus').first())).toEqual([20, 20]);
    expect(await groesse(page.locator('.ka[data-id="2"] .signal'))).toEqual([22, 22]);
    expect((await groesse(page.locator('.ka[data-id="3"] .kl')))[1]).toBeLessThan(24);
    expect(await titelPruefen(page, 'board')).toEqual([]);
  });

  test('Aufgabenliste mit Maus: ✕ „von Board nehmen“ trifft auf mindestens 24 × 24', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    await expect(page.locator('.lnk[data-act="abnehmen"]').first()).toBeVisible();
    expect(await zeichenVerstoesse(page, 'fein', 'aufgaben')).toEqual([]);
    expect((await groesse(page.locator('.lnk[data-act="abnehmen"]').first()))[0], 'gezeichnet klein').toBeLessThan(24);
  });

  test.describe('Touch, 390 px', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    // Das Maß 44 der Zeichen prüft der Touch-Lauf der Messprobe (B0405); die Touch-Liste ist in das Token aufgelöst (B0404).
    test('Board: kein Hof auf der Karte, kein Punkt des Titels trifft ein Zeichen, ein Tipp 8 px links vom Signal öffnet die Karte', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await expect(page.locator('.ka[data-id="2"] .signal')).toBeVisible();
      const hoefe = await page.locator('.ka .signal, .ka .kl').evaluateAll(l => l.map(e => getComputedStyle(e, '::after').content));
      expect(hoefe.every(c => c === 'none'), hoefe.join(' ')).toBe(true);
      expect(await titelPruefen(page, 'board')).toEqual([]);
      // Die Messung hat die Spaltenleiste quer gescrollt; das Signal zurück ins Bild holen
      await page.locator('.ka[data-id="2"] .signal').scrollIntoViewIfNeeded();
      const signal = await page.locator('.ka[data-id="2"] .signal').boundingBox();
      await page.touchscreen.tap(signal.x - 8, signal.y + signal.height / 2);
      await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
      await expect(page.locator('.ka[data-id="2"] .signal')).toHaveCount(1);
      expect(k.lies('aufgaben/0002-zwei.md')).toContain('signals: [mail]');
    });
  });
});

// Messprobe über die Ansichten (B0401): jede Ansicht mit Signal, Fälligkeit, Teilaufgabe, laufendem Timer, Archiv und Zuweisung.
const brett = page => page.goto(k.adresse + '#/board/entwicklung');
const menue = id => async page => { await brett(page); await page.locator(id).click(); await page.getByRole('menu').first().waitFor(); };
const bericht = name => page => page.goto(k.adresse + '#/berichte/' + name);
const ANSICHTEN = [
  { ansicht: 'Board', oeffnen: brett },
  { ansicht: 'Archiv des Boards', oeffnen: async page => { await brett(page); await page.locator('[data-act="archiv-an"]').click(); await page.locator('.ka[data-id="4"]').waitFor(); } },
  { ansicht: 'Aufgabenliste', oeffnen: page => page.goto(k.adresse + '#/aufgaben') },
  { ansicht: 'Personen', oeffnen: page => page.goto(k.adresse + '#/personen') },
  { ansicht: 'Einrichten', oeffnen: page => page.goto(k.adresse + '#/einrichten') },
  { ansicht: 'Einrichten mit offener Palette', oeffnen: async page => { await page.goto(k.adresse + '#/einrichten'); await page.getByRole('button', { name: 'Farbe bug' }).click(); await page.locator('.pal').waitFor(); } },
  ...['stundenzettel', 'kreuz', 'verlauf', 'durchlauf', 'prognose', 'fieber', 'kosten', 'bestand'].map(name => ({ ansicht: 'Bericht ' + name, oeffnen: bericht(name) })),
  { ansicht: 'WBS-Sicht', oeffnen: async page => { await page.goto(k.adresse + '#/wbs/kd'); await page.locator('.wbs-tabelle').waitFor(); } },
  { ansicht: 'API für Agenten', oeffnen: page => page.goto(k.adresse + 'api') },
  { ansicht: 'Aufgabenfenster #1', oeffnen: page => fensterOeffnen(page, 1) },
  // Das Menü „<Seite> ▾“ gibt es nur in der Stufe compact (unter 600 px, web/kopfzeile.js)
  { ansicht: 'Menü Seite', breite: 560, oeffnen: menue('#t-seite') },
  { ansicht: 'Menü Mehr', oeffnen: menue('#t-mehr') },
  // Das Menü „Berichte“ steht erst ab der Stufe medium (600 px) in der Kopfzeile, darunter im Menü „<Seite> ▾“
  { ansicht: 'Menü Berichte', touchBreite: 600, oeffnen: menue('#t-ber') },
  { ansicht: 'Menü Ich', oeffnen: menue('#t-ich') },
  { ansicht: 'Kontextmenü #1', oeffnen: async page => { await brett(page); await page.locator('.ka[data-id="1"]').click({ button: 'right' }); await page.getByRole('menu').first().waitFor(); } },
];

/**
 * Bekannte Verstöße, die (noch) nicht gemessen werden dürfen — je Eintrag Selektor, Ansicht, Karte, heutiges Maß und Grund.
 * Leer nach Entscheidung des planers (R00108, Notizen). Ein Eintrag schlägt Alarm, sobald sein Verstoß verschwindet,
 * das Maß erreicht oder kleiner wird.
 */
const NICHT_GEMESSEN = [];

/** Trennt gemessene Verstöße in offene (nicht gelistet) und Alarme der Liste. */
function abgleichen(verstoesse, liste, ansicht) {
  const gelistet = liste.filter(e => e.ansicht === ansicht);
  const passt = (v, e) => v.selektor === e.selektor;
  const offen = verstoesse.filter(v => !gelistet.some(e => passt(v, e)));
  const alarme = gelistet.flatMap(e => {
    const v = verstoesse.find(x => passt(x, e));
    if (!v) return [`${e.selektor} in ${ansicht}: Verstoß verschwunden oder Maß erreicht — Eintrag aus NICHT_GEMESSEN streichen (${e.karte})`];
    if (Math.min(v.breite, v.hoehe) < e.mass) return [`${e.selektor} in ${ansicht}: kleiner geworden, ${Math.min(v.breite, v.hoehe)} statt ${e.mass} (${e.karte})`];
    return [];
  });
  return { offen, alarme };
}

test('Abgleich mit NICHT_GEMESSEN: Verschwinden, Kleinerwerden und ungelistete Verstöße fallen auf', () => {
  const liste = [{ selektor: 'button.a', ansicht: 'X', karte: '#99', mass: 20, grund: 'Probe' }];
  const v = (selektor, breite) => ({ ansicht: 'X', selektor, name: '', breite, hoehe: 30, mass: 24, trifft: true });
  expect(abgleichen([v('button.a', 20)], liste, 'X')).toEqual({ offen: [], alarme: [] });
  expect(abgleichen([], liste, 'X').alarme).toHaveLength(1);
  expect(abgleichen([v('button.a', 18)], liste, 'X').alarme).toHaveLength(1);
  expect(abgleichen([v('button.b', 18)], liste, 'X').offen.map(x => x.selektor)).toEqual(['button.b']);
  expect(NICHT_GEMESSEN).toEqual([]);
});

test.describe('Messprobe, feiner Zeiger, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const { ansicht, oeffnen, breite } of ANSICHTEN) {
    test(`${ansicht}: jedes Ziel mindestens 24 × 24 oder Kreis-Ausnahme`, async ({ page }) => {
      if (breite) await page.setViewportSize({ width: breite, height: 800 });
      await starten(page);
      await oeffnen(page);
      await expect.poll(() => zieleImInhalt(page), { message: 'die Ansicht zeigt Ziele' }).toBeGreaterThan(0);
      const { offen, alarme } = abgleichen(await zieleMessen(page, { zeiger: 'fein', ansicht }), NICHT_GEMESSEN, ansicht);
      expect(alarme).toEqual([]);
      expect(offen).toEqual([]);
    });
  }
  test('Board: jeder Punkt eines Kartentitels öffnet die Karte', async ({ page }) => {
    await starten(page);
    await brett(page);
    expect(await titelPruefen(page, 'Board')).toEqual([]);
  });
});

// B0404: Touch-Liste in das Token aufgelöst — Leisten wachsen mit ihren Zielen, kein festes Touch-Maß mehr.
test.describe('Touch-Maß aus dem Token, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Board: Kopfzeile, Spaltenkopf, Signal-Chip, Felder und Knöpfe mindestens 44, die Leisten umschließen sie', async ({ page }) => {
    await starten(page);
    await brett(page);
    expect(await zieleMessen(page, { zeiger: 'touch', ansicht: 'Board' })).toEqual([]);
    for (const leiste of ['.kz-reihe', '.bahn-kopf', '.stat']) {
      expect((await groesse(page.locator(leiste).first()))[1], leiste).toBeGreaterThanOrEqual(44);
    }
  });

  test('Aufgabenfenster #1: Reiter, Felder, Fuß und Löschknöpfe mindestens 44', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    expect(await zieleMessen(page, { zeiger: 'touch', ansicht: 'Aufgabenfenster #1' })).toEqual([]);
  });
});

// B0405: Touch-Lauf der Messprobe — dieselben Ansichten bei 390 px, Maß 44 ohne Kreis-Ausnahme.
// Das Kontextmenü fehlt: es öffnet nur per Rechtsklick. Unter offenem Fenster misst der Helfer nur die oberste Ebene.
test.describe('Messprobe, Touch, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const { ansicht, oeffnen, touchBreite } of ANSICHTEN.filter(a => !a.ansicht.startsWith('Kontextmenü'))) {
    test(`${ansicht}: jedes Ziel mindestens 44 × 44`, async ({ page }) => {
      if (touchBreite) await page.setViewportSize({ width: touchBreite, height: 844 });
      await starten(page);
      await oeffnen(page);
      await expect.poll(() => zieleImInhalt(page), { message: 'die Ansicht zeigt Ziele' }).toBeGreaterThan(0);
      const { offen, alarme } = abgleichen(await zieleMessen(page, { zeiger: 'touch', ansicht }), NICHT_GEMESSEN, ansicht);
      expect(alarme).toEqual([]);
      expect(offen).toEqual([]);
    });
  }
  test('Board: kein Punkt eines Kartentitels trifft ein anderes Ziel', async ({ page }) => {
    await starten(page);
    await brett(page);
    expect(await titelPruefen(page, 'Board')).toEqual([]);
  });
});

// Der Board-Name bleibt bei Touch 375 lesbar — er schrumpft nicht auf „E…“
test.describe('Board-Name in der Kopfzeile, Touch, 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('der Knopf des Board-Namens ist mindestens 88 px breit', async ({ page }) => {
    await starten(page);
    await brett(page);
    const knopf = page.locator('.kz-board');
    await knopf.waitFor();
    expect((await knopf.boundingBox()).width).toBeGreaterThanOrEqual(88);
  });
});

// Klickbare Berichtszeilen: bei Touch wachsen sie auf das Zielmaß (Messprobe), mit der Maus bleiben sie dicht.
test.describe('Berichtszeilen mit der Maus, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const name of ['stundenzettel', 'kreuz', 'durchlauf']) {
    test(`${name}: jede klickbare Zeile bleibt 28 px hoch`, async ({ page }) => {
      await starten(page);
      await bericht(name)(page);
      await page.locator('tr.klick').first().waitFor();
      const hoehen = await page.locator('tr.klick').evaluateAll(zeilen => zeilen.map(z => Math.round(z.getBoundingClientRect().height)));
      expect(hoehen.length).toBeGreaterThan(0);
      expect(new Set(hoehen)).toEqual(new Set([28]));
    });
  }
});

// Die Spalten der Klassen-, Personen- und Signalzeilen wachsen mit dem Zielmaß — kein Ziel ragt über seine Spalte
// in den Nachbarn (Farbfeld über den Schlüssel, Löschknopf über den Rand).
for (const breite of [320, 375, 414]) {
  test.describe(`Einrichten, Zeilen ohne Überlappung, Touch, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
    test('in jeder Zeile endet jedes Element vor dem nächsten', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/einrichten');
      await page.locator('.klz .farbe').first().waitFor();
      const ueberlappt = await page.evaluate(() => [...document.querySelectorAll('.klz')].flatMap(zeile => {
        const teile = [...zeile.children].filter(el => el.getBoundingClientRect().width > 0);
        return teile.slice(1).flatMap((el, i) => {
          const links = teile[i].getBoundingClientRect(), rechts = el.getBoundingClientRect();
          if (links.right <= rechts.left + 0.5) return [];
          return [`${teile[i].className || teile[i].tagName} ${Math.round(links.right)} > ${el.className || el.tagName} ${Math.round(rechts.left)}`];
        });
      }));
      expect(ueberlappt).toEqual([]);
    });
  });
}

// B0406: Breitenprobe — bei 320, 375 und 414 px mit Touch scrollt keine Ansicht waagrecht (in sich scrollende Bereiche ausgenommen).
for (const breite of [320, 375, 414]) {
  test.describe(`Breitenprobe, Touch, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
    for (const { ansicht, oeffnen, touchBreite } of ANSICHTEN.filter(a => !a.ansicht.startsWith('Kontextmenü'))) {
      if (touchBreite && touchBreite > breite) continue;
      test(`${ansicht}: höchstens ${breite} px breit`, async ({ page }) => {
        await starten(page);
        await oeffnen(page);
        await expect.poll(() => zieleImInhalt(page), { message: 'die Ansicht zeigt Ziele' }).toBeGreaterThan(0);
        expect(await breiteMessen(page, ansicht)).toEqual([]);
      });
    }
  });
}

// B0407 (PO Z. 133): In der Stufe compact bricht die Werkzeugzeile der Kopfzeile um, wenn sie nicht passt —
// Filter in voller Breite oben, Bereichsschalter darunter; passt sie, bleibt sie wie heute.

/** Sichtbare Zeilen der Kopfzeile: je .kz-reihe die Kinder, die unter allen vorigen beginnen, eröffnen eine neue Zeile. */
const kopfZeilen = page => page.evaluate(() => [...document.querySelectorAll('header.kz .kz-reihe')].map(reihe => {
  const kisten = [...reihe.children].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect()).sort((a, b) => a.top - b.top);
  let zeilen = 0, unten = -Infinity;
  for (const k of kisten) { if (k.top >= unten - 1) zeilen++; unten = Math.max(unten, k.bottom); }
  return zeilen;
}).reduce((a, b) => a + b, 0));

for (const [zeiger, geraet] of [['touch', { isMobile: true, hasTouch: true }], ['fein', {}]]) {
  test.describe(`Ausweichen bei 320 px, ${zeiger}`, () => {
    test.use({ viewport: { width: 320, height: 700 }, ...geraet });

    test('Aufgabenliste: kein Überlauf, Bereichsschalter ganz sichtbar unter dem Filter in voller Breite, jedes Ziel im Maß', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/aufgaben');
      await expect.poll(() => zieleImInhalt(page), { message: 'die Ansicht zeigt Ziele' }).toBeGreaterThan(0);
      expect(await breiteMessen(page, 'Aufgabenliste')).toEqual([]);
      const breite = await page.evaluate(() => document.documentElement.clientWidth);
      const bereiche = page.locator('header.kz [role=radio][data-act=list-bereich]');
      await expect(bereiche).toHaveCount(3);
      for (const bereich of await bereiche.all()) {
        await expect(bereich).toHaveText(/^(alle|ohne Board|archiviert)\s*\d+$/);
        const box = await bereich.boundingBox();
        expect(box.x, await bereich.innerText()).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, await bereich.innerText()).toBeLessThanOrEqual(breite);
      }
      const filter = await page.locator('header.kz #flt').boundingBox();
      const reihe = await page.locator('header.kz .kz-reihe').filter({ has: page.locator('#flt') }).boundingBox();
      expect(filter.width, 'Filter in voller Breite').toBeGreaterThanOrEqual(reihe.width - 2 * 16);
      expect((await bereiche.first().boundingBox()).y, 'Bereichsschalter unter dem Filter').toBeGreaterThanOrEqual(filter.y + filter.height);
      expect(await kopfZeilen(page), 'drei Zeilen — die erste Reihe einzeilig, die zweite auf zwei Zeilen umgebrochen').toBe(3);
      expect(await zieleMessen(page, { zeiger, ansicht: 'Aufgabenliste' })).toEqual([]);
    });
  });
}

test.describe('Ausweichen: Gegenprobe, Touch', () => {
  for (const [ansicht, breite, adresse, zeilen] of [['Board', 320, '#/board/entwicklung', 2], ['Aufgabenliste', 414, '#/aufgaben', 2]]) {
    test.describe(`${breite} px`, () => {
      test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
      test(`${ansicht}: Zeilenzahl der Kopfzeile wie vor dem Umbruch`, async ({ page }) => {
        await starten(page);
        await page.goto(k.adresse + adresse);
        await expect.poll(() => zieleImInhalt(page), { message: 'die Ansicht zeigt Ziele' }).toBeGreaterThan(0);
        expect(await kopfZeilen(page)).toBe(zeilen);
      });
    });
  }
});
