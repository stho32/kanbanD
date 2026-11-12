// R00108 Zielgrößen 24 px bei feinem Zeiger, 44 px bei Touch (ADR-0012 Regel 6): Messprobe über die Ansichten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');
const { ansichtenDerAnwendung } = require('./ansichten');
const { zieleMessen, titelPruefen, breiteMessen, zieleImInhalt, ueberlauf, perTabErreicht, titelZelle } = require('./ziele-hilfen');

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
const starten = async (page, mehr = {}) => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(einrichten({ ...grundbestand(arbeit), ...mehr }));
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
    // Jeder Abschnitt steht in seinem Reiter (R00127): dort die eigenen ✕ ohne Hover prüfen.
    const art = [], deckkraft = [];
    for (const [tab, selektor] of [['Inhalt', '.chk .x'], ['Zeiten', '.zt .btn-sym'], ['Anhänge', '.anh-z .x']]) {
      await fenster.getByRole('tab', { name: tab }).click();
      const knoepfe = fenster.locator(selektor);
      await expect(knoepfe.first()).toBeAttached();
      art.push(...await knoepfe.evaluateAll(liste => liste.map(e => e.closest('.chk, .zt, .anh-z').className.split(' ')[0])));
      deckkraft.push(...await knoepfe.evaluateAll(liste => liste.map(e => getComputedStyle(e).opacity)));
    }
    expect(new Set(art)).toEqual(new Set(['chk', 'zt', 'anh-z']));
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

  // Nach dem Bearbeiten kehrt der Fokus auf den Text zurück, von dem die Bearbeitung ausging (B0421)
  for (const [wie, tasten, erwartet] of [['Esc', ['Escape'], 'b'], ['Enter ohne Änderung', ['Enter'], 'b'], ['Enter nach Änderung', ['End', 'x', 'Enter'], 'bx']]) {
    test(`Aufgabenfenster #1: nach ${wie} steht der Fokus auf dem Text der Teilaufgabe „${erwartet}“`, async ({ page }) => {
      await starten(page);
      await fensterOeffnen(page, 1);
      await page.getByRole('dialog', { name: 'Aufgabe #1' }).getByRole('button', { name: 'b', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#teil-edit')).toBeFocused();
      for (const taste of tasten) await page.keyboard.press(taste);
      await expect(page.locator('#teil-edit')).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => [document.activeElement.dataset.act, document.activeElement.textContent])).toEqual(['teil-bearbeiten', erwartet]);
      await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    });
  }

  test('Aufgabenfenster #1: wer aus der Bearbeitung in ein anderes Feld klickt, behält dort den Fokus', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await page.getByRole('dialog', { name: 'Aufgabe #1' }).getByRole('button', { name: 'b', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await page.keyboard.press('y');
    await page.locator('#teil-neu').click();
    await expect(page.locator('#teil-edit')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' }).getByRole('button', { name: 'by', exact: true })).toBeVisible();
    await expect(page.locator('#teil-neu')).toBeFocused();
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
      await page.getByRole('tab', { name: 'Anhänge' }).click();
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
/** Was eine Ansicht der gemeinsamen Liste nach dem Laden noch braucht, bis ihre Ziele stehen. */
const NACH_DEM_LADEN = { 'WBS-Sicht': page => page.locator('.wbs-tabelle').waitFor() };
const geladen = async () => {};
/** Die Ansichten der Anwendung aus der gemeinsamen Liste (ADR-0012 Regel 6), dazu die Zustände, die nur diese Probe misst. */
const ANSICHTEN = [
  ...ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' }).map(({ ansicht, adresse }) => ({
    ansicht,
    oeffnen: async page => { await page.goto(k.adresse + adresse); await (NACH_DEM_LADEN[ansicht] || geladen)(page); },
  })),
  { ansicht: 'Archiv des Boards', oeffnen: async page => { await brett(page); await page.locator('[data-act="archiv-an"]').click(); await page.locator('.ka[data-id="4"]').waitFor(); } },
  { ansicht: 'Einrichten mit offener Palette', oeffnen: async page => { await page.goto(k.adresse + '#/einrichten'); await page.getByRole('button', { name: 'Farbe bug' }).click(); await page.locator('.pal').waitFor(); } },
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

test('Ansichten der Messprobe: jede Ansicht der gemeinsamen Liste und die Zustände mit Archiv, Palette, API, Fenster und Menüs, keine doppelt', () => {
  const namen = ANSICHTEN.map(a => a.ansicht);
  const gemeinsam = ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' }).map(a => a.ansicht);
  const zustaende = ['Archiv des Boards', 'Einrichten mit offener Palette', 'API für Agenten', 'Aufgabenfenster #1', 'Menü Seite', 'Menü Mehr', 'Menü Berichte', 'Menü Ich', 'Kontextmenü #1'];
  expect([...gemeinsam, ...zustaende].filter(name => !namen.includes(name))).toEqual([]);
  expect(new Set(namen).size).toBe(namen.length);
  expect(namen.length).toBeGreaterThanOrEqual(22);
});

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

// B0405: Touch-Lauf der Messprobe — dieselben Ansichten bei 390 px, Maß 44 ohne Kreis-Ausnahme; dazu bei 320 px,
// der schmalsten Breite aus F0050, wo freie Spalten am engsten werden (B0419).
// Das Kontextmenü fehlt: es öffnet nur per Rechtsklick. Unter offenem Fenster misst der Helfer nur die oberste Ebene.
for (const breite of [390, 320]) test.describe(`Messprobe, Touch, ${breite} px`, () => {
  test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
  for (const { ansicht, oeffnen, touchBreite } of ANSICHTEN.filter(a => !a.ansicht.startsWith('Kontextmenü'))) {
    test(`${ansicht}: jedes Ziel mindestens 44 × 44`, async ({ page }) => {
      if (touchBreite) await page.setViewportSize({ width: Math.max(touchBreite, breite), height: 844 });
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

// Die Zelle des Board-Namens schrumpft nicht unter ihren Knopf: der Knopf ragt nicht unter den Seitenknopf (B0420)
for (const breite of [320, 375, 414]) {
  test.describe(`Board-Name neben dem Seitenknopf, Touch, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 812 }, isMobile: true, hasTouch: true });
    test('die Zelle umschließt den Knopf, der Knopf schneidet den Seitenknopf nicht, seine rechte Hälfte trifft ihn selbst', async ({ page }) => {
      await starten(page);
      await brett(page);
      await page.locator('.ka').first().waitFor();
      const m = await page.evaluate(() => {
        const zelle = document.querySelector('.kz-reihe>.kz-z1'), knopf = document.querySelector('.kz-board');
        const rb = knopf.getBoundingClientRect(), rs = document.querySelector('.kz-seite').getBoundingClientRect();
        const mitteY = (rb.top + rb.bottom) / 2;
        const punkte = [0.55, 0.75, 0.95].map(anteil => rb.left + rb.width * anteil);
        return {
          zelle: [zelle.scrollWidth, zelle.clientWidth], knopfRechts: rb.right, seiteLinks: rs.left,
          verfehlt: punkte.filter(x => !document.elementFromPoint(x, mitteY).closest('.kz-board')).map(Math.round),
        };
      });
      expect(m.zelle[0], 'scrollWidth ≤ clientWidth der Zelle').toBeLessThanOrEqual(m.zelle[1]);
      expect(m.knopfRechts, 'Board-Knopf endet vor dem Seitenknopf').toBeLessThanOrEqual(m.seiteLinks);
      expect(m.verfehlt, 'Punkte der rechten Hälfte, die nicht den Board-Knopf treffen').toEqual([]);
    });
  });
}

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
    // Je Paar von Elementen einer Zeile: die Rechtecke schneiden sich nicht — auch wenn die Zeile in zwei Reihen steht (B0419)
    test('in jeder Zeile überdeckt kein Element ein anderes', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/einrichten');
      await page.locator('.klz .farbe').first().waitFor();
      const ueberlappt = await page.evaluate(() => [...document.querySelectorAll('.klz')].flatMap(zeile => {
        const teile = [...zeile.children].filter(el => el.getBoundingClientRect().width > 0).map(el => [el, el.getBoundingClientRect()]);
        const name = el => el.getAttribute('aria-label') || el.className || el.tagName;
        return teile.flatMap(([a, ra], i) => teile.slice(i + 1).flatMap(([b, rb]) => {
          const breite = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const hoehe = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (breite <= 0.5 || hoehe <= 0.5) return [];
          return [`${name(a)} überdeckt ${name(b)}: ${Math.round(breite)} × ${Math.round(hoehe)}`];
        }));
      }));
      expect(ueberlappt).toEqual([]);
    });
    // Ein Feld in der freien Spalte einer Zeile bleibt lesbar: mindestens 44 breit und sein Wert steht ganz darin
    test('jedes Feld einer Zeile ist mindestens 44 breit und zeigt seinen Wert ganz', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/einrichten');
      await page.locator('.klz .farbe').first().waitFor();
      const felder = await page.locator('.klz input').evaluateAll(liste => liste.map(feld => ({
        name: feld.getAttribute('aria-label'), breite: Math.round(feld.getBoundingClientRect().width), wert: feld.value,
        ganz: feld.scrollWidth <= feld.clientWidth,
      })));
      expect(felder.map(f => f.name)).toEqual(expect.arrayContaining(['Name st', 'Neuer Name', 'Bezeichnung bug', 'Bedeutung mail', 'Name der Anwendung kd']));
      expect(felder.filter(f => f.breite < 44), 'schmaler als 44').toEqual([]);
      expect(felder.filter(f => !f.ganz).map(f => `${f.name}: „${f.wert}“ in ${f.breite} px`), 'Wert abgeschnitten').toEqual([]);
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

// B0423 (PO Z. 137 a, b): Die Zeitberichte scrollen bei 320 px nur in einem benannten Rahmen um genau die Tabelle quer.
// Breite Daten: Aufgabe #5 mit 200 Zeichen Titel (darin ein Wort aus 60 Zeichen), heute Zeiten von drei Personen, in „Erledigt“.
const LANGES_WORT = 'Durchlaufzeitenberechnungsvorschriftenzusammenfassungsentwurf'.slice(0, 60).padEnd(60, 'x');
const LANGER_TITEL = (`Sehr langer Titel ${LANGES_WORT} ` + 'mit vielen weiteren Wörtern, die umbrechen dürfen, '.repeat(4)).slice(0, 200);
const zeitHeute = wer => `${tag(0)} 06:00 · ${tag(0)} 06:30 · ${wer}`;
const BREITE_DATEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n\n## In Arbeit\n\n- [#3](../aufgaben/0003-drei.md)\n\n## Erledigt\n\n- [#4](../aufgaben/0004-vier.md)\n- [#5](../aufgaben/0005-lang.md)\n',
  'aufgaben/0005-lang.md': `---\nid: 5\ntitle: ${LANGER_TITEL}\n---\n\`\`\`kanbanD-time\n${['st', 'mi', 'cl'].map(zeitHeute).join('\n')}\n\`\`\`\n`,
};
for (const breite of [320, 375, 414]) {
  test.describe(`Zeitberichte mit breiten Daten, Touch, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
    for (const [name, tabelle, beschriftung] of [['stundenzettel', '#stundenzettel', 'Stundenzettel'], ['kreuz', '#kreuz', 'Zeiten nach Aufgabe und Person'], ['durchlauf', '#durchlauf', 'Aufgaben']]) {
      test(`Bericht ${name}: nur der Rahmen „${beschriftung}“ um die Tabelle scrollt quer, per Tastatur erreichbar`, async ({ page }) => {
        await starten(page, BREITE_DATEN);
        await bericht(name)(page);
        await expect(page.locator(`${tabelle} tr[data-arg="5"]`)).toHaveCount(1);
        expect(await breiteMessen(page, 'Bericht ' + name)).toEqual([]);
        const rahmen = page.getByRole('group', { name: beschriftung, exact: true });
        await expect(rahmen).toHaveAttribute('tabindex', '0');
        await expect(rahmen.locator(':scope > *')).toHaveCount(1);
        await expect(rahmen.locator(':scope > table')).toHaveAttribute('id', tabelle.slice(1));
        await rahmen.focus();
        await expect(rahmen).toBeFocused();
      });
    }
  });
}

// B0425 (PO Z. 138): Die Personentabelle ist ein Zeitstrahl und scrollt bei Touch nur in ihrem benannten Rahmen quer;
// Leiste, #main und .body nie — ohne und mit breiten Zeitdaten.
for (const breite of [320, 375, 414]) {
  for (const [daten, mehr] of [['Grundbestand', {}], ['breite Zeitdaten', BREITE_DATEN]]) {
    test.describe(`Personen, Touch, ${breite} px, ${daten}`, () => {
      test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
      test('nur der Rahmen „Personen“ um die Tabelle scrollt quer, per Tab erreichbar', async ({ page }) => {
        await starten(page, mehr);
        await page.goto(k.adresse + '#/personen');
        await page.locator('tr[data-person="st"]').waitFor();
        expect(await ueberlauf(page)).toEqual({ Seite: true, '#main': true, '.body': true });
        expect(await breiteMessen(page, 'Personen')).toEqual([]);
        const rahmen = page.getByRole('group', { name: 'Personen', exact: true });
        await expect(rahmen).toHaveAttribute('tabindex', '0');
        await expect(rahmen.locator(':scope > *')).toHaveCount(1);
        await expect(rahmen.locator(':scope > table.pt')).toHaveCount(1);
        await expect(page.locator('.leiste').locator('xpath=ancestor::*[contains(@class,"bericht-rahmen")]')).toHaveCount(0);
        if (breite === 320) expect(await rahmen.evaluate(el => el.scrollWidth > el.clientWidth), 'der Rahmen scrollt bei 320 quer').toBe(true);
        expect(await perTabErreicht(page, rahmen), 'per Tab erreichbar').toBeGreaterThan(0);
      });
    });
  }
}

// B0424 (PO Z. 137 c): Die Aufgabenliste scrollt bei Touch nie quer — der Titel bricht vollständig um, auch ein Wort ohne
// Trennstelle, ohne Ellipse; keine Spalte fällt weg. Bei feinem Zeiger im breiten Fenster bleibt die Titelspalte wie heute.
for (const breite of [320, 375, 414]) {
  test.describe(`Aufgabenliste mit langem Titel, Touch, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });
    test('kein Bereich scrollt quer, der Titel steht ganz in der Zelle ohne Ellipse, alle sechs Spalten bleiben', async ({ page }) => {
      await starten(page, BREITE_DATEN);
      await page.goto(k.adresse + '#/aufgaben');
      await page.locator('tr[data-zeile="5"]').waitFor();
      expect(await breiteMessen(page, 'Aufgabenliste')).toEqual([]);
      expect(await titelZelle(page)).toEqual({ text: LANGER_TITEL, ellipse: false, ganz: true, umbruch: 'normal', spalten: 6 });
    });
  });
}
test.describe('Aufgabenliste mit langem Titel, Maus, 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('die Titelspalte bleibt einzeilig mit Ellipse wie heute', async ({ page }) => {
    await starten(page, BREITE_DATEN);
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="5"]').waitFor();
    expect(await titelZelle(page)).toEqual({ text: LANGER_TITEL, ellipse: true, ganz: false, umbruch: 'nowrap', spalten: 6 });
    const hoehe = nr => page.locator(`tr[data-zeile="${nr}"]`).evaluate(tr => tr.getBoundingClientRect().height);
    expect(await hoehe(5), 'so hoch wie die Zeile mit kurzem Titel').toBe(await hoehe(1));
  });
});

// B0407 (PO Z. 133): In der Stufe compact bricht die Werkzeugzeile der Kopfzeile um, wenn sie nicht passt —
// Filter in voller Breite oben, Bereichsschalter darunter; passt sie, bleibt sie wie heute.

/** Sichtbare Zeilen der Kopfzeile: je .kz-reihe die Kinder, die unter allen vorigen beginnen, eröffnen eine neue Zeile. */
const kopfZeilen = page => page.evaluate(() => [...document.querySelectorAll('header.kz .kz-reihe')].map(reihe => {
  const kisten = [...reihe.children].filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect()).sort((a, b) => a.top - b.top);
  let zeilen = 0, unten = -Infinity;
  for (const k of kisten) { if (k.top >= unten - 1) zeilen++; unten = Math.max(unten, k.bottom); }
  return zeilen;
}).reduce((a, b) => a + b, 0));

