/* kanbanD — Review-Seite „Alle Änderungen der Aufgabe“ (R00210, ADR-0033 N1): reine Rechnung, im Browser und in Node (Unit-Tests)
   nutzbar wie diff.js. Fremder Text geht hier unverändert durch; maskiert wird erst beim Zeichnen (esc, sichtbarHtml). */
(function (ziel) {
  'use strict';
  const diff = typeof module !== 'undefined' ? require('./diff.js') : window;
  const { kurzVerweis, tausender, zuordnen, STATUSWORT } = diff;
  const { zustandsmarke, zustandSatz, zustandsSymbol } = typeof module !== 'undefined' ? require('./commits.js') : window;

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

  /** Die Anwendungen der Aufgabe aus der Liste der Commits, wenn die erste Antwort 404 mit `zustand` ist (R00224 FA 3): jedes Kürzel
      einmal, auch das leere, in der Reihenfolge des ersten Auftretens; seitenweite Zustände nennen keine erreichbare Anwendung. */
  function anwendungenAusListe(eintraege) {
    const kuerzel = eintraege.filter(e => !SEITENWEIT.includes(e.zustand)).map(e => e.anwendung || '');
    return [...new Set(kuerzel)];
  }

  /** Seitenweite Hinweise aus der Liste (R00224 FA 4) in der Form der Hinweise einer Antwort, für `seitenHinweise`. */
  function listenHinweise(eintraege) {
    return eintraege.filter(e => SEITENWEIT.includes(e.zustand)).map(e => ({ art: 'ausgelassen', verweis: e.verweis, zustand: e.zustand }));
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
  function abschnittSummen(abschnitte) {
    const da = abschnitte.filter(a => a.status === 'da').flatMap(a => a.antwort.dateien);
    return { dateien: da.length, plus: da.reduce((n, d) => n + d.plus, 0), minus: da.reduce((n, d) => n + d.minus, 0) };
  }

  /** Die Ansage in Worten, nie „+“/„−“; jeder gescheiterte Abschnitt einmal genannt. */
  function ansageText(nr, s, gescheitert) {
    let dateien = `${tausender(s.dateien)} Dateien`, zeilen = `${tausender(s.plus)} Zeilen hinzugefügt`;
    if (s.dateien === 1) dateien = '1 Datei';
    if (s.plus === 1) zeilen = '1 Zeile hinzugefügt';
    const ohne = gescheitert.map(k => `, ohne ${diff.anwendungName(k)}: ließ sich nicht lesen`).join('');
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

  /* ── Zeichnen (R00210 FA 2–7, 12, 13; Artboard D0009 `#alle-aenderungen`, `#alle-raender`): HTML-Text aus dem Zustand der Seite.
     Fremder Text nur über `esc` bzw. `sichtbarHtml` in feste Elemente. `ctx`: `esc`, `adresse(verweis)` → `href` der Seite eines
     Commits, `titelVon(verweis)` → Titel aus der Liste der Commits oder null. ── */

  /** Umschalter „Alle Änderungen | Ein Commit“ (N1.1): zwei echte Verweise, der gezeigte mit `aria-current`; ohne Ziel steht
      „Ein Commit“ gedämpft ohne `href`, ohne `role` und ohne Tab-Stopp da (PO Z. 442). */
  function umschalterHtml({ ansicht, alleHref, commitHref, commitZiel }, esc) {
    const gewaehlt = teil => (ansicht === teil ? ' aria-current="page"' : '');
    const alle = `<a href="${esc(alleHref)}" id="rv-u-alle" data-act="review-alle-zeigen"${gewaehlt('alle')}>Alle Änderungen</a>`;
    let commit = '<span class="umsch-aus" id="rv-u-commit">Ein Commit</span>';
    if (commitHref) commit = `<a href="${esc(commitHref)}" id="rv-u-commit" data-act="review-umschalten" data-arg="${esc(commitZiel)}"${gewaehlt('commit')}>Ein Commit</a>`;
    return `<nav class="seg umsch" aria-label="Ansicht der Review-Seite">${alle}${commit}</nav>`;
  }

  /** Ein Verweis auf die Seite eines Commits; ersetzt bei einfachem Klick den Verlaufseintrag (data-act `review-commit`). */
  function commitVerweis(verweis, inhalt, name, ctx, klasse = '') {
    const { esc } = ctx;
    return `<a${klasse ? ` class="${klasse}"` : ''} href="${esc(ctx.adresse(verweis))}" data-act="review-commit" data-arg="${esc(verweis)}" aria-label="${esc(name)}">${inhalt}</a>`;
  }

  const kurzHtml = (verweis, esc) => `<span class="mono">${diff.sichtbarHtml(kurzVerweis(verweis), esc)}</span>`;

  function commitsWort(n) {
    if (n === 1) return '1 Commit';
    return `${tausender(n)} Commits`;
  }

  /** Kopf eines Abschnitts: „Anwendung <kürzel>“ als h2 (Fokusziel nach „Erneut versuchen“, S3), dazu Zahlen oder Zustandswort. */
  function abschnittKopfHtml(a, kuerzel, zusatz, esc) {
    const name = esc(diff.anwendungName(kuerzel));
    return `<h2 class="anw" id="rv-a${a}-t" tabindex="-1">${name}${zusatz}</h2>`;
  }

  /** Ein ausgelassener Verweis wie in der Liste der Commits (R00205 FA 5): Verweis, Symbol, Zustandswort, Hinweis; kein „einzeln
      ansehen“, denn es gibt keinen Diff. Der Verweis bei `unlesbar` ist fremder Text und geht nur über `sichtbarHtml`. */
  function ausgelassenHtml(e, esc) {
    let verweis = diff.sichtbarHtml(e.verweis, esc);
    if (e.zustand !== 'unlesbar') verweis = diff.sichtbarHtml(kurzVerweis(e.verweis), esc);
    // der Hinweis bei `anwendung_unbekannt` nennt das Kürzel wie in der Liste; der Hinweis der Antwort trägt nur den Verweis
    let anwendung = '';
    const doppelpunkt = String(e.verweis).indexOf(':');
    if (doppelpunkt > 0) anwendung = String(e.verweis).slice(0, doppelpunkt);
    const marke = zustandsmarke({ ...e, anwendung }) || { wort: e.zustand, hinweis: '' };
    let hinweis = '';
    if (marke.hinweis) hinweis = ` <span class="rv-hin">${esc(marke.hinweis)}</span>`;
    return `<li><span class="mono">${verweis}</span> ${diff.symbol('achtung')}<b class="zs">${esc(marke.wort)}</b>${hinweis}</li>`;
  }

  function hinweislisteHtml(saetze, ctx) {
    if (!saetze.length) return '';
    const { esc } = ctx;
    const zeilen = saetze.map(h => {
      if (h.ziel) return `<li><p>${kurzHtml(h.ziel, esc)} ${h.text}</p>${commitVerweis(h.ziel, 'einzeln ansehen', `Commit ${kurzVerweis(h.ziel)} einzeln ansehen`, ctx, 'rv-einzeln')}</li>`;
      return `<li><p>${esc(h.text)}</p></li>`;
    }).join('');
    return `<ul class="rv-hw" aria-label="Hinweise">${zeilen}</ul>`;
  }

  /** Commit-Liste des Abschnitts: einbezogene als Verweis, verwaiste und Merges als „nicht einbezogen: …“ in sichtbarem Text. */
  function commitlisteHtml(antwort, ctx) {
    const { esc } = ctx;
    const zeile = (verweis, titel, zusatz) => `<li>${commitVerweis(verweis, kurzHtml(verweis, esc), `Commit ${kurzVerweis(verweis)} einzeln ansehen`, ctx, 'rv-cv')}${titel ? `<span class="t">${diff.sichtbarHtml(titel, esc)}</span>` : ''}${zusatz}</li>`;
    const ein = antwort.commits.map(c => zeile(c.verweis, c.titel, ''));
    const aus = antwort.hinweise.filter(h => h.art === 'verwaist' || h.art === 'merge_ausgelassen').map(h => {
      let wort = 'nicht einbezogen: Merge';
      if (h.art === 'verwaist') wort = 'nicht einbezogen: verwaist';
      return zeile(h.verweis, ctx.titelVon(h.verweis), `<span class="zs">${wort}</span>`);
    });
    if (!ein.length && !aus.length) return '';
    return `<h3 class="rv-ue">COMMITS <span class="mono">${ein.length + aus.length}</span></h3><ul class="rv-cl" aria-label="Commits der Aufgabe">${ein.join('')}${aus.join('')}</ul>`;
  }

  /** Dateiliste des Abschnitts: Folge-Dateien mit „Folge · n Commits“ statt Statuswort. */
  function dateilisteHtml(a, dateien, esc) {
    const eintraege = dateien.map((d, i) => {
      let pfad = d.neu ?? d.alt, wort = (STATUSWORT[d.status] || [d.status])[0];
      if (istFolge(d)) { pfad = d.pfad; wort = folgeWort(d.schritte.length); }
      return `<li><button type="button" class="dn-e" data-act="review-datei" data-arg="${a}:${i}"><span class="p">${diff.pfadHtml(pfad, esc)}</span><span class="z">${diff.zahlenHtml(d)}</span><span class="s">${esc(wort)}</span></button></li>`;
    }).join('');
    return `<h3 class="rv-ue">DATEIEN <span class="mono">${dateien.length}</span></h3><ul class="dn" aria-label="Dateien">${eintraege}</ul>`;
  }

  /** Eine Folge-Datei (N1.4): Kopf mit Pfad, „Folge · n Commits“ und Summe, ohne Statuswort; offen der Satz zur Folge, dann je
      Schritt ein Kopf als Verweis und darunter der Schritt wie eine Datei in B2. */
  function folgeDateiHtml(d, a, i, stand, ctx, folgeSatz, hinweise, commits) {
    const { esc } = ctx;
    const id = `${a}-${i}`, arg = `${a}:${i}`;
    const kopf = folgeKopf(d);
    let klappWort = 'zugeklappt';
    if (stand.offen) klappWort = 'aufgeklappt';
    const name = `${diff.sichtbarText(d.pfad)}, ${kopf.wort}, +${tausender(d.plus)} −${tausender(d.minus)}, ${klappWort}`;
    const knopfHtml = `<h3 class="df-h"><button type="button" class="df-k" id="rv-dk${id}" data-act="review-klappe" data-arg="${arg}" aria-expanded="${stand.offen}" aria-controls="rv-dc${id}" aria-label="${esc(name)}">${diff.symbol('pfeil', ' df-pf')}<span class="p">${diff.pfadHtml(d.pfad, esc)}</span><span class="st st-folge">${kopf.wort}</span><span class="z">${diff.zahlenHtml(d)}</span></button></h3>`;
    let inhalt = '';
    if (stand.offen) inhalt = `<p class="df-folge" role="note">${folgeSatz}</p>${folgeRumpfHtml(d, a, i, stand, ctx, hinweise, commits)}`;
    let beschaeftigt = '';
    if (stand.laden === 'laeuft') beschaeftigt = ' aria-busy="true"';
    let zu = ' hidden';
    if (stand.offen) zu = '';
    return `<section class="df df-fo" id="rv-d${id}" aria-labelledby="rv-dk${id}"${beschaeftigt}>${knopfHtml}<div class="df-inhalt" id="rv-dc${id}"${zu}>${inhalt}</div></section>`;
  }

  function folgeRumpfHtml(d, a, i, stand, ctx, hinweise, commits) {
    const arg = `${a}:${i}`;
    if (stand.laden) return diff.hinweisHtml(d, arg, 'ohne', stand, ctx.esc);
    const koepfe = schrittKoepfe(d, commits);
    const zuGross = hinweise.some(h => h.art === 'zu_gross_zum_anzeigen' && h.datei === d.pfad);
    if (zuGross) return `<p class="df-hin">Zu groß zum Anzeigen. Es stehen nur die Zahlen: +${tausender(d.plus)} −${tausender(d.minus)}. Jeder Schritt lässt sich über seinen Kopf einzeln ansehen.</p>${koepfe.map((k, j) => schrittHtml(d, d.schritte[j], k, `${a}-${i}-${j}`, arg, ctx, hinweise, false)).join('')}`;
    return nachladenHtml(d, arg, hinweise) + koepfe.map((k, j) => schrittHtml(d, d.schritte[j], k, `${a}-${i}-${j}`, arg, ctx, hinweise, true)).join('');
  }

  /** Ein Knopf je Folge-Datei, wenn Schritte groß sind oder fehlen: `datei=` lädt alle Schritte zusammen (N1.6). */
  function nachladenHtml(d, arg, hinweise) {
    const zustaende = d.schritte.map(s => diff.dateiZustand(s, hinweise));
    if (!zustaende.some(z => z === 'gross' || z === 'nachladen')) return '';
    let text = 'Änderungen anzeigen';
    if (zustaende.includes('nachladen')) text = 'Nachladen';
    return `<div class="df-hin"><p>Nicht alle Schritte stehen in der ersten Antwort. Die Schritte dieser Datei werden zusammen geladen.</p>${diff.knopf(text, 'review-nachladen', arg)}</div>`;
  }

  /** Hinweis eines Schritts ohne eigenen Knopf (der Knopf steht einmal an der Datei); sonst wie eine Datei in B2. */
  function schrittHinweisHtml(s, arg, zustand, esc) {
    if (zustand === 'gross') return `<p class="df-hin">Der Patch dieses Schritts ist groß (${tausender(s.plus + s.minus)} Zeilen) und wird erst auf Wunsch geladen.</p>`;
    if (zustand === 'nachladen') return '<p class="df-hin">Dieser Schritt war nicht in der ersten Antwort, weil die Antwort zu groß wurde.</p>';
    return diff.hinweisHtml(s, arg, zustand, { laden: null }, esc);
  }

  /** Ein Schritt: Kopf als Verweis auf den Commit (Name „Commit <kurz>, <Titel>, <Zustandswort>, +p −m“), darunter Merkmale,
      Hinweis und Code wie eine Datei in B2. Ohne passenden Commit bleibt der Kopf Text. */
  function schrittHtml(d, s, k, id, arg, ctx, hinweise, mitRumpf) {
    const { esc } = ctx;
    const titel = k.titel === null ? '' : `<span class="fs-t">${diff.sichtbarHtml(k.titel, esc)}</span>`;
    const inhalt = `<span class="mono">${diff.sichtbarHtml(k.kurz, esc)}</span>${titel}<span class="st ${k.klasse}">${esc(k.wort)}</span><span class="z">${diff.zahlenHtml(k)}</span>`;
    const teile = [`Commit ${k.kurz}`];
    if (k.titel !== null) teile.push(diff.sichtbarText(k.titel));
    teile.push(k.wort, `+${tausender(k.plus)} −${tausender(k.minus)}`);
    let kopf = `<span class="fs-l">${inhalt}</span>`;
    if (k.ziel) kopf = commitVerweis(k.ziel, inhalt, teile.join(', '), ctx, 'fs-l');
    let rumpf = '';
    if (mitRumpf) {
      const zustand = diff.dateiZustand(s, hinweise);
      const saetze = diff.merkmalSaetze(s, zustand).map(t => `<p class="df-mm">${esc(t)}</p>`).join('');
      let code = '';
      if (zustand === 'patch') code = diff.codeHtml(s.patch, d.pfad, esc);
      rumpf = saetze + schrittHinweisHtml(s, arg, zustand, esc) + code;
    }
    return `<div class="fs" id="rv-d${id}"><h4 class="fs-k">${kopf}</h4>${rumpf}</div>`;
  }

  /** Eine Datei des Abschnitts: Folge-Datei hier, Netto-Datei wie in B2 mit Kennung des Abschnitts. */
  function gesamtDateiHtml(d, a, i, stand, ctx, sicht) {
    if (istFolge(d)) return folgeDateiHtml(d, a, i, stand, ctx, sicht.folgeSatz, sicht.hinweise, sicht.commits);
    return diff.dateiHtml(d, i, stand, sicht.hinweise, ctx.esc, { id: `${a}-${i}`, arg: `${a}:${i}` });
  }

  const abschnittSicht = antwort => ({ ...abschnittHinweise(antwort.hinweise), hinweise: antwort.hinweise, commits: antwort.commits });

  /** Eine Datei `i` des geladenen Abschnitts `a` (Neuzeichnen einer Datei in der stehenden Insel). */
  function abschnittDateiHtml(ab, a, i, ctx) {
    return gesamtDateiHtml(ab.antwort.dateien[i], a, i, ab.staende[i], ctx, abschnittSicht(ab.antwort));
  }

  /** Ein Abschnitt je Anwendung (N1.3) in seinem Zustand: lädt, wartet, Fehler oder geladen. */
  function abschnittHtml(ab, a, ctx) {
    const { esc } = ctx;
    const huelle = (inhalt, zusatz = '') => `<section class="rv-abs" id="rv-a${a}" aria-labelledby="rv-a${a}-t"${zusatz}>${inhalt}</section>`;
    if (ab.status === 'laedt') return huelle(abschnittKopfHtml(a, ab.kuerzel, ' <span class="zw zw-laedt">lädt …</span>', esc) + `<p class="rv-abs-zust df-laedt" role="status">Lädt die Änderungen der ${esc(diff.anwendungName(ab.kuerzel))} …</p>`, ' aria-busy="true"');
    if (ab.status === 'wartet') return huelle(abschnittKopfHtml(a, ab.kuerzel, ` <span class="zw zw-wartet">${diff.symbol('sanduhr')}wartet</span>`, esc) + `<p class="rv-abs-zust df-wartet">${diff.symbol('sanduhr')}Wartet, bis die ${esc(diff.anwendungName(ab.wartetAuf))} geladen ist …</p>`);
    if (ab.status === 'fehler') return huelle(abschnittKopfHtml(a, ab.kuerzel, '', esc) + abschnittFehlerHtml(ab.fehler, a, ab.kuerzel, esc));
    const antwort = ab.antwort;
    const sicht = abschnittSicht(antwort);
    const zahlen = ` <span class="mono anw-z">${commitsWort(antwort.commits.length)} · ${diff.dateienWort(antwort.dateien.length)}</span>`;
    let leer = '';
    if (!antwort.commits.length) leer = `<p class="rv-abs-leer"><b>Keine Änderungen zu zeigen.</b> ${leerSatz(antwort.hinweise)}</p>`;
    let ausgelassen = '';
    if (sicht.ausgelassen.length) ausgelassen = `<ul class="rv-aus" aria-label="Ausgelassene Verweise">${sicht.ausgelassen.map(e => ausgelassenHtml(e, esc)).join('')}</ul>`;
    let ganz = '';
    if (sicht.ganz) ganz = `<p class="rv-ganz" role="note">${esc(sicht.ganz)}</p>`;
    const dateien = antwort.dateien.map((d, i) => gesamtDateiHtml(d, a, i, ab.staende[i], ctx, sicht)).join('');
    let liste = '';
    if (antwort.dateien.length) liste = dateilisteHtml(a, antwort.dateien, esc);
    const rail = `<div class="rv-abs-rail">${commitlisteHtml(antwort, ctx)}${liste}</div>`;
    return huelle(abschnittKopfHtml(a, antwort.anwendung, zahlen, esc) + leer + hinweislisteHtml(sicht.saetze, ctx) + ausgelassen + `<div class="rv-abs-rumpf">${rail}<div class="rv-abs-haupt">${ganz}${dateien}</div></div>`);
  }

  /** Fehler eines Abschnitts (R00210 FA 7, UX-Vorprüfung M2): Antwortbudget amber mit Server, Zeitgrenze und andere rot mit Uhr
      bzw. Achtung; Netzfehler ohne Status; 404 `repository_fehlt` mit Satz und Hinweiszeile (R00224 FA 1); immer „Erneut versuchen“,
      nie von selbst wiederholt. */
  function abschnittFehlerHtml(f, a, kuerzel, esc) {
    const erneut = diff.knopf('Erneut versuchen', 'review-abschnitt-erneut', a);
    const k = esc(diff.anwendungName(kuerzel));
    if (f.art === 'antwortbudget') return `<div class="df-hin warn rv-abs-f" role="alert">${diff.symbol('server')}<p><b>Server ausgelastet (Antwortbudget).</b> Die Änderungen der ${k} wurden nicht gelesen. Es wird nicht von selbst wiederholt.</p>${erneut}</div>`;
    // ein fehlendes Repository nennt den Zustand in Worten und den grund darunter (R00224 FA 1, PO Z. 506)
    const satz = f.status === 404 && f.daten && f.daten.zustand === 'repository_fehlt' ? zustandSatz(f.daten.zustand, kuerzel, f.daten.grund) : null;
    if (satz) return `<div class="df-hin ${satz.ton} rv-abs-f" role="alert">${zustandsSymbol(satz.symbol)}<div class="df-zeilen">${diff.zustandZeilenHtml(satz, esc)}</div>${erneut}</div>`;
    let grund = `${esc(f.fehler || 'unbekannter Fehler')} (${f.status})`;
    if (f.status === 0) grund = 'keine Verbindung zum Programm';
    let zeichen = 'achtung';
    if (f.art === 'zeitgrenze') zeichen = 'uhr';
    return `<div class="df-hin fehl rv-abs-f" role="alert">${diff.symbol(zeichen)}<p>Die Änderungen der ${k} ließen sich nicht lesen: ${grund}.</p>${erneut}</div>`;
  }

  /** Seitenweite ausgelassene Verweise (`unlesbar`, `anwendung_unbekannt`), einmal über den Abschnitten. */
  function seitenHinweiseHtml(eintraege, esc) {
    if (!eintraege.length) return '<div id="rv-seite-hw"></div>';
    return `<div id="rv-seite-hw"><ul class="rv-aus" aria-label="Ausgelassene Verweise der Aufgabe">${eintraege.map(e => ausgelassenHtml(e, esc)).join('')}</ul></div>`;
  }

  /** Die Insel „Alle Änderungen“ (N1.3): `data-insel="<nr>:alle"`, darin die seitenweiten Hinweise und je Anwendung ein Abschnitt;
      `vonListe` sind die seitenweiten Hinweise aus der Liste, wenn die erste Antwort 404 war (R00224 FA 4). */
  function gesamtInselHtml(nr, abschnitte, ctx, vonListe = []) {
    const seite = seitenHinweise([...abschnitte.filter(ab => ab.status === 'da').map(ab => ab.antwort.hinweise), vonListe]);
    return `<div class="rv-alle" id="rv-insel" data-insel="${nr}:alle">${seitenHinweiseHtml(seite, ctx.esc)}${abschnitte.map((ab, a) => abschnittHtml(ab, a, ctx)).join('')}</div>`;
  }

  /** Summenzeile der Leiste: über die geladenen Abschnitte, dazu „· Anwendung <kürzel> lädt noch …“ (N1.3). */
  function summeHtml(abschnitte, esc) {
    const s = abschnittSummen(abschnitte);
    const laedt = abschnitte.find(ab => ab.status === 'laedt');
    let noch = '';
    if (laedt) noch = ` · ${esc(diff.anwendungName(laedt.kuerzel))} lädt noch …`;
    return `${diff.dateienWort(s.dateien)} · <span class="pl">+${tausender(s.plus)}</span> <span class="mi">−${tausender(s.minus)}</span>${noch}`;
  }

  Object.assign(ziel, { umschalterHtml, abschnittHtml, abschnittDateiHtml, gesamtInselHtml, seitenHinweiseHtml, summeHtml, istFolge, folgeWort, folgeKopf, schrittKoepfe, abschnittHinweise, seitenHinweise, weitereAnwendungen, leerSatz, abschnittSummen, ansageText, naechsteAnfrage, zuordnenGesamt, anwendungenAusListe, listenHinweise });
})(typeof module !== 'undefined' ? module.exports : window);
