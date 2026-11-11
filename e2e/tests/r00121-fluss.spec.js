// R00121 Kumulativer Fluss (CFD)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, filterOeffnen, liveBereit } = require('./hilfen');

function commitAm(ordner, datum, inhalt) {
  fs.writeFileSync(ordner + '/boards/fabrik.md', inhalt);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

const FILTER = '---\nreport-filter: {period: eigen, from: 2026-11-01, to: 2026-11-05}\n---\n';
const AUFGABEN = {
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n',
};

/** Grundbestand der AK: Board „fabrik“ (Eingang/In Arbeit/Fertig), Bewegungen 01.11.–05.11.2026; #2 verlässt am 05.11.
    `filter` ist der `report-filter` der Board-Datei („“ für den offenen Zeitraum, z. B. in der Live-Probe). */
function grundbestand(ordner, filter = FILTER) {
  const kopf = `${filter}# fabrik\n\n## Eingang\n\n`;
  einrichten({ ...AUFGABEN, 'boards/fabrik.md': `${kopf}\n\n## In Arbeit\n\n## Fertig\n` })(ordner);
  commitAm(ordner, '2026-11-01T09:00:00', `${kopf}- #1\n\n## In Arbeit\n\n## Fertig\n`);
  commitAm(ordner, '2026-11-02T09:00:00', `${kopf}- #2\n\n## In Arbeit\n\n- #1\n\n## Fertig\n`);
  commitAm(ordner, '2026-11-03T09:00:00', `${kopf}- #3\n\n## In Arbeit\n\n- #2\n\n## Fertig\n\n- #1\n`);
  commitAm(ordner, '2026-11-04T09:00:00', `${kopf}- #4\n\n## In Arbeit\n\n- #3\n\n## Fertig\n\n- #2\n- #1\n`);
  commitAm(ordner, '2026-11-05T09:00:00', `${kopf}\n\n## In Arbeit\n\n- #4\n\n## Fertig\n\n- #3\n- #1\n`);
}

const p2 = x => String(x).padStart(2, '0');
const heuteLang = () => { const d = new Date(); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };

const CFD = 'svg.cfd';
const diagramm = page => page.getByRole('img', { name: 'Kumulativer Fluss: Bestand je Spalte je Tag' });

/** y-Wert einer Achsenmarke in Aufgaben (Umkehrung des linearen Maßstabs aus zwei Marken). */
async function skala(page) {
  return page.evaluate(sel => {
    const svg = document.querySelector(sel);
    const marken = [...svg.querySelectorAll('text.achse-y')].map(t => [Number(t.textContent), Number(t.getAttribute('y'))]);
    const [[v0, y0], [v1, y1]] = [marken[0], marken[marken.length - 1]];
    window.__flussWert = y => v0 + (y - y0) * (v1 - v0) / (y1 - y0);
    return { marken: marken.map(m => m[0]), unten: marken[0][1], oben: marken[marken.length - 1][1] };
  }, CFD);
}

/** Tageswerte der Oberkante eines Randes (`path.ang`/`path.fer`), auf ganze Aufgaben gerundet. */
async function randWerte(page, selektor) {
  return page.evaluate(([sel, pfadSel]) => [...document.querySelector(sel).querySelector(pfadSel).getAttribute('d').matchAll(/[ML][\d.]+,([\d.]+)/g)].map(m => Math.round(window.__flussWert(Number(m[1])))), [CFD, selektor]);
}

/** Dicke je Band und Tag, in DOM-Reihenfolge (Board-Reihenfolge); obere Kante vorwärts, untere zurück. */
async function bandWerte(page) {
  return page.evaluate(sel => {
    const svg = document.querySelector(sel);
    return [...svg.querySelectorAll('path.band')].map(p => {
      const y = [...p.getAttribute('d').matchAll(/[ML][\d.]+,([\d.]+)/g)].map(m => Number(m[1]));
      const n = y.length / 2;
      return [...Array(n).keys()].map(i => Math.round(window.__flussWert(y[i]) - window.__flussWert(y[2 * n - 1 - i])));
    });
  }, CFD);
}

test('R00121 B0556: Menüeintrag in VERLAUF, Route, Fenstertitel und Kopfleiste', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
    await page.goto(k.adresse);
    await page.locator('#t-ber').click();
    const menue = page.getByRole('menu', { name: 'Berichte' });
    const namen = await menue.getByRole('menuitem').allInnerTexts();
    const stelle = t => namen.findIndex(x => x.includes(t));
    expect(stelle('Burndown')).toBeLessThan(stelle('Kumulativer Fluss'));
    expect(stelle('Kumulativer Fluss')).toBeLessThan(stelle('Wie lange noch'));
    const eintrag = menue.getByRole('menuitem', { name: /Kumulativer Fluss/ });
    await expect(eintrag.locator('svg.i')).toHaveCount(1);
    await expect(eintrag).toContainText('Bestand je Spalte über die Zeit – gestapelte Bänder aus der Git-Geschichte dieses Boards.');
    await eintrag.click();
    await expect(page).toHaveURL(/#\/berichte\/fluss$/);
    await expect(page).toHaveTitle('Fluss — kanbanD');
    await expect(page.locator('#main .leiste').first()).toContainText('Kumulativer Fluss · liest nur · Bestand je Spalte über die Zeit');
  } finally { await k.stoppen(); }
});

