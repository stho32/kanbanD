---
id: R00191
status: Neu
datum: 2026-11-17
ursprung: Bug-Report
ursprungslauf:
---

# R00191: Behebung — Klick aus einem Feld heraus trifft sein Ziel; ein vorgemerkter Fokus überholt den Menschen nicht

## Beschreibung

**Karte #192 (Sammelkarte #141, Befunde aus #180 und #161; Regel [ADR-0010](../Dokumentation/ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N10 Ziffern 2 und 3):** Wer in den Berichten ein Datum getippt hat und danach in ein anderes Feld oder auf „Berichte“ klickt, landet im Leeren: das Feld hat keinen Fokus, das Menü öffnet erst beim zweiten Klick. Und wer nach dem Speichern der Beschreibung sofort ins Kommentarfeld klickt, dem kann der Fokus auf den Stift wegspringen — die nächsten Tasten träfen Kürzel statt Text. Dazu aus dem Review von #189: eine allein gedrückte Strg-, Alt- oder Meta-Taste zwischen den Ziffern beendet die laufende Eingabe; folgt davor eine fremde Änderung, landen die restlichen Ziffern im Tag.

Baut auf [R00179](R00179-datum-tippen-waehrend-die-seite-neu-zeichnet.md) (Aufschub des Zeichnens während einer Datumseingabe, `zeigerUnten`). **Stand am Code gelesen, nicht gefahren:** `render()` prüft `zeigerUnten` nicht, nur das Nachholen (`web/app.js:1152`); das Speichern beim Verlassen zeichnet nach der Antwort mitten in der Geste. `fokusNachBeschreibung` (`:995–997`, vorgemerkt `:2787`) prüft den Fokus beim Vormerken, nicht beim Verbrauchen (`:1422`). `datumstaste` (`web/eingabe.js:93`) beendet bei `ctrlKey || metaKey || altKey`, also schon beim Druck der Modifikatortaste selbst. Die erste Bubble misst jede Probe; ist eine heute grün, entfällt dort der Umbau, der Test bleibt als Wächter.

Keine Zeichnung: es entsteht kein Bedienelement. Zahlt ein auf: [Vision](R00000-vision.md) — die Oberfläche ist per Tastatur und Zeiger ohne Umweg bedienbar.

## Akzeptanzkriterien

**Ausgangslage:** eingerichteter Ordner, Board mit `report-filter: {period: eigen, from: 2026-11-12}` und einer Aufgabe #1 mit Beschreibung. „Tippen“ heißt Taste für Taste, „Klick“ hält die Maustaste zwei Bilder lang (`mouse.down`, `mouse.up`). Fremde Änderung wie in R00179.

- [ ] **AK 1 Klick in ein anderes Feld (Abnahme-Probe der Karte):** Im geöffneten Durchsatz ist in „Zeitraum von“ ein vollständiges anderes Datum getippt (`3112` + `2026`), noch nicht verlassen. Klick in „Zeitraum bis“ → die Board-Datei trägt `from: 2026-12-31`, und der Fokus steht in „Zeitraum bis“.
- [ ] **AK 2 Klick auf „Berichte“:** Wie AK 1, stattdessen Klick auf „Berichte“ → das Menü ist nach diesem einen Klick offen, die Datei trägt das Datum.
- [ ] **AK 3 Unfertig, dann Klick:** `3112` getippt (Zwischenstand), Klick in „Zeitraum bis“ → „Zeitraum von“ zeigt wieder 12.11.2026, nichts ist gespeichert, der Fokus steht in „Zeitraum bis“.
- [ ] **AK 4 Vorgemerkter Fokus (Abnahme-Probe der Karte):** Aufgabenfenster von #1, Beschreibung in Bearbeitung, Antwort auf das Speichern um 500 ms verzögert. Strg+Enter, dann Klick ins Kommentarfeld, Antwort abwarten → der Fokus bleibt im Kommentarfeld. Gegenprobe: ohne Klick steht er nach der Antwort auf dem Stift (R00162 AK 7 bleibt).
- [ ] **AK 5 Modifikatortaste allein:** `3112` in „Zeitraum von“ getippt, Strg einzeln gedrückt und losgelassen (ebenso Alt, Meta), fremde Änderung trifft ein, `2026` getippt → Feld 31.12.2026 und Datei `from: 2026-12-31`. Strg+Enter und Alt+Pfeil beenden die Eingabe weiter (R00179).
- [ ] **AK 6 Bleibt, und nichts geht verloren:** Das Zeichnen, das während der Zeigergeste wartet, wird danach genau einmal nachgeholt (eine fremde Änderung ist danach sichtbar). Die Specs `r00179-*`, `r00173-*`, `r00162-*`, `r00155-*` und `r00106-*` laufen unverändert grün.

## Implementierungshinweise

- **Nicht hinein:** ein pauschaler Wächter „Zeiger unten hält jedes Zeichnen zurück“ (ADR-0010 N10: Hörer auf `pointerdown`/`mousedown` und der Beginn eines Zuges lösen selbst Zeichnen aus); Server, Dateiformat, `datumsaenderung`.
- Der Aufschub nutzt den von R00179 (`S.ui.nachDatum`, `zeigerUnten`) und endet mit der Geste, nicht nach einer Frist. Kein Umhängen von Elementen, kein Teilzeichnen.
- Ziffer 3: das vorgemerkte Fokusziel gilt beim Verbrauchen nur, wenn der Fokus dann auf `BODY` liegt oder mit dem Zeichnen verloren geht; ausdrückliche Ziele im selben Zug (`S.ui.fokus = …; render()`) bleiben.
- `datumstaste`: `Control`, `Alt`, `Meta`, `AltGraph` als `key` → „bleibt“; erst Modifikator mit zweiter Taste → „endet“. Einheitstest in `e2e/einheit/eingabe.test.js`.

## Test-Strategie

E2E im echten Programm als Spec zuerst (Vorbild `e2e/tests/r00179-datum-live.spec.js`), je Probe gemessen; Einheitstest für `datumstaste`. Gewartet wird auf das angekommene Ereignis bzw. die verzögerte Antwort, nicht auf den Renderzähler.

## Offene Fragen

Keine, die den Bau aufhalten.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.
