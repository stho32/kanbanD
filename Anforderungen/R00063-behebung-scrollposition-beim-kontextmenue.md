---
id: R00063
status: Erledigt
datum: 2026-10-19
ursprung: Bug-Report
ursprungslauf: R00033
---

# R00063: Behebung der verlorenen Scrollposition beim Öffnen des Kontextmenüs

## Beschreibung

Auf einem Board mit vielen Spalten, das quer nach rechts gescrollt ist, öffnet ein Rechtsklick auf eine Karte oder einen Spaltenkopf das Kontextmenü — und das Board rutscht dabei weg: beim Spaltenkopf ganz nach links, bei einer Karte so weit, bis die Karte gerade noch am rechten Rand sichtbar ist. Menü und angeklicktes Element liegen danach nicht mehr beieinander. Dasselbe gilt längs für eine gescrollte Spalte und für die gescrollte Aufgabenliste (Rechtsklick auf eine Zeile setzt sie nach oben zurück).

Reproduktion: Board mit 12 Spalten in einem 800 px breiten Fenster, Spalte 6 an den linken Rand scrollen, Rechtsklick auf eine Karte darin. Erwartet: die Scrollposition bleibt stehen. Tatsächlich: `scrollLeft` springt von 1360 auf 1096 (Karte) bzw. auf 0 (Spaltenkopf).

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design, früh vom Menschen gesehen“ (bedienbar ohne Umweg).

## Ursachenanalyse

### Root Cause
Jedes Öffnen des Menüs (`menueOeffnen` → `render()`), jedes Überfahren eines Eintrags (`mouseover` → `render()`) und jede Menüaktion zeichnet die Hauptfläche neu: `render()` ersetzt `#main` per `innerHTML` (`web/app.js:266`). Damit entstehen `.bahnen`, jede `.flaeche` und `.body` neu mit Scrollposition 0. Bewahrt wurde nur `scrollTop` der WBS-Sicht. Bei einer Karte überdeckte `menueFuerKarte` den Verlust teilweise: es setzt `fokusKarte` (`web/app.js:963`), und das abschließende `focus()` zieht die Karte minimal ins Bild — an den Rand, nicht an die alte Stelle.

Ausgeschlossen: eigener Scroll-Code (es gibt keinen) und die Platzierung des Menüs (`menueEinpassen` arbeitet mit Fensterkoordinaten und war korrekt).

### Betroffene Komponenten
- `web/app.js` `render()`
- Board (`.bahnen`, `.flaeche` je Spalte), Aufgabenliste und Berichte (`.body`), WBS-Sicht (`.body`, `.wbs-tabelle`)

## Lösungsvorschlag

### Langfristige Lösung
`render()` merkt sich vor dem Neuzeichnen die Scrollpositionen aller gescrollten Flächen der Hauptsicht (`rollpositionen()`: `.body`, `.wbs-tabelle`, `.bahnen`, jede Spalte über ihren Namen) und setzt sie danach zurück (`rollpositionenSetzen()`), bevor der Fokus gesetzt wird. Das gilt nur, wenn Sicht, Board und Einrichtungsmodus gleich bleiben (`#main[data-sicht]`), damit beim Wechsel nichts mitwandert. Die bisherige Sonderbehandlung der WBS-Sicht geht darin auf.

### Alternative Ansätze
- `focus({ preventScroll: true })` — behebt nur den Kartenfall halb; der Container ist trotzdem neu und steht bei 0.
- Menü in eigenem Overlay ohne Neuzeichnen von `#main` — größerer Umbau des Render-Modells, und jedes andere Neuzeichnen (Live-Ereignisse) verlöre die Position weiterhin.

## Test-Strategie

### Unit Test zur Bug-Reproduktion
E2E statt Unit, weil das Verhalten nur im echten DOM mit Layout entsteht: `e2e/tests/r00033-kontextmenue.spec.js` „R00033 breites Board“ — 12 Spalten, 800 px, Spalte 6 links, Karte 15 oben in der Spalte; Rechtsklick auf die Karte und auf den Kopf von Spalte 7, danach `scrollLeft`/`scrollTop` und die Lage der Karte unverändert, auch nach Überfahren eines Eintrags. `e2e/tests/r00034-menues.spec.js` „R00034 lange Liste“ — 60 Aufgaben, Rechtsklick auf die erste ganz sichtbare Zeile nach `scrollTop = 600`.

### Code-Extraktion für isoliertes Testing
Keine — Merken und Zurücksetzen sind DOM-Plumbing ohne eigene Entscheidungslogik.

### Regressionstests
Alle Ebenen: `cargo test`, `node --test e2e/einheit/`, `npx playwright test`.

## Akzeptanzkriterien
- [x] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [x] Der ursprüngliche Fehler tritt im Szenario der User Story nicht mehr auf
- [x] Keine neuen Fehler: alle Tests aller Ebenen grün
- [x] Auch Spaltenkopf, gescrollte Spalte und Aufgabenliste behalten ihre Position
- [x] Beim Wechsel von Board oder Sicht wandert keine Scrollposition mit

## Implementierungshinweise
- Fix: Commit 3781163, `web/app.js` `render()`, `rollpositionen()`, `rollpositionenSetzen()`
- Manuell bestätigt vom Entwickler gegen eine Testinstanz mit 12 × 20 Karten
- Nebenbefund im selben Lauf: `r00043-berichtsfilter` US-2/US-3 war montags rot (Stundenzettel = eine Woche, Stefans einzige Zeit lag „gestern“ in der Vorwoche) — Testdaten korrigiert in Commit 11e5c67

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)
Das Menü öffnet an den Fensterkoordinaten des Klicks; es passt nur dann zum Element, wenn das Element nach dem Neuzeichnen an derselben Stelle steht. Hält `render()` die Scrollpositionen, steht es dort — für jedes Neuzeichnen, nicht nur für das Menü.

## Notizen
- Priorität: Mittel
- Betroffene Nutzer/Systeme: alle, die Boards breiter als das Fenster oder lange Listen nutzen
- Workaround: keiner (Menütaste auf fokussierter Karte hatte denselben Effekt)
- Erkenntnismuster (Phase 7): alle E2E-Tests liefen mit wenig Inhalt in großem Fenster, so dass kein Test prüfte, ob ein Neuzeichnen die Leseposition hält. Angewendet auf Aufgabenliste, Berichte und `.wbs-tabelle`. Nicht geprüft: das Aufgabenfenster (`#over`, `.mod-main`/`.mod-side`) bei Live-Änderungen
