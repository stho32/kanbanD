/* kanbanD — Übersicht der Review-Seite (R00235, ADR-0042 Punkte 1, 3, 9): Art einer Datei aus festen Pfadregeln, Gruppen, Test-Hinweis,
   große neue Datei und Größenbalken. Reine Rechnung, im Browser und in Node (Unit-Tests) nutzbar wie diff.js; vor diff.js geladen. */
(function (ziel) {
  'use strict';

  /* ── Art einer Datei (ADR-0042 Punkt 1): test vor doku vor code, im Zweifel code ── */

  const TEST_ORDNER = ['test', 'tests', 'spec', 'specs', '__tests__', 'e2e'];
  const TEST_NAME = [/\.(test|spec)\.[^./]+$/i, /_(test|spec)\.[^./]+$/i, /^test_/i, /Tests?\.[^./]+$/];
  const DOKU_ENDUNGEN = ['md', 'markdown', 'txt', 'adoc', 'rst'];
  const DOKU_ERSTER_ORDNER = ['dokumentation', 'documentation', 'docs', 'doc', 'anforderungen', 'requirements', 'schaetzungen'];

  /** Pfad → `code`, `test` oder `doku`. Groß- und Kleinschreibung der Ordner und Endungen ist egal; `Test`/`Tests` vor der Endung
      zählt nur groß geschrieben (`FooTests.cs`, nicht `latest.rs`). */
  function dateiArt(pfad) {
    const teile = String(pfad).split('/');
    const name = teile.pop();
    const ordner = teile.map(t => t.toLowerCase());
    if (ordner.some(o => TEST_ORDNER.includes(o)) || TEST_NAME.some(muster => muster.test(name))) return 'test';
    const punkt = name.lastIndexOf('.');
    let endung = '';
    if (punkt > 0) endung = name.slice(punkt + 1).toLowerCase();
    if (DOKU_ENDUNGEN.includes(endung) || DOKU_ERSTER_ORDNER.includes(ordner[0])) return 'doku';
    return 'code';
  }

  /** Der Pfad, nach dem eine Datei eingeteilt wird: `pfad` einer Folge-Datei (ADR-0033 N1.4), sonst der neue, bei `D` der alte. */
  function dateiPfad(d) {
    if (Array.isArray(d.schritte)) return d.pfad;
    if (d.neu) return d.neu;
    return d.alt;
  }

  /* ── Gruppen (FA 2, 3): Code, Tests, Doku und Planung; leere entfallen ── */

  const GRUPPEN = [['code', 'Code'], ['test', 'Tests'], ['doku', 'Doku und Planung']];

  /** Dateien der Antwort → Gruppen `{art, name, indizes, n, plus, minus}` in fester Reihenfolge, innerhalb in der Reihenfolge der API. */
  function dateiGruppen(dateien) {
    const arten = dateien.map(d => dateiArt(dateiPfad(d)));
    return GRUPPEN.map(([art, name]) => {
      const indizes = arten.flatMap((a, i) => (a === art ? [i] : []));
      const summe = feld => indizes.reduce((n, i) => n + dateien[i][feld], 0);
      return { art, name, indizes, n: indizes.length, plus: summe('plus'), minus: summe('minus') };
    }).filter(g => g.n > 0);
  }

  /** Die Indizes der API in der gruppierten Reihenfolge: die Folge, in der die Seite zeichnet und das Budget zählt. */
  function gruppierteFolge(dateien) {
    return dateiGruppen(dateien).flatMap(g => g.indizes);
  }

  /* ── Merkmale einer Datei (FA 5, 6) ── */

  /** Hinweis an einer Datei der Art `test` (ADR-0042 Punkt 3, Wortlaut PO Z. 537); '' ohne Hinweis. */
  function testHinweis(d) {
    if (dateiArt(dateiPfad(d)) !== 'test') return '';
    if (d.status === 'D') return 'Test gelöscht';
    const bestehenderGeaendert = (d.status === 'M' || d.status === 'R') && d.minus > 0;
    if (bestehenderGeaendert) return 'bestehender Test geändert';
    return '';
  }

  /** Mehr Zeilen hat eine neue Datei nicht, die beim Aufbau öffnen darf: eine Blockgröße (ADR-0042 Punkt 1, PO Z. 536). */
  const GRENZE_NEU = 500;

  /** Eine neue Datei (`A`) mit mehr als 500 hinzugefügten Zeilen beginnt eingeklappt und zählt nicht ins Budget. */
  function grosseNeueDatei(d) {
    return d.status === 'A' && d.plus > GRENZE_NEU;
  }

  /* ── Größenbalken (ADR-0042 Punkt 9, Skala je Gruppe nach PO Z. 548) ── */

  /** Größte Summe `plus + minus` unter den Dateien `indizes` (einer Gruppe). */
  function groessteSumme(dateien, indizes) {
    return Math.max(0, ...indizes.map(i => dateien[i].plus + dateien[i].minus));
  }

  /** Anteile der Teile `+` und `−` an der vollen Länge des Balkens: Zahl durch die größte Summe der Gruppe; die volle Länge und die
      Mindestlänge von 1 px je Zahl über 0 legt das CSS fest (`--rv-balken`). */
  function balkenTeile(d, groesste) {
    const anteil = zahl => {
      if (zahl <= 0) return 0;
      return zahl / groesste;
    };
    return { plus: anteil(d.plus), minus: anteil(d.minus) };
  }

  Object.assign(ziel, { dateiArt, dateiPfad, dateiGruppen, gruppierteFolge, testHinweis, grosseNeueDatei, groessteSumme, balkenTeile });
})(typeof module !== 'undefined' ? module.exports : window);
