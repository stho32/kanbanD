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

### Rechnung
- [ ] Klassen in dieser Reihenfolge: `sicherheit`, `eol`, `drift`. Offene Karten: #1 `[repo:shop, nc:304]` sicherheit, #2 `[repo:shop, nc:304]` drift, #3 `[repo:shop, nc:305]` eol, #4 `[repo:lager, nc:304]` ohne Klasse, #5 `[repo:lager]` drift, #6 `[repo:shop, nc:304]` in „Fertig“, #7 `[repo:shop, nc:304]` archiviert. Mit `rows: repo, columns: nc` ergibt sich: shop × 304 = 2 (Farbe sicherheit), shop × 305 = 1 (eol), lager × 304 = 1 (ohne Klasse), lager × (ohne) = 1 (drift), Summe shop = 3, lager = 2, gesamt 5
- [ ] #8 `[repo:shop, nc:304, nc:305]` drift dazu → shop × 304 = 3 und shop × 305 = 2, Summe shop = 4 (nicht 5)
- [ ] Filterleiste „Klasse drift ausschließen“ → shop × 304 = 1, lager × (ohne) entfällt

### Bedienung
- [ ] Klick auf shop × 304 → Board mit dem Filter `label:repo:shop label:nc:304`, sichtbar sind #1, #2 und #6. #6 liegt in „Fertig“ und wird vom Board-Filter gezeigt, obwohl die Zelle nur offene Karten zählt. Das ist gewollt, die Zählung nennt es im Tooltip „ohne Abschlussspalte“
- [ ] Auswahl Zeilen `nc` und Spalten `repo` → `PUT …/bestand`, ein Commit, `report-labels: {rows: nc, columns: repo}` im Frontmatter, ein zweiter Browser zeigt den Wechsel live
- [ ] Ohne `report-labels` und mit den Labels `repo:*` (5×) und `nc:*` (4×) schlägt der Bericht Zeilen `repo` und Spalten `nc` vor, und es entsteht kein Commit

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
- keine

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
