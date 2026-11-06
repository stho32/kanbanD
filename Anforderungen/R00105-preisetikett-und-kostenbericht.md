---
id: R00105
status: Neu
datum: 2026-11-06
---

# R00105: Preisetikett je Aufgabe und Kostenbericht

## Beschreibung

Jede Aufgabe kann ein Preisetikett tragen: die geschätzten API-Kosten als Betrag, als Spanne oder als Liste von Positionen, immer mit Währung. Die Karte auf dem Board zeigt „≈“ und die Mitte, das Aufgabenfenster zeigt im Reiter „Kosten“ die Positionen, und der neue Bericht „Kosten“ summiert die Etiketten eines Boards je Währung über alle Spalten, auch über archivierte Aufgaben. Geschrieben wird das Etikett über die API, die Oberfläche liest es in dieser Ausbaustufe nur.

Zahlt ein auf: [Vision](R00000-vision.md) — Auswertungen rechnen aus dem, was geschehen ist; die Dateien sind der einzige Speicher.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Betreiber will jedem Feature einen Preis geben: was hat es an API-Kosten gekostet oder wird es kosten. Heute steht das nirgends am Werkstück. Mit dem Etikett sieht er den Preis auf der Karte, die Zusammensetzung im Fenster und die Summe eines Boards in einem Bericht, ohne Tabellenkalkulation neben dem Board.

## Funktionale Anforderungen

### Datenmodell (Karte #18, PO Z. 18, 28–33, 45–46, 81)
- Eine Aufgabe trägt höchstens einen Abschnitt `cost` mit `currency` (Pflicht, drei Großbuchstaben, z. B. `USD`), genau einem von `amount`, `min` + `max` oder `items`, und `basis` (Text, worauf die Schätzung beruht).
- `items` ist eine Liste von 1 bis 100 Positionen `{text, min, max, tokens}` oder `{text, amount, tokens}`; sind Positionen da, sind sie die Summe, ein Gesamtwert daneben ist ein Fehler.
- `tokens` dient nur der Anzeige; kanbanD rechnet nie aus Tokens einen Preis.
- Geldwerte sind Dollar-Dezimalzahlen mit höchstens zwei Nachkommastellen, von 0 bis 1.000.000,00 je Wert; eine Summe aus Positionen darf darüber liegen.
- Abgeleitete Werte (Mitte, Summen) werden nie gespeichert.

### Kosten setzen (Tür)
- Das Etikett wird über das Ändern einer Aufgabe gesetzt, einzeln und für mehrere Aufgaben; ein Wert ersetzt den ganzen Abschnitt, `null` entfernt ihn, ein fehlendes Feld lässt ihn unverändert.
- Jede Änderung ist ein Commit „#n geändert: Kosten“; ohne Änderung kein Commit.
- Jeder ungültige Wert wird mit 400 abgewiesen, die Meldung nennt den Pfad und bei Schutzwerten die Grenze; nichts wird geschrieben.
- Ein ungültiger Abschnitt in der Datei macht die Aufgabe defekt (nur lesbar), die Meldung nennt den Pfad.

### Preisetikett auf der Karte (PO Z. 19, 30)
- Die Karte zeigt „≈“ und die Mitte, kaufmännisch auf Cent gerundet.
- Beim Darüberfahren steht die Spanne (bzw. der Betrag) mit „geschätzte API-Kosten“; der zugängliche Name nennt „geschätzt <min> bis <max>“.
- Beschriftung auf der Karte „Preisetikett“.

### Reiter „Kosten“ (PO Z. 29, 31)
- Reiter „Kosten“ neben „Inhalt“ und „Datei“ im Aufgabenfenster.
- Tabelle `Position | Tokens | niedrig | hoch` mit Summenzeile; die Spalte Tokens nur, wenn eine Position Tokens trägt; darunter die Basis und „geschätzte API-Kosten“.
- Ohne Positionen eine Zeile „Gesamt“; ein Betrag steht in beiden Spalten.
- Nur lesend; Bearbeiten ist eine spätere Ausbaustufe.

