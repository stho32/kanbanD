---
id: R00247
status: Erledigt
datum: 2026-11-23
---

# R00247: Review-Seite — wortgenaue Hervorhebung in geänderten Zeilen

## Beschreibung

Karte #258, Scheibe S5 nach ADR-0042 Punkt 4 (W1), Reihenfolge 4 von 6 (PO Z. 538), und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` (PO Z. 539; die Marke `mark.wm` ist dort in Hell und Dunkel gezeichnet). Wer auf der Review-Seite eine geänderte Zeile liest, sieht in der gelöschten und in der hinzugefügten Zeile den Teil, der sich wirklich geändert hat, markiert: aus `let a = 1;` gegen `let a = 2;` wird nur die Ziffer hervorgehoben, nicht die ganze Zeile. Die Marke ist eine Auflage auf dem Text der Zeile: sie ändert keinen Buchstaben, keine Zeilenhöhe und keine Syntaxfarbe, steht auch dort, wo die Datei keine Farbe bekommt, und sie gilt in „Ein Commit“ und in „Alle Änderungen“.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme viele Zeilen prüft, sieht auf einen Blick, was an einer Zeile anders ist, statt zwei fast gleiche Zeilen Zeichen für Zeichen zu vergleichen.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Die meisten Änderungen eines Commits sind Zeilen, in denen sich ein Wort, eine Zahl oder ein Name ändert. Heute stehen − und + untereinander, beide ganz rot und grün, und der Prüfer sucht den Unterschied selbst; ein vertauschtes Zeichen in einer langen Zeile geht in der Abnahme durch. Mit der Marke steht der Unterschied sofort da. Die Rechnung ist eine reine Auflage über Präfix und Suffix (linear, ohne schlechtesten Fall), der Text bleibt, wie er ist, und eine Zeile, die sich nicht sicher paaren lässt, bleibt ohne Marke, statt eine falsche zu zeigen.

## Funktionale Anforderungen

- FA 1: In einem Lauf aufeinanderfolgender gelöschter Zeilen, dem **direkt** ein Lauf hinzugefügter Zeilen folgt, wird die i-te gelöschte mit der i-ten hinzugefügten Zeile gepaart, aber **nur, wenn beide Läufe gleich lang sind**. Sonst gibt es in diesem Lauf keine Marke. Eine Kontext- oder Kopfzeile dazwischen trennt Läufe; eine Zeile ohne Gegenstück (nur hinzugefügt, nur gelöscht) bekommt keine Marke.
- FA 2: Je Paar werden das gemeinsame Präfix und das gemeinsame Suffix der beiden Zeilentexte bestimmt (UTF-16-Einheiten, nie mitten in einem Ersatzpaar). Der Rest dazwischen wird nach außen auf Wortgrenzen erweitert (Wortzeichen sind `\p{L}\p{N}_`). Markiert wird dieser Bereich `[von, bis)` in **beiden** Zeilen, wenn Präfix und Suffix zusammen mindestens 4 Einheiten lang sind und der Bereich kürzer ist als die Zeile. Sonst gibt es keine Marke. Ist der Bereich in einer der beiden Zeilen leer (reine Einfügung oder Löschung), steht dort keine Marke, auch kein leeres `<mark>`; in der anderen Zeile steht sie sehr wohl. `von` und `bis` zählen im Zeilentext, nicht in der Zelle (der Lesetext „entfernt: “ steht davor, `web/diff.js`).
- FA 3: Eine Marke je Zeile. Liegen zwei Änderungen in einer Zeile, ist es ein Bereich mit allem dazwischen (ADR-0042 „Inkauf“).
- FA 4: Zeilen über 1.000 Zeichen (`GRENZE_ZEILE`) bekommen keine Marke; ist eine der beiden Zeilen eines Paars länger, gilt das für das Paar.
- FA 5: Die Marke ist ein `<mark class="wm">` in der Codezelle der Zeile. Der Zeilentext bleibt Zeichen für Zeichen gleich (Textinhalt, Auswahl, Kopieren), sichtbar gemachte Bidi- und Steuerzeichen (R00235 / ADR-0033 Punkt 8) bleiben sichtbar und zählen in derselben Zählung wie bei der Farbe; fremder Text wird nie als HTML gelesen.
- FA 6: Die Syntaxfarbe (R00217) schneidet ihre Stücke an `von` und `bis`; die Marke liegt außen, jedes Zeichen behält seine Farbe. Die Marke hängt nicht von der Farbe ab: sie steht auch in einer Datei, die ungefärbt bleibt (Grenze oder Frist, ADR-0037/0040), und sie steht sofort mit dem Text, nicht erst mit der Farbe.
- FA 7: Die Marke gilt in „Ein Commit“ und in „Alle Änderungen“ (jede Anwendung). Ein Lauf, der über die Blockgrenze von 500 Zeilen des Zeichnens geht, wird wie ohne Grenze gepaart.
- FA 8: Hell und Dunkel (D0009): Fläche aus den Tokens gemischt, in **beiden** Themen zu 85 % (die 86 % und der Selektor `.dunkel` der Zeichnung gelten nicht: die App schaltet Dunkel über `data-theme="dark"` und über `prefers-color-scheme` in `web/kd-tokens.css`; den Unterschied tragen die Tokens), und eine Unterkante von 2 px in der Linienfarbe von `add` bzw. `del`. Die Marke trägt ihre Wirkung nicht nur über die Farbe: die Unterkante ist eine Form, und auch bei erzwungenen Farben (`forced-colors: active`) bleibt sie als Linie sichtbar.
- FA 9: Die Marke ändert weder Breite noch Höhe der Zeile, ist ein Inline-Element und bricht mit dem Text um (Folgekarte „lange Zeilen umbrechen“, S6); dieselbe Paarung nutzt die Ansicht „Nebeneinander“ (S7) ohne eigene Rechnung.

