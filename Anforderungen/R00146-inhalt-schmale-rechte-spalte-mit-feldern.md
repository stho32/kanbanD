---
id: R00146
status: Neu
datum: 2026-11-12
---

# R00146: Inhalt — schmale rechte Spalte mit Spalte, Klasse, Labels, Fälligkeit (bearbeitbar) und Zuständigen (nur lesend)

## Beschreibung

Der Inhalt des Aufgabenfensters bekommt rechts eine **schmale Spalte**: **Spalte, Klasse, Labels und Fälligkeit** stehen dort **bearbeitbar**, die **gewählten Zuständigen** dort **nur lesend**. Die Ansicht „Details“ bleibt und bleibt die vollständige Bearbeitungsstelle — auch für die Zuständigen. Die übrigen Felder (Schlüssel, Herkunft, Reservierung, Geschätzt, Zählung, „wartet auf“, Wirkungen, Phasen, Signale) stehen weiterhin nur in „Details“. Es gibt keinen neuen Endpunkt, kein neues Datenformat und kein Sammel-Speichern: jede Änderung geht wie heute als PATCH je Feld sofort in die Aufgabendatei und wird committet (R00011).

Damit erscheinen Spalte, Klasse, Labels, Fälligkeit und die gewählten Zuständigen in **zwei Ansichten** desselben Zustands. Das ist eine ausdrückliche, eng gefasste **Ausnahme** von „jeder Abschnitt genau einmal“ (R00127, R00145); sie steht unten im Wortlaut und ist in beiden Anforderungen nachgezogen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgeräumt und folgt gewohnten Konventionen“ (die wichtigsten Einstellungen einer Aufgabe stehen dort, wo man sie liest) und „Ein Commit je Aktion“.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wer eine Aufgabe liest, will die vier Angaben sehen, an denen die Arbeit hängt: wo die Karte steht, um welche Art Aufgabe es geht, welche Labels sie trägt und wann sie fällig ist. Heute kostet jede dieser Antworten einen Ansichtswechsel nach „Details“ und zurück. Weil die Spalte im Inhalt selbst bearbeitbar ist, bleibt der Blick auf Beschreibung, Teilaufgaben und Kommentaren und die Änderung geht trotzdem sofort in die Datei und in einen Commit. Die Zuständigen sind dort **nur** zu sehen: wer sie ändert, arbeitet ohnehin in „Details“, und ein zweiter Schreibweg für dieselbe Angabe wäre eine zweite Quelle.

## Funktionale Anforderungen

### Die Spalte im Inhalt
1. Der Inhalt zeigt rechts eine schmale Spalte mit den Feldzeilen **Spalte · Klasse · Labels · Fällig · Zuständig** in dieser Reihenfolge. Links stehen Titel, Beschreibung und die Abschnitte (TEILAUFGABEN → ANHÄNGE → KOMMENTARE → DURCHLÄUFE) unverändert. Die Spur ist **200 px** fest (`grid-template-columns:minmax(0,1fr) 200px`; nicht `--bw`, das ist die Board-Spaltenbreite) und trägt `min-width:0`; bei 200 − 2 × 12 px Innenabstand bleiben **176 px** Wertfläche. Darum steht in der Spalte die **Beschriftung über dem Wert** (`.felder.felder-schmal`, eine Spalte) — die 84-px-Beschriftungsspalte des Hauses würde das Datumsfeld schneiden. Gezeichnet wird dieselbe Feldzeile wie in „Details“ (ein Zeichner).
2. **Spalte, Klasse, Labels und Fällig sind bearbeitbar** und wirken wie in „Details“: „Spalte“ bewegt die Karte (R00006), die übrigen drei schreiben ihr Feld. Jede Änderung ist **ein** PATCH und **ein** Commit; ohne Änderung entsteht kein Commit (R00011).
3. **Zuständig ist nur lesend**: die Spalte nennt **nur die gewählten** Zuständigen (nicht alle aktiven Personen), ohne Knopf, ohne `data-act`, ohne `aria-pressed` und ohne `tabindex`, und **ohne Chip** (M3-Chips sind interaktiv und wären ein zweiter Schreibweg oder ein Missbrauch). Je Zuständigem steht die Initiale als Verzierung (`aria-hidden="true"`) plus der **Name** als Information. Der Abschnitt trägt den zugänglichen Namen „Zuständig“. Leerfall: die Zeile trägt das Wort **„niemand“** (Text in `--kd-muted`), kein leeres Bedienelement. Geändert werden die Zuständigen weiterhin allein in „Details“ (R00039); eine stillgelegte Person erscheint dort mit `disabled`/`title="stillgelegt"` — in der nur lesenden Spalte ist der Hinweis folgenlos (O2).
4. **Ein Feldwert, ein Schreibweg.** Die Felder der Spalte tragen **dieselben** Schlüssel wie ihre Gegenstücke in „Details“ (`data-af="spalte|klasse|labels|faellig"`) und laufen über den vorhandenen Änderungsweg (`change` → `aufgabeAendern`). Es entsteht **kein** `S.ui`-Feldentwurf, kein zweiter Endpunkt, keine zweite Aktion je Feld und kein Sammel-Speichern.
5. **Nie zwei Kopien im selben gezeichneten Bereich.** Von jedem Feld ist im gezeichneten Fenster **genau ein** Eingabeelement vorhanden — die Spalte im Inhalt und die Feldzeilen in „Details“ stehen nie zugleich auf dem Schirm. Nur so findet der Fokussicherer (ADR-0007) sein Element über den Feldschlüssel wieder.
6. **„Details“ bleibt vollständig** und unverändert in Inhalt und Verhalten: Schlüssel (nur lesend, nur wenn gesetzt), Spalte, Klasse, Herkunft, Zuständig, Labels, Fällig, Geschätzt, Wirkungen, Phasen, Signale, Zählung, Reservierung, „wartet auf“.
7. **Die Restfelder** (Schlüssel, Herkunft, Reservierung, Geschätzt, Zählung, „wartet auf“, Wirkungen, Phasen, Signale) erscheinen **nicht** in der Spalte.
8. **Brechpunkt 641 px, CSS-only:** Bei **641 px und mehr** steht die Spalte rechts neben dem Inhalt (zweispurig, 200 px). Bei **640 px und weniger** steht sie **unter** dem Inhalt und **nach** dem Abschnitt DURCHLÄUFE im Fluss; das Fenster ist dann einspurig und hat **einen** Scrollbereich. Der Umbruch ist **nur CSS** — dieselbe Grenze, an der `.mod-body` heute auf `display:block` schaltet (`web/kd-app.css:929–935`, D00004) —, **kein** `S.ui`-Zustand, **kein** Aufklappen (kein `<details>`; ADR-0007 deckt offene `<details>` nicht, der Fokus ginge nach jedem Live-Ereignis verloren), **kein** `order`/`row-reverse`. Die Spalte steht in **beiden** Breiten im DOM nach dem Inhalt und vor dem Fuß des Fensters. Bei 320, 375 und 414 px gibt es **kein** waagrechtes Scrollen (weder im Fenster noch auf der Seite), und die Werte brechen um.
9. **Fehlerpfade unverändert**: defekte Datei (423), Agent aus einer Menschen-Spalte (403), Grenze (409) und Netzfehler verhalten sich wie heute bei denselben Feldern in „Details“ — die Änderung unterbleibt, die Datei bleibt unverändert, die Meldung erscheint am **vorhandenen** Ort (Fuß des Fensters, `#fenster-meldung`, `role="alert"`), das Feld zeigt nach dem Neuladen wieder den gespeicherten Wert. Kein neuer Fehlerzustand, kein eigener Speichervorgang, **kein zweites `aria-live`** und kein „ungespeichert“-Zustand in der Spalte. Bei 423 (Board) degradiert **nur** die Zeile „Spalte“ zu „nicht auf diesem Board“, die vier übrigen Zeilen bleiben bedienbar; bei 423 (Aufgabendatei) ersetzt die Defektfläche das Fenster und es gibt **keine** Spalte.
10. **Abgrenzung**: kein neues Kürzel, kein neuer Menüeintrag, keine neue Ansicht, kein neuer Endpunkt, kein neues Datenformat, keine Änderung an „Datei“, „Zeiten“, „Kosten“ oder „Verlauf“.