### Kostenbericht (PO Z. 33, 79–83)
- Bericht „Kosten“ im Menü „Berichte“ mit eigener Route und Fenstertitel „Kosten — kanbanD“.
- **m** sind alle Aufgaben des Boards in jeder Spalte, auch in der Abschlussspalte, und alle archivierten (auch die außerhalb der Abschlussspalte archivierten, also verworfenen), soweit sie zur Filterleiste passen; **n** sind davon die mit Etikett. Aufgaben auf keinem Board zählen nicht; eine Aufgabe auf zwei Boards zählt in beiden.
- Je Währung eine Zeile „Summe <niedrig>–<hoch> · n von m Aufgaben mit Etikett, alle Spalten, auch archivierte“; beide Summen laufen über dieselben n Aufgaben; sind niedrig und hoch gleich, steht ein Betrag; keine Umrechnung zwischen Währungen.
- Jedes Etikett zählt genau einmal, auch eine Position „Gemeinkostenanteil“ und eine Sammelkarte.
- Sichtbare Texte sagen „Aufgaben“, nicht „Karten“.

### Filterleiste im Kostenbericht (PO Z. 77, 80)
- Klassen, Spalten, Zuständige und Labels der Filterleiste schränken m und n ein.
- Zeitraum und „Rechnen ab“ wirken nicht: die Gruppe Zeitraum ist ausgeblendet, die Zusammenfassung nennt „Zeitraum gilt hier nicht“, die Zahl aktiver Filter zählt ihn nicht, ein gespeicherter Zeitraum bleibt unverändert in der Board-Datei.

### Anzeige der Währung (PO Z. 81)
- Beträge werden deutsch mit Währungszeichen gezeigt: „1,63 $“, „25,55 €“, sonst Betrag mit Code („2,00 CHF“).

## Nicht-funktionale Anforderungen
- Genauigkeit: gerechnet wird in ganzen Cent; keine Gleitkomma-Abweichung in Mitte und Summen (ADR-0009).
- Verträglichkeit: kein API-Fehler zu `cost` antwortet mit 422 oder 500.
- Barrierefreiheit: das Preisetikett hat einen zugänglichen Namen mit der Spanne; die Tabelle des Reiters hat Spaltenköpfe.
- Bestand: keine vorhandene Aufgabe ändert sich; heute trägt keine `cost` (ADR-0009).

## Akzeptanzkriterien

Grundbestand für Karte und Reiter: Board „fabrik“ mit den Spalten Eingang, In Arbeit, Fertig (Abschlussspalte); Aufgabe #1 in Eingang. Grundbestand für den Kostenbericht: dazu #2 in In Arbeit mit `{currency: USD, amount: 1.63}`, #3 in Fertig ohne Etikett, #4 in Eingang ohne Etikett; #1 trägt `{currency: USD, min: 0.60, max: 1.60, basis: "Schätzung planer"}`.

