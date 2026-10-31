// R00101 Kopfzeile auf jeder Breite bedienbar
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { wbsText, zeile, arbeitsRepository } = require('./wbs-hilfen');

const BREITEN = [375, 414, 600, 768, 900, 1024, 1100, 1280, 1366, 1440];

const jetztMinus = min => { const d = new Date(Date.now() - min * 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const aufgabe = (n, zustaendige, timer = '') => [`aufgaben/000${n}-k${n}.md`, `---\nid: ${n}\ntitle: Karte ${n}\nassignees: [${zustaendige.join(', ')}]\n---\n${timer}`];
const lauft = wer => `\`\`\`kanbanD-time\n${jetztMinus(30)} · ... · ${wer}\n\`\`\`\n`;

/** Gegeben aus R00101: drei Spalten, fünf Karten, EM bei #1, #2 (mit Agent) und #4, drei Timer laufen; WBS gebunden. */
const gegeben = arbeit => einrichten({
  'kanbanD.md': `---\npeople:\n  em: {name: Erika Mustermann, kind: human}\n  mi: {name: Mia, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}\n---\n`,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n- #4\n\n## Erledigt\n\n- #5\n',
  ...Object.fromEntries([
    aufgabe(1, ['em'], lauft('em')),
    aufgabe(2, ['em', 'cl'], lauft('cl')),
    aufgabe(3, []),
    aufgabe(4, ['em'], lauft('mi')),
    aufgabe(5, []),
  ]),
});

let k, arbeit;
async function starten(page, { ich = 'em' } = {}) {
  arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
  k = await kanbanStarten(gegeben(arbeit));
  if (ich) await alsPerson(page, ich);
  await page.goto(k.adresse);
  await expect(page.locator('.ka')).toHaveCount(5);
}
test.afterEach(async () => { if (k) await k.stoppen(); if (arbeit) arbeit.aufraeumen(); });

const kopf = page => page.locator('header.kz');

test('Stufe nach M3 an den Grenzen, auch nach einem Wechsel der Fensterbreite', async ({ page }) => {
  await starten(page);
  for (const [breite, stufe] of [[599, 'compact'], [600, 'medium'], [839, 'medium'], [840, 'expanded'], [1199, 'expanded'], [1200, 'large'], [320, 'compact']]) {
    await page.setViewportSize({ width: breite, height: 800 });
    await expect(kopf(page), `${breite} px`).toHaveAttribute('data-stufe', stufe);
  }
});
