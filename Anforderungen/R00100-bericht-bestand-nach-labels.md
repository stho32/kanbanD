---
id: R00100
status: Neu
datum: 2026-10-31
---

# R00100: Bericht „Bestand nach Labels“

## Beschreibung

Ein neuer Bericht im Menü „Berichte“ trägt zwei Label-Präfixe gegeneinander auf, zum Beispiel `repo:*` als Zeilen und `nc:*` als Spalten. Jede Zelle zeigt die Zahl der offenen Karten des Boards mit diesem Label-Paar und ist nach der dringendsten Klasse darin eingefärbt. Ein Klick auf eine Zelle filtert das Board auf genau diese Karten. Die gewählten Präfixe stehen im Frontmatter des Boards, und die gemeinsame Filterleiste der Berichte gilt auch hier.

Zahlt ein auf: [Vision](R00000-vision.md) — Auswertungen rechnen aus dem, was geschehen ist.

## Geschäftlicher Nutzen

Die Spalten des Boards zeigen den Fluss, also wo Karten gerade stehen. Der Wartungsfabrik fehlt der Bestand: welches Repository wie viele offene Verletzungen welcher Bedingung hat und wie dringend sie sind. Die Tabelle zeigt auf einen Blick, wo es brennt, und führt mit einem Klick zu den Karten.

## Funktionale Anforderungen

### Name
- Menüeintrag „Bestand nach Labels“ in einer neuen Gruppe „BESTAND“, Route `#/berichte/bestand`. Der Name „Kreuztabelle“ ist schon vergeben: Er steht als Beschreibung beim Bericht „Zeiten nach Aufgabe und Person“ (`#/berichte/kreuz`, R00022).

### Rechnung
- **Offen** heißt: auf diesem Board, nicht archiviert und nicht in der Abschlussspalte (letzte Spalte).
- **Präfix** ist der Text vor dem ersten Doppelpunkt eines Labels. Der Wert ist der Rest: `repo:shop` hat das Präfix `repo` und den Wert `shop`.
- Zeilen sind die Werte des Zeilenpräfixes, Spalten die Werte des Spaltenpräfixes, beide alphabetisch. Dazu kommt je eine Zeile und Spalte „(ohne)“ für offene Karten ohne Label dieses Präfixes.
- Eine Karte mit mehreren Werten desselben Präfixes zählt in jeder ihrer Zellen. Die Summen je Zeile, je Spalte und gesamt zählen jede Karte nur einmal.
- **Dringlichkeit** ist die Reihenfolge der Klassen unter `classes` in `kanbanD.md`: Die erste ist die dringendste. Karten ohne Klasse sind am wenigsten dringend. Die Zelle trägt die Farbe der dringendsten Klasse unter ihren Karten, eine Zelle ohne Karten bleibt leer.

### Bedienung
- Über der Tabelle stehen zwei Auswahlfelder „Zeilen“ und „Spalten“ mit allen Präfixen, die bei offenen Karten des Boards vorkommen. Gleiche Präfixe in beiden Feldern sind nicht wählbar.
- Ein Klick auf eine Zelle mit Zahl öffnet das Board mit dem Filter `label:<zeilenpräfix>:<wert> label:<spaltenpräfix>:<wert>`. Die Zellen in „(ohne)“ und die Summen sind nicht klickbar und erklären das im Tooltip.
- Der Tooltip einer Zelle zeigt die Zahl je Klasse, zum Beispiel „sicherheit 2 · eol 1“.

### Ablage
- Frontmatter des Boards: `report-labels: {rows: <präfix>, columns: <präfix>}`, gesetzt über `PUT /api/boards/{slug}/bestand {zeilen, spalten}` mit einem Commit, wie `report-filter`. `GET /api/boards/{slug}` liefert `bestand: {zeilen, spalten} | null`.
- Ohne Eintrag schlägt der Bericht die beiden häufigsten Präfixe vor, schreibt aber nichts.

### Filterleiste
- Die gemeinsame Filterleiste der Berichte (R00081) gilt: ausgeschlossene Klassen, ausgeschlossene Spalten, Personen (Zuständige) und Labels schränken die gezählten Karten ein. Der Zeitraum wirkt nicht, denn der Bestand ist ein Jetzt-Stand. Die Leiste zeigt ihn für diesen Bericht ausgegraut mit dem Hinweis „Bestand: Zeitraum gilt nicht“.