### Kosten setzen
- [ ] Gegeben #1 ohne Etikett, wenn über die API `{currency: "USD", min: 0.6, max: 1.6, basis: "Schätzung planer"}` gesetzt wird, dann gibt es genau einen Commit „#1 geändert: Kosten“, die Datei enthält `min: 0.60` und `max: 1.60` in der Reihenfolge currency, min, max, basis, und das Lesen liefert 0.6 und 1.6
- [ ] Gegeben #1 mit diesem Etikett, wenn derselbe Wert noch einmal gesetzt wird, dann bleibt die Zahl der Commits gleich
- [ ] Gegeben #1 mit Etikett, wenn `cost: null` gesetzt wird, dann fehlt der Abschnitt in der Datei und es gibt genau einen Commit „#1 geändert: Kosten“
- [ ] Gegeben #1 mit Etikett, wenn nur der Titel geändert wird, dann bleibt der Abschnitt `cost` unverändert
- [ ] Gegeben #1 mit Etikett, wenn `{currency: "USD", amount: 1.1}` gesetzt wird, dann ersetzt der Betrag die Spanne und die Datei enthält `amount: 1.10`
- [ ] Grenzwert: Gegeben #1, wenn `amount: 1000000.00` gesetzt wird, dann 200; wenn `amount: 1000000.01` gesetzt wird, dann 400 mit „cost.amount: höchstens 1000000.00“
- [ ] Grenzwert: Gegeben #1, wenn 100 Positionen gesetzt werden, dann 200; wenn 101 gesetzt werden, dann 400 mit „cost.items: höchstens 100 Positionen“
- [ ] Grenzwert: Gegeben #1, wenn zwei Positionen mit je `amount: 600000.00` gesetzt werden, dann 200 (die Summe 1.200.000,00 liegt über der Grenze je Wert und ist erlaubt)
- [ ] Grenzwert: Gegeben #1, wenn `amount: 0` gesetzt wird, dann 200; wenn `amount: 1.005` oder `amount: -1` gesetzt wird, dann 400
- [ ] Fehlfall: Gegeben #1, wenn `{amount: 1.63}` ohne currency gesetzt wird, dann 400 mit „cost: currency fehlt“
- [ ] Fehlfall: Gegeben #1, wenn `currency: "usd"` gesetzt wird, dann 400 (keine Umwandlung in Großbuchstaben)
- [ ] Fehlfall: Gegeben #1, wenn `amount: "1.63"` (Text) gesetzt wird, dann 400, nicht 422
- [ ] Fehlfall: Gegeben #1, wenn `amount: 1.63` zugleich mit `min: 0.60, max: 1.60` gesetzt wird, dann 400
- [ ] Fehlfall: Gegeben #1, wenn `min: 1.60, max: 0.60` gesetzt wird, dann 400; in einer Position an Stelle 2 mit „cost.items[1]: min > max“
- [ ] Fehlfall: Gegeben #1, wenn Positionen zugleich mit `amount` gesetzt werden, dann 400
- [ ] Fehlfall: Gegeben #1, wenn `items: []` oder eine Position mit Text „   “ gesetzt wird, dann 400
- [ ] Fehlfall: Gegeben #1, wenn `{currency: "USD", ammount: 1.63}` gesetzt wird, dann 400 mit „cost: unbekannter Schlüssel „ammount““
- [ ] Fehlfall: Gegeben #1 und #4, wenn ein ungültiges Etikett (currency `usd`) über das Ändern mehrerer Aufgaben gesetzt wird, dann 400 und keine der beiden Dateien ändert sich
- [ ] Gegeben ein beliebiger Fehlfall dieser Gruppe, wenn er abgewiesen wird, dann ist der Status 400 (nie 422, nie 500), die Datei byte-gleich und die Zahl der Commits gleich
- [ ] Gegeben eine von Hand geschriebene Aufgabe mit `cost: {amount: 1.63}` ohne currency, wenn der Ordner gelesen wird, dann ist die Aufgabe defekt, nur lesbar, mit der Meldung „cost: currency fehlt“
- [ ] Gegeben eine von Hand geschriebene Aufgabe mit `cost: {currency: USD, amount: 1.00, note: x}`, wenn der Titel geändert wird, dann steht `note: x` weiter in der Datei

### Preisetikett auf der Karte
- [ ] Gegeben #1 mit 0,60–1,60 USD, wenn das Board angesehen wird, dann zeigt die Karte „≈ 1,10 $“ (Mitte (60 + 160 + 1) ÷ 2 abgerundet = 110 Cent)
- [ ] Gegeben #1 mit 0,60–1,60 USD, wenn die Maus über dem Preisetikett steht, dann nennt der Hinweis „0,60–1,60 $“ und „geschätzte API-Kosten“, und der zugängliche Name enthält „geschätzt 0,60 bis 1,60 $“
- [ ] Gegeben #1 mit `amount: 1.63` USD, wenn das Board angesehen wird, dann zeigt die Karte „≈ 1,63 $“ und der zugängliche Name enthält „geschätzt 1,63 $“
- [ ] Grenzwert: Gegeben #1 mit 0,60–1,61 USD, wenn das Board angesehen wird, dann zeigt die Karte „≈ 1,11 $“ (1,105 kaufmännisch aufgerundet)
- [ ] Gegeben #1 mit Positionen 0,10–0,20, 0,20–0,40 und 0,30 USD, wenn das Board angesehen wird, dann zeigt die Karte „≈ 0,75 $“ (Summe 0,60–0,90, Mitte 75 Cent)
- [ ] Gegeben #1 mit `{currency: EUR, amount: 25.55}`, wenn das Board angesehen wird, dann zeigt die Karte „≈ 25,55 €“
- [ ] Leerfall: Gegeben #4 ohne Etikett, wenn das Board angesehen wird, dann trägt die Karte kein Preisetikett
- [ ] Gegeben #1 mit 0,60–1,60 USD, wenn das Board angesehen wurde, dann enthält die Datei von #1 keine Mitte (byte-gleich wie vorher)

