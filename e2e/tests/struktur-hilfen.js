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
  stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', fluss: 'Kumulativer Fluss', durchsatz: 'Durchsatz', durchlauf: 'Durchlaufzeit',
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
const BEREIT = {
  'WBS-Sicht': '.wbs-titel', Board: '.bahn', Einrichten: '.einr', Aufgabenliste: '.ziele',
  'Bericht verlauf': '.dtitel', 'Bericht fluss': '.bericht-rahmen', 'Bericht durchsatz': '.leiste', 'Bericht durchlauf': '.dtitel', 'Bericht prognose': '.dtitel', 'Bericht fieber': '.dtitel',
};

/** Die Sicht aus vHaupt() (web/app.js), die eine Route zeichnet: daran gleicht die Probe ab, ob jede Verzweigung geprüft wird. */
const SICHTEN = {
  Board: 'vBoard', Aufgabenliste: 'vAufgaben', Personen: 'vPersonen', Einrichten: 'vEinrichten', 'WBS-Sicht': 'vWbs',
  'Bericht stundenzettel': 'vStundenzettel', 'Bericht kreuz': 'vKreuz', 'Bericht verlauf': 'vVerlauf', 'Bericht fluss': 'vFluss', 'Bericht durchsatz': 'vDurchsatz', 'Bericht durchlauf': 'vDurchlauf',
  'Bericht prognose': 'vPrognose', 'Bericht fieber': 'vFieber', 'Bericht kosten': 'vKosten', 'Bericht bestand': 'vBestand',
};

/** Die Routen aus ansichtenDerAnwendung mit Seitenname und Sicht. */
const ROUTEN = ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' })
  .map(r => ({ ...r, seitenname: erwarteterSeitenname(r), bereit: BEREIT[r.ansicht], sicht: SICHTEN[r.ansicht] }));

/** Die drei Zustände neben den Routen (US-1); der Test stellt jeden selbst her. */
const ZUSTAENDE = [
  { ansicht: 'erster Start', seitenname: 'Einrichten', ohneNavigation: true, sicht: 'vFirst' },
  { ansicht: 'Einrichtungsmodus', seitenname: 'Board · Entwicklung', ohneNavigation: true, sicht: 'vSetup' },
  { ansicht: 'defektes Board', seitenname: 'Board', sicht: 'vBoard' },
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
  let hoechstens = 1;
  if (ohneNavigation) hoechstens = 0;
  if (navigation > hoechstens) verstoesse.push(`${navigation} × navigation in ${ansicht}`);
  return verstoesse;
}

/** Verstöße gegen „keine Überschrift liegt mehr als eine Stufe tiefer als die vorige“ in #main (US-4), samt h1 der Seite. */
async function ebenenPruefen(page, { ansicht }) {
  const folge = await page.evaluate(() => [...document.querySelectorAll('#main :is(h1, h2, h3, h4, h5, h6, [role=heading])')].map(h => ({
    ebene: Number(h.getAttribute('aria-level') || h.tagName.slice(1)),
    text: h.textContent.replace(/\s+/g, ' ').trim().slice(0, 40),
  })));
  const verstoesse = [];
  folge.reduce((vorige, h) => {
    if (h.ebene > vorige + 1) verstoesse.push(`${ansicht}: Ebene ${h.ebene} „${h.text}“ nach Ebene ${vorige}`);
    return h.ebene;
  }, 0);
  return verstoesse;
}

// Gestaltung der Abschnittsköpfe vor dem Bau, gemessen bei 1280 × 800 mit getComputedStyle am Stand c8f0617 (web/ wie f719975)
// über das Fotoskript der Karte #13 (messung.json, 2026-11-08). Nach dem Bau müssen h2 statt h3/h4 genauso aussehen (US-4).
const TEXT = { fontFamily: '"IBM Plex Sans", system-ui, sans-serif', paddingTop: '0px' };
const DTITEL = {
  ...TEXT, fontSize: '13px', fontWeight: '600', lineHeight: '18.2px', letterSpacing: 'normal', color: 'oklch(0.24 0.02 255)',
  marginTop: '12px', marginBottom: '4px', paddingLeft: '0px', borderTopWidth: '0px', borderBottomWidth: '0px', height: 18.1875,
};
const EINR_KOPF = {
  ...TEXT, fontSize: '11px', fontWeight: '600', lineHeight: '15.4px', letterSpacing: '0.55px', color: 'oklch(0.48 0.018 255)',
  marginTop: '0px', marginBottom: '0px', paddingLeft: '12px', borderTopWidth: '1px', borderBottomWidth: '1px', height: 30,
};
const ZIELE_KOPF = {
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace', paddingTop: '0px', fontSize: '10px', fontWeight: '600', lineHeight: '14px',
  letterSpacing: '0.6px', color: 'oklch(0.48 0.018 255)', marginTop: '0px', marginBottom: '6px', paddingLeft: '0px',
  borderTopWidth: '0px', borderBottomWidth: '0px', height: 14,
};
const KOPF = ':is(h1, h2, h3, h4, h5, h6)';

