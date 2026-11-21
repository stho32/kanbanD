---
id: R00228
status: Neu
datum: 2026-11-21
ursprung: Bug-Report
ursprungslauf: R00209
---

# R00228: Behebung — das Feld „Repository“ in Einrichten ist breit, und der erste Start scrollt nicht quer

## Beschreibung

Karte #249, Befund aus dem UX-Review von #224 (2026-11-21, `ux-224/bericht-2.md`, Härtung 1 und 2). Beide Fehler bestanden schon vor #224.

1. **Feld „Repository“ zu schmal.** In Einrichten ist das Feld „Repository“ einer Anwendung, die nur ein Repository trägt, etwa 158 px breit (clientWidth 148, der Wert ist rund 440 px lang). Das gilt bei 375, 768 und 1280 px. Ein langer Pfad wird abgeschnitten, das Zustandswort steht gedrängt daneben.
2. **Erster Start scrollt quer.** Beim ersten Start steht die Vorschau „KANBAND.MD wird angelegt“ neben der Maske. Die Seite scrollt bei 320 px waagerecht (`scrollWidth` 493) und bei 375 px ebenso (`scrollWidth` 548).

**Reproduktion 1:** Register mit der Anwendung `kd`, die nur `repository` trägt, Einrichten öffnen, Breite 1280. **Erwartet:** das Feld „Repository kd“ nutzt die Breite der Anwendungszeile. **Tatsächlich:** 158 px.

**Reproduktion 2:** kanbanD auf einem leeren Ordner starten, Breite 320. **Erwartet:** `scrollWidth <= innerWidth`. **Tatsächlich:** 493 > 320.

Das ist **falsch gebaut**: Einrichten soll seit R00209 das Repository je Anwendung mit Zustandswort zeigen, ein abgeschnittener Pfad ist dort nicht lesbar. Die Hausform für schmale Breiten (R00077, B0219: „Einrichten einspaltig“, nichts scrollt quer; Glossar D00004 Schmales Layout) gilt für den ersten Start nicht.

Zahlt ein auf: [Vision](R00000-vision.md), „`kanbanD ./kanban-ordner` startet sie und öffnet das erste Browserfenster“ (Z. 39–40) und „Ein Board bindet keine bis mehrere Anwendungen (Kürzel und Repository …)“ (Z. 104–105). Der erste Start und das Repository einer Anwendung sind die ersten Schritte jedes Nutzers; beide müssen lesbar sein. Die Vision nennt keine Gerätebreite; die Breiten stammen aus R00077.

## Ursachenanalyse

### Root Cause