### Reiter Kosten
- [ ] Gegeben #1 mit Positionen Planung (0,10–0,20, 12000 Tokens), Bau (0,20–0,40), Gemeinkostenanteil (0,30), wenn das Aufgabenfenster den Reiter „Kosten“ zeigt, dann stehen die Zeilen in dieser Reihenfolge mit den Spalten Position, Tokens, niedrig, hoch und die Summenzeile „12.000 · 0,60 $ · 0,90 $“, darunter „Schätzung planer“ und „geschätzte API-Kosten“
- [ ] Gegeben #1 mit 0,60–1,60 USD ohne Positionen, wenn der Reiter „Kosten“ gezeigt wird, dann steht genau eine Zeile „Gesamt · 0,60 $ · 1,60 $“ und keine Spalte Tokens
- [ ] Gegeben #1 mit `amount: 1.63`, wenn der Reiter „Kosten“ gezeigt wird, dann steht „Gesamt · 1,63 $ · 1,63 $“
- [ ] Gegeben #1 mit zwei Positionen ohne Tokens, wenn der Reiter „Kosten“ gezeigt wird, dann fehlt die Spalte Tokens
- [ ] Leerfall: Gegeben #4 ohne Etikett, wenn das Aufgabenfenster geöffnet wird, dann gibt es keinen Reiter „Kosten“ (nach Empfehlung geplant, siehe Offene Fragen)
- [ ] Gegeben #1 mit Etikett, wenn der Reiter „Kosten“ geöffnet wird, dann gibt es kein Eingabefeld und Datei und Zahl der Commits bleiben gleich

### Kostenbericht
- [ ] Gegeben der Grundbestand, wenn der Bericht „Kosten“ für „fabrik“ geöffnet wird, dann steht „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“ (0,60 + 1,63 = 2,23; 1,60 + 1,63 = 3,23)
- [ ] Gegeben der Grundbestand plus #5 archiviert aus Fertig mit 0,50 USD und #6 archiviert aus Eingang (verworfen) mit 0,10–0,30 USD, wenn der Bericht geöffnet wird, dann steht „Summe 2,83–4,03 $ · 4 von 6 …“
- [ ] Gegeben der Grundbestand plus #5 und #6 wie oben und #7 in Eingang mit 25,55 EUR, wenn der Bericht geöffnet wird, dann stehen zwei Zeilen „Summe 2,83–4,03 $ · 4 von 7 …“ und „Summe 25,55 € · 1 von 7 …“, ohne Umrechnung
- [ ] Gegeben der Grundbestand plus eine Aufgabe auf keinem Board mit 5,00 USD, wenn der Bericht geöffnet wird, dann bleibt „Summe 2,23–3,23 $ · 2 von 4 …“
- [ ] Gegeben eine Aufgabe mit 1,00 USD auf den Boards „fabrik“ und „lager“, wenn der Bericht für jedes der beiden Boards geöffnet wird, dann zählt sie in beiden
- [ ] Gegeben der Grundbestand plus #8 in Eingang mit dem Titel „Gemeinkosten“, dem Label `gemeinkosten` und 2,00 USD, wenn der Bericht geöffnet wird, dann steht „Summe 4,23–5,23 $ · 3 von 5 …“ (keine Ausnahme nach Titel oder Label)
- [ ] Gegeben `reporting: {cost: false}` von Hand in #2, wenn der Bericht geöffnet wird, dann zählt #2 weiter mit und der Schlüssel bleibt in der Datei
- [ ] Leerfall: Gegeben #1–#4 ohne Etikett, wenn der Bericht geöffnet wird, dann steht „Keine Aufgabe mit Preisetikett · 0 von 4 Aufgaben, alle Spalten, auch archivierte“
- [ ] Gegeben der Bericht ist offen, wenn über die API #4 `{currency: USD, amount: 1.00}` bekommt, dann steht innerhalb von 1 s ohne Neuladen „Summe 3,23–4,23 $ · 3 von 4 …“
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann ist der Fenstertitel „Kosten — kanbanD“ und die Zahl der Commits bleibt gleich

