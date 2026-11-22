// R00230 AK 1 (Karte #245, I0220, ADR-0018 N4 Punkt 5): die gemeinsame Zählhilfe `ansagenZaehlen` gegen statische Seiten — je Fall
// eine erwartete Zahl von Einträgen {ort, text}. Dazu S3 der UX-Vorprüfung: Live-Elemente ohne `id` heißen nach dem nächsten Vorfahren.
const { test, expect } = require('@playwright/test');
const { ansagenZaehlen } = require('./hilfen');

const SEITE = `<main id="haupt">
  <p id="region" aria-live="polite"></p>
  <p id="voll" aria-live="polite">steht</p>
  <div id="status" role="status"><span id="teil">alt</span></div>
  <section id="ablage"></section>
</main>`;

/** Ändert die Seite im Browser und liefert danach die Einträge seit Fensterbeginn. */
async function nach(page, zaehler, aendern) {
  await page.evaluate(aendern);
  return zaehler.eintraege();
}

test.describe('R00230 AK 1 Zählhilfe ansagenZaehlen', () => {
  let zaehler;
  test.beforeEach(async ({ page }) => {
    await page.setContent(SEITE);
    zaehler = await ansagenZaehlen(page);
  });

  test('AK 1: leere Region aria-live bekommt den Text „A“ → 1 Eintrag mit Ort und Text', async ({ page }) => {
    expect(await nach(page, zaehler, () => { document.getElementById('region').textContent = 'A'; })).toEqual([{ ort: '#region', text: 'A' }]);
  });

  test('AK 1: <div role="alert">B</div> eingehängt → 1 Eintrag', async ({ page }) => {
    const eintraege = await nach(page, zaehler, () => { document.getElementById('ablage').insertAdjacentHTML('beforeend', '<div id="b" role="alert">B</div>'); });
    expect(eintraege).toEqual([{ ort: '#b', text: 'B' }]);
  });

  test('AK 1: Region geleert → 0 Einträge', async ({ page }) => {
    expect(await nach(page, zaehler, () => { document.getElementById('voll').textContent = ''; })).toEqual([]);
  });

  test('AK 1: aus einer Region wird nur etwas entfernt, Text bleibt stehen → 0 Einträge (Entfernen ist keine Ansage, aria-relevant)', async ({ page }) => {
    expect(await nach(page, zaehler, () => { document.getElementById('status').insertAdjacentHTML('beforeend', '<span id="weg"> mehr</span>'); })).toHaveLength(1);
    await zaehler.beginnen();
    expect(await nach(page, zaehler, () => { document.getElementById('weg').remove(); })).toEqual([]);
  });

  test('AK 1: leeres Live-Element eingehängt → 0 Einträge', async ({ page }) => {
    expect(await nach(page, zaehler, () => { document.getElementById('ablage').insertAdjacentHTML('beforeend', '<p role="status"></p><div aria-live="assertive"> </div>'); })).toEqual([]);
  });

  test('AK 1: derselbe Knoten mit unverändertem Text aus- und wieder eingesetzt (Halter in render()) → 0 Einträge', async ({ page }) => {
    const eintraege = await nach(page, zaehler, () => {
      const vorher = document.getElementById('voll');
      const haupt = document.getElementById('haupt');
      haupt.innerHTML = '<p id="voll" aria-live="polite">steht</p><section id="ablage"></section>';
      document.getElementById('voll').replaceWith(vorher);
    });
    expect(eintraege).toEqual([]);
  });

  test('AK 1: Gegenprobe zum Halter — derselbe Knoten kehrt mit neuem Text zurück → 1 Eintrag', async ({ page }) => {
    const eintraege = await nach(page, zaehler, () => {
      const vorher = document.getElementById('voll');
      document.getElementById('haupt').innerHTML = '<p id="voll" aria-live="polite">neu</p>';
      document.getElementById('voll').replaceWith(vorher);
      vorher.textContent = 'neu';
    });
    expect(eintraege).toEqual([{ ort: '#voll', text: 'neu' }]);
  });

  test('AK 1: Text in einem <span> innerhalb von role="status" geändert → 1 Eintrag am Ort der Region', async ({ page }) => {
    expect(await nach(page, zaehler, () => { document.getElementById('teil').firstChild.data = 'neu'; })).toEqual([{ ort: '#status', text: 'neu' }]);
  });

  test('AK 1: Meldung ohne Live-Rolle mit Text eingehängt → 0 Einträge', async ({ page }) => {
    expect(await nach(page, zaehler, () => { document.getElementById('ablage').insertAdjacentHTML('beforeend', '<div class="rv-abs-f"><p>Fehler</p></div>'); })).toEqual([]);
  });

  test('AK 1: Fensterbeginn neu gesetzt — frühere Einträge zählen nicht mehr, spätere schon', async ({ page }) => {
    await page.evaluate(() => { document.getElementById('region').textContent = 'vorher'; });
    expect(await zaehler.eintraege()).toHaveLength(1);
    await zaehler.beginnen();
    expect(await zaehler.eintraege()).toEqual([]);
    expect(await nach(page, zaehler, () => { document.getElementById('region').textContent = 'nachher'; })).toEqual([{ ort: '#region', text: 'nachher' }]);
  });

  test('AK 1 (S3): zwei Live-Elemente ohne id heißen nach dem nächsten Vorfahren mit id und unterscheiden sich', async ({ page }) => {
    const eintraege = await nach(page, zaehler, () => {
      document.getElementById('ablage').insertAdjacentHTML('beforeend', '<p class="zust" role="status">eins</p><p class="zust" role="status">zwei</p>');
    });
    expect(eintraege.map(e => e.text)).toEqual(['eins', 'zwei']);
    expect(eintraege[0].ort).toMatch(/^#ablage /);
    expect(eintraege[1].ort).toMatch(/^#ablage /);
    expect(eintraege[0].ort).toContain('zust');
    expect(eintraege[0].ort).not.toBe(eintraege[1].ort);
  });

  test('AK 1: Zählhilfe vor dem Laden eingesetzt — eine schon beim Aufbau befüllte Region zählt einmal', async ({ page }) => {
    await page.goto('data:text/html,<main id="m"></main><script>document.getElementById("m").innerHTML = \'<p id="z" role="status">beim Aufbau</p>\'</script>');
    expect(await zaehler.eintraege()).toEqual([{ ort: '#z', text: 'beim Aufbau' }]);
  });
});
