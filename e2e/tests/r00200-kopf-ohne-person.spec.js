// R00200: Kopfzeile ohne gewählte Person — Leerform von #t-ich in compact (AK 2–5), Umschalter „Personen“ (AK 6).
// Die Breitenprobe ohne Person (AK 1, 7) steht in ziele.spec.js (B0982, Variante von B0406).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, thema, kontrastFarben } = require('./hilfen');
const { perTabErreicht } = require('./ziele-hilfen');

const NICHT_GEWAEHLT = 'nicht gewählt';
const TOUCH = breite => ({ viewport: { width: breite, height: 844 }, isMobile: true, hasTouch: true });

let k;
test.beforeEach(async () => { k = await kanbanStarten(einrichten()); });
test.afterEach(() => k.stoppen());

/** Der Aufbau von #t-ich: Chip, sichtbarer Text ohne versteckte und ausgeblendete Teile, versteckter Text, ausgeblendeter Rest, Attribute, Größe. */
const ichKnopf = page => page.locator('#t-ich').evaluate(knopf => {
  const rahmen = knopf.getBoundingClientRect();
  const sichtbar = [...knopf.childNodes].map(n => n.nodeType === 3 ? n.textContent : (n.matches('.vh, [aria-hidden="true"], .pk') ? '' : n.textContent)).join('').trim();
  const versteckt = knopf.querySelector('.vh');
  return {
    chip: knopf.querySelector('.pk-0') ? knopf.querySelector('.pk-0').textContent : null,
    sichtbar,
    versteckt: versteckt ? versteckt.textContent : null,
    versteckteBreite: versteckt ? versteckt.getBoundingClientRect().width : null,
    pfeil: [...knopf.querySelectorAll('[aria-hidden="true"]')].map(e => e.textContent.trim()),
    titel: knopf.getAttribute('title'),
    ariaLabel: knopf.getAttribute('aria-label'),
    breite: Math.round(rahmen.width), hoehe: Math.round(rahmen.height),
  };
});

for (const farbschema of ['light', 'dark']) {
  test.describe(`Leerform in compact, 320 px, ${farbschema}`, () => {
    test.use(TOUCH(320));

    test('AK 2: hohler Chip und ▾, Name nur im versteckten Text, Tooltip, Ziel ab 48 px, Pfeil nicht angesagt', async ({ page }) => {
      await page.goto(k.adresse);
      await thema(page, farbschema);
      await expect(page.locator('#t-ich')).toHaveAccessibleName(NICHT_GEWAEHLT);
      const knopf = await ichKnopf(page);
      expect(knopf.chip, 'hohler Chip .pk-0 ohne Buchstaben').toBe('');
      expect(knopf.sichtbar, 'sonst kein sichtbarer Text').toBe('');
      expect(knopf.versteckt).toBe(NICHT_GEWAEHLT);
      expect(knopf.versteckteBreite, 'der Text ist visuell versteckt').toBeLessThanOrEqual(1);
      expect(knopf.pfeil).toEqual(['▾']);
      expect(knopf.titel).toBe(NICHT_GEWAEHLT);
      expect(knopf.ariaLabel, 'kein aria-label (WCAG 2.5.3: der Name kommt aus dem Inhalt)').toBeNull();
      expect(knopf.breite, 'Ziel breit').toBeGreaterThanOrEqual(48);
      expect(knopf.hoehe, 'Ziel hoch').toBeGreaterThanOrEqual(48);
    });

    test('AK 2 Grenzfall: ein als Person gemerkter Agent gilt als nicht gewählt und zeigt die Leerform', async ({ page }) => {
      await alsPerson(page, 'cl');
      await page.goto(k.adresse);
      await expect(page.locator('#t-ich')).toHaveAccessibleName(NICHT_GEWAEHLT);
      expect((await ichKnopf(page)).chip).toBe('');
    });

    test('AK 4: Chiprand und ▾ stehen gegen den Kopf mindestens 3:1 (WCAG 1.4.11), der Ring in --kd-head-muted', async ({ page }) => {
      await page.goto(k.adresse);
      await thema(page, farbschema);
      await expect(page.locator('#t-ich .pk-0')).toHaveCount(1);
      const farben = await page.evaluate(() => {
        const farbe = text => text.match(/(?:oklch|oklab|rgba?|color)\([^)]*\)/)[0];
        const ring = getComputedStyle(document.querySelector('#t-ich .pk-0')).boxShadow;
        const mass = document.createElement('i');
        mass.style.color = 'var(--kd-head-muted)';
        document.querySelector('header.kz').append(mass);
        const vorgabe = getComputedStyle(mass).color;
        mass.remove();
        return {
          ring: farbe(ring), vorgabe,
          pfeil: getComputedStyle(document.querySelector('#t-ich [aria-hidden="true"]')).color,
          kopf: getComputedStyle(document.querySelector('header.kz')).backgroundColor,
        };
      });
      expect(await kontrastFarben(page, farben.ring, farben.kopf), `Ring ${farben.ring} gegen Kopf`).toBeGreaterThanOrEqual(3);
      expect(await kontrastFarben(page, farben.pfeil, farben.kopf), `▾ ${farben.pfeil} gegen Kopf`).toBeGreaterThanOrEqual(3);
      expect(farben.ring, 'der Ring trägt --kd-head-muted wie .kz-btn.leer').toBe(farben.vorgabe);
    });

    test('AK 5: ein Tipp öffnet „Ich bin …“, nach der Wahl steht das Kürzel da und der Fokus auf #t-ich, ohne Neuladen', async ({ page }) => {
      await page.goto(k.adresse);
      await thema(page, farbschema);
      await page.locator('#t-ich').tap();
      await expect(page.getByRole('menu', { name: 'ICH BIN …' })).toBeVisible();
      await page.getByRole('menuitemradio', { name: /Stefan/ }).tap();
      await expect(page.locator('#t-ich .pk')).toHaveText('ST');
      await expect(page.locator('#t-ich .pk-0'), 'die Leerform ist verschwunden').toHaveCount(0);
      await expect(page.locator('#t-ich .ich-name'), 'der Name steht erst ab large sichtbar').toBeHidden();
      await expect(page.locator('#t-ich')).toBeFocused();
    });

    test('AK 5: bei Tastaturfokus zeigt #t-ich den Kopfring in --kd-head-link, mindestens 3:1', async ({ page }) => {
      await page.goto(k.adresse);
      await thema(page, farbschema);
      expect(await perTabErreicht(page, page.locator('#t-ich')), '#t-ich per Tab erreichbar').toBeGreaterThan(0);
      const ring = await page.locator('#t-ich').evaluate(knopf => {
        const mass = document.createElement('i');
        mass.style.color = 'var(--kd-head-link)';
        document.querySelector('header.kz').append(mass);
        const vorgabe = getComputedStyle(mass).color;
        mass.remove();
        const stil = getComputedStyle(knopf);
        return { farbe: stil.outlineColor, art: stil.outlineStyle, breite: parseFloat(stil.outlineWidth), vorgabe, kopf: getComputedStyle(document.querySelector('header.kz')).backgroundColor };
      });
      expect(ring.art).toBe('solid');
      expect(ring.breite).toBeGreaterThanOrEqual(2);
      expect(ring.farbe, 'Kopfring --kd-head-link').toBe(ring.vorgabe);
      expect(await kontrastFarben(page, ring.farbe, ring.kopf)).toBeGreaterThanOrEqual(3);
    });
  });
}