### Filterleiste im Kostenbericht
- [ ] Gegeben der Grundbestand, wenn die Spalte „Fertig“ ausgeschlossen wird, dann steht „Summe 2,23–3,23 $ · 2 von 3 …“ (m schrumpft, n nicht)
- [ ] Gegeben der Grundbestand, wenn die Spalte „Eingang“ ausgeschlossen wird, dann steht „Summe 1,63 $ · 1 von 2 …“
- [ ] Gegeben der Grundbestand mit #2 in Klasse drift, wenn die Klasse drift ausgeschlossen wird, dann steht „Summe 0,60–1,60 $ · 1 von 3 …“; Zuständige und Labels schränken auf dieselbe Weise ein
- [ ] Leerfall: Gegeben der Grundbestand, wenn alle drei Spalten ausgeschlossen sind, dann steht der Leerzustand mit „Zurücksetzen“, und „Zurücksetzen“ führt zurück zu „2 von 4“
- [ ] Gegeben im Board „fabrik“ gespeichert sind Zeitraum „letzte Woche“ und ein „Rechnen ab“, wenn der Bericht geöffnet wird, dann steht „Summe 2,23–3,23 $ · 2 von 4 …“, die Gruppe Zeitraum fehlt, die Zusammenfassung nennt „Zeitraum gilt hier nicht“ und zählt den Zeitraum nicht als aktiven Filter
- [ ] Gegeben derselbe gespeicherte Zeitraum, wenn der Kostenbericht geöffnet und wieder verlassen wird, dann ist die Board-Datei byte-gleich und das Burndown zeigt weiter „letzte Woche“

## Betroffene Verzeichnisstruktur
- Server: Modelltyp neben `src/modell/aufgabe.rs`, Dateiformat in `src/format/aufgabe.rs`, Tür und OpenAPI über die bestehende Aufgabenänderung und `src/web/endpunkte.rs`; Integrationstests unter `tests/`.
- Oberfläche: Rechnung in `web/kosten.js` (neu, rein, neben `web/berichte.js`), Darstellung in `web/ansicht.js` und `web/kd-app.css`, Route in `web/app.js`; Unit-Tests `e2e/einheit/kosten.test.js`, E2E `e2e/tests/r00105-preisetikett.spec.js` und `r00105-kostenbericht.spec.js`.

## Technische Überlegungen

Alle Entscheidungen zur Technik stehen in [ADR-0009](../Dokumentation/ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) und werden hier nicht wiederholt. Die Bubbles der WBS (I0093, I0094) sind **Vorplanung**; welche es beim Bauen werden, entscheidet der Entwickler.

### Ablauf
1. **Kosten setzen** (F0038, frei baubar)
   - 1.1 Rohwert aus der Anfrage umwandeln, ohne serde-Typisierung (B0365)
   - 1.2 `Kosten` bauen und prüfen, eine Prüfung für Datei und API (B0363)
   - 1.3 Abschnitt in der Datei lesen und schreiben, Rundlauf (B0364)
   - 1.4 PATCH einzeln und `/mehrere`, GET, OpenAPI (B0366)
