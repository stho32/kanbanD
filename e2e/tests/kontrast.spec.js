// R00107 Farbrollen in Paaren — Abnahme-Probe der Karte #9: jede Schrift in beiden Themen mindestens 4,5:1
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit, ausMehr, thema, kontrastMessen, kontrastVerstoesse, kontrastAm, kontrastFarben } = require('./hilfen');

const THEMEN = ['light', 'dark'];
const MASS = 4.5;
/** Bekannte Verstöße, die zu einer anderen Karte gehören (nur #50 und #55), je mit Kartennummer: { karte, element, text }. */
const AUSNAHMEN = [];
const MODUS = 'B0393 Modusleiste als Akzent-Container (wartet auf Freigabe des Zustands an D0002)';

const gestern = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
const GRUNDBESTAND = () => ({
  'boards/entwicklung.md': '---\nlimits:\n  In Arbeit: 1\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n- #5\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nclass: bug\nassignees: [st]\ndue: ${gestern()}\n---\n`,
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\nassignees: [cl]\nlabels: [ux, "a:b"]\n---\n```kanbanD-comments\n2026-11-05 09:00 · st · passt\n```\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\nclass: feature\nassignees: [mi, cl]\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n',
  'aufgaben/0005-fuenf.md': '---\nid: 5\ntitle: fünf\nclass: bug\nassignees: [st]\n---\n',
});

/** Alle Ansichten der Anwendung (Ziele von `g`-Kürzeln in tastatur.js); gemessen wird der ganze `body` samt Kopf mit seinem aktiven Segment. */
const ANSICHTEN = ['#/board/', '#/aufgaben', '#/personen', '#/einrichten', '#/wbs/', '#/berichte/stundenzettel', '#/berichte/kreuz', '#/berichte/verlauf',
  '#/berichte/durchlauf', '#/berichte/prognose', '#/berichte/fieber', '#/berichte/kosten', '#/berichte/bestand'];
/**
 * Ausdrücklich nicht gemessen: gedimmte Zustände über `opacity`, die nicht `aria-disabled` sind und heute unter 4,5 messen.
 * Die Gestaltung ist offen (Befund an den Director aus der UX-Nacharbeit); der Test „Nicht gemessen“ hält die Liste ehrlich.
 */
const NICHT_GEMESSEN = [
  { selektor: '.pt tr.ruhe .pk', ansicht: '#/personen', grund: 'Initialen ruhender Personen, opacity .55' },
  { selektor: '.pk-still', ansicht: '#/einrichten', grund: 'Initiale stillgelegter Person, opacity .5' },
];

const ausgenommen = v => AUSNAHMEN.some(a => a.element === v.element && a.text === v.text);
const lesbar = v => `${v.thema} ${v.bereich} ${v.element} „${v.text}“ ${v.wert.toFixed(3).replace('.', ',')}`;

/** Wartet, bis keine CSS-Transition mehr läuft (der Themenwechsel startet Farbübergänge von .1 s): gemessen wird der ruhende Zustand; angehaltene laufen nie zu Ende und zählen nicht. */
async function farbuebergaengeAbwarten(page) {
  await page.waitForFunction(() => document.getAnimations().filter(a => a instanceof CSSTransition).every(a => a.playState !== 'running'));
}

/** Misst die Bereiche je Thema, legt alle Messungen ins Testprotokoll und liefert die Verstöße außerhalb der Ausnahmeliste. */
async function verstoesseInBeidenThemen(page, bereiche, vorher = async () => {}, ohne = []) {
  const alle = [];
  for (const t of THEMEN) {
    await thema(page, t);
    await vorher();
    await farbuebergaengeAbwarten(page);
    const messungen = (await kontrastMessen(page, bereiche, ohne)).map(m => ({ thema: t, ...m }));
    await test.info().attach(`Messungen ${t}`, { body: messungen.map(lesbar).join('\n'), contentType: 'text/plain' });
    alle.push(...messungen);
  }
  expect(alle.length, 'die Probe hat Schrift gefunden').toBeGreaterThan(0);
  return alle.filter(m => m.wert < MASS && !ausgenommen(m)).map(lesbar);
}

