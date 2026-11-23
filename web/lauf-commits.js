/* kanbanD — Commit-Marker der Laufansicht (R00251, ADR-0041 N7 Punkte 2, 3, 7, 8): welcher Commit der Karte zu welchem Schritt des
   Laufs gehört, rein gerechnet über Titel und Autordatum im Fenster des Aufrufs, nie über den Hash des Transkripts. Kennt weder DOM noch
   `fetch`; im Browser und in Node nutzbar. */
(function (ziel) {
  "use strict";

  /* `vergleiche` und `vergleichsZeichen` begrenzen die Titelvergleiche eines Laufs (Paare Schritt × Commit im Fenster) und die dabei
     durchsuchten Zeichen der Befehle (PO Z. 710). Gemessen 2026-11-23 an allen 296 echten Läufen mit Transkript: höchstens 11 Vergleiche
     und 14.728 Zeichen; die Grenzen liegen weit darüber und begrenzen den schlimmsten Lauf (gleiche Titel, Befehle aus „a“) auf rund
     4.200 Vergleiche (beobachtet 0,1–0,2 s statt 17 s). Die Suche der Belegtitel bucht dieselben Grenzen in eigenem Topf (Nacharbeit 2):
     an 300 echten Läufen höchstens 25 Suchen und 28.148 Zeichen. */
  const COMMIT_GRENZEN = Object.freeze({ commits: 500, marker: 1000, befehl: 65536, titel: 60, belegTitel: 12, vergleiche: 10000, vergleichsZeichen: 16777216 });

  /**
   * Zeilen `[{nr, eintrag}]`, die Schritte der Auswertung und die Commits der Karte (`GET …/commits`) → `{marker, mehrAlsGrenze,
   * teilweise, titelpruefungen, verglicheneZeichen, fensterzugriffe}`. `marker` ordnet der Nummer eines Schritts seine Marker zu, in
   * der Reihenfolge des Laufs höchstens `COMMIT_GRENZEN.marker`: `{art: 'link', verweis, kurzhash, titel}` aus der Karte oder
   * `{art: 'text', kurzhash, titel}` aus der Belegzeile. `titelpruefungen` zählt jeden Vergleich eines Titels mit einem Befehl,
   * `verglicheneZeichen` die Zeichen der dabei durchsuchten Befehle, `fensterzugriffe` jeden Blick auf einen Commit bei der Suche
   * nach dem Fenster (Lehre „Grenzen, die Arbeit begrenzen“: Zähler am einzigen Leseort). `belegvergleiche` und `belegZeichen` zählen
   * die Suchen der Belegtitel im Befehl (Text-Marker) mit denselben Grenzen über `vergleichBuchen`, in eigenem Topf, damit nach dem
   * Abbruch der Zuordnung Belegzeilen weiter Text-Marker werden (PO Z. 710). `teilweise`: eine der beiden Grenzen hat abgebrochen.
   */
  function commitMarker(zeilen, schritte, karte) {
    const commits = verlinkbareCommitsNachAutordatum(karte);
    const kandidaten = befehlsSchritte(zeilen, schritte);
    const zuordnung = commitsZuordnen(kandidaten, commits);
    const belege = { vergleiche: 0, zeichen: 0, abgebrochen: false };
    const marker = new Map();
    for (const k of kandidaten) {
      const eigene = zuordnung.jeSchritt.get(k.nr);
      let liste = eigene.map(linkMarker);
      if (!eigene.length && !belege.abgebrochen) liste = textMarker(k, belege);
      if (liste.length) marker.set(k.nr, liste);
    }
    const { titelpruefungen, verglicheneZeichen, fensterzugriffe } = zuordnung;
    const teilweise = zuordnung.teilweise || belege.abgebrochen;
    return { ...begrenzt(marker), teilweise, titelpruefungen, verglicheneZeichen, fensterzugriffe, belegvergleiche: belege.vergleiche, belegZeichen: belege.zeichen };
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

  /* Ein `git commit`-Aufruf: `git`, davor Anfang oder Trenner, danach nur globale Optionen (`-C <pfad>`, `-c <name=wert>`, `--x[=y]`),
     dann `commit` (Code-Review Sollte 3: nicht `pre-commit`, kein Kommentar, kein `git log … commit`); gefangen werden seine Argumente
     bis zum nächsten Trenner. `-C`/`-c` nehmen immer das nächste Wort, eine andere Option nie: so gibt es je Stelle nur eine Lesart und
     kein Zurückverfolgen über viele Optionen. */
  const GIT_COMMIT = /(?:^|[\s;&|()])git(?:\s+-[Cc]\s+[^\s;&|]+|\s+--?(?![Cc](?:\s|$))[A-Za-z][\w-]*(?:=[^\s;&|]+)?)*\s+commit(?=$|[\s;&|)])([^;&|\n]*)/gm;
  /* `--amend` unter den Argumenten eines `git commit` (PO Z. 712, R00251 „Nicht Teil“) — nicht irgendwo im Befehl, etwa in einem Heredoc. */
  const AMEND = /(?:^|\s)--amend(?=$|[\s)=])/;

  /** `{commitWort, amend}`: ruft der Befehl `git commit` auf, und trägt einer dieser Aufrufe `--amend`? */
  function commitAufruf(befehl) {
    const argumente = [...befehl.matchAll(GIT_COMMIT)].map(m => m[1]);
    return { commitWort: argumente.length > 0, amend: argumente.some(a => AMEND.test(a)) };
  }

  /** Je Bash-Aufruf `{nr, befehl, ergebnis, fenster, commitWort, amend}`; `fenster` ist `{von, bis}` oder null, wenn Aufruf oder
      Ergebnis keine gültige `zeit` tragen. Ohne Ergebnis reicht das Fenster bis zur `zeit` des nächsten Eintrags mit Zeit. */
  function befehlsSchritte(zeilen, schritte) {
    const eintragAm = new Map(zeilen.map(z => [z.nr, z.eintrag]));
    const zeiten = zeilen.map(z => ({ nr: z.nr, ms: z.eintrag ? zeitMs(z.eintrag.zeit) : null })).filter(z => z.ms !== null);
    const kandidaten = [];
    for (const s of schritte) {
      if (!s.aufruf || s.name !== 'Bash') continue;
      const befehl = befehlText(eintragAm.get(s.nr).text);
      if (befehl.length > COMMIT_GRENZEN.befehl) continue;
      const ergebnis = eintragAm.get(s.ergebnisNr) || null;
      kandidaten.push({ nr: s.nr, befehl, ergebnis, fenster: fensterVon(s, eintragAm, ergebnis, zeiten), ...commitAufruf(befehl) });
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

  /* ── Zuordnung (N7 Punkt 2): Titel-Treffer zuerst, der frühere Schritt gewinnt; Rückfall nur bei Eindeutigkeit. Ein `--amend`-Schritt
     vergleicht nicht und bekommt nichts, zählt aber für die Eindeutigkeit des Rückfalls mit. Erreicht ein Vergleich die Grenze,
     endet die Zuordnung dort: die übrigen Schritte bleiben ohne Link, und ohne vollständige Zählung gibt es keinen Rückfall. ── */

  function commitsZuordnen(kandidaten, commits) {
    const zaehler = { zugriffe: 0, vergleiche: 0, zeichen: 0 };
    const imFenster = new Map(), titelTreffer = [], commitSchritteJeCommit = new Map();
    let teilweise = false;
    for (const k of kandidaten) {
      let liste = [];
      if (k.fenster) liste = commitsImFenster(commits, k.fenster, zaehler);
      imFenster.set(k.nr, liste);
      for (const c of liste) {
        if (k.commitWort) commitSchritteJeCommit.set(c, (commitSchritteJeCommit.get(c) || 0) + 1);
        if (k.amend) continue;
        if (!vergleichBuchen(zaehler, k.befehl.length)) { teilweise = true; break; }
        const stelle = k.befehl.indexOf(c.kopf);
        if (stelle >= 0) titelTreffer.push({ k, c, stelle });
      }
      if (teilweise) break;
    }
    const gehoert = new Map();
    for (const t of titelTreffer) if (!gehoert.has(t.c)) gehoert.set(t.c, t);
    if (!teilweise) for (const k of kandidaten) {
      const liste = imFenster.get(k.nr);
      const rueckfall = liste.length === 1 && k.commitWort && !k.amend && !gehoert.has(liste[0]) && commitSchritteJeCommit.get(liste[0]) === 1;
      if (rueckfall) gehoert.set(liste[0], { k, c: liste[0], stelle: Infinity });
    }
    const jeSchritt = new Map(kandidaten.map(k => [k.nr, []]));
    for (const t of gehoert.values()) jeSchritt.get(t.k.nr).push(t);
    for (const liste of jeSchritt.values()) liste.sort((a, b) => a.c.autordatum - b.c.autordatum || a.stelle - b.stelle || a.c.stelle - b.c.stelle);
    for (const [nr, liste] of jeSchritt) jeSchritt.set(nr, liste.map(t => t.c));
    return { jeSchritt, teilweise, titelpruefungen: zaehler.vergleiche, verglicheneZeichen: zaehler.zeichen, fensterzugriffe: zaehler.zugriffe };
  }

  /** Bucht einen Vergleich (Titel der Karte bzw. Titel einer Belegzeile) mit einem Befehl von `zeichen` Zeichen; false, wenn er eine
      der beiden Grenzen überschritte. Der einzige Ort, der Vergleiche zählt. */
  function vergleichBuchen(zaehler, zeichen) {
    if (zaehler.vergleiche >= COMMIT_GRENZEN.vergleiche || zaehler.zeichen + zeichen > COMMIT_GRENZEN.vergleichsZeichen) return false;
    zaehler.vergleiche++;
    zaehler.zeichen += zeichen;
    return true;
  }

  /** Die Commits mit `von ≤ autordatum ≤ bis` aus der nach Autordatum sortierten Liste: Anfang per Halbierung, dann nur die Treffer. */
  function commitsImFenster(commits, { von, bis }, zaehler) {
    const ansehen = i => { zaehler.zugriffe++; return commits[i]; };
    let unten = 0, oben = commits.length;
    while (unten < oben) {
      const mitte = (unten + oben) >> 1;
      if (ansehen(mitte).autordatum < von) unten = mitte + 1;
      else oben = mitte;
    }
    const treffer = [];
    for (let i = unten; i < commits.length && ansehen(i).autordatum <= bis; i++) treffer.push(commits[i]);
    return treffer;
  }

  const linkMarker = c => ({ art: 'link', verweis: c.verweis, kurzhash: c.hash.slice(0, 7), titel: c.titel });

  /* ── Text-Marker aus der Belegzeile (N7 Punkt 3) ── */

  /* Die einzeilige Bestätigung mit Hex-Wort (PO Z. 713): `[<zweig> <hex7–40>] <titel>` oder `<hex7–12> <titel>`; alles andere ist kein
     Beleg. */
  const BELEG_MIT_ZWEIG = /^\[[^\]]* ([0-9a-f]{7,40})\] (.+)$/;
  const BELEG_EINZEILER = /^([0-9a-f]{7,12}) (.+)$/;

  /** Ein Schritt ohne Commit der Karte, der `git commit` aufruft (nicht `--amend`): je Belegzeile im Ergebnis ein Text-Marker, wenn der
      Titel mindestens 12 Zeichen hat und im Befehl steht. Jede Suche im Befehl bucht `vergleichBuchen` auf `belege` (Security-Review
      #269 Muss 3); würde sie eine Grenze überschreiten, endet die Belegsuche des Laufs dort (`belege.abgebrochen`), gefundene Marker
      bleiben. Der Hash ist der des Worktrees: er wird nur gezeigt. */
  function textMarker(k, belege) {
    if (!k.commitWort || k.amend || !k.ergebnis) return [];
    const marker = [], gesehen = new Set();
    for (const zeile of k.ergebnis.text.split('\n')) {
      const beleg = belegzeileLesen(zeile.replace(/\r$/, ''));
      if (!beleg || gesehen.has(zeile) || Array.from(beleg.titel).length < COMMIT_GRENZEN.belegTitel) continue;
      if (!vergleichBuchen(belege, k.befehl.length)) { belege.abgebrochen = true; break; }
      if (!k.befehl.includes(beleg.titel)) continue;
      gesehen.add(zeile);
      marker.push({ art: 'text', kurzhash: beleg.hash.slice(0, 7), titel: beleg.titel });
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
      frei -= liste.length;
    }
    return { marker: gekappt, mehrAlsGrenze };
  }

  Object.assign(ziel, { commitMarker, COMMIT_GRENZEN });
})(typeof module !== 'undefined' ? module.exports : window);
