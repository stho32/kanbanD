---
id: R00228
status: Erledigt
datum: 2026-11-21
ursprung: Bug-Report
ursprungslauf: R00209
---

# R00228: Behebung — das Feld „Repository“ in Einrichten ist breit, und der erste Start scrollt nicht quer

## Beschreibung

Karte #249, Befund aus dem UX-Review von #224 (2026-11-21, `ux-224/bericht-2.md`, Härtung 1 und 2). Beide Fehler bestanden schon vor #224. Runde 2 der Detailplanung arbeitet die UX-Vorprüfung ein (`ux-249/bericht.md`, Muss 1: schmale Form bis 640 px).

1. **Feld „Repository“ zu schmal.** In Einrichten ist das Feld „Repository“ einer Anwendung, die nur ein Repository trägt, 158 px breit bei 768 und 1280 px (clientWidth 148, der Wert ist rund 440 px lang), 141 px bei 375 und 86 px bei 320 px (ux-reviewer, gemessen). Ein langer Pfad wird abgeschnitten, das Zustandswort steht gedrängt daneben. Am Telefon reicht die Umbenennung allein nicht: Neben der Beschriftungsspalte (110 px) und „nicht erreichbar“ (112 px) bleibt dem Feld 0,27 der Zeile bei 320 px und 0,38 bei 375 px (am simulierten Fix gemessen).
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

- `web/kd-app.css`: Review-Regeln `:1586–1589` auf die neue Klasse, `.first` in den Block `max-width:900px`, dazu bis 640 px die schmale Form der Repository-Zeile in Einrichten nach `.felder.felder-schmal` (`:447–453`)
- `web/gesamt.js:186`: `h2.anw` → `h2.rv-anw`
- E2E-Tests: neue Spec für diese Karte; die bestehenden Tests nutzen `.anw` nur für Einrichten (`r00053`, `r00209`, `r00222`) und bleiben unverändert
- **Nicht** betroffen: `web/ansicht.js` (Einrichten behält `.anw`), Server, Register

## Lösungsvorschlag

### Langfristige Lösung

- Die Review-Klasse zieht in den Namensraum der Review-Seite: `rv-anw` (wie `rv-abs-zust`, `rv-abs-rumpf`). Einrichten behält `.anw`, und `.anw` hat danach genau eine Bedeutung.
- `.first` bekommt die Hausform von `.einrichten`: bis 900 px einspaltig, die Vorschau unter der Maske.
- Bis 640 px steht beim Feld „Repository“ in Einrichten (Quellen und jede Anwendung) die Beschriftung über dem Feld und das Zustandswort unter dem Feld, nach der Hausform `.felder.felder-schmal` (`web/kd-app.css:447–453`, R00146 FA 12). Ohne diese Form erreicht das Feld am Telefon die 60 % nicht (ux-reviewer, Muss 1).

### Alternative Ansätze

- **Einrichten-Klasse umbenennen** (`.anw` → `.einr-anw`): gleich wirksam, aber drei bestehende E2E-Tests (`r00053`, `r00209`, `r00222`) müssten ihre Selektoren ändern, die Review-Seite keinen. Verworfen.
- **Regel nur schärfer machen** (`.einrichten .anw{display:block}`): Das behebt das Symptom, die Kollision bleibt bestehen, und die nächste Regel an `.anw` trifft wieder beide Bereiche. Verworfen.
- **Schwelle 641 px** für den ersten Start (Vorschlag des ux-reviewer): Sie weicht von der Hausform ab (`.einrichten`, `.setup` bei 900 px). Verworfen nach dem architekt; der ux-reviewer hat 641 in der Vorprüfung zurückgezogen (bei 768 px wäre die Vorschau 168 px schmal und die Seite scrollte quer).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

E2E-Spec `e2e/tests/r00228-breite-einrichten.spec.js` gegen das gestartete Programm (Hilfen `kanbanStarten`, `einrichten`, `breiteSetzen`, `thema` aus `e2e/tests/hilfen.js`):

1. Feldbreite (AK 1): heute rot, 141 px bei 375 und 158 px bei 768 und 1280 gegen 0,6 × Breite von `.anw`; Schrift der Zeile heute 600. Dazu die schmale Form (AK 1a): heute rot, 0,27 bei 320 und 0,38 bei 375.
2. Keine Flex-Zeile (AK 2, erster Teil): heute rot, `display` ist `flex`.
3. Querscrollen beim ersten Start (AK 3): heute rot bei 320, 375 und 768.

### Code-Extraktion für isoliertes Testing

Nicht nötig, es ist reines CSS und ein Klassenname.

### Regressionstests