test('R00121 B0557: gestapelte Bänder, Achsen und die beiden kumulierten Ränder', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
    await page.goto(k.adresse + '#/berichte/fluss');
    const svg = diagramm(page);
    await expect(svg).toBeVisible();
    await expect(svg.locator('path.band')).toHaveCount(3);
    const { marken } = await skala(page);
    expect(marken).toEqual([0, 1, 2, 3, 4]); // y-Achse bis max(gesamt, angekommen, fertig) = 4 (AK)
    await expect(svg.locator('text.achse-x')).toHaveCount(5);
    await expect(svg.locator('text.achse-x').first().locator('tspan')).toHaveText(['01.11.', '2026']);
    // Bänder von unten nach oben in Board-Reihenfolge, Dicken je Tag aus den AK
    expect(await bandWerte(page)).toEqual([
      [1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1],
      [0, 0, 1, 2, 2],
    ]);
    expect(await randWerte(page, 'path.ang')).toEqual([1, 2, 3, 4, 4]);
    expect(await randWerte(page, 'path.fer')).toEqual([0, 0, 1, 2, 3]);
    const füllungen = await svg.locator('path.band').evaluateAll(ps => ps.map(p => p.getAttribute('fill')));
    expect(füllungen).toEqual(['var(--kd-c-yellow-line)', 'var(--kd-c-amber-line)', 'var(--kd-c-orange-line)']);
    await expect(svg.locator('text.randtext.a')).toHaveText('angekommen 4');
    await expect(svg.locator('text.randtext.f')).toHaveText('fertig 3');
  } finally { await k.stoppen(); }
});

/** Fährt mit der Maus auf eine Stelle eines Diagramms, angegeben in Koordinaten seiner viewBox. */
async function zeigeAuf(page, svg, x, y) {
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + y * s);
}

