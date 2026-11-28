// R00270 Review-Seite — die Fensterregel `.dz` des Fensters „Defekte Dateien“ trifft nicht mehr die Diff-Tabelle (Karte #274, I0260, aus
// #260/R00249). AK 1 (Diff-Tabelle bei „Nebeneinander“ aus) und AK 2 (Fenster unverändert) im echten Programm; AK 3 (Mutanten m1/m2) und
// AK 4 (Bestand) sind Mutantenlauf bzw. Gate, kein Testkörper dieses Specs. Ausgangslage: review-hilfen.js (`nebeneinanderRepository`: N1
// mit K-Lauf/K-Datei/K-Lang/K-Zwei); die defekte Datei wie in `r00025-defekt.spec.js`. Schichten: Testfälle → Testsprache (`seite`) →
// Treiber (Selektoren, Adressen, Messungen nur hier) → Programm. Der Höhenvergleich steht auf einem kleinen Block (`src/ende.rs`, 6 Zeilen)
// und misst gegen die Summe der Zeilenhöhen: die Schätzung `contain-intrinsic-block-size:auto n×18px` (`web/diff.js:405`) kennt die 13 px
// der Fensterregel (6 px oben + 6 px unten + 1 px Unterlinie) nicht, und Hunk-/Kontextzeilen sind höher als 18 px — „±1 je Zeile“ wäre blind.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, breiteSetzen, thema, mutanteEinsetzen } = require('./hilfen');
const { nebeneinanderRepository, nebeneinanderVorbereiten } = require('./review-hilfen');

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const N = () => nebeneinanderRepository();
/** Der kleine Block (6 Zeilen) der ersten Datei `src/ende.rs`; die Höhe dieses Blocks zeigt die 13 px der Fensterregel. */
const KLEINER_BLOCK = 'src/ende.rs';
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));

function seite(page) {
  const eingabe = page.locator('#rv-kopf #rv-nb');
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const bereich = pfad => datei(pfad).locator('.df-sc');
  /** Die sichtbare Fensterzeile des Fensters „Defekte Dateien“: erster Kindknoten `div` von `#pop` ohne Kopf/Fuß — vor und nach dem
      Umbenennen `.dz` → `.pop-dz` gefunden, damit die Probe die Werte vor der Karte festhalten kann (AK 2). */
  const fensterzeile = () => page.locator('#pop > div').filter({ has: page.locator('a.mono') });
  return {
    eingabe, datei, bereich, fensterzeile,
    commitOeffnen: async (k, nr, commit) => {
      await page.goto(commitAdresse(k, nr, commit));
      await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    },
    block: pfad => bereich(pfad).locator('.dz-b').first(),
  };
}

/** Maße des im Bild stehenden Blocks: berechneter Stil der Tabelle, Blockhöhe, Summe der Zeilenhöhen und der `elementFromPoint`-Treffer
    in der Mitte des Blocks. `imBild` belegt, dass der Block nicht ausgelassen (`content-visibility:auto`) und darum wirklich gezeichnet ist. */
const blockMasse = block => block.evaluate(b => {
  const tab = b.querySelector('table.dz');
  const st = getComputedStyle(tab);
  const zeilen = Array.from(b.querySelectorAll('table tr'));
  const r = b.getBoundingClientRect(), q = document.getElementById('review').getBoundingClientRect();
  const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return {
    display: st.display, paddingBlockStart: st.paddingBlockStart, paddingInlineStart: st.paddingInlineStart,
    hoehe: b.offsetHeight, zeilen: zeilen.length,
    zeilenSumme: zeilen.reduce((n, z) => n + z.offsetHeight, 0),
    imBild: r.top >= q.top && r.bottom <= q.bottom,
    mittentreffer: treffer ? treffer.tagName + (treffer.className ? '.' + treffer.className : '') : null,
    trifftZeile: !!(treffer && treffer.closest('tr')),
    trifftTabelle: !!(treffer && treffer.closest('table.dz') === tab),
  };
});

/** Die berechneten Stile der Fensterzeile, ihres Fehlertextes `<span>` und des Pfadverweises `<a class="mono">` (AK 2). */
const fensterMasse = zeile => zeile.evaluate(z => {
  const st = getComputedStyle(z);
  const kurz = e => { const c = getComputedStyle(e); return { color: c.color, fontSize: c.fontSize, fontFamily: c.fontFamily }; };
  const link = z.querySelector('a.mono'), span = z.querySelector('span');
  return {
    display: st.display, flexDirection: st.flexDirection, gap: st.gap,
    paddingBlockStart: st.paddingBlockStart, paddingBlockEnd: st.paddingBlockEnd,
    paddingInlineStart: st.paddingInlineStart, paddingInlineEnd: st.paddingInlineEnd,
    borderBottomWidth: st.borderBottomWidth, borderBottomStyle: st.borderBottomStyle, borderBottomColor: st.borderBottomColor,
    fontSize: st.fontSize, fontFamily: st.fontFamily, lineHeight: st.lineHeight,
    span: kurz(span), link: kurz(link), href: link.getAttribute('href'), zeilenText: [...z.childNodes].map(n => n.textContent).join(''),
  };
});

