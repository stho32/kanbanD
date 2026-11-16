// R00164 Burndown zeigt Zugang und Abgang je Tag (ADR-0027 N1, Karte #154) — Feature F0127 Rechnung und Zahlen
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');

/* ── Treiber: Ordner mit datierter Geschichte ── */
/** Schreibt Dateien und hält den Stand als Commit mit diesem Datum fest. */
function standAm(ordner, datum, dateien) {
  for (const [rel, inhalt] of Object.entries(dateien)) fs.writeFileSync(path.join(ordner, rel), inhalt);
  execFileSync('git', ['-C', ordner, 'add', '-A']);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const BOARD = 'boards/fabrik.md';
const zeilen = nummern => nummern.map(n => `- #${n}\n`).join('');
const board = (eingang, arbeit, fertig) => `# fabrik\n\n## Eingang\n\n${zeilen(eingang)}\n## In Arbeit\n\n${zeilen(arbeit)}\n## Fertig\n\n${zeilen(fertig)}`;
const datei = n => `aufgaben/${String(n).padStart(4, '0')}-a${n}.md`;
const aufgabe = (n, archiviertAm) => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n${archiviertAm ? `archived: ${archiviertAm}\n` : ''}---\n`;

/* ── Testsprache: das Rechenbeispiel der Anforderung ── */
/** 02.11. #1 und #3 in „Eingang“, #2 in „In Arbeit“; 03.11. #4 angelegt, #5 angelegt und am selben Tag nach „Fertig“, #1 nach
    „Fertig“; 04.11. #2 in „In Arbeit“ archiviert, #1 zurück nach „In Arbeit“; 05.11. #1 und #3 nach „Fertig“, #5 in „Fertig“ archiviert. */
const rechenbeispiel = ordner => {
  einrichten({ ...Object.fromEntries([1, 2, 3, 4, 5].map(n => [datei(n), aufgabe(n)])), [BOARD]: board([], [], []) })(ordner);
  standAm(ordner, '2026-11-02T09:00:00', { [BOARD]: board([1, 3], [2], []) });
  standAm(ordner, '2026-11-03T09:00:00', { [BOARD]: board([1, 3, 4, 5], [2], []) });
  standAm(ordner, '2026-11-03T15:00:00', { [BOARD]: board([3, 4], [2], [1, 5]) });
  standAm(ordner, '2026-11-04T09:00:00', { [BOARD]: board([3, 4], [1, 2], [5]), [datei(2)]: aufgabe(2, '2026-11-04') });
  standAm(ordner, '2026-11-05T09:00:00', { [BOARD]: board([4], [2], [1, 3, 5]), [datei(5)]: aufgabe(5, '2026-11-05') });
};

/* ── Treiber: Oberfläche ── */
/** Öffnet einen Bericht des Boards „fabrik“ am 05.11.2026, 12:00 Uhr (ADR-0026 Regel 6: feste Browser-Uhr). */
async function berichtAm0511(page, k, route) {
  await alsPerson(page, 'st');
  await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+01:00'));
  await page.goto(`${k.adresse}#/berichte/${route}`);
}
const diagramm = page => page.getByRole('img', { name: 'Offene Aufgaben je Tag' });
/** Zeigt im Burndown des Beispiels auf den Tag: vier Tage auf 668 Einheiten Breite ab x = 36. */
async function zeigeAufTag(page, tagImNovember) {
  const svg = diagramm(page);
  await bereit(page, svg);
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  const x = 36 + (tagImNovember - 2) * 668 / 3;
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + 100 * s);
  return page.locator('#tooltip');
}
const tooltipZeilen = tip => tip.locator('span').evaluateAll(spans => spans.map(s => s.textContent.trim()));
async function tabellenansicht(page) {
  const kopf = page.getByText('Tabellenansicht', { exact: true });
  await bereit(page, kopf);
  await kopf.click();
  return page.locator('.tabellenansicht');
}
const zellen = (ort, zelle) => ort.evaluateAll((trs, zelle) => trs.map(tr => [...tr.querySelectorAll(zelle)].map(td => td.textContent.trim())), zelle);

