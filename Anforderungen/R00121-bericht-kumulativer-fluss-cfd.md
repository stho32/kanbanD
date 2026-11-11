---
id: R00121
status: Neu
datum: 2026-11-11
---

# R00121: Bericht „Kumulativer Fluss (CFD)“

## Beschreibung

Ein neuer Bericht im Menü „Berichte“ zeigt den Fluss eines Boards als **kumulatives Flussdiagramm** (cumulative flow diagram, CFD): über die Zeit gestapelte Bänder, je Band eine Spalte des Boards, die Dicke eines Bandes die Zahl der Aufgaben, die an diesem Tag in dieser Spalte liegen. Die letzte Spalte (Abschlussspalte) ist ein eigenes, oberstes Band; daraus lesbar sind die beiden kumulierten Ränder — oben „angekommen“ (Aufgaben, die bis dahin mindestens einmal auf dem Board waren) und unten „fertig“ (Aufgaben bis dahin in der Abschlussspalte). So wird auf einen Blick sichtbar, wo Aufgaben sich stauen, wie viel gerade in Arbeit ist und wie der Durchsatz läuft. Der Bericht rechnet im **Browser** aus den Bewegungen des Boards (`GET /api/berichte/bewegungen`, R00042), wie Burndown und Bestand; die gemeinsame Filterleiste der Berichte (R00081) gilt. Er schreibt nichts und braucht keine neue Ablage und keinen neuen Endpunkt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen rechnen aus dem, was geschehen ist“, „Git als Archiv inklusive Zeiten“.

### Domänenbezug
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Burndown und „Wie lange noch“ beantworten „wie viel ist noch offen“ und „wann sind wir fertig“. Der CFD beantwortet die Frage davor: **wo hängt es**. Das dickste Band ist die Engstelle — wächst es über die Tage, staut sich Arbeit in einer Spalte, während rechts daneben Leerlauf herrscht; ein flacher oberer Rand bei fallendem Durchsatz heißt, dass nichts nachkommt. Der Bericht bündelt alle Spalten in einer Fläche, sodass ein einzelner Blick den ganzen Fluss zeigt, statt je Spalte eine Zahl zu lesen. Der Bericht nutzt die schon vorhandenen Bewegungsdaten; er kostet keine neue Speicherung und keinen neuen Serverweg. Referenzen: Kanbanflow, Jira, Kanboard (Kartenherkunft, PO-Beratung 2026-11-03).

## Funktionale Anforderungen

### Name und Ort
- Menüeintrag „Kumulativer Fluss“ in der Gruppe **VERLAUF** zwischen „Burndown“ und „Wie lange noch“, mit einem eigenen Symbol (drei gestapelte Flächen) und der Beschreibung „Bestand je Spalte über die Zeit – gestapelte Bänder aus der Git-Geschichte dieses Boards.“ Route `#/berichte/fluss`, Fenstertitel „Fluss — kanbanD“, verborgene Überschrift „Berichte · Kumulativer Fluss“ (`web/seitenname.js`).
- Sichtbare Texte des Berichts sagen „Aufgaben“, nicht „Karten“, wie Menü und übrige Berichte.