- Vergleich der berechneten Stile der Review-Seite vorher und nachher (AK 2, zweiter Teil)
- `r00053`, `r00209`, `r00222`, `r00210`, `ziele`, `kontrast` und die Breitenprobe ohne geänderte Erwartung grün. In `r00209` bleiben „UX S1“ (gleiche Zeilenhöhe von `ma` und `kd`, läuft bei 1280 px, die schmale Form greift dort nicht) und die NFA-Probe bei 375 und 641 px unverändert: bei 375 brechen beide Zeilen gleich um, kein Element scrollt quer, die Ziele bleiben ≥ 24 px hoch; bei 641 gilt die breite Form. Muss eine Erwartung doch geändert werden, ist das eine Abweichung von dieser Anforderung und steht im Bericht des entwicklers mit Grund.
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage Einrichten:** Register mit genau einer Anwendung `kd`, die nur `repository` trägt (kein `wbs`). Der Pfad ist 120 Zeichen lang (wie `lang` in `r00209-register-repository.spec.js:315`), Person `st`, Route `#/einrichten`.
**Ausgangslage erster Start:** kanbanD auf einem leeren Wegwerf-Ordner (ohne `kanbanD.md`).
**Rechenbeispiel** (gemessen vom ux-reviewer): `.anw` ist bei 375 px 375 px breit, das Feld muss also mindestens 0,6 × 375 = 225 px breit sein. Heute sind es 141 px (0,38), also rot. Bei 320 px gilt 0,6 × 320 = 192 px gegen heute 86 px (0,27).

### Bug behoben

- [x] **AK 1 Feldbreite (Abnahme-Probe der Karte, wörtlich):** Die Breite von `getByLabel('Repository kd')` beträgt mindestens 60 % von `.anw`, bei 375, 768 und 1280 px. Gemessen wird `getBoundingClientRect().width` beider Elemente, nach `breiteSetzen`. Dazu bei jeder Breite: Das Zustandswort (`.erreich` der Zeile) ist ganz sichtbar und schneidet das Feld nicht (Rechteckschnitt leer). Die Zeile `kd` hat `font-weight` 400 (berechneter Stil von `.anw`), wie die Zeile „Quellen“. Heute rot: 141 px bei 375, 158 px bei 768 und 1280; `font-weight` 600. Bei 375 px erreicht das Feld die 60 % nur mit der schmalen Form aus AK 1a.
- [x] **AK 1a Feldbreite schmal:** Bei 320 und 375 px, hell und dunkel, mit dem Zustandswort „nicht erreichbar“ (Pfad 120 Zeichen, existiert nicht) gilt: Die Breite von `getByLabel('Repository kd')` beträgt mindestens 60 % von `.anw`. `.erreich` der Zeile liegt ganz in `.anw` und schneidet das Feld nicht. `scrollWidth <= innerWidth`. Die Ziele bleiben ≥ `--kd-ziel` hoch. Heute rot: 86/320 = 0,27 und 141/375 = 0,38. Mit der Umbenennung allein bleibt es rot (0,27 und 0,38, gemessen am simulierten Fix).
- [x] **AK 2 Klassen-Kollision:** `.anw` ist in Einrichten nicht `display:flex` (berechneter Stil der Zeile `kd`, bei 375, 768 und 1280 px). Kein Element der Review-Seite trägt die Klasse `anw`, ihr Abschnittskopf trägt `rv-anw`. Die Review-Seite behält ihr Aussehen unter der neuen Klasse. Die Probe ist ein Vergleich der berechneten Stile vorher und nachher: am Abschnittskopf je Anwendung (`h2`) `display`, `flex-wrap`, `align-items`, `row-gap`, `column-gap`, `margin`, `font-size`, `font-weight`, an seinem `.mono` `font-weight` und `color`, an seinem `.zw` `display`, `gap`, `font` und `color`, an `.zw svg.i` `width` und `height` und an `.rv-abs-zust svg.i` `width` und `height`. „Vorher“ ist der Stand `main` vor der Karte, „nachher“ der Endstand, gleicher Bestand wie in `r00210-alle-aenderungen.spec.js`, 1280 px, hell und dunkel. Die beiden Messungen sind gleich (leerer Unterschied). Heute rot im ersten Teil: `display` ist `flex`.
- [x] **AK 3 Querscrollen beim ersten Start (Abnahme-Probe der Karte, wörtlich):** Beim ersten Start gilt `scrollWidth <= innerWidth` bei 320, 375 und 768 px, hell und dunkel (Ordnername kurz, wie `kanban` der Hilfen; ein langer Ordnername im Kopf gehört nicht zu R00228, siehe „Offene Fragen“). Bis 900 px steht die Vorschau unter der Maske (Hausform wie `.einrichten`): bei 900 px ist die Oberkante von `.first-r` mindestens die Unterkante von `.first-l`. Bei 901 und 1280 px stehen beide nebeneinander wie heute (Oberkanten gleich, `.first-r` rechts von `.first-l`). Heute rot: 493 bei 320 px, 548 bei 375 px, 773 bei 768 px.
- [x] **AK 4 Mutanten:** Jeder Mutant wird von einem benannten Test getötet. Die Mutanten laufen in einer eigenen Kopie, nicht im Worktree.
  - (m1) Die Review-Regeln heißen wieder `.anw` (`web/kd-app.css`), der Abschnittskopf trägt `rv-anw` → AK 1 und AK 2 rot (Einrichten wieder Flex, Review-Seite verliert ihre Stile).
  - (m2) `gesamt.js` schreibt wieder `h2.anw`, das CSS nutzt `.rv-anw` → AK 2 rot (Klasse `anw` auf der Review-Seite, Vergleich der Stile ungleich).
  - (m3) `.first` fehlt im Block `max-width:900px` → AK 3 rot bei 320, 375 und 900 px.
  - (m4) Die Schwelle für `.first` ist 640 statt 900 px → AK 3 rot bei 900 px.
  - (m5) `.first` ist bei jeder Breite einspaltig → AK 3 rot bei 901 und 1280 px.
  - (m6) Die Regel für schmale Breiten fehlt → AK 1a rot bei 320 und 375 px.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [x] **AK 5 Bug-Vorlage:** Die Reproduktionstests (AK 1, AK 1a, AK 2 erster Teil, AK 3) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt in den Szenarien der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün, `r00053`, `r00209`, `r00222` und `r00210` ohne geänderte Erwartung.