test('R00121 B0558: Legende, Tooltip, Tabellenansicht und zugänglicher Name', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
    await page.goto(k.adresse + '#/berichte/fluss');
    const svg = diagramm(page);
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('aria-label', 'Kumulativer Fluss: Bestand je Spalte je Tag');
    // Legende: fünf Einträge (Spalten, dann die Ränder), nicht klickbar, bricht um
    const leg = page.locator('.fluss-leg');
    await expect(leg.locator('.fluss-le')).toHaveCount(5);
    await expect(leg.locator('.fluss-le')).toHaveText([/Eingang/, /In Arbeit/, /Fertig/, /angekommen/, /fertig/]);
    await expect(leg).toHaveCSS('flex-wrap', 'wrap');
    expect(await leg.locator('button, a[href], [role=button]').count()).toBe(0);
    await leg.locator('.fluss-le').first().click();
    await expect(svg).toBeVisible();
    await expect(page.locator('.bf-zusammen')).toContainText('Filter · keine');
    // Tooltip auf dem 04.11. nennt alle Zahlen aus der AK
    await zeigeAuf(page, svg, 521, 150);
    const tip = page.locator('#tooltip');
    await expect(tip).toBeVisible();
    for (const stück of ['04.11.2026', 'Eingang 1', 'In Arbeit 1', 'Fertig 2', 'offen 2', 'gesamt 4', 'angekommen 4', 'fertig 2']) await expect(tip).toContainText(stück);
    await page.mouse.move(1, 1);
    await expect(tip).toBeHidden();
    // Tabellenansicht: th scope=col, je Tag eine Zeile im tastaturerreichbaren .bericht-rahmen
    await page.getByText('Tabellenansicht').click();
    const rahmen = page.locator('.bericht-rahmen');
    await expect(rahmen).toHaveAttribute('tabindex', '0');
    await expect(rahmen).toHaveAttribute('role', 'group');
    const kopf = page.locator('.fluss-tab thead th');
    await expect(kopf).toHaveText(['Tag', 'Eingang', 'In Arbeit', 'Fertig', 'offen', 'gesamt', 'angekommen', 'fertig']);
    await expect(kopf.first()).toHaveAttribute('scope', 'col');
    await expect(page.locator('.fluss-tab tbody tr')).toHaveCount(5);
    await expect(page.locator('.fluss-tab tbody tr').nth(3).locator('td')).toHaveText(['04.11.2026', '1', '1', '2', '2', '4', '4', '2']);
    await rahmen.focus();
    expect(await rahmen.evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await k.stoppen(); }
});

test('R00121 B0559: Leerzustand — Board ohne Bewegung, Rahmen bleibt vorhanden', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/fluss');
    await expect(page.locator('.fluss-leer .fluss-satz')).toHaveText('Noch kein Stand dieses Boards.');
    await expect(page.locator('.bericht-rahmen')).toHaveCount(1);
  } finally { await k.stoppen(); }
});

test('R00121 B0559: Leerzustand — leerer Zeitraum (alle Spalten ausgeschlossen), Rahmen bleibt', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
    await page.goto(k.adresse + '#/berichte/fluss');
    await expect(diagramm(page)).toBeVisible();
    await filterOeffnen(page);
    const filter = page.getByRole('group', { name: 'Berichtsfilter' });
    for (const spalte of ['Eingang', 'In Arbeit', 'Fertig']) await filter.getByRole('button', { name: spalte }).click();
    await expect(page.locator('.fluss-leer .fluss-satz')).toHaveText('Keine Aufgabe im Zeitraum.');
    await expect(diagramm(page)).toHaveCount(0);
    await expect(page.locator('.bericht-rahmen')).toHaveCount(1);
  } finally { await k.stoppen(); }
});

test('R00121 B0559: Live — eine Verschiebung ändert das Band ohne Neuladen', async ({ page }) => {
  const k = await kanbanStarten(ordner => grundbestand(ordner, ''));
  try {
    await alsPerson(page, 'st');
    await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
    await page.goto(k.adresse + '#/berichte/fluss');
    await liveBereit(page);
    await page.getByText('Tabellenansicht').click();
    const letzte = page.locator('.fluss-tab tbody tr').last();
    await expect(letzte.locator('td').first()).toHaveText(heuteLang());
    await expect(letzte.locator('td').nth(1)).toHaveText('0'); // heute: Eingang 0, In Arbeit 1, Fertig 2
    await expect(letzte.locator('td').nth(3)).toHaveText('2');
    await page.request.post(k.adresse + 'api/boards/fabrik/bewegen', { headers: { 'X-KanbanD-Wer': 'st' }, data: { nummer: 1, spalte: 'Eingang', index: 0 } });
    await expect(letzte.locator('td').nth(1)).toHaveText('1', { timeout: 1500 });
    await expect(letzte.locator('td').nth(3)).toHaveText('1', { timeout: 1500 });
  } finally { await k.stoppen(); }
});
