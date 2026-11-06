---
id: R00106
status: Neu
datum: 2026-11-06
---

# R00106: Fokus in Fenstern und Menüs führen und nach jeder Aktion halten

## Beschreibung

Wer kanbanD mit der Tastatur bedient, verliert heute an vielen Stellen den Fokus. Das Aufgabenfenster öffnet ohne Fokus, Tab verlässt das Fenster, und nach Esc steht der Fokus auf `BODY` statt auf der Karte. Die Menüs „Berichte“, „Mehr“ und „Seite“ lassen sich nicht mit Pfeiltasten bedienen und melden nicht, ob sie offen sind. Die Bereichsfilter (`role=radio`) sind per Tab nicht erreichbar. Nach dem Zuklappen einer Spalte steht der Fokus ebenfalls auf `BODY`.

Diese Anforderung führt den Fokus an einer Stelle:
- Ein offenes Fenster hält den Fokus und gibt ihn beim Schließen an seinen Auslöser zurück.
- Ein Menü bekommt beim Öffnen den Fokus auf seinem ersten Eintrag und lässt sich mit Pfeilen bedienen.
- Eine Radiogruppe ist ein Tab-Halt und wird mit Pfeilen umgeschaltet.
- Nach einer Aktion bleibt der Fokus auf dem Gegenstück des bedienten Elements.

Ein Live-Ereignis ändert an alledem nichts.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein eigenes Design, früh vom Menschen gesehen. Es ist per Tastatur bedienbar und folgt gewohnten Konventionen.“

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Betreiber arbeitet mit der Tastatur: Kürzel auf dem Board, im Fenster und in der Aufgabenliste (R00026, R00035). Steht der Fokus auf `BODY`, greifen diese Kürzel nicht mehr, oder sie wirken auf etwas, das man nicht sieht. Dann muss er zur Maus greifen und neu ansetzen. Führt kanbanD den Fokus, bleibt der Arbeitsfluss ohne Maus erhalten. Gleichzeitig erfüllt die Oberfläche WCAG 2.1 SC 2.1.1 (Tastatur), 2.1.2 (keine Tastaturfalle außer im modalen Fenster mit Esc), 2.4.3 (Fokus-Reihenfolge) und 4.1.2 (Name, Rolle, Wert bei `aria-expanded`).

## Funktionale Anforderungen

### Fenster (Karte #8, ADR-0010)
- **Fenster mit Fokusfalle**: Aufgabenfenster, „Neue Aufgabe“, „Defekte Datei“, „Tastaturkürzel“ (Hilfe) und „Zuständige“ (Zuweisen) sind modale Fenster.
  - Solange eines offen ist, trägt es `aria-modal="true"`, und alles darunter ist `inert`.
  - Tab und Umschalt+Tab laufen nur durch die Elemente des obersten Fensters, mit Umlauf vom letzten zum ersten Element und umgekehrt.
- **Startziel**:
  - Das Aufgabenfenster bekommt beim Öffnen den Fokus auf dem Fenster selbst (`role=dialog`, `tabindex="-1"`, zugänglicher Name über `aria-labelledby`), nicht im Titelfeld. Die Fensterkürzel (`d`, `e`, `s`, `k`, ↑ ↓) greifen also sofort.
  - Die übrigen Fenster setzen den Fokus auf ihr erstes tabbares Element, oder wie heute auf ein ausdrücklich gewähltes Ziel (Zuweisen: die erste Wahl).
- **Rückgabe beim Schließen** (Esc, ✕ oder Klick auf den Hintergrund):
  - Aufgaben- und Defekt-Fenster geben den Fokus an die Karte bzw. Zeile der zuletzt gezeigten Aufgabe zurück, auch nach dem Blättern.
  - Die übrigen Fenster geben ihn an das Element zurück, das beim Öffnen fokussiert war.
  - Gibt es dieses Element nicht mehr, geht der Fokus auf den Hauptbereich (`#main`).
- **Stapel**: Hilfe und Zuweisen öffnen wie heute über dem Aufgabenfenster.
  - Das oberste Fenster hält den Fokus.
  - Schließt es, kehrt der Fokus in das Fenster darunter zurück, auf das Element, das vorher fokussiert war.