## Nicht-funktionale Anforderungen

- Performance: Kosten linear in den Zeichen der geänderten Zeilen; höchstens 2.000 Vergleiche je Paar (zwei Zeilen zu 1.000 Zeichen); keine Aufgabe des Hauptfadens dauert wegen der Marke länger als 150 ms (ADR-0042 Q2; Messziel ADR-0040 Punkt 6). Berechnet wird beim Zeichnen je Block zu 500 Zeilen, also in denselben Aufgaben wie heute. Messweise (PO Z. 676): Die Grenze wird über den Zähler belegt — höchstens 2.000 Vergleiche je Paar (2 × 1.000 Zeichen) und Zeit bei doppelter Zeilenzahl etwa doppelt (linear); das sind die Prüfungen im Gate. Die längste Aufgabe ab dem Klick „Änderungen anzeigen“ wird mit `PerformanceObserver` (`longtask`, ereignisgenau) allein (ein Worker) gemessen und mit dem Wert ohne Marke im Bericht genannt, ohne Grenze im Gate; sie gehört überwiegend zum Einsetzen der nachgeladenen Datei (R00207, ADR-0033 Punkt 5).
- Sicherheit: kein neuer Endpunkt, kein neues Feld, kein Prozess; fremder Text bleibt Text (FA 5).
- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nicht quer; Kontrast und Form nach FA 8 in beiden Themen.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtRepository` in `e2e/tests/review-hilfen.js`): Repository R mit Anwendung `kd` und `wb`, Aufgabe #9. Commit W1 in `kd` ändert `src/w.rs`, jeder Fall steht durch unveränderte Zeilen von den anderen getrennt:

- **K-Wort** (je Fall alte → neue Zeile): (a) `let a = 1;` → `let a = 2;` · (b) `fn alt_name(x) {}` → `fn alt_namen(x) {}` · (c) `a = 1` → `a = 2` · (d) `a=1;` → `a=2;` · (e) `a = 1; b = 2;` → `a = 9; b = 8;` · (f) `let s = "alt";` → `let s = "neu";` · (g) zwei gelöschte Zeilen `p = 10;`, `q = 20;` gegen drei hinzugefügte · (h) eine nur hinzugefügte Zeile · (i) ein gelöschtes `x = 1;`, eine unveränderte Zeile, ein hinzugefügtes `x = 2;` · (p) `foo(1, 2)` → `foo(1, 3, 2)` (reine Einfügung).
- **K-Rand** (je Fall in einer eigenen Datei oder durch unveränderte Zeilen getrennt): (j) `let s = "😀";` → `let s = "😁";` · (k) `v = "1‮2"` → `v = "3‮4"` · (l) `let t = "a‮b";` → `let t = "a‮c";` · (m) `let h = "<img src=x onerror=window.pwn=1>";` → `…src=y…` · (n) Zeile mit genau 1.000 Zeichen (`//`, 997 × `a`, `1`) → dieselbe mit `2` · (o) Zeile mit 1.001 Zeichen (ein `a` mehr) → dieselbe mit `2`.
- **K-Block**: Commit W2 in `kd`, Datei `src/g.rs`, ein Lauf aus 3 gelöschten und 3 hinzugefügten Zeilen, dessen Blockgrenze (Index 500 der Zeilenliste von `patchZeilen`, Zeilen 0–499 und 500–999) zwischen der zweiten und dritten gelöschten Zeile liegt; der entwickler prüft den Index im Test vorab.
- **K-Zwei**: Aufgabe #9 hat in `kd` W1 und in `wb` den Commit W3 mit Fall (a) in `docs/n.md`.

