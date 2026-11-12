// R00135 Hauptknöpfe „Fertig“ und „+ Neue Aufgabe“ geben im Hover Rückmeldung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, ausMehr, thema, kontrastAm, mutanteEinsetzen } = require('./hilfen');

const THEMEN = ['light', 'dark'];
const MASS = 4.5;

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

/** Die Farbe eines Tokens, wie der Browser sie für `color` auflöst. */
async function tokenFarbe(page, token) {
  return page.evaluate(t => {
    const p = document.createElement('p');
    p.style.color = `var(${t})`;
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  }, token);
}

/** Die berechnete Fläche eines Elements. */
const flaeche = ort => ort.evaluate(e => getComputedStyle(e).backgroundColor);

/** Ruhe, Hover und zurück: die Fläche vor, während und nach dem Verweilen des Zeigers. */
async function hoverFlaeche(page, ort) {
  const ruhe = await flaeche(ort);
  await ort.hover();
  const hover = await flaeche(ort);
  await page.mouse.move(0, 0);
  const zurueck = await flaeche(ort);
  return { ruhe, hover, zurueck };
}

test.describe('R00135', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
  });
  test.afterEach(() => k.stoppen());

  for (const themaName of THEMEN) {
    test(`US-1: „+ Neue Aufgabe“ reagiert im Hover (${themaName})`, async ({ page }) => {
      await thema(page, themaName);
      const knopf = page.getByRole('button', { name: '+ Neue Aufgabe' });
      const { ruhe, hover, zurueck } = await hoverFlaeche(page, knopf);
      const ziel = await tokenFarbe(page, '--kd-accent-hover');
      const ruheToken = await tokenFarbe(page, '--kd-accent');
      expect(hover, `Hover-Fläche ${themaName}`).toBe(ziel);
      expect(hover, `Hover weicht von der Ruhefläche ab ${themaName}`).not.toBe(ruhe);
      expect(ruhe, `Ruhe-Fläche ${themaName}`).toBe(ruheToken);
      expect(zurueck, `Zeiger weg ${themaName}`).toBe(ruhe);
      await knopf.hover();
      const kontrast = await kontrastAm(knopf);
      expect(kontrast, `Kontrast ${themaName}`).toBeGreaterThanOrEqual(MASS);
    });

    test(`US-2: „Fertig“ in der Modusleiste reagiert im Hover (${themaName})`, async ({ page }) => {
      await thema(page, themaName);
      await ausMehr(page, 'Spalten einrichten');
      const knopf = page.getByRole('button', { name: 'Fertig' });
      const { ruhe, hover, zurueck } = await hoverFlaeche(page, knopf);
      const ziel = await tokenFarbe(page, '--kd-accent-hover');
      const ruheToken = await tokenFarbe(page, '--kd-accent');
      expect(hover, `Hover-Fläche ${themaName}`).toBe(ziel);
      expect(hover, `Hover weicht von der Ruhefläche ab ${themaName}`).not.toBe(ruhe);
      expect(ruhe, `Ruhe-Fläche ${themaName}`).toBe(ruheToken);
      expect(zurueck, `Zeiger weg ${themaName}`).toBe(ruhe);
      await knopf.hover();
      const kontrast = await kontrastAm(knopf);
      expect(kontrast, `Kontrast ${themaName}`).toBeGreaterThanOrEqual(MASS);
    });
  }
});