### Menüs
- **Gilt für alle Menüs** (`role=menu`): „Mehr“ (`#t-mehr`), „Seite“ (`#t-seite`), „Berichte“ (`#t-ber`), „Auf Board legen“, „Status“ der WBS-Sicht und das Kontextmenü (`#kmenue`, Karte, Spaltenkopf, Zeile der Aufgabenliste).
- **Öffnen**: Beim Öffnen (Klick, Enter, Leertaste, Umschalt+F10 bzw. Menütaste) steht der echte DOM-Fokus auf dem ersten wählbaren Eintrag (`role=menuitem`).
- **Pfeiltasten**:
  - ↓ und ↑ gehen zum nächsten bzw. vorigen wählbaren Eintrag, mit Umlauf.
  - Pos1 und Ende springen zum ersten bzw. letzten Eintrag.
  - Trenner und Einträge mit `aria-disabled="true"` werden übersprungen.
- **Auswählen**: Enter und Leertaste lösen den Eintrag aus.
- **Untermenüs des Kontextmenüs**: → öffnet das Untermenü mit Fokus auf seinem ersten wählbaren Eintrag, ← schließt es mit Fokus auf dem Eintrag darüber.
- **Schließen**:
  - Esc schließt das Menü, und der Fokus steht wieder auf dem Auslöser (beim Kontextmenü: Karte, Spaltenkopf oder Zeile).
  - Tab schließt das Menü, und der Fokus geht zum nächsten Element nach dem Auslöser.
  - Löst ein Eintrag eine Aktion aus, steht der Fokus danach auf dem Auslöser oder dem Ziel, das die Aktion nennt, nie auf `BODY`.
- **Auslöser**: tragen `aria-haspopup="menu"` und `aria-expanded` („true“ bei offenem Menü, sonst „false“).
- **Pops ohne Einordnung**: Board-, Lauf-, Ich- und Defekte-Dateien-Pop (`#t-board`, `#t-lauf`, `#t-ich`, `#t-defekt`) sind Menü oder nicht-modales Fenster, je nach Entscheidung (siehe Offene Fragen). Unabhängig davon gilt:
  - Beim Öffnen liegt der Fokus im Pop.
  - Esc gibt ihn an den Auslöser zurück.
  - Der Auslöser trägt `aria-expanded`.

### Radiogruppen
- **Betroffene Gruppen** (`role=radiogroup`): „Bereich“ in der Kopfzeile (Segmente ab 840 px, Chips darunter), „Aufgabenbereich“ in der Aufgabenliste, „Personen“ auf der Seite Personen und „Person“ im Stundenzettel.
- **Ein Tab-Halt je Gruppe**: Das gewählte Radio hat `tabindex="0"`, die anderen `-1`. Ist keines gewählt, hat das erste `tabindex="0"`.
- **Pfeiltasten**: → und ↓ wählen das nächste Radio, ← und ↑ das vorige, mit Umlauf. Die Wahl wirkt sofort wie ein Klick, und der Fokus steht danach auf dem gewählten Radio.
- **Zieltermin-Markierung** (`tm-ziel`, Fever Chart): Sie ist ein Umschalter, kein Radio, denn ein zweiter Klick nimmt die Markierung zurück. Sie trägt `aria-pressed` statt `role=radio`.

### Fokus nach Aktionen
- **Gegenstück**: Aktionen mit Gegenstück lassen den Fokus auf dem Gegenstück. Beispiel: Spalte zuklappen ↔ aufklappen.
- **Live-Ereignis**: Ein Live-Ereignis, das während eines offenen Fensters oder Menüs eintrifft, lässt den Fokus im obersten Fenster bzw. Menü.
- **Ohne offene Ebene**: Ist kein Fenster und kein Menü offen, steht der Fokus nach einem Neuzeichnen nie auf `BODY`, wenn vorher ein Element fokussiert war.

## Nicht-funktionale Anforderungen
- **Barrierefreiheit**: Muster der WAI-ARIA APG „Dialog (Modal)“, „Menu Button“ und „Radio Group“, dazu WCAG 2.1 SC 2.1.1, 2.1.2, 2.4.3, 2.4.7 und 4.1.2.
- **Sichtbarer Fokus**:
  - Jeder fokussierte Menüeintrag und jedes fokussierte Radio zeigt einen Fokusring. Er folgt dem vorhandenen Muster `outline: 2px solid var(--kd-accent)` (wie `.ka:focus`, `web/kd-app.css:489`), oder das Element trägt die vorhandene Hervorhebung `.km-e.an`.
  - Der Ring ist in Hell und Dunkel sichtbar (berechneter `outline-style` nicht `none`, `outline-width` ≥ 2 px).
