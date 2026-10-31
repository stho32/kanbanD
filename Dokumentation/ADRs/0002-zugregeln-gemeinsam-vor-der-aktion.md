# ADR-0002: Zugregeln gemeinsam vor der Aktion — Zählen im Modell, Entscheiden im Dienst

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00096, R00097 (genutzt von R00098, R00099)
**Erprobt durch**: —

## Kontext

R00096 (WIP-Grenze) und R00097 (Eigentümer) prüfen dieselben Züge: `bewegen`, `mehrere_bewegen`, `ziehen`, Anlegen mit `spalte` (einzeln, mehrere, Board-Pfad), Zurückholen, Archivieren, vom Board nehmen — und künftig Wiederöffnen (R00098) und Erledigen (R00099). Beide hängen an der Art des Handelnden (`Art::Mensch | Art::Agent`). Die Grenze zählt nicht archivierte Karten; archivierte bleiben in der Board-Datei stehen (`src/dienst/archiv.rs`), die Board-Datei allein kennt die Zahl also nicht. Bei `mehrere_bewegen` zählt der Stand nach allen Zügen. Qualitätsziel: ein Agent kann eine Grenze auf keinem Weg umgehen — eine vergessene Methode ist der wahrscheinlichste Fehler.

## Optionen

### Option A: Prüfung je Dienstmethode kopiert
- Vorteile: kein neues Konzept, jede Methode liest sich für sich.
- Nachteile: zwölf und mehr Stellen; der nächste Schreibweg vergisst die Regel (Pre-Mortem: genau so entstand die heutige Lücke bei `ziehen`).

### Option B: Zählen und Eigentümer im Modell, eine Entscheidungsfunktion im Dienst
- `Board` bekommt reine Funktionen: Anzahl offener Karten je Spalte (Archiv-Menge als Eingabe), Spalten über der Grenze im Vergleich Vorher/Nachher, Eigentümer einer Spalte.
- Eine Dienstfunktion `zugregeln(wer, vorher, nachher, archiviert) -> Result<Vec<Warnung>, Fehler>` vergleicht den Board-Stand vor und nach dem Zug im Speicher: Agent → Fehler (ADR-0003), Mensch → Warnung `grenze`. Aufgerufen unter der Sperre, nach der fachlichen Änderung im Speicher, **vor** `aktion()`.
- Vorteile: Regel an einem Ort, rein testbar ohne Dateien; „Stand nach allen Zügen“ fällt durch den Vorher/Nachher-Vergleich von selbst ab; Umsortieren ist kein Zugang (Anzahl unverändert).
- Nachteile: jeder Schreibweg muss die Funktion trotzdem aufrufen; Vorher/Nachher braucht eine Kopie des Boards (`Clone`, billig).

### Option C: Prüfung in `aktion()` selbst
- Vorteile: kein Schreibweg kann sie vergessen.
- Nachteile: `aktion()` kennt nur Dateitexte, müsste Board-Dateien wieder parsen und kennt den Vorher-Stand nicht; vermischt Commit-Mechanik mit Fachregeln.

## Entscheidung

**Gewählt: Option B**

Die Regel steht einmal, das Zählen ist rein und am Modell testbar, und die Mensch/Agent-Unterscheidung bleibt im Dienst, wo der Handelnde bekannt ist. Die Schwäche „Aufruf vergessen“ wird über einen Integrationstest je Endpunkt der Liste aus R00096/R00097 gedämpft (Agent gegen volle Spalte bzw. Menschen-Spalte ⇒ 409/403 und kein neuer Commit).

## Konsequenzen

**Positiv:**
- R00098 (Wiederöffnen) und R00099 (Erledigen) bekommen Grenze und Eigentümer durch denselben Aufruf.
- Die Mensch-Warnung nutzt die bestehende `Warnung` (`src/pruefungen.rs`) mit `pruefung: "grenze"`, `knoten`/`details` leer.

**Negativ / Inkauf zu nehmen:**
- Die Archiv-Menge muss beim Zug gelesen werden (`ordner().aufgaben()`), ein Lesen mehr je Zug.
- Archivieren und Zurückholen wirken auf alle Boards, auf denen die Karte liegt: geprüft wird je Board.

**Folgeentscheidungen / Aufgaben:**
- [ ] Liste der Schreibwege als Tabelle in [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md) halten; neuer Schreibweg ⇒ Zeile dort.

## Quellen / Bezuege

- `src/dienst/bewegen.rs`, `reservierung.rs`, `aufgabe_anlegen.rs`, `archiv.rs`; `src/modell/board.rs`
- ADR-0003 (Fehlerform), [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md)
