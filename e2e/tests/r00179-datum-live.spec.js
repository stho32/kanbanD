// E2E R00179 (I0169): ein Datum zu Ende tippen, während die Seite neu zeichnet — wegen einer fremden Änderung (Commit im
// Ordner, sein Live-Ereignis ist in der Seite angekommen) oder wegen des Nachladens nach dem eigenen Speichern.
// Getippt wird mit `keyboard.type`, nie mit `fill()`; die Abstände der Tasten sind Eingabe, keine Wartezeit. Gewartet wird
// auf Zustand (ADR-0026): auf das angekommene Ereignis über den geladenen Stand (`fremdeAenderung`) — nie auf den
// Renderzähler, denn solange getippt wird, zeichnet die Seite nicht —, geurteilt an Feld, Datei und Verlauf.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen } = require('./hilfen');

// Die Uhr der Seite steht nach dem getippten 31.12.2026, die fremde Änderung trägt diesen Tag: so liegt sie in jedem
// Zeitraum, den die Tests tippen („von“ wie „bis“), und der Durchsatz kann sie zählen (ADR-0026 Regel 6).
const HEUTE = '2027-01-10T12:00:00+01:00';
const FREMD_AM = '2026-12-31T10:00:00+01:00';
const BOARD = 'boards/entwicklung.md';
const EINS = 'aufgaben/0001-eins.md';
const ZWEI = 'aufgaben/0002-zwei.md';
const SPALTEN = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n';
const GESPEICHERT = '2026-11-12';
const ABSTAENDE_MS = [120, 900];
/** Rote Spezifikation (B0877): am Stand vor B0878 gemessen rot — die Marke fällt mit dem Fix. */
const erwartetRot = () => test.fail(true, 'erwartet rot bis B0878 (R00179): das Zeichnen ersetzt das Datumsfeld mitten in der Eingabe');

/* ── Treiber: je Feld, wo es steht, wie es geöffnet wird, welche Zeile welcher Datei es speichert, was die fremde
      Änderung ist und woran die Seite sie zeigt ── */