- **Kein neues Aussehen**: Fenster, Menüs, Radiogruppen und Knöpfe sehen aus wie heute. Neu sind nur Rolle, Fokus und Tasten.
- **Eine Stelle für den Fokus** (ADR-0010):
  - `grep -n "\.focus(" web/*.js` findet danach nur `fokusSetzen` (`web/sichtzustand.js`), den Kleber am Ende von `render()` und den keydown-Zweig der Fokusführung.
  - Heute sind es 9 Fundstellen, gezählt am 2026-11-06: `web/app.js` 8, `web/sichtzustand.js` 1.
- **Bestand**: Alle bestehenden E2E-Tests bleiben grün. Die Tests des Kontextmenüs (R00033, R00034), die heute die Klasse `.km-e.an` abfragen, werden auf `document.activeElement` umgestellt.

## Akzeptanzkriterien

Grundbestand (herstellbar über die API, Identität `X-KanbanD-Wer`):
- Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“ und „Fertig“ (Abschlussspalte).
- Aufgaben: #1 „eins“ und darunter #2 „zwei“ in „Eingang“, #3 „drei“ in „In Arbeit“.
- Personen: der Mensch „Stefan“ (ST), im Tab als „Ich“ gewählt, und der Agent „planer“ (PL).

Breite 1280 px und Thema hell, sofern nicht anders genannt. „Fokus auf X“ heißt `document.activeElement` ist X.

### Fenster
- [ ] Gegeben Fokus auf Karte #1, wenn Enter gedrückt wird, dann ist `document.activeElement` das Element `role=dialog` mit dem Namen „Aufgabe #1“, es trägt `aria-modal="true"`, und Kopfzeile und Board tragen `inert`.
- [ ] Gegeben Aufgabenfenster #1 gerade per Enter geöffnet, wenn `d` gedrückt wird, dann zeigt das Fenster „Datei“, ohne vorherigen Klick.
  - Gegenbeispiel: Gegeben der Fokus steht im Titelfeld, wenn `d` gedrückt wird, dann steht „d“ im Titel und der Reiter bleibt „Inhalt“.
- [ ] Gegeben Aufgabenfenster #1 offen mit Fokus auf dem Fenster, wenn 30-mal Tab gedrückt wird, dann liegt `document.activeElement` nach jedem Druck innerhalb des Fensters und ist nie `BODY`. Dasselbe gilt für 30-mal Umschalt+Tab.
- [ ] Grenzwert: Gegeben Aufgabenfenster #1 offen mit Fokus auf dem letzten tabbaren Element des Fensters, wenn Tab gedrückt wird, dann steht der Fokus auf dem ersten tabbaren Element des Fensters. Umgekehrt führt Umschalt+Tab vom ersten zum letzten.
- [ ] Gegeben Aufgabenfenster #1 per Enter geöffnet, wenn Esc gedrückt wird, dann ist kein `role=dialog` mehr offen, `document.activeElement.dataset.id` ist „1“, und nichts trägt mehr `inert`.
- [ ] Gegeben Aufgabenfenster #1 offen, wenn mit ↓ zu #2 geblättert und dann Esc gedrückt wird, dann steht der Fokus auf Karte #2.
- [ ] Gegeben die Aufgabenliste (`#/aufgaben`) mit Fokus auf der Zeile #3, wenn Enter und danach Esc gedrückt wird, dann steht der Fokus auf `tr[data-zeile="3"]`.
- [ ] Gegeben Fokus auf dem Knopf „Neue Aufgabe“, wenn Enter gedrückt wird, dann liegt der Fokus im Fenster „Neue Aufgabe“. 30-mal Tab und 30-mal Umschalt+Tab bleiben im Fenster. Esc schließt es, und der Fokus steht auf dem Knopf „Neue Aufgabe“.
- [ ] Gegeben Fokus auf Karte #1, wenn `p` gedrückt wird, dann liegt der Fokus im Fenster „Zuständige für …“ auf der ersten Wahl. 30-mal Tab bleibt im Fenster. Esc schließt es, und der Fokus steht auf Karte #1.
- [ ] Gegeben eine von Hand in den Ordner gelegte, ungültige Aufgabendatei #9 auf „fabrik“ und Fokus auf ihrer Karte, wenn Enter gedrückt wird, dann liegt der Fokus im Fenster „Defekte Datei #9“. 30-mal Tab bleibt darin. Esc gibt den Fokus an die Karte #9 zurück.
- [ ] Gegeben Aufgabenfenster #1 offen mit Fokus auf dem Fenster, wenn `?` gedrückt wird, dann liegt der Fokus im Fenster „Tastaturkürzel“, und das Aufgabenfenster trägt `inert`. 30-mal Tab bleibt in der Hilfe. Esc schließt nur die Hilfe, und der Fokus steht wieder auf dem Aufgabenfenster.
- [ ] Grenzwert: Gegeben Aufgabenfenster #1 per Enter geöffnet, wenn #1 über die API als planer nach „In Arbeit“ verschoben wird und danach Esc gedrückt wird, dann steht der Fokus auf Karte #1 in der Spalte „In Arbeit“.
- [ ] Leerfall: Gegeben das Board frisch geladen und nichts fokussiert (`document.activeElement` ist `BODY`), wenn `n` gedrückt und das Fenster „Neue Aufgabe“ mit Esc geschlossen wird, dann steht der Fokus auf `#main` oder einem Element darin, nicht auf `BODY`.