2. **Anzeigen** (Oberfläche, Chip und Reiter warten auf die Freigabe der Artboards)
   - 2.1 Cent-Rechnung und Format in `web/kosten.js` (B0367, frei)
   - 2.2 Preisetikett auf der Karte (B0368, wartet D0002)
   - 2.3 Kostentabelle rechnen (B0369, frei), Reiter zeigen (B0370, wartet D0003)
3. **Kostenbericht**
   - 3.1 Bericht rechnen (B0371, frei), Filter ohne Zeitraum (B0373, frei)
   - 3.2 Ansicht mit Menüeintrag (B0372, wartet D0006), Filterleiste ohne Zeitraum (B0374, wartet D0006)

### Grobentwurf

**Wichtige Einstiegsstellen:** `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` (Feld `cost`); Kartendarstellung und Reiterleiste des Aufgabenfensters in `web/ansicht.js`; Menü der Berichte (`vBerichtePop`) und die seiten-Map in `web/app.js` für `#/berichte/kosten`.

**Elemente** (Signaturen nach ADR-0009):
- `Kosten` (Wertobjekt, immutable) — Währung, Basis und Gesamt; wird nur über den prüfenden Konstruktor gebaut.
- `Gesamt` (Variante) — `Betrag`, `Spanne {min, max}` oder `Positionen`.
- `Position` (Wertobjekt) — Text, Wert, Tokens (optional).
- `kostenInCent(cost)` (rein, JS) — Dollar aus GET → Cent, Gesamt aus Positionen, Mitte.
- `betragText(cent, waehrung)` (rein, JS) — „1,63 $“, „25,55 €“, „2,00 CHF“.
- `kostentabelle(kosten)` (rein, JS) — Zeilen, Summenzeile, Spalte Tokens ja/nein.
- `kostenbericht(board, aufgaben, filter)` (rein, JS) — m und je Währung n, niedrig, hoch.

### Gestaltung
- Artboards: `Dokumentation/Wireframes/D0002.dc.html` (Zustand Preisetikett auf der Karte mit Hinweis), `D0003.dc.html` (Reiter „Kosten“), `D0006.dc.html` (Bericht „Kosten“ mit Filterleiste ohne Zeitraum und Leerzustand). Die Zustände fehlen noch; sie entstehen vor dem Bau über `/wireframe verfeinern` und brauchen die Freigabe des Auftraggebers (PO Z. 34, 76).

### Änderungen an bestehenden Klassen
- Aufgabe und Aufgabenänderung: neues entfernbares Feld `cost`.
- `vBerichtsfilter`: für den Kostenbericht ohne Gruppe Zeitraum und ohne „Rechnen ab“ (gleicher Satz wie B0355 aus R00100).

### Umfang
- I0093: 8 Bubbles, 7–14 h; I0094: 4 Bubbles, 3–6 h; zusammen 12 Bubbles, 10–20 h. Richtwerte nach dem Muster der Nachbar-Interactions, ungemessen. Alles bis Bubble geplant.

## Tests
Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** Konstruktor `Kosten` je Regel mit Grenz- und Gegenwert; Rundlauf des Formats über alle Cent-Werte 0–100.000 plus Ränder; Umwandlung des Rohwerts je Fehlfall; `web/kosten.js`: Mitte 0,60/1,61 → 1,11, 0,10 + 0,20 + 0,30 → 0,60, Format je Währung, Kostentabelle, Kostenbericht mit allen Rechenbeispielen der Akzeptanzkriterien.

**Integration:** PATCH einzeln und `/mehrere` gegen einen echten Ordner mit Git: Commit-Zahl vorher/nachher, Datei neu gelesen, jeder Fehlfall 400 mit Datei byte-gleich; defekte Datei → nur lesbar.

**E2E:** US-1 bis US-14 gegen das laufende Programm auf freiem Port; Live mit Warten auf das Ereignis; Prüfsumme der Board-Datei vor und nach dem Öffnen des Berichts.

