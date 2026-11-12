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
1. Der Inhalt zeigt rechts eine schmale Spalte mit den Feldzeilen **Spalte · Klasse · Labels · Fällig · Zuständig** in dieser Reihenfolge. Links stehen Titel, Beschreibung und die Abschnitte (TEILAUFGABEN → ANHÄNGE → KOMMENTARE → DURCHLÄUFE) unverändert.
2. **Spalte, Klasse, Labels und Fällig sind bearbeitbar** und wirken wie in „Details“: „Spalte“ bewegt die Karte (R00006), die übrigen drei schreiben ihr Feld. Jede Änderung ist **ein** PATCH und **ein** Commit; ohne Änderung entsteht kein Commit (R00011).
3. **Zuständig ist nur lesend**: die Spalte nennt **nur die gewählten** Zuständigen (nicht alle aktiven Personen), ohne Knopf, ohne `data-act`, ohne `aria-pressed` und ohne `tabindex`. Der Abschnitt trägt den zugänglichen Namen „Zuständig“. Geändert werden die Zuständigen weiterhin allein in „Details“ (R00039).
4. **Ein Feldwert, ein Schreibweg.** Die Felder der Spalte tragen **dieselben** Schlüssel wie ihre Gegenstücke in „Details“ (`data-af="spalte|klasse|labels|faellig"`) und laufen über den vorhandenen Änderungsweg (`change` → `aufgabeAendern`). Es entsteht **kein** `S.ui`-Feldentwurf, kein zweiter Endpunkt, keine zweite Aktion je Feld und kein Sammel-Speichern.
5. **Nie zwei Kopien im selben gezeichneten Bereich.** Von jedem Feld ist im gezeichneten Fenster **genau ein** Eingabeelement vorhanden — die Spalte im Inhalt und die Feldzeilen in „Details“ stehen nie zugleich auf dem Schirm. Nur so findet der Fokussicherer (ADR-0007) sein Element über den Feldschlüssel wieder.
6. **„Details“ bleibt vollständig** und unverändert in Inhalt und Verhalten: Schlüssel (nur lesend, nur wenn gesetzt), Spalte, Klasse, Herkunft, Zuständig, Labels, Fällig, Geschätzt, Wirkungen, Phasen, Signale, Zählung, Reservierung, „wartet auf“.
7. **Die Restfelder** (Schlüssel, Herkunft, Reservierung, Geschätzt, Zählung, „wartet auf“, Wirkungen, Phasen, Signale) erscheinen **nicht** in der Spalte.
8. **Schmale Breiten**: Die Werte brechen um, es gibt bei 320, 375 und 414 px **kein** waagrechtes Scrollen (weder im Fenster noch auf der Seite). Unterhalb der von der UX festgelegten Breite tritt die Spalte **unter** den Inhalt oder wird **aufklappbar**; die Grenze und die Form sind Sache der UX (Offene Fragen 2).
9. **Fehlerpfade unverändert**: defekte Datei (423), Agent aus einer Menschen-Spalte (403), Grenze (409) und Netzfehler verhalten sich wie heute bei denselben Feldern in „Details“ — die Änderung unterbleibt, die Datei bleibt unverändert, die Meldung erscheint am vorhandenen Ort, das Feld zeigt nach dem Neuladen wieder den gespeicherten Wert. Kein neuer Fehlerzustand, kein eigener Speichervorgang.
10. **Abgrenzung**: kein neues Kürzel, kein neuer Menüeintrag, keine neue Ansicht, kein neuer Endpunkt, kein neues Datenformat, keine Änderung an „Datei“, „Zeiten“, „Kosten“ oder „Verlauf“.