/** Mindestbasis des Filters neben dem Bereichsschalter (web/kd-app.css:41, Skizze R00101-kopfzeile.html:37). */
const FILTER_MIN = 80;

/** Misst die Werkzeugzeile: Bereichsschalter, Filter, Lücke und Inhaltsbreite der Reihe (clientWidth ohne Innenabstand). */
const werkzeugzeile = page => page.evaluate(() => {
  const filter = document.querySelector('header.kz #flt');
  const reihe = filter.parentElement;
  const schalter = reihe.querySelector('[role=radiogroup][aria-label=Aufgabenbereich]');
  const stil = getComputedStyle(reihe);
  const kiste = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, breite: r.width, hoehe: r.height, unten: r.bottom }; };
  return {
    inhalt: reihe.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight),
    luecke: parseFloat(stil.columnGap) || 0,
    reihe: kiste(reihe), filter: kiste(filter), schalter: kiste(schalter),
  };
});

/** Bereiche „alle“, „ohne Board“, „archiviert“: je mit Zahl und ganz im Fenster. */
async function bereicheGanzSichtbar(page) {
  const breite = await page.evaluate(() => document.documentElement.clientWidth);
  const bereiche = page.locator('header.kz [role=radio][data-act=list-bereich]');
  await expect(bereiche).toHaveCount(3);
  for (const bereich of await bereiche.all()) {
    await expect(bereich).toHaveText(/^(alle|ohne Board|archiviert)\s*\d+$/);
    const box = await bereich.boundingBox();
    expect(box.x, await bereich.innerText()).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, await bereich.innerText()).toBeLessThanOrEqual(breite);
  }
}

