# ADR-0005: Zusammengesetzte Aktionen in einem Commit — Teilschritte liefern Änderungen, `aktion()` committet einmal; eigener Endpunkt „erledigen“

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00098 (Wiederöffnen), R00099 (Befund erledigt sich)
**Erprobt durch**: —

## Kontext

Wiederöffnen (R00098) ist Zurückholen + aufs Board legen + Kommentar, Erledigen (R00099) ist Schlüssel suchen + Kommentar + Signal oder Bewegen + Reservierung entfernen — jeweils **ein** Commit unter **einer** Sperre. Die vorhandenen Methoden (`zurueckholen`, `bewegen`, Kommentar, Signal) sperren und committen je selbst; sie lassen sich nicht schachteln (`Mutex` ist nicht reentrant). Ein Sensor könnte die Schritte auch über die API nacheinander rufen.

## Optionen

### Option A: Clientseitig aus bestehenden Endpunkten zusammensetzen
- Vorteile: kein neuer Code im Server.
- Nachteile: mehrere Commits, kein atomarer Ablauf; zwischen den Aufrufen kann ein Mensch die Karte bewegen; die Fallunterscheidung aus R00099 wiederholt jeder Sensor.

### Option B: Teilschritte als Funktionen ohne Sperre und ohne Commit, die geänderte Aufgabe/Board im Speicher liefern; die öffentliche Methode sperrt, ruft sie, prüft Zugregeln (ADR-0002), ruft einmal `aktion()`
- Vorteile: atomar; die bestehenden Methoden werden zu dünnen Hüllen derselben Teilschritte, keine Logik doppelt.
- Nachteile: Umbau von `zurueckholen` und der Kommentar-/Signal-Wege in Kern + Hülle.

### Option C: Neue Methoden schreiben die Schritte eigenständig neu
- Vorteile: kein Eingriff in Bestehendes.
- Nachteile: doppelte Fachlogik (Zurückholen, Reservierung entfernen), die auseinanderläuft.

## Entscheidung

**Gewählt: Option B**, und für R00099 ein eigener Endpunkt `POST /api/aufgaben/erledigen` mit Dienstmethode in `src/dienst/erledigen.rs`.

Nur der Server kann Suche, Fallunterscheidung und Schreiben unter einer Sperre halten; die Anforderung verlangt einen Commit. Der Umbau in Kern + Hülle geschieht nur für die Teilschritte, die gebraucht werden (Zurückholen, Kommentar, Signal setzen, oben einordnen, Reservierung entfernen), im Slice, der sie zuerst braucht.

## Konsequenzen

**Positiv:**
- R00098 und R00099 teilen sich Kerne; Grenze und Eigentümer gelten über ADR-0002 ohne Sonderweg.

**Negativ / Inkauf zu nehmen:**
- Bestehende Tests der umgebauten Methoden müssen grün bleiben (Refactoring vor Feature, eigener Commit).

**Folgeentscheidungen / Aufgaben:**
- [ ] Regel in [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md): eine öffentliche Methode = eine Sperre = ein `aktion()`.

## Quellen / Bezuege

- `src/dienst/archiv.rs` (`zurueckholen`), `src/dienst/mod.rs` (`aktion`, `gesperrt`)
- ADR-0002, ADR-0004