### Ausnahme von „jeder Abschnitt genau einmal“
11. **Ausnahme (#146):** Spalte, Klasse, Labels, Fälligkeit erscheinen zusätzlich im Inhalt (bearbeitbar) und die **gewählten** Zuständigen dort nur lesend; alles andere bleibt je Ansicht genau einmal.

## Nicht-funktionale Anforderungen

- **Barrierefreiheit**: Jede Feldzeile der Spalte hat einen zugänglichen Namen (ihre Beschriftung), ist per Tastatur erreichbar und zeigt den Fokus sichtbar (SC 2.4.7). Zielgrößen nach ADR-0012 (≥ 24 px fein, ≥ 44 px bei Touch); die nur lesenden Zuständigen sind Text, keine Bedienelemente, und werden als Gruppe „Zuständig“ angesagt. Der sichtbare Text der nur lesenden Angaben hält ≥ 4,5:1 (SC 1.4.3).
- **Schmale Breiten**: 320/375/414 px ohne Querscrollen, kein Überlauf und keine abgeschnittenen Werte; die Feldzeilen bleiben bedienbar, wenn die Spalte unter den Inhalt rutscht (ADR-0015 N1, R00131: `overflow-wrap:anywhere`, `min-width:0`).
- **Verträglichkeit**: Ein Live-Ereignis zeichnet das Fenster neu, ohne Fokus und Leseposition zu verlieren (R00103, R00110, ADR-0007); der Rückgängig-Hinweis (R00112) und die Datei-Ablage im Inhalt (R00145) bleiben unberührt. „Details“ behält seine Abnahme aus R00127.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Letzte ist Menschen-Spalte); Personen `st` (Mensch) und `ag` (Agent); Aufgabe #1 in „Eingang“ mit `class: bug`, `labels: [ui, daten]`, `faellig: 2026-12-24`, Zuständigen `st, ag` sowie einer Teilaufgabe, einem Kommentar, einem Durchlauf und einem Anhang; Aufgabe #2 ohne Board.

### Die Spalte im Inhalt (bearbeitbar)

- [ ] Gegeben #1 bei 1280 px, wenn das Fenster in der Ansicht „Inhalt“ geöffnet wird, dann stehen rechts in der schmalen Spalte die Zeilen **Spalte**, **Klasse**, **Labels**, **Fällig**, **Zuständig** in dieser Reihenfolge; links stehen Titel, Beschreibung und die Abschnitte TEILAUFGABEN, ANHÄNGE, KOMMENTARE, DURCHLÄUFE unverändert
- [ ] Gegeben die Spalte von #1, wenn ich im Feld **Klasse** „bug“ wähle und das Feld verlasse, dann ist `git log -1` genau `#1 geändert: Klasse`, die Aufgabendatei enthält `class: bug`, und es ist **ein** Commit entstanden (kein zweiter, kein Sammel-Commit)
- [ ] Gegeben die Spalte von #1, wenn ich **Labels** auf „ui, daten, board“ ändere und das Feld verlasse, dann lautet `git log -1` `#1 geändert: Labels` und die Datei enthält `labels: [ui, daten, board]`
- [ ] Gegeben die Spalte von #1, wenn ich **Fällig** auf „2026-12-31“ setze, dann lautet `git log -1` `#1 geändert: Fälligkeit`, die Datei enthält `due: 2026-12-31`, und ein Leeren des Feldes entfernt `due`
- [ ] Gegeben die Spalte von #1, wenn ich **Spalte** auf „In Arbeit“ stelle, dann steht die Karte in „In Arbeit“, `git log -1` lautet `#1 nach „In Arbeit“ (fabrik)`, und im Inhalt steht die neue Spalte im Feld
- [ ] Gegenprobe: Gegeben die Spalte von #1, wenn ich ein Feld mit **demselben** Wert verlasse, dann entsteht kein Commit und `git log -1` ist unverändert

### Zuständig nur lesend

- [ ] Gegeben #1 mit den Zuständigen `st` und `ag` und den aktiven Personen `st`, `ag`, `pl`, wenn der Inhalt gezeigt wird, dann nennt die Zeile **Zuständig** genau `st` und `ag` — nicht `pl` —, und in der Zeile gibt es **kein** `button`, `input`, `select`, `[data-act]`, `[aria-pressed]` und `[tabindex]`; die Gruppe heißt für Hilfstechnik „Zuständig“
- [ ] Gegeben die Spalte von #1, wenn ich einen Zuständigen ändern will, dann ist das nur in „Details“ möglich (dort unverändert die `aria-pressed`-Knöpfe, ein Commit je Änderung), und nach dem Rückwechsel in den Inhalt zeigt die Spalte den neuen Stand — ohne dass die Spalte einen eigenen Zustand führt
- [ ] Leerfall: Gegeben eine Aufgabe ohne Zuständige, wenn der Inhalt gezeigt wird, dann steht in der Zeile „Zuständig“ kein Name und kein leeres Bedienelement (Wortlaut von der UX, Offene Frage 4)

