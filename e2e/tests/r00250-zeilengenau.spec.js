// R00250 (ADR-0043): „Speichern“ in „Einrichten“ ändert in kanbanD.md nur die Zeilen, die sich ändern — US-1, US-4 und
// AK 10 (Oberfläche) im echten Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, commitSteht } = require('./hilfen');

// ---- Testsprache --------------------------------------------------------------------------------------------------------

const SH = '  sh: {name: Sven, kind: human}\n';
const SH_NEU = '  sh: {name: Sven Hansen, kind: human}\n';

/** Datei H aus R00250 (Ausgangslage): die Datei, die `einrichten` für F schreibt, mit den vier Zusätzen von Hand. */
const H = `---\n# von Hand\neigener-schluessel: 1\npeople:\n${SH}  ag: {name: Agent A, kind: agent}\n# Klassen folgen\nclasses:\n  bug: {label: Fehler, color: red}\nsources:\n  repository: ""\n---\n# Unser Ordner\n\nVon Hand geschrieben.\n`;

const WORTLAUT = 'Nicht gespeichert: Der Abschnitt „people“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.';

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

async function einrichtenOeffnen(page, datei) {
  k = await kanbanStarten(einrichten({ 'kanbanD.md': datei }));
  await alsPerson(page, 'sh');
  await page.goto(k.adresse + '#/einrichten');
  await expect(page.getByLabel('Name sh')).toHaveValue('Sven');
}

async function svenUmbenennenUndSpeichern(page) {
  await page.getByLabel('Name sh').fill('Sven Hansen');
  await page.getByRole('button', { name: 'Speichern' }).click();
}

// ---- Tests --------------------------------------------------------------------------------------------------------------

test('US-1 (Probe der Karte): Umbenennen in „Einrichten“ ändert genau die Zeile von sh, alles andere zeichengleich', async ({ page }) => {
  await einrichtenOeffnen(page, H);
  const vorher = +k.git('rev-list', '--count', 'HEAD');
  await svenUmbenennenUndSpeichern(page);
  await commitSteht(k, vorher + 1);
  expect(k.git('show', '--numstat', '--format=', 'HEAD', '--', 'kanbanD.md')).toBe('1\t1\tkanbanD.md');
  expect(k.lies('kanbanD.md')).toBe(H.replace(SH, SH_NEU));
});

test('US-4 / AK 10: Handform in people — der Wortlaut steht in #einr-fehler, das Feld zeigt weiter „Sven Hansen“, kein Commit', async ({ page }) => {
  const datei = H.replace(SH, `${SH}  # Vertretung\n`);
  await einrichtenOeffnen(page, datei);
  const vorher = k.git('rev-parse', 'HEAD');
  await svenUmbenennenUndSpeichern(page);
  await expect(page.locator('#einr-fehler')).toHaveText(WORTLAUT);
  await expect(page.locator('#einr-fehler')).toBeFocused();
  await expect(page.getByLabel('Name sh')).toHaveValue('Sven Hansen');
  expect(k.git('rev-parse', 'HEAD')).toBe(vorher);
  expect(k.lies('kanbanD.md')).toBe(datei);
});
