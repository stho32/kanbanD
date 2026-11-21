/* kanbanD — Ansicht „Commits“ (R00205): aus einem Eintrag der Antwort von GET /api/aufgaben/{nr}/commits die Werte der Zeile.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar wie kultur.js. Fremder Text (Titel, Autor, Zweige, grund)
   geht hier unverändert durch; maskiert wird erst beim Zeichnen (web/ansicht.js, esc). */
(function (ziel) {
  'use strict';
  const { zeitpunktAusMs } = typeof module !== 'undefined' ? require('./kultur.js') : window;

  /** Länge, ab der die API einen Titel kürzt: höchstens 500 Zeichen, sonst 500 und „…“ (R00204 AK 17). */
  const TITEL_HOECHSTENS = 500;
  /** Wörter der fünf Zustände ohne Zweige (R00205 FA 5, Entscheidung des PO), in der Reihenfolge der Tabelle. */
  const ZUSTANDSWOERTER = {
    verwaist: 'auf keinem Zweig',
    fehlt: 'nicht mehr im Repository',
    repository_fehlt: 'Repository nicht erreichbar',
    anwendung_unbekannt: 'Anwendung unbekannt',
    unlesbar: 'Eintrag nicht lesbar',
  };
  const HINWEIS_VERWAIST = 'Der Commit ist noch da, aber kein Zweig führt zu ihm — meist nach einem Rebase.';
  const HINWEIS_FEHLT = 'Das Repository kennt diesen Commit nicht mehr.';
  const HINWEIS_OHNE_ANWENDUNG = 'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.';
  /** Symbol (Name der Zeichnung in web/ansicht.js) und Ton je Zustand: der Zustand hängt nie allein an der Farbe. */
  const ZEICHEN = {
    verwaist: ['kette-offen', 'warn'],
    fehlt: ['fehlt', 'fehl'],
    repository_fehlt: ['ordner-offen', 'fehl'],
    anwendung_unbekannt: ['frage', 'warn'],
    unlesbar: ['achtung', 'fehl'],
  };
  /** Zustände, in denen die API keine Metadaten kennt (R00204): Titel, Autor, Datum und Zahlen fehlen. */
  const OHNE_METADATEN = ['fehlt', 'unlesbar', 'repository_fehlt', 'anwendung_unbekannt'];
  /** Wie viele Zweignamen in der Zeile stehen, der Rest hinter „+n weitere“. */
  const ZWEIGE_IN_ZEILE = 3;

  const hinweisVon = (e) => {
    switch (e.zustand) {
      case 'verwaist': return HINWEIS_VERWAIST;
      case 'fehlt': return HINWEIS_FEHLT;
      case 'anwendung_unbekannt': return e.anwendung ? `Anwendung „${ohneSteuerzeichen(e.anwendung)}“ ist unter Einrichten nicht eingetragen.` : HINWEIS_OHNE_ANWENDUNG;
      default: return ohneSteuerzeichen(e.grund) || '';
    }
  };

  /** Name einer Anwendung im Satz (PO Z. 448): das leere Kürzel ist die Standardanwendung, nie „Anwendung “ ohne Namen. Roh. */
  function anwendungName(kuerzel) {
    if (kuerzel) return `Anwendung ${kuerzel}`;
    return 'Standardanwendung';
  }

  /** Satz und Hinweiszeile einer 404 mit `zustand` auf der Review-Seite (R00224 FA 1, 6, 7; PO Z. 506–508): `{satz, hinweis, symbol, ton}`
      mit Symbol und Ton aus `ZEICHEN`, `hinweis` ist der `grund` ohne Bidi-Steuerzeichen oder leer; `null` für einen Zustand ohne Satz.
      Roh, maskiert wird beim Zeichnen. */
  function zustandSatz(zustand, kuerzel, grund) {
    const k = ohneSteuerzeichen(kuerzel) || '';
    const mitGrund = ohneSteuerzeichen(grund) || '';
    let satz, hinweis = '';
    switch (zustand) {
      case 'repository_fehlt': satz = `Das Repository der ${anwendungName(k)} ist nicht erreichbar.`; hinweis = mitGrund; break;
      case 'fehlt': satz = `Das Repository der ${anwendungName(k)} kennt diesen Commit nicht mehr.`; break;
      case 'anwendung_unbekannt': satz = k ? `Die Anwendung ${k} ist unter Einrichten nicht eingetragen.` : HINWEIS_OHNE_ANWENDUNG; break;
      case 'unlesbar': satz = 'Der Eintrag an der Aufgabe ist nicht lesbar.'; hinweis = mitGrund; break;
      default: return null;
    }
    const [symbol, ton] = ZEICHEN[zustand];
    return { satz, hinweis, symbol, ton };
  }

  /** Bidi-Steuerzeichen (U+202A–202E, U+2066–2069) aus fremdem Text: ein RLO in einem Zweignamen ließe `fix-<RLO>gpj.exe` als `fix-exe.jpg` erscheinen. */
  const ohneSteuerzeichen = text => (typeof text === 'string' ? text.replace(/[\u202A-\u202E\u2066-\u2069]/g, '') : text);

  /** Der Commit in der Zeile: Kürzel und die ersten 7 Zeichen des Hashs, ohne Kürzel nur die 7; ohne Hash der Verweis wörtlich. */
  function kurzform(e) {
    if (!e.hash) return ohneSteuerzeichen(e.verweis);
    return (e.anwendung ? `${ohneSteuerzeichen(e.anwendung)}:` : '') + e.hash.slice(0, 7);
  }

  /** Die Marke „gekürzt“: genau 501 Zeichen (Unicode-Codepunkte, nicht UTF-16-Einheiten) und am Ende „…“. */
  function titelGekuerzt(e) {
    const titel = e.titel || '';
    return titel.endsWith('…') && Array.from(titel).length === TITEL_HOECHSTENS + 1;
  }

  const tausender = n => String(Number(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  /** `+1.204 −87` mit Tausenderpunkt und dem Minus-Zeichen U+2212. */
  const zahlenText = e => `+${tausender(e.plus)} −${tausender(e.minus)}`;

  /** `TT.MM.JJJJ HH:MM` in Ortszeit wie in der Ansicht „Verlauf“; was kein Zeitpunkt ist, bleibt wörtlich stehen. */
  function datumText(iso) {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? iso : zeitpunktAusMs(ms);
  }

  /** Marke eines Zustands: Wort, Hinweiszeile, Symbol, Ton; `null` für `auf_zweig` (der hat die Zweige statt eines Worts). */
  function zustandsmarke(e) {
    if (!ZUSTANDSWOERTER[e.zustand]) return null;
    const [symbol, ton] = ZEICHEN[e.zustand];
    return { zustand: e.zustand, wort: ZUSTANDSWOERTER[e.zustand], hinweis: hinweisVon(e), symbol, ton };
  }

  /** Zweige der Zeile und der Klappe: bis zu drei Namen (lokale zuerst, dann entfernte), `weitere` = Summe aller Angaben − 3. */
  function zweigmarken(e) {
    const lokal = (e.zweige || []).map(ohneSteuerzeichen), entfernt = (e.entfernte_zweige || []).map(ohneSteuerzeichen), nichtAufgefuehrt = e.zweige_weitere || 0;
    const alle = [...lokal.map(name => ({ name, entfernt: false })), ...entfernt.map(name => ({ name, entfernt: true }))];
    const summe = alle.length + nichtAufgefuehrt;
    return {
      sichtbar: alle.slice(0, ZWEIGE_IN_ZEILE),
      weitere: Math.max(0, summe - ZWEIGE_IN_ZEILE),
      lokal, entfernt, nichtAufgefuehrt,
      satzRest: nichtAufgefuehrt > 0 ? `und ${nichtAufgefuehrt === 1 ? '1 weiterer Zweig' : `${nichtAufgefuehrt} weitere Zweige`}, hier nicht aufgeführt` : null,
    };
  }

  /** Alle Anzeigewerte einer Zeile. */
  function zeilenwerte(e) {
    const ohneMetadaten = OHNE_METADATEN.includes(e.zustand);
    return {
      verweis: ohneSteuerzeichen(e.verweis),
      kurz: kurzform(e),
      ohneMetadaten,
      titel: ohneMetadaten ? null : ohneSteuerzeichen(e.titel),
      gekuerzt: !ohneMetadaten && titelGekuerzt(e),
      autor: ohneMetadaten ? null : ohneSteuerzeichen(e.autor),
      datum: ohneMetadaten ? null : datumText(e.datum),
      datumTitel: ohneMetadaten ? null : e.datum,
      zahlen: ohneMetadaten ? null : zahlenText(e),
      zustand: zustandsmarke(e),
      zweige: e.zustand === 'auf_zweig' ? zweigmarken(e) : null,
    };
  }

  /** Der Text der Zeitgrenze (R00204 AK 8: „… antwortete nicht innerhalb von n s …“); nur er wird durch den Wortlaut des PO ersetzt. */
  const ZEITGRENZE_TEXT = /antwortete nicht (?:innerhalb von|in) \d+ s/;

  /** Meldung der Ansicht beim Fehler (R00205 FA 8): 503 wegen der Zeitgrenze mit dem festen Wortlaut des PO, jedes andere 503 (etwa zu viel
      Ausgabe) mit dem `fehler` der Antwort; ohne Verbindung (Status 0) ohne Antwort. */
  function fehlerText({ status, fehler }) {
    let grund = ohneSteuerzeichen(fehler) || 'unbekannter Fehler';
    if (status === 503 && (!fehler || ZEITGRENZE_TEXT.test(fehler))) grund = 'Das Repository antwortete nicht innerhalb von 10 Sekunden';
    if (status === 0) grund = 'keine Verbindung zum Programm';
    return `Die Commits ließen sich nicht lesen: ${grund} (${status}).`;
  }

  /** Ansage im Statusbereich nach dem Lesen. */
  function gelesenText(anzahl) {
    if (anzahl === 0) return 'Keine Commits gelesen';
    return anzahl === 1 ? '1 Commit gelesen' : `${anzahl} Commits gelesen`;
  }

  /* ── Nachfolger eines verwaisten Commits (R00218 B1118, PO Z. 461, 465): die Antwort von GET …/commits/{verweis}/nachfolger als Werte und
     Wortlaute. Fremder Text geht ohne Bidi-Steuerzeichen durch; maskiert wird beim Zeichnen. ── */
  const NACHFOLGER_LAEDT = 'Sucht Commits mit gleichem Patch …';
  const KEIN_NACHFOLGER = 'Kein Commit mit gleichem Patch auf einem Zweig gefunden.';
  const KEIN_NACHFOLGER_GRUND = `${KEIN_NACHFOLGER} Nach Squash oder einem anders gelösten Konflikt findet die Suche keinen Nachfolger.`;
  const MERGE_SATZ = 'Für einen Merge-Commit sucht kanbanD keinen Nachfolger.';
  const LEER_SATZ_NF = 'Der Commit ändert keine Datei, darum gibt es keinen Patch zum Vergleichen.';
  const MARKE_AN_DER_KARTE = 'schon an der Aufgabe';

  /** Kurzform eines Verweises `<kürzel>:<hash>` bzw. `<hash>`: Kürzel und die ersten 7 Zeichen. */
  function kurzVerweis(verweis) {
    const text = ohneSteuerzeichen(verweis) || '';
    const stelle = text.lastIndexOf(':');
    return stelle < 0 ? text.slice(0, 7) : `${text.slice(0, stelle)}:${text.slice(stelle + 1, stelle + 8)}`;
  }

  const gekapptSatz = n => `Die Suche hat nach ${tausender(n)} ${n === 1 ? 'Commit' : 'Commits'} aufgehört; ein Nachfolger kann fehlen.`;
  const weitereSatz = n => (n === 1 ? '1 weiterer Commit mit gleichem Patch ist nicht gezeigt.' : `${n} weitere Commits mit gleichem Patch sind nicht gezeigt.`);

  /** Der Kandidat als Zeilenwerte wie die Liste; `knopf` ist `entfernen`, wenn er an der Karte steht oder nach einem 409 dorthin gewechselt ist. */
  function kandidatWerte(k, entfernen) {
    const kurz = kurzVerweis(k.verweis);
    const knopf = k.an_der_karte || entfernen ? 'entfernen' : 'ersetzen';
    return {
      verweis: ohneSteuerzeichen(k.verweis), kurz, hash: k.hash,
      titel: ohneSteuerzeichen(k.titel), gekuerzt: titelGekuerzt(k), autor: ohneSteuerzeichen(k.autor),
      datum: datumText(k.datum), datumTitel: k.datum,
      zweige: zweigmarken(k), knopf,
      marke: knopf === 'entfernen' ? MARKE_AN_DER_KARTE : null,
      name: knopf === 'entfernen' ? 'Verwaisten Verweis entfernen' : `Ersetzen durch ${kurz}`,
    };
  }

  /** Die Antwort `{status, rumpf}` bzw. `{status, fehler}` (Status 0: keine Verbindung) für den verwaisten Eintrag `verwaist`:
      `art` (kandidaten, keiner, merge, leer, fehler), Kopf und Zusatz, Kandidaten, Sätze (nach der Liste: weitere, dann gekappt).
      `gewechselt` nennt die Verweise der Kandidaten, die nach einem 409 in die Form „an der Aufgabe“ gewechselt sind (Z. 460). */
  function nachfolgerDeuten(antwortDaten, verwaist, gewechselt = new Set()) {
    const vk = kurzVerweis(verwaist);
    const gruppe = `Nachfolger von ${vk}`;
    if (antwortDaten.status !== 200) {
      const grund = antwortDaten.status === 0 ? 'keine Verbindung zum Programm.' : `${ohneSteuerzeichen(antwortDaten.fehler) || 'unbekannter Fehler'} (${antwortDaten.status}).`;
      return { art: 'fehler', gruppe, kopf: null, zusatz: null, kandidaten: [], saetze: [`Der Nachfolger ließ sich nicht suchen: ${grund}`] };
    }
    const r = antwortDaten.rumpf;
    const hinweise = r.hinweise || [];
    const kandidaten = (r.kandidaten || []).map(k => kandidatWerte(k, gewechselt.has(k.verweis)));
    const gekappt = hinweise.find(h => h.art === 'suche_gekappt');
    if (hinweise.some(h => h.art === 'merge')) return { art: 'merge', gruppe, kopf: null, zusatz: null, kandidaten: [], saetze: [MERGE_SATZ] };
    if (hinweise.some(h => h.art === 'leer')) return { art: 'leer', gruppe, kopf: null, zusatz: null, kandidaten: [], saetze: [LEER_SATZ_NF] };
    if (!kandidaten.length) {
      return { art: 'keiner', gruppe, kopf: null, zusatz: null, kandidaten, saetze: gekappt ? [gekapptSatz(gekappt.durchsucht), KEIN_NACHFOLGER] : [KEIN_NACHFOLGER_GRUND] };
    }
    const zusaetze = ['neuester zuerst'];
    if (kandidaten.some(k => k.knopf === 'ersetzen')) zusaetze.push(`„Ersetzen“ trägt ihn an der Stelle von ${vk} ein`);
    if (kandidaten.some(k => k.knopf === 'entfernen')) zusaetze.push(`„Verwaisten Verweis entfernen“ nimmt ${vk} von der Aufgabe`);
    const saetze = [];
    if (r.kandidaten_weitere > 0) saetze.push(weitereSatz(r.kandidaten_weitere));
    if (gekappt) saetze.push(gekapptSatz(gekappt.durchsucht));
    const kopf = kandidaten.length === 1 ? '1 Commit mit gleichem Patch' : `${kandidaten.length} Commits mit gleichem Patch`;
    return { art: 'kandidaten', gruppe, kopf, zusatz: zusaetze.join(' · '), kandidaten, saetze };
  }

  /** Fehler beim Ersetzen oder Entfernen (`aktion`: ersetzen | entfernen). Ein 409 des Ersetzens mit `verweis` gleich dem verwaisten
      Eintrag heißt: der Kandidat steht inzwischen an der Aufgabe — `wechsel` in die Form „an der Aufgabe“, ohne den Text des Servers (Z. 460). */
  function schreibfehlerText(aktion, { status, verweis, fehler }, verwaist, kandidat) {
    const verb = aktion === 'ersetzen' ? 'ersetzen' : 'entfernen';
    if (aktion === 'ersetzen' && status === 409 && verweis === verwaist) {
      return { wechsel: true, text: `Der Verweis ließ sich nicht ersetzen: ${kurzVerweis(kandidat)} steht inzwischen schon an der Aufgabe (409).` };
    }
    const grund = status === 0 ? 'keine Verbindung zum Programm.' : `${ohneSteuerzeichen(fehler) || 'unbekannter Fehler'} (${status}).`;
    return { wechsel: false, text: `Der Verweis ließ sich nicht ${verb}: ${grund}` };
  }

  /** Erfolgsmeldung im Statusbereich der Liste. */
  function erfolgText(aktion, verwaist, kandidat) {
    return aktion === 'ersetzen' ? `Ersetzt durch ${kurzVerweis(kandidat)}.` : `Verwaisten Verweis ${kurzVerweis(verwaist)} entfernt.`;
  }

  /* ── Zeichnen: HTML-Text aus den Zeilenwerten (R00205 FA 4–7, Artboard D0009 `#commits-ansicht`). Aller fremde Text geht durch
     `esc` (ADR-0030 Grundsatz 1), die Zustandswörter stehen als sichtbarer Text in ihrer Marke, nie in `.vh`. ── */
  const SYMBOLE = {
    'kette-offen': '<path d="M10 14a4 4 0 0 0 5 .5M14 10a4 4 0 0 0-5-.5M8 16l-2 2M16 8l2-2M4 4l16 16"/>',
    fehlt: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 3"/><path d="M9 9l6 6M15 9l-6 6"/>',
    'ordner-offen': '<path d="M3 7h7l2 2h9v11H3z"/><path d="M3 3l18 18"/>',
    frage: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01"/>',
    achtung: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    zweig: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 5-8 3-12 7"/>',
    weiter: '<path d="M9 5l7 7-7 7"/>',
    neu: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    lupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    ok: '<path d="M5 12l5 5 9-10"/>',
  };
  const symbol = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${SYMBOLE[name]}</svg>`;

  const SPALTEN = ['Commit', 'Titel', 'Autor', 'Datum', '+ / −', 'Zustand'];
  const KEINE_ANGABE = '<span aria-hidden="true">—</span><span class="vh">keine Angabe</span>';
  const GEKUERZT_HINWEIS = 'Der Titel ist bei 500 Zeichen gekürzt; vollständig steht er im Repository.';

  /** Ein Zweig als Marke; entfernte gestrichelt und mit Lesetext. Der volle Name steht im `title`. */
  const zweigMarke = (z, esc) => `<span class="cl-br${z.entfernt ? ' cl-fern' : ''}" title="${esc(z.name)}">${symbol('zweig')}<span>${esc(z.name)}</span>${z.entfernt ? '<span class="vh"> (entfernt)</span>' : ''}</span>`;

  function zweigeZelle(z, i, offen, esc, act = 'commits-klappe', kennung = `cl-zw-${i}`) {
    if (!z.sichtbar.length && !z.weitere) return '';
    const knopf = z.weitere ? `<button type="button" class="cl-mehr" data-act="${act}" data-arg="${i}" aria-expanded="${offen}" aria-controls="${kennung}" aria-label="${z.weitere === 1 ? '1 weiteren Zweig' : `${z.weitere} weitere Zweige`} ${offen ? 'verbergen' : 'zeigen'}">${symbol('weiter')}+${z.weitere} weitere</button>` : '';
    return `<span class="vh">auf Zweigen: </span><div class="cl-zweige">${z.sichtbar.map(m => zweigMarke(m, esc)).join('')}${knopf}</div>`;
  }

  /** Inhalt der vollen Zweigliste: je Liste eine Überschrift mit Zahl (eine leere entfällt), dazu der Satz zum Rest. */
  function zweigeZeilen(z, esc) {
    const liste = (titel, namen, entfernt) => namen.length ? `<p><b>${titel} ${namen.length}</b></p><p>${namen.map(name => zweigMarke({ name, entfernt }, esc)).join('')}</p>` : '';
    const rest = z.satzRest ? `<p class="cl-rest">${esc(z.satzRest)}</p>` : '';
    return `<div class="cl-zeilen">${liste('LOKALE ZWEIGE', z.lokal, false)}${liste('ENTFERNTE ZWEIGE', z.entfernt, true)}${rest}</div>`;
  }

  /** Die volle Zweigliste unter der Zeile. */
  function zweigeKlappe(z, i, esc) {
    return `<tr class="cl-zw" id="cl-zw-${i}"><td colspan="6">${zweigeZeilen(z, esc)}</td></tr>`;
  }

  function zustandsZelle(w, i, offen, esc, nf) {
    if (w.zweige) return zweigeZelle(w.zweige, i, offen, esc);
    const m = w.zustand;
    const suchen = m.zustand === 'verwaist' && nf ? suchKnopf(w.verweis, i, nf, esc) : '';
    // die Kennung der Hinweiszeile nur mit Knopf: er nennt sie als Beschreibung
    return `<span class="cl-zs cl-${m.ton}">${symbol(m.symbol)}${esc(m.wort)}</span><p class="cl-zh"${suchen ? ` id="cl-zh-${i}"` : ''}>${esc(m.hinweis)}</p>${suchen}`;
  }

  /** Ein Auslöser in der gesperrten Form nach Z. 216: ohne `data-act` (ein Klick hat keine Wirkung, `sperrenMarkieren` nimmt nichts weg),
      `aria-disabled`, die Form sofort über `data-sperrform`; der Auslöser, der gerade arbeitet, dazu `aria-busy`. */
  const gesperrt = (aktiv) => ` aria-disabled="true" data-sperrform=""${aktiv ? ' aria-busy="true"' : ''}`;

  /** „Nachfolger suchen“ am Eintrag „auf keinem Zweig“ (R00218 FA 9): gesperrt, solange an der Aufgabe gesucht oder geschrieben wird. */
  function suchKnopf(verweis, i, nf, esc) {
    const sucht = nf.laedt === verweis;
    const zustand = nf.gesperrt ? gesperrt(sucht) : ` data-act="nf-suchen" data-arg="${esc(verweis)}"`;
    return `<button type="button" class="btn nf-such" id="nf-such-${i}"${zustand} aria-describedby="cl-zh-${i}">${symbol('lupe')}Nachfolger suchen</button>`;
  }

  /** Ein Kandidat: Kurz-Hash, Titel, Autor, Datum, Zweige wie in der Liste, Knopf „Ersetzen“ bzw. „Verwaisten Verweis entfernen“. */
  function kandidatHtml(k, j, nf, esc) {
    const offen = nf.klappen.has(j);
    const meld = nf.meldung && nf.meldung.kandidat === k.verweis ? nf.meldung : null;
    const schreibtHier = nf.schreibt && nf.schreibt.kandidat === k.verweis;
    const textId = `nf-mt-${j}`;
    const beschreibung = meld && !meld.live ? ` aria-describedby="${textId}"` : '';
    const zustand = nf.gesperrt ? gesperrt(schreibtHier) : ` data-act="${k.knopf === 'entfernen' ? 'nf-entfernen' : 'nf-ersetzen'}" data-arg="${j}"`;
    const name = k.knopf === 'entfernen' ? '' : ` aria-label="${esc(k.name)}"`;
    const knopf = `<button type="button" class="btn nf-knopf" id="nf-knopf-${j}"${zustand}${name}${beschreibung}>${k.knopf === 'entfernen' ? 'Verwaisten Verweis entfernen' : 'Ersetzen'}</button>`;
    const marke = k.marke ? `<span class="cl-zs cl-warn nf-marke">${esc(k.marke)}</span>` : '';
    const titel = `<span class="nf-t">${esc(k.titel)}${k.gekuerzt ? `<span class="cl-kurz" title="${esc(GEKUERZT_HINWEIS)}">gekürzt</span>` : ''}${marke}</span>`;
    const zweige = `<span class="nf-z">${zweigeZelle(k.zweige, j, offen, esc, 'nf-klappe', `nf-zw-${j}`)}</span>`;
    const klappe = offen ? `<div class="nf-zw" id="nf-zw-${j}">${zweigeZeilen(k.zweige, esc)}</div>` : '';
    // Live-Region nur, solange geschrieben wird oder ein Fehler am Auslöser steht (AK 13); der Satz nach dem 409-Wechsel ist Beschreibung
    const liveRegion = schreibtHier || (meld && meld.live) ? `<p class="nf-meld" id="nf-meld" role="status">${meld && meld.live ? esc(meld.text) : ''}</p>` : '';
    const satz = meld && !meld.live ? `<p class="nf-meld" id="${textId}">${esc(meld.text)}</p>` : '';
    return `<li class="nf-k"><span class="nf-h">${esc(k.kurz)}</span>${titel}<span class="nf-a">${esc(k.autor)}</span><span class="nf-d"><span title="${esc(k.datumTitel)}">${esc(k.datum)}</span></span>${zweige}${klappe}<span class="nf-akt">${knopf}</span>${liveRegion}${satz}</li>`;
  }

  /** Das Ergebnis der Suche als eigene Zeile unter dem Eintrag (Zeichnung D0009 `#nachfolger`): beim Laden nur der Satz (angesagt wird er im
      Statusbereich der Liste), sonst die Gruppe „Nachfolger von …“ mit dem ersten Satz als Beschreibung und ohne Live-Region (AK 13). */
  function nachfolgerZeile(nf, esc) {
    if (nf.laedt) return `<tr class="nfz"><td colspan="6"><p class="nf-laedt">${esc(NACHFOLGER_LAEDT)}</p></td></tr>`;
    const d = nf.deutung;
    const erster = d.kopf ? `<p class="nf-kopf" id="nf-erster"><b>${esc(d.kopf)}</b><span>${esc(d.zusatz)}</span></p>` : `<p class="nf-satz" id="nf-erster">${esc(d.saetze[0])}</p>`;
    const liste = d.kandidaten.length ? `<ul class="nf-l" aria-label="Kandidaten">${d.kandidaten.map((k, j) => kandidatHtml(k, j, nf, esc)).join('')}</ul>` : '';
    const saetze = (d.kopf ? d.saetze : d.saetze.slice(1)).map(t => `<p class="nf-satz">${esc(t)}</p>`).join('');
    const erneut = d.art === 'fehler' ? `<button type="button" class="btn nf-erneut" id="nf-erneut"${nf.gesperrt ? gesperrt(false) : ` data-act="nf-suchen" data-arg="${esc(nf.verweis)}"`}>Erneut versuchen</button>` : '';
    return `<tr class="nfz"><td colspan="6"><div class="nf${d.art === 'fehler' ? ' nf-fehler' : ''}" id="nf-gruppe" role="group" aria-label="${esc(d.gruppe)}" aria-describedby="nf-erster" tabindex="-1">${erster}${liste}${saetze}${erneut}</div></td></tr>`;
  }


  /** Zustandswort im Namen des Verweises (R00207 FA 1): „auf Zweig <name>“, „auf <n> Zweigen“ oder das Wort des Zustands. */
  function zustandImNamen(w) {
    if (!w.zweige) return w.zustand ? w.zustand.wort : '';
    const z = w.zweige, alle = [...z.lokal, ...z.entfernt];
    const anzahl = alle.length + z.nichtAufgefuehrt;
    return anzahl === 1 ? `auf Zweig ${alle[0]}` : `auf ${anzahl} Zweigen`;
  }

  /** Einträge mit Diff (R00206): nur sie tragen einen Verweis auf die Review-Seite. */
  const MIT_DIFF = ['auf_zweig', 'verwaist'];

  /** Der Kurz-Hash: mit `ziel` und Diff genau ein Verweis je Zeile, dessen Fläche per `::after` die ganze Zeile ist (R00207 FA 1, PO Z. 425). */
  function hashHtml(e, w, esc, ziel) {
    if (ziel && MIT_DIFF.includes(e.zustand) && e.hash) {
      const name = `Commit ${w.kurz}, ${w.titel || ''}, ${zustandImNamen(w)}`;
      return `<a class="cl-hash cl-ziel" href="${esc(ziel(e.verweis))}" data-act="review-oeffnen" data-arg="${esc(e.verweis)}" aria-label="${esc(name)}" title="${esc(w.verweis)}">${esc(w.kurz)}</a>`;
    }
    return `<span class="cl-hash${e.hash ? '' : ' cl-roh'}" title="${esc(w.verweis)}">${esc(w.kurz)}</span>`;
  }

  function zeileHtml(e, i, offen, esc, ziel, nf) {
    const w = zeilenwerte(e);
    const wert = text => (w.ohneMetadaten ? KEINE_ANGABE : text);
    const titel = wert(`${esc(w.titel)}${w.gekuerzt ? `<span class="cl-kurz" title="${esc(GEKUERZT_HINWEIS)}">gekürzt</span>` : ''}`);
    const datum = wert(`<span title="${esc(w.datumTitel)}">${esc(w.datum)}</span>`);
    const zahlen = wert(w.zahlen && `<span class="cl-pl">+${tausender(e.plus)}</span> <span class="cl-mi">−${tausender(e.minus)}</span><span class="vh"> Zeilen</span>`);
    const hash = hashHtml(e, w, esc, ziel);
    const zeile = `<tr class="cl-z${w.ohneMetadaten ? ' cl-ohne' : ''}"><th scope="row" class="cl-c-hash">${hash}</th><td class="cl-c-titel">${titel}</td><td class="cl-c-autor">${wert(esc(w.autor))}</td><td class="cl-c-datum">${datum}</td><td class="cl-c-pm cl-r">${zahlen}</td><td class="cl-c-zst">${zustandsZelle(w, i, offen, esc, nf)}</td></tr>`;
    const mitKlappe = offen && w.zweige ? zeile + zweigeKlappe(w.zweige, i, esc) : zeile;
    return nf && nf.verweis === e.verweis && (nf.laedt || nf.deutung) ? mitKlappe + nachfolgerZeile(nf, esc) : mitKlappe;
  }

  /** Die Tabelle der Liste im querscrollbaren Rahmen (Gruppe mit Namen, per Tab fokussierbar). `klappen` nennt die Zeilen mit offener Zweigliste. */
  function commitsListeHtml(eintraege, klappen, esc, ziel = null, nf = null) {
    const kopf = SPALTEN.map(name => `<th scope="col"${name === '+ / −' ? ' class="cl-r"' : ''}>${name}</th>`).join('');
    const zeilen = eintraege.map((e, i) => zeileHtml(e, i, klappen.has(i), esc, ziel, nf)).join('');
    return `<div class="cl-rahmen" tabindex="0" role="group" aria-label="Commits dieser Aufgabe, ältester zuerst"><table class="cl-tab"><thead><tr>${kopf}</tr></thead><tbody>${zeilen}</tbody></table></div>`;
  }

  /** Kopf der Ansicht: „COMMITS“ mit der Zahl der Einträge (ohne Zahl, solange gelesen wird). */
  function commitsKopfHtml(anzahl, alleZiel = null) {
    // „Alle Änderungen ansehen“ führt in B2 auf …/review, auch ohne Eintrag mit Diff (R00207 FA 1, ADR-0033 Punkt 9)
    const alle = alleZiel ? `<a class="btn cl-alle" href="${alleZiel}" data-act="review-oeffnen" data-arg="">Alle Änderungen ansehen</a>` : '';
    return `<div class="cl-kopf"><h3>COMMITS ${anzahl == null ? '' : `<span class="mono">${anzahl}</span>`}</h3><span class="cl-hin">an dieser Aufgabe hinterlegt · ältester zuerst</span>${alle}</div>`;
  }

  /** Fuß: „liest nur“ mit der Uhrzeit der letzten erfolgreichen Antwort und „Neu lesen“; beim Lesen `aria-disabled` statt `disabled`, damit der Fokus bleibt. */
  function commitsFussHtml({ stand, laedt }) {
    // Beim Lesen ohne `data-act`: `sperrenMarkieren` (app.js) nimmt jedes `aria-disabled` an einem Auslöser mit `data-act` beim Zeichnen wieder weg,
    // und ohne Auslöser hat ein zweiter Klick von selbst keine Wirkung.
    const knopf = `<button type="button" class="cl-textknopf" id="commits-neu"${laedt ? ' aria-disabled="true"' : ' data-act="commits-lesen"'}>${symbol('neu')}Neu lesen</button>`;
    return `<div class="cl-fuss"><span>liest nur · gelesen aus dem Repository der Anwendung${stand ? ` · Stand ${stand}` : ''}</span>${knopf}</div>`;
  }

  /** Der eine Statusbereich der Ansicht (R00205 AK 6/10): in jedem Zustand ein `div` mit derselben Kennung, damit er beim Neuzeichnen
      als derselbe Knoten stehen bleibt und nur seine Klasse und sein Text wechseln. */
  const statusBereich = (klasse, text, esc) => `<div class="${klasse}" id="commits-status" role="status">${esc(text)}</div>`;
  const LEER_SATZ = 'Ein Agent hinterlegt sie über die API (<span class="mono">POST /api/aufgaben/{nr}/commits</span>); siehe Endpunktliste unter <a href="/api" target="_blank" rel="noopener">/api</a>.';

  /** Inhalt der Ansicht je Zustand: Laden (Hinweis im Statusbereich), Fehler (Meldung im Statusbereich), leer und Liste (Statusbereich nur zum Vorlesen). */
  function inhaltHtml(c, esc, ziel) {
    if (c.status === 'laedt') return statusBereich('cl-laedt', 'Liest die Commits aus dem Repository …', esc);
    if (c.status === 'fehler') {
      const knopf = '<button type="button" class="cl-knopf" id="commits-erneut" data-act="commits-lesen">Erneut versuchen</button>';
      return `<div class="cl-meld">${symbol('achtung')}${statusBereich('cl-meldtext', fehlerText(c.fehler), esc)}${knopf}</div>`;
    }
    // Der eine Statusbereich trägt in der Liste „… gelesen“, beim Suchen „Sucht …“ und nach dem Ersetzen oder Entfernen den Erfolg — sichtbar im
    // Kopf der Liste (R00218 AK 9, 13); still nachgelesen bleibt sein Text (kein „… Commits gelesen“ nach dem Ersetzen)
    const ansage = statusBereich(c.erfolg ? 'nf-ok' : 'vh', c.ansage != null ? c.ansage : gelesenText(c.eintraege.length), esc);
    if (!c.eintraege.length) return `${ansage}<div class="cl-leer">An dieser Aufgabe sind keine Commits hinterlegt.<br><span>${LEER_SATZ}</span></div>`;
    return ansage + commitsListeHtml(c.eintraege, c.klappen, esc, ziel, c.nfAnsicht || null);
  }

  /** Die ganze Ansicht „Commits“ aus dem Zustand der Oberfläche (`S.ui.commits`): `{status, eintraege, stand, fehler, klappen}`;
      `ziel(verweis)` bildet die Adresse der Review-Seite (ohne Verweis: `…/review`). */
  function commitsAnsichtHtml(c, esc, ziel = null) {
    const anzahl = c.status === 'liste' && c.eintraege.length ? c.eintraege.length : null;
    return `<div class="mod-main cl-panel">${commitsKopfHtml(anzahl, ziel && esc(ziel(null)))}${inhaltHtml(c, esc, ziel)}${commitsFussHtml({ stand: c.stand, laedt: c.status === 'laedt' })}</div>`;
  }

  Object.assign(ziel, { ZUSTANDSWOERTER, anwendungName, zustandSatz, zustandsSymbol: symbol, NACHFOLGER_LAEDT, nachfolgerDeuten, schreibfehlerText, erfolgText, kurzVerweis, kurzform, titelGekuerzt, zahlenText, datumText, zustandsmarke, zweigmarken, zeilenwerte, fehlerText, gelesenText, commitsListeHtml, commitsKopfHtml, commitsFussHtml, commitsAnsichtHtml });
})(typeof module !== 'undefined' ? module.exports : window);
