---
id: R00270
status: Erledigt
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00249
---

# R00270: Fensterregel „Defekte Dateien“ trifft nicht mehr die Diff-Tabelle

## Beschreibung

Karte #274 (Bug, Label `oberflaeche`), Herkunft R00249 (aus #260). Die CSS-Regel `.dz` des Fensters „Defekte Dateien“ (`web/kd-app.css:792` — `display:flex;flex-direction:column;gap:2px;padding:6px var(--kd-s4);border-bottom:1px solid var(--kd-line);font-size:12px`) ist für die Zeilen dieses Fensters geschrieben, trifft aber jeden Knoten mit der Klasse `.dz` — auch die `<table class="dz">` der Diff-Tabellen der Review-Seite (`web/diff.js:408`). Aufgehoben wird sie heute nur für „Nebeneinander“ (`.dz.ru-nb{display:table;padding:0}`, `web/kd-app.css:1638`). Bei „Nebeneinander“ **aus** bleibt die Tabelle eine Flexbox mit 6 px Innenabstand und 1 px Unterlinie: die Höhenschätzung `contain-intrinsic-block-size:auto n×18px` (`web/diff.js:405`) kennt diese 13 px nicht (je Block um 13 px zu hoch geschätzt), und ein `document.elementFromPoint` in die Mitte eines Blocks läuft ins Leere (R00236 FA 7, R00249 FA 5/AK 1). Sichtbar ändert sich nur die Diff-Tabelle bei „aus“ — sie soll wieder wie gezeichnet aussehen; das Fenster „Defekte Dateien“ sieht vorher und nachher gleich aus.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer eine Änderung prüft, liest eine echte Tabelle, deren Zeilen an ihrer Stelle stehen und deren Höhe stimmt.

### Domänenbezug
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)

## Ursachenanalyse

### Root Cause

