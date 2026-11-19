// R00199 Personenseite: Tagesleiste 0–24 Uhr und im Datum blättern (Karte #204) — Akzeptanzproben an der Ausgangslage
// der Anforderung, Uhr des Browsers Do 19.11.2026 14:00 (Europe/Berlin). Oben die Testfälle in Fachwörtern, darunter die
// Testsprache (`personenseite`), ganz unten der Treiber: nur er kennt Selektoren.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');

const zeiten = zeilen => `\`\`\`kanbanD-time\n${zeilen.join('\n')}\n\`\`\`\n`;
const AUSGANGSLAGE = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #2\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nassignees: [st]\n---\n${zeiten(['2026-11-17 09:00+01:00 · 2026-11-17 10:30+01:00 · st', '2026-11-19 13:30+01:00 · ... · st'])}`,
  'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: zwei\nassignees: [mi, cl]\n---\n${zeiten(['2026-11-16 23:00+01:00 · 2026-11-17 02:00+01:00 · cl', '2026-11-18 21:00+01:00 · ... · cl'])}`,
  'aufgaben/0003-drei.md': `---\nid: 3\ntitle: drei\nassignees: [mi]\narchived: 2026-11-18\n---\n${zeiten(['2026-11-16 08:00+01:00 · 2026-11-16 08:30+01:00 · mi'])}`,
};
const HEUTE_14_UHR = new Date(2026, 10, 19, 14, 0);

let k;
test.beforeEach(async ({ page }) => {
  k = await kanbanStarten(einrichten(AUSGANGSLAGE));
  await alsPerson(page, 'st');
});
test.afterEach(() => k.stoppen());

/* ── Testfälle ── */

test('AK 1 / US-1: heute reicht die Leiste von 0 bis 24 Uhr, Claudes Lauf schraffiert bis zur Jetzt-Marke', async ({ page }) => {
  const seite = await personenseite(page);
  expect(await seite.marken()).toEqual([[0, 0], [3, 12.5], [6, 25], [9, 37.5], [12, 50], [15, 62.5], [18, 75], [21, 87.5], [24, 100]]);
  expect(await seite.jetztMarke()).toBeCloseTo(58.33, 1);
  expect(await seite.abschnitte('cl')).toEqual([{ von: 0, bis: 58.33, schraffiert: true, titel: '#2' }]);
  await expect(seite.hinweis()).toHaveText('Tagesleiste 0–24 Uhr · schraffiert = läuft');
  expect(await seite.leistenbreite()).toBe(380);
});

test('AK 2: Lage der Abschnitte an Di 17.11., Mi 18.11. und Mo 16.11. — schraffiert ist nur, was jetzt läuft', async ({ page }) => {
  const seite = await personenseite(page);
  await seite.zurueck(2);
  expect(await seite.abschnitte('st')).toEqual([{ von: 37.5, bis: 43.75, schraffiert: false, titel: '#1' }]);
  expect(await seite.abschnitte('cl')).toEqual([{ von: 0, bis: 8.33, schraffiert: false, titel: '#2' }]);
  await seite.vor(1);
  expect(await seite.abschnitte('cl')).toEqual([{ von: 87.5, bis: 100, schraffiert: true, titel: '#2' }]);
  await seite.zurueck(2);
  expect(await seite.abschnitte('cl')).toEqual([{ von: 95.83, bis: 100, schraffiert: false, titel: '#2' }]);
});

test('AK 3 / AK 4 / US-2: zurück- und vorblättern, Summen des Tages und seiner Woche', async ({ page }) => {
  const seite = await personenseite(page);
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
  expect(await seite.summen()).toEqual({ st: ['0:30', '2:00'], cl: ['14:00', '20:00'], mi: ['0:00', '0:30'] });
  await seite.zurueck(1);
  await expect(seite.datum()).toHaveText('Mi 18.11.2026');
  expect(await seite.summen()).toEqual({ st: ['0:00', '2:00'], cl: ['3:00', '20:00'], mi: ['0:00', '0:30'] });
  await seite.zurueck(1);
  await expect(seite.datum()).toHaveText('Di 17.11.2026');
  await expect(seite.tagesspalte()).toHaveText('Di 17.11.');
  expect(await seite.wochenspalte()).toEqual({ text: 'Woche', titel: 'Woche 16.11.–22.11.', name: 'Woche 16.11.–22.11.' });
  expect(await seite.summen()).toEqual({ st: ['1:30', '2:00'], cl: ['2:00', '20:00'], mi: ['0:00', '0:30'] });
  await seite.vor(1);
  await expect(seite.datum()).toHaveText('Mi 18.11.2026');
  await seite.zurueck(2);
  await expect(seite.datum()).toHaveText('Mo 16.11.2026');
  expect(await seite.summen()).toEqual({ st: ['0:00', '2:00'], cl: ['1:00', '20:00'], mi: ['0:30', '0:30'] });
  await seite.zurueck(1);
  await expect(seite.datum()).toHaveText('So 15.11.2026');
  expect(await seite.summen()).toEqual({ st: ['0:00', '0:00'], cl: ['0:00', '0:00'], mi: ['0:00', '0:00'] });
  expect(await seite.wochenspalte()).toEqual({ text: 'Woche', titel: 'Woche 09.11.–15.11.', name: 'Woche 09.11.–15.11.' });
});