Heute (Stand `03dda757`) steht keine Marke, die ganze Zeile ist rot oder grün. AK 1–9 sind deshalb rot (AK 10 hält den Bestand).

### Marke

- [x] **AK 1 Paar und Marke:** Gegeben K-Wort (a) und (c), wenn `sh` die Review-Seite von W1 öffnet, dann trägt die gelöschte Zeile genau ein `mark.wm` mit dem Text „1“ und die hinzugefügte genau eins mit „2“, und der Rest beider Zeilen steht außerhalb der Marke (`let a = ` davor, `;` dahinter). Rechnung (a): Präfix `let a = ` = 8, Suffix `;` = 1, Summe 9 ≥ 4, Marke `[8, 9)`. Rechnung (c): Präfix `a = ` = 4, Suffix 0, Summe 4 ≥ 4, Marke `[4, 5)`. Heute rot.
- [x] **AK 2 Wortgrenze:** Gegeben K-Wort (b), dann markiert die gelöschte Zeile das ganze Wort „alt_name“ und die hinzugefügte „alt_namen“ (je ein `mark.wm`). Rechnung: Präfix `fn alt_name` = 11, Suffix `(x) {}` = 6; der Rest ist links leer, rechts „n“, wird nach links bis zum Wortanfang 3 erweitert: gelöscht `[3, 11)`, hinzugefügt `[3, 12)`. Heute rot.
- [x] **AK 3 Keine Marke, eine Marke, wo es heißt:** Gegeben K-Wort, dann tragen **keine** Marke: (d) (Präfix 2 + Suffix 1 = 3 < 4), (g) (2 gelöschte gegen 3 hinzugefügte Zeilen, ungleich lang), (h) (nur hinzugefügt), (i) (eine unveränderte Zeile trennt die Läufe); (e) trägt **eine** Marke je Zeile, gelöscht „1; b = 2“ und hinzugefügt „9; b = 8“ (Präfix 4, Suffix 1, `[4, 12)`, ein Bereich mit allem dazwischen, FA 3). Gegeben (p), dann trägt die hinzugefügte Zeile genau ein `mark.wm` mit dem Text „3, “ (Präfix `foo(1, ` = 7, Suffix `2)` = 2, `[7, 10)`) und die gelöschte Zeile **kein** `mark.wm`, auch kein leeres (Bereich `[7, 7)` ist leer, FA 2). Gegeben K-Rand (n), dann tragen beide Zeilen eine Marke über `[2, 1000)`, also 997 × `a` und „1“ bzw. „2“ (der Rest „1“/„2“ wird nach FA 2 auf das Wort erweitert); gegeben (o) (1.001 Zeichen), dann trägt keine der beiden Zeilen eine Marke, und die Zeile steht sonst unverändert da. Heute rot.

