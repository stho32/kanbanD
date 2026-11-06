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
- Ein Pop-Fenster (nicht-modal) bekommt beim Öffnen den Fokus auf seinem ersten Element, lässt Tab durch seine Elemente laufen und schließt, wenn der Fokus es an einem Rand verlässt.
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

### Einordnung der Pops (PO Z. 107)
- **Regel**: Ein Pop (`#pop`), der nur Einträge enthält, ist ein Menü (`role=menu`). Enthält er Eingabefelder, Knöpfe in Zeilen, Links mit Begleittext oder anderes, ist er ein nicht-modales Pop-Fenster (`role=dialog` ohne `aria-modal`). Die Regel gilt auch für künftige Pops.
- **Menüs**: „Mehr“, „Seite“, „Berichte“, „Auf Board legen“, „Status“ der WBS-Sicht, das Kontextmenü und das Ich-Menü (`#t-ich`). Für sie gilt der Abschnitt „Menüs“.
- **Pop-Fenster**: Board (`#t-board`), Lauf (`#t-lauf`) und Defekte Dateien (`#t-defekt`). Für sie gilt der Abschnitt „Pop-Fenster“, nicht der Abschnitt „Menüs“.
- Reservierungen, „WBS neu“ und „WBS verwerfen“ sind schon heute `role=dialog` im `#pop` und bleiben außerhalb dieser Anforderung.

### Menüs
- **Gilt für diese Menüs** (`role=menu`): „Mehr“ (`#t-mehr`), „Seite“ (`#t-seite`), „Berichte“ (`#t-ber`), „Auf Board legen“, „Status“ der WBS-Sicht, das Kontextmenü (`#kmenue`, Karte, Spaltenkopf, Zeile der Aufgabenliste) und das Ich-Menü (`#t-ich`). Nicht für die drei Pop-Fenster.
- **Öffnen**: Beim Öffnen (Klick, Enter, Leertaste, Umschalt+F10 bzw. Menütaste) steht der echte DOM-Fokus auf dem ersten wählbaren Eintrag (`role=menuitem`, im Ich-Menü `role=menuitemradio`).
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
- **Ich-Menü** (`#t-ich`, `web/ansicht.js:300`):
  - Die wählbaren Menschen sind `role=menuitemradio`. Der gewählte trägt `aria-checked="true"`, die übrigen `aria-checked="false"`.
  - Agenten und stillgelegte Personen tragen `aria-disabled="true"` und werden von den Pfeilen übersprungen, wie in allen Menüs.
  - Überschrift „ICH BIN …“, Hinweis „Für diese Aktion zuerst wählen, wer du bist.“ und Fußzeile „Die Wahl gilt nur für diesen Tab.“ stehen nicht innerhalb des Elements `role=menu`. Das Menü wird über `aria-labelledby` nach der Überschrift benannt. Steht der Hinweis da, verweist `aria-describedby` des Menüs auf ihn.
  - Das Aussehen bleibt wie heute.

### Pop-Fenster (nicht-modal, PO Z. 107–108)
- **Gilt für**:
  - Board (`#t-board`, `web/ansicht.js:280`), Name „Boards“. Die Board-Einträge und „Alle Aufgabenreservierungen anzeigen“ werden Knöpfe, `#board-neu` bleibt Eingabefeld.
  - Lauf (`#t-lauf`, `:152`), Name „Läuft gerade“. Je Zeile zwei Knöpfe: „#n öffnen“ und „Timer von … stoppen“.
  - Defekte Dateien (`#t-defekt`, `:523`), Name „Defekte Dateien“. Je Datei ein Link mit dem Pfad, der Fehlertext bleibt lesbarer Text neben dem Link.
- **Rolle**: `role=dialog` mit dem genannten Namen, ohne `aria-modal`. Darunter trägt nichts `inert`, es gibt keine Fokusfalle (WCAG 2.1.2).
- **Öffnen**: Der Fokus steht auf dem ersten tabbaren Element des Pop-Fensters.
- **Tab**:
  - Tab und Umschalt+Tab laufen durch die Elemente des Pop-Fensters.
  - Tab auf dem letzten Element schließt das Pop-Fenster. Der Fokus geht zum nächsten tabbaren Element nach dem Auslöser, wie Tab im Menü.
  - Umschalt+Tab auf dem ersten Element schließt das Pop-Fenster. Der Fokus steht auf dem Auslöser.