### Live
- Der Bericht rechnet bei jeder Änderung im Ordner neu, wie das Board.

## Nicht-funktionale Anforderungen

- Performance: 500 offene Karten und 30 × 30 Zellen sind in unter 200 ms gerechnet und gezeichnet. Die Rechnung läuft im Browser über die Aufgaben, die schon geladen sind.
- Barrierefreiheit: Die Tabelle ist eine echte `<table>` mit Zeilen- und Spaltenköpfen, und die Farbe wird nie allein verwendet, weil die Zahl und der Tooltip die Klasse nennen.

## Akzeptanzkriterien

Grundbestand für die Beispiele (wo ein Kriterium nichts anderes sagt): Klassen in dieser Reihenfolge `sicherheit`, `eol`, `drift`; Board „fabrik“ mit den Spalten „Eingang“ und „Fertig“ (letzte Spalte); Einstellung `rows: repo, columns: nc`. Offene Karten in „Eingang“: #1 `[repo:shop, nc:304]` sicherheit, #2 `[repo:shop, nc:304]` drift, #3 `[repo:shop, nc:305]` eol, #4 `[repo:lager, nc:304]` ohne Klasse, #5 `[repo:lager]` drift. Nicht offen: #6 `[repo:shop, nc:304]` in „Fertig“, #7 `[repo:shop, nc:304]` archiviert.

