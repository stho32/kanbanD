// R00155 (Karte #54, I0142): gemeinsamer Grundbestand und die eine Messung „nichts geschrieben“ für die Specs des Pakets.
const { expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, mutanteEinsetzen } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  bot: {name: Bot, kind: agent}
classes:
  bug: {label: Fehler, color: red}
---
`;
const DATEI_1 = 'aufgaben/0001-abnahme-pruefen.md';
const DATEI_2 = 'aufgaben/0002-zweite-aufgabe.md';
/** Grundbestand der Anforderung: #1 „Abnahme prüfen“ mit Beschreibung und Labels, #2 „Zweite Aufgabe“ ohne Beschreibung; st (Mensch), bot (Agent). */
const GRUNDBESTAND = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  [DATEI_1]: '---\nid: 1\ntitle: Abnahme prüfen\nlabels: [ui, daten]\n---\n\nErster Absatz\n',
  [DATEI_2]: '---\nid: 2\ntitle: Zweite Aufgabe\n---\n',
};
const ALS_BOT = { headers: { 'X-KanbanD-Wer': 'bot' } };
const MELDUNG_TITEL = 'Die Aufgabe braucht einen Titel';
const MELDUNG_DAUER = 'Dauer „abc“: z. B. 0:45, 1,5 oder 90 min';
const MELDUNG_X1 = '„X1“ ist keine Herkunft';

/** Startet kanbanD mit dem Grundbestand, `st` im Browser gewählt, Board geladen; führt Protokoll über jede schreibende Anfrage. */
async function starten(page) {
  const k = await kanbanStarten(einrichten(GRUNDBESTAND));
  await mutanteEinsetzen(page);
  await alsPerson(page, 'st');
  const schreibend = [];
  page.on('request', anfrage => { if (anfrage.method() !== 'GET') schreibend.push(`${anfrage.method()} ${new URL(anfrage.url()).pathname}`); });
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="2"]')).toBeVisible();
  return Object.assign(k, { schreibend });
}

/** Öffnet das Aufgabenfenster über die Karte (Klick, bei `tippen` ein Tipp) und liefert den Dialog. */
async function fensterOeffnen(page, nummer, tippen = false) {
  const titel = page.locator(`.ka[data-id="${nummer}"] .t`);
  if (tippen) await titel.tap(); else await titel.click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nummer}` });
  await expect(fenster).toBeVisible();
  return fenster;
}

/** Zwei Frames: was eine Taste oder ein Tipp synchron auslöst — auch eine Anfrage —, ist danach unterwegs. */
const zweiFrames = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));

/** Der Stand, gegen den „nichts geschrieben“ misst: Anfragen, beide Dateien, Zahl der Commits, Text „gespeichert …“ im Fuß. */
async function standMerken(page, k) {
  const fuss = page.locator('#fenster .mod-fuss .gs');
  return {
    anfragen: k.schreibend.length,
    dateien: [k.lies(DATEI_1), k.lies(DATEI_2)],
    commits: k.git('rev-list', '--count', 'HEAD'),
    fuss: await fuss.count() ? await fuss.innerText() : null,
  };
}

/**
 * „Nichts geschrieben“ (R00155, Tests zur Reproduktion): seit `vorher` kein PATCH und kein POST, die Dateien byteweise gleich,
 * `git rev-list --count HEAD` unverändert, der Text „gespeichert …“ im Fuß unverändert (solange das Fenster offen ist).
 */
async function nichtsGeschrieben(page, k, vorher, wo = '') {
  await zweiFrames(page);
  expect(k.schreibend.slice(vorher.anfragen), `${wo}: keine schreibende Anfrage`).toEqual([]);
  expect([k.lies(DATEI_1), k.lies(DATEI_2)], `${wo}: Dateien byteweise gleich`).toEqual(vorher.dateien);
  expect(k.git('rev-list', '--count', 'HEAD'), `${wo}: kein neuer Commit`).toBe(vorher.commits);
  const fuss = page.locator('#fenster .mod-fuss .gs');
  if (await fuss.count()) expect(await fuss.innerText(), `${wo}: „gespeichert …“ im Fuß unverändert`).toBe(vorher.fuss);
}

/** `bot` ändert über die API den Titel von #2; gewartet wird, bis das Board hinter dem Fenster ihn zeigt — das Fenster hat neu gezeichnet. */
async function fremdesNeuzeichnen(page, k, titel = 'Zweite Aufgabe, von bot geändert') {
  const antwort = await page.request.patch(k.adresse + 'api/aufgaben/2', { ...ALS_BOT, data: { titel } });
  expect(antwort.status(), await antwort.text()).toBe(200);
  await expect(page.locator('.ka[data-id="2"] .t')).toHaveText(titel);
}

/** Ungültige Felder des Fensters und Felder, die auf die Fenstermeldung verweisen — je als Liste lesbarer Namen. */
function verweise(fenster) {
  return fenster.evaluate(wurzel => {
    const name = el => el.id ? '#' + el.id : el.dataset.af ? `[data-af=${el.dataset.af}]` : el.getAttribute('aria-label') || el.tagName;
    return {
      ungueltig: [...wurzel.querySelectorAll('[aria-invalid]')].map(name),
      verweist: [...wurzel.querySelectorAll('[aria-describedby="fenster-meldung"]')].map(name),
      meldungen: wurzel.querySelectorAll('#fenster-meldung').length,
    };
  });
}

/** Was Hilfstechnik angesagt bekäme: die Texte aller Live-Bereiche der Seite (`role="status"`, `role="alert"`, `aria-live`). */
function ansagen(page) {
  return page.evaluate(() => [...document.querySelectorAll('[role=status], [role=alert], [aria-live]')].map(bereich => bereich.textContent));
}

module.exports = { ansagen,  GRUNDBESTAND, DATEI_1, DATEI_2, ALS_BOT, MELDUNG_TITEL, MELDUNG_DAUER, MELDUNG_X1, starten, fensterOeffnen, zweiFrames, standMerken, nichtsGeschrieben, fremdesNeuzeichnen, verweise };
