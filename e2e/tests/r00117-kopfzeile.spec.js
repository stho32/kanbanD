// R00117 Härtung der Kopfzeile: API-Kopf, Auswahlzeichen, Touch-Maß, Begriffe.
// Trägt die Abnahme-Proben der Karte #17 (US-1..US-4); die API-Kopf-Probe liegt in der Kopfzeilen-Layout-Familie
// (kopfzeile-hilfen.js), die /api nur über die gemeinsame Ansichtenliste kannte.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, thema } = require('./hilfen');
const { kopfzeilePruefen, auswahlzeichen } = require('./kopfzeile-hilfen');

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

/* ── US-2: Der gewählte Zustand ist zu sehen (Punkt 2) ── */

const ZEICHEN = /[✓☑]/;
const hatZeichen = async loc => { const { pseudo, text } = await auswahlzeichen(loc); return ZEICHEN.test(pseudo) || ZEICHEN.test(text); };

test.describe('US-2 (AK 4, 5, 6): der gewählte Zustand trägt ein sichtbares Zeichen, 375 px hell und dunkel', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  for (const name of ['light', 'dark']) {
    test(`${name}: Chips tragen ✓ nur am gewählten; „Signale oben“ trägt ☑ nur bei aria-checked=true`, async ({ page }) => {
      await starten(page);
      await thema(page, name);
      const kopf = page.locator('header.kz');

      // AK 4/6: genau ein Chip ist gewählt und trägt das Zeichen, die nicht gewählten tragen keines
      await expect(kopf.locator('.kz-chip[role=radio]')).toHaveCount(3);
      const gewaehlt = kopf.locator('.kz-chip[aria-checked="true"]');
      await expect(gewaehlt).toHaveCount(1);
      expect(await hatZeichen(gewaehlt), 'gewählter Chip').toBe(true);
      // das Zeichen ist rein darstellend: der zugängliche Name bleibt die Beschriftung (NFR „aria-checked bleibt die Wahrheit“)
      expect((await auswahlzeichen(gewaehlt)).verborgen, 'Zeichen ist aria-verborgen').toBe(true);
      await expect(kopf.getByRole('radio', { name: 'alle', exact: true })).toHaveCount(1);
      for (const chip of await kopf.locator('.kz-chip[aria-checked="false"]').all()) {
        expect(await hatZeichen(chip), `nicht gewählter Chip „${await chip.innerText()}“`).toBe(false);
        expect((await auswahlzeichen(chip)).pseudo, 'kein ::before-Inhalt am nicht gewählten Chip').toBe('');
      }

      // AK 5: Wechsel „alle“ → „meine“ verschiebt das Zeichen
      await kopf.locator('.kz-chip[data-arg="meine"]').click();
      await expect(kopf.locator('.kz-chip[aria-checked="true"]')).toHaveAttribute('data-arg', 'meine');
      expect(await hatZeichen(kopf.locator('.kz-chip[data-arg="meine"]')), '„meine“ trägt das Zeichen').toBe(true);
      expect(await hatZeichen(kopf.locator('.kz-chip[data-arg="alle"]')), '„alle“ hat es verloren').toBe(false);
      await expect(kopf.getByRole('radio', { name: 'meine', exact: true })).toHaveCount(1);

      // AK 4/5/6: „Signale oben“ ein-/ausschalten lässt nur das Kästchen erscheinen/verschwinden
      await page.locator('#t-mehr').click();
      const signale = page.locator('#pop[role=menu] #signale-oben');
      await expect(signale).toHaveAttribute('aria-checked', 'false');
      expect(await hatZeichen(signale), '„Signale oben“ ohne Kästchen').toBe(false);
      await signale.click();
      await expect(signale).toHaveAttribute('aria-checked', 'true');
      expect(await hatZeichen(signale), '„Signale oben“ mit Kästchen').toBe(true);
      expect((await auswahlzeichen(signale)).verborgen, 'Kästchen ist aria-verborgen').toBe(true);
      await expect(page.getByRole('menuitemcheckbox', { name: 'Signale oben', exact: true })).toHaveCount(1);
      await signale.click();
      await expect(signale).toHaveAttribute('aria-checked', 'false');
      expect(await hatZeichen(signale), '„Signale oben“ wieder ohne Kästchen').toBe(false);
    });
  }
});

/* ── US-3: Bereichs-Umschalter im zentralen Touch-Maß (Punkt 3, Optional) ── */

test.describe('US-3 (AK 7): Bereichs-Umschalter im Touch-Maß, 960 px', () => {
  test.use({ viewport: { width: 960, height: 800 }, isMobile: true, hasTouch: true });

  test('jede Zelle (alle / meine / Agenten) ist mindestens 44 px hoch — der Token --kd-ziel', async ({ page }) => {
    await starten(page);
    const zellen = page.locator('header.kz [role=radio][data-act=bereich]');
    await expect(zellen).toHaveCount(3);
    const mass = await zellen.evaluateAll(ls => ls.map(e => ({ name: e.textContent.trim(), hoehe: Math.round(e.getBoundingClientRect().height) })));
    expect(mass.map(z => z.name)).toEqual(['alle', 'meine', 'Agenten']);
    for (const zelle of mass) expect(zelle.hoehe, `${zelle.name} hoch`).toBeGreaterThanOrEqual(44);
  });
});

/* ── US-4: Einheitliche Begriffe (Punkt 4) ── */

test.describe('US-4 (AK 8, 9): Menüeintrag „Läuft gerade“ mit Zahl, bei 0 Timern weg', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('mit einem laufenden Timer trägt der Eintrag „Läuft gerade“ die Zahl 1', async ({ page }) => {
    await starten(page);
    await page.locator('#t-mehr').click();
    const lauf = page.locator('#pop[role=menu] #mehr-lauf');
    await expect(lauf).toHaveText(/Läuft gerade/);
    await expect(lauf.locator('.muted')).toHaveText('1');
  });

  test('bei 0 laufenden Timern fehlt der Eintrag im Menü „Mehr“', async ({ page }) => {
    await starten(page, { timer: false });
    await page.locator('#t-mehr').click();
    await expect(page.locator('#pop[role=menu]')).toBeVisible();
    await expect(page.locator('#mehr-lauf')).toHaveCount(0);
  });
});