### Eine Quelle, Details bleibt

- [ ] Gegeben #1 im Inhalt, wenn ich die Felder der Spalte zähle, dann steht im gezeichneten Fenster jedes der vier Felder **genau einmal** (`document.querySelectorAll('[data-af="labels"]').length === 1`), und nach dem Wechsel nach „Details“ ebenfalls genau einmal
- [ ] Gegeben #1 in „Details“, wenn die Ansicht geöffnet wird, dann stehen dort weiterhin Schlüssel (nur wenn gesetzt), Spalte, Klasse, Herkunft, Zuständig, Labels, Fällig, Geschätzt, Wirkungen, Phasen, Signale, Zählung, Reservierung und „wartet auf“ — inhaltlich unverändert gegenüber R00127
- [ ] Gegeben #1 in der Ansicht „Inhalt“ mit dem Fokus im Feld **Labels** der Spalte, wenn ein Agent über die API den Titel von #2 ändert und das Live-Ereignis eintrifft, dann bleibt der Fokus im Feld „Labels“ der Spalte (nicht `BODY`) und der halb getippte Wert wird nicht committet
- [ ] Gegeben jede Ansicht, wenn ihr sichtbarer Text gelesen wird, dann kommt kein Abschnitt in zwei Ansichten vor — **außer** den vier Feldern Spalte, Klasse, Labels, Fällig und den gewählten Zuständigen in Inhalt und Details (Ausnahme #146)
- [ ] Gegenprobe: Gegeben #1, wenn ich das Fenster öffne, die Spalte ansehe und wieder schließe, dann sind Aufgabendatei und `git log` unverändert

### Schmale Breiten

- [ ] Gegeben #1 mit Labels `ui, daten, board` und dem Fälligkeitsdatum, wenn das Fenster bei 320, 375 und 414 px je hell und dunkel geöffnet wird, dann gilt `document.documentElement.scrollWidth ≤ clientWidth` und im Fenster `scrollWidth ≤ clientWidth`; kein Wert wird abgeschnitten, und jede Feldzeile ist erreichbar und bedienbar
- [ ] Gegeben dieselben Breiten, wenn die Spalte unter den Inhalt rutscht (oder aufgeklappt wird), dann steht sie **nach** dem Inhalt in der Lesereihenfolge, und die Werte brechen um statt überzulaufen
- [ ] Gegeben eine Fensterbreite oberhalb der von der UX festgelegten Grenze (Empfehlung: 641 px), wenn das Fenster geöffnet wird, dann steht die Spalte rechts neben dem Inhalt

### Fehler und Grenzen

- [ ] Gegeben das Board „fabrik“ ist defekt (423), wenn ich #1 öffne, dann zeigt das Feld **Spalte** „nicht auf diesem Board“ wie heute in „Details“, die übrigen Felder der Spalte bleiben bearbeitbar, und es erscheint kein neuer Fehlerzustand
- [ ] Gegeben die Identität `ag` (Agent) und #1 in „Eingang“, wenn ich in der Spalte **Spalte** auf „Fertig“ (Menschen-Spalte) stelle, dann bleibt die Karte in „Eingang“, die Board-Datei ist unverändert, die Meldung erscheint am vorhandenen Ort, und das Feld zeigt nach dem Neuladen wieder „Eingang“
- [ ] Gegeben eine defekte Aufgabendatei (423), wenn ich sie öffne, dann erscheint die bekannte Defektfläche und **keine** Spalte mit Eingabefeldern

## Betroffene Verzeichnisstruktur

- Oberfläche: `web/ansicht.js` (ein gemeinsamer Zeichner der Feldzeilen, `vInhaltSpalte`, `vFenster` mit zweispurigem `.mod-body` für „Inhalt“), `web/app.js` (Änderungsweg `data-af` unverändert, kein neuer Zweig), `web/kd-app.css` (Spalte, Umbruch, Umbruchbreite)
- Tests: neu `e2e/tests/r00146-inhalt-spalte.spec.js`; nachziehen `r00127-kartendetails-tabs.spec.js` (Details-Vollständigkeit), `r00145-ansichtsmenue.spec.js` (Inhalt), `r00111-schmal-wie-breit.spec.js` (Breiten), `r00103`/`r00110` (Live/Fokus), `e2e/einheit/sichtzustand.test.js` (Schlüssel genau einmal im Bereich)

## Technische Überlegungen

### Ablauf

1. **Ein Zeichner für die Feldzeilen** (Walking Slice; bringt die eine Quelle)
   - 1.1 Die vier Zeilen (Spalte, Klasse, Labels, Fällig) aus `vFensterDetails` (`web/ansicht.js:325–339`) in eine Funktion ziehen, die Beschriftung und Wert zusammensetzt (`vBeschriftung` aus `web/kultur.js`, `.k` + `.sl` nach ADR-0013 N1).
   - 1.2 `vFensterDetails` ruft denselben Zeichner für seine Zeilen auf; die Spalte ruft ihn ebenfalls. Nur so bleiben Schlüssel, Beschriftung, Platzhalter und Verhalten an einer Stelle.
2. **Die Spalte in den Inhalt**
   - 2.1 `vFenster` zeichnet für die Ansicht „Inhalt“ ein zweispuriges `.mod-body` (Inhalt links, Spalte rechts) statt `.mod-body.voll`; die übrigen Ansichten bleiben einspurig.
   - 2.2 Die Zeile „Zuständig“ ist reiner Text aus `a.zustaendige` (nur gewählte), in einer Gruppe mit dem Namen „Zuständig“.
3. **Schmale Breiten**
   - 3.1 Unter der Grenze tritt die Spalte unter den Inhalt (oder wird aufklappbar); `min-width:0` und `overflow-wrap:anywhere` für die Werte, kein Querscrollen.
4. **Proben und Nachzug**
   - 4.1 E2E für Felder, Commit je Änderung, nur lesende Zuständige, Fokus über Live, Breiten.
   - 4.2 R00127/R00145 haben die Ausnahme bereits (dieser Auftrag); D00001/D00003 und das Handbuch nennen die Spalte.

### Grobentwurf

**Wichtige Einstiegsstellen:** `vFenster` und die Ansichtsverzweigung (`web/ansicht.js:306–312`), `vFensterInhalt` (`:315–322`), `vFensterDetails` (`:324–338`), das zweispurige `.mod-body` (`web/kd-app.css:306–308`), die Feldzeilen (`:399–419`), der Änderungsweg für `data-af` (`web/app.js:2097–2105`), `aufgabeAendern` (`:633`), der Zug `act('bewegen')` (`:1306`).

**Elemente** (Vorplanung):
- `vFeldZeile(feld, a)` — zeichnet Beschriftung und Wert **einer** der vier Feldzeilen aus demselben Code für beide Ansichten; Rückgabe Markup mit `data-af`.
- `vInhaltSpalte(a)` — zeichnet die schmale Spalte: `vFeldZeile` für Spalte, Klasse, Labels, Fällig, dann die nur lesende Zeile „Zuständig“.
- `vZustaendigLesen(a)` — nur die gewählten Zuständigen als Text in einer Gruppe „Zuständig“; kein Bedienelement.
- Kein neuer Zustand. Nur falls die UX die Spalte aufklappbar will, kommt **ein** Sichtzustand hinzu (stabiler Schlüssel, ADR-0007), nie ein Feldwert-Zustand.

### Änderungen an bestehenden Funktionen

- `web/ansicht.js`: `vFensterDetails` nutzt `vFeldZeile`; `vFensterInhalt` bzw. `vFenster` hängt `vInhaltSpalte` an; `.mod-body` bekommt für „Inhalt“ zwei Spuren.
- `web/kd-app.css`: Spur und Umbruch der Spalte; die vorhandene Regel `.mod-main,.mod-side` im schmalen Layout ist das Muster.
- `web/app.js`: unverändert — die Felder der Spalte laufen durch denselben `change`-Zweig wie die in „Details“.

### Umfang

- I0133: 4 Features, 8 Bubbles (B0674–B0681), Richtwert 6–12 h ungemessen (Summe der Spannen, Hypothese). Keine Bubble unter 0,5 h.

### Gestaltung

- **ux-Vorprüfung nötig** (Offene Fragen 1–8). Neuer Zustand an Artboard D0003: „Inhalt mit schmaler Spalte“, hell und dunkel, 1280 · 414 · 320 px, mit bearbeitbaren Zeilen, nur lesenden Zuständigen, Leerfall und Umbruch. **Bau-Sperre Oberfläche** für die Flächen-Bubbles, bis der product-owner den Zustand freigibt; das Nachziehen der Festlegungen (Doku) und der gemeinsame Zeichner sind frei baubar.

## Tests

Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (reine Logik):** vorhanden — `sichtzustand.schluessel` findet ein Feld über `[data-af=…]` genau dann, wenn es im Bereich **einmal** vorkommt (Gegenprobe: zweimal → leerer Schlüssel).

**E2E:** `e2e/tests/r00146-inhalt-spalte.spec.js` — US-1 bis US-7: Spalte mit fünf Zeilen in der Reihenfolge; vier Felder schreiben je ein Commit (`#1 geändert: …`, `#1 nach „…“ (fabrik)`); gleicher Wert → kein Commit; Zuständig nennt nur die gewählten und enthält kein Bedienelement; in „Details“ steht jedes Feld genau einmal und die Ansicht ist vollständig; Fokus im Feld „Labels“ übersteht ein Live-Ereignis; 320/375/414 px hell und dunkel ohne Querscrollen mit Umbruch; 423 (Board und Aufgabendatei) und 403 (Agent aus Menschen-Spalte) wie heute; Gegenprobe „nur angesehen“ → Datei und `git log` unverändert.

## Abhängigkeiten

- Abhängig von: R00145/I0132 (der Inhalt als einzige gezeichnete Ansicht, grün), R00127/I0115 (Details und die Feldzeilen, grün), R00011/I0011 (PATCH je Feld, grün), R00006 (Spalte bewegt die Karte), ADR-0007 (stabile Schlüssel, Fokussicherer).
- Berührt: R00127 („jeder Abschnitt genau einmal“, jetzt mit Ausnahme), R00145 (FA 14, AK „Gegenbeispiel“), R00039 (Zuständige frei setzen — bleibt der einzige Schreibweg), R00103/R00110 (Live ohne Fokusverlust), R00131 (Umbruch), D00001/D00003.
- Blockiert: nichts.

## Offene Fragen

**An die UX — nicht von der Planung entschieden.** Die Planung liefert zu jeder Frage eine Empfehlung, entschieden wird sie in der ux-Vorprüfung.

1. **Breite der Spalte.** Der Betreiber schlägt 180–220 px vor. Zu bedenken: `.felder` ist heute ein Raster mit fester 84-px-Beschriftungsspalte, bei 180 px bleiben ~96 px für den Wert. **Empfehlung:** feste Spur von 200 px im zweispurigen `.mod-body` (nicht `--bw`: das ist die Breite der Board-Spalten, `web/kd-app.css:88`), Beschriftung und Wert übereinander oder schmalere Beschriftungsspalte.
2. **Brechpunkt: wann rutscht die Spalte unter den Inhalt, und wie?** Die Karte hat die Grenze der Planung überlassen; die Planung gibt sie mit Empfehlung an die UX weiter. **Empfehlung:** CSS-only unter 641 px (dieselbe Grenze, an der `.mod-body` heute auf `display:block` umschaltet, `web/kd-app.css:929–935`, D00004) — kein zweiter Zahlenwert, kein `S.ui`-Zustand, keine Aufklapp-Bedienung. Wenn die UX Aufklappen will, braucht es **einen** Sichtzustand mit stabilem Schlüssel (ADR-0007) samt Fokus- und Live-Regeln; dann ist das eine eigene Bubble.
3. **Komponentenform nach Material 3.** Bearbeitbar als „Text field“/Auswahl/„Date picker“ oder als „List item“, das auf Klick zum Feld wird; nur lesend als Text oder „List item“. Die vorhandenen Feldzeilen sind kompakt (`.mini-inp`, `.felder select`, Höhe 24 px, `.felder` `:399–419`). **Empfehlung:** die vorhandenen Bedienelemente weiterverwenden (ein Schreibweg, ein Fokusschlüssel) und nur enger setzen.
4. **Labels und Zuständige: Chips oder Text?** Für die Zuständigen sind Chips naheliegend (M3 „input chips“ für Einheiten wie Empfänger, `notizen.md`), für Labels ebenso („filter/input chips“). Zu beachten: ein Chip mit ✕ darf **keine neue Aktion** einführen — die Änderung läuft über denselben Feldwert und denselben Commit. **Empfehlung:** Zuständige als Text mit Kürzel und Name (nur lesend, ohne ✕), Labels als vorhandenes Textfeld mit Komma (kein zweiter Schreibweg). Wortlaut des Leerfalls („niemand“, „—“) festlegen.
5. **Fokus, Zielgrößen, Kontrast.** Fokusreihenfolge (Spalte vor oder nach dem Inhalt), Zielgrößen nach ADR-0012, Kontrast der nur lesenden Angaben (≥ 4,5:1) und der `.k`-Beschriftungen; an welcher Stelle der Fokus nach einer Änderung steht.
6. **Was zeigt die Spalte bei defektem Board (423) und Agent-Sperre (403)?** **Empfehlung:** nichts Neues erfinden — „Spalte“ zeigt „nicht auf diesem Board“ wie in „Details“; bei 403/409 bleibt die Datei unverändert, die Meldung erscheint wie heute (Fuß des Fensters bzw. Statuszeile), das Feld zeigt nach dem Neuladen den gespeicherten Wert. Die UX legt fest, ob die Meldung zusätzlich in der Spalte erscheint (dann bricht die schmale Spalte um — ADR-0015 N1).
7. **Eigener Scrollbereich oder mit dem Inhalt scrollen?** Heute scrollen `.mod-main` und `.mod-side` getrennt (D00006, Leseposition). **Empfehlung:** die Spalte scrollt mit dem Inhalt (eine Leseposition, weniger Flächen) — dann bleibt die Spalte im schmalen Layout ohnehin im Fluss.
8. **Überschrift und Rolle der Spalte.** Bekommt die Spalte eine Überschrift (z. B. „FELDER“ im Stil von `.abs h3`) und eine Rolle (`complementary`/`group` mit Namen)? **Empfehlung:** keine zusätzliche Überschrift (die Feldbeschriftungen tragen die Bedeutung), aber ein Name an der Gruppe, damit die nur lesenden Zuständigen nicht ohne Kontext stehen.

## Manuelle Vorbereitungstätigkeiten

- **ux-Vorprüfung** zu den Offenen Fragen 1–8, danach der Zustand „Inhalt mit schmaler Spalte“ an **Artboard D0003** (hell und dunkel, 1280 · 414 · 320 px; bearbeitbare Zeilen, nur lesende Zuständige, Leerfall, Umbruch) mit Freigabe durch den product-owner. Die Flächen-Bubbles sind bis dahin **Bau-Sperre Oberfläche**.

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
- **Verworfene Alternativen:** eine zweite Aktion je Feld in der Spalte (z. B. `data-act="label-weg"`) — zwei Schreibwege für denselben Wert; ein eigenes `S.ui`-Abbild der Feldwerte — zwei Quellen; die Spalte nur im breiten Layout zeichnen und schmal ganz ausblenden — der Betreiber will sie auch auf dem Telefon (dort unter dem Inhalt).
- **Abgrenzung:** R00144/R00145 (Kopf und Ansichten) werden nicht neu aufgemacht; „Details“ bleibt, „Kosten“ und „Verlauf“ unberührt. Das Domänenwissen D00001/D00003 nennt die Seitenleiste noch als eigenen Bereich neben dem Hauptbereich (Stand vor R00127); der Nachzug ist B0681.
