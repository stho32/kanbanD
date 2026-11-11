---
id: R00122
status: Neu
datum: 2026-11-11
---

# R00122: Bericht „Durchsatz je Zeitraum“

## Beschreibung

Ein neuer Bericht im Menü „Berichte“ zeigt den **Durchsatz** eines Boards als **Balkendiagramm**: je Kalenderperiode (Tag, Woche oder Monat) ein Balken, dessen Höhe die Zahl der Aufgaben ist, die in dieser Periode das **Ziel** erreicht haben. Ziel ist die **Abschlussspalte** (bei einem an eine Anwendung gebundenen Board: die **letzte Phase**) — dieselbe Bedeutung von „erledigt“, die auch die Prognose („Wie lange noch“) und das Fever Chart ohne eigene Zielwahl verwenden. Eine gestrichelte **Durchsatz-Rate** (Ø je Periode) macht das Niveau lesbar, statt es aus vielen Balken abzulesen. So beantwortet der Bericht die Frage „**wie viel geht durch**“ für einen Zeitraum, die bisher nur als eine Zahl in der Prognose verrechnet wird (`web/berichte.js:311`, „Durchsatz Ø … je Kalendertag“).

Der Bericht rechnet im **Browser** aus den Bewegungen des Boards (`GET /api/berichte/bewegungen`, R00042), wie Burndown, Durchlaufzeit und Bestand; die gemeinsame Filterleiste der Berichte (R00081) gilt. Er schreibt nichts und braucht keine neue Ablage und keinen neuen Endpunkt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen rechnen aus dem, was geschehen ist“, „Git als Archiv inklusive Zeiten“.

### Domänenbezug
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Burndown beantwortet „wie viel ist noch offen“, die Prognose „wann sind wir fertig“. Der Durchsatz beantwortet die Frage dazwischen: „**wie viel geht durch**“. Wer den Durchsatz je Woche kennt, sieht, ob das Team schneller oder langsamer wird, und kann eine Prognose einordnen: Eine Prognose von fünf Wochen ist trügerisch, wenn der Durchsatz zuletzt auf einen halben Balken je Woche gefallen ist. Der Bericht nutzt die schon vorhandenen Bewegungsdaten; er kostet keine neue Speicherung und keinen neuen Serverweg. Ist-Zeiten rechnet er nicht ein (KanbanD kennt keine Ist-Zeiten-Datei), also misst er in Aufgaben je Periode, nicht in Stunden. Referenzen: Kanbanflow („Throughput“), Jira („Control Chart / Throughput“), Kanboard (Kartenherkunft, PO-Beratung 2026-11-03).

## Funktionale Anforderungen

### Name und Ort
- Menüeintrag „Durchsatz“ in der Gruppe **VERLAUF** zwischen „Kumulativer Fluss“ (R00121) und „Wie lange noch“, mit einem eigenen Symbol (Balken) und der Beschreibung „Erledigte Aufgaben je Zeitraum – Balken aus der Git-Geschichte dieses Boards.“ Route `#/berichte/durchsatz`, Fenstertitel „Durchsatz — kanbanD“, verborgene Überschrift „Berichte · Durchsatz“ (`web/seitenname.js`), Tastenkürzel `g u` wie die übrigen Board-Berichte (`web/tastatur.js`, `G_ZIELE`).
- **Verdrahtung** (M9): `web/seitenname.js` `BERICHTSNAMEN.durchsatz = 'Durchsatz'`; Fenstertitel-Map `seiten` in `web/app.js:963`; Kürzel `G_ZIELE.u = '#/berichte/durchsatz'` in `web/tastatur.js`; **Bewegungs-Ladeliste** `web/app.js:248` auf `/^berichte\/(verlauf|fluss|durchlauf|prognose|fieber|durchsatz)$/` erweitern — fehlt der Eintrag, bleibt `S.bew` null und der Bericht zeigt dauerhaft „lädt …“.
- **Eigenes Symbol** (S5): ein Balken im 24er-Raster, Strich 2, `currentColor`, unterscheidbar vom Fluss-Symbol (drei gestapelte Flächen) und vom Burndown-Symbol (eine Linie).
- Sichtbare Texte des Berichts sagen „Aufgaben“, nicht „Karten“, wie Menü und übrige Berichte.