- **Esc** schließt das Pop-Fenster, und der Fokus steht auf dem Auslöser.
- **Pfeiltasten** haben im Pop-Fenster keine Funktion. Im Feld `#board-neu` bewegen ← und → nur die Schreibmarke.
- **Live-Ereignis**: lässt den Fokus im offenen Pop-Fenster.
- **Auslöser**: tragen `aria-haspopup="dialog"` und `aria-expanded` („true“ bei offenem Pop-Fenster, sonst „false“).
- **Aussehen**: wie heute; neu sind nur Rolle, Fokus und Tasten.

### Radiogruppen
- **Betroffene Gruppen** (`role=radiogroup`): „Bereich“ in der Kopfzeile (Segmente ab 840 px, Chips darunter), „Aufgabenbereich“ in der Aufgabenliste, „Personen“ auf der Seite Personen und „Person“ im Stundenzettel.
- **Ein Tab-Halt je Gruppe**: Das gewählte Radio hat `tabindex="0"`, die anderen `-1`. Ist keines gewählt, hat das erste `tabindex="0"`.
- **Pfeiltasten**: → und ↓ wählen das nächste Radio, ← und ↑ das vorige, mit Umlauf. Die Wahl wirkt sofort wie ein Klick, und der Fokus steht danach auf dem gewählten Radio.
- **Zieltermin-Markierung** (`tm-ziel`, Fever Chart): Sie ist ein Umschalter, kein Radio, denn ein zweiter Klick nimmt die Markierung zurück. Sie trägt `aria-pressed` statt `role=radio`.

### Fokus nach Aktionen
- **Gegenstück**: Aktionen mit Gegenstück lassen den Fokus auf dem Gegenstück. Beispiel: Spalte zuklappen ↔ aufklappen.
- **Live-Ereignis**: Ein Live-Ereignis, das während eines offenen Fensters, Pop-Fensters oder Menüs eintrifft, lässt den Fokus in der obersten offenen Ebene.
- **Ohne offene Ebene**: Ist kein Fenster, kein Pop-Fenster und kein Menü offen, steht der Fokus nach einem Neuzeichnen nie auf `BODY`, wenn vorher ein Element fokussiert war.

## Nicht-funktionale Anforderungen
- **Barrierefreiheit**: Muster der WAI-ARIA APG „Dialog (Modal)“, „Menu Button“ und „Radio Group“, dazu WCAG 2.1 SC 2.1.1, 2.1.2, 2.4.3, 2.4.7 und 4.1.2. Für die Pop-Fenster gilt die Tab-Regel aus PO Z. 108; die APG beschreibt kein eigenes Muster für nicht-modale Fenster.
- **Sichtbarer Fokus**:
  - Jeder fokussierte Menüeintrag, jedes fokussierte Element eines Pop-Fensters und jedes fokussierte Radio zeigt einen Fokusring. Er folgt dem vorhandenen Muster `outline: 2px solid var(--kd-accent)` (wie `.ka:focus`, `web/kd-app.css:489`), oder das Element trägt die vorhandene Hervorhebung `.km-e.an`.
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
- [ ] Gegeben eines der Menüs dieser Gruppe offen (auch das Ich-Menü) und das Thema hell bzw. dunkel, wenn der Fokus auf einem Eintrag steht, dann ist der Eintrag sichtbar hervorgehoben. Der berechnete `outline-style` ist nicht `none` bei `outline-width` ≥ 2 px, oder der Eintrag trägt die Hervorhebung `.km-e.an`.

### Ich-Menü
Zusätzlich zum Grundbestand: der Mensch „Anna“ (AN), angelegt über `POST /api/personen` nach Stefan. Die Personenliste lautet damit Stefan, Anna, planer.

- [ ] Gegeben Fokus auf dem Ich-Knopf (`#t-ich`, zeigt „Stefan“), wenn Enter gedrückt wird, dann gilt:
  - `#t-ich` trägt `aria-haspopup="menu"` und `aria-expanded="true"`.
  - Der Fokus steht auf dem Eintrag „Stefan“ mit `role=menuitemradio` und `aria-checked="true"`.
  - „Anna“ trägt `role=menuitemradio` und `aria-checked="false"`, „planer“ trägt `aria-disabled="true"`.
- [ ] Gegeben das Ich-Menü offen mit Fokus auf „Stefan“, wenn ↓ gedrückt wird, dann steht der Fokus auf „Anna“. Ein weiteres ↓ führt zurück auf „Stefan“ (Umlauf).
  - Gegenbeispiel: Der Fokus steht nach keinem ↓ auf „planer“ (Agent, `aria-disabled`).