test('AK 5 / US-3: ein vergangener Tag ist Rückschau — zwei Gruppen, kein Stopp, kein Laufchip, keine Jetzt-Marke', async ({ page }) => {
  const seite = await personenseite(page);
  await seite.zurueck(2);
  expect(await seite.gruppen()).toEqual({ 'AKTIV AM Di 17.11. · 2 Personen': ['st', 'cl'], 'RUHIG AM Di 17.11. · 1 Person': ['mi'] });
  await expect(seite.stoppKnoepfe()).toHaveCount(0);
  await expect(seite.laufchips()).toHaveCount(0);
  await expect(seite.jetztMarken()).toHaveCount(0);
  expect(await seite.schraffierteAbschnitte()).toBe(0);
  expect(await seite.gerade()).toEqual({ st: 'zuletzt 10:30', cl: 'zuletzt 02:00', mi: '—' });
  await seite.vor(1);
  expect((await seite.gruppen())['AKTIV AM Mi 18.11. · 1 Person']).toEqual(['cl']);
  expect((await seite.gerade()).cl).toBe('—');
  expect(await seite.schraffierteAbschnitte()).toBe(1);
});

test('AK 6 / US-4: nicht über heute hinaus, „Heute“ führt zurück', async ({ page }) => {
  const seite = await personenseite(page);
  await expect(seite.naechsterTag()).toBeDisabled();
  await expect(seite.heuteKnopf()).toBeDisabled();
  await seite.zurueck(2);
  await expect(seite.naechsterTag()).toBeEnabled();
  await seite.vor(2);
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
  await expect(seite.naechsterTag()).toBeDisabled();
  await expect(seite.tagesspalte()).toHaveText('heute');
  expect(Object.keys(await seite.gruppen())[0]).toBe('LÄUFT JETZT · 2 Timer');
  await seite.zurueck(4);
  await expect(seite.datum()).toHaveText('So 15.11.2026');
  await seite.heuteKnopf().click();
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
  await expect(seite.heuteKnopf()).toBeDisabled();
  await expect(seite.stoppKnopf('Stefan')).toBeVisible();
});