Belegt am Stand `a72576bc` (architekt, Kartenkommentar #249):

- **Klassen-Kollision `.anw`:** Die Klasse wird in zwei Bereichen mit eigener Regel benutzt. In Einrichten trägt die Zeile einer Anwendung `div.anw` (`web/ansicht.js:2167`, CSS `web/kd-app.css:572–573`). Auf der Review-Seite (R00210) trägt der Abschnittskopf `h2.anw` (`web/gesamt.js:186`, CSS `web/kd-app.css:1586–1589`). Die spätere Regel `.anw{display:flex;flex-wrap:wrap;…}` macht auch die Einrichten-Zeile zum Flex-Container. Ihr Kind `.felder` wird dadurch nur so breit wie sein Inhalt, und mit ihm das Feld.
- **Erster Start ohne Breitenregel:** `.first` ist ein festes Zweispalten-Raster (`web/kd-app.css:663`). Die Schwestern `.einrichten` und `.setup` stellen bis 900 px untereinander (`@media (max-width:900px)`, `:1021–1026`), `.first` fehlt dort.

Beide Defekte sind eingetreten, nicht latent. Kein Test misst die Breite des Felds im Verhältnis zur Zeile, und die Breitenprobe (B0412) läuft nicht über den ersten Start.

### Betroffene Komponenten

- `web/kd-app.css`: Review-Regeln `:1586–1589` auf die neue Klasse, `.first` in den Block `max-width:900px`
- `web/gesamt.js:186`: `h2.anw` → `h2.rv-anw`
- E2E-Tests: neue Spec für diese Karte; die bestehenden Tests nutzen `.anw` nur für Einrichten (`r00053`, `r00209`, `r00222`) und bleiben unverändert
- **Nicht** betroffen: `web/ansicht.js` (Einrichten behält `.anw`), Server, Register

## Lösungsvorschlag

### Langfristige Lösung

- Die Review-Klasse zieht in den Namensraum der Review-Seite: `rv-anw` (wie `rv-abs-zust`, `rv-abs-rumpf`). Einrichten behält `.anw`, und `.anw` hat danach genau eine Bedeutung.
- `.first` bekommt die Hausform von `.einrichten`: bis 900 px einspaltig, die Vorschau unter der Maske.

### Alternative Ansätze

- **Einrichten-Klasse umbenennen** (`.anw` → `.einr-anw`): gleich wirksam, aber drei bestehende E2E-Tests (`r00053`, `r00209`, `r00222`) müssten ihre Selektoren ändern, die Review-Seite keinen. Verworfen.
- **Regel nur schärfer machen** (`.einrichten .anw{display:block}`): Das behebt das Symptom, die Kollision bleibt bestehen, und die nächste Regel an `.anw` trifft wieder beide Bereiche. Verworfen.
- **Schwelle 641 px** für den ersten Start (Vorschlag des ux-reviewer): Sie weicht von der Hausform ab (`.einrichten`, `.setup` bei 900 px). Verworfen nach dem architekt, die Schwelle prüft der ux-reviewer in der Vorprüfung.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

E2E-Spec `e2e/tests/r00228-breite-einrichten.spec.js` gegen das gestartete Programm (Hilfen `kanbanStarten`, `einrichten`, `breiteSetzen`, `thema` aus `e2e/tests/hilfen.js`):

1. Feldbreite (AK 1): heute rot, 158 px gegen rund 0,6 × Breite von `.anw`.
2. Keine Flex-Zeile (AK 2, erster Teil): heute rot, `display` ist `flex`.
3. Querscrollen beim ersten Start (AK 3): heute rot bei 320 und 375.

### Code-Extraktion für isoliertes Testing

Nicht nötig, es ist reines CSS und ein Klassenname.

### Regressionstests

- Vergleich der berechneten Stile der Review-Seite vorher und nachher (AK 2, zweiter Teil)
- `r00053`, `r00209`, `r00222`, `r00210`, `ziele`, `kontrast` und die Breitenprobe ohne geänderte Erwartung grün
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage Einrichten:** Register mit genau einer Anwendung `kd`, die nur `repository` trägt (kein `wbs`). Der Pfad ist 120 Zeichen lang (wie `lang` in `r00209-register-repository.spec.js:315`), Person `st`, Route `#/einrichten`.
**Ausgangslage erster Start:** kanbanD auf einem leeren Wegwerf-Ordner (ohne `kanbanD.md`).
**Rechenbeispiel** (Breite von `.anw` angenommen, nicht gemessen): Ist `.anw` bei 375 px 343 px breit, muss das Feld mindestens 0,6 × 343 = 205,8 px breit sein. Gemessen sind heute 158 px (ux-reviewer), also rot.

### Bug behoben

- [ ] **AK 1 Feldbreite (Abnahme-Probe der Karte, wörtlich):** Die Breite von `getByLabel('Repository kd')` beträgt mindestens 60 % von `.anw`, bei 375, 768 und 1280 px. Gemessen wird `getBoundingClientRect().width` beider Elemente, nach `breiteSetzen`. Dazu bei jeder Breite: Das Zustandswort (`.erreich` der Zeile) ist ganz sichtbar und schneidet das Feld nicht (Rechteckschnitt leer). Heute rot: 158 px bei allen drei Breiten.
- [ ] **AK 2 Klassen-Kollision:** `.anw` ist in Einrichten nicht `display:flex` (berechneter Stil der Zeile `kd`, bei 375, 768 und 1280 px). Kein Element der Review-Seite trägt die Klasse `anw`, ihr Abschnittskopf trägt `rv-anw`. Die Review-Seite behält ihr Aussehen unter der neuen Klasse. Die Probe ist ein Vergleich der berechneten Stile vorher und nachher: am Abschnittskopf je Anwendung (`h2`) `display`, `flex-wrap`, `align-items`, `row-gap`, `column-gap`, `margin`, `font-size`, `font-weight`, an seinem `.mono` `font-weight` und `color`, an seinem `.zw` `display`, `gap`, `font` und `color`, an `.zw svg.i` `width` und `height`. „Vorher“ ist der Stand `main` vor der Karte, „nachher“ der Endstand, gleicher Bestand wie in `r00210-alle-aenderungen.spec.js`, 1280 px, hell und dunkel. Die beiden Messungen sind gleich (leerer Unterschied). Heute rot im ersten Teil: `display` ist `flex`.
- [ ] **AK 3 Querscrollen beim ersten Start (Abnahme-Probe der Karte, wörtlich):** Beim ersten Start gilt `scrollWidth <= innerWidth` bei 320 und 375 px, hell und dunkel. Bis 900 px steht die Vorschau unter der Maske (Hausform wie `.einrichten`): bei 900 px ist die Oberkante von `.first-r` mindestens die Unterkante von `.first-l`. Bei 901 und 1280 px stehen beide nebeneinander wie heute (Oberkanten gleich, `.first-r` rechts von `.first-l`). Heute rot: 493 bei 320 px, 548 bei 375 px.
- [ ] **AK 4 Mutanten:** Jeder Mutant wird von einem benannten Test getötet. Die Mutanten laufen in einer eigenen Kopie, nicht im Worktree.
  - (m1) Die Review-Regeln heißen wieder `.anw` (`web/kd-app.css`), der Abschnittskopf trägt `rv-anw` → AK 1 und AK 2 rot (Einrichten wieder Flex, Review-Seite verliert ihre Stile).
  - (m2) `gesamt.js` schreibt wieder `h2.anw`, das CSS nutzt `.rv-anw` → AK 2 rot (Klasse `anw` auf der Review-Seite, Vergleich der Stile ungleich).
  - (m3) `.first` fehlt im Block `max-width:900px` → AK 3 rot bei 320, 375 und 900 px.
  - (m4) Die Schwelle für `.first` ist 640 statt 900 px → AK 3 rot bei 900 px.
  - (m5) `.first` ist bei jeder Breite einspaltig → AK 3 rot bei 901 und 1280 px.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [ ] **AK 5 Bug-Vorlage:** Die Reproduktionstests (AK 1, AK 2 erster Teil, AK 3) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt in den Szenarien der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün, `r00053`, `r00209`, `r00222` und `r00210` ohne geänderte Erwartung.

## Implementierungshinweise

- Die neue Klasse heißt `rv-anw`, damit der Präfix `rv-` die Review-Seite kennzeichnet. Die Selektoren `.anw .mono`, `.anw .zw` und `.anw .zw svg.i` ziehen mit um (`web/kd-app.css:1587–1589`).
- Den Vergleich der Stile vorher und nachher fährt man an einem gebauten Programm des Standes vor der Karte und einem des Endstands (eigene Kopie, Build-Cache, kein Bau im Worktree). Die Messung schreibt eine JSON-Datei je Stand, ein leerer `diff` ist grün.
- Nach `breiteSetzen` erst messen, wenn die Zeile steht (Lehre aus `AI-Team/gelerntes.md`, Messung direkt nach `setViewportSize`).

## Offene Fragen

- keine, die den Bau aufhält. Die Schwelle 900 px prüft der ux-reviewer in der Vorprüfung (architekt).
- Sollte des architekt außerhalb der Karte: eine Probe auf Klassennamen, die zwei Bereiche mit eigener Regel gestalten (vorher schon bei `.leer`). Das ist kein Teil von R00228.

## Warum löst diese Anforderung das Problem? (Pflicht)

Das Feld ist schmal, weil die Review-Regel `.anw{display:flex}` die Einrichten-Zeile zum Flex-Container macht und `.felder` deshalb auf Inhaltsbreite schrumpft. Zieht die Review-Seite auf `rv-anw` um, gilt für die Einrichten-Zeile nur noch ihre eigene Regel. `.felder` füllt die Zeile, das Feld bekommt den Platz neben der Beschriftung, und der Pfad wird lesbar. Der erste Start scrollt quer, weil sein Zweispalten-Raster keine Breitenregel hat. Mit der Hausform von `.einrichten` steht die Vorschau bis 900 px unter der Maske, und die Seite passt in die Breite.

## Notizen

- Priorität: Mittel (Lesbarkeit und schmales Layout, keine Datenstörung)
- Betroffene Nutzer: jeder, der in Einrichten ein Repository pflegt oder kanbanD auf einem schmalen Gerät zum ersten Mal einrichtet
- Workaround: Pfad im Tooltip (`title`) lesen; erster Start auf breitem Fenster
