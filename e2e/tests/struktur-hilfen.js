// Grundbestand und Prüffunktionen der Struktur für Hilfstechnik (R00113, ADR-0018): geteilt von der Routenprobe, ihren Mutanten
// und dem Fotoskript für vorher/nachher. Jede Prüffunktion liefert Verstöße als Liste, damit eine Mutante lesen kann, was sie fängt.
const fs = require('node:fs');
const path = require('node:path');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');
const { ansichtenDerAnwendung } = require('./ansichten');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'rot', { fertig: 'US-1' }),
]);

// Eine Phase, „In Arbeit“ zugeordnet: so bleibt das gebundene Board bei den drei Spalten der User Story, statt dass kanbanD die
// Spalten des Standardmodells (Entwicklung, Entwicklertest, Abnahme) nachträgt (src/dienst/phasen.rs, board_mit_phasen).
const PHASEN = '# Phasen\n\n## Phasen\n\n| Nr | Phase | Nachweis |\n|---|---|---|\n| 1 | Entwicklung | — |\n';

/** Arbeits-Repository mit der WBS von „kd“ und einer Phasen-Datei mit nur der Phase „Entwicklung“. */
function arbeitMitEinerPhase() {
  const arbeit = arbeitsRepository(WBS);
  fs.writeFileSync(path.join(path.dirname(arbeit.wbs), 'kanbanD-phasen.md'), PHASEN);
  arbeit.git('add', '-A');
  arbeit.git('-c', 'user.name=KI', '-c', 'user.email=k@k', 'commit', '-q', '-m', 'Phasen');
  return arbeit;
}

const einstellungen = arbeit => `---
people:
  st: {name: Stefan, kind: human}
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

/** Dateien des Grundbestands aus user-stories/R00113.md; `arbeit` aus arbeitMitEinerPhase(). */
const grundbestand = arbeit => ({
  'kanbanD.md': einstellungen(arbeit),
  'boards/entwicklung.md': '---\ncolumn-phases:\n  In Arbeit: Entwicklung\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n- [#4](../aufgaben/0004-vier.md)\n- [#9](../aufgaben/0009-neun.md)\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nclass: bug\ndue: 2026-10-28\nsignals: [mail]\norigins: [kd:I0001]\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\nclass: feature\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: "Ölwechsel & <Prüfung>"\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: [vier\n---\n',
});

/** Namen der Berichte wie im Menü „Berichte“ (web/ansicht.js, vBerichtePop). */
const BERICHTSNAMEN = {
  stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', durchlauf: 'Durchlaufzeit',
  prognose: 'Wie lange noch', fieber: 'Projekt-Fever-Chart', kosten: 'Kosten', bestand: 'Bestand nach Labels',
};

/** Seitenname, mit dem die Überschrift erster Ebene je Route beginnt (US-1). */
function erwarteterSeitenname(route) {
  if (route.ansicht === 'Board') return 'Board · Entwicklung';
  if (route.ansicht === 'Aufgabenliste') return 'Aufgaben';
  if (route.ansicht === 'WBS-Sicht') return 'WBS · kanbanD';
  if (route.ansicht.startsWith('Bericht ')) return 'Berichte · ' + BERICHTSNAMEN[route.ansicht.slice('Bericht '.length)];
  return route.ansicht;
}

/** Was auf einer Route fertig geladen sein muss, bevor geprüft wird; die WBS-Sicht lädt ihre Datei nach. */
const BEREIT = { 'WBS-Sicht': '.wbs-titel', Board: '.bahn' };

/** Die Routen aus ansichtenDerAnwendung mit ihrem Seitennamen. */
const ROUTEN = ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' }).map(r => ({ ...r, seitenname: erwarteterSeitenname(r), bereit: BEREIT[r.ansicht] }));

/** Die drei Zustände neben den Routen (US-1); der Test stellt jeden selbst her. */
const ZUSTAENDE = [
  { ansicht: 'erster Start', seitenname: 'Einrichten', ohneNavigation: true },
  { ansicht: 'Einrichtungsmodus', seitenname: 'Board · Entwicklung', ohneNavigation: true },
  { ansicht: 'defektes Board', seitenname: 'Board' },
];

/** Die Ansicht (S.ui.view) einer Adresse: „#/berichte/verlauf“ → „berichte/verlauf“, „#/board/entwicklung“ → „board“. */
function ansichtDerAdresse(adresse) {
  const teile = adresse.slice('#/'.length).split('/');
  if (teile[0] === 'berichte') return teile.slice(0, 2).join('/');
  return teile[0];
}

/** Wartet, bis die Seite live verbunden und #main für `adresse` gezeichnet ist — ein Hash-Wechsel lädt die Seite nicht neu. */
async function gezeichnet(page, adresse, bereit) {
  await page.locator('html[data-live="verbunden"]').waitFor({ state: 'attached' });
  await page.locator(`#main[data-sicht^="${ansichtDerAdresse(adresse)}/"]`).waitFor({ state: 'attached' });
  if (bereit) await page.locator('#main ' + bereit).first().waitFor({ state: 'attached' });
}