test('AK 6a / US-8 mit der Tastatur: der Fokus bleibt am Knopf, wird er deaktiviert, geht er auf „‹“', async ({ page }) => {
  const seite = await personenseite(page);
  await seite.zurueck(2);
  await seite.vorigerTag().focus();
  await page.keyboard.press('Tab');
  await expect(seite.naechsterTag()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(seite.datum()).toHaveText('Mi 18.11.2026');
  await expect(seite.naechsterTag()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
  await expect(seite.naechsterTag()).toBeDisabled();
  await expect(seite.vorigerTag()).toBeFocused();
  await seite.zurueck(4);
  await seite.heuteKnopf().focus();
  await page.keyboard.press('Enter');
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
  await expect(seite.vorigerTag()).toBeFocused();
  await seite.zurueck(1);
  await page.keyboard.press('Enter');
  await expect(seite.datum()).toHaveText('Di 17.11.2026');
  await expect(seite.vorigerTag()).toBeFocused();
});

test('AK 6b / US-8: das Datum steht in einem beständigen Knoten mit aria-live="polite"', async ({ page }) => {
  const seite = await personenseite(page);
  await seite.zurueck(2);
  await expect(seite.datum()).toHaveText('Di 17.11.2026');
  await expect(seite.datum()).toHaveAttribute('aria-live', 'polite');
  await seite.datumsknotenMerken();
  await seite.zurueck(1);
  await expect(seite.datum()).toHaveText('Mo 16.11.2026');
  await expect(seite.datum()).toHaveAttribute('aria-live', 'polite');
  expect(await seite.datumsknotenIstDerGemerkte()).toBe(true);
});

test('AK 7 / US-5: der Tag gehört zum Tab, nicht zur Adresse', async ({ page }) => {
  const seite = await personenseite(page);
  const adresseHeute = page.url();
  await seite.zurueck(2);
  expect(page.url()).toBe(adresseHeute);
  await seite.wechsleInsBoardUndZurueck();
  await expect(seite.datum()).toHaveText('Di 17.11.2026');
  expect(page.url()).toBe(adresseHeute);
  await seite.neuLaden();
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
});

test('AK 8: „zugewiesen offen“ zeigt an jedem Tag den heutigen Stand, die archivierte #3 zählt als Zeit', async ({ page }) => {
  const seite = await personenseite(page);
  const heute = await seite.zugewiesenOffen();
  expect(heute).toEqual({ st: '1 · 1 begonnen', mi: '1 · 0 begonnen', cl: '1 · 0 begonnen' });
  await seite.zurueck(3);
  await expect(seite.datum()).toHaveText('Mo 16.11.2026');
  expect(await seite.zugewiesenOffen()).toEqual(heute);
  expect((await seite.summen()).mi).toEqual(['0:30', '0:30']);
});

test('AK 10: heute wie bisher; an einem vergangenen Tag wirken Umschalter und Personen-Klick wie bisher, nichts wird geschrieben', async ({ page }) => {
  const seite = await personenseite(page);
  const commits = k.git('rev-list', '--count', 'HEAD');
  expect(await seite.gruppen()).toEqual({ 'LÄUFT JETZT · 2 Timer': ['st', 'cl'], 'HEUTE RUHIG · 1 Person': ['mi'] });
  expect((await seite.gerade()).mi).toBe('zuletzt 16.11.2026');
  await expect(seite.vergessenerLaufchip('cl')).toHaveText('seit 17 Stunden');
  await seite.zurueck(2);
  await seite.nurAgenten();
  expect(await seite.gezeigtePersonen()).toEqual(['cl']);
  await seite.alle();
  expect(k.git('rev-list', '--count', 'HEAD'), 'Blättern und Umschalten schreiben nichts').toBe(commits);
  await seite.personAnklicken('mi');
  await expect(page.getByLabel('Filter')).toHaveValue('@mi');
  await seite.oeffnen();
  await expect(seite.datum(), 'der Tag bleibt im Tab').toHaveText('Di 17.11.2026');
  await seite.heuteKnopf().click();
  await seite.stoppKnopf('Stefan').click();
  await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toContain('...');
});

test('AK 12 / US-6: nach Mitternacht steht ohne Neuladen der neue Tag', async ({ page }) => {
  const seite = await personenseite(page, new Date(2026, 10, 19, 23, 59, 30));
  await expect(seite.datum()).toHaveText('Do 19.11.2026');
  await seite.uhrVor(60000);
  await expect(seite.datum()).toHaveText('Fr 20.11.2026');
  await expect(seite.tagesspalte()).toHaveText('heute');
  await expect(seite.naechsterTag()).toBeDisabled();
});

test('AK 12 / US-6: ein fester Tag bleibt über Mitternacht stehen', async ({ page }) => {
  const seite = await personenseite(page, new Date(2026, 10, 19, 23, 59, 30));
  await seite.zurueck(2);
  await seite.uhrVor(60000);
  await expect(seite.datum()).toHaveText('Di 17.11.2026');
  await expect(seite.tagesspalte()).toHaveText('Di 17.11.');
});

test('AK 12 / US-7: eine nachgetragene Zeit erscheint ohne Neuladen am vergangenen Tag', async ({ page }) => {
  const seite = await personenseite(page);
  await seite.zurueck(2);
  expect((await seite.gruppen())['RUHIG AM Di 17.11. · 1 Person']).toEqual(['mi']);
  await seite.zeitNachtragen(2, 'mi', '2026-11-17 15:00+01:00', '2026-11-17 16:00+01:00');
  await expect(seite.zeile('mi')).toContainText('zuletzt 16:00');
  expect((await seite.gruppen())['AKTIV AM Di 17.11. · 3 Personen']).toEqual(['st', 'mi', 'cl']);
  expect((await seite.summen()).mi).toEqual(['1:00', '1:30']);
});

test.describe('mit Touch', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 414, height: 800 } });

  test('AK 6a per Tipp: „Heute“ und „›“ bis heute lassen den Fokus auf „‹“, „‹“ behält ihn', async ({ page }) => {
    const seite = await personenseite(page);
    await seite.zurueck(4);
    await seite.heuteKnopf().tap();
    await expect(seite.datum()).toHaveText('Do 19.11.2026');
    await expect(seite.vorigerTag()).toBeFocused();
    await seite.vorigerTag().tap();
    await expect(seite.datum()).toHaveText('Mi 18.11.2026');
    await expect(seite.vorigerTag()).toBeFocused();
    await seite.naechsterTag().tap();
    await expect(seite.datum()).toHaveText('Do 19.11.2026');
    await expect(seite.vorigerTag()).toBeFocused();
  });

  for (const breite of [320, 375, 414]) {
    test.describe(`${breite} px`, () => {
      test.use({ viewport: { width: breite, height: 800 } });
      test(`AK 13 bei ${breite} px: „‹ Datum › Heute“ steht vorn, in einer Zeile, ungekürzt, ohne Querscrollen, Tab-Reihenfolge ‹ › Heute`, async ({ page }) => {
        const seite = await personenseite(page);
        await seite.zurueck(2);
        await expect(seite.datum()).toHaveText('Di 17.11.2026');
        const mass = await seite.kopfleisteMessen();
        expect(mass.gruppeIstErstesKind, 'die Gruppe ist das erste Kind der .leiste').toBe(true);
        expect(new Set(mass.oberkanten).size, `eine Zeile: ${mass.oberkanten}`).toBe(1);
        expect(mass.datumVollstaendig, 'das Datum ist nicht gekürzt').toBe(true);
        expect(mass.datumInTextfarbe, 'das Datum steht in --kd-text').toBe(true);
        expect(mass.leisteScrolltNichtQuer, 'die .leiste scrollt nicht quer').toBe(true);
        expect(mass.domReihenfolge).toEqual(['voriger Tag', 'nächster Tag', 'Heute']);
        await seite.vorigerTag().focus();
        await page.keyboard.press('Tab');
        await expect(seite.naechsterTag()).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(seite.heuteKnopf()).toBeFocused();
      });
    });
  }
});