### Ausnahme von „jeder Abschnitt genau einmal“
11. **Ausnahme (#146):** Spalte, Klasse, Labels, Fälligkeit erscheinen zusätzlich im Inhalt (bearbeitbar) und die **gewählten** Zuständigen dort nur lesend; alles andere bleibt je Ansicht genau einmal.

### Gestaltung und Verhalten der Spalte (ux-Vorprüfung 2026-11-12)

12. **Form und Bedienelemente:** Die vier bearbeitbaren Zeilen sind die **vorhandenen** Bedienelemente mit denselben `data-af`-Schlüsseln — `select[data-af="spalte"]` (Spalte), `vKlassenWahl('data-af', …)` (Klasse), Textfeld mit Komma (Labels), `input[type="date"][data-af="faellig"]` (Fällig) —, gezeichnet von **einem** Zeichner für „Details“ und die Spalte. In der Spalte steht die Beschriftung über dem Wert. Jedes Ziel ist ≥ 24 × 24 px fein und ≥ 44 px (Haus: 48) bei `pointer:coarse`. Das Feld **Fällig** ist in der Spalte **nur** das Datumsfeld; die Schnellknöpfe (heute / morgen / +1 Woche / ✕) bleiben in „Details“ (S3).
13. **Überschrift und Rolle:** Die Spalte trägt **keine sichtbare Überschrift**; sie ist `role="group"` mit `aria-label="Angaben zur Aufgabe"` (kein `complementary`, kein `region`; ADR-0018 Regel 1). Die Zeile Zuständig ist zusätzlich eine Gruppe „Zuständig“. Tab-Reihenfolge folgt dem DOM: … Durchläufe → Spalte → Klasse → Labels → Fällig; Zuständig ist nicht fokussierbar.
14. **Fokus:** Nach einer **eigenen** Änderung bleibt der Fokus im geänderten Feld (der eigene PATCH löst das Live-Ereignis aus, das Fenster wird neu gezeichnet). Fällt das Feld weg (423 Board: „Spalte“ wird Text), steht der Fokus auf `#inhalt-spalte`, **nie** auf `BODY` (ADR-0010 N7). Fokusring 2 px `--kd-accent`, Abstand −1 px, auf der Spaltenfläche ≥ 3:1 (SC 1.4.11).
15. **Scrollen:** Breit (≥ 641 px) scrollt allein `.mod-main`, die Spalte steht; `overflow:auto` an der Spalte ist nur Rückfall für sehr kurze Fenster (quer gehaltenes Telefon 844 × 390). Schmal (≤ 640 px) gibt es **einen** Scrollbereich (`.mod-body`), die Spalte steht im Fluss. `.mod-spalte` steht in der bestehenden Hinweis-Regel (`web/kd-app.css:566`), damit der Rückgängig-Hinweis (R00112) keine Feldzeile verdeckt.
16. **Kontrast und Farbe:** Jeder sichtbare Text der Spalte hält in **beiden** Themen ≥ 4,5:1 (SC 1.4.3) — Beschriftung `.k`, Schlüssel `.sl`, Zuständigname, „niemand“, „nicht auf diesem Board“, Platzhalter; der Fokusring ≥ 3:1. Die Spalte trägt **keinen farbtragenden Zustand**: Fällig bleibt unbunt (keine Warnfarbe, die die Karte trägt), die Klasse ist Text + Farbquadrat, die Initiale wiederholt nur die Haus-Konvention Mensch/Agent.

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Jede Feldzeile der Spalte hat einen zugänglichen Namen (ihre Beschriftung), ist per Tastatur erreichbar und zeigt den Fokus sichtbar (SC 2.4.7). Zielgrößen nach ADR-0012 (≥ 24 px fein, ≥ 44 px bei Touch); die nur lesenden Zuständigen sind Text, keine Bedienelemente (Initiale `aria-hidden`, Name als Information), und werden als Gruppe „Zuständig“ angesagt; die Spalte selbst ist eine benannte Gruppe „Angaben zur Aufgabe“, keine Landmarke. Jeder sichtbare Text der Spalte — auch `.k`, `.sl`, Platzhalter, „niemand“ und „nicht auf diesem Board“ — hält ≥ 4,5:1 (SC 1.4.3), der Fokusring ≥ 3:1 (SC 1.4.11). Farbe trägt nie allein (SC 1.4.1).
- **Schmale Breiten**: 320/375/414 px ohne Querscrollen, kein Überlauf und keine abgeschnittenen Werte; die Feldzeilen bleiben bedienbar, wenn die Spalte unter den Inhalt rutscht (ADR-0015 N1, R00131: `overflow-wrap:anywhere`, `min-width:0`). Der Umbruch liegt bei **641 px** (bei 640 px und weniger im Fluss), auch bei kurzer Höhe (844 × 390) bleibt jede Feldzeile erreichbar.
- **Verträglichkeit**: Ein Live-Ereignis zeichnet das Fenster neu, ohne Fokus und Leseposition zu verlieren (R00103, R00110, ADR-0007) — nach einer **eigenen** Änderung bleibt der Fokus im geänderten Feld. Der Rückgängig-Hinweis (R00112) und die Datei-Ablage im Inhalt (R00145) bleiben unberührt; `.mod-spalte` steht in der Hinweis-Regel und wird von ihm nicht verdeckt. „Details“ behält seine Abnahme aus R00127.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Letzte ist Menschen-Spalte); Personen `st` (Mensch) und `ag` (Agent); Aufgabe #1 in „Eingang“ mit `class: bug`, `labels: [ui, daten]`, `faellig: 2026-12-24`, Zuständigen `st, ag` sowie einer Teilaufgabe, einem Kommentar, einem Durchlauf und einem Anhang; Aufgabe #2 ohne Board.