### Rechnung
- Grundlage sind je Aufgabe die Spaltenwechsel aus der Git-Geschichte des Boards (R00042, `/api/berichte/bewegungen`); die Rechnung läuft im Browser (pure Funktion), wie Burndown und Durchlaufzeit.
- **Ein Stützpunkt je Kalendertag** im Zeitraum, jeweils der **Stand am Tagesende**; heute der Stand jetzt. Kein Tag vor dem ersten Stand des Boards und keiner nach heute.
- **Ein Band je Spalte** des Boards je Tag. Die Dicke des Bandes ist die Zahl der Aufgaben, die am Tagesende in dieser Spalte liegen. Die Bänder werden in der Reihenfolge der Board-Spalten gestapelt, **unten die erste Spalte** (in der Regel „Eingang“), **oben die letzte** (Abschlussspalte).
- **Abschlussspalte als Band**: die letzte Spalte ist ein eigenes Band wie jede andere (oberstes). Der obere Rand dieses Bandes ist die kumulierte Zahl der fertigen Aufgaben.
- **Kumulierte Ränder**: der obere Rand der ganzen Stapelfläche ist die Zahl der Aufgaben, die an diesem Tag auf dem Board liegen (Summe aller Bänder). Daraus werden zwei Linien gebildet und beschriftet:
  - **„angekommen“** (oberer Rand der Kumulation): Aufgaben, die bis zum Tagesende mindestens einmal auf dem Board waren (erster Wechsel mit einer Spalte ≠ `null`). Steigt mit jeder Ankunft; eine Aufgabe, die das Board verlässt, senkt den oberen Rand der Stapelfläche, nicht „angekommen“.
  - **„fertig“**: Aufgaben, die bis zum Tagesende in der Abschlussspalte liegen oder lagen.
- **Zählen** wie im Burndown: eine Aufgabe zählt an einem Tag, wenn sie an diesem Tag in einer gezählten Spalte liegt und zu den Filtern der Berichte passt. Eine Aufgabe, die das Board verlässt (archiviert, „vom Board genommen“), fällt ab diesem Tag aus dem Stapel; eine Aufgabe, die nie auf dem Board war, zählt an keinem Tag.
- **Abschluss durch `reporting.burndown`**: `reporting.burndown: false` nimmt die Aufgabe aus dem Bericht (kein eigener `reporting`-Schlüssel; R00060 „neue Berichte bekommen später einen eigenen Schlüssel“ gilt als Ausbaustufe). Der Bericht nennt die so ausgenommene Zahl wie der Burndown unter „Nicht enthalten“.
- **Filter und „Rechnen ab“** (R00081): Zeitraum, ausgeschlossene Klassen, ausgeschlossene Spalten, Personen (zuständig) und Labels schränken die gezählten Aufgaben ein. „Rechnen ab“ (`board.start`) schneidet den Anfang ab wie beim Burndown. Die **Messbasis** wirkt nicht (sie gehört zur Prognose).

### Darstellung
- **Kopfleiste** „Kumulativer Fluss · liest nur · Bestand je Spalte über die Zeit“.
- **Flächendiagramm** (SVG, `role="img"`): y-Achse mit Ticks und Gitter (Zahl der Aufgaben), x-Achse mit Tagen (Datum mit Jahr, wie die übrigen Berichte). Gestapelte Bänder in Board-Reihenfolge, Farbe je Spalte die eingestellte Spaltenfarbe (`column-colors`), sonst ein fester Ton je Position; die beiden kumulierten Ränder („angekommen“, „fertig“) sind beschriftet.
- **Legende** unter der Fläche: je Spalte in Board-Reihenfolge ein Farbfeld und der Spaltenname, danach „angekommen“ und „fertig“. Farbe wird nie allein verwendet: Legende, Tooltip und Tabellenansicht nennen jede Spalte mit Namen und Zahl.
- **Tooltip**: beim Zeigen auf einen Tag nennt er das Datum, je Spalte die Zahl und die Summe „offen“ (Aufgaben unterhalb der Abschlussspalte) und „gesamt“ (Aufgaben auf dem Board).
- **Tabellenansicht** (`<details>`): je Tag eine Zeile mit einer Spalte je Board-Spalte und am Ende „offen“ und „gesamt“ (die textliche Entsprechung der Fläche, mit `th scope`).
- **Leerzustand**: keine Aufgabe im Zeitraum → statt der Fläche „Keine Aufgabe im Zeitraum.“ (Wortlaut wie der Burndown); hat das Board noch keine Bewegung → „Noch kein Stand dieses Boards.“ Ist der Leerzustand durch aktive Filter entstanden, steht darunter der Knopf „Zurücksetzen“ der Filterleiste.
- **Schmales Layout** (375 px, dazu 320 und 414 px): die Seite scrollt nicht quer; die Fläche skaliert mit ihrer Breite, die Achsenbeschriftung wird ausgedünnt (nicht mehr als acht Datumsmarken).