### Menüs
- [ ] Gegeben Fokus auf „Mehr“ (`#t-mehr`, 1280 px), wenn Enter gedrückt wird, dann trägt `#t-mehr` `aria-expanded="true"`, und `document.activeElement` hat `role=menuitem` und ist der erste Eintrag des Menüs „Mehr“.
- [ ] Gegeben das Menü „Mehr“ offen mit Fokus auf dem ersten Eintrag, wenn ↓ gedrückt wird, dann steht der Fokus auf dem zweiten Eintrag. Wenn danach ↑ und noch einmal ↑ gedrückt wird, steht er auf dem letzten Eintrag (Umlauf). Ende führt zum letzten, Pos1 zum ersten Eintrag.
- [ ] Gegeben das Menü „Mehr“ offen, wenn Esc gedrückt wird, dann ist kein `role=menu` mehr im Dokument, `document.activeElement.id` ist „t-mehr“, und es trägt `aria-expanded="false"`.
- [ ] Gegeben das Menü „Mehr“ offen, wenn Tab gedrückt wird, dann ist das Menü geschlossen, `#t-mehr` trägt `aria-expanded="false"`, und der Fokus ist nicht `BODY`.
- [ ] Gegeben Breite 375 px und Fokus auf dem Seitenmenü-Knopf (`#t-seite`), wenn Enter gedrückt wird, dann trägt er `aria-expanded="true"` und der Fokus steht auf dem Eintrag „Board“. ↓ führt zu „Aufgaben“, Esc gibt den Fokus an `#t-seite` mit `aria-expanded="false"` zurück.
- [ ] Gegeben Fokus auf „Berichte“ (`#t-ber`), wenn Enter gedrückt wird, dann trägt `#t-ber` `aria-haspopup="menu"` und `aria-expanded="true"`, der Fokus steht auf dem Eintrag „Stundenzettel“, und ↓ führt zum zweiten Eintrag.
- [ ] Gegeben Fokus auf Karte #1, wenn Umschalt+F10 gedrückt wird, dann steht der Fokus auf dem Eintrag „Öffnen“ des Menüs „#1 eins“. Zweimal ↓ führt auf „Mir zuweisen“, der Trenner wird übersprungen. Esc gibt den Fokus an Karte #1 zurück.
- [ ] Grenzwert: Gegeben das Kontextmenü von Karte #1 (in „Eingang“) mit Fokus auf „Verschieben nach“, wenn → gedrückt wird, dann öffnet das Untermenü, und der Fokus steht auf „In Arbeit“, nicht auf „Eingang“ (der trägt `aria-disabled="true"`). ← schließt das Untermenü, und der Fokus steht wieder auf „Verschieben nach“.
- [ ] Gegeben das Kontextmenü von Karte #1 mit Fokus auf „Mir zuweisen“, wenn Enter gedrückt wird, dann ist ST zuständig für #1, das Menü geschlossen, und der Fokus steht auf Karte #1.
- [ ] Gegeben Fokus auf dem Board-Knopf (`#t-board`), wenn Enter gedrückt wird, dann trägt er `aria-expanded="true"`, und der Fokus liegt im Pop. Esc gibt den Fokus an `#t-board` mit `aria-expanded="false"` zurück. Das gilt ebenso für `#t-ich` und, bei laufendem Timer, für `#t-lauf`.
- [ ] Gegeben eines der Menüs dieser Gruppe offen und das Thema hell bzw. dunkel, wenn der Fokus auf einem Eintrag steht, dann ist der Eintrag sichtbar hervorgehoben. Der berechnete `outline-style` ist nicht `none` bei `outline-width` ≥ 2 px, oder der Eintrag trägt die Hervorhebung `.km-e.an`.