- [ ] Gegeben das Ich-Menü offen mit Fokus auf „Anna“, wenn Enter gedrückt wird, dann ist das Menü geschlossen, `#t-ich` zeigt „Anna“ mit `aria-expanded="false"`, und der Fokus steht auf `#t-ich`. Wird das Menü wieder geöffnet, trägt „Anna“ `aria-checked="true"` und „Stefan“ `aria-checked="false"`.
- [ ] Gegeben ein Tab ohne gewähltes Ich (frisch geöffnet, `sessionStorage` leer) und Fokus auf Karte #1, wenn `m` gedrückt wird, dann öffnet das Ich-Menü mit dem Hinweis „Für diese Aktion zuerst wählen, wer du bist.“, und es gilt:
  - Alle Kinder des Elements `role=menu` tragen `role=menuitemradio`.
  - Überschrift „ICH BIN …“, Hinweis und Fußzeile „Die Wahl gilt nur für diesen Tab.“ liegen außerhalb von `role=menu`.
  - `aria-labelledby` des Menüs zeigt auf die Überschrift, `aria-describedby` auf den Hinweis.
  - Der Fokus steht auf dem ersten wählbaren Eintrag „Stefan“.
  - Gegenbeispiel: Wird das Ich-Menü über `#t-ich` geöffnet (ohne Hinweis), trägt `role=menu` kein `aria-describedby`.

### Pop-Fenster
Breite 1280 px: Nach `#t-board` folgt der Navigationslink „Board“, nach `#t-lauf` der Ich-Knopf `#t-ich`. In der Statuszeile folgt nach `#t-defekt` der Knopf „Tastenkürzel“.

- [ ] Gegeben Fokus auf dem Board-Knopf (`#t-board`), wenn Enter gedrückt wird, dann gilt:
  - `#t-board` trägt `aria-haspopup="dialog"` und `aria-expanded="true"`.
  - Der Pop ist `role=dialog` mit dem Namen „Boards“, ohne `aria-modal`, und kein Element trägt `inert`.
  - Der Fokus steht auf dem Knopf „fabrik“, dem ersten tabbaren Element.
  - Gegenbeispiel: Der Fokus steht nicht im Feld `#board-neu`, wie es heute der Fall ist (`web/app.js:514`).
- [ ] Gegeben das Board-Fenster offen mit Fokus auf „fabrik“, wenn zweimal Tab gedrückt wird, dann steht der Fokus zuerst auf „Alle Aufgabenreservierungen anzeigen“, danach im Feld `#board-neu`.
- [ ] Grenzwert: Gegeben das Board-Fenster offen mit Fokus im Feld `#board-neu` (letztes Element), wenn Tab gedrückt wird, dann ist kein `#pop` mehr im Dokument, `#t-board` trägt `aria-expanded="false"`, und der Fokus steht auf dem Navigationslink „Board“.
- [ ] Grenzwert: Gegeben das Board-Fenster offen mit Fokus auf „fabrik“ (erstes Element), wenn Umschalt+Tab gedrückt wird, dann ist das Board-Fenster geschlossen, und der Fokus steht auf `#t-board` mit `aria-expanded="false"`.
- [ ] Gegeben das Board-Fenster offen mit Fokus auf „Alle Aufgabenreservierungen anzeigen“, wenn Esc gedrückt wird, dann ist es geschlossen, und der Fokus steht auf `#t-board` mit `aria-expanded="false"`.
- [ ] Gegeben das Board-Fenster offen mit Fokus auf „fabrik“, wenn ↓ und danach → gedrückt wird, dann steht der Fokus weiter auf „fabrik“, und das Board-Fenster ist offen.
  - Gegenbeispiel: Gegeben Fokus im Feld `#board-neu` mit dem Text „neu“ und der Schreibmarke am Ende (`selectionStart` 3), wenn ← gedrückt wird, dann ist `selectionStart` 2, der Fokus bleibt im Feld, und das Board-Fenster ist offen. → setzt die Schreibmarke zurück auf 3.
- [ ] Gegeben ein laufender Timer von Stefan auf #1 (`POST /api/aufgaben/1/timer/start` als ST) und Fokus auf `#t-lauf`, wenn Enter gedrückt wird, dann gilt:
  - `#t-lauf` trägt `aria-haspopup="dialog"` und `aria-expanded="true"`.
  - Der Pop ist `role=dialog` mit dem Namen „Läuft gerade“, ohne `aria-modal`.
  - Der Fokus steht auf dem Knopf „#1 öffnen“. Tab führt zum Knopf „Timer von Stefan stoppen“.
  - Ein weiteres Tab schließt das Lauf-Fenster, und der Fokus steht auf `#t-ich`.