### Rechnung
- Grundlage sind je Aufgabe die Spaltenwechsel aus der Git-Geschichte des Boards (R00042, `/api/berichte/bewegungen`); die Rechnung läuft im Browser (pure Funktion), wie Burndown und Bands.
- **Ziel**: eine Aufgabe hat das Ziel erreicht, sobald sie die Abschlussspalte „erreicht“ hat; „erreicht“ heißt dort **oder rechts davon** (die Abschlussspalte ist die letzte, also genügt der erste Wechsel in sie). Ist das Board an eine Anwendung mit Phasen gebunden (R00058), gilt dieselbe Bedeutung je **letzter Phase** („durchlaufen“). Es zählt das **erste** Erreichen, wie im Durchsatz der Prognose.
- **Eine Periode je Kalendereinheit** der gewählten **Auflösung** (Tag, Woche, Monat; Standard Woche). Wochen beginnen am Montag (Mo–So, wie `wochenbeginn`), Monate sind Kalendermonate. Der Bereich reicht von der ersten Bewegung auf dem Board (oder „Rechnen ab“, falls später) bis heute; Randperioden zählen nur bis heute, eine angebrochene letzte Woche zählt die Ankünfte bis heute.
- **Ein Balken je Periode**: die Zahl der Aufgaben, deren erstes Erreichen des Ziels in diese Periode fällt und die zur Filterleiste passen. Eine Aufgabe zählt in **genau einer** Periode (ihrer Ankunft), nie mehrfach.
- **Durchsatz-Rate**: Ø je Periode = Gesamtzahl ÷ Anzahl der dargestellten Perioden (einschließlich leerer), wie der Durchsatz der Prognose (`daten.length / reihe7.length`). Der Bericht nennt Gesamt, Ø und Anzahl der Perioden.
- **Abschluss durch `reporting`**: der Bericht folgt `reporting.forecast` — `reporting.forecast: false` nimmt die Aufgabe aus der Zählung (kein eigener `reporting`-Schlüssel; R00060 „neue Berichte bekommen später einen eigenen Schlüssel“ gilt als Ausbaustufe). Der Bericht nennt die so ausgenommene Zahl wie der Burndown unter „Nicht enthalten: ausgenommen n“.
- **Filter und „Rechnen ab“** (R00081): Zeitraum, ausgeschlossene Klassen, ausgeschlossene Spalten, Personen (zuständig) und Labels schränken die gezählten Aufgaben ein; zusätzlich wirken sie auf die **Zielspalte** — ist das Ziel vom Filter ausgeschlossen, gibt es keine Aussage (Hinweis statt Balken). „Rechnen ab“ (`board.start`) schneidet den Anfang ab. Die **Messbasis** wirkt nicht (sie gehört zur Prognose), wie beim Burndown.
- **Filterleiste dieses Berichts** (M10): sie zeigt Zeitraum und die Ausschlüsse (Farben/Klassen, Spalten, Zuständige, Labels) wie beim Burndown. `BERICHTSLEISTEN.durchsatz = { start: true, zeitraumBleibt: true, spalten: true, personen: 'zustaendig' }` — „Zurücksetzen“ hebt Klassen, Spalten, Zuständige und Labels auf; **Zeitraum und „Rechnen ab“ bleiben** in der Board-Datei. Nicht `zeitraum: true` wie der Burndown: dort räumt `filterZuruecksetzen` den Zeitraum weg, und „Zurücksetzen <n>“ zählt ihn mit, obwohl er bleiben soll.

