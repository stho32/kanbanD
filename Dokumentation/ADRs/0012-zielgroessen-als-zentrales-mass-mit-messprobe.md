# ADR-0012: Zielgrößen als zentrales Maß, Messprobe über alle Ansichten

**Status**: Vorgeschlagen
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #10)
**Kontext-Anforderung**: — (Karte #10 „Zielgrößen auf mindestens 24×24 px bringen, bei Touch 44–48 px“; Anforderung legt der planer an)
**Erprobt durch**: Messprobe ohne Testsuite (headless Chromium, `target/release/kanbanD` auf freiem Port, Stand kanbanD `49d99ef`, 2026-11-06), sechs Ansichten (`#/board/…`, `#/aufgaben`, `#/personen`, `#/einrichten`, zwei Berichte), gezählt wurde jedes sichtbare `button`, `a`, `input`, `[role=checkbox]` in `#kopf` und `#main`, ohne Abstandsausnahme:
- Zeiger fein (1280×800), Maß 24: **18 von 114** unter Maß, alle auf Board und Aufgabenliste — `.naechste-box` 13×13, `.lnk` („von Board nehmen“) 8×14, `.kopf-plus` 20×20, `.signal` 22×22, `.sigz` 34×15, `.bk-name` 17 hoch, Knöpfe der Legende 22 hoch, Nummern-Links 23×17. Berichte, Personen, Einrichten: 0.
- Touch (390×844, `hasTouch`), Maß 44: **93 von 93** unter Maß in jeder Ansicht — Kopfknöpfe 32, Felder 24–26, `.btn` 28, Filterchips 24.

## Kontext

- Belegt (Code): Das einzige Touch-Maß ist eine Selektorliste mit festem Wert `@media (pointer:coarse){.btn-sym,.kz-btn,.kopf-plus,.bk-name,.signal,.kz-menue .iz,.kz-chip{min-width:32px;min-height:32px}}` (`web/kd-app.css:791–795`, R00077). Daneben gibt es eine zweite, eigene Touch-Regel mit 44 px nur für den Bestandsbericht (`web/kd-app.css:277`). In `web/kd-tokens.css` steht kein Zielmaß, nur `--kd-row:28px` und `--kd-head-h:40px` (Z. 42).
- Belegt (Code): Für den feinen Zeiger gibt es keine Regel. Jedes Element setzt seine Höhe selbst (`height:16px` bis `30px` in `web/kd-app.css`).
- Belegt (Messung, s. o.): Bei feinem Zeiger ist der Mangel örtlich (zwei Ansichten, acht Klassen). Bei Touch betrifft er jedes Ziel, auch die 32 px der Liste. Eine Korrektur nur der sechs Stellen der Karte behebt den feinen Fall, aber nicht den Touch-Fall.
- Belegt (Code): Die Teilaufgabe auf der Karte ist ein Kästchen `button.naechste-box[role=checkbox]` neben einem `span` mit dem Text (`web/ansicht.js:585`). Der Text ist kein Teil des Ziels, und ein Tipp auf den Text öffnet die Karte (`.ka` hat `cursor:pointer`, `web/kd-app.css:104`).
- Belegt (PO): „Eine Zielgröße an genau einem Ort“: Die Kopfzeile nutzt das zentrale Touch-Maß als Untergrenze. Karte #10 legt den Wert fest und hebt ihn zentral, R00101 erbt ihn (`AI-Team/po-entscheidungen.md:17`). Außerdem: 320/375/414 px ohne waagrechtes Scrollen (`:98`), alle Ziele auch in compact erreichbar (`:15`).
- Maß (Primärquelle, abgerufen 2026-11-06): WCAG 2.2 SC 2.5.8 *Target Size (Minimum)*, Stufe AA, https://www.w3.org/TR/WCAG22/#target-size-minimum. Gefordert sind mindestens 24×24 CSS-px. Ausnahmen: **Spacing**, d. h. ein Kreis von 24 px Durchmesser um die Mitte jedes zu kleinen Ziels schneidet kein anderes Ziel und keinen anderen solchen Kreis; außerdem *Equivalent*, *Inline* (im Satz oder durch die Zeilenhöhe begrenzt), *User Agent Control* und *Essential*. SC 2.5.5 *Target Size (Enhanced)*, Stufe AAA, verlangt 44×44 CSS-px (https://www.w3.org/TR/WCAG22/#target-size-enhanced).
- Maß (Referenz-Designsystem, Factory-Gedächtnis `rollen/ux-reviewer/spezialisierungen/material3/notizen.md:223`, `:197`, `:117`): Touch-Ziel mindestens 48×48 dp, Abstand ≥ 8 dp, Icon 24 dp im 48-dp-Ziel (https://m3.material.io/foundations/designing/structure). Die Checkbox hat eine Box von 18 dp und ein Ziel von 48 dp (https://m3.material.io/components/checkbox/specs). Chips sind 32 dp hoch (https://m3.material.io/components/chips/specs). Auf dem Web gilt 1 dp ≈ 1 CSS-px (`notizen.md:12`). Für den feinen Zeiger nennt das Gedächtnis 44 dp, für ein dichtes Desktop-Board ist das ein Richtungsentscheid, siehe Offene Fragen.
- Zwänge: Der zentrale Stil des Projekts (Blaugrau, eckig, dicht) und die Vision gehen M3 vor (Factory `gemeinsam/regeln.md`, „Gestaltung“). Es gibt keinen Build-Schritt (`A00009`). Gezeichnet wird per `innerHTML` (ADR-0007). Tab-Halte und Fokus regelt ADR-0010, Farben ADR-0011.

Die Klasse des Fehlers lautet: „Die Größe eines Ziels entscheidet jede CSS-Regel selbst, und nichts misst sie.“ Sie lautet nicht: „Sechs Stellen sind zu klein.“ Die 32-px-Liste zeigt, wohin Einzelkorrekturen führen. Sie zählt Klassen auf, hat einen festen Wert an einer zweiten Stelle (Z. 277), und jedes neue Element fehlt darin.

## Optionen

### Option A: Einzelkorrekturen und längere Touch-Liste
Die sechs Stellen der Karte vergrößern, die Selektorliste in `@media (pointer:coarse)` von 32 auf 44 heben und um die gemessenen Klassen verlängern. Dazu kommt die Abnahme-Probe der Karte.
- Vorteile: kleinste Änderung, kein neuer Begriff.
- Nachteile: Die Liste müsste bei Touch nahezu jede Klasse nennen (93 von 93 Zielen), und Felder und Chips sind heute gar nicht darin. Den Wert gibt es weiter zweimal (Z. 277 und die Liste). Die Kopfzeile (R00101) bekommt ihren Wert nicht „zentral“, wie es der PO verlangt.
- Schwäche: Die Liste veraltet mit jedem neuen Element, sie behebt Stellen und nicht die Klasse.

### Option B: Zielmaß als Token, eine Basisregel, Trefferhof für kleine Zeichen, Messprobe über alle Ansichten
Das Maß steht genau einmal in `web/kd-tokens.css` und schaltet per `@media (pointer:coarse)` um. Eine Basisregel in `web/kd-base.css` gibt allen Bedienelementen die Mindestgröße. Ein kleines sichtbares Zeichen (Kästchen, Signal, `+`) bekommt eine unsichtbare Treffererweiterung (Trefferhof) statt einer größeren Zeichnung. Durchgesetzt wird die Regel durch eine E2E-Messprobe über alle Ansichten nach dem Muster von R00107 (`kontrast.spec.js`).
- Vorteile: ein Ort für den Wert (PO Z. 17). Neue Elemente erben die Regel, ohne genannt zu werden. Die Dichte bei feinem Zeiger bleibt, weil kleine Zeichen klein bleiben und nur ihr Ziel wächst (so macht es M3 bei der Checkbox: 18 dp Box, 48 dp Ziel). Die Probe misst, was gezeichnet ist, nicht was im CSS steht.
- Nachteile: Ein Trefferhof (`::after` mit negativem `inset`) wird von `overflow:hidden` des Elternelements abgeschnitten und kann den Hof des Nachbarn überdecken. Bei Touch reicht er deshalb nicht überall, Kopfzeile, Felder und Zeilen müssen sichtbar wachsen. Die Basisregel muss Inline-Links im Fließtext auslassen (WCAG *Inline*).
- Schwäche: Die Probe ist so gut wie ihre Ansichtenliste und ihre Fixtures (Zustände, die nur mit Daten erscheinen: Signal, Timer, Teilaufgabe, Archiv).

### Option C: M3-Maß überall (48 px bei jedem Zeiger)
Jedes Ziel 48×48 sichtbar, unabhängig vom Zeiger, und eine Probe.
- Vorteile: einfachste Regel, ein Wert, keine Medienabfrage.
- Nachteile: bricht den zentralen Stil „dicht“. Das Board verliert bei 28-px-Zeilen und 64-px-Karten etwa ein Drittel der sichtbaren Karten je Spalte. 320 px ohne waagrechtes Scrollen (PO Z. 98) wird für Kopfzeile und Einrichten fraglich.
- Schwäche: verlangt mehr als WCAG AA für den feinen Zeiger, auf Kosten der Leitidee „ein dichtes Board“.

### Option D: Treffer per Skript zum nächsten Ziel lenken
Ein `pointerdown`-Hörer sucht im Umkreis von 24 bzw. 44 px das nächste Ziel und löst es aus.
- Vorteile: keine Änderung an Layout und CSS.
- Nachteile: Für Hilfsmittel und für die WCAG-Messung (Rechteck des Ziels) bleibt alles zu klein. Der Hörer konkurriert mit dem Klick auf die Karte (`.ka`), mit dem Ziehen und mit `data-act`. Er braucht Sonderwege nach jedem Neuzeichnen (ADR-0007).
- Schwäche: unsichtbare Logik, die das Messbare nicht ändert.

## Entscheidung

**Vorgeschlagen: Option B**: Zielmaß als Token, eine Basisregel, Trefferhof für kleine Zeichen, Messprobe über alle Ansichten.

B schließt die Klasse, bedient die PO-Linie „eine Zielgröße an genau einem Ort“ und hält die Dichte bei feinem Zeiger. A bleibt der Weg für ein einzelnes Element innerhalb der Regel. Bewusst in Kauf genommen: Bei Touch wächst die Zeichnung von Kopfzeile, Feldern und Zeilen sichtbar, und es gibt eine weitere E2E-Probe. Der Status bleibt „Vorgeschlagen“, bis der PO die beiden Maße bestätigt (Offene Fragen 1 und 2).

Regeln:

1. **Ein Maß, ein Ort.** `web/kd-tokens.css` trägt `--kd-ziel` (Mindestkante eines Ziels). Der Wert ist 24px bei feinem Zeiger, in `@media (pointer:coarse)` der Touch-Wert, Vorschlag 48px, mindestens 44px. Kein anderes Stylesheet nennt einen Zahlenwert für die Mindestgröße eines Ziels. `web/kd-app.css:277` und die Liste `:791–795` gehen in der Regel auf. Die Kopfzeile (R00101) und die Stufe compact lesen dasselbe Token.
2. **Basisregel.** `web/kd-base.css` gibt jedem Bedienelement `min-block-size`/`min-inline-size: var(--kd-ziel)`. Gemeint sind `button`, `select`, `input` (außer versteckten), `a.btn` und die Rollen `checkbox`, `radio`, `menuitem`, `tab`, `switch`. Der Selektor steht in `:where(…)`, damit die Spezifität null bleibt und Komponenten sie gezielt überschreiben können. Ausgenommen ist ein `a` im Fließtext (WCAG *Inline*). Ein Link, der allein in einer Zelle oder Zeile steht (z. B. die Nummer in der Aufgabenliste), ist kein Fließtext und fällt unter die Regel.
3. **Trefferhof statt Vergrößerung**, wo ein Zeichen klein bleiben soll (Kästchen, Signal, `+`, `✕`). Das Element bekommt `position:relative` und ein durchsichtiges `::after` mit `inset: min(0px, (100% - var(--kd-ziel)) / 2)`, sodass die Trefferfläche das Ziel auf `--kd-ziel` ergänzt. Das gilt nur, wenn der Hof keinen Nachbarn überdeckt und kein Elternelement ihn abschneidet. Sonst wächst das Element selbst. Der Hof trägt keine Farbe, Kontrast und Grund bleiben bei ADR-0011. Gemessen wird das Rechteck des Hofs, nicht das des Zeichens (siehe Regel 6).
4. **Text gehört zum Ziel, wo er die Aktion benennt** (M3 Checkbox, Ziel schließt den Text ein). Bei der Teilaufgabe wird der Text Teil desselben Ziels: ein Element mit `role=checkbox` und dem Text als Inhalt, oder ein `label`, das beide umschließt. Ein Tipp auf den Text setzt `aria-checked`, die Karte öffnet sich nicht.
5. **Verhältnis zu ADR-0010.** Regel 4 legt keinen neuen Tab-Halt an. Kästchen und Text sind *ein* fokussierbares Element, wie heute das Kästchen allein, und `data-act` bleibt am nächsten Vorfahren des Klicks. Menüeinträge (`tabindex=-1`) und roving Radiogruppen sind Zeigerziele und werden gemessen, auch wenn sie keinen Tab-Halt haben. Unter einem offenen Dialog (`inert`) wird nur die oberste Ebene gemessen.
6. **Messprobe als Fitness Function**, im Muster von R00107 (`e2e/tests/kontrast.spec.js`, auf `karte/9`):
   - `e2e/tests/ziele.spec.js` öffnet jede Ansicht der gemeinsamen Ansichtenliste mit Fixtures, die Signal, Fälligkeit, Teilaufgabe, laufenden Timer, Archiv und Zuweisung zeigen. Die Probe läuft je einmal mit feinem Zeiger (1280 px) und mit Touch (`hasTouch`, 390 px).
   - Bei feinem Zeiger besteht ein Ziel, wenn seine Trefferfläche ≥ 24×24 ist oder es die **Spacing**-Ausnahme von SC 2.5.8 wörtlich erfüllt: Der Kreis von 24 px um seine Mitte schneidet kein anderes Ziel und keinen anderen Kreis. Ein „Abstand von 24 px zwischen Rändern“ ist eine andere, strengere Formel. Bei Touch besteht ein Ziel nur, wenn die Fläche ≥ 44×44 ist, ohne Ausnahme.
   - Die Trefferfläche ist das Rechteck des Elements, vereinigt mit dem seines `::after`. Ob der Hof wirklich trifft, prüft die Probe per `document.elementFromPoint` an den Ecken.
   - Eine Liste `NICHT_GEMESSEN` führt Ausnahmen mit Selektor, Ansicht, Karte, heutigem Maß und Grund. Der Test schlägt Alarm, wenn ein Eintrag verschwindet, das Maß erreicht oder kleiner wird.
   - Selbstproben: Ein künstliches 20×20-Ziel fällt durch, ein 24×24-Ziel besteht. Zwei 20×20-Ziele mit 30 px Mittenabstand bestehen bei feinem Zeiger, mit 20 px fallen sie durch. Ein 13-px-Zeichen mit Hof besteht, derselbe Hof unter `overflow:hidden` fällt durch.
   - Die Ansichtenliste teilen Kontrast- und Zielprobe in einem Modul (z. B. `e2e/tests/ansichten.js`) statt in zwei Kopien.
7. **Reine Probe für den Ort.** Ein Node-Test (`e2e/einheit/ziele.test.js`, als Text über die Stylesheets, ohne Browser) prüft dreierlei:
   - `--kd-ziel` steht genau einmal je Zeiger in `web/kd-tokens.css`, der feine Wert ist 24, der grobe ≥ 44.
   - Kein anderes Stylesheet setzt `min-width`/`min-height`/`min-*-size` mit einem Zahlenwert innerhalb von `@media (pointer:coarse)`.
   - Die Spanne ist geprüft, d. h. Mutanten 23 und 43 fallen durch (Factory `gemeinsam/gelerntes.md`, „Wert als Spanne prüfen“).

## Konsequenzen

- Positiv: Das Touch-Maß folgt einem einzigen Token. R00101 (Kopfzeile) und R00077 (Responsive) erben es ohne eigene Zahl. Neue Elemente sind ohne Zutun groß genug, und wo nicht, sagt es die Probe in der Ansicht, in der sie zuerst erscheinen.
- Positiv: Die Teilaufgabe ist auf dem Handy bedienbar, ohne versehentlich die Karte zu öffnen.
- Negativ: Bei Touch wird die Oberfläche sichtbar größer. Kopfzeile 40 → ≥ 48, Felder 24–26 → 48, Zeilen der Menüs 30 → 48. Die Spaltenbreite in compact (`--bw:calc(100vw - 28px)`) zeigt weniger Karten. Das ist gewollt und kommt aus der Karte, nicht aus dieser Entscheidung.
- Negativ: Der bestehende Test `e2e/tests/r00077-responsive.spec.js:61–68` prüft ≥ 32 und bleibt grün, sagt aber nichts mehr. Er wird auf das Token umgestellt oder in `ziele.spec.js` aufgehoben.
- Risiko (Pre-Mortem): „Die Probe ist grün, das Handy trotzdem schlecht.“ Ursachen wären Zustände ohne Fixture oder ein Hof, der zwar das Rechteck vergrößert, aber nicht trifft. Gegenmittel: Die Fixtures stehen in der Probe neben der Ansichtenliste, und `elementFromPoint` steht als Selbstprobe in Regel 6.
- Risiko: Die Basisregel vergrößert Elemente, die bewusst klein sind (Eingabefelder in Tabellenzellen `.mini-inp`, Farbwahl `.farbe` 26×22). Diese gehen in `NICHT_GEMESSEN` mit Karte, oder sie bekommen einen Hof. Still verkleinern ist nicht erlaubt.
- Risiko: Der Hof unter `overflow:hidden` (`.leg`, `.mod-fuss`, `.ka .r3`) wird abgeschnitten. Dann muss das Element selbst wachsen. Die Probe findet es über `elementFromPoint`.
- Review-Punkt für architektur-reviewer und code-reviewer: „Neues Bedienelement unter `--kd-ziel` oder mit eigener Mindestgröße in Pixeln?“ Erkennen: `grep -nE "pointer: ?coarse" web/*.css` mit Treffern außerhalb von `web/kd-tokens.css` ist ein Befund.

## Offene Fragen

1. **Maß bei feinem Zeiger**: 24 px (WCAG 2.5.8 AA, Kartenvorschlag) oder 44 px (Gedächtnis M3 für Zeiger)? Empfehlung: **24 px**. Das dichte Desktop-Board ist der zentrale Stil des Projekts, und kleine Zeichen erreichen 24 über einen Hof, ohne dass sich die Zeichnung ändert.
2. **Maß bei Touch**: 48 px (M3, Standard nach Factory `gemeinsam/regeln.md`, „Gestaltung“) oder 44 px (WCAG 2.5.5 AAA, Kartenuntergrenze)? Empfehlung: **48 px als Token, 44 px als Untergrenze der Probe**. Das folgt dem Referenz-Designsystem, und die Probe bleibt grün, falls der PO auf 44 geht.

## Quellen / Bezüge

- Karte #10 (Board), Messprobe oben, Stand kanbanD `49d99ef`
- WCAG 2.2 SC 2.5.8 und 2.5.5: https://www.w3.org/TR/WCAG22/#target-size-minimum, https://www.w3.org/TR/WCAG22/#target-size-enhanced (abgerufen 2026-11-06)
- M3 über das Factory-Gedächtnis `rollen/ux-reviewer/spezialisierungen/material3/notizen.md:117`, `:197`, `:223`. Primärquellen https://m3.material.io/foundations/designing/structure, https://m3.material.io/components/checkbox/specs, https://m3.material.io/components/chips/specs (ohne Skript nicht abrufbar, Werte aus dem Gedächtnis)
- `AI-Team/po-entscheidungen.md:15`, `:17`, `:98`
- [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md)
- Modell: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md), [X00003 Zielgrößen](../Architektur/Aspekte/X00003-zielgroessen.md)
