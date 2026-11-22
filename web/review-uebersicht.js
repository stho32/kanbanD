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

  /* ── Pfad, VS Code und Patch je Datei (R00236, ADR-0042 Punkte 6 und 7, N1.3) ── */

  /** diff.js lädt nach dieser Datei und braucht sie; gelesen wird es erst beim Aufruf. */
  function diffModul() {
    if (typeof module !== 'undefined') return require('./diff.js');
    return window;
  }

  /** Jeder Teil eines Pfads mit `encodeURIComponent`, die Trenner `/` bleiben: kein Zeichen eines Namens wird Abfrage, Fragment oder
      Zeile des Links (ADR-0042 „Durchsetzung“). */
  const teileKodiert = pfad => String(pfad).split('/').map(encodeURIComponent).join('/');

  /** `vscode://file` + Wurzel + `/` + Pfad, mit `:<zeile>` nur, wenn es eine Zeile gibt (FA 4, 5). */
  function vscodeLink(wurzel, pfad, zeile) {
    const link = `vscode://file${teileKodiert(wurzel)}/${teileKodiert(pfad)}`;
    if (zeile === null) return link;
    return `${link}:${zeile}`;
  }

  function vscodeTitel(zeile) {
    if (zeile === null) return 'In VS Code öffnen';
    return `In VS Code an Zeile ${zeile} öffnen`;
  }

  const HUNK_NEU = /^@@ -\d+(?:,\d+)? \+(\d+)/;

  /** Die Datei, nach der Status und Sprungzeile gehen: bei einer Folge-Datei ihr letzter Schritt (FA 11), ein früherer springt nie ein. */
  function massgeblich(d) {
    if (Array.isArray(d.schritte)) return d.schritte[d.schritte.length - 1];
    return d;
  }

  /** Die Zeile, an der VS Code öffnet: die erste hinzugefügte Zeile (Nummer der neuen Seite), ohne sie die erste Zeile der neuen Seite
      im ersten Hunk; ohne geladenen `patch` (`gross`, `nachladen`, `zu_gross_zum_anzeigen`) oder ohne Hunk null (N1.3, PO Z. 545). */
  function sprungZeile(d, hinweise) {
    const quelle = massgeblich(d);
    const { dateiZustand, patchZeilen } = diffModul();
    if (dateiZustand(quelle, hinweise) !== 'patch') return null;
    const zeilen = patchZeilen(quelle.patch);
    const erstePlus = zeilen.find(z => z.art === 'plus');
    if (erstePlus) return erstePlus.neu;
    const ersterKopf = zeilen.find(z => z.art === 'kopf');
    if (!ersterKopf) return null;
    return Math.max(1, Number(HUNK_NEU.exec(ersterKopf.text)[1]));
  }

  /** Ändert das Sichtbarmachen (ADR-0033 Punkt 8) den Text nicht, enthält er weder Bidi- noch Steuerzeichen. */
  const unveraendertSichtbar = text => diffModul().sichtbarTeile(String(text)).every(t => !t.marke);

  /** Ein Link nach VS Code nur, wenn die Datei auf der neuen Seite steht (Status nicht `D`, bei einer Folge der letzte Schritt) und
      weder Wurzel noch Pfad Bidi- oder Steuerzeichen tragen — sonst täuschte der sichtbare Pfad über das Ziel (ADR-0042 Punkt 6). */
  function linkErlaubt(wurzel, d) {
    if (!wurzel) return false;
    if (massgeblich(d).status === 'D') return false;
    return unveraendertSichtbar(wurzel) && unveraendertSichtbar(dateiPfad(d));
  }

  /** Was „Pfad“ kopiert: `<wurzel>/<pfad>` roh, wie im Commit, bei `D` der alte Pfad (FA 8). */
  function kopierPfad(wurzel, d) {
    return `${wurzel}/${dateiPfad(d)}`;
  }

  /** Der Patch einer Datei über die bestehende Route (ADR-0042 Punkt 7): in „Ein Commit“ mit `commit=`, in „Alle Änderungen“ mit
      `anwendung=` des Abschnitts — ohne ihn nähme die Route die erste Anwendung der Karte (FA 10). */
  function patchAdresse(nr, quelle, pfad) {
    let auswahl = `anwendung=${encodeURIComponent(quelle.anwendung)}`;
    if (quelle.commit) auswahl = `commit=${encodeURIComponent(quelle.commit)}`;
    return `/api/aufgaben/${nr}/diff?${auswahl}&datei=${encodeURIComponent(pfad)}&format=patch`;
  }

  /** Name der heruntergeladenen Datei: `<letzter Pfadteil>.patch`, wenn er nur aus `[A-Za-z0-9._-]` besteht, sonst `datei.patch`. */
  function patchName(pfad) {
    const letzter = String(pfad).split('/').pop();
    if (/^[A-Za-z0-9._-]+$/.test(letzter)) return `${letzter}.patch`;
    return 'datei.patch';
  }

  Object.assign(ziel, { dateiArt, dateiPfad, dateiGruppen, gruppierteFolge, testHinweis, grosseNeueDatei, groessteSumme, balkenTeile });
  Object.assign(ziel, { vscodeLink, vscodeTitel, sprungZeile, linkErlaubt, kopierPfad, patchAdresse, patchName });
})(typeof module !== 'undefined' ? module.exports : window);
