---
id: R00101
status: Neu
datum: 2026-10-31
---

# R00101: Kopfzeile auf jeder Breite bedienbar

## Beschreibung

Die Kopfzeile des Boards wird nach den Breakpoints von Material 3 geordnet, damit sich bei keiner Fensterbreite zwei Bedienelemente überlagern. Heute verdecken bei 1280 px „3 laufen“ und „Darstellung“ den Knopf „+ Neue Aufgabe“, sodass ein Klick darauf den Timer-Überblick öffnet. Unter 1024 px rutschen Knöpfe übereinander, und unter 980 px fehlt der Bereichsfilter „alle / meine / Agenten“ ganz. Danach gilt: Was nicht passt, wandert in ein Menü „Mehr“ oder (unter 600 px) in ein Navigationsmenü. „Neue Aufgabe“ und der Bereichsfilter bleiben bei jeder Breite ohne Menü bedienbar.

Zwei Slices derselben Interaction I0083:

- **F0001 Kopfzeile ohne Überlappung, Rest im Menü** (Karte #7, Muss)
- **F0002 Bereichsfilter auf schmalen Breiten** (Karte #14, Sollte)

Der zentrale Stil des Projekts („blaugrau, eckig, dicht“, `web/kd-tokens.css`) bleibt erhalten. Material 3 liefert Komponente, Breakpoint und Verhalten, aber nicht Farbe, Form oder Dichte.

Zahlt ein auf: [Vision](R00000-vision.md) — das Board ist überall da, wo die Arbeit ist, und dieselbe Oberfläche läuft auf Desktop, Tablet und Handy ohne zweiten Modus (fortgesetzt aus R00077).

## Geschäftlicher Nutzen

„Neue Aufgabe“ ist die häufigste Aktion am Board. Ein Klick darauf darf nie etwas anderes auslösen, auch nicht auf einem Laptop mit 1280 px. Auf Tablet und Handy fehlt heute der Filter „meine“, mit dem man unterwegs nur die eigenen Karten sieht.

## Funktionale Anforderungen

- Die Kopfzeile ordnet ihre Elemente je M3-Breakpoint: compact unter 600 px, medium 600–839 px, expanded 840–1199 px, large ab 1200 px.
- Elemente ohne Platz wandern in ein Menü „Mehr“ (M3 Menu) am Ende der Kopfzeile. Ein Eintrag dort löst dieselbe Aktion aus wie vorher der Knopf.
- Unter 600 px wird die Navigation (Board, Aufgaben, Personen, Berichte, WBS, Einrichten) über einen Knopf mit dem Namen der aktuellen Seite geöffnet und nicht mehr über eine wischbare Leiste.
- „Neue Aufgabe“ wandert nie ins Menü. Unter 600 px darf der Knopf nur „+“ zeigen, behält aber den zugänglichen Namen „Neue Aufgabe“.
- Der Bereichsfilter „alle / meine / Agenten“ wandert nie ins Menü. Unter 840 px steht er als Filter-Chips in der Werkzeugzeile.
- Dieselben Regeln gelten für alle Ansichten mit Kopfzeile (Board, Aufgaben, Personen, Berichte, Einrichten) und für den Modus „Spalten einrichten“.

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit: Bei grobem Zeiger (Touch) haben Knöpfe, Chips und Menüeinträge der Kopfzeile eine Tippfläche von mindestens 32 × 32 px. Das ist die Dichte aus R00077, nicht die 48 dp von M3, weil der zentrale Stil vorgeht.
- Barrierefreiheit: Das Menü „Mehr“ und das Navigationsmenü sind per Tastatur erreichbar (Tab, Enter, Esc) und tragen `aria-haspopup`.

## Akzeptanzkriterien

Gegeben für jede Probe: Board mit drei Spalten, der Mensch „Erika Mustermann“ (EM) ist als Ich gewählt, drei Timer laufen (Kopfzeile zeigt „3 laufen“). Alles lässt sich über die API herstellen.

**Kopfzeilen-Bedienelement** heißt jedes sichtbare `button`, `a`, `input`, `select` und jedes Element mit `role="radio"`, `role="checkbox"` oder `data-act` innerhalb von `header.kz`, dessen Rechteck nicht leer ist. Einträge eines geschlossenen Menüs zählen nicht.

### F0001 — Abnahme-Probe von Karte #7 (wörtlich)

- [ ] Bei 1024, 1100, 1280, 1366 und 1440 px liefert `document.elementFromPoint` im Mittelpunkt jeder Kopfzeilen-Schaltfläche die Schaltfläche selbst; ein Klick auf „Neue Aufgabe“ öffnet das Fenster „Neue Aufgabe“.
- [ ] Die Abnahme-Probe gilt zusätzlich bei 375, 414, 600, 768 und 900 px. Bei jeder Breite überlappen sich keine zwei Kopfzeilen-Bedienelemente (Rechtecke schneiden sich nicht), und `elementFromPoint` im Mittelpunkt jedes Elements liefert das Element selbst.

Lesart der Probe:

- „Das Element selbst“ schließt seine Nachfahren ein. Bei `+ <span class="lang">Neue Aufgabe</span>` zählt auch der `span`.
- „Schneiden sich nicht“ heißt, die Schnittfläche zweier Rechtecke ist 0 px². Berührende Kanten sind erlaubt.
- Rechenbeispiel aus dem Befund bei 1280 px: „Neue Aufgabe“ x 1065–1172 und „3 laufen“ x 1043–1124 schneiden sich auf 1065–1124, also 59 px Breite. Das ist heute rot.

### F0001 — Was nicht passt, bleibt erreichbar

- [ ] Bei allen zehn Breiten ist kein Kopfzeilen-Bedienelement abgeschnitten: Sein Rechteck liegt vollständig im Fenster und in `header.kz`, und die Kopfzeile scrollt nicht waagerecht (`scrollWidth` = `clientWidth`).
- [ ] Bei 375 px erreicht man „Signale oben“, „Spalten“ und „Darstellung“ mit höchstens zwei Klicks über das Menü „Mehr“. Ein Klick auf „Spalten“ dort öffnet den Modus „Spalten einrichten“.
- [ ] Bei 375 px öffnet der Navigationsknopf ein Menü mit Board, Aufgaben, Personen, Berichte, WBS und Einrichten. Ein Klick auf „Aufgaben“ zeigt die Aufgabenliste.
- [ ] Ein offenes Menü „Mehr“ liegt bei 375 px vollständig im Fenster.
- [ ] Bei allen zehn Breiten ist „Neue Aufgabe“ ohne Menü sichtbar. Sein zugänglicher Name enthält „Neue Aufgabe“.
- [ ] Bei 1280, 1366 und 1440 px stehen Filterfeld, Bereichsfilter und „Neue Aufgabe“ direkt in der Kopfzeile.
- [ ] Die Probe der ersten beiden Kriterien besteht auch in den Ansichten Aufgaben, Personen, Berichte und Einrichten sowie im Modus „Spalten einrichten“, jeweils bei 375, 768 und 1280 px.

### F0002 — Abnahme-Probe von Karte #14 (wörtlich)

- [ ] Bei 375 und 768 px ist ein Bedienelement „meine“ sichtbar, per Touch auslösbar und filtert das Board auf die eigenen Karten.

Lesart der Probe:

- „Sichtbar“ heißt ohne Öffnen eines Menüs.
- „Eigene Karten“ sind die Karten, bei denen das gewählte Ich unter den Zuständigen steht, also dieselbe Regel wie heute über 980 px (`web/filter.js`).
- Rechenbeispiel: Das Board hat 5 Karten, EM ist bei #1 und #4 zuständig, #2 hat EM und einen Agenten, #3 und #5 haben niemanden. „meine“ zeigt dann 3 Karten (#1, #2, #4), „alle“ wieder 5.
- „Per Touch“ wird in Playwright mit `hasTouch: true` und `tap()` geprüft. Die Tippfläche ist mindestens 32 × 32 px.

### F0002 — Grenzen

- [ ] Nach einem Wechsel der Fensterbreite von 375 auf 1280 px bleibt der gewählte Bereich „meine“ gewählt, und das Board zeigt weiter 3 von 5 Karten.
- [ ] Ohne gewähltes Ich zeigt „meine“ bei 375 px 0 Karten, wie heute über 980 px. Es gibt keinen Fehler in der Konsole.

## Betroffene Verzeichnisstruktur

- Oberfläche: `web/ansicht.js` (Kopfzeile `vKopf`, `vThemaKnopf`, `vLaufKnopf`, `vIchKnopf`, `vListenWerk`) und `web/kd-app.css` (Kopfzeile Z. 10–50, Responsive-Block ab Z. 670).
- Logik ohne DOM, etwa die Zuordnung von Breite zu Stufe zu Platz der Elemente, liegt als reine Funktion in einer eigenen Datei unter `web/` mit Einheitstest unter `e2e/einheit/`.
- E2E: `e2e/tests/r00101-kopfzeile.spec.js`.
- `web/` ist per `include_bytes!` eingebettet. Änderungen werden erst nach `cargo build` und einem Neustart sichtbar.

## Technische Überlegungen

### Optionen

| | A: M3-Umbau nach Breakpoints (Menü „Mehr“, Navigationsmenü compact) | B: Umbruch-Breakpoints aus der gemessenen Breite der Elemente | C: Extended FAB für „Neue Aufgabe“ plus App bar mit höchstens 2 Aktionen |
|---|---|---|---|
| Komplexität | mittel: vier Stufen, ein Menü | gering: Zahlen in CSS anpassen | hoch: neues Bauteil, schwebt über den Spalten |
| Robustheit | hoch: Stufen hängen nicht an Textlängen | gering: bricht bei langen Board- oder Personennamen und bei „nicht live“ erneut | hoch |
| Stil „dicht“ | passt, die Kopfzeile bleibt eine Leiste | passt | bricht ihn: ein FAB verdeckt Karten der rechten Spalte |
| Testbarkeit | Probe je Breite, deterministisch | Probe je Breite, aber mit Namen abhängig vom Inhalt | wie A |

**Entscheidung: A.** Begründung: Option B behebt nur den gemessenen Fall, und Option C opfert Fläche auf dem dichten Board. Option A deckt den Wunsch des Betreibers ab („nach M3-Breakpoints in ein Overflow-Menü bzw. in die Navigation“). Verworfenes steht unter Notizen.

### Ablauf (Vorplanung, den Zuschnitt entscheidet der Entwickler)

1. **Stufe bestimmen**: Breite → compact, medium, expanded oder large (`matchMedia`, gleiche Grenzen in CSS).
2. **Plätze verteilen**: Stufe und Ansicht → Elemente in der Kopfzeile und Elemente im Menü „Mehr“.
   - 2.1 „Neue Aufgabe“ und der Bereichsfilter bleiben immer in der Kopfzeile.
   - 2.2 Zuerst wandern „Signale oben“, „Spalten“ und „Darstellung“ ins Menü, unter 600 px auch die laufenden Timer. Der Zähler bleibt dann als Abzeichen am Menüknopf.
3. **Zeichnen**: Kopfzeile mit Knopf ⋮ „Mehr“, Menü nach M3 Menu, unter 600 px ein Navigationsknopf „<Seite> ▾“.
4. **Bereich**: unter 840 px Filter-Chips, darüber die bisherige Gruppe.

Bubbles aus der WBS (Vorplanung):

| Bubble | Slice | Eingabe → Ausgabe | Aufwand h |
|---|---|---|---|
| B0263 Kopfzeile vermessen | F0001 | Rechtecke, Fenster → Konflikte (Überlappung, abgeschnitten, verdeckt) | 0,5-1 |
| B0264 Breakpoints nach M3 | F0001 | Breite → Stufe → Plätze der Elemente; auch Modus „Spalten einrichten“ | 1-2 |
| B0265 Menü „Mehr“ | F0001 | Elemente ohne Platz → Knopf ⋮ mit Menü, gleiche Aktionen | 1-2 |
| B0266 Navigation als Menü unter 600 px | F0001 | compact → Knopf „<Seite> ▾“ mit allen Zielen | 0,5-1 |
| B0267 „Neue Aufgabe“ immer direkt | F0001 | jede Breite → nie im Menü, compact nur „+“ mit Namen | 0,5-1 |
| B0268 Bereich als Filter-Chips unter 840 px | F0002 | Breite < 840 → Chips, Tippen setzt den Bereich | 1-2 |

Wireframe: `Dokumentation/Wireframes/D0002.dc.html` (Board, Betrieb `lokal`). Daraus gelten für diesen Slice der Kopfbereich und seine Elemente als Verweis. Die Anordnung nach Breite legt das Artboard nicht fest, sie kommt aus Material 3 (`gemeinsam/regeln.md` der Factory, „Gestaltung“).

M3-Fundstellen:

- Breakpoints: https://m3.material.io/foundations/layout/breakpoints/overview
- Menu: https://m3.material.io/components/menus/overview
- Top app bar mit 1–2 Aktionen, Rest in Toolbar oder Menü: https://m3.material.io/components/app-bars/overview
- Filter chips: https://m3.material.io/components/chips/guidelines
- Button group statt Segmented button: https://m3.material.io/components/button-groups/overview

Abgerufen 2026-10-31 über die Notizen des ux-reviewers.

### Änderungen an bestehenden Funktionen

- `vKopf`: Elemente nach Stufe verteilen, Knopf „Mehr“ und Navigationsknopf.
- `vListenWerk` und der Modus „Spalten einrichten“: dieselben Stufen.
- `kd-app.css`: Die Kopfzeilen-Regeln bei 1180, 1024, 980 und 640 px ersetzen die M3-Stufen. Regeln anderer Bereiche (Fenster, Bahnen, Einrichten) bleiben.

## Tests

Nach Skill `test-pyramide`:

- **Einheit** (`node --test e2e/einheit/`): die reine Funktion „Breite und Ansicht → Plätze“ für alle zehn Breiten. Dazu der Prüfhelfer „Rechtecke → Konflikte“ mit dem Rechenbeispiel von 1280 px als rotem Fall.
- **E2E** (Playwright): die Proben der Akzeptanzkriterien als Schleife über die zehn Breiten. Der Gegeben-Zustand entsteht über die API (drei Timer, Ich EM, fünf Karten mit den genannten Zuständigen). Zusätzlich je ein Klick auf „Neue Aufgabe“, „Mehr → Spalten“, „Navigation → Aufgaben“ und ein `tap()` auf „meine“ mit `hasTouch`.
- **Gegenprobe**: Die Proben laufen vor dem Bau gegen den heutigen Stand. Sie müssen bei 1280 px (Überlappung) und bei 375/768 px (kein „meine“) rot sein.

## Abhängigkeiten

- Abhängig von: R00077 Responsive für Tablet und Handy (I0065, gruen)
- Blockiert: keine

## Offene Fragen

- keine im Dokument. Richtungsfragen an den Product Owner stehen im Bericht des planers vom 2026-10-31: Navigation Bar unten statt Navigationsmenü unter 600 px, und Button group über 840 px.

## Manuelle Vorbereitungstätigkeiten

- keine

## Manuelle Nachbereitungstätigkeiten

- Nach dem Merge Auslieferung nach `AI-Team/prozess.md` (`cargo install --path . --locked`) und Demo nachziehen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Befund der UX-Durchsicht: Bei 1280 px liegt „3 laufen“ über „+ Neue Aufgabe“, sodass der Klick den Timer-Überblick statt des Fensters öffnet. Die Ursache sind feste Breakpoints (1180, 1024, 980), die nicht dazu passen, wie viel Platz die Elemente wirklich brauchen. Je nach Board-Name, Zahl der laufenden Timer und „nicht live“ schieben sich die Knöpfe zwischen den Breakpoints übereinander. Wenn die Kopfzeile stattdessen je M3-Stufe festlegt, was direkt steht, und alles Übrige in ein Menü legt, hängt der Platz nicht mehr an Textlängen. Die zehn Breiten der Probe treffen jede Stufe und jede heutige Grenze. Dass „Neue Aufgabe“ und „meine“ nie ins Menü wandern, ist der Hebel für die Nutzer: die häufigste Aktion und der wichtigste Filter bleiben auf jedem Gerät einen Tipp entfernt.

## Missing-Docs

- Die Breite der Kopfzeilen-Elemente je Inhalt (lange Board-Namen, „nicht live“) ist nirgends dokumentiert. Die Probe misst sie, eine Tabelle fehlt.

## Notizen

**Verworfene Alternativen**

- **B, Breakpoints aus der gemessenen Breite von `kz-z3`**: Das heilt nur 1280 px. Mit einem längeren Board-Namen oder „nicht live“ tritt die Überlappung an anderer Stelle wieder auf.
- **C, Extended FAB**: Der FAB schwebt über der rechten Spalte und verdeckt Karten. Das widerspricht dem dichten Stil, und eine Ecke von 16 dp widerspricht dem eckigen. Die Probe von #7 erfüllt Option A ebenso.

**Bewusst außerhalb**

- Den Bereichsfilter über 840 px als M3-Button-group neu zu zeichnen, ist Gestaltung ohne Befund. Das gehört in eine eigene Karte, wenn der Product Owner sie will.
- Eine Navigation Bar unten für compact steht nicht im Umfang. M3 erlaubt 3–5 Ziele, kanbanD hat sechs.