/* ── Testsprache ── */

/** Die Seite „Personen“ an der Ausgangslage, Uhr des Browsers angehalten auf `uhr`. */
async function personenseite(page, uhr = HEUTE_14_UHR) {
  await page.clock.install({ time: uhr });
  await page.clock.pauseAt(uhr);
  const t = treiber(page);
  await t.oeffnen();
  return {
    ...t,
    async zurueck(n) { for (let i = 0; i < n; i++) await t.blaettern(t.vorigerTag()); },
    async vor(n) { for (let i = 0; i < n; i++) await t.blaettern(t.naechsterTag()); },
    async summen() { return Object.fromEntries(await Promise.all(['st', 'cl', 'mi'].map(async kz => [kz, await t.tagUndWoche(kz)]))); },
    async gerade() { return Object.fromEntries(await Promise.all(['st', 'cl', 'mi'].map(async kz => [kz, await t.geradeText(kz)]))); },
    async zugewiesenOffen() { return Object.fromEntries(await Promise.all(['st', 'mi', 'cl'].map(async kz => [kz, await t.offenText(kz)]))); },
    async zeitNachtragen(nr, wer, beginn, ende) {
      const antwort = await page.request.post(`${k.adresse}api/aufgaben/${nr}/zeiten`, { headers: { 'X-KanbanD-Wer': 'st' }, data: { wer, beginn, ende } });
      expect(antwort.ok(), await antwort.text()).toBe(true);
    },
    /** Stellt die Uhr vor und hält die Live-Verbindung frisch (der Wächter gäbe mit gestellter Uhr sonst nach 40 s auf). */
    async uhrVor(ms) {
      for (let rest = ms; rest > 0; rest -= 10000) {
        await page.clock.runFor(Math.min(10000, rest));
        await page.evaluate(() => window.kdTest.herzschlag());
      }
    },
  };
}

/* ── Treiber: kennt als einziger Selektoren und Adressen ── */

