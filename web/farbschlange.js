/* kanbanD — Schlange des Färbe-Workers (R00217 FA 5, ADR-0040 Punkt 4): ein Worker, beim ersten Bedarf angelegt, ein Auftrag zur
   Zeit, Frist ab Übergabe mit Abbruch, veraltete Antworten verworfen, Fehler still. Im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  'use strict';

  /** So lange darf der Worker an einem Auftrag rechnen, gezählt ab der Übergabe; danach `terminate()`, die Datei bleibt ohne Farbe. */
  const FRIST_MS = 1000;

  /** Eine Schlange. `workerAnlegen()` liefert einen Worker oder null (dann bleibt jede Datei ohne Farbe); `frist` und `uhr` sind
      für Tests injizierbar. Ein Auftrag ist `{sprache, zeilen, aktuell(), fertig(stuecke | null)}`: `aktuell()` sagt, ob die Datei
      noch so gezeigt wird; `fertig` bekommt das `Int32Array` oder null (ohne Farbe) und wird für veraltete Aufträge nie gerufen. */
  function farbschlange({ workerAnlegen, frist = FRIST_MS, uhr = { setTimeout, clearTimeout } }) {
    const wartend = [];
    let worker = null, laufend = null, wecker = null;

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
      if (auftrag && auftrag.aktuell()) auftrag.fertig(stuecke);
      naechster();
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
      w.onmessage = vomAktuellen(e => beenden(e.data instanceof Int32Array ? e.data : null));
      // Lade- und Laufzeitfehler des Workers: nicht in die Konsole (preventDefault), dieser Worker wird ersetzt
      w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); if (w === worker) { verwerfen(); beenden(null); } };
      w.onmessageerror = vomAktuellen(() => beenden(null));
      return true;
    }

    function naechster() {
      if (laufend) return;
      // der zuletzt gestellte zuerst (UX-Vorprüfung #216 S1); Aufträge geschlossener Dateien fallen heraus
      let auftrag = wartend.pop();
      while (auftrag && !auftrag.aktuell()) auftrag = wartend.pop();
      if (!auftrag) return;
      if (!worker && !anlegen()) {
        auftrag.fertig(null);
        naechster();
        return;
      }
      laufend = auftrag;
      wecker = uhr.setTimeout(() => { verwerfen(); beenden(null); }, frist);
      worker.postMessage({ sprache: auftrag.sprache, zeilen: auftrag.zeilen });
    }

    return {
      stellen(auftrag) {
        wartend.push(auftrag);
        naechster();
      },
    };
  }

  Object.assign(ziel, { farbschlange, FRIST_MS });
})(typeof module !== 'undefined' ? module.exports : window);
