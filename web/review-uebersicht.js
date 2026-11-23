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

  /* ── Commit-Leiste und Commit-Kopf (R00245, ADR-0042 Punkt 5): Chips aus dem Titel, Zweigverdichtung, Folge der Leiste ── */

  const CHIP_ANFORDERUNG = /^\[([A-Z]+\d*)\]/;
  const CHIP_SCHRITT = /^\s*(B\d+):/;

  /** Titel → Chips und Rest (FA 8): ein erster Chip aus `[R00229]`, `[DOC]`, danach höchstens ein `B1187:` unmittelbar dahinter.
      Ein Titel ohne diese Form, oder einer, von dem nichts übrig bliebe, erscheint unverändert ohne Chips. */
  function commitChips(titel) {
    const text = String(titel);
    const anforderung = CHIP_ANFORDERUNG.exec(text);
    if (!anforderung) return { chips: [], rest: text };
    const chips = [anforderung[1]];
    let rest = text.slice(anforderung[0].length);
    const schritt = CHIP_SCHRITT.exec(rest);
    if (schritt) {
      chips.push(schritt[1]);
      rest = rest.slice(schritt[0].length);
    }
    rest = rest.replace(/^\s+/, '');
    if (!rest.trim()) return { chips: [], rest: text };
    return { chips, rest };
  }

  /** Ein Chip ist höchstens 16 Zeichen breit, das „…“ eingerechnet (FA 8). */
  const CHIP_HOECHSTENS = 16;
  function chipText(kennung) {
    if (kennung.length <= CHIP_HOECHSTENS) return kennung;
    return kennung.slice(0, CHIP_HOECHSTENS - 1) + '…';
  }

  /** Zweige eines Eintrags der Liste verdichtet (FA 9): steht `main` (sonst `master`) unter den lokalen Zweigen, dieser Name und die Zahl
      aller übrigen Namen (lokale, entfernte, `zweige_weitere`); sonst null — dann gilt die Liste aller Namen. */
  function zweigVerdichtung(e) {
    const lokal = e.zweige || [];
    const name = ['main', 'master'].find(n => lokal.includes(n));
    if (!name) return null;
    const alle = lokal.length + (e.entfernte_zweige || []).length + (e.zweige_weitere || 0);
    return { name, weitere: alle - 1 };
  }

  function zweigeWort(k) {
    if (k === 1) return '+1 Zweig';
    return `+${diffModul().tausender(k)} Zweige`;
  }

  function commitsWort(n) {
    if (n === 1) return '1 Commit';
    return `${diffModul().tausender(n)} Commits`;
  }

  /** Zustände der Liste, zu denen es einen Diff gibt (ADR-0033 Punkt 2): die Folge von Blättern und Leiste. */
  const MIT_DIFF = ['auf_zweig', 'verwaist'];
  const mitDiff = eintraege => eintraege.filter(e => MIT_DIFF.includes(e.zustand) && e.hash);

  const zwei = n => String(n).padStart(2, '0');

  /** `TT.MM. hh:mm` in Ortszeit (FA 4); was kein Zeitpunkt ist, bleibt wörtlich. */
  function zeitKurz(iso) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return iso;
    const d = new Date(ms);
    return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  }

  /** Einträge der Liste → Folge der Leiste (FA 2, 3): je Commit mit Diff ein Eintrag in der Reihenfolge der Liste; `n`, `plus`, `minus`
      zählen die Commits auf einem Zweig (brutto), ein verwaister steht darin, zählt aber nicht (PO Z. 636, 637). */
  function leistenFolge(eintraege) {
    const commits = mitDiff(eintraege).map(e => {
      const { chips, rest } = commitChips(e.titel);
      let kurz = e.hash.slice(0, 7);
      if (e.anwendung) kurz = `${e.anwendung}:${kurz}`;
      return { verweis: e.verweis, hash: e.hash, kurz, titel: e.titel, chips, rest, zeit: zeitKurz(e.datum), plus: e.plus, minus: e.minus, verwaist: e.zustand === 'verwaist' };
    });
    const gezaehlt = commits.filter(c => !c.verwaist);
    const summe = feld => gezaehlt.reduce((n, c) => n + c[feld], 0);
    return { commits, n: gezaehlt.length, plus: summe('plus'), minus: summe('minus') };
  }

  /** Zeilen in Worten für die Namen (FA 12): das Minuszeichen läse ein Bildschirmleser verschieden. */
  function zeilenWorte(plus, minus) {
    const { tausender } = diffModul();
    let hinzu = `${tausender(plus)} Zeilen hinzugefügt`;
    if (plus === 1) hinzu = '1 Zeile hinzugefügt';
    return `${hinzu}, ${tausender(minus)} entfernt`;
  }

  /** Name des ersten Eintrags (FA 12): „Alle Änderungen, 3 Commits, 318 Zeilen hinzugefügt, 20 entfernt“. */
  function leistenAlleName(f) {
    return `Alle Änderungen, ${commitsWort(f.n)}, ${zeilenWorte(f.plus, f.minus)}`;
  }

  /** Name eines Commit-Eintrags (FA 3, 12): enthält jeden sichtbaren Text des Eintrags (Titel ohne Chips, Zeit, Kurz-Hash). */
  function leistenEintragName(c) {
    const name = `Commit ${c.kurz}, ${c.titel}, ${c.zeit}, ${zeilenWorte(c.plus, c.minus)}`;
    if (c.verwaist) return `${name}, auf keinem Zweig, zählt nicht in den Zahlen von Alle Änderungen`;
    return name;
  }

  /** Rollstand der Leiste, damit der gezeigte Eintrag samt `rand` (Fokusring) ganz im sichtbaren Teil liegt (FA 13): `stand` und `hoehe`
      des sichtbaren Teils, `oben` und `unten` des Eintrags im Inhalt der Leiste. Liegt er schon darin, bleibt der Stand. */
  function leistenRollstand({ stand, hoehe, oben, unten }, rand) {
    if (oben - rand < stand) return Math.max(0, oben - rand);
    if (unten + rand > stand + hoehe) return Math.min(oben - rand, unten + rand - hoehe);
    return stand;
  }

  /* ── „Gesehen“ je Karte im Browser-Speicher (R00246 FA 7, 9, 10; ADR-0042 N1.4, N4): der Speicher hat die Schnittstelle von
     `localStorage` und kommt als Parameter; fehlt er oder wirft er, gilt das Ergebnis nur bis zum Neuladen (`fehler`). ── */

  const GESEHEN_PRAEFIX = 'kanbanD.gesehen.';
  /** Mehr Karten behält ein Browser nicht (FA 9, PO Z. 534). */
  const GESEHEN_HOECHSTENS = 200;

  function gesehenSchluessel(slug, nr) {
    return `${GESEHEN_PRAEFIX}${slug}.${nr}`;
  }

  /** Wert → `{zeit, gesehen}`; null, wenn er sich nicht lesen lässt. */
  function gesehenWert(text) {
    let wert;
    try { wert = JSON.parse(text); } catch (_) { return null; }
    const lesbar = wert !== null && typeof wert === 'object' && typeof wert.zeit === 'number' && Array.isArray(wert.gesehen);
    if (!lesbar) return null;
    return wert;
  }

  /** Die gesehenen Schlüssel einer Karte; ein unlesbarer Wert gilt als leer, ein Speicher, der fehlt oder wirft, als `fehler`. */
  function gesehenLesen(speicher, slug, nr) {
    try {
      const wert = gesehenWert(speicher.getItem(gesehenSchluessel(slug, nr)));
      if (!wert) return { gesehen: [], fehler: false };
      return { gesehen: wert.gesehen.slice(), fehler: false };
    } catch (_) {
      return { gesehen: [], fehler: true };
    }
  }

  /** Liest frisch, wendet `aenderungen` (`[schlüssel, gesehen]` in dieser Reihenfolge) an, schreibt `{zeit: jetzt, gesehen}` zurück
      und räumt auf (FA 9, 10). Scheitert der Speicher, gilt die Änderung nur im Ergebnis, mit `fehler`. */
  function gesehenSchreiben(speicher, slug, nr, aenderungen, jetzt) {
    const vorher = gesehenLesen(speicher, slug, nr);
    const gesehen = gesehenAnwenden(vorher.gesehen, aenderungen);
    if (vorher.fehler) return { gesehen, fehler: true };
    try {
      speicher.setItem(gesehenSchluessel(slug, nr), JSON.stringify({ zeit: jetzt, gesehen }));
      gesehenAufraeumen(speicher);
      return { gesehen, fehler: false };
    } catch (_) {
      return { gesehen, fehler: true };
    }
  }

  function gesehenAnwenden(gesehen, aenderungen) {
    const menge = new Set(gesehen);
    aenderungen.forEach(([schluessel, ja]) => {
      if (ja) menge.add(schluessel);
      else menge.delete(schluessel);
    });
    return [...menge];
  }

  /** Über der Obergrenze fällt der Wert mit der kleinsten `zeit`; ein unlesbarer zählt als der älteste. Fremde Schlüssel bleiben. */
  function gesehenAufraeumen(speicher) {
    const karten = [];
    for (let i = 0; i < speicher.length; i++) {
      const schluessel = speicher.key(i);
      if (!schluessel || !schluessel.startsWith(GESEHEN_PRAEFIX)) continue;
      const wert = gesehenWert(speicher.getItem(schluessel));
      let zeit = -Infinity;
      if (wert) zeit = wert.zeit;
      karten.push({ schluessel, zeit });
    }
    karten.sort((a, b) => a.zeit - b.zeit);
    karten.slice(0, Math.max(0, karten.length - GESEHEN_HOECHSTENS)).forEach(k => speicher.removeItem(k.schluessel));
  }

  /* ── Schlüssel einer Datei (FA 7, 8; ADR-0042 N3): in „Ein Commit“ über den vollen Hash, in „Alle Änderungen“ über den Fingerabdruck ── */

  function commitDateiSchluessel(hash, d) {
    return `${hash}\u0000${dateiPfad(d)}`;
  }

  function alleDateiSchluessel(anwendung, d) {
    return `alle\u0000${anwendung}\u0000${dateiPfad(d)}\u0000${fingerabdruck(d)}`;
  }

  /** FNV-1a (32 Bit, hexadezimal) über Felder, die in jeder Antwort stehen — nie über `patch`, der je nach Laden fehlt (N3.1). */
  function fingerabdruck(d) {
    let felder = [d.status, d.alt, d.neu, d.plus, d.minus, d.binaer];
    if (Array.isArray(d.schritte)) felder = [d.plus, d.minus, d.binaer, d.schritte.map(s => s.commit)];
    return fnv1a(JSON.stringify(felder));
  }

  function fnv1a(text) {
    let streuwert = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(text)) {
      streuwert ^= byte;
      streuwert = Math.imul(streuwert, 0x01000193) >>> 0;
    }
    return streuwert.toString(16).padStart(8, '0');
  }

  Object.assign(ziel, { GESEHEN_HOECHSTENS, gesehenSchluessel, gesehenLesen, gesehenSchreiben, commitDateiSchluessel, alleDateiSchluessel, fingerabdruck });

  Object.assign(ziel, { commitChips, chipText, zweigVerdichtung, zweigeWort, commitsWort, mitDiff, zeitKurz, leistenFolge, leistenRollstand, leistenAlleName, leistenEintragName });

  Object.assign(ziel, { dateiArt, dateiPfad, dateiGruppen, gruppierteFolge, testHinweis, grosseNeueDatei, groessteSumme, balkenTeile });
  Object.assign(ziel, { vscodeLink, vscodeTitel, sprungZeile, linkErlaubt, kopierPfad, patchAdresse, patchName });
})(typeof module !== 'undefined' ? module.exports : window);