const aufgabenkopf = (nummer, titel, mehr = '') => `---\nid: ${nummer}\ntitle: ${titel}\n${mehr}---\n`;
/** Der Agent benennt #1 um und zieht sie in die Abschlussspalte. */
const EINS_ERLEDIGT = {
  nummer: 1, titel: 'eins umbenannt',
  dateien: k => ({ [EINS]: aufgabenkopf(1, 'eins umbenannt'), [BOARD]: k.lies(BOARD).replace('- #1\n', '').replace(/## Erledigt\n$/, '## Erledigt\n\n- #1\n') }),
};
const umbenannt = (nummer, datei, mehr = '') => ({ nummer, titel: 'umbenannt', dateien: () => ({ [datei]: aufgabenkopf(nummer, 'umbenannt', mehr) }) });
const imBericht = (ansicht, name, schluessel, kopf) => ({
  adresse: '#/berichte/' + ansicht,
  oeffnen: page => filterOeffnen(page),
  feld: page => page.getByRole('group', { name: 'Berichtsfilter' }).getByLabel(name, { exact: true }),
  datei: BOARD, schluessel, fremd: EINS_ERLEDIGT,
  dateien: { [BOARD]: `---\n${kopf}\n---\n` + SPALTEN },
});
const durchsatzZaehltEins = page => expect(page.locator('#dus-kennzahl')).toContainText('Abgang 1');
const imFenster = fremd => ({
  adresse: '',
  oeffnen: async page => { await bereit(page, '.ka[data-id="1"]'); await page.locator('.ka[data-id="1"]').click(); },
  feld: page => page.getByRole('dialog').getByLabel('Fälligkeit', { exact: true }),
  datei: EINS, schluessel: 'due', fremd,
  dateien: { [EINS]: aufgabenkopf(1, 'eins', `due: ${GESPEICHERT}\n`) },
  fremdSichtbar: page => expect(page.locator(`.ka[data-id="${fremd.nummer}"]`)).toContainText('umbenannt'),
});
const VON = { ...imBericht('durchsatz', 'Zeitraum von', 'from', `report-filter: {period: eigen, from: ${GESPEICHERT}}`), fremdSichtbar: durchsatzZaehltEins };
const FELDER = {
  'Durchsatz · Zeitraum von': VON,
  'Burndown · Zeitraum von': imBericht('verlauf', 'Zeitraum von', 'from', `report-filter: {period: eigen, from: ${GESPEICHERT}}`),
  'Durchsatz · Zeitraum bis': { ...imBericht('durchsatz', 'Zeitraum bis', 'to', `report-filter: {period: eigen, from: ${GESPEICHERT}, to: ${GESPEICHERT}}`), fremdSichtbar: durchsatzZaehltEins },
  'Fever Chart · Rechnen ab': imBericht('fieber', 'Rechnen ab', 'start', `report-filter: {period: eigen, from: ${GESPEICHERT}}\nstart: ${GESPEICHERT}`),
  'Aufgabenfenster · Fälligkeit, fremde Änderung an einer anderen Aufgabe': imFenster(umbenannt(2, ZWEI)),
  'Aufgabenfenster · Fälligkeit, fremde Änderung an der geöffneten Aufgabe': imFenster(umbenannt(1, EINS, `due: ${GESPEICHERT}\n`)),
};

/** Ein `git`, dessen Commit `sekunden` länger dauert: die Datei steht schon, der Commit noch nicht (Messung aus #188). */
function gebremstesGit(sekunden) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-git-'));
  const echt = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
  fs.writeFileSync(path.join(ordner, 'git'), `#!/bin/sh\nfor a in "$@"; do [ "$a" = commit ] && sleep ${sekunden}; done\nexec ${echt} "$@"\n`, { mode: 0o755 });
  return { ordner, umgebung: { PATH: ordner + path.delimiter + process.env.PATH } };
}

test.describe('R00179 I0169: Datum zu Ende tippen, während die Seite neu zeichnet', () => {
  let k, bremse;
  test.afterEach(async () => {
    await k.stoppen();
    if (bremse) fs.rmSync(bremse.ordner, { recursive: true, force: true });
    bremse = null;
  });

  /* ── Testsprache ── */
  /** Startet kanbanD mit dem Grundbestand des Felds (es trägt den 12.11.2026) und öffnet die Stelle des Felds. */
  async function feldOeffnen(page, ort, { commitBremse = 0, dateien = ort.dateien } = {}) {
    if (commitBremse) bremse = gebremstesGit(commitBremse);
    k = await kanbanStarten(einrichten({ [BOARD]: SPALTEN, [EINS]: aufgabenkopf(1, 'eins'), [ZWEI]: aufgabenkopf(2, 'zwei'), ...dateien }), bremse ? bremse.umgebung : {});
    await page.clock.setFixedTime(new Date(HEUTE));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + ort.adresse);
    await ort.oeffnen(page);
    await expect(ort.feld(page)).toBeVisible();
    return ort.feld(page);
  }
  /** Ein Commit im Ordner, der nicht aus dieser Seite kommt; fertig, wenn sein Live-Ereignis in der Seite angekommen ist:
   *  der geladene Stand trägt die Änderung, und die Seite hat ihn zum Zeichnen übergeben. Liefert den Commit. */
  async function fremdeAenderung(page, fremd) {
    for (const [rel, inhalt] of Object.entries(fremd.dateien(k))) k.schreib(rel, inhalt);
    k.git('add', '-A');
    execFileSync('git', ['-C', k.ordner, '-c', 'user.name=Agent', '-c', 'user.email=a@a', 'commit', '-q', '-m', 'fremd'], { env: { ...process.env, GIT_AUTHOR_DATE: FREMD_AM, GIT_COMMITTER_DATE: FREMD_AM } });
    await page.waitForFunction(([nummer, titel]) => window.kdTest.titel(nummer) === titel && window.kdTest.gezeichnet(), [fremd.nummer, fremd.titel]);
    return k.git('rev-parse', 'HEAD');
  }
  async function tippen(page, feld, ziffern, abstand = 120) {
    await feld.focus();
    await page.keyboard.type(ziffern, { delay: abstand });
  }
  const weitertippen = (page, ziffern, abstand = 120) => page.keyboard.type(ziffern, { delay: abstand });
  /** Zahl der Commits, die die Zeile des Felds geändert haben. */
  const speicherungen = ort => k.git('log', '--format=%h', '-G', `\\b${ort.schluessel}:`, '--', ort.datei).split('\n').filter(Boolean).length;
  const gespeichert = (ort, tag) => new RegExp(`\\b${ort.schluessel}: ${tag}\\b`);
  /** Die Speicherung steht im Verlauf: der Server schreibt erst die Datei und committet danach (#188). */
  const imVerlauf = (ort, vorher, anzahl = 1) => expect.poll(() => speicherungen(ort) - vorher).toBeGreaterThanOrEqual(anzahl);
  /** Das Nachladen nach dem Speichern ist gezeichnet. */
  async function ruhig(page) {
    await bereit(page);
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
  }
  /** Geht mit Tab weiter, bis `ziel` den Fokus trägt: ein Datumsfeld hat mehrere Halte (Tag, Monat, Jahr, Kalenderknopf). */
  async function mitTabWeiterBis(page, ziel) {
    for (let halt = 0; halt < 5; halt++) {
      await page.keyboard.press('Tab');
      if (await ziel.evaluate(feld => document.activeElement === feld)) return;
    }
    await expect(ziel).toBeFocused();
  }

  /* ── AK 1, AK 2, US-1: die Abnahme-Probe der Karte #189, je Feld ohne Knopf ── */
  for (const [name, ort] of Object.entries(FELDER)) {
    for (const abstand of ABSTAENDE_MS) {
      test(`AK 1, AK 2, US-1: „3112“ getippt, fremde Änderung trifft ein, dann „2026“ (Abstand ${abstand} ms) in ${name} → Feld 31.12.2026 mit Fokus, Datei „${ort.schluessel}: 2026-12-31“, genau ein Speichern`, async ({ page }) => {
        erwartetRot();
        const feld = await feldOeffnen(page, ort);
        await expect(feld).toHaveValue(GESPEICHERT);
        const vorher = speicherungen(ort);

        await tippen(page, feld, '3112', abstand);
        await fremdeAenderung(page, ort.fremd);
        await weitertippen(page, '2026', abstand);

        await expect.poll(() => k.lies(ort.datei)).toMatch(gespeichert(ort, '2026-12-31'));
        await imVerlauf(ort, vorher);
        await expect(feld).toHaveValue('2026-12-31');
        await expect(feld).toBeFocused();
        // die fremde Änderung ist nicht überschrieben, und die Seite zeigt sie, sobald die Eingabe gespeichert ist
        expect(k.lies(ort.fremd.nummer === 1 ? EINS : ZWEI)).toContain(`title: ${ort.fremd.titel}\n`);
        if (ort.fremdSichtbar) await ort.fremdSichtbar(page);
        await ruhig(page);
        expect(speicherungen(ort) - vorher).toBe(1);
      });
    }
  }

  for (const name of ['Durchsatz · Zeitraum von', 'Burndown · Zeitraum von']) {
    test(`AK 1 (Gegenprobe): „3112“ und „2026“ ohne fremde Änderung in ${name} → Datei „from: 2026-12-31“`, async ({ page }) => {
      const ort = FELDER[name];
      const feld = await feldOeffnen(page, ort);
      const vorher = speicherungen(ort);

      await tippen(page, feld, '3112');
      await weitertippen(page, '2026');

      await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(ort, '2026-12-31'));
      await imVerlauf(ort, vorher);
      await expect(feld).toHaveValue('2026-12-31');
      await expect(feld).toBeFocused();
    });
  }

  /* ── AK 3, US-2: das Nachladen nach dem eigenen Speichern trifft die Eingabe im nächsten Feld ── */
  const filterzeile = { datei: BOARD, schluessel: 'report-filter' };
  for (const commitBremse of [0, 0.4]) {
    test(`AK 3, US-2: „01112026“ in „Zeitraum von“, mit Tab weiter, ohne Warten „30112026“ in „Zeitraum bis“ (Commit um ${commitBremse} s gebremst) → „from: 2026-11-01“ und „to: 2026-11-30“, genau zwei Speicherungen`, async ({ page }) => {
      if (commitBremse) erwartetRot();
      const von = await feldOeffnen(page, VON, { commitBremse });
      const bis = FELDER['Durchsatz · Zeitraum bis'].feld(page);
      const vorher = speicherungen(filterzeile);

      await tippen(page, von, '01112026');
      await mitTabWeiterBis(page, bis);
      await weitertippen(page, '30112026');

      await expect.poll(() => k.lies(BOARD)).toMatch(/\bfrom: 2026-11-01, to: 2026-11-30\b/);
      await imVerlauf(filterzeile, vorher, 2);
      await ruhig(page);
      await expect(von).toHaveValue('2026-11-01');
      await expect(bis).toHaveValue('2026-11-30');
      expect(speicherungen(filterzeile) - vorher).toBe(2);
    });
  }

  test('AK 3: „12112026“ in „Rechnen ab“ im Fever Chart bei um 0,4 s gebremstem Commit → „start: 2026-11-12“, genau ein Speichern', async ({ page }) => {
    const ort = FELDER['Fever Chart · Rechnen ab'];
    const feld = await feldOeffnen(page, ort, { commitBremse: 0.4, dateien: {} });
    await expect(feld).toHaveValue('');
    const vorher = speicherungen(ort);

    await tippen(page, feld, '12112026');

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(ort, '2026-11-12'));
    await imVerlauf(ort, vorher);
    await ruhig(page);
    await expect(feld).toHaveValue('2026-11-12');
    expect(speicherungen(ort) - vorher).toBe(1);
  });

  /* ── AK 4, US-3: die Regel aus R00173 gilt weiter — kein Zwischenstand, unfertig verlassen verwirft ── */
  test('AK 4: „0503“ getippt (Zwischenstand 05.03.2026), fremde Änderung trifft ein, dann „2027“ → „from: 2027-03-05“, genau ein Commit des Speicherns, kein Zwischenstand im Verlauf', async ({ page }) => {
    erwartetRot();
    const feld = await feldOeffnen(page, VON);
    const vorher = speicherungen(VON);

    await tippen(page, feld, '0503');
    await expect(feld).toHaveValue('2026-03-05');
    const fremd = await fremdeAenderung(page, VON.fremd);
    await weitertippen(page, '2027');

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(VON, '2027-03-05'));
    await imVerlauf(VON, vorher);
    await ruhig(page);
    await expect(feld).toHaveValue('2027-03-05');
    expect(speicherungen(VON) - vorher).toBe(1);
    expect(k.git('rev-list', '--count', fremd + '..HEAD')).toBe('1');
    expect(k.git('log', '-p')).not.toMatch(/from: (2026-03-05|0002-|0020-|0202-)/);
  });

  test('AK 4, US-3: „0503“ getippt, fremde Änderung trifft ein, dann „20“ getippt und das Feld verlassen → das Feld zeigt wieder 12.11.2026, nichts gespeichert, die Seite zeigt den fremden Stand', async ({ page }) => {
    erwartetRot();
    const feld = await feldOeffnen(page, VON);

    await tippen(page, feld, '0503');
    const fremd = await fremdeAenderung(page, VON.fremd);
    await weitertippen(page, '20');
    await feld.blur();

    await expect(feld).toHaveValue(GESPEICHERT);
    await expect(feld).not.toBeFocused();
    await durchsatzZaehltEins(page);
    expect(k.lies(BOARD)).toMatch(gespeichert(VON, GESPEICHERT));
    expect(k.git('rev-parse', 'HEAD')).toBe(fremd);
  });

  /* ── AK 5: Felder, die erst mit dem Knopf speichern ── */
  test('AK 5: im Formular „Neuer Termin“ „3112“ getippt, fremde Änderung trifft ein, dann „2026“ → Feld 31.12.2026, „Termin anlegen“ legt den Termin am 31.12.2026 an', async ({ page }) => {
    const ort = { adresse: '#/berichte/prognose', oeffnen: page => bereit(page, '.wl-termine'), feld: page => page.getByLabel('Datum des Termins'), dateien: {} };
    erwartetRot();
    const feld = await feldOeffnen(page, ort);
    await page.getByLabel('Name des Termins').fill('Abgabe');

    await tippen(page, feld, '3112');
    await fremdeAenderung(page, EINS_ERLEDIGT);
    await weitertippen(page, '2026');

    await expect(feld).toHaveValue('2026-12-31');
    await expect(feld).toBeFocused();
    await page.getByRole('button', { name: 'Termin anlegen' }).click();
    await expect(page.locator('#termine tr[data-termin="Abgabe"]')).toContainText('31.12.2026');
    await expect.poll(() => k.lies(BOARD)).toMatch(/Abgabe.*2026-12-31|2026-12-31.*Abgabe/);
  });

  test('AK 5: im Formular „Neue Aufgabe“ „3112“ in die Fälligkeit getippt, fremde Änderung trifft ein, dann „2026“ → Feld 31.12.2026, der Knopf legt die Aufgabe mit „due: 2026-12-31“ an', async ({ page }) => {
    const ort = {
      adresse: '',
      oeffnen: async page => { await bereit(page, '.ka[data-id="1"]'); await page.getByRole('button', { name: '+ Neue Aufgabe' }).click(); },
      feld: page => page.getByLabel('Fälligkeit der neuen Aufgabe'),
      dateien: {},
    };
    erwartetRot();
    const feld = await feldOeffnen(page, ort);
    await page.getByLabel('Titel der neuen Aufgabe').fill('drei');

    await tippen(page, feld, '3112');
    await fremdeAenderung(page, umbenannt(2, ZWEI));
    await weitertippen(page, '2026');

    await expect(feld).toHaveValue('2026-12-31');
    await expect(feld).toBeFocused();
    await page.getByRole('dialog', { name: 'Neue Aufgabe' }).getByRole('button', { name: 'Anlegen', exact: true }).click();
    await expect(page.locator('.ka[data-id="3"]')).toContainText('drei');
    await expect.poll(() => k.lies('aufgaben/0003-drei.md')).toMatch(/\bdue: 2026-12-31\b/);
    await expect(page.locator('.ka[data-id="2"]')).toContainText('umbenannt');
  });

  /* ── Der Aufschub bleibt nie hängen: wie auch immer die Eingabe endet, danach zeigt die Seite den fremden Stand ── */
  const FENSTER = FELDER['Aufgabenfenster · Fälligkeit, fremde Änderung an einer anderen Aufgabe'];
  const ENDEN_IM_BERICHT = {
    'Esc gedrückt': page => page.keyboard.press('Escape'),
    'die Filterbox zugeklappt': page => page.locator('details.bfilter-box summary').click(),
  };
  for (const [wie, enden] of Object.entries(ENDEN_IM_BERICHT)) {
    test(`Ende der Eingabe: „3112“ in „Zeitraum von“ getippt, fremde Änderung trifft ein, ${wie} → der Durchsatz zeigt den fremden Stand`, async ({ page }) => {
      const feld = await feldOeffnen(page, VON);

      await tippen(page, feld, '3112');
      await fremdeAenderung(page, VON.fremd);
      await enden(page);

      await durchsatzZaehltEins(page);
    });
  }

  test('Ende der Eingabe: „3112“ in „Zeitraum von“ getippt, fremde Änderung trifft ein, die Adresse wechselt zum Burndown → der Burndown steht da', async ({ page }) => {
    const feld = await feldOeffnen(page, VON);

    await tippen(page, feld, '3112');
    await fremdeAenderung(page, VON.fremd);
    await page.evaluate(() => { location.hash = '#/berichte/verlauf'; });

    await expect(page.locator('h1.vh')).toHaveText('Berichte · Burndown');
    await expect(page.locator('#dus-kennzahl')).toHaveCount(0);
  });

  const ENDEN_IM_FENSTER = {
    'Esc gedrückt': page => page.keyboard.press('Escape'),
    'das Fenster mit dem Knopf geschlossen': page => page.getByRole('dialog').getByRole('button', { name: 'Schließen' }).click(),
  };
  for (const [wie, enden] of Object.entries(ENDEN_IM_FENSTER)) {
    test(`Ende der Eingabe: „3112“ in die Fälligkeit im Aufgabenfenster getippt, fremde Änderung trifft ein, ${wie} → das Fenster ist zu, das Board zeigt den fremden Stand`, async ({ page }) => {
      const feld = await feldOeffnen(page, FENSTER);

      await tippen(page, feld, '3112');
      await fremdeAenderung(page, FENSTER.fremd);
      await enden(page);

      await expect(page.getByRole('dialog')).toHaveCount(0);
      await FENSTER.fremdSichtbar(page);
    });
  }
});