Die Klasse `dz` ist doppelt belegt. Zwei Bereiche gestalten denselben Namen mit eigener Regel (Hauslehre #249, `Dokumentation/Gelerntes.md:325`; Vorgabe R00228 AK 2):

- Die Fensterzeile `.dz` (`web/kd-app.css:792`) macht aus jedem `.dz` eine Flexbox mit Innenabstand — richtig für das Fenster „Defekte Dateien“ (`<div class="dz">`, `web/ansicht.js:918`).
- Die Diff-Tabelle `.dz` (`web/kd-app.css:1606`, `border-collapse:collapse;font:12px/1.5 var(--kd-mono);…`) ist die eigentliche Tabellenregel (`<table class="dz">`, `web/diff.js:405`/`:408`).

Beide Regeln treffen die Diff-Tabelle; `display:flex` aus `:792` gewinnt, weil `:1606` kein `display` setzt. Nur für „Nebeneinander“ hebt `.dz.ru-nb{display:table;padding:0}` (`:1638`) den Fehler auf; bei „aus“ fehlt der Ausgleich. **Zweite, verdeckte Folge derselben Kollision:** die Fensterzeile erbt über `.dz` (`:1606`) heute die Monoschrift (`font:12px/1.5 var(--kd-mono)`); sie ist also nicht nur Opfer, sondern auch Nutznießer der doppelt belegten Klasse.

Ausgeschlossen: die Diff-Regeln selbst (`.dz-b`, `.dz td`, `.dz .n`, …) sind richtig; die Höhenformel `n × 18` (ADR-0042 N5/N6/N7) ist richtig — der Fix stellt sie wieder her. Keine ADR: die Hausantwort auf Klassennamen-Kollisionen ist der Bereichspräfix (Lehre #249), keine Technikfrage (Bericht `274-architekt-1.md`).

### Betroffene Komponenten

- `web/kd-app.css:792` (Fensterregel `.dz`), `:1606` (Tabellenregel `.dz`), `:1638` (Ausgleich `.dz.ru-nb`)
- `web/ansicht.js:918` (Fensterzeile `<div class="dz">`), `web/diff.js:405`/`:408` (`<table class="dz">`, `contain-intrinsic-block-size`)
- `e2e/tests/r00025-defekt.spec.js:37`, `e2e/tests/r00161-nicht-utf8.spec.js:19` (Selektor `#pop .dz`)

## Lösungsvorschlag

### Langfristige Lösung

Die Fensterklasse umbenennen: `.dz` → `.pop-dz` (Präfix `pop-` ist mit `.pop-kopf` gesetzt, `web/kd-app.css:252`). Vier Stellen: `web/ansicht.js:918` (`class="dz"` → `class="pop-dz"`), `web/kd-app.css:792` (`.dz` → `.pop-dz`), `e2e/tests/r00025-defekt.spec.js:37` und `e2e/tests/r00161-nicht-utf8.spec.js:19` (`#pop .dz` → `#pop .pop-dz`). Die Diff-Seite (35 Selektorstellen in 13 Specs) bleibt unverändert. Danach ist der Ausgleich `.dz.ru-nb{display:table;padding:0;border-bottom:0}` (`:1638`) samt veraltetem Kommentar entbehrlich und wird entfernt (`table-layout:fixed;inline-size:var(--bb)` bleibt). **Damit das Fenster sich nicht ändert**, trägt die umbenannte Regel die Schrift, die die Fensterzeile heute über `.dz` (`:1606`) erbt: `font:12px/1.5 var(--kd-mono)` statt `font-size:12px` (siehe AK 2, Implementierungshinweise).

### Alternative Ansätze

- (O2) Eingrenzen statt umbenennen: `.pop[data-for="t-defekt"] .dz` — nur CSS, kein Markup, keine Testselektoränderung; verworfen, weil der Name `.dz` doppelt belegt bleibt (vierte Wiederholung der Klasse-Kollision `.leer` #6, `.anw` #249, `.dz` #274) und die Kopplung an `data-for` versteckt ist.
- (O3) Die Diff-Seite umbenennen (`.dz` → `rv-dz`, 35 Selektorstellen in 13 Specs) — verworfen: der größere Umgriff berührt abgenommene Interactions (I0197, I0200, I0239) und mehr Tests als die vier Stellen der Fensterklasse.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Kein reiner Unit-Test: das Verhalten lebt im Browser (berechnete Stile). Der Reproduktionstest ist eine Playwright-Spec, die die berechneten Stile liest (`getComputedStyle`) und die Blockhöhe misst (`offsetHeight`). Code-Extraktion ist nicht nötig (keine Logik, nur Darstellung).

### Code-Extraktion für isoliertes Testing

Entfällt.

### Regressionstests

- Neue Spec `e2e/tests/r00270-fensterregel-dz-diff-tabelle.spec.js` (AK 1–3), Ausgangslage `e2e/tests/review-hilfen.js`; defekte Datei wie `e2e/tests/r00025-defekt.spec.js`.
- Fenster-Specs `r00025-defekt.spec.js` und `r00161-nicht-utf8.spec.js` prüfen das Fenster weiter (nur der Selektor zieht mit), keine Erwartung abgeschwächt.
- Diff-Specs `r00207`, `r00245`, `r00248`, `r00249`, `r00266` ohne geänderte Erwartung grün.

## Akzeptanzkriterien

### Diff-Tabelle (Abnahme-Probe des architekt, Hinweis 4, wörtlich)

- [x] **AK 1 Diff-Tabelle bei „aus“:** Gegeben eine geänderte Datei mit Patch auf der Review-Seite, wenn `sh` sie bei „Nebeneinander“ **aus** öffnet, dann ist im `.df-sc` `getComputedStyle(table.dz).display === 'table'`, `padding-block-start`/`padding-inline-start` sind `0px`, und `offsetHeight` eines im Bild stehenden `.dz-b` ist `18 × <Zahl der Zeilen im Block>` (±1 je Zeile). Heute: `display: flex`, `padding-block-start: 6px`, Blockhöhe +13 px.

### Fenster „Defekte Dateien“ (Vorher/Nachher-Vergleich, Muster R00228 AK 2)

- [x] **AK 2 Fenster unverändert:** Gegeben eine defekte Board-Datei (Muster `r00025-defekt`), wenn `sh` das Fenster „Defekte Dateien“ öffnet, dann sind die berechneten Stile der Fensterzeile (`.pop-dz`) vorher und nachher gleich: `display`, `flex-direction`, `gap`, `padding-block-start`, `padding-block-end`, `padding-inline-start`, `padding-inline-end`, `border-bottom-width`, `border-bottom-style`, `border-bottom-color`, `font-size`, `font-family`, `line-height`; ebenso am Fehlertext `<span>` `color`, `font-size`, `font-family` und am Pfadverweis `<a class="mono">` `font-size`, `font-family`. „Vorher“ ist der Stand `main` vor der Karte, „nachher“ der Endstand; Zahl der Zeilen, Text und der VS-Code-Verweis bleiben unverändert. Heute grün (die Werte werden als Vorher-Daten in der Spec festgehalten).

### Mutanten und Bestand

- [x] **AK 3 Mutanten:** In einer eigenen Kopie (`mutanteEinsetzen` nur mit Pfaden unter `/web/…`, Lehre #247), je von einem benannten Test getötet:
  - (m1) „Fensterregel wieder auf `.dz`“ (`web/kd-app.css`: `.pop-dz` → `.dz`) → AK 1 rot (die Diff-Tabelle ist wieder Flexbox, +13 px je Block).
  - (m2) „Fensterzeile ohne Schrift“ (die umbenannte Regel trägt nur `font-size:12px`, nicht `font:12px/1.5 var(--kd-mono)`) → AK 2 rot (die Fensterzeile verliert Monoschrift und 1.5-Zeilenhöhe).
- [x] **AK 4 Bestand:** Alle Tests aller Ebenen grün; `r00025` und `r00161` prüfen das Fenster weiter (Selektor `#pop .pop-dz`); die Diff-Specs `r00207`, `r00245`, `r00248`, `r00249`, `r00266` ohne geänderte Erwartung grün; R00249 unverändert bis auf höchstens eine Verweiszeile in „Notizen“.

## Implementierungshinweise

- **Umbenennen (Hinweis 1 des architekt):** `web/ansicht.js:918` (`<div class="dz">` → `<div class="pop-dz">`), `web/kd-app.css:792` (`.dz{…}` → `.pop-dz{…}`), `e2e/tests/r00025-defekt.spec.js:37` und `e2e/tests/r00161-nicht-utf8.spec.js:19` (`#pop .dz` → `#pop .pop-dz`). Die Diff-Seite (35 Selektorstellen) bleibt.
- **Ausgleich entfernen (Hinweis 2):** `.dz.ru-nb{display:table;padding:0;border-bottom:0;table-layout:fixed;inline-size:var(--bb)}` (`web/kd-app.css:1638`) auf `table-layout:fixed;inline-size:var(--bb)` kürzen; der Kommentar `:1634–1637` (nennt die Fensterregel als Grund) wird mit berichtigt oder entfernt.
- **Schrift der Fensterzeile:** die Fensterzeile hat heute `font:12px/1.5 var(--kd-mono)` nur, weil die Tabellenregel `.dz` (`:1606`) sie mit trifft; nach dem Umbenennen trifft sie nicht mehr. Darum die umbenannte Regel mit `font:12px/1.5 var(--kd-mono)` schreiben (statt `font-size:12px`), sonst wechselt der Fehlertext von Mono auf Sans (AK 2).
- **Mutant m1** ist der Rückweg der Regel (kein `mutanteEinsetzen`-Sonderfall); Mutanten nur auf committetem Stand zurücklegen.
- **Verweiszeile:** in R00249 „Notizen“ höchstens **eine** Zeile (Vorbild B1438/B1454); R00249 bleibt abgenommen.

## Offene Fragen

Keine. Entschieden:

- **Schrift der Fensterzeile:** die Anforderung hält das Fenster unverändert (Auftrag), also bleibt der Fehlertext mono (`font:12px/1.5 var(--kd-mono)`, AK 2). Soll er künftig sans sein, ist das ein eigener Gestaltungswunsch außerhalb dieser Karte (Hinweis an den ux-reviewer). Der Messauftrag des architekt (Hinweis 1) nennt `font-size`, aber nicht `font-family`; die Anforderung nimmt `font-family` auf, weil die Fensterzeile heute über die doppelt belegte Klasse `.dz` (`:1606`) ihre Schrift bezieht.
- **Kein ADR:** Bereichspräfix als Hausantwort auf Klassen-Kollisionen (Lehre #249, R00228 AK 2), keine Technikfrage.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die doppelt belegte Klasse `.dz` macht aus jeder Diff-Tabelle bei „Nebeneinander“ aus eine Flexbox mit 6 px Innenabstand und 1 px Unterlinie (X). Weil die Höhenschätzung `contain-intrinsic-block-size:auto n×18px` diese 13 px nicht kennt und die Tabelle kein echtes Tabellenlayout mehr hat, ist jeder Block um 13 px zu hoch geschätzt und ein `elementFromPoint` in die Mitte läuft ins Leere (Y). Wer eine Änderung prüft, verliert damit die Leseposition und kann einzelne Zeilen nicht sicher treffen (Z). Der Hebel ist der Name der Fensterklasse, nicht die Diff-Seite: eine Umbenennung an vier Stellen (Markup, eine CSS-Regel, zwei Testselektoren) löst die Kollision an der Wurzel, lässt die 35 Selektorstellen der Review-Seite unberührt und macht den bisherigen Ausgleich `.dz.ru-nb{display:table;padding:0}` entbehrlich — die Tabelle ist wieder eine Tabelle, wie ADR-0042 N5/N6/N7 sie beschreiben.

## Notizen
- Abschluss 2026-11-28 (Karte #274, Gate auf `main` grün): AK 1 ist am Programm erfüllt, aber die Höhenformel „18 × Zeilen (±1 je Zeile)“ ist ungenau — Hunk-Köpfe sind 23 px, einzelne Zeilen 19 px hoch. Geprüft wird `offsetHeight` eines `.dz-b` gleich der Summe seiner Zeilenhöhen (±2 px, Block `src/ende.rs`); so misst es auch die Spec `e2e/tests/r00270-fensterregel-dz-diff-tabelle.spec.js` (`kriterium_ungenau` des entwicklertester, Lauf 274-entwicklertester-1).

- Priorität: Mittel. Betroffene Nutzer/Systeme: jeder, der die Review-Seite bei „Nebeneinander“ aus liest (Voreinstellung). Workaround: „Nebeneinander“ einschalten (dann greift `.dz.ru-nb`).
- Verworfene Alternativen: siehe „Alternative Ansätze“ (O2 `.pop[data-for="t-defekt"] .dz`, O3 Diff-Seite umbenennen).
- Nicht Teil: die Diff-Seite umbenennen (35 Selektorstellen in 13 Specs), die übrigen `.dz`-Regeln der Tabelle, eine Probe über die Selektorlisten von `web/*.css` (Vorschlag des architekt für eine eigene Karte, dritte Wiederholung der Klasse-Kollision).
- Hauslehre: `Dokumentation/Gelerntes.md:325` (#249) — „Stile der alten Seite als Vorher-Daten in der Spec festhalten und gleich vergleichen“; genau so ist AK 2 gebaut.