/** Je Seite: welche Köpfe, wie viele, welche Gestaltung; `abweichend` je Textanfang (erster Kopf ohne Linie oben, erster Prognose-Kopf ohne Rand). */
const GESTALTUNG = [
  { ansicht: 'Bericht verlauf', adresse: '#/berichte/verlauf', kopf: '.dtitel', anzahl: 2, soll: DTITEL },
  { ansicht: 'Bericht durchlauf', adresse: '#/berichte/durchlauf', kopf: '.dtitel', anzahl: 2, soll: DTITEL },
  { ansicht: 'Bericht prognose', adresse: '#/berichte/prognose', kopf: '.dtitel', anzahl: 4, soll: DTITEL, abweichend: { 'Noch nicht erreicht': { marginTop: '0px' } } },
  { ansicht: 'Bericht fieber', adresse: '#/berichte/fieber', kopf: '.dtitel', anzahl: 1, soll: DTITEL },
  { ansicht: 'Einrichten', adresse: '#/einrichten', kopf: '.einr ' + KOPF, anzahl: 6, soll: EINR_KOPF, abweichend: { PERSONEN: { borderTopWidth: '0px' }, 'KANBAND.MD': { borderTopWidth: '0px' } } },
  { ansicht: 'Einrichtungsmodus', kopf: '.einr ' + KOPF, anzahl: 2, soll: EINR_KOPF, abweichend: { 'GEBUNDEN AN': { borderTopWidth: '0px' } } },
  { ansicht: 'Aufgabenliste', adresse: '#/aufgaben', kopf: '.ziele ' + KOPF, anzahl: 1, soll: ZIELE_KOPF },
];

/** Verstöße gegen die vor dem Bau gemessene Gestaltung der Köpfe einer Seite aus GESTALTUNG. */
async function gestaltungPruefen(page, { ansicht, kopf, anzahl, soll, abweichend = {} }) {
  const koepfe = await page.locator('#main ' + kopf).evaluateAll((els, namen) => els.map(e => {
    const stil = getComputedStyle(e);
    const ist = { text: e.textContent.replace(/\s+/g, ' ').trim(), tag: e.tagName, height: e.getBoundingClientRect().height };
    for (const name of namen) ist[name] = stil[name];
    return ist;
  }), Object.keys(soll).filter(name => name !== 'height'));
  if (koepfe.length !== anzahl) return [`${ansicht}: ${koepfe.length} Köpfe ${kopf} statt ${anzahl}`];
  const verstoesse = [];
  for (const ist of koepfe) {
    const anfang = Object.keys(abweichend).find(a => ist.text.startsWith(a));
    if (ist.tag !== 'H2') verstoesse.push(`${ansicht} „${ist.text.slice(0, 30)}“: ${ist.tag} statt H2`);
    const erwartet = { ...soll, ...(anfang && abweichend[anfang]) };
    for (const [name, wert] of Object.entries(erwartet)) {
      if (ist[name] !== wert) verstoesse.push(`${ansicht} „${ist.text.slice(0, 30)}“: ${name} ${ist[name]} statt ${wert}`);
    }
  }
  return verstoesse;
}

const APP_JS = path.resolve(__dirname, '../../web/app.js');

/** Eine Rückgabe in vHaupt(), deren Sicht die Probe lesen kann: `return vBoard();`, wahlweise hinter einem `if (…)`. */
const LESBARE_RUECKGABE = /^\s*(if \(.+\) )?return (v\w+)\(\);$/;

/** Jede Zeile mit `return` im Rumpf von vHaupt(), mit ihrer Nummer in web/app.js und der Sicht, wenn sie lesbar ist. */
function rueckgabenVonVHaupt(quelltext) {
  const rumpf = quelltext.match(/function vHaupt\(\) \{([\s\S]*?)\n\}/);
  if (!rumpf) throw new Error('vHaupt() nicht gefunden');
  const ersteZeile = quelltext.slice(0, rumpf.index).split('\n').length;
  return rumpf[1].split('\n')
    .map((text, i) => ({ zeile: ersteZeile + i, text, lesbar: LESBARE_RUECKGABE.exec(text) }))
    .filter(r => /\breturn\b/.test(r.text));
}

/** Die Sichten, die vHaupt() zurückgibt (`return vBoard();` → „vBoard“), in Reihenfolge der Verzweigungen. */
function sichtenVonVHaupt(quelltext) {
  return rueckgabenVonVHaupt(quelltext).filter(r => r.lesbar).map(r => r.lesbar[2]);
}

/** Verstöße gegen „jede Rückgabe von vHaupt() ist lesbar und ihre Sicht steht in `geprueft`“. */
function vollstaendigkeitPruefen(quelltext, geprueft) {
  const abgedeckt = new Set(geprueft.map(g => g.sicht));
  const unlesbar = rueckgabenVonVHaupt(quelltext).filter(r => !r.lesbar).map(r => `Rückgabe ohne Prüfung: web/app.js:${r.zeile} „${r.text.trim()}“`);
  const ungeprueft = sichtenVonVHaupt(quelltext).filter(sicht => !abgedeckt.has(sicht)).map(sicht => `Route ohne Prüfung: ${sicht}() in vHaupt()`);
  return [...unlesbar, ...ungeprueft];
}

module.exports = {
  grundbestand, arbeitMitEinerPhase, BERICHTSNAMEN, ROUTEN, ZUSTAENDE, APP_JS,
  gezeichnet, seitenueberschriftPruefen, landmarkenPruefen, sichtenVonVHaupt, vollstaendigkeitPruefen,
  ebenenPruefen, GESTALTUNG, gestaltungPruefen,
};