test.describe('R00107 Kontrast', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await expect(page.locator('.ka')).toHaveCount(5);
  });
  test.afterEach(() => k.stoppen());

  test('Grenzwert: transparent über Weiß misst 21:1, das heutige faint auf bg 3,29 wird gemeldet', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-weiss" style="background:#fff"><span style="color:#000;background:rgba(0,0,0,0)">schwarz</span></div>' +
      '<div id="probe-faint" style="background:var(--kd-bg)"><span style="color:oklch(0.62 0.014 255)">blass</span></div>'));
    const [weiss] = await kontrastMessen(page, ['#probe-weiss']);
    expect(weiss.wert).toBeCloseTo(21, 1);
    const gemeldet = await kontrastVerstoesse(page, ['#probe-weiss', '#probe-faint']);
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0]).toMatchObject({ bereich: '#probe-faint', element: 'span', text: 'blass' });
    expect(gemeldet[0].wert).toBeCloseTo(3.29, 1);
  });

  test('Grenzwert: knapp unter 4,5 (ungerundet 4,4967) ist ein Verstoß, auch wenn die Anzeige 4,50 ergäbe', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-knapp" style="background:#fff"><span style="color:rgb(117,118,130)">x</span></div>'));
    const gemeldet = await kontrastVerstoesse(page, ['#probe-knapp'], 4.5);
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0].wert).toBeGreaterThan(4.49);
    expect(gemeldet[0].wert).toBeLessThan(4.5);
  });

  test('Opazität: die eigene und die der Vorfahren wird mitgemalt, als Gruppe über dem Grund darunter; unsichtbar (0) zählt nicht', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-eigen" style="background:#fff"><span style="color:#000;opacity:.5">eigen</span></div>' +
      '<div id="probe-vorfahr" style="background:#fff"><div style="opacity:.5"><span style="color:#000">vorfahr</span></div></div>' +
      '<div id="probe-gruppe" style="background:#fff"><div style="background:#000;opacity:.5"><span style="color:#fff">gruppe</span></div></div>' +
      '<div id="probe-weg" style="background:#fff"><span style="color:#000;opacity:0">weg</span></div>'));
    // halb deckend gemalt landet je nach 8-bit-Rundung des Canvas zwischen Grau 126 und 128, also bei 3,95 bis 4,06 statt 21
    const halbGrau = await kontrastFarben(page, 'rgb(127,127,127)', '#fff');
    for (const bereich of ['#probe-eigen', '#probe-vorfahr', '#probe-gruppe']) {
      const [m] = await kontrastMessen(page, [bereich]);
      expect(Math.abs(m.wert - halbGrau), `${bereich} misst ${m.wert}`).toBeLessThan(0.1);
    }
    expect(await kontrastMessen(page, ['#probe-weg'])).toEqual([]);
  });

  test('Bis Zeigen oder Fokus unsichtbar (opacity:0, sichtbar bei :focus) wird im fokussierten Zustand gemessen; Fokus wird zurückgegeben', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => {
      document.head.insertAdjacentHTML('beforeend', '<style>#probe-zeile button{opacity:0;color:#bbb;background:none;border:0}#probe-zeile button:focus{opacity:1}</style>');
      document.body.insertAdjacentHTML('beforeend', '<input id="probe-vorher"><div id="probe-zeile" style="background:#fff"><button>×</button><span style="opacity:0">weg</span></div>');
      document.querySelector('#probe-vorher').focus();
    });
    const messungen = await kontrastMessen(page, ['#probe-zeile']);
    expect(messungen.map(m => m.text)).toEqual(['×']);
    expect(messungen[0].wert).toBeLessThan(MASS);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('probe-vorher');
  });

  test('Warten auf ruhenden Zustand: eine angehaltene Transition lässt das Warten nicht hängen', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-angehalten" style="background:var(--kd-surface)"><span style="color:var(--kd-text);transition:color 60s linear">steht</span></div>'));
    await thema(page, 'dark');
    await page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSTransition).forEach(a => a.pause()));
    const beginn = Date.now();
    await farbuebergaengeAbwarten(page);
    expect(Date.now() - beginn).toBeLessThan(2000);
  });

  test('Warten auf ruhenden Zustand: nach dem Themenwechsel läuft ein Farbübergang, gemessen wird erst nach seinem Ende', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-uebergang" style="background:var(--kd-surface)"><span style="color:var(--kd-text);transition:color 2s linear">gleitet</span></div>'));
    const laufende = () => page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSTransition && a.playState === 'running').length);
    await thema(page, 'dark');
    expect(await laufende()).toBeGreaterThan(0);
    await farbuebergaengeAbwarten(page);
    expect(await laufende()).toBe(0);
    const [m] = await kontrastMessen(page, ['#probe-uebergang']);
    expect(m.wert).toBeGreaterThanOrEqual(MASS);
  });

  test('Ungültige Farbe ist ein Fehler mit dem Wert, nicht still Schwarz', async ({ page }) => {
    await expect(kontrastFarben(page, 'keine-farbe', '#fff')).rejects.toThrow(/keine Farbe: keine-farbe/);
  });

  test('US-1: Board mit Legende und leerer Spalte, beide Themen', async ({ page }) => {
    await expect(page.locator('.bahn[data-col="Erledigt"] .leer')).toHaveText('leer');
    await expect(page.locator('.leg')).toContainText('Klick filtert');
    const verstoesse = await verstoesseInBeidenThemen(page, ['header', '.ka', '.bahn-kopf', '.leg', '.leer']);
    expect(verstoesse).toEqual([]);
  });

  test('US-1: die Initialen tragen die On-Farbe ihrer Fläche, im Dunkelthema dunkel', async ({ page }) => {
    const farben = () => page.evaluate(() => {
      const probe = wert => { const p = document.createElement('p'); p.style.color = wert; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
      const schrift = sel => getComputedStyle(document.querySelector(sel)).color;
      return { mensch: schrift('.ka .pk-m'), agent: schrift('.ka .pk-a'), onMensch: probe('var(--kd-on-mensch)'), onAgent: probe('var(--kd-on-agent)') };
    });
    for (const t of THEMEN) {
      await thema(page, t);
      const f = await farben();
      expect(f.mensch, t).toBe(f.onMensch);
      expect(f.agent, t).toBe(f.onAgent);
    }
    expect((await farben()).mensch, 'dunkle Schrift auf den Initialen im Dunkelthema').not.toBe('oklch(1 0 0)');
  });

  test('US-2: Spaltenkopf über der Grenze und Warnungs-Toast mit „!“, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('#pruef-warnung')).toContainText('Grenze erreicht');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf')).toContainText('überschritten');
    const verstoesse = await verstoesseInBeidenThemen(page, ['.bahn-kopf', '.toast']);
    expect(verstoesse).toEqual([]);
    const ausruf = (await kontrastMessen(page, ['#pruef-warnung'])).find(m => m.text === '!');
    expect(ausruf, 'das „!“ wird gemessen').toBeDefined();
  });

  test('US-3: Aufgabenfenster #2 mit Kommentar, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="2"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
    await expect(page.locator('.km .mono')).toContainText('Stefan');
    const verstoesse = await verstoesseInBeidenThemen(page, ['[role=dialog]']);
    expect(verstoesse).toEqual([]);
  });

  test.fixme(`US-4: Modusleiste, beide Themen — ${MODUS}`, async ({ page }) => {
    await ausMehr(page, 'Spalten einrichten');
    await expect(page.locator('header.kz.modus')).toBeVisible();
    expect(await verstoesseInBeidenThemen(page, ['header'])).toEqual([]);
  });

  test.fixme(`US-4: Modusleiste mit Fehler nach 409, beide Themen — ${MODUS}`, async ({ page }) => {
    await page.route('**/api/boards/entwicklung/spalten', route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ fehler: 'Die Board-Datei wurde inzwischen geändert.' }) })
      : route.continue());
    await ausMehr(page, 'Spalten einrichten');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.fehl-kopf')).toBeVisible();
    expect(await verstoesseInBeidenThemen(page, ['header'])).toEqual([]);
  });

  test('US-5: Toast mit „rückgängig“ nach dem Ziehen, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="2"]').dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'));
    const toast = page.locator('.toast');
    await expect(toast).toContainText('#2 nach „Erledigt“');
    await expect(toast.getByRole('button', { name: 'rückgängig' })).toBeVisible();
    const verstoesse = await verstoesseInBeidenThemen(page, ['.toast']);
    expect(verstoesse).toEqual([]);
  });

  test('US-7: im Ich-Menü zählt Inaktives nicht, Stefan und Mia sind lesbar', async ({ page }) => {
    await page.locator('#t-ich').click();
    const menue = page.locator('#pop[data-for="t-ich"]');
    await expect(menue.locator('[aria-disabled="true"]')).toHaveCount(2);
    for (const t of THEMEN) {
      await thema(page, t);
      const messungen = await kontrastMessen(page, ['#pop']);
      const texte = messungen.map(m => m.text);
      expect(texte, t).not.toContain('Claude');
      expect(texte, t).not.toContain('Anna');
      for (const name of ['Stefan', 'Mia']) {
        const m = messungen.find(x => x.text === name);
        expect(m, `${t}: ${name} gemessen`).toBeDefined();
        expect(m.wert, `${t}: ${name}`).toBeGreaterThanOrEqual(MASS);
      }
    }
  });

  test('US-8: Menü „Mehr“, beide Themen; in der Stufe compact mit „Ich bin … Stefan“', async ({ page }) => {
    await page.locator('#t-mehr').click();
    await expect(page.locator('#pop[aria-label="Mehr"]')).toBeVisible();
    expect(await verstoesseInBeidenThemen(page, ['[role=menu]'])).toEqual([]);
    await page.keyboard.press('Escape');
    // „Ich bin …“ steht erst in der Stufe compact im Menü (R00101)
    await page.setViewportSize({ width: 375, height: 800 });
    await page.locator('#t-mehr').click();
    await expect(page.locator('#mehr-ich .muted')).toHaveText('Stefan');
    expect(await verstoesseInBeidenThemen(page, ['[role=menu]'])).toEqual([]);
    const zusatz = (await kontrastMessen(page, ['[role=menu]'])).find(m => m.element === 'span.muted' && m.text === 'Stefan');
    expect(zusatz, 'der Zusatz „Stefan“ wird gemessen').toBeDefined();
  });

  test('US-8: Menü „Berichte“ mit Gruppenköpfen, beide Themen', async ({ page }) => {
    await page.locator('#t-ber').click();
    await expect(page.locator('#pop.menue .k')).toHaveText(['ZEITEN', 'VERLAUF', 'BESTAND', 'AUSLEITEN']);
    const verstoesse = await verstoesseInBeidenThemen(page, ['[role=menu]']);
    expect(verstoesse).toEqual([]);
  });

  test('US-8: Kontextmenü von #1 mit Untermenü Klasse, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Klasse/ }).click();
    await expect(page.locator('.kmenue.unter')).toBeVisible();
    await expect(page.locator('.kmenue.unter .km-aktuell')).toHaveAttribute('aria-disabled', 'true');
    const verstoesse = await verstoesseInBeidenThemen(page, ['[role=menu]']);
    expect(verstoesse).toEqual([]);
    const kuerzel = (await kontrastMessen(page, ['[role=menu]'])).filter(m => m.element.includes('.km-k'));
    expect(kuerzel.length, 'Tastenkürzel werden gemessen').toBeGreaterThan(0);
  });

  test('US-9: Platzhalter im Titelfeld von „Neue Aufgabe“, beide Themen', async ({ page }) => {
    await page.keyboard.press('n');
    const titel = page.locator('.mod.neu .titel');
    await expect(titel).toBeVisible();
    await expect(titel).toHaveValue('');
    const verstoesse = await verstoesseInBeidenThemen(page, ['.mod.neu']);
    expect(verstoesse).toEqual([]);
    const platzhalter = (await kontrastMessen(page, ['.mod.neu'])).filter(m => m.element.endsWith('::placeholder'));
    expect(platzhalter.length, 'der Platzhalter wird gemessen').toBeGreaterThan(0);
  });

  test('US-1 Liste: Zahl im aktiven Segment des Kopfs („alle 5“) ist lesbar, beide Themen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    const zahl = page.locator('.kz .seg span.an span.mono');
    await expect(zahl).toHaveText('5');
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      expect(await kontrastAm(zahl), t).toBeGreaterThanOrEqual(MASS);
    }
  });

  test('Ansichten: jede Ansicht samt Kopf, beide Themen, ohne die ausdrücklich nicht gemessenen Zustände', async ({ page }) => {
    for (const ansicht of ANSICHTEN) {
      await page.goto(k.adresse + ansicht);
      await liveBereit(page);
      const verstoesse = await verstoesseInBeidenThemen(page, ['body'], async () => {}, NICHT_GEMESSEN.map(n => n.selektor));
      expect(verstoesse, ansicht).toEqual([]);
    }
  });

  test('Nicht gemessen: jeder Eintrag kommt in seiner Ansicht vor und misst heute unter 4,5', async ({ page }) => {
    for (const n of NICHT_GEMESSEN) {
      await page.goto(k.adresse + n.ansicht);
      await liveBereit(page);
      const ort = page.locator(n.selektor).first();
      await expect(ort, n.selektor).toBeVisible();
      expect(await kontrastAm(ort), `${n.selektor}: ${n.grund}`).toBeLessThan(MASS);
    }
  });

  test('Ausnahmeliste: leer, jeder Eintrag mit Kartennummer #50 oder #55', () => {
    for (const a of AUSNAHMEN) expect(['#50', '#55']).toContain(a.karte);
    expect(AUSNAHMEN).toEqual([]);
  });
});