function treiber(page) {
  const zeile = kz => page.locator(`tr[data-person="${kz}"]`);
  const prozent = stil => Math.round(parseFloat(stil) * 100) / 100;
  const t = {
    zeile,
    async oeffnen() { await page.goto(k.adresse + '#/personen'); await bereit(page, '#personen-tag'); },
    async neuLaden() { await page.reload(); await bereit(page, '#personen-tag'); },
    datum: () => page.locator('#personen-tag'),
    vorigerTag: () => page.getByRole('button', { name: 'voriger Tag' }),
    naechsterTag: () => page.getByRole('button', { name: 'nächster Tag' }),
    heuteKnopf: () => page.getByRole('button', { name: 'Heute', exact: true }),
    hinweis: () => page.locator('#main .leiste .rechts'),
    tagesspalte: () => page.locator('.pt thead th').nth(3),
    stoppKnoepfe: () => page.locator('#main .pt button.stop'),
    stoppKnopf: name => page.getByRole('button', { name: `Timer von ${name} stoppen` }),
    laufchips: () => page.locator('#main .pt .lauf'),
    vergessenerLaufchip: kz => zeile(kz).locator('.akt .lauf.vergessen'),
    jetztMarken: () => page.locator('#main .tagl .jetzt'),
    async blaettern(knopf) {
      const vorher = await t.datum().textContent();
      await knopf.click();
      await expect(t.datum()).not.toHaveText(vorher);
    },
    async wochenspalte() {
      const th = page.locator('.pt thead th').nth(4);
      return { text: (await th.innerText()).trim(), titel: await th.getAttribute('title'), name: await th.getAttribute('aria-label') };
    },
    async marken() {
      return page.locator('.pt thead .skala span').evaluateAll(l => l.map(s => [+s.textContent, Math.round(parseFloat(s.style.left) * 100) / 100]));
    },
    async jetztMarke() { return prozent(await page.locator('#main .tagl .jetzt').first().evaluate(e => e.style.left)); },
    async abschnitte(kz) {
      const roh = await zeile(kz).locator('.tagl i').evaluateAll(l => l.map(i => ({ left: i.style.left, width: i.style.width, l: i.classList.contains('l'), titel: i.title })));
      return roh.map(r => ({ von: prozent(r.left), bis: prozent(parseFloat(r.left) + parseFloat(r.width)), schraffiert: r.l, titel: r.titel }));
    },
    async schraffierteAbschnitte() { return page.locator('#main .tagl i.l').count(); },
    async leistenbreite() { return page.locator('#main .tagl').first().evaluate(e => e.getBoundingClientRect().width); },
    async tagUndWoche(kz) { return [(await zeile(kz).locator('td').nth(3).innerText()).trim(), (await zeile(kz).locator('td').nth(4).innerText()).trim()]; },
    async geradeText(kz) { return (await zeile(kz).locator('td').nth(1).innerText()).trim(); },
    async offenText(kz) { return (await zeile(kz).locator('td').nth(5).innerText()).replace(/\s+/g, ' ').trim(); },
    async gruppen() {
      return page.locator('#main .pt tbody tr').evaluateAll(zeilen => {
        const gruppen = {};
        let aktuelle = null;
        for (const z of zeilen) {
          if (z.classList.contains('grp')) { aktuelle = z.textContent.replace(/\s+/g, ' ').trim(); gruppen[aktuelle] = []; } else gruppen[aktuelle].push(z.dataset.person);
        }
        return gruppen;
      });
    },
    async gezeigtePersonen() { return page.locator('#main tr[data-person]').evaluateAll(l => l.map(z => z.dataset.person)); },
    async nurAgenten() { await page.getByRole('radio', { name: 'nur Agenten' }).click(); await expect(page.locator('#main tr[data-person]')).toHaveCount(1); },
    async alle() { await page.getByRole('radio', { name: 'Menschen + Agenten' }).click(); await expect(page.locator('#main tr[data-person]')).toHaveCount(3); },
    async personAnklicken(kz) { await zeile(kz).locator('.wer').click(); },
    async wechsleInsBoardUndZurueck() {
      await page.evaluate(() => { location.hash = '#/board/entwicklung'; });
      await bereit(page, '.bahn');
      await page.evaluate(() => { location.hash = '#/personen'; });
      await bereit(page, '#personen-tag');
    },
    async datumsknotenMerken() { await page.evaluate(() => { window.gemerkterDatumsknoten = document.getElementById('personen-tag'); }); },
    async datumsknotenIstDerGemerkte() { return page.evaluate(() => window.gemerkterDatumsknoten === document.getElementById('personen-tag') && window.gemerkterDatumsknoten.isConnected); },
    async kopfleisteMessen() {
      return page.evaluate(() => {
        const leiste = document.querySelector('#main .leiste'), datum = document.getElementById('personen-tag');
        const gruppe = datum.parentElement, teile = [...gruppe.children];
        const probe = document.createElement('span');
        probe.style.color = 'var(--kd-text)';
        document.body.append(probe);
        const textfarbe = getComputedStyle(probe).color;
        probe.remove();
        return {
          gruppeIstErstesKind: leiste.firstElementChild === gruppe,
          oberkanten: teile.map(e => Math.round(e.getBoundingClientRect().top)),
          datumVollstaendig: datum.textContent === 'Di 17.11.2026' && datum.scrollWidth <= datum.clientWidth,
          datumInTextfarbe: getComputedStyle(datum).color === textfarbe,
          leisteScrolltNichtQuer: leiste.scrollWidth <= leiste.clientWidth,
          domReihenfolge: [...gruppe.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent.trim()),
        };
      });
    },
  };
  return t;
}