test('R00164 US-1 (AK 1, AK 8): Tooltip des 04.11. nennt die Bilanz des Tages, die Kennzahlzeile die Summen des Zeitraums', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'verlauf');
    const tip = await zeigeAufTag(page, 4);
    await expect(tip).toContainText('04.11.2026');
    await expect.poll(() => tooltipZeilen(tip)).toEqual(['offen 3', 'Umfang 4', '+ hinzugekommen 1', '− erledigt 0', '− entfernt 1']);
    const kennzahlen = page.locator('#bd-kennzahl span');
    await expect(kennzahlen).toHaveText(['+ 6 hinzugekommen', '− 4 erledigt', '− 1 entfernt']);
    // über dem Diagramm
    const [zeile, flaeche] = await Promise.all([page.locator('#bd-kennzahl').boundingBox(), diagramm(page).boundingBox()]);
    expect(zeile.y + zeile.height).toBeLessThanOrEqual(flaeche.y);
  } finally { await k.stoppen(); }
});

test('R00164 US-2 (AK 2): am 03.11. stehen „+ hinzugekommen 2“ und „− erledigt 2“ bei „offen 3“ wie am Vortag', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'verlauf');
    await expect.poll(async () => tooltipZeilen(await zeigeAufTag(page, 3))).toEqual(['offen 3', 'Umfang 5', '+ hinzugekommen 2', '− erledigt 2', '− entfernt 0']);
    await expect.poll(async () => (await tooltipZeilen(await zeigeAufTag(page, 2)))[0]).toBe('offen 3');
  } finally { await k.stoppen(); }
});

test('R00164 US-3 (AK 3, AK 4): archiviert in „In Arbeit“ zählt am 04.11. als entfernt, archiviert in „Fertig“ ändert am 05.11. nichts', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'verlauf');
    await expect.poll(async () => (await tooltipZeilen(await zeigeAufTag(page, 4))).slice(3)).toEqual(['− erledigt 0', '− entfernt 1']);
    await expect.poll(async () => (await tooltipZeilen(await zeigeAufTag(page, 5))).slice(2)).toEqual(['+ hinzugekommen 0', '− erledigt 2', '− entfernt 0']);
  } finally { await k.stoppen(); }
});

test('R00164 US-4 (AK 8): die Tabellenansicht zeigt rechts von „Umfang“ die drei Spalten, 0 statt leer', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'verlauf');
    const tabelle = await tabellenansicht(page);
    await expect.poll(() => zellen(tabelle.locator('thead tr'), 'th')).toEqual([['Tag', 'offen', 'Umfang', '+ hinzugekommen', '− erledigt', '− entfernt']]);
    await expect.poll(() => zellen(tabelle.locator('tbody tr'), 'td')).toEqual([
      ['02.11.2026', '3', '3', '3', '0', '0'],
      ['03.11.2026', '3', '5', '2', '2', '0'],
      ['04.11.2026', '3', '4', '1', '0', '1'],
      ['05.11.2026', '1', '4', '0', '2', '0'],
    ]);
  } finally { await k.stoppen(); }
});

/* ── F0128 Balken und Legende (Zeichnung D0006 #burndown-zugang-abgang) ── */
/** Die Zahlen des Rechenbeispiels je Tag 02.–05.11. (Tabelle der Anforderung). */
const BEISPIEL = { hinzugekommen: [3, 2, 1, 0], erledigt: [0, 2, 0, 2], entfernt: [0, 0, 1, 0] };
const NULLLINIE = 280, JE_AUFGABE = 30 / 3, BALKENBREITE = 24;
const tagX = i => 36 + i * 668 / 3;
/** Erwartete Balken einer Größe: je Tag mit Wert über 0 Mitte, Oberkante und Höhe — `richtung` −1 nach oben, +1 nach unten. */
const erwarteteBalken = (groesse, richtung) => BEISPIEL[groesse].map((anzahl, i) => ({ anzahl, i })).filter(x => x.anzahl > 0)
  .map(({ anzahl, i }) => ({ mitte: tagX(i), oben: richtung < 0 ? NULLLINIE - anzahl * JE_AUFGABE : NULLLINIE, hoehe: anzahl * JE_AUFGABE }));