### Rechnung
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann zeigt er shop × 304 = 2 (Farbe sicherheit), shop × 305 = 1 (eol), lager × 304 = 1 (ohne Klasse), lager × (ohne) = 1 (drift), alle übrigen Zellen leer; Summe shop = 3, lager = 2, Spalte 304 = 3 (#1, #2, #4), 305 = 1, (ohne) = 1, gesamt 5. #6 und #7 zählen nicht
- [ ] Gegeben der Grundbestand und dazu #8 `[repo:shop, nc:304, nc:305]` drift offen, wenn der Bericht geöffnet wird, dann shop × 304 = 3 und shop × 305 = 2 (Farbe eol: #3 eol ist dringender als #8 drift), Summe shop = 4 (nicht 5), Spalte 304 = 4, 305 = 2, gesamt 6 (nicht 7)
- [ ] Grenzwert Präfix: Gegeben der Grundbestand und dazu offen #9 `[repo:shop, nc:304:a]` ohne Klasse und #10 `[dringend, repo:lager]` drift, wenn der Bericht geöffnet wird, dann gibt es die Spalte `304:a` mit shop × 304:a = 1 (Präfix ist der Text vor dem ersten Doppelpunkt), lager × (ohne) = 2 (#5, #10), gesamt 7, und `dringend` (ohne Doppelpunkt) bildet keinen Präfix, steht also in keinem Auswahlfeld
- [ ] Leerfall: Gegeben die Einstellung `rows: repo, columns: nc` und alle Karten des Boards liegen in „Fertig“ oder sind archiviert, wenn der Bericht geöffnet wird, dann zeigt er nur die Zeile „(ohne)“ und die Spalte „(ohne)“ mit leerer Zelle und gesamt 0, und es entsteht kein Commit

### Filterleiste
- [ ] Gegeben der Grundbestand und die Filterleiste schließt die Klasse drift aus, wenn der Bericht geöffnet wird, dann shop × 304 = 1 (nur #1), lager × (ohne) bleibt leer, Summe shop = 2, lager = 1, gesamt 3
- [ ] Gegenbeispiel Zeitraum: Gegeben der Grundbestand und in der Filterleiste ist der Zeitraum „letzte Woche“ gespeichert, wenn der Bericht geöffnet wird, dann bleiben alle Zahlen wie im ersten Kriterium (gesamt 5), und der Zeitraum steht ausgegraut mit dem Hinweis „Bestand: Zeitraum gilt nicht“

### Bedienung
- [ ] Gegeben der Grundbestand, wenn auf shop × 304 geklickt wird, dann zeigt das Board den Filter `label:repo:shop label:nc:304`, und sichtbar sind #1, #2 und #6. #6 liegt in „Fertig“ und wird vom Board-Filter gezeigt, obwohl die Zelle nur offene Karten zählt. Das ist gewollt, die Zählung nennt es im Tooltip „ohne Abschlussspalte“
- [ ] Gegenbeispiel Klick: Gegeben der Grundbestand, wenn auf lager × (ohne) (Zahl 1), auf die Summe shop = 3 oder auf die leere Zelle shop × (ohne) geklickt wird, dann bleibt der Bericht offen und der Board-Filter unverändert; der Tooltip von lager × (ohne) und der Summe sagt, dass sie nicht klickbar sind
- [ ] Gegeben der Grundbestand, wenn der Zeiger auf shop × 304 steht, dann nennt der Tooltip die Zahl je Klasse in der Reihenfolge der Dringlichkeit, „sicherheit 1 · drift 1“, und „ohne Abschlussspalte“
- [ ] Gegeben im Feld „Zeilen“ ist `repo` gewählt, wenn das Feld „Spalten“ geöffnet wird, dann ist `repo` dort nicht wählbar, `nc` schon
- [ ] Gegeben der Bericht zeigt `rows: repo, columns: nc`, wenn Zeilen `nc` und Spalten `repo` gewählt werden, dann geht `PUT …/bestand` mit einem Commit hinaus, das Frontmatter trägt `report-labels: {rows: nc, columns: repo}`, und ein zweiter Browser zeigt den Wechsel live
- [ ] Gegeben ein Board ohne `report-labels` mit offenen Karten, die `repo:*` fünfmal und `nc:*` viermal tragen, wenn der Bericht geöffnet wird, dann schlägt er Zeilen `repo` und Spalten `nc` vor, und es entsteht kein Commit

### Ablage
- [ ] Gegeben das Board „fabrik“ ohne `report-labels`, wenn `GET /api/boards/fabrik` gefragt wird, dann ist `bestand: null`; nach `PUT /api/boards/fabrik/bestand {zeilen: "nc", spalten: "repo"}` liefert `GET` `bestand: {zeilen: "nc", spalten: "repo"}`, und `git log` hat genau einen Commit mehr
- [ ] Fehlfall: Gegeben das Board „fabrik“, wenn `PUT /api/boards/fabrik/bestand` mit `{zeilen: "nc", spalten: "nc"}`, mit `zeilen: ""` oder mit `zeilen: "repo:x"` (Doppelpunkt im Präfix) gesendet wird, dann antwortet der Server 400, und `boards/fabrik.md` und `git log` bleiben unverändert; `PUT /api/boards/gibtsnicht/bestand` → 404 ohne Commit

### Live
- [ ] Gegeben der Bericht ist offen und zeigt shop × 304 = 2, wenn über die API eine Karte `[repo:shop, nc:304]` in „Eingang“ angelegt wird, dann zeigt die Zelle ohne Neuladen 3, spätestens 1 s nach der Antwort der API (Vision: Live überall)

### Nicht-funktional
- [ ] Gegeben 500 offene Karten mit 30 Werten `repo:*` und 30 Werten `nc:*`, wenn der Bericht geöffnet wird, dann sind Rechnung und Tabelle in unter 200 ms fertig, gemessen vom Aufruf der Rechnung bis die Tabelle im Dokument steht (headless Chromium)
- [ ] Gegeben der Grundbestand, wenn die Tabelle mit einem Screenreader-Baum gelesen wird, dann ist sie eine `<table>` mit Spaltenköpfen (`th scope="col"`) und Zeilenköpfen (`th scope="row"`), und jede Zelle mit Zahl nennt ihre Klassen auch als Text (Tooltip bzw. zugänglicher Name), nicht nur als Farbe

## Betroffene Verzeichnisstruktur

Rechnung als reine Funktion in `web/berichte.js` (im Browser und mit Node-Unit-Tests nutzbar), Ansicht in `web/ansicht.js` neben `vStundenzettel`, Menüeintrag im Berichte-Menü (`web/ansicht.js`), Aktionen in `web/app.js`. Format und Endpunkt in `src/format/board.rs`, `src/dienst/berichtsfilter.rs` (oder daneben `src/dienst/bestand.rs`) und `src/web/mod.rs`. Die Tests liegen unter `tests/`, `e2e/tests/` und als Unit-Tests der JS-Funktionen.

## Technische Überlegungen

### Ablauf
1. **Einstellung lesen**: `S.board.bestand` oder ein Vorschlag aus den Präfixen
2. **Rechnen** (pure): `bestandNachLabels(aufgaben, board, klassen, zeilen, spalten, filter)` → `{zeilen, spalten, zellen, summen}`
3. **Zeichnen**: Tabelle mit Zahl und Farbe, Tooltip je Klasse
4. **Klick**: `filterSetzen('label:…:… label:…:…')`, Wechsel zum Board

### Grobentwurf

**Wichtige Einstiegsstellen:** Menü „Berichte“, Route `#/berichte/bestand`, `PUT /api/boards/{slug}/bestand`.

- `bestandNachLabels(...)` (pure Funktion, JS) — liefert die Tabelle
- `praefixe(aufgaben)` (pure, JS) — Präfixe mit Häufigkeit, für Auswahl und Vorschlag
- `dringendste(klassenDerZelle, reihenfolge)` (pure, JS)
- `Bestandseinstellung` (Rust-DTO) — `zeilen`, `spalten`
- `vBestand()` (Ansicht)

### Änderungen an bestehenden Klassen
- `format::board`: `report-labels` lesen und schreiben
- `Board`: Feld `bestand: Option<Bestandseinstellung>`
- Filterleiste: Zeitraum je Bericht abschaltbar

## Tests

**Unit (JS, Node):** `bestandNachLabels` mit den Rechenbeispielen der Kriterien, `praefixe`, `dringendste`.
**Integration:** `PUT …/bestand` schreibt das Frontmatter und `GET` liefert es, Rundreise mit Präfixen wie `nc`.
**E2E:** Bericht öffnen, Zahl und Farbe prüfen, Klick führt zum gefilterten Board, Präfixwechsel bleibt nach Neuladen.

## Abhängigkeiten
- Abhängig von: R00081 (Berichtsfilter am Board), R00095 (Labels mit Doppelpunkt geprüft)
- Blockiert: —

## Offene Fragen

Aus der Detailplanung (2026-11-06, Karte #6), Rückfrage an den Product Owner. Geplant ist jeweils nach der Empfehlung; entscheidet der PO anders, ändert sich nur die genannte Bubble.

- **Groß- und Kleinschreibung der Werte:** Sind `repo:Shop` und `repo:shop` eine Zeile oder zwei? Empfehlung: eine Zeile, ohne Groß/Klein zusammengefasst wie im Board-Filter und in der API (R00095), damit der Klick genau die gezählten Karten zeigt (B0347).
- **Reihenfolge „alphabetisch“ bei Zahlen:** Steht `nc:1000` vor `nc:304` (Textordnung) oder dahinter (natürliche Ordnung)? Empfehlung: natürliche Ordnung; „(ohne)“ steht jeweils am Ende (B0347).
- **Vorschlag bei weniger als zwei Präfixen und bei Gleichstand:** Was zeigt der Bericht ohne Einstellung, wenn offene Karten nur einen oder gar keinen Präfix tragen, und welcher Präfix gewinnt bei gleicher Häufigkeit? Empfehlung: gezählt wird je Präfix die Zahl offener Karten mit mindestens einem Label davon; bei Gleichstand alphabetisch; mit nur einem oder keinem Präfix statt der Tabelle der Hinweis „Zu wenige Label-Präfixe für eine Tabelle — Labels der Form präfix:wert“, ohne Commit (B0346, B0348).
- **Filterleiste und Klick:** Übernimmt der Klick auf eine Zelle die Ausschlüsse der Filterleiste (Klasse drift ausgeschlossen → Board zeigt drift-Karten nicht)? Empfehlung: nein, der Klick setzt nur die beiden `label:`-Wörter wie oben beschrieben, und der Tooltip nennt das neben „ohne Abschlussspalte“ (B0352).
- **Klassennamen im Tooltip:** Schlüssel (`sicherheit`) oder Bezeichnung aus `classes` (`Sicherheit`), und wie heißen Karten ohne Klasse? Empfehlung: Bezeichnung wie in der Filterleiste, „ohne Klasse“ für Karten ohne Klasse (B0348).

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

**Detailplanung 2026-11-06 (Karte #6):** Akzeptanzkriterien in die Form Gegeben/wenn/dann gebracht, Werte unverändert; ergänzt um Spaltensummen im Rechenbeispiel, Grenzwert Präfix, Leerfall, Gegenbeispiele für Zeitraum und Klick, Fehlfall und Rundreise der Ablage, Live sowie Leistung und Barrierefreiheit als Kriterien. User Story um US-5 und US-6 ergänzt. Die Richtung ist unverändert; offene Punkte stehen unter „Offene Fragen“. WBS: I0092.