### Darstellung
- **Kopfleiste** „Durchsatz je Zeitraum · liest nur · erledigte Aufgaben je Periode“.
- **Balkendiagramm** (SVG, `role="img"`): y-Achse mit Ticks und Gitter (Zahl der Aufgaben); je Periode ein Balken in der Akzentfarbe. **x-Achse je Auflösung** (M1): **Tag** = Tagesdatum mit Jahr wie die übrigen Berichte; **Woche** = `KW<nn>` (ISO, Mo–So) mit Jahr, optional darunter `TT.MM.–TT.MM.`; **Monat** = Monatsname mit Jahr. Höchstens acht Periodenmarken. Die Fläche zeichnet eine **Grundlinie** über die volle Plotbreite; jede dargestellte Periode hat eine Marke, auch bei Wert 0 (M2). Eine gestrichelte, **beschriftete** **Ø-Linie** („Ø <x> je <Einheit>“) liegt auf der Höhe der Rate, in einer von der Balkenfarbe abweichenden Farbe; ihre Beschriftung trägt einen Halo (`paint-order:stroke`, Strich in `--kd-surface`, wie `.cfd .randtext`) — dadurch bleibt sie auch dann unterscheidbar, wenn sie auf den Balkenkanten liegt (Grundbestand Ø 2,0) (M2/S1).
- **Auflösung** (M3): Umschalter über der Fläche mit zugänglichem Namen „Auflösung“ und sichtbarem Auswahlzustand (Muster `<select aria-label="Auflösung">` wie der Fever Chart oder `.seg role="radiogroup"`/`role="radio"`/`aria-checked` wie der Stundenzettel), per Tastatur bedienbar (Pfeiltasten/Enter, Tab), Standard **je Woche**. Das Umschalten gruppiert nur um (die zugrunde liegenden Ankünfte sind dieselben), aktualisiert Balken und Kennzahlen und schreibt nichts.
- **Kennzahlen** (M4): eine Zeile unter der Kopfleiste mit „Gesamt <n>“ · „Ø <x> je Tag|je Woche|je Monat“ · „<k> Perioden“; dazu „Nicht enthalten: ausgenommen <n>“, wenn `reporting` Aufgaben ausnimmt. Die Einheitenwörter und die Periodenzahl wechseln mit der Auflösung (je Tag „10 Perioden“, je Monat „1 Periode“).
- **Tooltip**: beim Zeigen auf einen Balken nennt er die Periode („Woche 02.–08.11.2026“ bzw. „04.11.2026“, „November 2026“) und die Zahl.
- **Tabellenansicht** (M5): `<details>` mit je Periode einer Zeile „<Periode> · <Zahl>“, am Ende „Summe“ als `<th scope="row">`; alle Zahlen auch hier, kein Wert steht nur im Tooltip. Die Tabelle steht in einem tastaturerreichbaren Querscroll-Rahmen `.bericht-rahmen` (`tabindex="0" role="group"`, `aria-label`); der `<summary>` ist tastaturerreichbar und mindestens 24 px hoch (44 px auf dem Telefon).
- **Zustände** (M7): keine gezählte Aufgabe im Zeitraum → statt der Fläche „Keine Aufgabe im Zeitraum.“ (Wortlaut wie Burndown und Fluss; bei aktiven Filtern mit dem Knopf „Zurücksetzen“); hat das Board noch keine Bewegung → „Noch kein Stand dieses Boards.“; sind die Bewegungen noch nicht geladen → „lädt …“; ist die Zielspalte ausgeschlossen → „Die Zielspalte „<Spalte>“ ist ausgeschlossen.“; nimmt `reporting` Aufgaben aus → unter dem Bericht „Nicht enthalten: ausgenommen <n>“. Jeder Zustand mit Filterrückweg.
- **Schmales Layout** (M8; 375 px, dazu 320 und 414 px): die Fläche ist ein SVG mit `viewBox` und `width:100%;height:auto`; Kopfleiste und Kennzahlenzeile brechen um (`flex-wrap`); bei 320/375/414 px ist `document.documentElement.scrollWidth ≤ clientWidth`; die Achsenbeschriftung wird ausgedünnt — **garantiert höchstens acht Periodenmarken** (nicht die geerbte `i % Math.ceil(n/8)`-Formel, die neun Marken liefern kann) (S2).
- **Zielgrößen** (M6): alle Bedienelemente dieses Berichts sind mindestens 24 × 24 px groß; bei `pointer: coarse` (Telefon) der Auflösungs-Umschalter, die Filter-Chips, der `<summary>` und „Zurücksetzen“ 44 px hoch.

### Bedienung
- Die gemeinsame **Filterleiste der Berichte** (R00081) steht über dem Bericht und zeigt für ihn die Gruppe Zeitraum und die Ausschlüsse (Klassen, Spalten, Zuständige, Labels), wie beim Burndown.
- **„Zurücksetzen“** hebt genau die Filter auf, die die Leiste dieses Berichts zeigt und als aktiv zählt (`filterZuruecksetzen`/`bf-leeren`, Regel aus PO Z. 106). Die Leiste zeigt den Zeitraum, zählt ihn aber nicht mit; `zeitraumBleibt: true` lässt ihn samt „Rechnen ab“ in der Board-Datei stehen (M10).
- Der Bericht **liest nur**: ein Klick auf einen Balken öffnet keine Aufgabe und ändert keinen Filter.

### Live
- Der Bericht rechnet bei jeder Änderung im Ordner neu, wie das Board (D00005). Eine über die API angelegte oder verschobene Aufgabe verändert die Balken ohne Neuladen.

## Nicht-funktionale Anforderungen

- **Performance**: 500 Aufgaben, 90 Tage und 10 Spalten sind in unter 200 ms gerechnet und gezeichnet (headless Chromium). Die Rechnung läuft im Browser über Daten, die mit dem Bericht schon geladen sind.
- **Barrierefreiheit**: die Fläche ist ein `role="img"` mit dem `aria-label` „Durchsatz je Zeitraum: erledigte Aufgaben je Periode“; die vollständige Information steht in der Tabellenansicht als `<table>` mit `th scope="col"` (Summenzeile `th scope="row"`) im tastaturerreichbaren Rahmen `.bericht-rahmen`. Der Durchsatz hängt an keiner Farbe allein (Balken, Ø-Linie und Tabelle nennen die Zahlen); eine eigene Legende ist optional, weil die Tabelle alle Zahlen trägt und die Ø-Linie ihren Text trägt (S1).

## Akzeptanzkriterien

