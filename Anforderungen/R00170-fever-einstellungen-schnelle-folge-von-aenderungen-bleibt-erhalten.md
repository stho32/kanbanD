---
id: R00170
status: Neu
datum: 2026-11-16
ursprung: Bug-Report
ursprungslauf:
---

# R00170: Behebung — schnelle Folge von Änderungen an den Fever-Einstellungen überschreibt frühere Werte

## Beschreibung

Setzt jemand im Fever Chart drei Einstellungen des Boards ohne Pause nacheinander (Puffer 7, Perzentil 70, Auflösung Woche), steht danach nur die letzte in der Board-Datei (`fever: {…}`); Puffer und Perzentil sind still verloren. Mit 300 ms Abstand bleibt alles erhalten. Am selben Weg hängen seit #156 und #157 die Auswahlen „Erledigt heißt“ (Burndown, Durchsatz) und „Zugang ab“ (Durchsatz).

Herkunft: Karte #177, Bestand; gefunden im UX-Review von #156, beim Bau von #157 im E2E bestätigt (dort ging die Zielspalte verloren). Ursache und Abhilfe hat der architekt am Code gelesen, nicht gefahren; die erste Bubble misst den Verlust am heutigen Stand.

## Ursachenanalyse

`fb-setzen` und `fb-vorschlag` (`web/app.js` um `:1865`, `:1876`) bauen das ganze `fieber`-Objekt beim Auslösen aus `S.board.fieber` und reihen erst danach den `PUT /api/boards/{slug}/fieber` ein (`fieberEinstellen`, um `:326–330`). Die Schreibschlange ordnet die Anfragen, nicht ihren Inhalt, und `S.board` wird erst durch das Nachladen nach dem letzten Glied erneuert. Drei schnelle Änderungen tragen deshalb dreimal den alten Stand plus je ein Feld; der Server ersetzt korrekt, die letzte gewinnt.

Betroffen: `web/app.js` (`fieberEinstellen`, `fb-setzen`, `fb-vorschlag`). Server, Route und API bleiben unverändert.

## Lösungsvorschlag

Nur Client, nach ADR-0025 Nachtrag N3 (Regel 7): `fieberEinstellen` bekommt die Änderung (Feld und Wert) statt des Objekts. Das Objekt entsteht im Glied der Schlange aus dem zuletzt erfolgreich gesendeten Stand desselben Boards (je Slug), sonst aus `S.board.fieber`; nach einer erfolgreichen Antwort gilt das Gesendete als Stand, bis ein Laden übernommen wird. Verworfen: nur das geänderte Feld schicken (Teil-Änderung an der Route, ändert die API); Auswahl bis zum Nachladen sperren (bremst die Bedienung).

## Test-Strategie

E2E im echten Programm. AK 1 ist die erste Bubble und **rot ohne Fix**; das gemessene Ergebnis steht im Commit. Die Änderungen werden ohne `await` und ohne Pausen ausgelöst (mehrere `change`-Ereignisse in einem `page.evaluate`), danach wird auf den Zustand gewartet, nicht auf Zeit.

## Akzeptanzkriterien

**Grundbestand:** eingerichteter Ordner, ein Board ohne `fever` in der Board-Datei, Identität gesetzt.

- [ ] **AK 1 Abnahme-Probe der Karte:** Gegeben der Grundbestand und der geöffnete Fever Chart. Wenn Puffer 7, Perzentil 70 und Auflösung Woche direkt nacheinander gesetzt werden, ohne auf Antwort oder Nachladen zu warten, dann trägt die Board-Datei alle drei Werte (`buffer: 7`, `percentile: 70`, `resolution: week`), und die Anzeige zeigt sie. Heute: nur die Auflösung.
- [ ] **AK 2 Beide Auswahlen im Durchsatz:** Gegeben der Grundbestand mit den Spalten Backlog · Arbeit · Erledigt und der geöffnete Durchsatz. Wenn „Zugang ab“ auf Arbeit und „Erledigt heißt“ auf Arbeit in einem Zug gesetzt werden, dann stehen beide in der Board-Datei (`from-column: Arbeit`, `target-column: Arbeit`) und nach Neuladen in beiden Auswahlen.
- [ ] **AK 3 Reihenfolge:** Die drei Änderungen aus AK 1 ergeben genau drei Commits in der Reihenfolge der Eingabe (Puffer, Perzentil, Auflösung).
- [ ] **AK 4 Eine einzelne Änderung wie heute:** Wird nur der Puffer auf 7 gesetzt, entsteht genau ein Commit mit derselben Meldung wie vor der Karte, und die Anzeige ist dieselbe.
- [ ] **AK 5 Abgelehnte Änderung dazwischen:** Lehnt der Server die mittlere von drei direkt aufeinander folgenden Änderungen ab (Puffer 7, Perzentil 60, Auflösung Woche → „Perzentil 60 ist nicht 50, 70, 85 oder 95“), dann steht die Meldung am Formular; Puffer 7 und Auflösung Woche stehen in der Board-Datei, das Perzentil 60 weder in der Datei noch in der Anzeige; zwei Commits.
- [ ] **AK 6 Puffer vorschlagen nach Wechsel der Woche:** Gegeben ein Board mit Projektstart und Ziel-Termin. Wenn die Woche von 7 auf 5 gestellt und direkt danach „Puffer vorschlagen“ ausgelöst wird, dann ist der Puffer aus der Dauer in Arbeitstagen gerechnet, und die Board-Datei trägt die Woche 5 und diesen Puffer.

## Implementierungshinweise

- **In Kauf genommen:** zwei offene Fenster oder ein Agent an der API, die aus einem veralteten Stand das ganze Objekt schicken, überschreiben einander weiter (lokales Werkzeug, Git hält jeden Stand; die Ersetzen-Semantik der Route ist dokumentiert).
- **Nicht hinein:** Termine und Ziel-Termin (`web/app.js` um `:421–428`, `:1864`), Spalte verschieben (`:2100–2105`) — gleiche Schwäche, eigene Karten; Teil-Änderung an der Route.
- Der Stand gilt je Slug: ein Boardwechsel zwischen Auslösen und Senden schreibt nie Werte des einen Boards in das andere.
- Route, API-Form und Commit-Meldung bleiben unverändert; kein neuer sichtbarer Text.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: eine zweite Änderung, bevor das Nachladen der ersten übernommen ist. Baut das Glied der Schlange das Objekt erst beim Senden aus dem zuletzt erfolgreich gesendeten Stand (X), dann enthält jede Anfrage alle Änderungen vor ihr (Y), und die Board-Datei trägt am Ende jede Einstellung, die gesetzt wurde (Z).

## Notizen

- Bezug: ADR-0025 N3 (`9033448`), R00166 (Zielspalte), R00167 („Zugang ab“). Heimat: I0160 unter D0006.
- Workaround heute: zwischen zwei Änderungen warten, bis die Anzeige nachgeladen hat.
- `ursprungslauf` leer: Bestand, kein einzelner Slice zuzuordnen.