/** Verstöße gegen „genau eine Überschrift erster Ebene, verborgen, beginnt mit dem Seitennamen“ auf der offenen Seite. */
async function seitenueberschriftPruefen(page, { ansicht, seitenname }) {
  const ersteEbene = await page.evaluate(() => [...document.querySelectorAll('h1, [role=heading][aria-level="1"]')].map(h => {
    const r = h.getBoundingClientRect();
    return { text: h.textContent.replace(/\s+/g, ' ').trim(), flaeche: r.width * r.height };
  }));
  if (ersteEbene.length !== 1) return [`${ersteEbene.length} Überschriften erster Ebene in ${ansicht}`];
  const [h1] = ersteEbene;
  const verstoesse = [];
  if (!h1.text.startsWith(seitenname)) verstoesse.push(`Überschrift erster Ebene in ${ansicht} heißt „${h1.text}“, erwartet Anfang „${seitenname}“`);
  if (h1.flaeche > 1) verstoesse.push(`Überschrift erster Ebene in ${ansicht} ist zu sehen (${h1.flaeche} px²)`);
  return verstoesse;
}

/** Verstöße gegen „je genau ein banner, main, contentinfo, höchstens eine navigation“ (`ohneNavigation`: keine). */
async function landmarkenPruefen(page, { ansicht, ohneNavigation }) {
  const verstoesse = [];
  for (const rolle of ['banner', 'main', 'contentinfo']) {
    const n = await page.getByRole(rolle).count();
    if (n !== 1) verstoesse.push(`${n} × ${rolle} in ${ansicht}`);
  }
  const navigation = await page.getByRole('navigation').count();
  if (navigation > (ohneNavigation ? 0 : 1)) verstoesse.push(`${navigation} × navigation in ${ansicht}`);
  return verstoesse;
}

const APP_JS = path.resolve(__dirname, '../../web/app.js');

/** Zahl der Verzweigungen `return v…()` in vHaupt() des Quelltexts. */
function verzweigungenVonVHaupt(quelltext) {
  const rumpf = quelltext.match(/function vHaupt\(\) \{([\s\S]*?)\n\}/);
  if (!rumpf) throw new Error('vHaupt() nicht gefunden');
  return [...rumpf[1].matchAll(/return v\w+\(\)/g)].length;
}

/** Verstoß, wenn vHaupt() mehr Verzweigungen hat, als die Probe Routen und Zustände prüft. */
function vollstaendigkeitPruefen(quelltext, geprueft) {
  const verzweigungen = verzweigungenVonVHaupt(quelltext);
  if (verzweigungen > geprueft) return [`Route ohne Prüfung: vHaupt() verzweigt ${verzweigungen}-mal, die Probe prüft ${geprueft} Routen und Zustände`];
  return [];
}

module.exports = {
  grundbestand, arbeitMitEinerPhase, BERICHTSNAMEN, ROUTEN, ZUSTAENDE, APP_JS,
  gezeichnet, seitenueberschriftPruefen, landmarkenPruefen, verzweigungenVonVHaupt, vollstaendigkeitPruefen,
};