- [ ] Grenzwert: Gegeben das Lauf-Fenster aus dem vorigen Kriterium offen mit Fokus auf „#1 öffnen“, wenn Umschalt+Tab gedrückt wird, dann ist es geschlossen, und der Fokus steht auf `#t-lauf` mit `aria-expanded="false"`. Der Timer läuft weiter.
- [ ] Gegeben die defekte Aufgabe #9 (wie im Fenster-Kriterium zu #9) und Fokus auf dem Knopf „1 defekte Datei“ (`#t-defekt`), wenn Enter gedrückt wird, dann gilt:
  - `#t-defekt` trägt `aria-haspopup="dialog"` und `aria-expanded="true"`.
  - Der Pop ist `role=dialog` mit dem Namen „Defekte Dateien“, ohne `aria-modal`.
  - Der Fokus steht auf dem Link mit dem Pfad der Datei von #9. Der Fehlertext steht als Text daneben und ist nicht Teil des Linknamens.
  - Tab schließt das Fenster, und der Fokus steht auf „Tastenkürzel“. Wieder geöffnet, gibt Esc den Fokus an `#t-defekt` zurück.
- [ ] Gegeben das Board-Fenster offen mit Fokus auf „Alle Aufgabenreservierungen anzeigen“, wenn über die API als planer der Titel von #3 geändert wird, dann ist das Board-Fenster nach dem Live-Ereignis (≤ 1 s) offen, und der Fokus steht weiter auf diesem Knopf.
  - Gegenbeispiel: Der Fokus steht danach nicht auf `BODY` und nicht auf `#t-board`.
- [ ] Gegeben das Board-Fenster offen und das Thema hell bzw. dunkel, wenn der Fokus auf „fabrik“ steht, dann ist der berechnete `outline-style` nicht `none` bei `outline-width` ≥ 2 px.

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
   - 2.4 Ich-Menü mit `menuitemradio`; Board-, Lauf- und Defekte-Dateien-Pop als nicht-modale Pop-Fenster mit Tab-Rand (B0385, frei nach PO Z. 107–108)
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
- Menü-Pops und Kontextmenü: Einträge mit `tabindex="-1"` und DOM-Fokus. Die Klasse `.km-e.an` folgt dem Fokus oder entfällt zugunsten von `:focus`.
- Ich-Pop: Einträge `role=menuitemradio` mit `aria-checked`; `h4`, `.warnh` und `.fuss` außerhalb des Elements `role=menu`, verbunden über `aria-labelledby` und `aria-describedby`.
- Board-, Lauf- und Defekte-Dateien-Pop: `role=dialog` mit `aria-label` statt `role=menu`; `div.iz` bzw. `div.pz2` mit `data-act` werden Knöpfe; `u.fokus = '#board-neu'` beim Öffnen des Board-Pops (`web/app.js:514`) entfällt.
- `#t-ber`, `#t-ich` und die übrigen Menü-Auslöser: `aria-haspopup="menu"` und `aria-expanded`. `#t-board`, `#t-lauf` und `#t-defekt`: `aria-haspopup="dialog"` und `aria-expanded` (heute `aria-haspopup="true"` bzw. ohne).
- `span role=radio`: `tabindex` je nach Wahl.
- `tm-ziel`: `aria-pressed` statt `role=radio`.

### Umfang
I0095: 4 Features, 13 Bubbles, 11–25 h.
- Herleitung: Summe der Bubble-Spannen. Die Richtwerte folgen dem Muster der Nachbar-Interactions (I0093: 10 Bubbles, 8,5–18 h) und sind ungemessen (Hypothese).
- Stand: alles bis Bubble geplant. Alle 13 Bubbles sind frei baubar; B0385 seit der Entscheidung des PO (Z. 107–108). Die Spanne von B0385 (1–2 h) bleibt, der Umfang wächst nur um die Tab-Ränder (Hypothese, ungemessen).

## Tests
Nach Skill `test-pyramide`; jede User-Story-Szene wird ein Test.