/** Die Werte der Fensterzeile vor der Karte (`main`, Stand der Kaskade aus `web/kd-app.css:792` + `:1606` + `web/kd-tokens.css`). */
const VORHER = {
  light: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingBlockStart: '6px', paddingBlockEnd: '6px', paddingInlineStart: '12px', paddingInlineEnd: '12px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'oklch(0.87 0.01 250)',
    fontSize: '12px', fontFamily: '"IBM Plex Mono", ui-monospace, monospace', lineHeight: '18px',
    span: { color: 'oklch(0.24 0.02 255)', fontSize: '12px', fontFamily: '"IBM Plex Mono", ui-monospace, monospace' },
    link: { fontSize: '12px', fontFamily: '"IBM Plex Mono", ui-monospace, monospace' },
  },
  dark: {
    display: 'flex', flexDirection: 'column', gap: '2px',
    paddingBlockStart: '6px', paddingBlockEnd: '6px', paddingInlineStart: '12px', paddingInlineEnd: '12px',
    borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'oklch(0.33 0.016 255)',
    fontSize: '12px', fontFamily: '"IBM Plex Mono", ui-monospace, monospace', lineHeight: '18px',
    span: { color: 'oklch(0.92 0.008 250)', fontSize: '12px', fontFamily: '"IBM Plex Mono", ui-monospace, monospace' },
    link: { fontSize: '12px', fontFamily: '"IBM Plex Mono", ui-monospace, monospace' },
  },
};

test.describe('R00270 Review-Seite — Fensterregel `.dz` trifft die Diff-Tabelle', () => {
  let k;
  test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });
  test.afterEach(async () => { if (k) await k.stoppen(); });

  /* ── AK 1 / US-1: die Diff-Tabelle bei „aus“ ist wieder eine Tabelle ── */

  test('AK 1: bei „Nebeneinander“ aus ist `table.dz` eine Tabelle ohne Innenabstand, und die Mitte des kleinen Blocks trifft eine Zeile', async ({ page }) => {
    k = await kanbanStarten(nebeneinanderVorbereiten(N()));
    await alsPerson(page, 'sh');
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await expect(s.eingabe).not.toBeChecked();
    await breiteSetzen(page, 980, 800);

    const block = s.block(KLEINER_BLOCK);
    await block.scrollIntoViewIfNeeded();
    await zweiBilder(page);
    const m = await blockMasse(block);

    expect(m.imBild, `der Block ${KLEINER_BLOCK} steht im Bild (gezeichnet)`).toBe(true);
    expect(m.zeilen, `Zahl der Zeilen im Block ${KLEINER_BLOCK}`).toBe(6);
    expect(m.display, 'die Fensterregel macht die Tabelle nicht mehr zur Flexbox').toBe('table');
    expect(m.paddingBlockStart, 'kein Innenabstand oben').toBe('0px');
    expect(m.paddingInlineStart, 'kein Innenabstand links').toBe('0px');
    // Die Schätzung `n×18` kennt die 13 px der Fensterregel nicht: der Block ist um 13 px höher als seine Zeilen.
    expect(Math.abs(m.hoehe - m.zeilenSumme), `Blockhöhe ${m.hoehe} gleich der Summe der Zeilenhöhen ${m.zeilenSumme} (±2)`).toBeLessThanOrEqual(2);
    // Sichtbare Wirkung: die Mitte des Blocks liegt auf einer Zeile (heute auf dem `tbody` daneben).
    expect(m.trifftZeile, `die Mitte des Blocks trifft eine Zeile (heute ${m.mittentreffer})`).toBe(true);
    expect(m.trifftTabelle, 'der Treffer liegt in derselben Tabelle').toBe(true);
  });

  /* ── AK 2 / US-2: das Fenster „Defekte Dateien“ sieht aus wie vorher ── */

  test('AK 2: die Fensterzeile, ihr Fehlertext und der Pfadverweis tragen in hell und dunkel die Werte von vor der Karte', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '# Entwicklung\n- #1\n## A\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
    await page.locator('#t-defekt').click();
    const s = seite(page);
    await expect(s.fensterzeile()).toHaveCount(1);

    for (const [themaName, beschriftung] of [['light', 'hell'], ['dark', 'dunkel']]) {
      await thema(page, themaName);
      await zweiBilder(page);
      const m = await fensterMasse(s.fensterzeile());
      const soll = VORHER[themaName];
      expect(m, `${beschriftung}: Fensterzeile unverändert`)
        .toMatchObject({ display: soll.display, flexDirection: soll.flexDirection, gap: soll.gap,
          paddingBlockStart: soll.paddingBlockStart, paddingBlockEnd: soll.paddingBlockEnd,
          paddingInlineStart: soll.paddingInlineStart, paddingInlineEnd: soll.paddingInlineEnd,
          borderBottomWidth: soll.borderBottomWidth, borderBottomStyle: soll.borderBottomStyle, borderBottomColor: soll.borderBottomColor,
          fontSize: soll.fontSize, fontFamily: soll.fontFamily, lineHeight: soll.lineHeight });
      expect(m.span.fontSize, `${beschriftung}: Fehlertext Schriftgröße`).toBe(soll.span.fontSize);
      expect(m.span.fontFamily, `${beschriftung}: Fehlertext Monoschrift`).toBe(soll.span.fontFamily);
      expect(m.span.color, `${beschriftung}: Fehlertext Farbe`).toBe(soll.span.color);
      expect(m.link.fontSize, `${beschriftung}: Pfadverweis Schriftgröße`).toBe(soll.link.fontSize);
      expect(m.link.fontFamily, `${beschriftung}: Pfadverweis Monoschrift`).toBe(soll.link.fontFamily);
      expect(m.href, `${beschriftung}: VS-Code-Verweis auf die defekte Datei`).toMatch(/^vscode:\/\/file.*\/boards\/entwicklung\.md$/);
      expect(m.zeilenText).toContain('boards/entwicklung.md');
      expect(m.zeilenText).toContain('steht vor der ersten Spalte');
    }
  });
});