### Die Spalte im Inhalt (bearbeitbar)

- [ ] Gegeben #1 bei 1280 px, wenn das Fenster in der Ansicht „Inhalt“ geöffnet wird, dann stehen rechts in der schmalen Spalte die Zeilen **Spalte**, **Klasse**, **Labels**, **Fällig**, **Zuständig** in dieser Reihenfolge; die Spur ist **200 px** breit (gemessen `200 ± 1`), die Beschriftung steht **über** dem Wert; links stehen Titel, Beschreibung und die Abschnitte TEILAUFGABEN, ANHÄNGE, KOMMENTARE, DURCHLÄUFE unverändert; die Spalte ist eine Gruppe „Angaben zur Aufgabe“ und hat **keine** sichtbare Überschrift
- [ ] Gegeben die Spalte von #1, wenn ich im Feld **Klasse** „bug“ wähle und das Feld verlasse, dann ist `git log -1` genau `#1 geändert: Klasse`, die Aufgabendatei enthält `class: bug`, und es ist **ein** Commit entstanden (kein zweiter, kein Sammel-Commit)
- [ ] Gegeben die Spalte von #1, wenn ich **Klasse** auf „bug“ stelle und der eigene Commit das Fenster neu zeichnet, dann ist `document.activeElement` danach **dasselbe Feld** (`[data-af="klasse"]`) und zeigt „bug“ (dasselbe für Spalte, Labels und Fällig) — der Fokus fällt nie auf `BODY`
- [ ] Gegeben die Spalte von #1, wenn ich **Labels** auf „ui, daten, board“ ändere und das Feld verlasse, dann lautet `git log -1` `#1 geändert: Labels` und die Datei enthält `labels: [ui, daten, board]`
- [ ] Gegeben die Spalte von #1, wenn ich **Fällig** auf „2026-12-31“ setze, dann lautet `git log -1` `#1 geändert: Fälligkeit`, die Datei enthält `due: 2026-12-31`, und ein Leeren des Feldes entfernt `due`; das Feld ist **nur** das Datumsfeld — `#fenster .mod-spalte [data-act]` liefert **0** Treffer (die Schnellknöpfe heute/morgen/+1 Woche/✕ bleiben in „Details“, dort unverändert 4)
- [ ] Gegeben die Spalte von #1, wenn ich **Spalte** auf „In Arbeit“ stelle, dann steht die Karte in „In Arbeit“, `git log -1` lautet `#1 nach „In Arbeit“ (fabrik)`, und im Inhalt steht die neue Spalte im Feld
- [ ] Gegenprobe: Gegeben die Spalte von #1, wenn ich ein Feld mit **demselben** Wert verlasse, dann entsteht kein Commit und `git log -1` ist unverändert

