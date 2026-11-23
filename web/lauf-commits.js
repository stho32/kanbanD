/* kanbanD — Commit-Marker der Laufansicht (R00251, ADR-0041 N7 Punkte 2, 3, 7, 8): welcher Commit der Karte zu welchem Schritt des
   Laufs gehört, rein gerechnet über Titel und Autordatum im Fenster des Aufrufs, nie über den Hash des Transkripts. Kennt weder DOM noch
   `fetch`; im Browser und in Node nutzbar. */
(function (ziel) {
  "use strict";

  const COMMIT_GRENZEN = Object.freeze({ commits: 500, marker: 1000, befehl: 65536, titel: 60, belegTitel: 12 });

  /**
   * Zeilen `[{nr, eintrag}]`, die Schritte der Auswertung und die Commits der Karte (`GET …/commits`) → `{marker, mehrAlsGrenze,
   * titelpruefungen}`. `marker` ordnet der Nummer eines Schritts seine Marker zu, in der Reihenfolge des Laufs höchstens
   * `COMMIT_GRENZEN.marker`: `{art: 'link', verweis, kurzhash, titel}` aus der Karte oder `{art: 'text', kurzhash, titel}` aus der
   * Belegzeile (`kurzhash` null ohne Hex). `titelpruefungen` zählt jeden Vergleich eines Titels mit einem Befehl.
   */
  function commitMarker(zeilen, schritte, karte) {
    const commits = verlinkbareCommitsNachAutordatum(karte);
    const kandidaten = befehlsSchritte(zeilen, schritte);
    const zuordnung = commitsZuordnen(kandidaten, commits);
    const marker = new Map();
    for (const k of kandidaten) {
      const eigene = zuordnung.jeSchritt.get(k.nr);
      let liste = eigene.map(linkMarker);
      if (!eigene.length) liste = textMarker(k);
      if (liste.length) marker.set(k.nr, liste);
    }
    return { ...begrenzt(marker), titelpruefungen: zuordnung.titelpruefungen };
  }

  /* ── Die Commits der Karte: nur, was einen Link tragen darf, sortiert nach Autordatum ── */

  const VERWEIS_FORM = /^([a-z0-9]{1,8}:)?[0-9a-fA-F]{7,64}$/;
  const HASH_DER_KARTE = /^[0-9a-f]{7,64}$/;
  const ZUSTAENDE_MIT_COMMIT = ['auf_zweig', 'verwaist'];

  /** Höchstens 500 Einträge der Karte; zugeordnet wird nur ein Commit mit Zustand `auf_zweig`/`verwaist`, Verweis nach `VERWEIS_FORM`,
      Hash als Hex, Titel als Text und Autordatum als ganze Zahl. Sortiert nach Autordatum, bei Gleichstand nach der Stelle in der Karte. */
  function verlinkbareCommitsNachAutordatum(karte) {
    const eintraege = Array.isArray(karte) ? karte.slice(0, COMMIT_GRENZEN.commits) : [];
    const commits = [];
    eintraege.forEach((e, stelle) => {
      if (!verlinkbar(e)) return;
      commits.push({ verweis: e.verweis, hash: e.hash, titel: e.titel, autordatum: e.autordatum, stelle, kopf: Array.from(e.titel).slice(0, COMMIT_GRENZEN.titel).join('') });
    });
    return commits.sort((a, b) => a.autordatum - b.autordatum || a.stelle - b.stelle);
  }

  function verlinkbar(e) {
    if (e === null || typeof e !== 'object' || !ZUSTAENDE_MIT_COMMIT.includes(e.zustand)) return false;
    if (typeof e.verweis !== 'string' || !VERWEIS_FORM.test(e.verweis)) return false;
    if (typeof e.hash !== 'string' || !HASH_DER_KARTE.test(e.hash)) return false;
    return typeof e.titel === 'string' && e.titel.length > 0 && Number.isSafeInteger(e.autordatum);
  }

  /* ── Die Schritte, deren Befehl durchsucht wird: Bash-Aufrufe mit Befehl bis 64 KiB, dazu ihr Fenster in Sekunden ── */

  /** Je Bash-Aufruf `{nr, befehl, ergebnis, fenster}`; `fenster` ist `{von, bis}` oder null, wenn Aufruf oder Ergebnis keine gültige
      `zeit` tragen. Ohne Ergebnis reicht das Fenster bis zur `zeit` des nächsten Eintrags mit Zeit. */
  function befehlsSchritte(zeilen, schritte) {
    const eintragAm = new Map(zeilen.map(z => [z.nr, z.eintrag]));
    const zeiten = zeilen.map(z => ({ nr: z.nr, ms: z.eintrag ? zeitMs(z.eintrag.zeit) : null })).filter(z => z.ms !== null);
    const kandidaten = [];
    for (const s of schritte) {
      if (!s.aufruf || s.name !== 'Bash') continue;
      const befehl = befehlText(eintragAm.get(s.nr).text);
      if (befehl.length > COMMIT_GRENZEN.befehl) continue;
      let ergebnis = null;
      if (s.ergebnisNr !== null) ergebnis = eintragAm.get(s.ergebnisNr);
      kandidaten.push({ nr: s.nr, befehl, ergebnis, fenster: fensterVon(s, eintragAm, ergebnis, zeiten), commitWort: /\bcommit\b/.test(befehl) });
    }
    return kandidaten;
  }

  /** `floor(zeit Aufruf) ≤ autordatum ≤ floor(zeit Ergebnis) + 1` in Sekunden. */
  function fensterVon(s, eintragAm, ergebnis, zeiten) {
    const beginn = zeitMs(eintragAm.get(s.nr).zeit);
    if (beginn === null) return null;
    let ende = null;
    if (ergebnis) ende = zeitMs(ergebnis.zeit);
    if (!ergebnis) ende = naechsteZeitNach(s.nr, zeiten);
    if (ende === null) return null;
    return { von: Math.floor(beginn / 1000), bis: Math.floor(ende / 1000) + 1 };
  }

  function naechsteZeitNach(nr, zeiten) {
    const naechste = zeiten.find(z => z.nr > nr);
    if (!naechste) return null;
    return naechste.ms;
  }

  const ISO_MIT_VERSATZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
  function zeitMs(zeit) {
    if (typeof zeit !== 'string' || !ISO_MIT_VERSATZ.test(zeit)) return null;
    const ms = new Date(zeit).getTime();
    if (Number.isNaN(ms)) return null;
    return ms;
  }

  /** `command` des JSON, sonst der ganze Text des Aufrufs. */
  function befehlText(text) {
    try {
      const o = JSON.parse(text);
      if (o !== null && typeof o === 'object' && typeof o.command === 'string') return o.command;
    } catch (_) { /* kein JSON: der Text selbst ist der Befehl */ }
    return text;
  }

  /* ── Zuordnung (N7 Punkt 2): Titel-Treffer zuerst, der frühere Schritt gewinnt; Rückfall nur bei Eindeutigkeit ── */

  function commitsZuordnen(kandidaten, commits) {
    let titelpruefungen = 0;
    const imFenster = new Map(), titelTreffer = [], commitSchritteJeCommit = new Map();
    for (const k of kandidaten) {
      const liste = k.fenster ? commitsImFenster(commits, k.fenster) : [];
      imFenster.set(k.nr, liste);
      for (const c of liste) {
        titelpruefungen++;
        const stelle = k.befehl.indexOf(c.kopf);
        if (stelle >= 0) titelTreffer.push({ k, c, stelle });
        if (k.commitWort) commitSchritteJeCommit.set(c, (commitSchritteJeCommit.get(c) || 0) + 1);
      }
    }
    const gehoert = new Map();
    for (const t of titelTreffer) if (!gehoert.has(t.c)) gehoert.set(t.c, t);
    for (const k of kandidaten) {
      const liste = imFenster.get(k.nr);
      const rueckfall = liste.length === 1 && k.commitWort && !gehoert.has(liste[0]) && commitSchritteJeCommit.get(liste[0]) === 1;
      if (rueckfall) gehoert.set(liste[0], { k, c: liste[0], stelle: Infinity });
    }
    const jeSchritt = new Map(kandidaten.map(k => [k.nr, []]));
    for (const t of gehoert.values()) jeSchritt.get(t.k.nr).push(t);
    for (const liste of jeSchritt.values()) liste.sort((a, b) => a.c.autordatum - b.c.autordatum || a.stelle - b.stelle || a.c.stelle - b.c.stelle);
    for (const [nr, liste] of jeSchritt) jeSchritt.set(nr, liste.map(t => t.c));
    return { jeSchritt, titelpruefungen };
  }

  /** Die Commits mit `von ≤ autordatum ≤ bis` aus der nach Autordatum sortierten Liste: Anfang per Halbierung, dann nur die Treffer. */
  function commitsImFenster(commits, { von, bis }) {
    let unten = 0, oben = commits.length;
    while (unten < oben) {
      const mitte = (unten + oben) >> 1;
      if (commits[mitte].autordatum < von) unten = mitte + 1;
      else oben = mitte;
    }
    const treffer = [];
    for (let i = unten; i < commits.length && commits[i].autordatum <= bis; i++) treffer.push(commits[i]);
    return treffer;
  }

  const linkMarker = c => ({ art: 'link', verweis: c.verweis, kurzhash: c.hash.slice(0, 7), titel: c.titel });

  /* ── Text-Marker aus der Belegzeile (N7 Punkt 3) ── */

  const BELEG_MIT_ZWEIG = /^\[[^\]]* (\S{7,40})\] (.+)$/;
  const BELEG_EINZEILER = /^(\S{7,12}) (.+)$/;
  const HASH_DER_BELEGZEILE = /^[0-9a-f]{7,40}$/;

  /** Ein Schritt ohne Commit der Karte, dessen Befehl `commit` sagt: je Zeile `[<zweig> <hash>] <titel>` oder `<hash> <titel>` im
      Ergebnis ein Text-Marker, wenn der Titel mindestens 12 Zeichen hat und im Befehl steht. Der Hash ist der des Worktrees: er wird nur
      gezeigt, und nur als Hex. */
  function textMarker(k) {
    if (!k.commitWort || !k.ergebnis) return [];
    const marker = [], gesehen = new Set();
    for (const zeile of k.ergebnis.text.split('\n')) {
      const beleg = belegzeileLesen(zeile.replace(/\r$/, ''));
      if (!beleg || gesehen.has(zeile) || Array.from(beleg.titel).length < COMMIT_GRENZEN.belegTitel || !k.befehl.includes(beleg.titel)) continue;
      gesehen.add(zeile);
      let kurzhash = null;
      if (HASH_DER_BELEGZEILE.test(beleg.hash)) kurzhash = beleg.hash.slice(0, 7);
      marker.push({ art: 'text', kurzhash, titel: beleg.titel });
    }
    return marker;
  }

  function belegzeileLesen(zeile) {
    const treffer = BELEG_MIT_ZWEIG.exec(zeile) || BELEG_EINZEILER.exec(zeile);
    if (!treffer) return null;
    return { hash: treffer[1], titel: treffer[2] };
  }

  /* ── Grenze der Marker (N7 Punkt 8): die ersten 1.000 in der Reihenfolge des Laufs ── */

  function begrenzt(marker) {
    const gekappt = new Map();
    let frei = COMMIT_GRENZEN.marker, mehrAlsGrenze = false;
    for (const nr of [...marker.keys()].sort((a, b) => a - b)) {
      const liste = marker.get(nr);
      if (liste.length > frei) mehrAlsGrenze = true;
      if (frei > 0) gekappt.set(nr, liste.slice(0, frei));
      frei = Math.max(0, frei - liste.length);
    }
    return { marker: gekappt, mehrAlsGrenze };
  }

  Object.assign(ziel, { commitMarker, COMMIT_GRENZEN });
})(typeof module !== 'undefined' ? module.exports : window);