### Radiogruppen
- [ ] Gegeben 1280 px und Fokus im Filterfeld, wenn Tab gedrückt wird, dann steht der Fokus auf dem Radio „alle“ (`aria-checked="true"`) der Gruppe „Bereich“.
- [ ] Gegeben Fokus auf „alle“, wenn → gedrückt wird, dann steht der Fokus auf „meine“, „meine“ trägt `aria-checked="true"` und `tabindex="0"`, „alle“ trägt `tabindex="-1"`, und das Board zeigt nur Karten, für die ST zuständig ist. ↓ wirkt wie →, ↑ wie ←.
- [ ] Grenzwert: Gegeben Fokus auf dem ersten Radio „alle“, wenn ← gedrückt wird, dann ist das letzte Radio der Gruppe gewählt und fokussiert (Umlauf).
- [ ] Gegeben Fokus auf dem gewählten Radio der Gruppe „Bereich“, wenn Tab gedrückt wird, dann steht der Fokus auf einem Element außerhalb der Gruppe (ein Tab-Halt je Gruppe).
- [ ] Gegenbeispiel: Gegeben Fokus im Filterfeld mit dem Text „ein“, wenn → gedrückt wird, dann bewegt sich nur die Schreibmarke, und der Bereich bleibt „alle“.
- [ ] Gegeben 375 px (Chips) und Fokus auf dem gewählten Chip „alle“, wenn Tab gedrückt wird, dann verlässt der Fokus die Gruppe. Nur der gewählte Chip trägt `tabindex="0"`. → wählt „meine“.
- [ ] Gegeben die Aufgabenliste und Fokus auf dem gewählten Radio „alle“ der Gruppe „Aufgabenbereich“, wenn → gedrückt wird, dann ist „ohne Board“ gewählt und fokussiert, und die Liste zeigt nur Aufgaben ohne Board.
- [ ] Gegeben die Seite Personen und Fokus auf dem gewählten Radio „Menschen + Agenten“, wenn → gedrückt wird, dann ist „nur Menschen“ gewählt und fokussiert, und planer steht nicht mehr in der Liste.
- [ ] Leerfall: Gegeben der Stundenzettel mit einer Person, die nicht unter den aktiven Personen ist, sodass kein Radio der Gruppe „Person“ gewählt ist, wenn per Tab in die Gruppe gegangen wird, dann steht der Fokus auf dem ersten Radio.
- [ ] Gegeben ein Fever Chart mit zwei Terminen, wenn die Zieltermin-Markierung gelesen wird, dann ist sie ein Knopf mit `aria-pressed` („true“ beim markierten Termin), ohne `role=radio`.

### Fokus nach Aktionen
- [ ] Gegeben Fokus auf dem Spaltennamen-Knopf „In Arbeit“ (`.bk-name`), wenn Enter gedrückt wird, dann ist die Spalte zugeklappt, und der Fokus steht auf ihrem Aufklapp-Knopf (`.zu-streifen`). Ein weiteres Enter klappt sie auf, und der Fokus steht wieder auf „In Arbeit“.
- [ ] Gegeben Spalte „In Arbeit“ zugeklappt und Fokus auf ihrem Aufklapp-Knopf, wenn über die API als planer der Titel von #1 geändert wird, dann steht der Fokus nach dem Live-Ereignis (≤ 1 s) weiter auf dem Aufklapp-Knopf.

### Live-Ereignis während offener Ebene
- [ ] Gegeben Aufgabenfenster #1 offen mit Fokus auf dem Fenster, wenn über die API als planer der Titel von #3 geändert wird, dann liegt der Fokus nach dem Live-Ereignis (≤ 1 s) im Fenster. 30-mal Tab bleibt danach im Fenster, und Esc gibt den Fokus an Karte #1 zurück.
- [ ] Gegeben das Menü „Mehr“ offen mit Fokus auf dem zweiten Eintrag, wenn über die API als planer der Titel von #3 geändert wird, dann steht der Fokus nach dem Live-Ereignis (≤ 1 s) weiter auf dem zweiten Eintrag des Menüs „Mehr“.
  - Gegenbeispiel: Gegeben die Hilfe über Aufgabenfenster #1, wenn #1 über die API geändert wird, dann liegt der Fokus in der Hilfe, nicht im Aufgabenfenster.