test.describe('R00107 Wie lange noch', () => {
  let k;
  test.afterEach(() => k.stoppen());

  const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00:00`; };
  const board = (zu, arbeit, pruefen, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${zu.map(n => `- #${n}\n`).join('')}\n## In Arbeit\n\n${arbeit.map(n => `- #${n}\n`).join('')}\n## Prüfen\n\n${pruefen.map(n => `- #${n}\n`).join('')}\n## Erledigt\n\n${fertig.map(n => `- #${n}\n`).join('')}`;
  function commitAm(ordner, datum, text) {
    fs.writeFileSync(ordner + '/boards/entwicklung.md', text);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
  }

  test('dunkel: Blöcke mit 3, 1 und 0 von 3 lesbar, Grund über --anteil statt Farbton', async ({ page }) => {
    k = await kanbanStarten(async ordner => {
      const dateien = {};
      for (let n = 1; n <= 3; n++) dateien[`aufgaben/000${n}-a${n}.md`] = `---\nid: ${n}\ntitle: a${n}\n---\n`;
      einrichten(dateien)(ordner);
      commitAm(ordner, vorTagen(4), board([1, 2, 3], [], [], []));
      commitAm(ordner, vorTagen(3), board([2, 3], [1], [], []));
      commitAm(ordner, vorTagen(2), board([3], [2], [1], []));
      commitAm(ordner, vorTagen(1), board([], [2, 3], [1], []));
    });
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    const block = spalte => page.locator(`.wl-phase[data-spalte="${spalte}"]`);
    await expect(block('In Arbeit')).toContainText('3 VON 3 ERREICHT');
    await expect(block('Prüfen')).toContainText('1 VON 3 ERREICHT');
    await expect(block('Erledigt')).toContainText('0 VON 3 ERREICHT');
    await thema(page, 'dark');
    for (const spalte of ['In Arbeit', 'Prüfen', 'Erledigt']) {
      const stil = await block(spalte).getAttribute('style');
      expect(stil, spalte).toContain('--anteil');
      expect(stil, spalte).not.toContain('--h');
      const sel = `.wl-phase[data-spalte="${spalte}"]`;
      const zuWenig = (await kontrastVerstoesse(page, [sel])).map(m => `${spalte} ${m.element} „${m.text}“ ${m.wert}`);
      expect(zuWenig).toEqual([]);
    }
  });
});