**Grundbestand für die Beispiele** (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (letzte Spalte = Abschlussspalte). Bewegungen aus Commits: 2026-11-02 (Mo) #1 in „Eingang“ angelegt; 2026-11-03 #2 in „Eingang“ angelegt, #1 nach „In Arbeit“; 2026-11-04 #1 nach „Fertig“, #3 in „Eingang“ angelegt; 2026-11-05 #2 nach „Fertig“; 2026-11-06 #3 nach „In Arbeit“; 2026-11-09 (Mo) #4 in „Eingang“ angelegt, #3 nach „Fertig“; 2026-11-10 #2 vom Board genommen; 2026-11-11 #4 nach „Fertig“. In der Filterleiste steht der Zeitraum 02.11.–11.11.2026 (Auf­lösung Woche, Ziel Abschlussspalte).

### Rechnung
- [ ] Gegeben der Grundbestand, wenn der Bericht mit der Auflösung „je Woche“ geöffnet wird, dann hat er genau zwei Perioden (KW45 02.–08.11, KW46 09.–15.11.) mit den Zahlen 2 und 2, „Gesamt 4“, „Ø 2,0 je Woche“ und „2 Perioden“ (#1 am 04.11., #2 am 05.11., #3 am 09.11., #4 am 11.11.)
- [ ] Auflösung: Gegeben der Grundbestand, wenn auf „je Tag“ umgeschaltet wird, dann tragen der 04.11., der 05.11., der 09.11. und der 11.11. je den Wert 1, alle übrigen Tage der zehn Tage 02.–11.11. den Wert 0, und „Ø je Tag“ ist 0,4; auf „je Monat“ steht ein Balken „November 2026“ mit 4 und „Ø 4,0 je Monat“; die Kennzahlenzeile wechselt mit und lautet dann „10 Perioden“ bzw. „1 Periode“ (M4)
- [ ] Erstes Erreichen und ein Ziel je Aufgabe: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann zählt #3 am 09.11. (erste Ankunft in „Fertig“) und nicht schon am 06.11., wo es nach „In Arbeit“ kam
- [ ] Zielspalte ist die Abschlussspalte, bei gebundenem Board die letzte Phase: Gegeben der Grundbestand ohne Phasen, wenn der Bericht geöffnet wird, dann zählt #1 am 04.11. mit seinem ersten Erreichen der Abschlussspalte „Fertig“; Gegeben dasselbe Board mit `column-phases`, sodass „Fertig“ in der letzten Phase „Auslieferung“ liegt, wenn der Bericht geöffnet wird, dann zählt #1 mit dem ersten Durchlaufen von „Auslieferung“ (dieselbe Regel wie R00058/R00079)
- [ ] Zeitraum: Gegeben der Grundbestand und der Zeitraum 05.11.–11.11.2026, wenn der Bericht geöffnet wird, dann hat KW45 (nur bis 08.11.) den Wert 1 (nur #2 am 05.11.) und KW46 den Wert 2 (#3 am 09.11., #4 am 11.11.), und die Ankünfte vom 02.–04.11. zählen nicht
- [ ] Ausnahme durch `reporting`: Gegeben der Grundbestand und `PATCH /api/aufgaben/3 {reporting: {forecast: false}}`, wenn der Bericht geöffnet wird, dann ist KW45 2, KW46 1 (#4), „Gesamt 3“, und unter dem Bericht steht „Nicht enthalten: ausgenommen 1“
- [ ] Leer: Gegeben der Grundbestand und die Filterleiste schließt die Abschlussspalte „Fertig“ aus, wenn der Bericht geöffnet wird, dann steht statt der Fläche der Hinweis „Die Zielspalte „Fertig“ ist ausgeschlossen.“; Gegeben der Grundbestand und ein aktiver Label-Filter, zu dem keine Aufgabe passt, wenn der Bericht geöffnet wird, dann steht „Keine Aufgabe im Zeitraum.“ mit dem Knopf „Zurücksetzen“, und der Klick zeigt die Balken aus dem ersten Kriterium (M7/S4)
- [ ] Kein Stand: Gegeben ein Board ohne jede Bewegung, wenn der Bericht geöffnet wird, dann steht „Noch kein Stand dieses Boards.“; Gegeben die Bewegungen sind noch nicht geladen (`GET /api/berichte/bewegungen` steht aus), wenn der Bericht zeichnet, dann steht „lädt …“ (M7)

### Darstellung
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann steht in der Kopfleiste „Durchsatz je Zeitraum · liest nur · erledigte Aufgaben je Periode“, trägt die Fläche das `aria-label` „Durchsatz je Zeitraum: erledigte Aufgaben je Periode“, und die y-Achse reicht bis 2 (höchster Wochenwert)
- [ ] x-Achse je Auflösung (M1): Gegeben der Grundbestand, wenn die Auflösung „je Woche“ ist, dann stehen unter den Balken zwei **unterscheidbare** Periodenmarken „KW45“ und „KW46“ (ISO, Mo–So) mit Jahr, nicht zwei gleich aussehende Tagesdaten; bei „je Monat“ steht „November 2026“ (nicht „01.11. / 2026“)
- [ ] Balken und Ø-Linie: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann tragen KW45 und KW46 je einen Balken der Höhe 2, und die gestrichelte Linie steht bei 2,0 mit der Beschriftung „Ø 2,0 je Woche“
- [ ] Leere Periode und abgesetzte Ø-Linie (M2): Gegeben der Grundbestand plus US-3 (KW47 = 0), wenn der Bericht geöffnet wird, dann ist die leere KW47 an ihrer Periodenmarke ohne Öffnen der Tabelle als 0 erkennbar (Grundlinie, kein Balken), und die Ø-Linie ist bei Ø = Balkenhöhe (2,0) vom Balken unterscheidbar (abweichende Farbe/Halo)
- [ ] Tabelle und Tooltip: Gegeben der Grundbestand, wenn die Tabellenansicht geöffnet wird oder der Zeiger auf dem Balken der KW46 steht, dann hat die Tabelle eine Zeile „KW46 09.–15.11.2026 · 2“ und eine Summenzeile „Summe · 4“, und der Tooltip nennt „Woche 09.–15.11.2026 · 2“
- [ ] Zeigerlos erreichbar (M5): Gegeben der Grundbestand, wenn nur mit Tab und Enter bedient wird, dann ist der `.bericht-rahmen` mit dem Tab erreichbar, öffnet der `<summary>` die Tabellenansicht mit denselben Zahlen je Periode und in der Summenzeile, und der Screenreader-Baum enthält `role="img"` mit dem `aria-label` und `th scope="col"`
- [ ] Zielgrößen (M6): Gegeben die Fensterbreite 375 px mit Touch-Bedienung (`pointer: coarse`), wenn der Bericht geöffnet wird, dann sind der Auflösungs-Umschalter, der `<summary>` und jeder Filter-Chip mindestens 44 px hoch; ohne Touch mindestens 24 × 24 px
- [ ] Menü und Kürzel: Gegeben der Grundbestand, wenn das Menü „Berichte“ geöffnet wird, dann steht in der Gruppe VERLAUF zwischen „Kumulativer Fluss“ und „Wie lange noch“ der Eintrag „Durchsatz“ mit Symbol und der Beschreibung „Erledigte Aufgaben je Zeitraum – Balken aus der Git-Geschichte dieses Boards.“; der Fenstertitel ist „Durchsatz — kanbanD“, und die verborgene Überschrift lautet „Berichte · Durchsatz“; `g u` öffnet den Bericht, und nach dem Öffnen erscheinen Balken (nicht „lädt …“, die Route steht in der Bewegungs-Ladeliste `web/app.js:248`) (M9)
- [ ] Schmales Layout: Gegeben der Grundbestand, wenn die Fensterbreite auf 375 px (und 320 bzw. 414 px) gesetzt wird, dann ist `document.documentElement.scrollWidth ≤ clientWidth`, die Fläche passt in die Breite, und die x-Achse zeigt **garantiert** höchstens acht Periodenmarken (auch bei je Tag über 16 Perioden, M8/S2)

### Filterleiste und Ablage
- [ ] Gegeben der Grundbestand und ein gespeicherter Zeitraum „letzte Woche“, wenn „Zurücksetzen“ gedrückt wird, dann hebt der Knopf Klassen, Spalten, Zuständige und Labels auf, der Zeitraum bleibt in `boards/fabrik.md` stehen (Datei-`sha256` vorher = nachher bis auf die aufgehobenen Filter), und der Bericht „Burndown“ zeigt weiter „letzte Woche“
- [ ] Gegenprobe schreiben: Gegeben der Grundbestand, wenn der Bericht geöffnet, ein Balken angeklickt und der Bericht wieder verlassen wird, dann ist `boards/fabrik.md` byte-gleich und `git log` unverändert (der Bericht liest nur)

### Live
- [ ] Gegeben der Bericht ist offen und zeigt in KW46 den Wert 2, wenn über die API eine weitere Aufgabe nach „Fertig“ bewegt wird (z. B. `POST /api/boards/fabrik/bewegen {nummer: 5, spalte: „Fertig“}`) und das Live-Ereignis eintrifft, dann steht die Zahl der Periode ohne Neuladen spätestens 1 s nach der Antwort der API auf dem neuen Wert (D00005)

### Nicht-funktional
- [ ] Gegeben 500 Aufgaben, 90 Tage und 10 Spalten, wenn der Bericht geöffnet wird, dann sind Rechnung und Zeichnen zusammen in unter 200 ms fertig, gemessen von der Rechnung bis die Fläche im Dokument steht (headless Chromium)
- [ ] Gegeben der Grundbestand, wenn der Bericht mit einem Screenreader-Baum gelesen wird, dann hat die Fläche ein `role="img"` mit dem genannten `aria-label`, und die Tabellenansicht ist eine `<table>` mit `th scope="col"`; keine Information hängt allein an der Farbe

## Betroffene Verzeichnisstruktur

Rechnung als reine Funktion in `web/berichte.js` (im Browser und mit Node-Unit-Tests nutzbar, neben `burndown`), Ansicht in `web/ansicht.js` neben `vVerlauf`, Menüeintrag im Berichte-Menü (`web/ansicht.js`), Name und Fenstertitel in `web/seitenname.js` und `web/app.js`, Kürzel in `web/tastatur.js`, Gestaltung in `web/kd-app.css`. **Kein Serverweg, kein neuer Endpunkt, keine neue Ablage.** Die Tests liegen unter `e2e/einheit/berichte.test.js` und `e2e/tests/r00122-durchsatz.spec.js`.

**Wächter-Anpassungen** (Bericht kommt zum Menü hinzu):
- `e2e/einheit/seitenname.test.js:24` zählt die Berichte (`Object.keys(BERICHTSNAMEN).length`) — **9 → 10** (die ursprüngliche AK nannte „8 → 9“; real sind „Kumulativer Fluss“ R00121 und „Kosten“ R00105 schon enthalten); dazu ein Name-Fall „Durchsatz“.
- `e2e/tests/struktur-hilfen.js` (`BERICHTSNAMEN`, `BEREIT`, `SICHTEN`) und `e2e/tests/ansichten.js` (`BERICHTE`) um „durchsatz“/`vDurchsatz` ergänzen.
- `e2e/einheit/tastatur.test.js` um `g u` → `#/berichte/durchsatz` ergänzen; `web/app.js:248` lädt die Bewegungen für die Route, `web/app.js:963` führt den Seitennamen.

## Technische Überlegungen

### Ablauf
1. **Bewegungen laden**: `S.bew` (wie Burndown/Prognose, `web/app.js:248`).
2. **Rechnen** (pure): `durchsatz(bew, filter, aufgabeZu, jetzt, start, einheit)` → `{perioden: [{von, bis, anzahl}], einheit, gesamt, durchschnitt, ausgenommen}`.
3. **Zeichnen**: Balken je Periode, y- und x-Achse, Ø-Linie, Kennzahlenzeile, Tabelle, Tooltip; bei keiner gezählten Aufgabe der Leerzustand.
4. **Filtern**: die gemeinsame Filterleiste (`vBerichtsfilter('durchsatz')`) mit Zeitraum und Ausschlüssen.

### Grobentwurf

**Wichtige Einstiegsstellen:** Menü „Berichte“, Route `#/berichte/durchsatz`.

- `durchsatz(bew, f, aufgabeZu, jetzt, start, einheit)` (pure, JS) — Perioden und Balkenwerte, Gesamt und Rate
- `durchsatzZiel(bew, phasen)` (pure, JS) — die Zielspalte bzw. die letzte Phase und ihr Index
- `durchsatzName(periode, einheit)` (pure, JS) — Perioden-/Tooltiptext („Woche 09.–15.11.2026“)
- `vDurchsatz()` (Ansicht)

### Änderungen an bestehenden Klassen
- Keine. Die Bewegungen (R00042) und die gemeinsame Filterleiste (R00081) werden unverändert genutzt; `reporting` wird ohne neue Schlüssel gelesen. Aufgesetzt wird auf vorhandenen Bausteinen: `erreicht` (`web/berichte.js:145`), `tagesreihen`/`werktag`, `wochenbeginn` (`web/zeiten.js:39`, Mo–So wie der Stundenzettel), das Auflösungs-Muster „Tag/Woche/Monat“ aus dem Fever Chart (R00080) und das Menü-/Routen-Muster von R00045/R00121.

## Tests

**Unit (JS, Node):** `durchsatz` mit dem Rechenbeispiel der AK (je Woche, je Tag, je Monat, Ziel/erstes Erreichen, Zeitraum, ausgeschlossene Zielspalte, `reporting.forecast: false`, leer), `durchsatzZiel`, `durchsatzName`.
**E2E:** Bericht öffnen, Balken und Ø-Linie prüfen, Auflösung umschalten, Tabelle und Tooltip, Menü, Fenstertitel und `g u`, schmales Layout, Leerzustände, Live, Leistung, Screenreader-Baum, `boards/fabrik.md` und `git log` unverändert.

**Abnahme-Proben je Muss-Befund (UX-Vorprüfung #34; heute rot, nach dem Fix je grün):**
- **M1 x-Achse:** je Woche und zwei Perioden stehen unter den Balken zwei **unterscheidbare** Periodenmarken (KW-Nummer oder Datumsspanne), nicht zwei gleich aussehende Tagesdaten; je Monat „November 2026“.
- **M2 leere Periode/Ø:** im Grundbestand plus US-3 (KW47 = 0) ist die leere Periode an ihrer Marke ohne Öffnen der Tabelle als 0 erkennbar, und die Ø-Linie ist bei Ø = Balkenhöhe (2,0) vom Balken unterscheidbar (abweichende Farbe/Halo).
- **M3 Umschalter:** per Tab erreichbar, Name „Auflösung“, sichtbarer Auswahlzustand (`aria-checked`/`selected`), aktualisiert Balken und Kennzahlen ohne Neuladen; mit der Tastatur allein ist „je Monat → November 2026“ einstellbar.
- **M4 Kennzahlenzeile:** nach dem Umschalten auf „je Tag“ steht „Ø …,0 je Tag“ und „10 Perioden“, auf „je Monat“ „Ø 4,0 je Monat“ und „1 Periode“.
- **M5 zeigerlos:** nur mit Tab/Enter erreichbar; `<summary>` öffnet die Tabelle, die je Periode und in der Summenzeile dieselben Zahlen zeigt (KW46 09.–15.11.2026 · 2; Summe · 4); der Screenreader-Baum enthält `role="img"` mit dem `aria-label` und `th scope="col"`.
- **M6 Zielgrößen:** bei 375 px haben Auflösungs-Umschalter, `<summary>` und jeder Filter-Chip eine Höhe ≥ 44 px; bei Desktop ≥ 24 px.
- **M7 Zustände:** jeder der fünf Zustände (leer/kein Stand/lädt/Zielspalte ausgeschlossen/Filter ohne Treffer) zeigt genau seinen Text; der Leerzustand mit aktivem Label-Filter zeigt „Zurücksetzen“, ein Klick bringt die Balken zurück.
- **M8 Breite:** bei 320, 375 und 414 px kein Querscrollen der Seite (`scrollWidth ≤ clientWidth`), die Fläche passt in die Breite, Kopfleiste und Kennzahlen passen, die Marken sind ≤ 8.
- **M9 Verdrahtung:** `g u` öffnet `#/berichte/durchsatz`; Fenstertitel „Durchsatz — kanbanD“; verborgene Überschrift „Berichte · Durchsatz“; der Menüeintrag steht zwischen „Kumulativer Fluss“ und „Wie lange noch“; nach dem Öffnen erscheinen Balken (nicht „lädt …“).
- **M10 Filter:** mit gespeichertem Zeitraum „letzte Woche“ hebt „Zurücksetzen“ nur Farben/Spalten/Zuständige/Labels auf; der Zeitraum bleibt in `boards/fabrik.md`, und „Burndown“ zeigt weiter „letzte Woche“.

## Abhängigkeiten
- Abhängig von: R00042 (Bewegungen), R00081 (Berichtsfilter am Board)
- Gestaltung: **ux-Vorprüfung** vor dem Bau und Artboard **D0006** „Durchsatz je Zeitraum“ (gestalter, `/wireframe verfeinern D0006`), freigegeben vor dem Bau der Oberfläche (`AI-Team/po-entscheidungen.md`, Vision-Leitplanke „Jede Gestaltung wird freigegeben“) — der Bericht zeigt eine **neue Darstellung** (Balken und Rate), die es im Board noch nicht gibt. Die UX-Vorprüfung #34 liegt vor (10 Muss-Befunde M1–M10, oben eingearbeitet).
- **Bis zur Freigabe des Zustands „Durchsatz“ am Artboard D0006 warten** die gezeichneten Bubbles **B0564, B0565, B0566, B0567, B0568 und B0645** (Ansicht, Balken/Ø-Linie, Auflösung, Tabelle, Zustände, Breite/Zielgrößen). **Frei baubar** (reine Rechnung/Verhalten, nicht gezeichnet) sind **B0562, B0563, B0569 und B0570**.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockiert. Empfehlungen des planers (Entscheidungen im Bericht, im Dokument eingearbeitet):
- **Darstellung**: Balken je Periode mit einer gestrichelten **Ø-Linie** (Rate) und einer Kennzahlenzeile — die Zahl je Zeitraum ist ablesbar, das Niveau in einem Blick.
- **Auflösung**: Tag/Woche/Monat wählbar, Standard **Woche** (Kalenderwoche Mo–So, wie der Stundenzettel). Das ist der übliche Takt der Steuerung; Tag und Monat sind Umschaltungen derselben Rechnung.
- **Zielspalte/Ziel = Phase**: das **Ziel ist die Abschlussspalte** (bei gebundenem Board die **letzte Phase**), dieselbe Bedeutung wie in Prognose und Fever Chart ohne eigene Zielwahl. Eine **wählbare** Zielspalte (wie R00079) ist eine Ausbaustufe und bräuchte eine eigene Board-Einstellung; für „niedrig–mittel“ nicht nötig.
- **`reporting`**: der Bericht **folgt `reporting.forecast`**, kein eigener Schlüssel; R00060 lässt einen eigenen Schlüssel später zu (Ausbaustufe).
- **Kalenderfenster**: die Perioden sind **Kalenderfenster** (Tag/Woche/Monat) über den Zeitraum der Filterleiste; „Rechnen ab“ schneidet den Anfang, die **Messbasis wirkt nicht** (sie gehört zur Prognose). Eine angebrochene letzte Periode zählt bis heute.
- **Menügruppe und Kürzel**: Gruppe **VERLAUF** zwischen „Kumulativer Fluss“ und „Wie lange noch“ (der Durchsatz speist die Prognose daneben); Tastenkürzel **`g u`** (frei; `d` ist „Durchlaufzeit“).

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass der Durchsatz heute **nur als eine Zahl in der Prognose** steht (`web/berichte.js:311`) — „Durchsatz Ø … je Kalendertag“ — und sich nicht über die Zeit ansehen lässt. Wer wissen will, ob das Team gerade schneller wird, muss die Zahl auswendig mit gestern vergleichen; wer eine Prognose prüft, sieht nicht, ob der angenommene Durchsatz noch steht. Das Balkendiagramm macht aus der Zahl eine **Reihe**: Jede Periode zeigt ihr Pensum, die Ø-Linie ihr Niveau. Der Hebel sind die Bewegungen, die kanbanD ohnehin aus der Git-Geschichte rechnet — es braucht kein neues Datenfeld, keinen neuen Endpunkt und keinen Cache. Die Wirkungskette: vorhandene Bewegungen → erledigte Aufgaben je Periode → fallender Balken → der Mensch sieht den Einbruch und ordnet die Prognose neu ein, statt eine zu optimistische Zahl zu glauben.

## Missing-Docs

- Ob der Durchsatz später **je Spalte** (nicht nur auf die Abschlussspalte) oder **auf Stunden** gerechnet werden soll, ist in keiner Anforderung beschrieben. Der planer empfiehlt jetzt die Abschlussspalte in Aufgaben; eine andere Bezugsgröße ist eine Ausbaustufe.

## Notizen

**Einarbeitung UX-Vorprüfung #34 (2026-11-11, 10 Muss):** M1 x-Achse je Auflösung eindeutig (Tag „Datum mit Jahr“, Woche „KW KW-Jahr“/Datumsbereich, Monat „Monat Jahr“), M2 Grundlinie + jede Periode mit Marke (leere Periode als 0) und Ø-Linie abgesetzt/beschriftet (Grundbestand Ø 2,0 auf der Balkenkante), M3 Auflösungs-Umschalter mit zugänglichem Namen und Auswahlzustand, M4 Kennzahlenzeile folgt Einheit und Periodenzahl, M5 Tabellenansicht mit `th scope` und Summe im tastaturerreichbaren `.bericht-rahmen` (der einzige zeigerlose Weg), M6 Zielgrößen 24 px / 44 px Touch, M7 fünf Zustände (leer/kein Stand/lädt/ausgeschlossen/filter), M8 SVG skaliert und kein Querscrollen bei 320/375/414 px, M9 Verdrahtung samt Bewegungs-Ladeliste `web/app.js:248`, M10 `BERICHTSLEISTEN.durchsatz` mit `zeitraumBleibt: true`. Sollte: S1 Ø-Linie beschriftet (eigene Legende optional), S2 ≤ 8 Marken garantiert, S3 44 px Touch, S4 Leer-Wortlaut an den Burndown angeglichen („Keine Aufgabe im Zeitraum.“), S5 eigenes Balkensymbol. Die Wächter-Zählung ist **9 → 10** (nicht 8 → 9).

**Optionen-Tableau (Skill `optionen-vor-entscheidung`):**
- **A — Balken je Periode mit Ø-Linie, Auflösung Tag/Woche/Monat** (empfohlen): je Kalenderperiode ein Balken, dazu die Rate als gestrichelte Linie und eine Kennzahlenzeile. Bekannteste Durchsatz-Form (Jira „Control Chart“, Kanbanflow „Throughput“), direkt aus den Bewegungen lesbar.
- **B — eine Durchsatz-Rate als Linie je Tag** (keine Balken): zeigt den Trend glatter, aber die Zahl je Woche/Monat ist nicht ablesbar und leere Perioden verschwinden.
- **C — nur Kennzahlen, kein Diagramm** (Gesamt, Ø, Perioden): kleinster Umfang, aber ohne Bild unterscheidet es sich kaum von der einen Zahl in der Prognose.

Verworfen: B (keine Zahl je Periode), C (kein Bild, der Bericht wäre überflüssig neben der Prognose). Begründung: Das genannte Problem ist, den Durchsatz **über die Zeit** zu sehen; das leistet nur A.

**Verworfene Alternativen**
- *Eigener Endpunkt oder Cache*: Der Browser hat die Bewegungen schon geladen; ein Endpunkt brächte nichts (Architektur bestanden 2026-11-11, keine Technikfrage).
- *Neuer `reporting.throughput`-Schlüssel*: wäre eine neue Datenform; R00060 lässt ihn für später offen. Jetzt entscheidet `reporting.forecast` mit.
- *Wählbare Zielspalte wie R00079*: würde eine eigene Board-Einstellung samt Cache-Schlüssel verlangen; als Ausbaustufe vermerkt.
- *Rechnung in Stunden*: KanbanD kennt keine Ist-Zeiten-Datei; der Durchsatz misst in Aufgaben (PO-Beratung 2026-11-03).

**Verwiesenes**
- Kernpunkte der Beratung product-owner 2026-11-03 (übliche Kanban-Funktionen, die fehlen): Durchsatz je Zeitraum, Priorität niedrig bis mittel; Beleg: Durchsatz nur in der Prognose (`web/ansicht.js:940`), kein eigener Bericht. Kartenherkunft #34. Referenz: Kanbanflow, Jira.