/** Gezeichnete Balken einer Klasse als äußerer Kasten (samt Kontur) in Einheiten der Zeichenfläche. */
const gezeichneteBalken = (page, klasse) => page.locator(`svg.diagramm rect.${klasse}`).evaluateAll(rechtecke => rechtecke.map(r => {
  const zahl = name => Number(r.getAttribute(name)), stil = getComputedStyle(r);
  let kontur = 0;
  if (stil.stroke !== 'none') kontur = parseFloat(stil.strokeWidth);
  return { mitte: zahl('x') + zahl('width') / 2, oben: zahl('y') - kontur / 2, hoehe: zahl('height') + kontur, breite: zahl('width') + kontur };
}));
async function erwarteBalken(page, klasse, groesse, richtung) {
  const gezeichnet = await gezeichneteBalken(page, klasse), erwartet = erwarteteBalken(groesse, richtung);
  expect(gezeichnet.length, `${klasse}: ein Rechteck je Tag mit Wert über 0`).toBe(erwartet.length);
  erwartet.forEach((soll, n) => {
    for (const mass of ['mitte', 'oben', 'hoehe']) expect(gezeichnet[n][mass], `${klasse} ${n + 1}: ${mass}`).toBeCloseTo(soll[mass], 1);
    expect(gezeichnet[n].breite).toBeCloseTo(BALKENBREITE, 1);
  });
}

test('R00164 AK 7 (B0788): je Tag ein Balken an der Nulllinie — „+“ nach oben, „erledigt“ und „entfernt“ nach unten, Höhe = Zahl des Tages', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'verlauf');
    await bereit(page, diagramm(page));
    await expect(diagramm(page)).toHaveAttribute('aria-label', 'Offene Aufgaben je Tag, darunter Zugang und Abgang je Tag');
    await erwarteBalken(page, 'bd-plus', 'hinzugekommen', -1);
    await erwarteBalken(page, 'bd-erledigt', 'erledigt', 1);
    await erwarteBalken(page, 'bd-entfernt', 'entfernt', 1);
    await expect(page.locator('svg.diagramm .bd-skala')).toHaveText(['+3', '−3']);
    await expect(page.locator('svg.diagramm .bd-null')).toHaveAttribute('y1', String(NULLLINIE));
    // „entfernt“ ist nicht nur Farbe: hohl mit Kontur und Schraffur, „erledigt“ ist gefüllt und ohne Kontur
    const stil = klasse => page.locator(`svg.diagramm rect.${klasse}`).first().evaluate(r => { const s = getComputedStyle(r); return { fill: s.fill, stroke: s.stroke }; });
    const [plus, erledigt, entfernt] = await Promise.all(['bd-plus', 'bd-erledigt', 'bd-entfernt'].map(stil));
    expect(entfernt.fill).toContain('#bd-schraffur');
    expect(entfernt.stroke).not.toBe('none');
    expect(erledigt.stroke).toBe('none');
    expect(erledigt.fill).toMatch(/^(rgb|oklch|color)/);
    expect(plus.fill).not.toBe(erledigt.fill);
    await expect(page.locator('svg.diagramm pattern#bd-schraffur line')).toHaveCount(1);
  } finally { await k.stoppen(); }
});

test('R00164 AK 7 (B0788): die Linien „offen“ und „Umfang“ stehen, wo sie vor dem Band standen', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'verlauf');
    await bereit(page, diagramm(page));
    // Linienfläche y 16–232 bei Umfang höchstens 5: offen 3·3·3·1, Umfang 3·5·4·4 — Werte der Fläche vor dem Umbau (Höhe 272)
    await expect(page.locator('svg.diagramm path.offen')).toHaveAttribute('d', 'M36.0,102.4L258.7,102.4L481.3,102.4L704.0,188.8');
    await expect(page.locator('svg.diagramm path.umfang')).toHaveAttribute('d', 'M36.0,102.4L258.7,16.0L481.3,59.2L704.0,59.2');
    await expect(page.locator('svg.diagramm circle.punkt')).toHaveAttribute('cy', '188.8');
  } finally { await k.stoppen(); }
});

test('R00164 AK 10: der Durchsatz desselben Bestands bleibt beim ersten Erreichen — gesamt 3, obwohl „− erledigt“ 4 nennt', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel);
  try {
    await berichtAm0511(page, k, 'durchsatz');
    await expect(page.locator('#dus-kennzahl span').first()).toHaveText('Gesamt 3');
  } finally { await k.stoppen(); }
});