### Text, Farbe, fremder Text

- [x] **AK 4 Text unverändert, Ersatzpaar, Bidi, Fremdtext:** Gegeben K-Rand (j), (k), (l) und (m), dann ist der Textinhalt jeder Codezelle gleich dem ohne Marke (Vergleich mit derselben Zeile bei ausgeschalteter Marke); (j) markiert das Emoji ganz (`[9, 11)`, das Ersatzpaar wird nicht geteilt, kein `�` in der Zelle). (k) zeigt `⟨U+202E⟩` sichtbar innerhalb der Marke (Marke `[5, 8)`), (l) zeigt `⟨U+202E⟩` sichtbar außerhalb der Marke (Marke nur „b“ bzw. „c“); in beiden Fällen kein rohes U+202E im DOM. In (k) ist die Unterkante der Marke unter dem Zeichen `⟨U+202E⟩` nicht unterbrochen: im Ausschnitt-Screenshot der Marke hat die unterste 2-px-Pixelreihe über die ganze Breite der Marke die Kantenfarbe, auch im Bereich des Zeichens (der Chip `.mk-z` überdeckt die Kante nicht; die Wahl des Mittels, etwa `vertical-align`, bleibt beim entwickler). In (m) steht der markierte Teil „x“ bzw. „y“ als Text, es entsteht kein `img`, und `window.pwn` ist nicht gesetzt. Heute rot (es gibt keine Marke; jeder Test prüft Marke und Text zusammen).
- [x] **AK 5 Mit Syntaxfarbe und ohne:** Gegeben K-Wort (f) in `src/w.rs` (Rust, von der Auflage gefärbt), dann steht die Marke „alt“ bzw. „neu“ **in** der Zeichenkette: `"` und `"` behalten ihre Farbe `tk-string`, die Buchstaben in der Marke ebenso (berechnete Farbe jedes Zeichens gleich der ohne Marke), und die Marke steht außen um die Farbstücke, nie umgekehrt. Die Marke steht schon, bevor die Farbe aufliegt, und bleibt danach. Gegeben dieselbe Zeile in einer Datei ohne bekannte Endung (`w.xyz`), dann steht die Marke ebenfalls. Heute rot.

### Ansichten, Block

- [x] **AK 6 Alle Änderungen, Blockgrenze:** Gegeben K-Zwei, wenn `sh` „Alle Änderungen“ öffnet, dann tragen Fall (a) in `kd` und Fall (a) in `wb` je eine Marke „1“ / „2“ in ihrem Abschnitt. Gegeben K-Block, dann tragen alle drei gelöschten und alle drei hinzugefügten Zeilen eine Marke (Läufe 3 / 3 gleich lang, über die Blockgrenze gepaart; Zeile i gegen Zeile i, Rechnung: 3 gelöschte + 3 hinzugefügte = 6 Marken). Heute rot.

### Kontrast, Form, Breite

