// R00254 Zahlen an den Balken (Karte #277, Interaction I0244, B1354) — Durchsatz je Zeitraum
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, thema, breiteSetzen, kontrastFarben, farbPixel, mutanteEinsetzen } = require('./hilfen');

/* ── Treiber: Ordner mit datierter Geschichte ── */
/** Schreibt Dateien und hält den Stand als Commit mit diesem Datum fest. */
function standAm(ordner, datum, dateien) {
  for (const [rel, inhalt] of Object.entries(dateien)) fs.writeFileSync(path.join(ordner, rel), inhalt);
  execFileSync('git', ['-C', ordner, 'add', '-A']);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const BOARD = 'boards/fabrik.md';
const zeilen = nummern => nummern.map(n => `- #${n}\n`).join('');
const datei = n => `aufgaben/${String(n).padStart(4, '0')}-a${n}.md`;
const aufgabe = n => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n---\n`;

/** Rechenbeispiel A (R00254): Board Backlog · Arbeit · Erledigt, drei Aufgaben, 02.11.–04.11.2026. */
const rechenbeispiel = (kopf = '') => ordner => {
  const board = (backlog, arbeit, erledigt) => `${kopf}# fabrik\n\n## Backlog\n\n${zeilen(backlog)}\n## Arbeit\n\n${zeilen(arbeit)}\n## Erledigt\n\n${zeilen(erledigt)}`;
  einrichten({ ...Object.fromEntries([1, 2, 3].map(n => [datei(n), aufgabe(n)])), [BOARD]: board([], [], []) })(ordner);
  standAm(ordner, '2026-11-02T09:00:00', { [BOARD]: board([1, 2, 3], [], []) });
  standAm(ordner, '2026-11-03T09:00:00', { [BOARD]: board([3], [1, 2], []) });
  standAm(ordner, '2026-11-04T08:00:00', { [BOARD]: board([2, 3], [], [1]) });
  standAm(ordner, '2026-11-04T09:00:00', { [BOARD]: board([3], [2], [1]) });
};

/** 90 Tage je Tag: Board Eingang · In Arbeit · Fertig, eine Aufgabe kommt am 01.08. und ist am 02.08. fertig. */
const neunzigTage = ordner => {
  const kopf = '---\nreport-filter: {period: eigen, from: 2026-08-01, to: 2026-10-30}\n---\n';
  const board = (eingang, inArbeit, fertig) => `${kopf}# fabrik\n\n## Eingang\n\n${zeilen(eingang)}\n## In Arbeit\n\n${zeilen(inArbeit)}\n## Fertig\n\n${zeilen(fertig)}`;
  einrichten({ [datei(1)]: aufgabe(1), [BOARD]: board([], [], []) })(ordner);
  standAm(ordner, '2026-08-01T09:00:00', { [BOARD]: board([1], [], []) });
  standAm(ordner, '2026-08-02T09:00:00', { [BOARD]: board([], [], [1]) });
};

/* ── Treiber: Oberfläche ── */
const diagramm = page => page.getByRole('img', { name: 'Durchsatz je Zeitraum: Zugang und Abgang je Periode' });
const zahlen = page => diagramm(page).locator('text.zahl');
const satz = page => page.locator('.dus-satz');
const SATZ = 'Zu viele Perioden für Zahlen an den Balken — gröbere Auflösung wählen oder die Tabellenansicht öffnen.';

async function alsFabrik(page) { await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik')); }
/** Öffnet den Durchsatz von Beispiel A am 04.11.2026 um 12:00 (feste Browser-Uhr, ADR-0026 Regel 6). */
async function berichtAm0411(page, k, route = 'durchsatz') {
  await alsPerson(page, 'st');
  await alsFabrik(page);
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await bereit(page, '#main .leiste');
}
/** Legt ein Bildschirmfoto ab, wenn KD_BILDER einen Ordner nennt (Beleg für den Bericht der Karte). */
async function bildAblegen(page, name) {
  if (process.env.KD_BILDER) await page.locator('.body.bericht').first().screenshot({ path: path.join(process.env.KD_BILDER, name) });
}
const stelle = (ns, i) => ({ x: Number(ns[i].getAttribute('x')), y: Number(ns[i].getAttribute('y')), text: ns[i].textContent });

// Mutantenprobe: KD_MUTANTE setzt eine Datei der Oberfläche mit einem Ersatz aus (Muster r00122).
test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });

test('R00254 B1354 (US-4, AK 4): sechs Zahlen über den Balken, auch die 0 — mittig, an der Grundlinie bei 0, gut lesbar', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k);
    await page.getByRole('radio', { name: 'je Tag' }).click();
    await expect(diagramm(page)).toBeVisible();
    // 3 · 0 | 0 · 0 | 0 · 1 — Tag für Tag Zugang und Abgang, auch die 0
    await expect(zahlen(page)).toHaveText(['3', '0', '0', '0', '0', '1']);
    const ns = await zahlen(page).evaluateAll(alle => alle.map(n => ({ x: Number(n.getAttribute('x')), y: Number(n.getAttribute('y')), text: n.textContent })));
    const [zugang, abgang] = await Promise.all([
      diagramm(page).locator('rect.balken.zugang').evaluateAll(rs => rs.map(r => ({ x: Number(r.getAttribute('x')), y: Number(r.getAttribute('y')), w: Number(r.getAttribute('width')) }))),
      diagramm(page).locator('rect.balken:not(.zugang)').evaluateAll(rs => rs.map(r => ({ x: Number(r.getAttribute('x')), y: Number(r.getAttribute('y')), w: Number(r.getAttribute('width')) }))),
    ]);
    // Die zwei gezeichneten Balken tragen ihre Zahl in der Mitte, 4 Einheiten über der Oberkante
    expect(ns[0].x).toBeCloseTo(zugang[0].x + zugang[0].w / 2, 1);
    expect(ns[0].y).toBeCloseTo(zugang[0].y - 4, 1);
    expect(ns[5].x).toBeCloseTo(abgang[0].x + abgang[0].w / 2, 1);
    expect(ns[5].y).toBeCloseTo(abgang[0].y - 4, 1);
    // Die Nullen stehen an der Grundlinie (unten 228 − 4) und in der Mitte ihres Platzes
    const marken = await diagramm(page).locator('line.marke').evaluateAll(ls => ls.map(l => Number(l.getAttribute('x1'))));
    for (const [i, marke] of [[1, marken[0]], [2, marken[1]], [3, marken[1]], [4, marken[2]]]) {
      expect(ns[i].y).toBeCloseTo(224, 1);
      expect(ns[i].x).toBeCloseTo(i % 2 === 1 ? marke + 24.5 : marke - 24.5, 1);
    }
    // Schrift wie die Achsenbeschriftung, Halo in der Flächenfarbe, Farbe der Achse
    const stil = await zahlen(page).first().evaluate(n => { const s = getComputedStyle(n); return { groesse: s.fontSize, fuellung: s.fill, strich: s.stroke, strichbreite: s.strokeWidth, reihenfolge: s.paintOrder }; });
    expect(stil.groesse).toBe('11px');
    expect(stil.strichbreite).toBe('3.5px');
    expect(stil.reihenfolge).toBe('stroke');
    const grund = await page.locator('.body.bericht').first().evaluate(b => getComputedStyle(b).backgroundColor);
    expect(await farbPixel(page, stil.strich)).toEqual(await farbPixel(page, grund));
    for (const farbschema of ['hell', 'dunkel']) {
      await thema(page, farbschema === 'dunkel' ? 'dark' : 'light');
      const [farbe, flaeche] = await Promise.all([zahlen(page).first().evaluate(n => getComputedStyle(n).fill), page.locator('.body.bericht').first().evaluate(b => getComputedStyle(b).backgroundColor)]);
      expect(await kontrastFarben(page, farbe, flaeche), `Kontrast der Zahl in ${farbschema}`).toBeGreaterThanOrEqual(4.5);
      await bildAblegen(page, `durchsatz-zahlen-${farbschema}.png`);
    }
    // Tooltip, Tabelle und Ø-Linien bleiben, wie sie waren
    await expect(diagramm(page).locator('text.ratetext')).toHaveText(['Ø Zugang 1,0 je Tag', 'Ø Abgang 0,3 je Tag']);
    await expect(page.locator('.fluss-tab tbody tr')).toHaveCount(3);
    await diagramm(page).locator('rect.balken').first().hover();
    await expect(page.locator('#tooltip')).toContainText('Zugang 3');
  } finally { await k.stoppen(); }
});

test('R00254 B1354 (US-5, AK 5): 90 Perioden je Tag — keine Zahl, der Satz erklärt warum; je Woche kehren die Zahlen zurück', async ({ page }) => {
  const k = await kanbanStarten(neunzigTage);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.clock.setFixedTime(new Date('2026-10-30T12:00:00'));
    await page.goto(`${k.adresse}#/berichte/durchsatz`);
    await bereit(page, '#main .leiste');
    await page.getByRole('radio', { name: 'je Tag' }).click();
    await expect(zahlen(page)).toHaveCount(0);
    await expect(satz(page)).toHaveText(SATZ);
    await bildAblegen(page, 'durchsatz-zahlen-90-tage.png');
    // je Woche passen die Zahlen wieder, der Satz verschwindet
    await page.getByRole('radio', { name: 'je Woche' }).click();
    await expect(zahlen(page).first()).toBeVisible();
    expect(await zahlen(page).count()).toBeGreaterThan(0);
    await expect(satz(page)).toHaveCount(0);
  } finally { await k.stoppen(); }
});

test('R00254 B1354 (US-7, AK 7): ohne gezeigten Zugang nur die Zahlen des Abgangs', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel('---\nfever: {from-column: Erledigt}\n---\n\n'));
  try {
    await berichtAm0411(page, k);
    await page.getByRole('radio', { name: 'je Tag' }).click();
    await expect(zahlen(page)).toHaveText(['0', '0', '1']);
  } finally { await k.stoppen(); }
});

for (const breite of [320, 375, 414]) {
  test(`R00254 B1354 (US-8, AK 8): ${breite} px — kein Querscrollen, die Zahlen so groß wie die Achsenbeschriftung`, async ({ page }) => {
    const k = await kanbanStarten(rechenbeispiel());
    try {
      await berichtAm0411(page, k);
      await page.getByRole('radio', { name: 'je Tag' }).click();
      await breiteSetzen(page, breite);
      await expect(zahlen(page)).toHaveCount(6);
      expect(await zahlen(page).first().evaluate(n => getComputedStyle(n).fontSize)).toBe('11px');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'kein Querscrollen').toBeLessThanOrEqual(0);
      await bildAblegen(page, `durchsatz-zahlen-${breite}.png`);
    } finally { await k.stoppen(); }
  });
}