**Unit (pure Logik)**, `e2e/einheit/fokus.test.js`:
- `ebenen` je Kombination aus Fenster, Hilfe, Zuweisen, Pop und Kontextmenü
- `fallenSchritt` an den Rändern (0, letztes, rückwärts von 0)
- `fokusZiel` je Rang, mit dem Fall „Sicherer findet ein Ziel unter der obersten Ebene → verworfen“
- `radioSchritt` je Taste mit Umlauf in `e2e/einheit/tastatur.test.js`
- Pop-Fenster am Rand (B0385): Tab auf dem letzten Element → schließen, Fokus nach dem Auslöser; Umschalt+Tab auf dem ersten → schließen, Fokus auf den Auslöser; dazwischen → nächstes Element; ein einziges Element ist erstes und letztes zugleich
- `ebenen` mit Board-, Lauf- und Defekte-Dateien-Pop als Pop-Fenster und Ich-Pop als Menü
- erster roter Test: `fokusZiel` mit geschlossenem Aufgabenfenster #1 und leerem Sicherer → Karte #1

**Integration:** entfällt; der Server ändert sich nicht.

**E2E** gegen das laufende Programm auf freiem Port, `e2e/tests/r00106-fokus.spec.js`:
- US-1 bis US-10
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
- **Einordnung der Pops** (ADR-0010, Folgeentscheidung): entschieden vom PO am 2026-11-06 (`AI-Team/po-entscheidungen.md` Z. 107–108, Commit 679216a), wie vom planer empfohlen.
  - Ich-Pop ist ein Menü mit `menuitemradio`. Board-, Lauf- und Defekte-Dateien-Pop sind nicht-modale Pop-Fenster mit Tab-Rand.
  - Für künftige Pops gilt: nur Einträge → Menü, sonst Pop-Fenster.
  - Eingearbeitet in die Abschnitte „Einordnung der Pops“, „Menüs“ (Ich-Menü) und „Pop-Fenster“, in die Akzeptanzkriterien „Ich-Menü“ und „Pop-Fenster“ sowie in US-9 und US-10. B0385 wartet nicht mehr.
- **Hilfe und Zuweisen über dem Fenster** (ADR-0010, Folgeentscheidung): Sie bleiben gestapelt wie heute. Die Fokusführung trägt auch ein Schließen des Fensters; das wäre eine Verhaltensänderung, die hier nicht verlangt ist.

## Manuelle Vorbereitungstätigkeiten
- Keine.

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
- Nicht-modale Fenster: Die WAI-ARIA APG beschreibt nur das modale Dialog-Muster. Dass Tab am Rand ein Pop-Fenster schließt, ist die Regel des Projekts (PO Z. 108) und keine Vorgabe der APG.

## Notizen
- **Abnahme-Probe der Karte #8** steht wörtlich in den Kriterien:
  - Enter auf der Karte → Fokus im Fenster; 30× Tab; Esc → `activeElement.dataset.id`
  - Berichte per Enter, ↓ → `role=menuitem`
  - Spalte per Enter zu → Aufklapp-Knopf
- **Proben aus Kommentar 1** stehen ebenfalls wörtlich darin:
  - „Mehr“ und „Seite“ mit `aria-expanded`, ↓, ↑ mit Umlauf, Tab und Esc
  - Bereichsfilter ab 840 px per Tab und Pfeil
- **Entscheidung Pops** (PO Z. 107–108): Begründung beim PO. Ein Menü enthält nach der APG nur `menuitem`, `menuitemcheckbox`, `menuitemradio` und Trenner; Eingabefeld, Knopf in einer Zeile und Link mit Fehlertext passen nicht hinein. Verworfen ist das Menü „Boards“ mit einem Eintrag „Neues Board …“, der ein eigenes Fenster öffnet, weil das neue Gestaltung wäre.
- **Bewusst außerhalb:**
  - die Reiterleiste (R00105, F0043, PO Z. 88)
  - ein Tooltip bei Fokus (PO Z. 53, eigene Karte)
  - ein Schließen von Hilfe/Zuweisen statt Stapeln (ADR-0010, Folgeentscheidung)
  - ein Ring um das fokussierte Aufgabenfenster (wäre neue Gestaltung)
- **Verworfene Alternativen** (Schnitt):
  - je Feature eine Anforderung — die vier Slices teilen den Kleber und die Invariante, und die Karte hat eine Abnahme
  - Schnitt nach Schichten (erst Modul, dann Oberfläche) — nicht von außen prüfbar
- **Detailplanung:** WBS I0095 (F0044–F0047, B0377–B0389), 2026-11-06.
