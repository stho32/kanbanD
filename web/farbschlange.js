/* kanbanD — Schlange des Färbe-Workers (R00217 FA 5, ADR-0040 Punkt 4): ein Worker, beim ersten Bedarf angelegt, ein Auftrag zur
   Zeit, Frist ab Übergabe mit Abbruch, veraltete Antworten verworfen, Fehler still. Im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  'use strict';
  const { zelleHtml, farbAuftragHolen } = typeof module !== 'undefined' ? require('./diff.js') : window;

  /** So lange darf der Worker an einem Auftrag rechnen, gezählt ab der Übergabe; danach `terminate()`, die Datei bleibt ohne Farbe.
      Ebenso lange darf ein neuer Worker zum Laden brauchen, bis er „bereit“ meldet — das Laden zählt nicht zur Frist des Auftrags. */
  const FRIST_MS = 1000;
  /** Nachfrage an einen neuen Worker; er antwortet `{bereit: true}`, sobald Prism geladen ist (nur auf diese Nachfrage). */
  const BEREIT = { art: 'bereit' };

  /** Eine Schlange. `workerAnlegen()` liefert einen Worker oder null (dann bleibt jede Datei ohne Farbe); `frist` und `uhr` sind
      für Tests injizierbar. Ein Auftrag ist `{sprache, zeilen, aktuell(), fertig(stuecke | null)}`: `aktuell()` sagt, ob die Datei
      noch so gezeigt wird; `fertig` bekommt das `Int32Array` oder null (ohne Farbe) und wird für veraltete Aufträge nie gerufen. */
  function farbschlange({ workerAnlegen, frist = FRIST_MS, uhr = { setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: id => clearTimeout(id) } }) {
    const wartend = [];
    let worker = null, bereit = false, laufend = null, wecker = null;

    const verwerfen = () => {
      if (worker) worker.terminate();
      worker = null;
    };

    /** Ende des laufenden Auftrags: Ergebnis an die Datei, wenn sie noch gezeigt wird, dann der nächste. */
    function beenden(stuecke) {
      const auftrag = laufend;
      laufend = null;
      uhr.clearTimeout(wecker);
      wecker = null;
      try {
        if (auftrag && auftrag.aktuell()) auftrag.fertig(stuecke);
      } finally {
        // ein Fehler beim Übernehmen bleibt sichtbar, hält die Schlange aber nicht an (Code-Review #216 Sollte 2)
        naechster();
      }
    }

    function anlegen() {
      try {
        worker = workerAnlegen();
      } catch (_) {
        worker = null;
      }
      if (!worker) return false;
      const w = worker;
      // nur der aktuelle Worker spricht für den laufenden Auftrag; ein abgebrochener bleibt stumm
      const vomAktuellen = f => e => { if (w === worker) f(e); };
      w.onmessage = vomAktuellen(e => {
        if (!bereit && e.data && e.data.bereit === true) { bereit = true; uebergeben(); return; }
        beenden(e.data instanceof Int32Array ? e.data : null);
      });
      // Lade- und Laufzeitfehler des Workers: nicht in die Konsole (preventDefault), dieser Worker wird ersetzt
      w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); if (w === worker) { verwerfen(); beenden(null); } };
      w.onmessageerror = vomAktuellen(() => beenden(null));
      bereit = false;
      w.postMessage(BEREIT);
      return true;
    }

    /** Den laufenden Auftrag an einen bereiten Worker geben; die Frist zählt ab hier. */
    function uebergeben() {
      if (!laufend || !bereit) return;
      uhr.clearTimeout(wecker);
      wecker = uhr.setTimeout(() => { verwerfen(); beenden(null); }, frist);
      worker.postMessage({ sprache: laufend.sprache, zeilen: laufend.zeilen });
    }

    function naechster() {
      if (laufend) return;
      // der zuletzt gestellte zuerst (UX-Vorprüfung #216 S1), ein Zug in Leserichtung; Aufträge geschlossener Dateien fallen heraus
      let auftrag = wartend.pop();
      while (auftrag && !auftrag.aktuell()) auftrag = wartend.pop();
      if (!auftrag) return;
      if (!worker && !anlegen()) {
        auftrag.fertig(null);
        naechster();
        return;
      }
      laufend = auftrag;
      // ein Worker, der nicht bereit wird, hält die Schlange höchstens eine Frist lang auf
      if (!bereit) wecker = uhr.setTimeout(() => { verwerfen(); beenden(null); }, frist);
      uebergeben();
    }

    return {
      /** Aufträge eines Zugs (etwa der erste Aufbau mit mehreren offenen Dateien) laufen in ihrer Reihenfolge, ein späterer Zug
          zieht vor die wartenden (Code-Review #216 Sollte 1). */
      stellen(...auftraege) {
        wartend.push(...auftraege.reverse());
        naechster();
      },
      /** Wird die laufende Datei nicht mehr gezeigt, endet ihr Auftrag sofort statt erst mit der Frist (Code-Review #216 Sollte 2). */
      aufraeumen() {
        if (!laufend || laufend.aktuell()) return;
        verwerfen();
        beenden(null);
      },
    };
  }

  /** So viele Zeilen legt eine Aufgabe des Hauptfadens höchstens auf (ein Block, ADR-0040 Punkt 5). */
  const AUFLAGE_ZEILEN = 500;

  /** Die Stücke `[Zeile, von, bis, Rolle]*` je Zeile: Zeile → Liste `[von, bis, Rolle]`. */
  function stueckeJeZeile(stuecke) {
    const je = new Map();
    for (let k = 0; k + 3 < stuecke.length; k += 4) {
      if (!je.has(stuecke[k])) je.set(stuecke[k], []);
      je.get(stuecke[k]).push([stuecke[k + 1], stuecke[k + 2], stuecke[k + 3]]);
    }
    return je;
  }

  /** Farbe blockweise auflegen: je Aufgabe (`planen`) höchstens 500 Zeilen der Liste; ersetzt wird nur der Inhalt der Codezellen
      `zellen[i]` der Patch-Zeile i (eine Liste: in „Nebeneinander“ steht eine Kontextzeile in zwei Zellen, R00249 FA 4), Zeilen ohne
      Stück bleiben unberührt. `aktuell()` falsch ⇒ die Auflage endet still, sonst nach dem letzten
      Block `fertig()`. `vorher`/`nachher` umschließen jeden Block (Textauswahl merken und wiederherstellen, UX S2). */
  function auflegen({ zellen, zeilen, stuecke, esc, planen, aktuell, fertig, vorher = () => null, nachher = () => {} }) {
    const je = stueckeJeZeile(stuecke);
    const block = von => {
      if (!aktuell()) return;
      const bis = Math.min(von + AUFLAGE_ZEILEN, zeilen.length);
      const betroffen = [];
      for (let i = von; i < bis; i++) if (je.has(i) && zellen[i]) betroffen.push(i);
      const gemerkt = vorher(betroffen.flatMap(i => zellen[i]));
      for (const i of betroffen) {
        const html = zelleHtml(zeilen[i], esc, je.get(i));
        for (const zelle of zellen[i]) zelle.innerHTML = html;
      }
      nachher(gemerkt);
      if (bis < zeilen.length) planen(() => block(bis));
      else fertig();
    };
    planen(() => block(0));
  }

  /* ── Im Browser: Textauswahl über die Auflage hinweg (UX-Vorprüfung #216 S2) und der Anstoß je Diffbereich ── */

  /** Zeichen-Versatz einer Stelle im Text der Codezelle. */
  function textVersatz(zelle, knoten, versatz) {
    const r = document.createRange();
    r.setStart(zelle, 0);
    r.setEnd(knoten, versatz);
    return r.toString().length;
  }

  /** Die Stelle zum Zeichen-Versatz im neu gebauten Inhalt der Codezelle (der Text ist mit und ohne Farbe gleich). */
  function stelleBei(zelle, versatz) {
    const gang = document.createTreeWalker(zelle, NodeFilter.SHOW_TEXT);
    let knoten, rest = versatz, letzter = null;
    while ((knoten = gang.nextNode())) {
      if (rest <= knoten.length) return [knoten, rest];
      rest -= knoten.length;
      letzter = knoten;
    }
    return letzter ? [letzter, letzter.length] : [zelle, 0];
  }

  /** Liegt ein Ende der Auswahl in einer der Zellen, die gleich ersetzt werden, merkt es sich Zelle und Zeichen-Versatz. */
  function auswahlMerken(zellen) {
    const auswahl = document.getSelection();
    if (!auswahl || !auswahl.rangeCount || !zellen.length) return null;
    const menge = new Set(zellen);
    const ende = (knoten, versatz) => {
      const el = knoten && (knoten.nodeType === 1 ? knoten : knoten.parentElement);
      const zelle = el && el.closest('td.c');
      return zelle && menge.has(zelle) ? { zelle, versatz: textVersatz(zelle, knoten, versatz) } : { knoten, versatz };
    };
    const anker = ende(auswahl.anchorNode, auswahl.anchorOffset), fokus = ende(auswahl.focusNode, auswahl.focusOffset);
    if (!anker.zelle && !fokus.zelle) return null;
    return { anker, fokus };
  }

  function auswahlSetzen(gemerkt) {
    if (!gemerkt) return;
    const stelle = e => (e.zelle ? stelleBei(e.zelle, e.versatz) : [e.knoten, e.versatz]);
    const [ak, av] = stelle(gemerkt.anker), [fk, fv] = stelle(gemerkt.fokus);
    document.getSelection().setBaseAndExtent(ak, av, fk, fv);
  }

  /** Beobachtet das Dokument: jeder neu eingesetzte Diffbereich mit `data-farbe="laeuft"` bekommt genau einen Auftrag — gleich,
      ob „Ein Commit“, „Alle Änderungen“, Aufklappen oder Nachladen ihn gezeichnet hat. Ein ersetzter Bereich ist nicht mehr
      aktuell; seine Antwort und seine Auflage verfallen (ADR-0040 Punkt 4). */
  function farbeBeobachten(wurzel) {
    const schlange = farbschlange({ workerAnlegen: () => (typeof Worker === 'function' ? new Worker('/web/faerben.js') : null) });
    const gesehen = new WeakSet();
    const anstossen = bereich => {
      if (gesehen.has(bereich)) return;
      gesehen.add(bereich);
      const auftrag = farbAuftragHolen(Number(bereich.dataset.farbeNr));
      if (!auftrag) { bereich.dataset.farbe = 'nein'; return; }
      const aktuell = () => bereich.isConnected;
      const fertig = stuecke => {
        if (!stuecke) { bereich.dataset.farbe = 'nein'; return; }
        const zellen = [];
        for (const zelle of bereich.querySelectorAll('td.c[data-z]')) (zellen[zelle.dataset.z] ||= []).push(zelle);
        // `esc` ist die eine Maskierung der Oberfläche (web/ansicht.js), zur Laufzeit geladen
        auflegen({ zellen, zeilen: auftrag.zeilen, stuecke, esc, planen: f => setTimeout(f, 0), aktuell, fertig: () => { bereich.dataset.farbe = 'ja'; }, vorher: auswahlMerken, nachher: auswahlSetzen });
      };
      zug.push({ sprache: auftrag.sprache, zeilen: auftrag.zeilen, aktuell, fertig });
    };
    let zug = [];
    const laeuft = el => el.dataset.farbe === 'laeuft';
    // über die Klassenliste statt eines Selektors: ein Abschnitt mit 10.000 Zeilen hat 50.000 Elemente (R00217 AK 1)
    const pruefen = knoten => {
      if (knoten.nodeType !== 1) return;
      if (knoten.classList.contains('df-sc') && laeuft(knoten)) anstossen(knoten);
      for (const bereich of Array.from(knoten.getElementsByClassName('df-sc'))) if (laeuft(bereich)) anstossen(bereich);
    };
    const beobachtet = eintraege => {
      if (eintraege.some(e => e.removedNodes.length)) schlange.aufraeumen();
      eintraege.forEach(e => e.addedNodes.forEach(pruefen));
      const auftraege = zug;
      zug = [];
      if (auftraege.length) schlange.stellen(...auftraege);
    };
    new MutationObserver(beobachtet).observe(wurzel, { childList: true, subtree: true });
    pruefen(wurzel);
    if (zug.length) schlange.stellen(...zug.splice(0));
  }

  Object.assign(ziel, { farbschlange, FRIST_MS, auflegen, AUFLAGE_ZEILEN });
  if (typeof module === 'undefined' && typeof document !== 'undefined') farbeBeobachten(document.body);
})(typeof module !== 'undefined' ? module.exports : window);
