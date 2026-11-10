// R00117 Härtung der Kopfzeile: API-Kopf, Auswahlzeichen, Touch-Maß, Begriffe.
// Trägt die Abnahme-Proben der Karte #17 (US-1..US-4); die API-Kopf-Probe liegt in der Kopfzeilen-Layout-Familie
// (kopfzeile-hilfen.js), die /api nur über die gemeinsame Ansichtenliste kannte.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { kopfzeilePruefen } = require('./kopfzeile-hilfen');

const jetztMinus = min => { const d = new Date(Date.now() - min * 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const aufgabe = (n, zustaendige, timer = '') => [`aufgaben/000${n}-k${n}.md`, `---\nid: ${n}\ntitle: Karte ${n}\nassignees: [${zustaendige.join(', ')}]\n---\n${timer}`];
const lauft = wer => `\`\`\`kanbanD-time\n${jetztMinus(30)} · ... · ${wer}\n\`\`\`\n`;

/** Board „Entwicklung“ mit drei Spalten und drei Karten; #1 mit laufendem Timer, wenn `timer`. */
const gegeben = (arbeit, { timer = true } = {}) => einrichten({
  'kanbanD.md': `---\npeople:\n  st: {name: Stefan, kind: human}\n  mi: {name: Mia, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n---\n`,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n\n## Erledigt\n\n',
  ...Object.fromEntries([aufgabe(1, ['st'], timer ? lauft('st') : ''), aufgabe(2, []), aufgabe(3, ['mi'])]),
});

let k;
const starten = async (page, mehr = {}) => {
  k = await kanbanStarten(gegeben(null, mehr));
  await alsPerson(page, 'st');
  await page.goto(k.adresse);
  await expect(page.locator('.ka')).toHaveCount(3);
};
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/* ── US-1: Kopf der API-Seite in einer Zeile (Punkt 1, Regression) ── */

test('US-1 (AK 1, 2): /api — Titel und Link in derselben Zeile, Link rechtsbündig, bei 320/375/768/1280 kein Querscrollen', async ({ page }) => {
  k = await kanbanStarten(einrichten());
  try {
    for (const breite of [1280, 768, 375, 320]) {
      await page.setViewportSize({ width: breite, height: 720 });
      await page.goto(k.adresse + 'api');
      const titel = page.locator('header.kz .kz-z1');
      const link = page.locator('header.kz a.kz-btn', { hasText: 'zur Oberfläche' });
      await expect(titel, `${breite} px`).toContainText('kanbanD · API');
      const t = await titel.boundingBox(), l = await link.boundingBox();
      expect(Math.abs(t.y - l.y), `y von Titel und Link bei ${breite} px`).toBeLessThanOrEqual(1);
      const ende = l.x + l.width;
      expect(l.x, `Link links im Fenster bei ${breite} px`).toBeGreaterThanOrEqual(0);
      expect(ende, `Link ganz im Fenster bei ${breite} px`).toBeLessThanOrEqual(breite);
      expect(ende, `Link rechtsbündig bei ${breite} px`).toBeGreaterThanOrEqual(breite - 24);
      const { konflikte } = await kopfzeilePruefen(page);
      expect(konflikte, `Kopfzeilen-Konflikte bei ${breite} px`).toEqual([]);
    }
  } finally { await k.stoppen(); k = null; }
});