## Implementierungshinweise

- Die neue Klasse heißt `rv-anw`, damit der Präfix `rv-` die Review-Seite kennzeichnet. Die Selektoren `.anw .mono`, `.anw .zw` und `.anw .zw svg.i` ziehen mit um (`web/kd-app.css:1587–1589`).
- Den Vergleich der Stile vorher und nachher fährt man an einem gebauten Programm des Standes vor der Karte und einem des Endstands (eigene Kopie, Build-Cache, kein Bau im Worktree). Die Messung schreibt eine JSON-Datei je Stand, ein leerer `diff` ist grün.
- Die schmale Form gilt bis 640 px (Schwelle der Hausform, `@media (max-width:640px)`) für das Feld „Repository“ in Quellen und in jeder Anwendung; ab 641 px bleibt die Beschriftungsspalte. Die Klasse `felder-schmal` muss dafür nicht ins Markup, die Regeln dürfen im Breitenblock nachgezogen werden — welcher Weg, entscheidet der entwickler.
- Nach `breiteSetzen` erst messen, wenn die Zeile steht (Lehre aus `AI-Team/gelerntes.md`, Messung direkt nach `setViewportSize`).

## Offene Fragen

- keine, die den Bau aufhält. Die Schwelle 900 px hat der ux-reviewer in der Vorprüfung bestätigt (`ux-249/bericht.md`).
- **Langer Ordnername im Kopf des ersten Starts** (ux-reviewer, Sollte): `.kz-z1` bricht nicht um und schiebt „Erster Start“ ab rund 30 Zeichen aus dem Bild (39 Zeichen: `scrollWidth` 373 bei 320, 379 bei 375). Nicht Teil von R00228: andere Ursache (der Kopf, nicht `.first`), und `.kz-z1` ist der Kopf jeder Ansicht. Gehört auf eine eigene Karte.
- Sollte des architekt außerhalb der Karte: eine Probe auf Klassennamen, die zwei Bereiche mit eigener Regel gestalten (vorher schon bei `.leer`). Das ist kein Teil von R00228.

## Warum löst diese Anforderung das Problem? (Pflicht)

Das Feld ist schmal, weil die Review-Regel `.anw{display:flex}` die Einrichten-Zeile zum Flex-Container macht und `.felder` deshalb auf Inhaltsbreite schrumpft. Zieht die Review-Seite auf `rv-anw` um, gilt für die Einrichten-Zeile nur noch ihre eigene Regel. `.felder` füllt die Zeile, das Feld bekommt den Platz neben der Beschriftung, und der Pfad wird lesbar. Am Telefon fehlt der Platz neben Beschriftung und Zustandswort; bis 640 px stehen beide deshalb über und unter dem Feld, und das Feld bekommt die volle Breite der Zeile. Der erste Start scrollt quer, weil sein Zweispalten-Raster keine Breitenregel hat. Mit der Hausform von `.einrichten` steht die Vorschau bis 900 px unter der Maske, und die Seite passt in die Breite.

## Notizen

- Priorität: Mittel (Lesbarkeit und schmales Layout, keine Datenstörung)
- Betroffene Nutzer: jeder, der in Einrichten ein Repository pflegt oder kanbanD auf einem schmalen Gerät zum ersten Mal einrichtet
- Workaround: Pfad im Tooltip (`title`) lesen; erster Start auf breitem Fenster