## Betroffene Verzeichnisstruktur
- `web/fokus.js` (neu, rein, UMD wie `web/menue.js`, eingebunden vor `web/ansicht.js`): Ebenen, Tab-Umlauf, Fokusziel.
- `web/app.js`:
  - Kleber am Ende von `render()` (heute `:479–483`)
  - Esc-Kaskade `:1317–1324`
  - keydown `:1281–1400`
  - Kontextmenü `:1332–1400`
  - `spalte-zu` `:1079`
  - Fokus-Aufrufe `:1298`, `:1314`, `:1459`, `:1484`, `:1561`
- `web/ansicht.js`:
  - Fenster `:188`, `:209–232`, `:455`, `:471`, `:549`
  - Pops `:97–129`, `:152`, `:280`, `:300`, `:523`, `:686`, `:721–724`, `:1102`
  - Auslöser `:57`, `:69`, `:76`, `:82`, `:147`, `:157`
  - Radios `:109`, `:115`, `:666`, `:711`, `:764`, `:871`
  - Spaltenköpfe `:607`, `:622`
- `web/tastatur.js`: Radio-Schritt neben `naechsterReiter`.
- `web/kd-app.css`: Fokusring nach dem vorhandenen Muster, nur wo er fehlt.
- Tests:
  - `e2e/einheit/fokus.test.js` und `e2e/einheit/tastatur.test.js`
  - `e2e/tests/r00106-fokus.spec.js` (neu)
  - angepasst `r00033-kontextmenue.spec.js` und `r00034-menues.spec.js`

## Technische Überlegungen

