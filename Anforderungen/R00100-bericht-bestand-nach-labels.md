---
id: R00100
status: Neu
datum: 2026-10-31
---

# R00100: Bericht „Bestand nach Labels“

## Beschreibung

Ein neuer Bericht im Menü „Berichte“ trägt zwei Label-Präfixe gegeneinander auf, zum Beispiel `repo:*` als Zeilen und `nc:*` als Spalten. Jede Zelle zeigt die Zahl der offenen Karten des Boards mit diesem Label-Paar und ist nach der dringendsten Klasse darin eingefärbt. Ein Klick auf eine Zelle filtert das Board auf genau diese Karten. Die gewählten Präfixe stehen im Frontmatter des Boards, und die gemeinsame Filterleiste der Berichte gilt auch hier.

Zahlt ein auf: [Vision](R00000-vision.md) — Auswertungen rechnen aus dem, was geschehen ist.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Die Spalten des Boards zeigen den Fluss, also wo Karten gerade stehen. Der Wartungsfabrik fehlt der Bestand: welches Repository wie viele offene Verletzungen welcher Bedingung hat und wie dringend sie sind. Die Tabelle zeigt auf einen Blick, wo es brennt, und führt mit einem Klick zu den Karten.

## Funktionale Anforderungen

### Name
- Menüeintrag „Bestand nach Labels“ in einer neuen Gruppe „BESTAND“ zwischen „VERLAUF“ und „AUSLEITEN“, mit Tabellensymbol und der Beschreibung „Offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse — Klick öffnet das Board.“; Route `#/berichte/bestand`, Fenstertitel „Bestand — kanbanD“. Der Name „Kreuztabelle“ ist schon vergeben: Er steht als Beschreibung beim Bericht „Zeiten nach Aufgabe und Person“ (`#/berichte/kreuz`, R00022).
- Sichtbare Texte des Berichts sagen „Aufgaben“, nicht „Karten“, wie Menü und übrige Berichte.

### Rechnung
- **Offen** heißt: auf diesem Board, nicht archiviert und nicht in der Abschlussspalte (letzte Spalte).
- **Präfix** ist der Text vor dem ersten Doppelpunkt eines Labels. Der Wert ist der Rest: `repo:shop` hat das Präfix `repo` und den Wert `shop`.
- **Groß und Klein**: Präfixe und Werte werden ohne Unterscheidung von Groß- und Kleinschreibung zusammengefasst (`Repo:Shop` und `repo:shop` sind eine Zeile), wie im Board-Filter. Angezeigt wird die Schreibweise der gezählten Aufgabe mit der kleinsten Nummer.
- **Ordnung**: Zeilen sind die Werte des Zeilenpräfixes, Spalten die Werte des Spaltenpräfixes, beide in natürlicher Ordnung — Ziffernfolgen als Zahl, sonst alphabetisch ohne Groß/Klein nach deutscher Sortierung, also `nc:304` vor `nc:1000`. Dazu kommt immer je eine Zeile „(ohne repo)“ bzw. Spalte „(ohne nc)“ für offene Karten ohne Label dieses Präfixes; sie steht am Ende, vor den Summen. In den Beispielen unten heißt sie kurz „(ohne)“.
- Eine Karte mit mehreren Werten desselben Präfixes zählt in jeder ihrer Zellen. Die Summen je Zeile, je Spalte und gesamt zählen jede Karte nur einmal.
- **Dringlichkeit** ist die Reihenfolge der Klassen unter `classes` in `kanbanD.md`: Die erste ist die dringendste. Karten ohne Klasse sind am wenigsten dringend. Die Zelle trägt die Farbe der dringendsten Klasse unter ihren Karten, eine Zelle ohne Karten bleibt leer.