### Zuständig nur lesend

- [ ] Gegeben #1 mit den Zuständigen `st` und `ag` und den aktiven Personen `st`, `ag`, `pl`, wenn der Inhalt gezeigt wird, dann nennt die Zeile **Zuständig** genau `st` und `ag` — nicht `pl` —, je mit Initiale (`aria-hidden`) und Name als Text, **kein Chip**; und in der Zeile gibt es **kein** `button`, `input`, `select`, `[data-act]`, `[aria-pressed]` und `[tabindex]`; die Gruppe heißt für Hilfstechnik „Zuständig“
- [ ] Gegeben die Spalte von #1, wenn ich einen Zuständigen ändern will, dann ist das nur in „Details“ möglich (dort unverändert die `aria-pressed`-Knöpfe, ein Commit je Änderung), und nach dem Rückwechsel in den Inhalt zeigt die Spalte den neuen Stand — ohne dass die Spalte einen eigenen Zustand führt
- [ ] Leerfall: Gegeben eine Aufgabe ohne Zuständige, wenn der Inhalt gezeigt wird, dann steht in der Zeile „Zuständig“ das Wort **„niemand“** (Text, `--kd-muted`, ≥ 4,5:1) und kein Bedienelement; die Zeile ist nicht fokussierbar

### Eine Quelle, Details bleibt

