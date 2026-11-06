// R00108 Zielgrößen 24 px bei feinem Zeiger, 44 px bei Touch (ADR-0012 Regel 6): Messprobe über die Ansichten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');

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
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\nassignees: [mi]\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\narchived: 2026-10-01\n---\n',
});

let k, arbeit;
const starten = async page => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(einrichten(grundbestand(arbeit)));
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
    const knoepfe = fenster.locator('.chk .x, .zt .btn-sym, .anh-z .x');
    await expect(knoepfe.first()).toBeAttached();
    const art = await knoepfe.evaluateAll(liste => liste.map(e => e.closest('.chk, .zt, .anh-z').className.split(' ')[0]));
    expect(new Set(art)).toEqual(new Set(['chk', 'zt', 'anh-z']));
    const deckkraft = await knoepfe.evaluateAll(liste => liste.map(e => getComputedStyle(e).opacity));
    expect(deckkraft.every(wert => wert === '1'), deckkraft.join(' ')).toBe(true);
  });
});