for (const breite of [600, 1280]) {
  test.describe(`Ab medium unverändert, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 } });

    test('AK 3: ohne Person steht sichtbar „nicht gewählt ▾“, keine Leerform, kein Tooltip', async ({ page }) => {
      await page.goto(k.adresse);
      await expect(page.locator('#t-ich')).toHaveText(`${NICHT_GEWAEHLT} ▾`);
      const knopf = await ichKnopf(page);
      expect(knopf.chip, 'kein hohler Chip').toBeNull();
      expect(knopf.versteckt, 'kein versteckter Text').toBeNull();
      expect(knopf.titel).toBeNull();
      expect(knopf.ariaLabel).toBeNull();
    });

    test('AK 3: mit Person das Kürzel, ab large der Name', async ({ page }) => {
      await alsPerson(page, 'st');
      await page.goto(k.adresse);
      await expect(page.locator('#t-ich .pk')).toHaveText('ST');
      await expect(page.locator('#t-ich .pk-0')).toHaveCount(0);
      if (breite >= 1280) await expect(page.locator('#t-ich')).toContainText('Stefan');
      else await expect(page.locator('#t-ich .ich-name')).toBeHidden();
    });
  });
}

// B0983 (AK 6): Der Umschalter „Personen“ steht je Segment auf einer Zeile — gemessen über die Zeilenrechtecke des Textes,
// nicht über die Höhe (unter Touch ist jedes Segment per min-block-size 48 px hoch, ein- wie zweizeilig).
const segmente = page => page.getByRole('radiogroup', { name: 'Personen', exact: true }).evaluate(gruppe => [...gruppe.children].map(seg => {
  const bereich = document.createRange();
  bereich.selectNodeContents(seg);
  return { text: seg.textContent, zeilen: bereich.getClientRects().length, ariaLabel: seg.getAttribute('aria-label') };
}));

for (const farbschema of ['light', 'dark']) {
  for (const breite of [320, 375, 414]) {
    test.describe(`Umschalter „Personen“, Touch, ${breite} px, ${farbschema}`, () => {
      test.use(TOUCH(breite));

      test('AK 6: kurze Beschriftung „alle · Menschen · Agenten“, jedes Segment einzeilig, die Wahl filtert', async ({ page }) => {
        await alsPerson(page, 'st');
        await page.goto(k.adresse + '#/personen');
        await thema(page, farbschema);
        await page.locator('tr[data-person="st"]').waitFor();
        const liste = await segmente(page);
        expect(liste.map(s => s.text)).toEqual(['alle', 'Menschen', 'Agenten']);
        expect(liste.map(s => s.zeilen), 'Zeilenrechtecke je Segment').toEqual([1, 1, 1]);
        expect(liste.map(s => s.ariaLabel), 'die Segmente tragen kein aria-label').toEqual([null, null, null]);
        await page.getByRole('radio', { name: 'Agenten', exact: true }).tap();
        await expect(page.locator('tr[data-person]')).toHaveCount(1);
        await expect(page.locator('tr[data-person="cl"]')).toHaveCount(1);
      });
    });
  }
}

for (const breite of [600, 1280]) {
  test.describe(`Umschalter „Personen“, ab medium, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 } });
    test('AK 6: lange Beschriftung wie bisher, einzeilig', async ({ page }) => {
      await alsPerson(page, 'st');
      await page.goto(k.adresse + '#/personen');
      await page.locator('tr[data-person="st"]').waitFor();
      const liste = await segmente(page);
      expect(liste.map(s => s.text)).toEqual(['Menschen + Agenten', 'nur Menschen', 'nur Agenten']);
      expect(liste.map(s => s.zeilen)).toEqual([1, 1, 1]);
    });
  });
}
