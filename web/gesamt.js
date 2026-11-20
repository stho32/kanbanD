/* kanbanD — Review-Seite „Alle Änderungen der Aufgabe“ (R00210, ADR-0033 N1): reine Rechnung, im Browser und in Node (Unit-Tests)
   nutzbar wie diff.js. Fremder Text geht hier unverändert durch; maskiert wird erst beim Zeichnen (esc, sichtbarHtml). */
(function (ziel) {
  'use strict';
  const { kurzVerweis, tausender, zuordnen, STATUSWORT } = typeof module !== 'undefined' ? require('./diff.js') : window;

  /* ── Folge-Dateien (N1.4): eine Datei als Reihe der Schritte der Aufgabe, ohne Netto-Zustand ── */

  const istFolge = d => Array.isArray(d.schritte);

  function folgeWort(n) {
    if (n === 1) return 'Folge · 1 Commit';
    return `Folge · ${tausender(n)} Commits`;
  }

  /** Kopf einer Folge-Datei: Pfad, Summe aus der Antwort (die Summe der Schritte), „Folge · n Commits“ — und kein Statuswort,
      denn ein Netto-Zustand existiert nicht; ein Wort aus einem Schritt behauptete ihn (N1.4). */
  function folgeKopf(d) {
    return { pfad: d.pfad, plus: d.plus, minus: d.minus, wort: folgeWort(d.schritte.length), statuswort: null };
  }

  /** Je Schritt Kurzverweis, Titel und Ziel aus `commits` der Antwort, zugeordnet über `commit` wörtlich; ohne passenden Eintrag
      bleibt der Kopf neutral, ohne Titel und ohne Verweis. */
  function schrittKoepfe(d, commits) {
    return d.schritte.map(s => {
      const c = commits.find(x => x.verweis === s.commit);
      const [wort, klasse] = STATUSWORT[s.status] || [s.status, 'st-mod'];
      let titel = null, ziel = null;
      if (c) { titel = c.titel; ziel = c.verweis; }
      return { kurz: kurzVerweis(s.commit), titel, wort, klasse, plus: s.plus, minus: s.minus, ziel };
    });
  }

  /* ── Hinweise in Worten (N1.7, R00210 FA 6; Wortlaute PO Z. 437, 440, „Aufgabe“ Z. 444) ── */

  const GRUENDE = {
    nicht_linear: 'Die Commits der Aufgabe folgen nicht auf einem Zweig aufeinander.',
    fremd_zu_viele: 'Zwischen den Commits der Aufgabe liegen mehr als 1.000 fremde Commits.',
    fremd_zu_gross: 'Die Commits zwischen denen der Aufgabe sind zu umfangreich, um zu erkennen, welche Dateien sie berühren.',
  };
  const GANZ_REST = 'Darum steht jede Datei als Folge der Schritte der Aufgabe; einen zusammengefassten Diff der ganzen Aufgabe gibt es hier nicht.';
  const FOLGE_SATZ_FREMD = 'Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert. Hier stehen die Schritte der Aufgabe nacheinander; Änderungen fremder Commits fehlen.';
  const FOLGE_SATZ_GANZ = 'Diese Datei steht als Folge der Schritte der Aufgabe. Hier stehen die Schritte nacheinander; Änderungen fremder Commits fehlen.';
  /** Zustände ausgelassener Verweise, die in jeder Antwort stehen und darum einmal je Seite erscheinen (N1.3). */
  const SEITENWEIT = ['unlesbar', 'anwendung_unbekannt'];
  /** Hinweise ohne eigenen Satz in der Hinweisliste: sie wirken anderswo (Reihe, Datei, über den Dateien, Liste der Ausgelassenen). */
  const OHNE_SATZ = ['weitere_anwendungen', 'zu_gross_zum_anzeigen', 'ganz_als_folge', 'ausgelassen'];

  function fremdSatz(h) {
    let fremde = `liegen ${tausender(h.commits)} fremde Commits. Sie berühren`, rest = 'Die Änderungen fremder Commits sind nicht zu sehen.';
    if (h.commits === 1) { fremde = 'liegt 1 fremder Commit. Er berührt'; rest = 'Die Änderungen des fremden Commits sind nicht zu sehen.'; }
    let dateien = `${tausender(h.dateien)} Dateien stehen`;
    if (h.dateien === 1) dateien = '1 Datei steht';
    return `Zwischen den Commits der Aufgabe ${fremde} Dateien der Aufgabe; ${dateien} deshalb als Folge der Schritte der Aufgabe. ${rest}`;
  }

  /** Ein Hinweis des Abschnitts → Satz (und Ziel für „einzeln ansehen“); null, wenn er in der Hinweisliste keinen Satz hat. */
  function hinweisSatz(h) {
    if (OHNE_SATZ.includes(h.art)) return null;
    if (h.art === 'fremd_dazwischen') return { art: h.art, text: fremdSatz(h) };
    if (h.art === 'verwaist') return { art: h.art, kurz: kurzVerweis(h.verweis), text: 'ist verwaist: Kein Zweig führt zu ihm, darum zählt er hier nicht mit.', ziel: h.verweis };
    if (h.art === 'merge_ausgelassen') return { art: h.art, kurz: kurzVerweis(h.verweis), text: 'ist ein Merge und in diesem Gesamtbild ausgelassen.', ziel: h.verweis };
    if (h.art === 'dateien_gekappt') return { art: h.art, text: `${tausender(h.gezeigt)} von ${tausender(h.gesamt)} Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; sie lassen sich über „Ein Commit“ lesen.` };
    return { art: 'unbekannt', name: String(h.art), text: `Die Antwort nennt einen Hinweis „${h.art}“, den diese Ansicht nicht kennt.` };
  }

  /** Was die Hinweise einer Antwort im Abschnitt sagen: die Sätze in der Reihenfolge der Antwort, den Grund über den Dateien
      (`ganz`), den Satz an jeder Folge-Datei und die ausgelassenen Verweise des Abschnitts (`fehlt` u. a., nicht die seitenweiten). */
  function abschnittHinweise(hinweise) {
    const ganzHinweis = hinweise.find(h => h.art === 'ganz_als_folge');
    let ganz = null, folgeSatz = FOLGE_SATZ_FREMD;
    if (ganzHinweis) {
      const grund = GRUENDE[ganzHinweis.grund] || `Grund „${ganzHinweis.grund}“.`;
      ganz = `${grund} ${GANZ_REST}`;
      folgeSatz = FOLGE_SATZ_GANZ;
    }
    const saetze = hinweise.map(hinweisSatz).filter(Boolean);
    const ausgelassen = hinweise.filter(h => h.art === 'ausgelassen' && !SEITENWEIT.includes(h.zustand)).map(h => ({ verweis: h.verweis, zustand: h.zustand }));
    return { saetze, ganz, folgeSatz, ausgelassen };
  }

  /** Seitenweite ausgelassene Verweise über alle Antworten, entdoppelt nach Verweis, in der Reihenfolge des ersten Auftretens. */
  function seitenHinweise(hinweiseJeAntwort) {
    const gesehen = new Map();
    hinweiseJeAntwort.flat().forEach(h => {
      if (h.art !== 'ausgelassen' || !SEITENWEIT.includes(h.zustand) || gesehen.has(h.verweis)) return;
      gesehen.set(h.verweis, { verweis: h.verweis, zustand: h.zustand });
    });
    return [...gesehen.values()];
  }

  function weitereAnwendungen(hinweise) {
    const h = hinweise.find(x => x.art === 'weitere_anwendungen');
    if (!h) return [];
    return h.anwendungen.slice();
  }

  /** Zweiter Satz eines Abschnitts ohne einbezogene Commits (PO Z. 443): gibt es einen Commit mit Diff (verwaist, Merge), ist er
      einzeln lesbar; sonst gibt es zu keinem Verweis einen Diff. Entschieden über alle Hinweise, nie nur nach dem ersten. */
  function leerSatz(hinweise) {
    if (hinweise.some(h => h.art === 'verwaist' || h.art === 'merge_ausgelassen')) return 'Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.';
    return 'Zu den Verweisen dieser Anwendung gibt es keinen Diff.';
  }

  /* ── Summen und Ansage (R00210 FA 3, 4; PO Z. 440) ── */

  /** Dateien, plus und minus über die geladenen Abschnitte; ladende, wartende und gescheiterte zählen nicht. */
  function summen(abschnitte) {
    const da = abschnitte.filter(a => a.status === 'da').flatMap(a => a.antwort.dateien);
    return { dateien: da.length, plus: da.reduce((n, d) => n + d.plus, 0), minus: da.reduce((n, d) => n + d.minus, 0) };
  }

  /** Die Ansage in Worten, nie „+“/„−“; jeder gescheiterte Abschnitt einmal genannt. */
  function ansageText(nr, s, gescheitert) {
    let dateien = `${tausender(s.dateien)} Dateien`, zeilen = `${tausender(s.plus)} Zeilen hinzugefügt`;
    if (s.dateien === 1) dateien = '1 Datei';
    if (s.plus === 1) zeilen = '1 Zeile hinzugefügt';
    const ohne = gescheitert.map(k => `, ohne Anwendung ${k}: ließ sich nicht lesen`).join('');
    return `Alle Änderungen der Aufgabe #${nr}: ${dateien}, ${zeilen}, ${tausender(s.minus)} entfernt${ohne}.`;
  }

  /* ── Reihe der Seite (N1.2): höchstens eine Anfrage an `…/diff` zur Zeit ── */

  /** Die nächste Anfrage der Reihe: keine, solange eine läuft (sie wird nie überholt); sonst eine wartende Datei vor den noch nicht
      begonnenen Anwendungen, denn auf sie wartet ein Mensch. */
  function naechsteAnfrage(reihe) {
    if (reihe.laufend) return null;
    if (reihe.wartend.length) return { art: 'datei', a: reihe.wartend[0].a, i: reihe.wartend[0].i };
    if (reihe.anwendungen.length) return { art: 'anwendung', kuerzel: reihe.anwendungen[0] };
    return null;
  }

  /* ── Zuordnung der Antwort auf `datei=` (N1.6) ── */

  const eintragName = d => (istFolge(d) ? d.pfad : d.neu ?? d.alt);

  /** Der Eintrag der Antwort, der Eintrag `i` der Liste ersetzt: Netto über `zuordnen` (status, alt, neu, Position), Folge über
      `pfad` und die Position unter gleichnamigen Folge-Einträgen. Kommt er in der anderen Art zurück (ein Zweig hat sich bewegt),
      gilt die neue Antwort; null, wenn der Name fehlt. */
  function zuordnenGesamt(dateien, i, antwort) {
    const alt = dateien[i];
    let gleicheArt = null;
    if (istFolge(alt)) {
      const gleichnamig = d => istFolge(d) && d.pfad === alt.pfad;
      const position = dateien.slice(0, i).filter(gleichnamig).length;
      gleicheArt = antwort.filter(gleichnamig)[position] || null;
    } else {
      gleicheArt = zuordnen(dateien, i, antwort.filter(d => !istFolge(d)));
    }
    if (gleicheArt) return gleicheArt;
    return antwort.find(d => istFolge(d) !== istFolge(alt) && eintragName(d) === eintragName(alt)) || null;
  }

  Object.assign(ziel, { istFolge, folgeWort, folgeKopf, schrittKoepfe, abschnittHinweise, seitenHinweise, weitereAnwendungen, leerSatz, summen, ansageText, naechsteAnfrage, zuordnenGesamt });
})(typeof module !== 'undefined' ? module.exports : window);