### Bedienung
- Die gemeinsame **Filterleiste der Berichte** (R00081) steht über dem Bericht und zeigt für ihn die Gruppe Zeitraum und die Ausschlüsse (Klassen, Spalten, Zuständige, Labels), wie beim Burndown.
- **„Zurücksetzen“** hebt genau die Filter auf, die die Leiste dieses Berichts zeigt und als aktiv zählt (`filterZuruecksetzen`/`bf-leeren`, Regel aus PO Z. 106). Zeitraum, Messbasis und „Rechnen ab“ bleiben in der Board-Datei stehen, wo die Leiste sie nicht zeigt.

### Live
- Der Bericht rechnet bei jeder Änderung im Ordner neu, wie das Board (D00005). Eine über die API angelegte oder verschobene Aufgabe verändert die Bänder ohne Neuladen.

## Nicht-funktionale Anforderungen

- **Performance**: 500 Aufgaben, 90 Tage und 10 Spalten sind in unter 300 ms gerechnet und gezeichnet (headless Chromium). Die Rechnung läuft im Browser über Daten, die mit dem Bericht schon geladen sind.
- **Barrierefreiheit**: die Fläche ist ein `role="img"` mit einem `aria-label` „Kumulativer Fluss: Bestand je Spalte je Tag“; die vollständige Information steht in der Tabellenansicht als `<table>` mit `th scope`; die Farbe wird nie allein verwendet.

## Akzeptanzkriterien