- [x] **AK 7 Kontrast und Form in beiden Themen:** Gegeben K-Wort (a), dann wird in vier Lagen gemessen (hell und dunkel × gelöscht und hinzugefügt); Dunkel wird zweimal erzeugt, über `thema(page, 'dark')` (`data-theme`) und über `emulateMedia({ colorScheme: 'dark' })` ohne `data-theme` (System), beide mit gleichen Werten (die 85-%-Regel gilt in beiden Themen, FA 8). (1) Der Text in der Marke hat gegen die Fläche der Marke mindestens 4,5:1 (`kontrastMessen`, vier Messwerte); zusätzlich je Lage für jede der sieben Syntaxfarben (`tk-keyword`, `tk-string`, `tk-comment`, `tk-number`, `tk-function`, `tk-type`, `tk-macro`) gegen die Fläche mindestens 4,5:1 (28 Messwerte aus je einer Zeile je Farbe in der Marke, `kontrastAm`; Anhalt der Rechnung: schlechtester Wert hell del `tk-comment` 4,61). (2) Die Unterkante (2 px, Linienfarbe von `del` bzw. `add`) hat gegen den **Zeilengrund** (`getComputedStyle(td.c).backgroundColor`) mindestens 3:1; der Zeilengrund ist der Bezug, die Fläche der Marke ist Zierde und trägt keinen Kontrast. Die Farbe der Kante wird aus dem berechneten `box-shadow` bzw. `border-bottom-color` gelesen und mit `kontrastFarben` (versteht `rgb()`, `color(srgb …)` und `oklch()`) gemessen, nicht als Hex-Literal aus dem Test; die Unterkante ist da (`box-shadow` oder `border-bottom` von 2 px, nicht nur eine andere Hintergrundfarbe). Die vier Messwerte (Kante gegen Zeilengrund) stehen im Bericht des entwicklers; Anhalt der Rechnung, nicht gemessen und mit etwa ±0,05: hell del 3,93, hell add 3,31 (schmalste Lage, Spielraum 0,31), dunkel del 5,09, dunkel add 5,51. (3) Mit `emulateMedia({ forcedColors: 'active', colorScheme: 'light' })` und mit `'dark'` trägt jedes `mark.wm` eine Linie von genau 2 px (berechnetes `text-decoration-thickness: 2px` bei `text-decoration-line: underline`, oder `border-bottom-width: 2px` mit Stil `solid`), die Zeilenhöhe ist gleich der ohne Marke (±0 px), der Schatten ist `none`, und der Text gegen den tatsächlichen Grund (`kontrastAm(mark)`, die UA-Farbe von `mark` darf den Text nicht verdecken) hat in beiden Palettenfarben mindestens 4,5:1; die Zeile trägt weiter die Spalte `−`/`+` und den Lesetext „entfernt: “ / „hinzugefügt: “ (Unterscheidung ohne Farbe). Heute rot.
- [x] **AK 8 Breite, Höhe, Umbruch:** Gegeben K-Wort (a), Breiten 320, 414, 980 und 1280 px, hell und dunkel, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`; die Zeile ist mit Marke genauso breit und hoch wie ohne (±0 px: `offsetWidth`, `offsetHeight` der Zeile), die Marke ist `display: inline`, und das Auswählen und Kopieren der Zeile (Strg + C) gibt denselben Text wie ohne Marke. Gegeben Fall (a) verlängert auf 120 Zeichen mit der Änderung in Spalte 60 und `white-space: pre-wrap; overflow-wrap: anywhere` an `.dz .c` (im Test per Stil gesetzt, der Schalter folgt in #259), bei 320 px: die Zeile ist mindestens zwei Zeilen hoch, `mark.wm.getClientRects().length` ist mindestens 2, Pixelprobe der Kante: je Rechteck aus `mark.wm.getClientRects()` hat die unterste 2-px-Reihe (Screenshot der Zelle) die berechnete Kantenfarbe (±2 je Kanal, `kontrastFarben` auflösbar), und kein Rechteck hat Seitenränder (linke und rechte Randbreite 0; Breite der Fragmente = Textbreite, `box-decoration-break` `slice` oder `clone`); die Seite scrollt nicht quer. Heute: Breite grün, Marke fehlt (rot am `mark.wm`).

### Leistung, Bestand, Mutanten

- [x] **AK 9 Last:** Gegeben eine Datei mit 10.000 geänderten Zeilen (5.000 gelöschte, 5.000 hinzugefügte, gleich lange Läufe, Zeilen zu etwa 80 Zeichen) in „Ein Commit“, dann ergeben im Einheitentest zwei Zeilen zu je 1.000 Zeichen höchstens 2.000 Vergleiche (Zähler; Rechnung 2 × 1.000), und die Zeit wächst bei doppelter Zeilenzahl auf etwa das Doppelte (linear, keine Rechnung über das Paar hinaus). Zähler und Linearität sind die harten Prüfungen. Die längste Aufgabe ab dem Klick „Änderungen anzeigen“ wird mit `PerformanceObserver` (`longtask`, ereignisgenau, ohne Polling im Raster des Testwerkzeugs) allein (ein Worker) gemessen und mit dem Wert ohne Marke im Bericht genannt, ohne Grenze; sie gehört zum Einsetzen der nachgeladenen Datei (R00207, ADR-0033 Punkt 5). Heute rot (Zähler fehlt). (PO Z. 676)
- [x] **AK 10 Bestand und Mutanten:** Ohne Marke (alle Fälle ohne Paar) verhält sich die Seite wie vor S5: Gruppen, Größenbalken, Aufklapper „Dateien (<n>) und Commits“, „Pfad“, „VS Code“, „Patch“, Leiste der Commits, „Gesehen“, soweit sie dann auf main stehen, und die Syntaxfarbe (R00217); bestehende Tests behalten ihre Erwartungen, jede geänderte Erwartung nennt der entwickler im Bericht mit Grund. Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie:
  - (m1) Läufe ungleicher Länge werden trotzdem gepaart → AK 3 rot (g)
  - (m2) keine Erweiterung auf Wortgrenzen → AK 2 rot
  - (m3) Schwelle 3 statt 4 → AK 3 rot (d)
  - (m4) das Ersatzpaar wird geteilt → AK 4 rot (j)
  - (m5) `GRENZE_ZEILE` als `<` statt `≤` → AK 3 rot (n)
  - (m6) die Marke liegt innerhalb der Farbstücke oder ein Farbstück überspannt `von` oder `bis` → AK 5 rot
  - (m7) die Marke ersetzt das sichtbar gemachte Bidi-Zeichen → AK 4 rot (k)
  - (m8) der Lauf über die Blockgrenze wird nicht gepaart → AK 6 rot
  - (m9) eine Kontextzeile zwischen − und + trennt den Lauf nicht → AK 3 rot (i)
  - (m10) die Marke steht nur in der hinzugefügten Zeile → AK 1 rot
  - (m11) die Unterkante fehlt (nur Hintergrundfarbe) → AK 7 rot
  - (m12) die Rechnung vergleicht jedes Zeichen mit jedem (quadratisch) → AK 9 rot (Zähler)
  - (m13) die `@media (forced-colors: active)`-Regel fehlt → AK 7 rot (Teil 3)

## Betroffene Verzeichnisstruktur

- Paarung und Marken je Zeile als reine Funktion (Zeilenliste → Marken je Zeilenindex) in `web/review-uebersicht.js` (Node-tauglich, ADR-0042 N1) oder `web/diff.js`, Wahl des entwicklers.
- Zeichnen: `zelleHtml` und `farbigHtml` in `web/diff.js` (Marke außen, Farbstücke an `von`/`bis` geschnitten); die Farbauflage `auflegen` in `web/farbschlange.js` bekommt die Marke je Zeile mit, damit sie beim Ersetzen der Zelle nicht verloren geht; die Paarung beim Zeichnen der Blöcke (`dateiHtml`, Blöcke zu 500) und in „Alle Änderungen“ (`web/gesamt.js`).
- Stil: `web/kd-app.css` (`mark.wm`), nur Tokens; die Werte aus D0009 `#review-uebersicht` (Z. 880–885) gelten als Anhalt.
- Tests: `e2e/einheit/` (Node) und `e2e/tests/r00247-review-wortmarke.spec.js`; die Ausgangslage kommt in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1295 Paarung und Marke, rein**: Zeilenliste → Läufe (− direkt gefolgt von +, gleich lang) → je Paar Präfix, Suffix, Erweiterung, Schwelle, `GRENZE_ZEILE`, Ersatzpaar, Zähler der Vergleiche (FA 1–4). Einheitentests zuerst (AK 1–3, 4 Ersatzpaar).
2. **B1296 Marke in `zelleHtml`**: `<mark class="wm">` mit und ohne Farbstücke, Bidi und Steuerzeichen in derselben Zählung (FA 5, 6; AK 4, 5).
3. **B1297 Einbau**: Paarung beim Zeichnen je Block, Lauf über Blockgrenze vorab auf der ganzen Zeilenliste, Farbauflage trägt die Marke mit, „Alle Änderungen“ (FA 7; AK 5, 6).
4. **B1298 Stil und Messung**: Fläche, Unterkante, erzwungene Farben, Breite und Höhe, Kontrast in vier Lagen (FA 8, 9; AK 7, 8). Vorprüfung durch den ux-reviewer.
5. **B1299 Last**: Zähler und Linearität als Prüfung; 10.000 Zeilen, `longtask` allein gemessen und berichtet, ohne Grenze (AK 9).
6. **B1300 Probe im echten Programm**, Mutanten m1–m13, Gate, Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht`: die Marke `mark.wm` (CSS Z. 880–885, in den Bildern der Review-Seite in Hell und Dunkel) und die Notiz „Was die Zeichnung festlegt“, Absatz S5; „Nebeneinander“ (S7) zeigt dieselben Paare. Für S5 gilt die Zeichnung als Anhalt, nicht als Vertrag (AK 7 misst, was sie nur zeigt).

## Tests

- **Unit** (Node, rein): Paarung und Marke (alle Fälle aus AK 1–4 und 6 als Zeilenlisten), Schwelle 3/4, 999/1.000/1.001 Zeichen, Ersatzpaar am Rand, Zähler (2 × 1.000 → ≤ 2.000), Läufe über eine Blockgrenze.
- **Integration**: keine neue, der Server bleibt unverändert.
- **E2E**: AK 1–10 im gestarteten Programm gegen echtes Git. Kontrast mit `kontrastMessen`, Lage mit `getBoundingClientRect`, `longtask` über `PerformanceObserver`; Verneinungen („keine Marke“) erst nach einem sichtbaren Signal (Zeile steht, Farbe liegt auf).

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen, grün), R00217 (I0207 Syntaxfarben als Auflage, grün), R00235 (I0225 Gruppen, grün), ADR-0042 Punkt 4, ADR-0037, ADR-0040.
- Blockiert: Folgekarte S7 „Ansicht nebeneinander“ (#260, nutzt diese Paarung); S6 „lange Zeilen umbrechen“ (#259) ist unabhängig, die Marke bricht mit (FA 9).
- Hinweis für #259 (Umbrechen): „Marke bricht mit, Kante auf jedem Fragment“ aufnehmen; die Probe steht hier in AK 8 (Stil im Test gesetzt) und wird dort durch den echten Schalter ersetzt.
- Parallel baubar zu R00245 (I0235) und R00246 (I0236): berühren `web/diff.js` an anderen Stellen; beim Zusammenführen auf main gilt Rebase, kein Konflikt in der Logik.

## Offene Fragen

- Frage an den gestalter (Empfehlung gilt bis zur Antwort): Erzwungene Farben (`forced-colors`) — die Marke verliert dort Fläche und Schatten; AK 7 verlangt eine Linie (Unterstreichung oder Rand). Empfehlung: `text-decoration: underline 2px` bzw. `border-bottom: 2px solid` in `@media (forced-colors: active)`. — entschieden (PO Z. 646–649).
- Frage an den gestalter: Soll die Marke Bildschirmlesern etwas ansagen? Empfehlung: nein, kein Zusatztext (FA 5: Text Zeichen für Zeichen gleich; die Zeile trägt „hinzugefügt: “ / „entfernt: “ schon). — entschieden (PO Z. 646–649).
- Frage an den gestalter: Die Fläche der Marke hebt sich nur um 15 % von der Zeile ab, die Unterscheidung trägt die Unterkante (AK 7 misst nur Text 4,5:1 und Unterkante 3:1). Empfehlung: so lassen, D0009 ist freigegeben. — entschieden (PO Z. 646–649).
- Frage an den product-owner: Ungleich lange Läufe (1 gelöscht, 2 hinzugefügt) bekommen keine Marke (ADR W1, ehrlich statt falsch). Empfehlung: ja, so. Eine spätere Ausbaustufe „bester Partner“ wäre eine eigene Karte. — entschieden (PO Z. 646–649).