### Darstellung
- **Kopfleiste** „Bestand nach Labels · liest nur · Klick auf eine Zahl öffnet das Board“.
- **Tabelle**: Beschriftung (caption oder `aria-label`) „Bestand nach Labels: repo × nc“ mit den gewählten Präfixen; Eckzelle „repo ↓ · nc →“; Summen als letzte Zeile und Spalte „Summe“ wie in der Kreuztabelle; eine leere Zelle zeigt „—“ in der Farbe `--kd-muted`.
- **Zellmarke**: Jede gefärbte Zelle trägt links einen Balken von 3 px in `--cl` ihrer Klasse, wie die Karte. Ist die dringendste Klasse „ohne Klasse“, bleibt die Zelle ohne Farbe und ohne Balken, wie „ohne Klasse“ in der Legende.
- **Legende** unter der Tabelle wie die Board-Legende: je Klasse in der Reihenfolge der Dringlichkeit Farbfeld und Bezeichnung, am Ende „ohne Klasse“. Sie zeigt nur und filtert nicht.
- **Name je Zelle**: Tooltip und zugänglicher Name einer Zelle sind derselbe Text. Klickbare Zahl: „<zeilenpräfix>:<wert> × <spaltenpräfix>:<wert>: <n> offen — <Bezeichnung> <k> · … · ohne Abschlussspalte, ohne Filter der Berichte“, Klassen in der Reihenfolge der Dringlichkeit mit ihrer Bezeichnung aus `classes`, Aufgaben ohne Klasse als „ohne Klasse <k>“ am Ende. Zahl in „(ohne …)“: Kopf wie oben mit „(ohne nc)“ bzw. „(ohne repo)“, Klassen wie oben, endet auf „· nicht klickbar“. Summe: „Summe <präfix>:<wert>: <n> offen · nicht klickbar“, gesamt „Summe gesamt: <n> offen · nicht klickbar“. Leere Zelle: „<zeile> × <spalte>: keine offen“.
- **Erklärsatz** sichtbar unter der Tabelle: „Eine Zahl öffnet das Board mit diesen Aufgaben. Nicht klickbar sind „(ohne …)“ und die Summen. Das Board übernimmt die Filter der Berichte nicht und zeigt auch die Abschlussspalte.“
- **Leerzustand**: Gibt es keine offene Aufgabe, die zu den Filtern der Berichte passt (gesamt 0), steht statt der Tabelle „Keine offenen Aufgaben, die zu den Filtern der Berichte passen.“; sind Filter der Berichte aktiv, daneben der Knopf „Zurücksetzen“ der Filterleiste.
- **Zu wenige Präfixe**: Tragen die offenen Aufgaben weniger als zwei verschiedene Präfixe und ist keine Einstellung gespeichert, steht statt der Tabelle „Für diese Tabelle braucht das Board Labels mit zwei verschiedenen Präfixen, z. B. repo:shop und nc:304.“ Die Auswahlfelder bleiben sichtbar, soweit es Präfixe gibt; es entsteht kein Commit.
- **Schmales Layout** (375 px): Nur die Tabelle scrollt quer, nicht die Seite; Spaltenköpfe und Zeilenköpfe bleiben beim Scrollen stehen (sticky).

### Bedienung
- Über der Tabelle stehen zwei Auswahlfelder „Zeilen“ und „Spalten“ mit allen Präfixen, die bei offenen Karten des Boards vorkommen. Beide Felder tragen nie denselben Präfix.
- **Achsentausch**: Ein Knopf „⇄ Achsen tauschen“ vertauscht Zeilen und Spalten. Wird in einem Feld der Präfix gewählt, der im anderen Feld steht, tauschen die beiden Felder ebenso. Ein Tausch ist eine Handlung: genau ein `PUT …/bestand` und genau ein Commit. Bei genau zwei Präfixen ist das der einzige Weg, die Achsen zu wechseln.
- Ein Klick auf eine Zelle mit Zahl öffnet das Board mit dem Filter `label:<zeilenpräfix>:<wert> label:<spaltenpräfix>:<wert>`. Die Zellen in „(ohne …)“ und die Summen sind nicht klickbar und sagen das in ihrem Namen.
- **Klickbare Zahlen** sehen aus wie ein Link, nicht klickbare wie Text. Eine klickbare Zahl ist ein fokussierbares Element mit sichtbarem Fokusring, Enter wirkt wie der Klick; nicht klickbare Zahlen liegen nicht im Tab-Weg. Zielfläche mindestens 24 × 24 px, bei Touch-Bedienung mindestens 44 px hoch.
- **Ohne Speicherung**: Ist keine Person gewählt, wirkt eine Wahl der Achsen nur in dieser Ansicht, und über der Tabelle steht „nicht gespeichert — zum Speichern „Ich bin …“ wählen“ wie in der Filterleiste der Berichte. Scheitert das Speichern, bleibt die Wahl in dieser Ansicht stehen, und dort steht „Achsen nicht gespeichert: <Grund>“.