**Grundbestand für die Beispiele** (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (letzte Spalte = Abschlussspalte). Bewegungen aus Commits: 2026-11-01 #1 in „Eingang“ angelegt; 2026-11-02 #2 in „Eingang“ angelegt, #1 nach „In Arbeit“; 2026-11-03 #3 in „Eingang“ angelegt, #2 nach „In Arbeit“, #1 nach „Fertig“; 2026-11-04 #4 in „Eingang“ angelegt, #3 nach „In Arbeit“, #2 nach „Fertig“; 2026-11-05 #2 vom Board genommen, #3 nach „Fertig“, #4 nach „In Arbeit“. In der Filterleiste steht der Zeitraum 01.11.–05.11.2026.

### Rechnung
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann zeigt er fünf Tage mit diesen Bändern (Eingang · In Arbeit · Fertig): 01.11. 1·0·0 (gesamt 1, angekommen 1, fertig 0), 02.11. 1·1·0 (2, 2, 0), 03.11. 1·1·1 (3, 3, 1), 04.11. 1·1·1 (3, 4, 2), 05.11. 0·1·1 (2, 4, 2); „offen“ am 03.11. ist 2 (alles außer „Fertig“)
- [ ] Grenzwert verlassen: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann fällt der obere Rand der Stapelfläche von 3 (04.11.) auf 2 (05.11.), weil #2 das Board verlassen hat, während „angekommen“ bei 4 und „fertig“ bei 2 bleiben
- [ ] Ausgeschlossene Spalte: Gegeben der Grundbestand und die Filterleiste schließt die Spalte „In Arbeit“ aus, wenn der Bericht geöffnet wird, dann zeigt der 03.11. Eingang 1 · Fertig 1 (gesamt 2) und der 05.11. Eingang 0 · Fertig 1 (gesamt 1); Aufgaben, die nur in „In Arbeit“ liegen, zählen an diesen Tagen nicht
- [ ] Zeitraum: Gegeben der Grundbestand und der Zeitraum 03.11.–04.11.2026, wenn der Bericht geöffnet wird, dann hat er genau zwei Stützpunkte (03.11. und 04.11.), und die Aufgabe vom 01./02.11. (#1) verfälscht die Kumulation nicht
- [ ] Ausnahme durch `reporting`: Gegeben der Grundbestand und `PATCH /api/aufgaben/3 {reporting: {burndown: false}}`, wenn der Bericht geöffnet wird, dann zählt #3 an keinem Tag (03.11. Eingang 0 · In Arbeit 1 · Fertig 1, gesamt 2), „angekommen“ am 03.11. ist 2 statt 3, und unter dem Bericht steht „Nicht enthalten: ausgenommen 1.“
- [ ] Leer: Gegeben der Grundbestand und die Filterleiste schließt alle drei Spalten aus, wenn der Bericht geöffnet wird, dann steht statt der Fläche „Keine Aufgabe im Zeitraum.“ mit dem Knopf „Zurücksetzen“
- [ ] Kein Stand: Gegeben ein Board ohne jede Bewegung, wenn der Bericht geöffnet wird, dann steht „Noch kein Stand dieses Boards.“

### Darstellung
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann steht in der Kopfleiste „Kumulativer Fluss · liest nur · Bestand je Spalte über die Zeit“, trägt die Fläche das `aria-label` „Kumulativer Fluss: Bestand je Spalte je Tag“, und die y-Achse reicht bis 3 (höchster Tagesstand)
- [ ] Bänder und Reihenfolge: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann stehen die Bänder von unten nach oben „Eingang“, „In Arbeit“, „Fertig“, hat am 01.11. genau „Eingang“ die Dicke 1, am 03.11. jedes der drei Bänder die Dicke 1, und am 05.11. „In Arbeit“ und „Fertig“ je die Dicke 1 bei leerem „Eingang“
- [ ] Legende und Farbe nie allein: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann steht unter der Fläche eine Legende mit den Einträgen „Eingang“, „In Arbeit“, „Fertig“, „angekommen“, „fertig“ in dieser Reihenfolge; ein Klick auf einen Eintrag ändert weder Fläche noch Filter
- [ ] Tooltip und Tabellenansicht: Gegeben der Grundbestand, wenn der Zeiger auf dem 04.11. steht oder die Tabellenansicht geöffnet wird, dann nennt der Tooltip „04.11.2026 · Eingang 1 · In Arbeit 1 · Fertig 1 · offen 2 · gesamt 3“, und die Tabelle hat je Tag eine Zeile mit diesen Spalten und Summen
- [ ] Menü: Gegeben der Grundbestand, wenn das Menü „Berichte“ geöffnet wird, dann steht in der Gruppe VERLAUF zwischen „Burndown“ und „Wie lange noch“ der Eintrag „Kumulativer Fluss“ mit Symbol und der Beschreibung „Bestand je Spalte über die Zeit – gestapelte Bänder aus der Git-Geschichte dieses Boards.“; der Fenstertitel ist „Fluss — kanbanD“
- [ ] Schmales Layout: Gegeben der Grundbestand, wenn die Fensterbreite auf 375 px (und 320 bzw. 414 px) gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth`, die Fläche passt in die Breite, und die x-Achse zeigt höchstens acht Datumsmarken

### Filterleiste und Ablage
- [ ] Gegeben der Grundbestand und ein gespeicherter Zeitraum „letzte Woche“, wenn „Zurücksetzen“ gedrückt wird, dann hebt der Knopf Klassen, Spalten, Zuständige und Labels auf, der Zeitraum bleibt in `boards/fabrik.md` stehen (Datei-`sha256` vorher = nachher bis auf die aufgehobenen Filter), und der Bericht „Burndown“ zeigt weiter „letzte Woche“
- [ ] Gegenprobe schreiben: Gegeben der Grundbestand, wenn der Bericht geöffnet, angesehen und wieder verlassen wird, dann ist `boards/fabrik.md` byte-gleich und `git log` unverändert (der Bericht liest nur)

### Live
- [ ] Gegeben der Bericht ist offen und zeigt am letzten Tag „gesamt 3“, wenn über die API eine Aufgabe `POST /api/boards/fabrik/aufgaben {nummer: 1}` (oder ein Zug) die Stände ändert und das Live-Ereignis eintrifft, dann sind die Bänder ohne Neuladen spätestens 1 s nach der Antwort der API aktualisiert (D00005)

### Nicht-funktional
- [ ] Gegeben 500 Aufgaben, 90 Tage und 10 Spalten, wenn der Bericht geöffnet wird, dann sind Rechnung und Zeichnen zusammen in unter 300 ms fertig, gemessen von der Rechnung bis die Fläche im Dokument steht (headless Chromium)
- [ ] Gegeben der Grundbestand, wenn der Bericht mit einem Screenreader-Baum gelesen wird, dann hat die Fläche ein `role="img"` mit dem genannten `aria-label`, und die Tabellenansicht ist eine `<table>` mit `th scope="col"`; keine Information hängt allein an der Farbe

## Betroffene Verzeichnisstruktur

Rechnung als reine Funktion in `web/berichte.js` (im Browser und mit Node-Unit-Tests nutzbar, neben `burndown`), Ansicht in `web/ansicht.js` neben `vVerlauf`, Menüeintrag im Berichte-Menü (`web/ansicht.js`), Name und Fenstertitel in `web/seitenname.js` und `web/app.js`, Gestaltung in `web/kd-app.css`. **Kein Serverweg, kein neuer Endpunkt, keine neue Ablage.** Die Tests liegen unter `e2e/einheit/berichte.test.js` und `e2e/tests/r00121-fluss.spec.js`.

## Technische Überlegungen

### Ablauf
1. **Bewegungen laden**: `S.bew` (wie Burndown/Prognose, `web/app.js:247`).
2. **Rechnen** (pure): `fluss(bew, filter, aufgabeZu, jetzt, start)` → `{tage: [{datum, jeSpalte, gesamt, offen, angekommen, fertig}], spalten}`.
3. **Zeichnen**: gestapelte Bänder, y- und x-Achse, zwei beschriftete Ränder, Legende, Tooltip, Tabellenansicht; bei gesamt 0 der Leerzustand.
4. **Filtern**: die gemeinsame Filterleiste (`vBerichtsfilter('fluss')`) mit Zeitraum und Ausschlüssen.

### Grobentwurf

**Wichtige Einstiegsstellen:** Menü „Berichte“, Route `#/berichte/fluss`.

- `fluss(bew, f, aufgabeZu, jetzt, start)` (pure, JS) — die Tagesstände, Bänder und die beiden kumulierten Ränder
- `flussRand(tage, schluessel)` (pure, JS) — Tageswerte eines Bandes oder Randes
- `flussName(datum, stand, spalten)` (pure, JS) — Tooltiptext eines Tages
- `vFluss()` (Ansicht)

### Änderungen an bestehenden Klassen
- Keine. Die Bewegungen (R00042) und die gemeinsame Filterleiste (R00081) werden unverändert genutzt; `reporting` wird ohne neue Schlüssel gelesen.

## Tests

**Unit (JS, Node):** `fluss` mit dem Rechenbeispiel der AK (Tag 1–5, verlassen, ausgeschlossene Spalte, Zeitraum, `reporting.burndown: false`, leer), `flussName`.
**E2E:** Bericht öffnen, Bänder, Reihenfolge und Ränder prüfen, Legende, Tooltip und Tabellenansicht, Menü und Fenstertitel, schmales Layout, Leerzustände, Live, Leistung, Screenreader-Baum, `boards/fabrik.md` und `git log` unverändert.

## Abhängigkeiten
- Abhängig von: R00042 (Bewegungen), R00081 (Berichtsfilter am Board)
- Gestaltung: **ux-Vorprüfung** vor dem Bau und Artboard **D0006** „Kumulativer Fluss“ (gestalter, `/wireframe verfeinern D0006`), freigegeben vor dem Bau der Oberfläche (`AI-Team/po-entscheidungen.md`, Vision-Leitplanke „Jede Gestaltung wird freigegeben“).
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockiert. Empfehlungen des planers (Entscheidungen im Bericht, im Dokument eingearbeitet): gestapeltes Bestand-CFD mit zwei kumulierten Rändern; **Spalten** statt Phasen (Phasen als Ausbaustufe); **kein** neuer `reporting`-Schlüssel, der Bericht folgt `reporting.burndown`; archivierte und „verworfene“ Aufgaben zählen nur an den Tagen, an denen sie auf dem Board lagen; Abschlussspalte als oberstes Band; Granularität **je Tag**. Die Richtungsfrage „Spalten oder Phasen“ und der Name des Menüeintrags liegen dem PO zur Bestätigung vor; sie ändern den Bau nicht.

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass die vorhandenen Berichte den Fluss nur als eine Zahl je Tag (Burndown) oder je Spalte (Prognose) zeigen. Wer wissen will, **wo** Arbeit liegen bleibt, muss heute mehrere Zahlen im Kopf gegeneinander lesen. Das CFD macht daraus ein Bild: Ein wachsendes Band ist die Engstelle, ein dünner Durchsatz am rechten Rand zeigt stockenden Abschluss. Der Hebel sind die Bewegungen, die kanbanD ohnehin aus der Git-Geschichte rechnet — es braucht kein neues Datenfeld, keinen neuen Endpunkt und keinen Cache. Die Wirkungskette: vorhandene Bewegungen → gestapelte Bänder je Spalte → sichtbare Engstelle → der Mensch verschiebt Arbeit statt sie zu vermuten.

## Missing-Docs
- Ob der Bericht später auch **je Phase** (R00058) statt je Spalte rechnen soll, ist in keiner Anforderung beschrieben. Der planer empfiehlt Spalten jetzt und Phasen als eigene Ausbaustufe; die Frage ist an den PO gegangen.

## Notizen

**Optionen-Tableau (Skill `optionen-vor-entscheidung`):**
- **A — gestapeltes Bestand-CFD je Spalte mit zwei kumulierten Rändern** (empfohlen): ein Stützpunkt je Tag, Bänder je Spalte, Abschlussspalte oben, Ränder „angekommen“/„fertig“. Bekannteste CFD-Form, direkt aus den Bewegungen lesbar.
- **B — reine kumulierte Ankunft/Abschluss als zwei Linien** (keine Bänder): einfacher, aber die Engstelle zwischen den Spalten verschwindet.
- **C — Stapel je Spalte ohne kumulierte Ränder**: zeigt nur den Bestand, nicht die Kumulation; der Name „kumulativ“ wäre irreführend.
Verworfen: B und C. Begründung: Das genannte Problem ist die Engstelle (A zeigt sie), und „kumulativ“ verlangt die Ränder.

**Verworfene Alternativen**
- *Eigener Endpunkt oder Cache*: Der Browser hat die Bewegungen schon geladen; ein Endpunkt brächte nichts (Architektur bestanden 2026-11-11, keine Technikfrage).
- *Neuer `reporting.cfd`-Schlüssel*: wäre eine neue Datenform; R00060 lässt ihn für später offen. Jetzt entscheidet `reporting.burndown` mit.
- *Rechnung je Woche/Monat als Standard*: für die Engstellenerkennung ist der Tag der passende Blick; Woche/Monat ist ein späterer Zusatz.

**Verwiesenes**
- Kernpunkte der Beratung product-owner 2026-11-03 (übliche Kanban-Funktionen, die fehlen), Priorität hoch; Kartenherkunft #29.