/** 100 Aufgaben ohne Board und 100 archivierte über die API — dreistellige Zahlen im Bereichsschalter. */
async function dreistelligeBereiche(page) {
  const nummern = [];
  for (let n = 1; n <= 200; n++) {
    const antwort = await page.request.post(`${k.adresse}api/aufgaben`, { ...ALS_ST, data: { titel: `Last ${n}` } });
    expect(antwort.ok(), `Aufgabe ${n} angelegt`).toBe(true);
    nummern.push((await antwort.json()).nummer);
  }
  const archiv = await page.request.post(`${k.adresse}api/aufgaben/archivieren`, { ...ALS_ST, data: { nummern: nummern.slice(100) } });
  expect(archiv.ok(), 'hundert Aufgaben archiviert').toBe(true);
}

async function aufgabenlisteZeigen(page) {
  await page.goto(k.adresse + '#/aufgaben');
  await expect.poll(() => zieleImInhalt(page), { message: 'die Ansicht zeigt Ziele' }).toBeGreaterThan(0);
}

// PO Z. 140/141: je Fall genau ein Zweig; Gegen- bzw. Vorbedingung begründet den Fall, statt ihn still umkippen zu lassen.
for (const [zeiger, geraet] of [['touch', { isMobile: true, hasTouch: true }], ['fein', {}]]) {
  test.describe(`Ausweichen bei 320 px, ${zeiger}`, () => {
    test.use({ viewport: { width: 320, height: 700 }, ...geraet });

    test('A einzeilig, Grundbestand: Filter ab 80 px neben dem ganzen Bereichsschalter, kein Überlauf, jedes Ziel im Maß', async ({ page }) => {
      await starten(page);
      await aufgabenlisteZeigen(page);
      const m = await werkzeugzeile(page);
      expect(m.schalter.breite + FILTER_MIN + m.luecke,
        `Gegenbedingung: Bereichsschalter ${m.schalter.breite} + ${FILTER_MIN} + Lücke ${m.luecke} passt in die Reihe ${m.inhalt} — sonst ist der Grundbestand ein Umbruchfall geworden`).toBeLessThanOrEqual(m.inhalt);
      expect(await breiteMessen(page, 'Aufgabenliste')).toEqual([]);
      await bereicheGanzSichtbar(page);
      expect(Math.abs(m.schalter.y + m.schalter.hoehe / 2 - (m.filter.y + m.filter.hoehe / 2)), 'Filter und Bereichsschalter auf derselben Zeile').toBeLessThan(1);
      expect(m.filter.breite, 'Filter mindestens 80 px').toBeGreaterThanOrEqual(FILTER_MIN);
      expect(await kopfZeilen(page), 'zwei Zeilen — jede Reihe einzeilig').toBe(2);
      expect(await zieleMessen(page, { zeiger, ansicht: 'Aufgabenliste' })).toEqual([]);
    });

    test('B Umbruch, 100 ohne Board und 100 archiviert: Filter in voller Breite, Bereichsschalter ganz darunter, kein Überlauf', async ({ page }) => {
      await starten(page);
      await dreistelligeBereiche(page);
      await aufgabenlisteZeigen(page);
      const m = await werkzeugzeile(page);
      expect(m.schalter.breite + FILTER_MIN + m.luecke,
        `Vorbedingung: Bereichsschalter ${m.schalter.breite} + ${FILTER_MIN} + Lücke ${m.luecke} passt nicht in die Reihe ${m.inhalt} — sonst ist das kein Umbruchfall`).toBeGreaterThan(m.inhalt);
      expect(await breiteMessen(page, 'Aufgabenliste')).toEqual([]);
      await bereicheGanzSichtbar(page);
      expect(m.filter.breite, 'Filter in voller Breite').toBeGreaterThanOrEqual(m.reihe.breite - 2 * 16);
      expect(m.schalter.y, 'Bereichsschalter unter dem Filter').toBeGreaterThanOrEqual(m.filter.unten);
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