### Ablage
- Frontmatter des Boards: `report-labels: {rows: <präfix>, columns: <präfix>}`, gesetzt über `PUT /api/boards/{slug}/bestand {zeilen, spalten}` mit einem Commit, wie `report-filter`. `GET /api/boards/{slug}` liefert `bestand: {zeilen, spalten} | null`. Präfixe vergleicht der Server ohne Groß/Klein.
- Ohne Eintrag schlägt der Bericht die beiden häufigsten Präfixe vor, schreibt aber nichts. Häufigkeit eines Präfixes ist die Zahl offener Karten mit mindestens einem Label davon (nach der Filterleiste); bei Gleichstand gewinnt die alphabetische Ordnung.

### Filterleiste
- Die gemeinsame Filterleiste der Berichte (R00081) gilt: ausgeschlossene Klassen, ausgeschlossene Spalten, Personen (Zuständige) und Labels schränken die gezählten Karten ein. Der Zeitraum wirkt nicht, denn der Bestand ist ein Jetzt-Stand: Die Leiste blendet die Gruppe Zeitraum für diesen Bericht aus wie beim Stundenzettel, die Zusammenfassung nennt „Zeitraum gilt hier nicht“, und die Zahl aktiver Filter zählt den Zeitraum nicht mit. Ein gespeicherter Zeitraum bleibt unverändert in der Board-Datei und gilt weiter für die anderen Berichte.

### Live
- Der Bericht rechnet bei jeder Änderung im Ordner neu, wie das Board.

## Nicht-funktionale Anforderungen

- Performance: 500 offene Karten und 30 × 30 Zellen sind in unter 200 ms gerechnet und gezeichnet. Die Rechnung läuft im Browser über die Aufgaben, die schon geladen sind.
- Barrierefreiheit: Die Tabelle ist eine echte `<table>` mit Zeilen- und Spaltenköpfen, und die Farbe wird nie allein verwendet: Zellmarke, Legende und der Name jeder Zelle nennen die Klasse. Der Bericht ist allein mit Tab und Enter bedienbar.

## Akzeptanzkriterien

Grundbestand für die Beispiele (wo ein Kriterium nichts anderes sagt): Klassen in dieser Reihenfolge `sicherheit` (Bezeichnung „Sicherheit“), `eol` („EOL“), `drift` („Drift“); Board „fabrik“ mit den Spalten „Eingang“ und „Fertig“ (letzte Spalte); Einstellung `rows: repo, columns: nc`; eine Person ist mit „Ich bin …“ gewählt. Offene Karten in „Eingang“: #1 `[repo:shop, nc:304]` sicherheit, #2 `[repo:shop, nc:304]` drift, #3 `[repo:shop, nc:305]` eol, #4 `[repo:lager, nc:304]` ohne Klasse, #5 `[repo:lager]` drift. Nicht offen: #6 `[repo:shop, nc:304]` in „Fertig“, #7 `[repo:shop, nc:304]` archiviert. „(ohne)“ steht für „(ohne repo)“ bzw. „(ohne nc)“.

