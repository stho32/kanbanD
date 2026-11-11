// R00134: Zählwort in der Fortschrittszeile des Fever-Charts — bei genau einem fehlenden Tag die Einzahl
// („rechnet 1 von 1 Tag …“), sonst die Mehrzahl; die Hilfe liegt an einer Stelle (web/kultur.js).
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit, mutanteEinsetzen } = require('./hilfen');

/** Tag heute + n als JJJJ-MM-TT in Ortszeit (Europe/Berlin, wie e2e/tests/hilfen.js). */
const tag = n => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const liste = l => l.map(n => `- #${n}\n`).join('');
/** Board-Datei: Zieltermin und Puffer gesetzt, Projektstart `start` = heute − m; die Aufgaben wandern über die Commits. */
const board = (m, zu, arbeit, fertig) => `---\nmilestones:\n  - {name: Ziel, date: ${tag(20)}, color: red, line: solid, width: normal, target: true}\nstart: ${tag(-m)}\nfever: {buffer: 4}\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n${liste(zu)}\n## In Arbeit\n\n${liste(arbeit)}\n## Erledigt\n\n${liste(fertig)}`;

/** Schreibt die Board-Datei und committet sie mit festem Datum — so entsteht eine Tagesbewegung. */
function commitAm(ordner, n, inhalt) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', inhalt);
  const datum = tag(n) + 'T10:00:00';
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

/** Startet kanbanD mit acht Aufgaben, einer Bewegung je Tag bis gestern und Projektstart heute − m. */
async function starten(page, m) {
  const k = await kanbanStarten(async ordner => {
    const dateien = {};
    for (let n = 1; n <= 8; n++) dateien[`aufgaben/000${n}-a${n}.md`] = `---\nid: ${n}\ntitle: a${n}\n---\n`;
    einrichten(dateien)(ordner);
    commitAm(ordner, -10, board(m, [1, 2, 3, 4, 5, 6, 7, 8], [], []));
    commitAm(ordner, -9, board(m, [2, 3, 4, 5, 6, 7, 8], [], [1]));
    commitAm(ordner, -8, board(m, [3, 4, 5, 6, 7, 8], [], [1, 2]));
    commitAm(ordner, -6, board(m, [4, 5, 6, 7, 8], [], [1, 2, 3]));
    commitAm(ordner, -5, board(m, [5, 6, 7, 8], [4], [1, 2, 3]));
    commitAm(ordner, -3, board(m, [5, 6, 7, 8], [], [1, 2, 3, 4]));
    commitAm(ordner, -1, board(m, [6, 7, 8], [], [1, 2, 3, 4, 5]));
  });
  await alsPerson(page, 'st');
  return k;
}

/** Öffnet den Bericht; hält `halten` die POST-Anfrage des Caches an, damit die Fortschrittszeile sichtbar bleibt. Gibt das Freigeben zurück. */
async function berichtOeffnen(page, k, halten = true) {
  let freigeben = () => { };
  if (halten) {
    let loesen;
    const gehalten = new Promise(ok => { loesen = ok; });
    freigeben = loesen;
    await page.route('**/api/boards/entwicklung/fieber/cache', async route => {
      if (route.request().method() === 'POST') await gehalten;
      await route.continue();
    });
  }
  await mutanteEinsetzen(page); // Mutationsprobe (KD_MUTANTE): ersetzt die Zählwort-Stelle der ausgelieferten Datei
  await page.goto(k.adresse + '#/berichte/fieber');
  await liveBereit(page);
  return freigeben;
}

test.describe('R00134 Zählwort im Fever-Chart', () => {
  let k;
  // Auch bei rotem Test wird die kanbanD-Instanz beendet — sonst bleibt sie hängen und verbraucht inotify-Instanzen.
  test.afterEach(async () => { if (k) await k.stoppen(); });

  test('US-1: genau ein fehlender Tag nennt die Einzahl „rechnet 1 von 1 Tag …“', async ({ page }) => {
    k = await starten(page, 1);
    const freigeben = await berichtOeffnen(page, k);
    // Die Zeile schreibt zuerst web/app.js während der Rechnung (i = 0) …
    await expect(page.locator('#fieber-lauf')).toContainText('rechnet 1 von 1 Tag …');
    // … und eine Neuzeichnung formt sie in web/ansicht.js erneut — derselbe Stufenwechsel löst render() aus.
    await page.setViewportSize({ width: 500, height: 720 });
    await expect(page.locator('#fieber-lauf')).toContainText('rechnet 1 von 1 Tag …');
    freigeben();
  });

  test('US-2: zwei fehlende Tage nennen die Mehrzahl „rechnet 1 von 2 Tagen …“', async ({ page }) => {
    k = await starten(page, 2);
    const freigeben = await berichtOeffnen(page, k);
    await expect(page.locator('#fieber-lauf')).toContainText('rechnet 1 von 2 Tagen …');
    freigeben();
  });

  test('US-3: vier fehlende Tage melden erst den ersten und nach dem vierten Tag den vierten Stand', async ({ page }) => {
    // Die erste Meldung (i = 0) ist nur für Augenblicke sichtbar; die tatsächlich geschriebenen Texte hält ein Wächter fest.
    await page.addInitScript(() => {
      window.__fbLauf = [];
      const merken = () => {
        const el = document.getElementById('fieber-lauf');
        const t = el && el.firstChild ? el.firstChild.nodeValue.trim() : '';
        if (t && window.__fbLauf[window.__fbLauf.length - 1] !== t) window.__fbLauf.push(t);
      };
      new MutationObserver(merken).observe(document, { subtree: true, childList: true, characterData: true });
    });
    k = await starten(page, 4);
    const freigeben = await berichtOeffnen(page, k);
    await expect(page.locator('#fieber-lauf')).toContainText('rechnet 4 von 4 Tagen …');
    const texte = await page.evaluate(() => window.__fbLauf);
    expect(texte).toContain('rechnet 1 von 4 Tagen …');
    expect(texte[texte.length - 1]).toBe('rechnet 4 von 4 Tagen …');
    freigeben();
  });

  test('US-4: kein fehlender Tag zeigt keine „rechnet“-Zeile, sondern den Cache-Text', async ({ page }) => {
    k = await starten(page, 0);
    await berichtOeffnen(page, k, false);
    await expect(page.locator('#fieber-lauf')).toContainText('aus dem Cache');
    // „heute live gerechnet“ enthält ebenfalls „rechnet“ — geprüft wird die Fortschrittszeile „rechnet n von m …“
    await expect(page.locator('#fieber-lauf')).not.toHaveText(/rechnet \d+ von \d+/);
  });

  test('Cache-Zweig: genau ein Tag im Cache ergibt „1 Tag aus dem Cache“', async ({ page }) => {
    k = await starten(page, 1);
    await berichtOeffnen(page, k, false);
    await expect(page.locator('#fieber-lauf')).toContainText('1 Tag aus dem Cache');
  });

  test('Cache-Zweig: zwei Tage im Cache ergeben „2 Tage aus dem Cache“', async ({ page }) => {
    k = await starten(page, 2);
    await berichtOeffnen(page, k, false);
    await expect(page.locator('#fieber-lauf')).toContainText('2 Tage aus dem Cache');
  });
});