- [ ] Gegeben #1 im Inhalt, wenn ich die Felder der Spalte zähle, dann steht im gezeichneten Fenster jedes der vier Felder **genau einmal** (`document.querySelectorAll('[data-af="labels"]').length === 1`), und nach dem Wechsel nach „Details“ ebenfalls genau einmal
- [ ] Gegeben #1 in „Details“, wenn die Ansicht geöffnet wird, dann stehen dort weiterhin Schlüssel (nur wenn gesetzt), Spalte, Klasse, Herkunft, Zuständig, Labels, Fällig, Geschätzt, Wirkungen, Phasen, Signale, Zählung, Reservierung und „wartet auf“ — inhaltlich unverändert gegenüber R00127
- [ ] Gegeben #1 in der Ansicht „Inhalt“ mit dem Fokus im Feld **Labels** der Spalte, wenn ein Agent über die API den Titel von #2 ändert und das Live-Ereignis eintrifft, dann bleibt der Fokus im Feld „Labels“ der Spalte (nicht `BODY`) und der halb getippte Wert wird nicht committet
- [ ] Gegeben jede Ansicht, wenn ihr sichtbarer Text gelesen wird, dann kommt kein Abschnitt in zwei Ansichten vor — **außer** den vier Feldern Spalte, Klasse, Labels, Fällig und den gewählten Zuständigen in Inhalt und Details (Ausnahme #146)
- [ ] Gegenprobe: Gegeben #1, wenn ich das Fenster öffne, die Spalte ansehe und wieder schließe, dann sind Aufgabendatei und `git log` unverändert

### Schmale Breiten

- [ ] Gegeben #1 mit Labels `ui, daten, board` und dem Fälligkeitsdatum, wenn das Fenster bei **320, 375, 414 und 640 px** je hell und dunkel geöffnet wird, dann gilt `document.documentElement.scrollWidth ≤ clientWidth` und im Fenster `scrollWidth ≤ clientWidth`; kein Wert wird abgeschnitten, jede Feldzeile ist erreichbar und bedienbar, und die Werte brechen um statt überzulaufen
- [ ] Gegeben **641 px und mehr**, wenn der Inhalt geöffnet wird, dann steht die Spalte **rechts neben** dem Inhalt und ist **200 px ± 1** breit (linker Rand der Spalte > rechter Rand von `.mod-main`); bei **640 px und weniger** steht sie **unter** dem Inhalt (`top` > `bottom` des letzten Abschnitts, Breite = Innenbreite des Fensters); bei 320/375/414/640/641 px gilt `scrollWidth ≤ clientWidth` für Seite und Fenster
- [ ] Gegeben ein **kurzes Fenster** (844 × 390 und 740 × 360, Telefon quer, Touch), wenn der Inhalt geöffnet wird, dann ist jede der fünf Zeilen erreichbar (die Spalte scrollt in sich, `overflow:auto` als Rückfall) und keine ist abgeschnitten
- [ ] Gegeben die Spalte in beiden Breiten, wenn die Lesereihenfolge geprüft wird, dann steht die Spalte im DOM **nach** dem Inhalt und **vor** dem Fuß (`compareDocumentPosition` = `DOCUMENT_POSITION_FOLLOWING`), Tab vom letzten Ziel in DURCHLÄUFE führt in die Spalte, `getComputedStyle(spalte).order === '0'`, kein `row-reverse`
- [ ] Gegeben die Spalte in beiden Themen, wenn der sichtbare Text gemessen wird, dann hält jeder Text — Beschriftung `.k`, Schlüssel `.sl`, Zuständigname, „niemand“, „nicht auf diesem Board“, Platzhalter — ≥ 4,5:1, der Fokusring ≥ 3:1

### Fehler und Grenzen

- [ ] Gegeben das Board „fabrik“ ist defekt (423), wenn ich #1 öffne, dann zeigt das Feld **Spalte** „nicht auf diesem Board“ wie heute in „Details“, die übrigen Felder der Spalte bleiben bearbeitbar, es erscheint kein neuer Fehlerzustand, und wenn das Feld „Spalte“ wegfällt, steht der Fokus auf `#inhalt-spalte` (bzw. dessen erstem Bedienelement), **nie** auf `BODY`
- [ ] Gegeben die Identität `ag` (Agent) und #1 in „Eingang“, wenn ich in der Spalte **Spalte** auf „Fertig“ (Menschen-Spalte) stelle, dann bleibt die Karte in „Eingang“, die Board-Datei ist unverändert, die Meldung erscheint am vorhandenen Ort (Fuß des Fensters, `role="alert"`), das Feld zeigt nach dem Neuladen wieder „Eingang“, und die Spalte führt keinen „ungespeichert“-Zustand
- [ ] Gegeben eine defekte Aufgabendatei (423), wenn ich sie öffne, dann erscheint die bekannte Defektfläche und **keine** Spalte mit Eingabefeldern
- [ ] Gegeben die Spalte von #1 mit dem Fokus in einer Feldzeile, wenn der Rückgängig-Hinweis (R00112) erscheint, dann bleibt jede der fünf Zeilen sichtbar und nicht verdeckt (`elementFromPoint` in der Feldmitte liefert das Feld bzw. den Text; `verdeckt === false`), bei 1280, 414 und 320 px

## Betroffene Verzeichnisstruktur

- Oberfläche: `web/ansicht.js` (ein gemeinsamer Zeichner der Feldzeilen, `vInhaltSpalte`, `vFenster` mit zweispurigem `.mod-body` für „Inhalt“), `web/app.js` (Änderungsweg `data-af` unverändert, kein neuer Zweig), `web/kd-app.css` (Spalte, Umbruch, Umbruchbreite)
- Tests: neu `e2e/tests/r00146-inhalt-spalte.spec.js`; nachziehen `r00127-kartendetails-tabs.spec.js` (Details-Vollständigkeit), `r00145-ansichtsmenue.spec.js` (Inhalt), `r00111-schmal-wie-breit.spec.js` (Breiten), `r00103`/`r00110` (Live/Fokus), `e2e/einheit/sichtzustand.test.js` (Schlüssel genau einmal im Bereich)

## Technische Überlegungen

### Ablauf

1. **Ein Zeichner für die Feldzeilen** (Walking Slice; bringt die eine Quelle)
   - 1.1 Die vier Zeilen (Spalte, Klasse, Labels, Fällig) aus `vFensterDetails` (`web/ansicht.js:325–337`) in eine Funktion ziehen, die Beschriftung und Wert zusammensetzt (`vBeschriftung` aus `web/kultur.js`, `.k` + `.sl` nach ADR-0013 N1).
   - 1.2 `vFensterDetails` ruft denselben Zeichner für seine Zeilen auf; die Spalte ruft ihn ebenfalls. Nur so bleiben Schlüssel, Beschriftung, Platzhalter und Verhalten an einer Stelle.
2. **Die Spalte in den Inhalt**
   - 2.1 `vFenster` zeichnet für die Ansicht „Inhalt“ ein zweispuriges `.mod-body` mit `grid-template-columns:minmax(0,1fr) 200px` (Inhalt links, Spalte rechts) statt `.mod-body.voll`; die übrigen Ansichten bleiben einspurig. Die Spalte trägt `id="inhalt-spalte"` (Fokusrückfall) und `role="group" aria-label="Angaben zur Aufgabe"`, keine sichtbare Überschrift.
   - 2.2 Die Zeile „Zuständig“ ist reiner Text aus `a.zustaendige` (nur gewählte), je Initiale `aria-hidden` plus Name, in einer Gruppe mit dem Namen „Zuständig“; Leerfall „niemand“.
   - 2.3 Die vier Feldzeilen der Spalte nutzen denselben Zeichner wie „Details“ mit der schmalen Auslage (`.felder.felder-schmal`: Beschriftung über Wert, ohne Schnellknöpfe am Datumsfeld). Der Fokussicherer (ADR-0007) findet das Feld über `data-af`; fehlt es (423 Board), führt der Rückfall auf `#inhalt-spalte`.
3. **Schmale Breiten**
   - 3.1 Bei 640 px und weniger (bestehende Regel `web/kd-app.css:929–935`) steht die Spalte im Fluss nach DURCHLÄUFE; `min-width:0` und `overflow-wrap:anywhere` für die Werte, kein Querscrollen, kein `order`. `.mod-spalte` wird in die Hinweis-Regel (`:566`) aufgenommen; `overflow:auto` an der Spalte nur als Rückfall bei kurzer Höhe.
4. **Proben und Nachzug**
   - 4.1 E2E für Felder, Commit je Änderung, nur lesende Zuständige, Fokus über Live, Breiten.
   - 4.2 R00127/R00145 haben die Ausnahme bereits (dieser Auftrag); D00001/D00003 und das Handbuch nennen die Spalte.

### Grobentwurf

**Wichtige Einstiegsstellen:** `vFenster` und die Ansichtsverzweigung (`web/ansicht.js:293–314`), `vFensterInhalt` (`:315–323`), `vFensterDetails` (`:325–337`), das zweispurige `.mod-body` (`web/kd-app.css:306–307`), die Feldzeilen (`:399–419`), der Änderungsweg für `data-af` (`web/app.js:2097–2105`), `aufgabeAendern` (`:633`), der Zug `act('bewegen')` (`:1306`).

**Elemente** (Vorplanung):
- `vFeldZeile(feld, a, schmal)` — zeichnet Beschriftung und Wert **einer** der vier Feldzeilen aus demselben Code für beide Ansichten; `schmal` schaltet die einspaltige Auslage (Beschriftung über Wert) und lässt die Schnellknöpfe weg; Rückgabe Markup mit `data-af`.
- `vInhaltSpalte(a)` — zeichnet die schmale Spalte (`id="inhalt-spalte"`, `role="group" aria-label="Angaben zur Aufgabe"`): `vFeldZeile` für Spalte, Klasse, Labels, Fällig, dann die nur lesende Zeile „Zuständig“; Leerfälle „nicht auf diesem Board“, „— keine —“, leeres Feld mit Platzhalter, leeres Datumsfeld.
- `vZustaendigLesen(a)` — nur die gewählten Zuständigen als Text in einer Gruppe „Zuständig“; kein Bedienelement, kein Chip; Leerfall „niemand“.
- **Kein neuer Zustand:** kein Aufklappen, kein `S.ui`-Feldentwurf, kein „ungespeichert“ (ADR-0007 deckt offene `<details>` nicht; die UX hat Aufklappen verworfen).

### Änderungen an bestehenden Funktionen

- `web/ansicht.js`: `vFensterDetails` nutzt `vFeldZeile`; `vFensterInhalt` bzw. `vFenster` hängt `vInhaltSpalte` an; `.mod-body` bekommt für „Inhalt“ zwei Spuren; der Fokussicherer (ADR-0007) findet die Felder über `data-af`, bei weggefallenem Feld greift `#inhalt-spalte`.
- `web/kd-app.css`: Spur `minmax(0,1fr) 200px`, `.felder.felder-schmal`, Umbruch (bestehende 640-px-Regel), `.mod-spalte` in der Hinweis-Regel (`:566`); die vorhandene Regel `.mod-main,.mod-side` im schmalen Layout ist das Muster.
- `web/app.js`: unverändert — die Felder der Spalte laufen durch denselben `change`-Zweig wie die in „Details“.

### Umfang

- I0133: 4 Features, 8 Bubbles (B0674–B0681), Richtwert 6–12 h ungemessen (Summe der Spannen, Hypothese). Keine Bubble unter 0,5 h.

### Gestaltung

- **ux-Vorprüfung: liegt vor** (2026-11-12, Detailblatt der ux-Vorprüfung #146). Festgelegt und hier übernommen: **200 px** feste Spur (`minmax(0,1fr) 200px`, kein `--bw`) mit 176 px Wertfläche und **Beschriftung über dem Wert** (`.felder.felder-schmal`); **Brechpunkt 641 px CSS-only** ohne `S.ui`-Zustand und ohne Aufklappen; vorhandene Bedienelemente mit denselben `data-af`-Schlüsseln, **keine** Schnellknöpfe am Fällig-Feld; Zuständig als Text (Initiale `aria-hidden`, Name) in einer Gruppe, **kein Chip**, Leerfall **„niemand“**; keine sichtbare Überschrift, `role="group" aria-label="Angaben zur Aufgabe"`, DOM-Reihenfolge Inhalt → Spalte → Fuß; Fokus bleibt im geänderten Feld, Rückfall `#inhalt-spalte`; Meldungen bleiben im Fuß; `.mod-spalte` im Hinweis-Schutz; Kontrast in beiden Themen. Neuer Zustand an **Artboard D0003** mit Anker `#inhalt-spalte`: „Inhalt mit schmaler Spalte“, hell und dunkel, 1280 · 414 · 320 px, dazu Leerfälle, 423/409, kurzes Fenster 844 × 390, Grenztabelle 640/641, Zielgrößen und Kontrast-Beleg. **Bau-Sperre Oberfläche** für die Flächen-Bubbles (B0675–B0680), bis der product-owner den Zustand freigibt; das Nachziehen der Festlegungen (Doku, B0681/F0124) und der gemeinsame Zeichner (B0674) sind frei baubar.

## Tests

Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (reine Logik):** vorhanden — `sichtzustand.schluessel` findet ein Feld über `[data-af=…]` genau dann, wenn es im Bereich **einmal** vorkommt (Gegenprobe: zweimal → leerer Schlüssel).

**E2E:** `e2e/tests/r00146-inhalt-spalte.spec.js` — US-1 bis US-8: Spalte mit fünf Zeilen in der Reihenfolge, 200 px breit, Gruppe „Angaben zur Aufgabe“; vier Felder schreiben je ein Commit (`#1 geändert: …`, `#1 nach „…“ (fabrik)`); gleicher Wert → kein Commit; **Fokus nach eigener Änderung im selben Feld**; Zuständig nennt nur die gewählten und enthält kein Bedienelement/keinen Chip; Leerfall „niemand“; in „Details“ steht jedes Feld genau einmal und die Ansicht ist vollständig; Fokus im Feld „Labels“ übersteht ein Live-Ereignis; **640/641 px gemessen** (Breite 200 ± 1, Position rechts/unter, `scrollWidth ≤ clientWidth` bei 320/375/414/640/641) hell und dunkel; kurzes Fenster 844 × 390 (jede Zeile erreichbar); Rückgängig-Hinweis verdeckt keine Zeile; kein `[data-act]` in der Spalte; 423 (Board und Aufgabendatei, mit Fokusrückfall `#inhalt-spalte`) und 403 (Agent aus Menschen-Spalte) wie heute; Gegenprobe „nur angesehen“ → Datei und `git log` unverändert.

## Abhängigkeiten

- Abhängig von: R00145/I0132 (der Inhalt als einzige gezeichnete Ansicht, grün), R00127/I0115 (Details und die Feldzeilen, grün), R00011/I0011 (PATCH je Feld, grün), R00006 (Spalte bewegt die Karte), ADR-0007 (stabile Schlüssel, Fokussicherer).
- Berührt: R00127 („jeder Abschnitt genau einmal“, jetzt mit Ausnahme), R00145 (FA 14, AK „Gegenbeispiel“), R00039 (Zuständige frei setzen — bleibt der einzige Schreibweg), R00103/R00110 (Live ohne Fokusverlust), R00131 (Umbruch), D00001/D00003.
- Blockiert: nichts.

## Offene Fragen

**Die UX hat am 2026-11-12 entschieden; die Antworten sind oben eingearbeitet und hier festgehalten.**

1. **Breite der Spalte.** **Entschieden (ux-Vorprüfung 2026-11-12): 200 px** feste Spur (`minmax(0,1fr) 200px`, nicht `--bw`), 176 px Wertfläche, **Beschriftung über dem Wert** (`.felder.felder-schmal`). 180 px wäre mit Klassen-Select und Datumsfeld zu knapp, 220 px nähme dem Inhalt ohne Gewinn Platz; die 84-px-Beschriftungsspalte würde das Datum schneiden.
2. **Brechpunkt und Form.** **Entschieden (ux-Vorprüfung 2026-11-12): 641 px, CSS-only** — dieselbe Grenze, an der `.mod-body` heute auf `display:block` schaltet (`web/kd-app.css:929–935`, D00004); bei 640 px und weniger steht die Spalte im Fluss **nach DURCHLÄUFE**. Kein zweiter Zahlenwert, kein `S.ui`-Zustand, **kein Aufklappen** (ADR-0007 deckt offene `<details>` nicht, der Fokus ginge nach jedem Live-Ereignis verloren), kein `order`.
3. **Komponentenform nach Material 3.** **Entschieden (ux-Vorprüfung 2026-11-12): die vorhandenen Bedienelemente** (Select, `vKlassenWahl`, Textfeld, `input[type=date]`), ein Zeichner, dieselben `data-af`-Schlüssel; in der Spalte enger gesetzt (Beschriftung über Wert).
4. **Labels und Zuständige: Chips oder Text?** **Entschieden (ux-Vorprüfung 2026-11-12): Text.** Zuständige als Text mit Initiale (`aria-hidden`) und Name, **kein Chip** (M3-Chips sind interaktiv); Labels als vorhandenes Textfeld mit Komma, Leerfall leeres Feld mit Platzhalter. Wortlaut des Leerfalls Zuständig: **„niemand“**.
5. **Fokus, Zielgrößen, Kontrast.** **Entschieden (ux-Vorprüfung 2026-11-12):** Fokus bleibt nach einer eigenen Änderung im Feld; fällt das Feld weg, `#inhalt-spalte`, nie `BODY` (ADR-0010 N7); Zielgrößen ≥ 24 px fein / ≥ 44 px Touch; jeder sichtbare Text ≥ 4,5:1 in beiden Themen, Fokusring ≥ 3:1; Farbe trägt nie allein.
6. **Was zeigt die Spalte bei defektem Board (423) und Agent-Sperre (403)?** **Entschieden (ux-Vorprüfung 2026-11-12): nichts Neues erfinden.** 423 Board degradiert **nur** die Zeile „Spalte“ zu „nicht auf diesem Board“ (die vier übrigen bleiben bedienbar), 423 Aufgabendatei ersetzt das Fenster ohne Spalte; 403/409 und Netz zeigen die Meldung **nur im Fuß** (`#fenster-meldung`, `role="alert"`), die Datei bleibt unverändert, das Feld zeigt den gespeicherten Wert; kein zweites `aria-live`, kein „ungespeichert“.
7. **Eigener Scrollbereich oder mit dem Inhalt scrollen?** **Entschieden (ux-Vorprüfung 2026-11-12):** breit scrollt allein `.mod-main`, die Spalte steht (`overflow:auto` an der Spalte nur als Rückfall bei kurzer Höhe, 844 × 390); schmal **ein** Scrollbereich (`.mod-body`), Spalte im Fluss. `.mod-spalte` kommt in die Hinweis-Regel (`web/kd-app.css:566`).
8. **Überschrift und Rolle der Spalte.** **Entschieden (ux-Vorprüfung 2026-11-12):** **keine** sichtbare Überschrift; `role="group" aria-label="Angaben zur Aufgabe"` (kein `complementary`, kein `region`), die Zeile Zuständig zusätzlich Gruppe „Zuständig“.

## Manuelle Vorbereitungstätigkeiten

- **ux-Vorprüfung: erledigt** (2026-11-12, Detailblatt der ux-Vorprüfung #146); die Antworten auf die Offenen Fragen 1–8 sind eingearbeitet. Danach der Zustand „Inhalt mit schmaler Spalte“ an **Artboard D0003**, Anker `#inhalt-spalte` (hell und dunkel, 1280 · 414 · 320 px; bearbeitbare Zeilen, nur lesende Zuständige, Leerfälle, 423/409, kurzes Fenster 844 × 390, Grenztabelle 640/641, Zielgrößen und Kontrast-Beleg) mit Freigabe durch den product-owner. Die Flächen-Bubbles (B0675–B0680) sind bis dahin **Bau-Sperre Oberfläche**; B0674 (gemeinsamer Zeichner) und F0124/B0681 (Doku) sind frei.

## Manuelle Nachbereitungstätigkeiten

- Bildschirmfotos des Inhalts mit Spalte bei 1280, 414 und 320 px, je hell und dunkel, dazu ein Bild des Umbruchs und des Leerfalls der Zuständigen, auf den Abnahmezettel.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Betreiber-Auftrag vom 2026-11-12: die vier Angaben, die eine Aufgabe einordnen (Spalte, Klasse, Labels, Fälligkeit), kosten heute einen Ansichtswechsel nach „Details“ und zurück, obwohl man sie beim Lesen der Aufgabe braucht. Weil die Spalte **im Inhalt** steht und dort **bearbeitbar** ist, bleibt der Blick auf Beschreibung, Teilaufgaben und Kommentaren, und die Änderung geht trotzdem sofort in die Datei und in genau einen Commit. Weil die Zuständigen dort **nur** gelesen werden und „Details“ die vollständige Bearbeitungsstelle bleibt, entsteht kein zweiter Schreibweg und kein zweiter Zustand: die Felder sind zwei Ansichten **eines** Werts, geschrieben über denselben `data-af`-Weg. Der Preis ist die ausdrückliche Ausnahme von „jeder Abschnitt genau einmal“; sie ist auf fünf Angaben begrenzt und in R00127 und R00145 vermerkt, damit die Regel sonst gilt wie bisher.

## Missing-Docs

- Keine.

## Notizen

- **Optionen (Skill `optionen-vor-entscheidung`), gewählt A:**
  - **(A, gewählt) Die Spalte zusätzlich im Inhalt, „Details“ bleibt vollständig.** Ein Feldwert, ein Schreibweg, ein Commit je Änderung; die Ausnahme bleibt eng (vier Felder plus die nur lesenden Zuständigen), und „Details“ behält seine Abnahme aus R00127 samt Feldliste. Preis: dieselbe Angabe steht in zwei Ansichten — bewusst, weil der Betreiber sie beim Lesen sehen und ändern will.
  - **(B) Spalte im Inhalt, „Details“ verliert die vier Felder.** Keine Doppelung, dafür müsste R00127 FA „Was in welchem Reiter steht“ („Details zeigt … Spalte, Klasse, … Labels, Fälligkeit“) geändert werden, und wer alle Felder an einem Ort bearbeiten will, hätte keinen mehr. Verworfen: größerer Eingriff in eine abgenommene Anforderung, kleinerer Nutzen.
  - **(C) Nur lesende Spalte, Bearbeiten weiter allein in „Details“.** Keine Ausnahme nötig, aber der Auftrag verlangt ausdrücklich bearbeitbar (r/w) im Inhalt. Verworfen.
  - **(D) Sammel-Speichern der Spalte (ein „Speichern“-Knopf).** Verworfen: widerspricht R00011 (jede Änderung sofort committen) und der Vision „Ein Commit je Aktion“.
- **Architektur-Entscheidung übernommen (Kartenkommentar #146, 2026-11-12):** PATCH je Feld bleibt; die Felder sind zwei Ansichten desselben Zustands — ein Feldwert, ein Schreibweg, ein Commit je Änderung; kein `S.ui`-Feldentwurf; nie zwei Kopien im selben gezeichneten Bereich (der Fokussicherer braucht einen eindeutigen Schlüssel); Restfelder bleiben in „Details“; Zuständige r/o ohne `data-act`/`aria-pressed`; **kein ADR**.
- **Ausnahme nachgezogen:** R00127 („Jeder Abschnitt steht genau einmal“) und R00145 (FA 14 und das AK „Gegenbeispiel“) tragen den Wortlaut der Ausnahme mit dem Vermerk „Ausnahme R00146, Betreiber-Entscheidung 2026-11-12“.
- **ux-Vorprüfung (2026-11-12) übernommen, nicht neu entschieden:** 200 px feste Spur mit 176 px Wertfläche und Beschriftung über dem Wert; 641 px CSS-only (kein `S.ui`, kein Aufklappen, kein `order`); vorhandene Bedienelemente, keine Schnellknöpfe; Zuständig als Text mit Initiale `aria-hidden` + Name, kein Chip, Leerfall „niemand“; keine Überschrift, Gruppe „Angaben zur Aufgabe“; DOM-Reihenfolge Inhalt → Spalte → Fuß in beiden Breiten; Fokus im geänderten Feld, Rückfall `#inhalt-spalte`; Meldung bleibt im Fuß; `.mod-spalte` im Hinweis-Schutz; Kontrast ≥ 4,5:1 in beiden Themen, Ring ≥ 3:1; kein farbtragender Zustand. Die **Muss**-Lücken M1–M5 (Grenze als Zahl, Fokus nach eigener Änderung, Fokusrückfall bei wegfallendem Feld, Hinweis über der Spalte, Wortlaut „niemand“) und die Sollte-Punkte S1–S4 sind als AK samt Abnahme-Probe aufgenommen.
- **Verworfene Alternativen:** eine zweite Aktion je Feld in der Spalte (z. B. `data-act="label-weg"`) — zwei Schreibwege für denselben Wert; ein eigenes `S.ui`-Abbild der Feldwerte — zwei Quellen; die Spalte nur im breiten Layout zeichnen und schmal ganz ausblenden — der Betreiber will sie auch auf dem Telefon (dort unter dem Inhalt).
- **Abgrenzung:** R00144/R00145 (Kopf und Ansichten) werden nicht neu aufgemacht; „Details“ bleibt, „Kosten“ und „Verlauf“ unberührt. Das Domänenwissen D00001/D00003 nennt die Seitenleiste noch als eigenen Bereich neben dem Hauptbereich (Stand vor R00127); der Nachzug ist B0681.