### Rechnung
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann zeigt er shop × 304 = 2 (Farbe sicherheit), shop × 305 = 1 (eol), lager × 304 = 1 (ohne Klasse), lager × (ohne) = 1 (drift), alle übrigen Zellen leer; Summe shop = 3, lager = 2, Spalte 304 = 3 (#1, #2, #4), 305 = 1, (ohne) = 1, gesamt 5. #6 und #7 zählen nicht
- [ ] Gegeben der Grundbestand und dazu #8 `[repo:shop, nc:304, nc:305]` drift offen, wenn der Bericht geöffnet wird, dann shop × 304 = 3 und shop × 305 = 2 (Farbe eol: #3 eol ist dringender als #8 drift), Summe shop = 4 (nicht 5), Spalte 304 = 4, 305 = 2, gesamt 6 (nicht 7)
- [ ] Grenzwert Präfix: Gegeben der Grundbestand und dazu offen #9 `[repo:shop, nc:304:a]` ohne Klasse und #10 `[dringend, repo:lager]` drift, wenn der Bericht geöffnet wird, dann gibt es die Spalte `304:a` mit shop × 304:a = 1 (Präfix ist der Text vor dem ersten Doppelpunkt), lager × (ohne) = 2 (#5, #10), gesamt 7, und `dringend` (ohne Doppelpunkt) bildet keinen Präfix, steht also in keinem Auswahlfeld
- [ ] Groß und Klein: Gegeben der Grundbestand und dazu offen #11 `[Repo:Shop, NC:304]` eol, wenn der Bericht geöffnet wird, dann gibt es genau eine Zeile „shop“ (Schreibweise von #1, der kleinsten Nummer) und genau eine Spalte „304“, shop × 304 = 3 (#1, #2, #11), Summe shop = 4, Spalte 304 = 4, gesamt 6, und kein Auswahlfeld führt `Repo` oder `NC` neben `repo` und `nc`
- [ ] Ordnung: Gegeben der Grundbestand und dazu offen #12 `[repo:shop, nc:1000]` drift, wenn der Bericht geöffnet wird, dann stehen die Spalten in der Reihenfolge 304, 305, 1000, (ohne nc), Summe und die Zeilen in der Reihenfolge lager, shop, (ohne repo), Summe

### Darstellung
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann steht über der Tabelle „Bestand nach Labels · liest nur · Klick auf eine Zahl öffnet das Board“, die Eckzelle lautet „repo ↓ · nc →“, die vorletzte Spalte heißt „(ohne nc)“ vor „Summe“, die Zelle shop × (ohne nc) zeigt „—“ in `--kd-muted`, und der Fenstertitel ist „Bestand — kanbanD“
- [ ] Zellmarke: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann trägt shop × 304 links einen Balken von 3 px in `--cl` von sicherheit (derselbe Farbwert wie der Rand einer Karte der Klasse sicherheit auf dem Board), shop × 305 einen in `--cl` von eol, und lager × 304 (ohne Klasse) hat weder Hintergrundfarbe noch Balken
- [ ] Legende: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann steht unter der Tabelle eine Legende mit genau diesen Einträgen in dieser Reihenfolge: „Sicherheit“, „EOL“, „Drift“, „ohne Klasse“, je mit Farbfeld wie in der Board-Legende; ein Klick auf einen Eintrag ändert weder die Zahlen noch den Filter
- [ ] Erklärsatz: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann steht unter der Tabelle „Eine Zahl öffnet das Board mit diesen Aufgaben. Nicht klickbar sind „(ohne …)“ und die Summen. Das Board übernimmt die Filter der Berichte nicht und zeigt auch die Abschlussspalte.“
- [ ] Leerfall: Gegeben die Einstellung `rows: repo, columns: nc` und alle Karten des Boards liegen in „Fertig“ oder sind archiviert, wenn der Bericht geöffnet wird, dann steht statt der Tabelle „Keine offenen Aufgaben, die zu den Filtern der Berichte passen.“ ohne Knopf „Zurücksetzen“, die Auswahlfelder zeigen `repo` und `nc`, und es entsteht kein Commit
- [ ] Leerfall mit Filter: Gegeben der Grundbestand und die Filterleiste schließt die Spalte „Eingang“ aus, wenn der Bericht geöffnet wird, dann steht derselbe Satz mit dem Knopf „Zurücksetzen“; ein Klick darauf hebt die Filter der Berichte auf (ein Commit wie in der Filterleiste), und die Tabelle zeigt wieder gesamt 5
- [ ] Zu wenige Präfixe: Gegeben ein Board ohne `report-labels`, dessen offene Aufgaben nur Labels `repo:*` tragen, wenn der Bericht geöffnet wird, dann steht statt der Tabelle „Für diese Tabelle braucht das Board Labels mit zwei verschiedenen Präfixen, z. B. repo:shop und nc:304.“, das Feld „Zeilen“ bietet `repo` an, und `git log` hat keinen neuen Commit; tragen die offenen Aufgaben gar keinen Präfix, steht derselbe Satz, und kein Auswahlfeld bietet einen Präfix an
- [ ] Schmales Layout: Gegeben der Grundbestand und dazu offen zehn Karten `[repo:shop, nc:400]` bis `[repo:shop, nc:409]`, das Fenster ist 375 px breit, wenn der Bericht geöffnet und die Tabelle quer bis zum Ende gescrollt wird, dann ist die Seite nicht breiter als 375 px (sie selbst scrollt nicht quer), der Tabellenbereich scrollt, und der Zeilenkopf „shop“ und der Spaltenkopf „409“ bleiben dabei sichtbar
- [ ] Menü: Gegeben der Grundbestand, wenn das Menü „Berichte“ geöffnet wird, dann steht zwischen „VERLAUF“ und „AUSLEITEN“ die Gruppe „BESTAND“ mit „Bestand nach Labels“, Tabellensymbol und „Offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse — Klick öffnet das Board.“; im geöffneten Bericht enthält kein sichtbarer Text das Wort „Karte“

### Filterleiste
- [ ] Gegeben der Grundbestand und die Filterleiste schließt die Klasse drift aus, wenn der Bericht geöffnet wird, dann shop × 304 = 1 (nur #1), lager × (ohne) bleibt leer, Summe shop = 2, lager = 1, gesamt 3
- [ ] Gegenbeispiel Zeitraum: Gegeben der Grundbestand und in der Filterleiste ist der Zeitraum „letzte Woche“ gespeichert, wenn der Bericht geöffnet wird, dann bleiben alle Zahlen wie im ersten Kriterium (gesamt 5), die Leiste zeigt keine Gruppe Zeitraum, die Zusammenfassung nennt „Zeitraum gilt hier nicht“ und zählt ihn nicht unter „aktiv“, und `boards/fabrik.md` ist byte-gleich wie vorher; der Bericht „Burndown“ zeigt den Zeitraum „letzte Woche“ weiter an

### Bedienung
- [ ] Gegeben der Grundbestand, wenn auf shop × 304 geklickt wird, dann zeigt das Board den Filter `label:repo:shop label:nc:304`, und sichtbar sind #1, #2 und #6. #6 liegt in „Fertig“ und wird vom Board-Filter gezeigt, obwohl die Zelle nur offene Karten zählt. Das ist gewollt, Name und Erklärsatz nennen es
- [ ] Gegenbeispiel Klick: Gegeben der Grundbestand, wenn auf lager × (ohne) (Zahl 1), auf die Summe shop = 3 oder auf die leere Zelle shop × (ohne) geklickt wird, dann bleibt der Bericht offen und der Board-Filter unverändert; lager × (ohne) heißt „repo:lager × (ohne nc): 1 offen — Drift 1 · nicht klickbar“, die Summe „Summe repo:shop: 3 offen · nicht klickbar“
- [ ] Name: Gegeben der Grundbestand, wenn der Zeiger auf shop × 304 steht oder ein Screenreader die Zelle liest, dann lauten Tooltip und zugänglicher Name „repo:shop × nc:304: 2 offen — Sicherheit 1 · Drift 1 · ohne Abschlussspalte, ohne Filter der Berichte“; lager × 304 heißt „repo:lager × nc:304: 1 offen — ohne Klasse 1 · ohne Abschlussspalte, ohne Filter der Berichte“
- [ ] Link: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann sind die Zahlen in lager × 304, shop × 304 und shop × 305 als Link gestaltet (Linkfarbe, unterstrichen), lager × (ohne) und die Summen nicht
- [ ] Tastatur: Gegeben der Grundbestand und der Fokus steht im Feld „Spalten“, wenn nur Tab gedrückt wird, bis der Fokus die Tabelle verlässt, dann erhalten in der Tabelle genau die drei klickbaren Zahlen in Leserichtung lager × 304, shop × 304, shop × 305 den Fokus, jede mit sichtbarem Fokusring (Kontur oder Schatten, nicht `none`), und keine Summe und keine Zelle „(ohne …)“; Enter auf shop × 304 zeigt das Board mit `label:repo:shop label:nc:304` wie der Klick. Die Probe benutzt nur Tab und Enter
- [ ] Zielgröße: Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann misst jede klickbare Zahl mindestens 24 × 24 px; mit Touch-Bedienung (`pointer: coarse`, 375 px breit) mindestens 44 px hoch
- [ ] Gegeben der Grundbestand, wenn der Screenreader-Baum gelesen wird, dann heißt die Tabelle „Bestand nach Labels: repo × nc“
- [ ] Achsentausch über den Knopf: Gegeben der Bericht zeigt `rows: repo, columns: nc`, wenn „⇄ Achsen tauschen“ gedrückt wird, dann geht genau ein `PUT …/bestand {zeilen: "nc", spalten: "repo"}` hinaus, `git log` hat genau einen Commit mehr, das Frontmatter trägt `report-labels: {rows: nc, columns: repo}`, die Zeilen sind 304, 305, (ohne nc), und ein zweiter Browser zeigt den Wechsel live und nach dem Neuladen
- [ ] Achsentausch über das Feld: Gegeben der Bericht zeigt `rows: repo, columns: nc` und es gibt genau diese zwei Präfixe, wenn im Feld „Spalten“ `repo` gewählt wird, dann stehen Zeilen `nc` und Spalten `repo` mit genau einem Commit; beide Felder tragen zu keinem Zeitpunkt denselben Präfix
- [ ] Gegeben ein Board ohne `report-labels` mit offenen Karten, die `repo:*` fünfmal und `nc:*` viermal tragen, wenn der Bericht geöffnet wird, dann schlägt er Zeilen `repo` und Spalten `nc` vor, und es entsteht kein Commit
- [ ] Gleichstand: Gegeben ein Board ohne `report-labels` mit offenen Karten, die `team:*`, `repo:*` und `nc:*` je dreimal tragen, wenn der Bericht geöffnet wird, dann schlägt er Zeilen `nc` und Spalten `repo` vor (alphabetisch), ohne Commit
- [ ] Ohne Person: Gegeben der Grundbestand, aber keine Person ist mit „Ich bin …“ gewählt, wenn „⇄ Achsen tauschen“ gedrückt wird, dann zeigt diese Ansicht `nc` × `repo`, über der Tabelle steht „nicht gespeichert — zum Speichern „Ich bin …“ wählen“, und `git log` und `boards/fabrik.md` bleiben unverändert
- [ ] Speicherfehler: Gegeben der Grundbestand und der Ordner `boards/` ist schreibgeschützt (`chmod a-w boards`), wenn „⇄ Achsen tauschen“ gedrückt wird, dann zeigt diese Ansicht `nc` × `repo`, über der Tabelle steht „Achsen nicht gespeichert: “ mit dem Grund aus der Antwort des Servers, und `git log` und `boards/fabrik.md` bleiben unverändert

### Ablage
- [ ] Gegeben das Board „fabrik“ ohne `report-labels`, wenn `GET /api/boards/fabrik` gefragt wird, dann ist `bestand: null`; nach `PUT /api/boards/fabrik/bestand {zeilen: "nc", spalten: "repo"}` liefert `GET` `bestand: {zeilen: "nc", spalten: "repo"}`, und `git log` hat genau einen Commit mehr
- [ ] Fehlfall: Gegeben das Board „fabrik“, wenn `PUT /api/boards/fabrik/bestand` mit `{zeilen: "nc", spalten: "nc"}`, mit `{zeilen: "nc", spalten: "NC"}`, mit `zeilen: ""` oder mit `zeilen: "repo:x"` (Doppelpunkt im Präfix) gesendet wird, dann antwortet der Server 400, und `boards/fabrik.md` und `git log` bleiben unverändert; `PUT /api/boards/gibtsnicht/bestand` → 404 ohne Commit

### Live
- [ ] Gegeben der Bericht ist offen und zeigt shop × 304 = 2, wenn über die API eine Karte `[repo:shop, nc:304]` in „Eingang“ angelegt wird, dann zeigt die Zelle ohne Neuladen 3, spätestens 1 s nach der Antwort der API (Vision: Live überall)

### Nicht-funktional
- [ ] Gegeben 500 offene Karten mit 30 Werten `repo:*` und 30 Werten `nc:*`, wenn der Bericht geöffnet wird, dann sind Rechnung und Tabelle in unter 200 ms fertig, gemessen vom Aufruf der Rechnung bis die Tabelle im Dokument steht (headless Chromium)
- [ ] Gegeben der Grundbestand, wenn die Tabelle mit einem Screenreader-Baum gelesen wird, dann ist sie eine `<table>` mit Spaltenköpfen (`th scope="col"`) und Zeilenköpfen (`th scope="row"`), und jede Zelle mit Zahl nennt ihre Klassen im zugänglichen Namen, nicht nur als Farbe

## Betroffene Verzeichnisstruktur

Rechnung als reine Funktion in `web/berichte.js` (im Browser und mit Node-Unit-Tests nutzbar), Ansicht in `web/ansicht.js` neben `vStundenzettel`, Menüeintrag im Berichte-Menü (`web/ansicht.js`), Aktionen und Fenstertitel in `web/app.js`, Gestaltung in `web/kd-app.css`. Format und Endpunkt in `src/format/board.rs`, `src/dienst/berichtsfilter.rs` (oder daneben `src/dienst/bestand.rs`) und `src/web/mod.rs`. Die Tests liegen unter `tests/`, `e2e/tests/` und als Unit-Tests der JS-Funktionen.

## Technische Überlegungen

### Ablauf
1. **Einstellung lesen**: `S.board.bestand` oder ein Vorschlag aus den Präfixen
2. **Rechnen** (pure): `bestandNachLabels(aufgaben, board, klassen, zeilen, spalten, filter)` → `{zeilen, spalten, zellen, summen}`
3. **Zeichnen**: Tabelle mit Zahl, Farbe und Zellmarke, Name je Zelle, Legende, Erklärsatz; bei gesamt 0 der Leerzustand, bei weniger als zwei Präfixen der Hinweis
4. **Klick oder Enter**: `filterSetzen('label:…:… label:…:…')`, Wechsel zum Board
5. **Achsen wählen oder tauschen**: neue Einstellung (pure) → ein `PUT …/bestand`; ohne Person oder bei Fehler nur in dieser Ansicht

### Grobentwurf

**Wichtige Einstiegsstellen:** Menü „Berichte“, Route `#/berichte/bestand`, `PUT /api/boards/{slug}/bestand`.

- `bestandNachLabels(...)` (pure Funktion, JS) — liefert die Tabelle
- `praefixe(aufgaben)` (pure, JS) — Präfixe mit Häufigkeit, für Auswahl und Vorschlag
- `dringendste(klassenDerZelle, reihenfolge)` (pure, JS)
- `zellName(zelle, achsen, klassen)` (pure, JS) — Tooltip und zugänglicher Name einer Zelle
- `achsenNachWahl(einstellung, feld, praefix)` (pure, JS) — neue Einstellung, Tausch bei belegtem Präfix
- `Bestandseinstellung` (Rust-DTO) — `zeilen`, `spalten`
- `vBestand()` (Ansicht)

### Änderungen an bestehenden Klassen
- `format::board`: `report-labels` lesen und schreiben
- `Board`: Feld `bestand: Option<Bestandseinstellung>`
- Filterleiste: Gruppe Zeitraum je Bericht ausblendbar, Zusammenfassung mit „Zeitraum gilt hier nicht“

## Tests

**Unit (JS, Node):** `bestandNachLabels` mit den Rechenbeispielen der Kriterien (auch Groß/Klein und Ordnung), `praefixe`, `dringendste`, `zellName`, `achsenNachWahl`.
**Integration:** `PUT …/bestand` schreibt das Frontmatter und `GET` liefert es, Rundreise mit Präfixen wie `nc`; Fehlfälle mit `git log` und Datei vorher/nachher.
**E2E:** Bericht öffnen, Zahl, Farbe, Zellmarke und Legende prüfen, Klick und Enter führen zum gefilterten Board, Achsentausch mit einem Commit bleibt nach Neuladen, Leerzustand, schmales Layout.

## Abhängigkeiten
- Abhängig von: R00081 (Berichtsfilter am Board), R00095 (Labels mit Doppelpunkt geprüft)
- Gestaltung: Artboard D0006 „Bestand nach Labels“ (gestalter, `/wireframe verfeinern D0006`), freigegeben vor dem Bau der Oberfläche (`AI-Team/po-entscheidungen.md` Z. 75–76)
- Blockiert: —

## Offene Fragen

Die fünf Rückfragen der Detailplanung vom 2026-11-06 sind entschieden und eingearbeitet: Groß/Klein und Anzeige-Schreibweise, natürliche Ordnung, Vorschlag und Hinweis bei weniger als zwei Präfixen, Klick ohne die Filter der Berichte, Klassen-Bezeichnung im Namen der Zelle. Protokoll: `AI-Team/po-entscheidungen.md` Z. 70–74; Zeitraum ausgeblendet Z. 77; UX-Vorprüfung Z. 75 und 78.

Offen beim Auftraggeber bleibt nur, ob er das Artboard D0006 vor dem Bau freigibt (Z. 76). Bis er entscheidet, warten die Bubbles der Oberfläche auf die Freigabe; die übrigen dürfen gebaut werden.

## Manuelle Vorbereitungstätigkeiten
- In `kanbanD.md` des Factory-Ordners die Klassen in der Reihenfolge der Dringlichkeit eintragen: `sicherheit`, `eol`, `drift`.

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass das Board bei vielen Repositories und Bedingungen nur den Fluss zeigt: Man sieht, dass im Eingang 40 Karten liegen, aber nicht, dass 12 davon Sicherheitsbefunde im selben Repository sind. Die Tabelle zählt die offenen Karten je Paar aus `repo` und `nc` und färbt nach der dringendsten Klasse. Brennpunkte werden so ohne Suchen sichtbar, und ein Klick führt zu den Karten. Der Hebel ist die Auswertung der Labels, die die Sensoren ohnehin setzen. Ein neues Datenfeld oder eine zweite Board-Struktur braucht es nicht, und die Auswahl der Präfixe hält den Bericht für andere Präfixe offen.

## Missing-Docs
- Ob sich die Reihenfolge der Klassen in der Oberfläche ändern lässt, ist in keiner Anforderung beschrieben. Davon hängt ab, ob ein Mensch die Dringlichkeit ohne Editor einstellen kann.

## Notizen

**Optionen-Tableau übersprungen:** Der Betreiber hat Inhalt, Klick, Ablage und Filterleiste vorgegeben. Ohne Rückfrage entschieden wurden:
- **Name „Bestand nach Labels“**, weil „Kreuztabelle“ schon vergeben ist;
- **Dringlichkeit = Reihenfolge der Klassen in `kanbanD.md`**. kanbanD kennt keine eigene Rangfolge, und die Reihenfolge der Klassen ist schon die Reihenfolge, in der sie angeboten werden;
- **Zeile und Spalte „(ohne)“**, damit Karten ohne `repo:` oder `nc:` auffallen statt zu verschwinden;
- **Frontmatter-Schlüssel `report-labels`**, passend zu `report-filter`.

**Verworfene Alternativen**
- *Feste Präfixe `repo` und `nc`*: Das würde einen Projektbegriff in kanbanD verankern.
- *Rechnung im Server*: Der Browser hat alle Aufgaben ohnehin geladen, ein weiterer Endpunkt brächte nichts.
- *Zeitraum ausgegraut mit Hinweis*: Ein deaktiviertes Element bekommt nach Material 3 keinen Fokus und muss keinen Kontrast erfüllen, der Hinweis wäre also schlecht lesbar; der Stundenzettel blendet den Zeitraum schon aus (PO Z. 77).

**Optional, nicht beauftragt** (UX-Vorprüfung 2026-11-06): Browser-Zurück nach dem Klick führt zurück zum Bericht; der Chip der Abschlussspalte in der Filterleiste erscheint für diesen Bericht ausgegraut. Eine eigene Karte erst auf Befund.

**Detailplanung 2026-11-06 (Karte #6):** Akzeptanzkriterien in die Form Gegeben/wenn/dann gebracht, Werte unverändert; ergänzt um Spaltensummen im Rechenbeispiel, Grenzwert Präfix, Leerfall, Gegenbeispiele für Zeitraum und Klick, Fehlfall und Rundreise der Ablage, Live sowie Leistung und Barrierefreiheit als Kriterien. User Story um US-5 und US-6 ergänzt. WBS: I0092.

**Einarbeitung 2026-11-06 (Karte #6):** PO-Entscheidungen Z. 70–78 und die Punkte Muss und Sollte der UX-Vorprüfung eingearbeitet: Abschnitt „Darstellung“ neu (Kopfleiste, Eckzelle, Zellmarke, Legende, Name je Zelle, Erklärsatz, Leerzustand, Hinweis bei zu wenigen Präfixen, schmales Layout); Achsentausch, Link-Gestalt, Tastatur, Zielgröße und Speicherung ohne Person bzw. bei Fehler unter „Bedienung“; Zeitraum ausgeblendet statt ausgegraut. Der Leerfall zeigt nun den Satz statt einer Tabelle „(ohne)“ × „(ohne)“, und der belegte Präfix ist im anderen Feld nicht mehr „nicht wählbar“, sondern tauscht. Die Richtung ist unverändert. User Story: US-1, US-3, US-4 und US-6 angepasst, US-7 und US-8 neu.