Die Technik steht in [ADR-0010](../Dokumentation/ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (Option B) und wird hier nicht wiederholt:
- reines Modul für Ebenen und Fokusziel
- ein Kleber am Ende von `render()` mit `inert`, `aria-modal` und fester Rangfolge
- Menüs mit echtem DOM-Fokus über `menueSchritt`
- Gegenstücke über `data-halt` nach ADR-0007

Die Bubbles der WBS (I0095) sind **Vorplanung**; welche es beim Bauen werden, entscheidet der Entwickler.

### Ablauf
1. **Fenster** (F0044, frei baubar)
   - 1.1 Ebenen und Fokusziel als reine Funktionen (B0377)
   - 1.2 Fokusfalle mit `inert`, `aria-modal` und Tab-Umlauf (B0378)
   - 1.3 Startziel und Rückgabe in der Rangfolge nach `render()` (B0379)
   - 1.4 Stapel Hilfe/Zuweisen über dem Fenster (B0380)
   - 1.5 Live-Ereignis bei offener Ebene (B0381)
2. **Menüs** (F0045)
   - 2.1 Öffnen mit Fokus auf dem ersten Eintrag, Pfeile, Pos1/Ende (B0382, frei)
   - 2.2 Esc, Tab und Auswahl schließen mit Rückgabe; `aria-expanded` an allen Auslösern (B0383, frei)
   - 2.3 Kontextmenü auf DOM-Fokus (B0384, frei)
   - 2.4 Board-, Lauf-, Ich- und Defekte-Dateien-Pop nach Einordnung (B0385, wartet auf die Entscheidung des Betreibers)
3. **Radiogruppen** (F0046, frei)
   - 3.1 Radio-Schritt als reine Funktion (B0386)
   - 3.2 Gruppen mit roving `tabindex`, `tm-ziel` als Umschalter (B0387)
4. **Fokus nach Aktionen** (F0047, frei)
   - 4.1 Spalte zu/auf über `data-halt` (B0388)
   - 4.2 Übrige `.focus()`-Aufrufe in die Fokusführung (B0389)

### Grobentwurf

**Wichtige Einstiegsstellen:** `render()` und der keydown-Handler in `web/app.js`; die `v…Pop`- und Fenster-Funktionen in `web/ansicht.js`.

**Elemente** (nach ADR-0010):
- `ebenen(ui)` (rein): offene Ebenen von unten nach oben, je `{art, selektor, rueckgabe}`.
- `fallenSchritt(anzahl, index, rueckwaerts)` (rein): nächstes Ziel im Tab-Umlauf.
- `fokusZiel(lage)` (rein): Ziel nach der Rangfolge aus ausdrücklichem Ziel, Sicherer in oberster Ebene, Rückgabe, Startziel, Karte/Zeile und erstem tabbaren Element.
- `radioSchritt(anzahl, index, taste)` (rein, `web/tastatur.js`): ← → ↑ ↓ mit Umlauf.

### Gestaltung
- **Kein neues Artboard**: Fenster, Menüs und Radiogruppen behalten ihr Aussehen; neu sind nur Rolle, Fokus und Tasten.
- **Fokusring**: folgt dem vorhandenen Muster (`.ka:focus`, `.bahn-kopf:focus`, `.bf-chip:focus-visible`), im Kontextmenü der vorhandenen Hervorhebung `.km-e.an`.
- **Fenster ohne Ring**: Das fokussierte Aufgabenfenster selbst bekommt keinen Ring (`outline: none` am Fenster, wie `.besch-lesen:focus`), damit sich sein Aussehen nicht ändert.
- **Freigabe nötig bei Abweichung**: Will der Bau eines davon anders zeigen, ist das neue Gestaltung und wartet auf die Freigabe eines Artboards (PO Z. 75–76).

### Änderungen an bestehenden Klassen
- Fenster: `tabindex="-1"`, `aria-labelledby`, `aria-modal`.
- Pops und Kontextmenü: Einträge mit `tabindex="-1"` und DOM-Fokus. Die Klasse `.km-e.an` folgt dem Fokus oder entfällt zugunsten von `:focus`.
- `#t-ber` und die übrigen Auslöser: `aria-haspopup="menu"` und `aria-expanded`.
- `span role=radio`: `tabindex` je nach Wahl.
- `tm-ziel`: `aria-pressed` statt `role=radio`.

### Umfang
I0095: 4 Features, 13 Bubbles, 11–25 h.
- Herleitung: Summe der Bubble-Spannen. Die Richtwerte folgen dem Muster der Nachbar-Interactions (I0093: 10 Bubbles, 8,5–18 h) und sind ungemessen (Hypothese).
- Stand: alles bis Bubble geplant. 12 Bubbles sind frei baubar, 1 (B0385) wartet auf die Entscheidung des Betreibers.

## Tests
Nach Skill `test-pyramide`; jede User-Story-Szene wird ein Test.

**Unit (pure Logik)**, `e2e/einheit/fokus.test.js`:
- `ebenen` je Kombination aus Fenster, Hilfe, Zuweisen, Pop und Kontextmenü
- `fallenSchritt` an den Rändern (0, letztes, rückwärts von 0)
- `fokusZiel` je Rang, mit dem Fall „Sicherer findet ein Ziel unter der obersten Ebene → verworfen“
- `radioSchritt` je Taste mit Umlauf in `e2e/einheit/tastatur.test.js`
- erster roter Test: `fokusZiel` mit geschlossenem Aufgabenfenster #1 und leerem Sicherer → Karte #1

**Integration:** entfällt; der Server ändert sich nicht.

**E2E** gegen das laufende Programm auf freiem Port, `e2e/tests/r00106-fokus.spec.js`:
- US-1 bis US-8
- 30× Tab und 30× Umschalt+Tab je Fenster
- Live-Proben mit Warten auf das Ereignis

## Abhängigkeiten
- Abhängig von:
  - R00026 Tastaturbedienung (I0026)
  - R00033 und R00034 Kontextmenüs (I0033, I0034)
  - R00035 Kürzel überall (I0035)
  - R00101 Kopfzeile (I0083)

  Alle sind gruen.
- Berührt: R00105 (I0093) — die Reiterleiste ist dort als `tablist` gebaut (F0043, B0375 gruen) und wird hier nicht noch einmal geplant. R00103 — ein Live-Ereignis nimmt dem Menschen nicht den Fokus.
- Blockiert: —

## Offene Fragen
- **Einordnung der Pops** (ADR-0010, Folgeentscheidung).
  - Frage: Ist der Pop jeweils ein Menü (Pfeiltasten, nur Einträge) oder ein nicht-modales Fenster (Tab durch Knöpfe und Felder, keine Pfeile)?
  - Stand: Eine Entscheidung des PO dazu gibt es nicht (`AI-Team/po-entscheidungen.md`, Stand 2026-11-06). Bis dahin wartet B0385. Die Kriterien zu diesen Pops beschränken sich auf das, was in beiden Fällen gilt: Fokus im Pop, Esc zurück an den Auslöser, `aria-expanded`.

  | Pop | Ort | Inhalt heute | Empfehlung | Begründung |
  |---|---|---|---|---|
  | Board-Pop | `web/ansicht.js:280` | Board-Einträge, Eintrag „Alle Aufgabenreservierungen anzeigen“, Eingabefeld `#board-neu` | nicht-modales Fenster | Ein Eingabefeld darf nicht in `role=menu` stehen. Die Board-Einträge werden Knöpfe in Tab-Reihenfolge, das Aussehen bleibt. Die Alternative „Menü plus Eintrag ‚Neues Board …‘, der ein eigenes Fenster öffnet“ ist neue Gestaltung und bräuchte ein Artboard. |
  | Lauf-Pop | `:152` | Zeilen, die die Aufgabe öffnen, je mit Knopf ■ „stoppen“ | nicht-modales Fenster | Ein Knopf in einem menuitem ist kein gültiges Menü. Je Zeile werden es zwei Knöpfe, „#n öffnen“ und „Timer von … stoppen“. |
  | Ich-Pop | `:300` | wählbare Menschen, nicht wählbare Agenten und Stillgelegte | Menü | Er enthält nur Einträge. Die Wahl wird `menuitemradio` mit `aria-checked`, nicht Wählbares `aria-disabled` und wird übersprungen. |
  | Defekte Dateien | `:523`, in ADR-0010 nicht genannt | Pfad als Link und Fehlertext | nicht-modales Fenster | Der Fehlertext muss lesbar bleiben; als menuitem ginge er im Namen des Links unter. |
- **Hilfe und Zuweisen über dem Fenster** (ADR-0010, Folgeentscheidung): Sie bleiben gestapelt wie heute. Die Fokusführung trägt auch ein Schließen des Fensters; das wäre eine Verhaltensänderung, die hier nicht verlangt ist.

## Manuelle Vorbereitungstätigkeiten
- Entscheidung des Betreibers zur Einordnung der Pops (siehe Offene Fragen), vor dem Bau von B0385.

## Manuelle Nachbereitungstätigkeiten
- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die UX-Durchsicht (Karte #8): Nach Öffnen, Schließen und Zuklappen steht der Fokus auf `BODY`, Menüs reagieren nicht auf Pfeile, und Radiogruppen sind per Tab nicht erreichbar.

Die Ursache ist, dass jede Aktion den Fokus selbst setzt oder ihn vergisst und dass `render()` den Fokus nicht nach einer festen Regel neu setzt.

Diese Anforderung setzt an genau dieser Stelle an:
- Bestimmt eine Rangfolge nach jedem Neuzeichnen, wo der Fokus hingehört, hat jede Aktion und jedes Live-Ereignis dasselbe Ergebnis. Der Fokus liegt dann im obersten Fenster oder Menü, und beim Schließen kehrt er zum Auslöser zurück.
- Weil Menüs und Radiogruppen echten DOM-Fokus mit Pfeilen bekommen, folgen sie den Konventionen, die Tastatur- und Screenreader-Nutzer erwarten.

Der Hebel ist die eine Stelle am Ende von `render()`: Einzelne `.focus()`-Aufrufe an jeder Aktion würden wieder vom nächsten Neuzeichnen überschrieben.

## Missing-Docs
- Verhalten von `inert` zusammen mit `position: fixed`-Hintergründen (`.mod-bg`) in Chromium. Angenommen ist, dass ein Klick auf den Hintergrund weiter schließt, weil der Hintergrund zum Fenster gehört und nicht `inert` ist. Das ist im ersten E2E festzuhalten.

## Notizen
- **Abnahme-Probe der Karte #8** steht wörtlich in den Kriterien:
  - Enter auf der Karte → Fokus im Fenster; 30× Tab; Esc → `activeElement.dataset.id`
  - Berichte per Enter, ↓ → `role=menuitem`
  - Spalte per Enter zu → Aufklapp-Knopf
- **Proben aus Kommentar 1** stehen ebenfalls wörtlich darin:
  - „Mehr“ und „Seite“ mit `aria-expanded`, ↓, ↑ mit Umlauf, Tab und Esc
  - Bereichsfilter ab 840 px per Tab und Pfeil
- **Bewusst außerhalb:**
  - die Reiterleiste (R00105, F0043, PO Z. 88)
  - ein Tooltip bei Fokus (PO Z. 53, eigene Karte)
  - ein Schließen von Hilfe/Zuweisen statt Stapeln (ADR-0010, Folgeentscheidung)
  - ein Ring um das fokussierte Aufgabenfenster (wäre neue Gestaltung)
- **Verworfene Alternativen** (Schnitt):
  - je Feature eine Anforderung — die vier Slices teilen den Kleber und die Invariante, und die Karte hat eine Abnahme
  - Schnitt nach Schichten (erst Modul, dann Oberfläche) — nicht von außen prüfbar
- **Detailplanung:** WBS I0095 (F0044–F0047, B0377–B0389), 2026-11-06.