## Abhängigkeiten
- Abhängig von: R00004 Board ansehen (I0004, gruen), R00011 Aufgabe ansehen und bearbeiten (I0011, gruen), R00081 Berichtsfilter (I0069, gruen); Freigabe der Artboards D0002, D0003, D0006 durch den Auftraggeber.
- Berührt: R00100 Bestand nach Labels (I0092, rot) — derselbe Satz „Zeitraum gilt hier nicht“ und dieselbe Menügruppe; wer zuerst gebaut wird, legt beides an.
- Blockiert: —

## Offene Fragen
- Freigabe der Artboards D0002, D0003 und D0006 beim Auftraggeber (PO Z. 76); bis dahin warten die Oberflächen-Bubbles.
- Reiter „Kosten“ bei einer Aufgabe ohne Etikett: geplant nach Empfehlung ohne Reiter; alternativ Reiter mit „Kein Preisetikett“.
- Ort und Name des Berichts: geplant nach Empfehlung als „Kosten“ in der Gruppe BESTAND hinter „Bestand nach Labels“, Route `#/berichte/kosten`.
- Reihenfolge der Währungszeilen: geplant USD zuerst, dann alphabetisch.

## Manuelle Vorbereitungstätigkeiten
- Artboards D0002, D0003, D0006 um die Zustände ergänzen und vom Auftraggeber freigeben lassen.

## Manuelle Nachbereitungstätigkeiten
- Keine. Die Factory beschreibt das Etikett nach der Abnahme in ihrer Rolle; das ist eine Änderung der Factory, nicht dieser Anforderung.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Auftrag, jedem Feature einen Preis zu geben; heute stehen API-Kosten nirgends am Werkstück und lassen sich nicht über ein Board summieren. Wenn jede Aufgabe ein geprüftes Etikett mit Währung in ihrer Datei trägt, dann können Agenten es über die bestehende Tür schreiben, und die Datei bleibt ohne kanbanD lesbar. Weil alles in ganzen Cent und nur im Browser gerechnet wird, stimmen Mitte und Summen auf den Cent, und nichts Abgeleitetes veraltet in der Datei. Der Bericht über alle Spalten und das Archiv macht daraus die Antwort „was hat dieses Board gekostet“, ohne fertige oder verworfene Arbeit zu vergessen. Der Hebel ist die Aufgabendatei, weil sie der einzige Speicher ist: ein Bericht ohne Etikett hätte keine Quelle, ein Etikett ohne Bericht keine Summe.

## Missing-Docs
- Ausgabe von `Intl.NumberFormat('de-DE', {style: 'currency'})` je Währung (geschütztes Leerzeichen vor dem Zeichen, „CHF“ als Code) ist aus Erfahrung angenommen und im Unit-Test festzuhalten.

## Notizen
- Die Abnahme-Probe der Karte #18 nannte für die Spanne „0,60–1,60 $“ auf der Karte; nach PO Z. 30 zeigt die Karte „≈ 1,10 $“, die Spanne steht im Hinweis. Die übrigen Proben (1,63; Summe 2,23–3,23 $ · 2 von m; 400 bei Betrag und Spanne zugleich oder min > max) stehen wörtlich in den Kriterien.
- **Bewusst außerhalb:** ein Schalter `reporting.cost` (PO Z. 82); das Erkennen oder Ausnehmen von Gemeinkosten (PO Z. 83); Bearbeiten des Etiketts in der Oberfläche; Rechnen aus Tokens (PO Z. 18); Umrechnung zwischen Währungen und eine EUR-Schaltung (PO Z. 45–46); ein Zeitraum nach Ankunft in der Abschlussspalte (PO Z. 80, spätere Ausbaustufe auf Wunsch).
- **Verworfene Alternativen** (Schnitt): eine Interaction für alles — 12 Bubbles und zwei Dialogs, über der Schnittgrenze; Chip als eigene Interaction unter D0002 — er hat keine eigene Tür, nur Darstellung derselben Daten.
- **Detailplanung:** WBS I0093 (F0038–F0040, B0363–B0370) und I0094 (F0041–F0042, B0371–B0374), 2026-11-06.
