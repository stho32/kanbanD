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

### Preisetikett auf der Karte (PO Z. 19, 30, 91, 92, 99)
- Die Karte zeigt „≈“ und die Mitte, kaufmännisch auf Cent gerundet.
- Beim Darüberfahren steht die Spanne (bzw. der Betrag) mit „geschätzte API-Kosten“, z. B. „0,60–1,60 $ · geschätzte API-Kosten“.
- Der zugängliche Name steht als visuell versteckter Text im Etikett, nicht als `aria-label` an einem Element ohne Rolle: „Preisetikett: geschätzt <min> bis <max>, geschätzte API-Kosten“, bei einem Betrag „Preisetikett: geschätzt <Betrag>, geschätzte API-Kosten“. Das sichtbare „≈ <Mitte>“ ist `aria-hidden`.
- Das Etikett heißt im zugänglichen Namen „Preisetikett“; sichtbar steht nur „≈ <Betrag>“.
- Das Etikett steht in der Zeile r3 der Karte vor „Σ“ und sieht aus wie die Zeitsumme `.sum` (Text, kein Rahmen), nicht wie ein Label. Kontrast mindestens 4,5:1 in Hell und Dunkel, auch auf dem getönten Grund jeder Klassenfarbe. „Chip“ in den PO-Zeilen 21 und 30 meint dieses Element.

### Reiter „Kosten“ (PO Z. 29, 31, 85, 88, 90, 93, 94, 98)
- Reiter „Kosten“ neben „Inhalt“ und „Datei“ im Aufgabenfenster, nur bei einer Aufgabe mit Etikett. Ohne Etikett zeigt das Fenster genau die Reiter „Inhalt“ und „Datei“; einen Reiter mit „Kein Preisetikett“ gibt es nicht.
- Reiterleiste (gilt für alle drei Reiter, eine Komponente): Die Reiter Inhalt, Datei und Kosten liegen in einem Element `role=tablist` mit dem Namen „Ansicht der Aufgabe“. Jeder Reiter hat `role=tab`, `aria-selected` und `aria-controls` auf ein `role=tabpanel`. Nur der gewählte Reiter hat `tabindex=0`, die anderen `-1`. ← und → bewegen den Fokus zum vorigen bzw. nächsten Reiter mit Umlauf und zeigen dessen Inhalt sofort; Pos1 und Ende springen zum ersten bzw. letzten Reiter; Enter und Leertaste zeigen den Inhalt des fokussierten Reiters. Nach jedem Wechsel steht der Fokus auf dem gewählten Reiter. `d` wechselt wie bisher zu Datei, aus Datei zu Inhalt. Die Kürzelhilfe des Aufgabenfensters nennt „← →“ mit „Reiter wechseln (Fokus auf einem Reiter)“.
- Rückfall: Hat die gezeigte Aufgabe kein Etikett mehr (Blättern zu einer Aufgabe ohne Etikett oder Etikett live entfernt), zeigt das Fenster „Inhalt“. Lag der Fokus auf der Reiterleiste oder im Panel „Kosten“, steht er danach auf dem Reiter „Inhalt“; lag er woanders (Titel, Kommentar, Blätterknopf), bleibt er dort.
- Tabelle `Position | Tokens | niedrig | hoch` mit der Beschriftung (`caption`) „Geschätzte API-Kosten (<Währungscode>)“, also „(USD)“ oder „(EUR)“ je Aufgabe. Die Spaltenköpfe sind `th scope=col`, jede Zeile beginnt mit `th scope=row` (Position, „Gesamt“, „Summe“). Die Summenzeile beginnt mit „Summe“. Die Spalte Tokens steht nur, wenn eine Position Tokens trägt. Unter der Tabelle steht die Basis; der Satz „geschätzte API-Kosten“ steht nur in der Beschriftung, nicht noch einmal darunter.
- Ohne Positionen eine Zeile „Gesamt“; ein Betrag steht in beiden Spalten.
- Bei 320, 375 und 414 px Breite sind im Kopf des Aufgabenfensters alle Reiter und ✕ sichtbar und bedienbar, und der Kopf scrollt nicht waagrecht (`scrollWidth ≤ clientWidth`), in Hell und Dunkel.
- Nur lesend; Bearbeiten ist eine spätere Ausbaustufe.

### Kostenbericht (PO Z. 33, 79–83, 86, 87, 89, 95–97, 103–105)
- Bericht „Kosten“ im Menü „Berichte“ in der Gruppe BESTAND hinter „Bestand nach Labels“, mit eigenem Symbol und der Beschreibung „Geschätzte API-Kosten je Währung – alle Spalten, auch archivierte Aufgaben.“; Route `#/berichte/kosten`, Fenstertitel „Kosten — kanbanD“. Wird R00105 vor R00100 gebaut, legt es die Gruppe BESTAND an.
- Kopfleiste „Kosten · geschätzte API-Kosten · liest nur“.
- **m** sind alle Aufgaben des Boards in jeder Spalte, auch in der Abschlussspalte, und alle archivierten (auch die außerhalb der Abschlussspalte archivierten, also verworfenen), soweit sie zur Filterleiste passen; **n** sind davon die mit Etikett. Aufgaben auf keinem Board zählen nicht; eine Aufgabe auf zwei Boards zählt in beiden.
- Je Währung eine Zeile „Summe <niedrig>–<hoch> · n von m Aufgaben mit Etikett, <Umfang>“; beide Summen laufen über dieselben n Aufgaben; sind niedrig und hoch gleich, steht ein Betrag („Summe 1,63 $“); die Summe trägt kein „≈“; keine Umrechnung zwischen Währungen. Reihenfolge der Zeilen: USD zuerst, danach alphabetisch nach ISO-Code.
- **Umfang**: ohne aktiven Filter „alle Spalten, auch archivierte“, mit mindestens einem aktiven Filter „nach Filter, auch archivierte“. Aktiv ist, was die Filterleiste als aktiv zählt (`filterAnzahl`), ein gespeicherter Zeitraum also nicht. Gilt für die Summenzeilen und für den Leerzustand ohne Etikett.
- Leerzustand ohne Etikett (n = 0, und m > 0 oder kein aktiver Filter): „Keine Aufgabe mit Preisetikett · 0 von m Aufgaben, <Umfang>“, darunter „Preisetiketten setzt ein Agent über die API (Feld `cost` beim Ändern einer Aufgabe).“ und der Link „API für Agenten“ auf die Seite der Agenten-Schnittstelle (D0007): `href="/api"`, öffnet in einem neuen Tab mit `rel="noopener"` — Text, Ziel und Verhalten wie der Link in der Statuszeile (R00024).
- Leerzustand nach Filter (m = 0 bei mindestens einem aktiven Filter): „Keine Aufgaben, die zu den Filtern der Berichte passen.“ und darunter der Knopf „Zurücksetzen“ der Filterleiste, derselbe wie in R00100, ohne Zahl im Knopf; die Zahl aktiver Filter steht in der Zusammenfassung.
- **Zurücksetzen in jedem Leerzustand**: Der Knopf „Zurücksetzen“ (ohne Zahl) steht in jedem Leerzustand, sobald mindestens ein Filter aktiv ist (`filterAnzahl` > 0) — im Leerzustand ohne Etikett unter dem Hinweis auf die API —, und nie ohne aktiven Filter. Ein Klick hebt die Filter nach Klassen, Spalten, Zuständigen und Labels auf und zeigt den Bericht ohne Filter („alle Spalten, auch archivierte“); Zeitraum, Messbasis und „Rechnen ab“, die hier nicht gelten, bleiben unverändert in der Board-Datei. Regel für alle Berichte (PO Z. 106): „Zurücksetzen“ hebt genau die Filter auf, die die Leiste des gezeigten Berichts zeigt und als aktiv zählt; was der Bericht ausblendet, bleibt gespeichert.
- **Schmale Breiten**: Bei 320, 375 und 414 px Breite scrollt die ganze Seite des Kostenberichts nicht waagrecht (`document.documentElement.scrollWidth ≤ clientWidth`). Kopfleiste, Filterleiste (zu- und aufgeklappt), Summenzeilen, beide Leerzustände, Link „API für Agenten“ und Knopf „Zurücksetzen“ liegen ganz im sichtbaren Bereich und sind bedienbar; Summenzeilen brechen um. Anders als im Bestand nach Labels (R00100) scrollt auch kein Teil quer, weil der Bericht keine breite Tabelle hat.
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
- Barrierefreiheit: das Preisetikett hat einen zugänglichen Namen mit der Spanne als visuell versteckten Text, „≈“ ist `aria-hidden`; die Reiterleiste folgt dem Muster „Tabs“ der WAI-ARIA APG mit automatischer Aktivierung; die Tabelle des Reiters hat `caption`, Spaltenköpfe `th scope=col` und Zeilenköpfe `th scope=row`; Kontrast des Etiketts mindestens 4,5:1 (WCAG 2.1 SC 1.4.3); der Kopf des Aufgabenfensters und die ganze Seite des Kostenberichts scrollen ab 320 px nicht waagrecht (SC 1.4.10).
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
- [ ] Gegeben #1 mit 0,60–1,60 USD, wenn der zugängliche Name des Preisetiketts gelesen wird, dann lautet er „Preisetikett: geschätzt 0,60 bis 1,60 $, geschätzte API-Kosten“ und stammt aus einem visuell versteckten Text im Etikett; das sichtbare „≈ 1,10 $“ trägt `aria-hidden="true"`, und das Etikett trägt kein `aria-label`
- [ ] Gegeben #1 mit `amount: 1.63` USD, wenn der zugängliche Name des Preisetiketts gelesen wird, dann lautet er „Preisetikett: geschätzt 1,63 $, geschätzte API-Kosten“
- [ ] Gegenbeispiel: Gegeben #1 mit 0,60–1,60 USD, wenn der sichtbare Text der Karte gelesen wird (`innerText`), dann enthält er „≈ 1,10 $“, aber nicht „Preisetikett“ und nicht „geschätzt“
- [ ] Gegeben #1 mit 0,60–1,60 USD und gebuchter Zeit, wenn das Board angesehen wird, dann steht das Preisetikett in der Zeile r3 unmittelbar vor „Σ …“, ohne Rahmen und ohne eigenen Hintergrund wie `.sum`
- [ ] Gegenbeispiel: Gegeben #1 mit 0,60–1,60 USD und dem Label `repo:shop`, wenn das Board angesehen wird, dann steht in der Labelzeile r1 nur „repo:shop“, und das Preisetikett trägt nicht die Gestalt eines Labels (`.lbl`)
- [ ] Gegeben je Klasse des Boards eine Aufgabe dieser Klasse mit 0,60–1,60 USD, wenn das Board in Hell und in Dunkel angesehen wird, dann ist der Kontrast zwischen der Textfarbe des Preisetiketts und dem berechneten Hintergrund seiner Karte jeweils mindestens 4,5:1 (relative Leuchtdichte nach WCAG 2.1, Rechenbeispiel: #5b6470 auf #ffffff = (1,05) ÷ (0,1251 + 0,05) = 6,0:1)

### Reiter Kosten
- [ ] Gegeben #1 mit Positionen Planung (0,10–0,20, 12000 Tokens), Bau (0,20–0,40), Gemeinkostenanteil (0,30), wenn das Aufgabenfenster den Reiter „Kosten“ zeigt, dann trägt die Tabelle die Beschriftung „Geschätzte API-Kosten (USD)“, die Zeilen stehen in dieser Reihenfolge mit den Spalten Position, Tokens, niedrig, hoch, die Summenzeile lautet „Summe · 12.000 · 0,60 $ · 0,90 $“, und darunter steht „Schätzung planer“, aber nicht noch einmal „geschätzte API-Kosten“
- [ ] Gegeben #1 mit denselben Positionen, wenn die Tabelle des Reiters gelesen wird, dann sind „Position“, „Tokens“, „niedrig“ und „hoch“ `th scope=col`, und die Zeilen beginnen mit `th scope=row` „Planung“, „Bau“, „Gemeinkostenanteil“ und „Summe“
- [ ] Gegeben #1 mit 0,60–1,60 USD ohne Positionen, wenn der Reiter „Kosten“ gezeigt wird, dann steht genau eine Zeile „Gesamt · 0,60 $ · 1,60 $“ mit „Gesamt“ als `th scope=row` und keine Spalte Tokens
- [ ] Gegeben #1 mit `amount: 1.63`, wenn der Reiter „Kosten“ gezeigt wird, dann steht „Gesamt · 1,63 $ · 1,63 $“
- [ ] Gegeben #1 mit `{currency: EUR, amount: 25.55}`, wenn der Reiter „Kosten“ gezeigt wird, dann lautet die Beschriftung „Geschätzte API-Kosten (EUR)“ und die Zeile „Gesamt · 25,55 € · 25,55 €“
- [ ] Gegeben #1 mit zwei Positionen ohne Tokens, wenn der Reiter „Kosten“ gezeigt wird, dann fehlt die Spalte Tokens
- [ ] Leerfall: Gegeben #4 ohne Etikett, wenn das Aufgabenfenster geöffnet wird, dann enthält die Reiterleiste genau zwei `role=tab`, „Inhalt“ und „Datei“, und keinen Reiter „Kosten“ oder „Kein Preisetikett“
- [ ] Gegeben #1 mit Etikett, wenn der Reiter „Kosten“ geöffnet wird, dann gibt es kein Eingabefeld und Datei und Zahl der Commits bleiben gleich
- [ ] Gegeben #1 mit Etikett, wenn das Aufgabenfenster geöffnet wird, mit Tab bis zum gewählten Reiter „Inhalt“ gegangen und zweimal → gedrückt wird, dann hat `document.activeElement` `role=tab`, den Namen „Kosten“ und `aria-selected=true`, ist das dritte von drei `role=tab` im Element `role=tablist` mit dem Namen „Ansicht der Aufgabe“, und das `role=tabpanel`, auf das sein `aria-controls` zeigt, zeigt die Kostentabelle; ein weiteres → setzt Fokus und Auswahl auf „Inhalt“ (Umlauf)
- [ ] Gegeben #1 mit Etikett und Fokus auf dem gewählten Reiter „Inhalt“, wenn ← gedrückt wird, dann stehen Fokus und Auswahl auf „Kosten“ (Umlauf rückwärts); wenn danach Pos1 gedrückt wird, auf „Inhalt“; wenn danach Ende gedrückt wird, auf „Kosten“; nach jedem Schritt hat nur der gewählte Reiter `tabindex=0`, die beiden anderen `-1`
- [ ] Gegeben #1 mit Etikett und Fokus auf dem Reiter „Datei“, wenn Enter und danach Leertaste gedrückt wird, dann zeigt das Panel jeweils den Inhalt von „Datei“, „Datei“ hat `aria-selected=true`, und der Fokus steht auf „Datei“
- [ ] Gegeben #1 mit Etikett im Reiter „Inhalt“ und Fokus nicht in einem Eingabefeld, wenn `d` gedrückt wird, dann zeigt das Fenster „Datei“; ein zweites `d` zeigt „Inhalt“; aus „Kosten“ führt `d` zu „Datei“
- [ ] Gegeben das Aufgabenfenster ist offen, wenn die Kürzelhilfe geöffnet wird, dann nennt sie „← →“ mit „Reiter wechseln (Fokus auf einem Reiter)“
- [ ] Gegenbeispiel: Gegeben #1 mit Etikett im Reiter „Inhalt“ und Fokus im Titelfeld, wenn → gedrückt wird, dann bewegt sich nur die Schreibmarke im Titel, und der gewählte Reiter bleibt „Inhalt“
- [ ] Gegeben #1 mit Etikett im Reiter „Kosten“ und #4 ohne Etikett direkt unter #1 in „Eingang“, wenn mit ↓ zu #4 geblättert wird, dann zeigt das Fenster das Panel „Inhalt“, und „Inhalt“ hat `aria-selected=true`
- [ ] Gegeben #1 mit Etikett im Reiter „Kosten“ und Fokus auf dem Reiter „Kosten“ (ebenso: Fokus im Panel „Kosten“), wenn über die API `cost: null` für #1 gesetzt wird, dann ist innerhalb von 1 s `document.activeElement` der Reiter „Inhalt“, er hat `aria-selected=true`, und es gibt zwei Reiter
- [ ] Gegenbeispiel: Gegeben #1 mit Etikett im Reiter „Kosten“ und Fokus im Titelfeld, wenn über die API `cost: null` für #1 gesetzt wird, dann zeigt das Fenster innerhalb von 1 s „Inhalt“, und der Fokus bleibt im Titelfeld
- [ ] Gegeben #1 mit Etikett, wenn das Aufgabenfenster bei 320, 375 und 414 px Breite jeweils in Hell und in Dunkel geöffnet wird, dann liegen die Reiter „Inhalt“, „Datei“, „Kosten“ und ✕ ganz im sichtbaren Bereich, ein Klick auf jeden wirkt, und für den Kopf des Fensters gilt `scrollWidth ≤ clientWidth`

### Kostenbericht
- [ ] Gegeben der Grundbestand, wenn der Bericht „Kosten“ für „fabrik“ geöffnet wird, dann steht „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“ (0,60 + 1,63 = 2,23; 1,60 + 1,63 = 3,23)
- [ ] Gegeben der Grundbestand plus #5 archiviert aus Fertig mit 0,50 USD und #6 archiviert aus Eingang (verworfen) mit 0,10–0,30 USD, wenn der Bericht geöffnet wird, dann steht „Summe 2,83–4,03 $ · 4 von 6 …“
- [ ] Gegeben der Grundbestand plus #5 und #6 wie oben und #7 in Eingang mit 25,55 EUR, wenn der Bericht geöffnet wird, dann stehen zwei Zeilen „Summe 2,83–4,03 $ · 4 von 7 …“ und „Summe 25,55 € · 1 von 7 …“, ohne Umrechnung
- [ ] Gegeben der Grundbestand plus eine Aufgabe auf keinem Board mit 5,00 USD, wenn der Bericht geöffnet wird, dann bleibt „Summe 2,23–3,23 $ · 2 von 4 …“
- [ ] Gegeben eine Aufgabe mit 1,00 USD auf den Boards „fabrik“ und „lager“, wenn der Bericht für jedes der beiden Boards geöffnet wird, dann zählt sie in beiden
- [ ] Gegeben der Grundbestand plus #8 in Eingang mit dem Titel „Gemeinkosten“, dem Label `gemeinkosten` und 2,00 USD, wenn der Bericht geöffnet wird, dann steht „Summe 4,23–5,23 $ · 3 von 5 …“ (keine Ausnahme nach Titel oder Label)
- [ ] Gegeben `reporting: {cost: false}` von Hand in #2, wenn der Bericht geöffnet wird, dann zählt #2 weiter mit und der Schlüssel bleibt in der Datei
- [ ] Leerfall: Gegeben #1–#4 ohne Etikett und kein aktiver Filter, wenn der Bericht geöffnet wird, dann steht „Keine Aufgabe mit Preisetikett · 0 von 4 Aufgaben, alle Spalten, auch archivierte“, darunter „Preisetiketten setzt ein Agent über die API (Feld `cost` beim Ändern einer Aufgabe).“ und der Link „API für Agenten“, und es gibt keinen Knopf „Zurücksetzen“
- [ ] Gegeben #1–#4 ohne Etikett, wenn der Link „API für Agenten“ im Leerzustand gelesen und angeklickt wird, dann trägt er `href="/api"`, `target="_blank"` und ein `rel`, das `noopener` enthält, der Klick öffnet einen zweiten Tab mit der Seite `/api`, und der erste Tab zeigt weiter den Bericht „Kosten“; auf der Seite heißen beide Links auf `/api` (Statuszeile und Leerzustand) „API für Agenten“, kein dritter Name wie „Agenten-Schnittstelle“
- [ ] Gegenbeispiel: Gegeben ein Board „leer“ ohne Aufgaben und ohne aktiven Filter, wenn der Bericht geöffnet wird, dann steht „Keine Aufgabe mit Preisetikett · 0 von 0 Aufgaben, alle Spalten, auch archivierte“ mit dem Hinweis auf die API und ohne Knopf „Zurücksetzen“, nicht „Keine Aufgaben, die zu den Filtern der Berichte passen.“
- [ ] Gegeben der Bericht ist offen, wenn über die API #4 `{currency: USD, amount: 1.00}` bekommt, dann steht innerhalb von 1 s ohne Neuladen „Summe 3,23–4,23 $ · 3 von 4 …“
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann ist der Fenstertitel „Kosten — kanbanD“ und die Zahl der Commits bleibt gleich
- [ ] Gegeben der Grundbestand, wenn der Bericht geöffnet wird, dann lautet die Kopfleiste „Kosten · geschätzte API-Kosten · liest nur“, und die Summenzeile enthält kein „≈“
- [ ] Gegeben das Menü „Berichte“ ist offen, wenn die Gruppe BESTAND gelesen wird, dann steht dort der Eintrag „Kosten“ mit eigenem Symbol und der Beschreibung „Geschätzte API-Kosten je Währung – alle Spalten, auch archivierte Aufgaben.“, hinter „Bestand nach Labels“, falls R00100 gebaut ist, sonst als einziger Eintrag der Gruppe; ein Klick darauf führt zur Route `#/berichte/kosten`
- [ ] Gegeben der Grundbestand plus #7 in Eingang mit 25,55 EUR und #8 in Eingang mit 2,00 CHF, wenn der Bericht geöffnet wird, dann stehen drei Zeilen in dieser Reihenfolge: „Summe 2,23–3,23 $ · 2 von 6 …“, „Summe 2,00 CHF · 1 von 6 …“, „Summe 25,55 € · 1 von 6 …“ (USD zuerst, dann CHF vor EUR nach ISO-Code)
- [ ] Gegenbeispiel: Gegeben derselbe Bestand, wenn der Bericht geöffnet wird, dann steht die EUR-Zeile trotz des größten Betrags nicht vor der CHF-Zeile und die USD-Zeile nicht zuletzt (keine Ordnung nach Betrag oder Zeichen)
- [ ] Schmal mit Summen: Gegeben der Grundbestand plus #7 in Eingang mit 25,55 EUR und die Spalte „Fertig“ ausgeschlossen (m = #1, #2, #4, #7 = 4), wenn der Bericht bei 320, 375 und 414 px Breite geöffnet und die Filterleiste auf- und wieder zugeklappt wird, dann stehen „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, nach Filter, auch archivierte“ und „Summe 25,55 € · 1 von 4 Aufgaben mit Etikett, nach Filter, auch archivierte“ umgebrochen da, Kopfleiste, Filterleiste und beide Summenzeilen liegen ganz im sichtbaren Bereich (linker Rand ≥ 0, rechter Rand ≤ Fensterbreite), und für die Seite gilt in jedem Zustand `document.documentElement.scrollWidth ≤ clientWidth`; ein Thema genügt
- [ ] Schmal in beiden Leerzuständen: Gegeben der Grundbestand, wenn der Bericht bei 320, 375 und 414 px Breite einmal mit ausgeschlossenen Spalten „Eingang“ und „In Arbeit“ (Leerzustand ohne Etikett, „0 von 1 Aufgaben“) und einmal mit allen drei Spalten ausgeschlossen (Leerzustand nach Filter) geöffnet wird, dann liegen Satz, Hinweis, Link „API für Agenten“ (nur im ersten) und Knopf „Zurücksetzen“ ganz im sichtbaren Bereich, für die Seite gilt `document.documentElement.scrollWidth ≤ clientWidth`, und ein Klick auf „Zurücksetzen“ zeigt danach „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“

### Filterleiste im Kostenbericht
- [ ] Gegeben der Grundbestand, wenn die Spalte „Fertig“ ausgeschlossen wird, dann steht „Summe 2,23–3,23 $ · 2 von 3 Aufgaben mit Etikett, nach Filter, auch archivierte“ (m schrumpft, n nicht)
- [ ] Gegeben der Grundbestand, wenn die Spalte „Eingang“ ausgeschlossen wird, dann steht „Summe 1,63 $ · 1 von 2 Aufgaben mit Etikett, nach Filter, auch archivierte“
- [ ] Gegeben der Grundbestand mit #2 in Klasse drift, wenn die Klasse drift ausgeschlossen wird, dann steht „Summe 0,60–1,60 $ · 1 von 3 Aufgaben mit Etikett, nach Filter, auch archivierte“; Zuständige und Labels schränken auf dieselbe Weise ein
- [ ] Leerfall: Gegeben der Grundbestand, wenn alle drei Spalten ausgeschlossen sind, dann steht „Keine Aufgaben, die zu den Filtern der Berichte passen.“ und darunter der Knopf „Zurücksetzen“ ohne Zahl im Knopf (die Zahl aktiver Filter steht in der Zusammenfassung), und „Zurücksetzen“ führt zurück zu „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“
- [ ] Leerfall ohne Etikett nach Filter: Gegeben der Grundbestand, wenn die Spalten „Eingang“ und „In Arbeit“ ausgeschlossen sind (übrig bleibt #3 in Fertig ohne Etikett: m = 1, n = 0), dann steht „Keine Aufgabe mit Preisetikett · 0 von 1 Aufgaben, nach Filter, auch archivierte“, darunter der Hinweis auf die API mit dem Link „API für Agenten“ und der Knopf „Zurücksetzen“ ohne Zahl im Knopf; ein Klick darauf hebt beide Spaltenfilter auf, danach steht „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“, und der Knopf „Zurücksetzen“ ist verschwunden
- [ ] Gegenbeispiel: Gegeben #1–#4 ohne Etikett und im Board „fabrik“ gespeichert nur der Zeitraum „letzte Woche“ (kein aktiver Filter), wenn der Bericht geöffnet wird, dann steht „Keine Aufgabe mit Preisetikett · 0 von 4 Aufgaben, alle Spalten, auch archivierte“ mit Hinweis und Link, aber ohne Knopf „Zurücksetzen“
- [ ] Gegeben im Board „fabrik“ gespeichert sind Zeitraum „letzte Woche“, Messbasis 30 Tage und ein „Rechnen ab“, und die Spalten „Eingang“ und „In Arbeit“ sind ausgeschlossen, wenn im Kostenbericht „Zurücksetzen“ geklickt wird, dann steht „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“, die Board-Datei enthält Zeitraum „letzte Woche“, Messbasis 30 Tage und „Rechnen ab“ unverändert, das Burndown zeigt weiter „letzte Woche“, und „Wie lange noch“ nennt weiter „Messbasis 30 T“ (Zurücksetzen hebt hier nur auf, was hier gilt, PO Z. 106)
- [ ] Gegeben der Grundbestand plus eine vierte Spalte „Prüfung“ mit #9 ohne Etikett (m = 5), wenn der Bericht ohne aktiven Filter, dann mit gespeichertem Zeitraum „letzte Woche“, dann mit 1, 2 und 3 ausgeschlossenen Spalten („Fertig“; dazu „Eingang“; dazu „In Arbeit“) geöffnet wird, dann trifft das Muster `/alle Spalten/` den Bericht in den ersten beiden Fällen („2 von 5 Aufgaben mit Etikett, alle Spalten, auch archivierte“) und in den drei übrigen nicht; dort trifft `/nach Filter, auch archivierte/`: „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, nach Filter, auch archivierte“, „Summe 1,63 $ · 1 von 2 Aufgaben mit Etikett, nach Filter, auch archivierte“, „Keine Aufgabe mit Preisetikett · 0 von 1 Aufgaben, nach Filter, auch archivierte“ (heute im Plan rot: die alte Fassung von R00105 schrieb „alle Spalten“ auch bei ausgeschlossenen Spalten)
- [ ] Gegeben im Board „fabrik“ gespeichert sind Zeitraum „letzte Woche“ und ein „Rechnen ab“, wenn der Bericht geöffnet wird, dann steht „Summe 2,23–3,23 $ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte“ (ein gespeicherter Zeitraum allein ist kein aktiver Filter), die Gruppe Zeitraum fehlt, die Zusammenfassung nennt „Zeitraum gilt hier nicht“ und zählt den Zeitraum nicht als aktiven Filter
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
   - 2.3 Kostentabelle rechnen mit Zeilenköpfen und Summenzeile „Summe“ (B0369, frei), Reiter zeigen mit Beschriftung und schmalen Breiten (B0370, wartet D0003)
   - 2.4 Reiterleiste als `tablist` mit Tastatur für die heutigen zwei Reiter (F0043, B0375, frei; ohne neue Gestaltung, nutzt Aussehen und Kürzelhilfe von heute)
   - 2.5 Rückfall auf „Inhalt“ mit Fokusregel (B0376, ohne eigene Gestaltung, baubar sobald B0370 und B0375 stehen)
3. **Kostenbericht**
   - 3.1 Bericht rechnen mit Reihenfolge der Währungen (B0371, frei), Filter ohne Zeitraum und Umfangstext nach `filterAnzahl` (B0373, frei)
   - 3.2 Ansicht mit Kopfleiste, Menüeintrag und Leerzustand ohne Etikett samt Link „API für Agenten“ (B0372, wartet D0006), Filterleiste ohne Zeitraum, „Zurücksetzen“ in jedem Leerzustand bei aktivem Filter (ohne Zeitraum, Messbasis und „Rechnen ab“ anzufassen; Regel zentral in `bf-leeren` nach den `teile` des gezeigten Berichts, PO Z. 106) und schmale Breiten der ganzen Seite (B0374, wartet D0006)

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
- Artboards: `Dokumentation/Wireframes/D0002.dc.html` (Zustand Preisetikett auf der Karte mit Hinweis), `D0003.dc.html` (Reiter „Kosten“), `D0006.dc.html` (Bericht „Kosten“ mit Kopfleiste, Menüeintrag, Filterleiste ohne Zeitraum und beiden Leerzuständen). Die Reiterleiste als `tablist` (F0043) braucht kein neues Artboard: sie behält das heutige Aussehen, nur Rolle, Fokus und Tasten ändern sich. Die Zustände fehlen noch; sie entstehen vor dem Bau über `/wireframe verfeinern` und brauchen die Freigabe des Auftraggebers (PO Z. 34, 76).

### Änderungen an bestehenden Klassen
- Aufgabe und Aufgabenänderung: neues entfernbares Feld `cost`.
- Reiterleiste des Aufgabenfensters (`vFenster`, `web/ansicht.js`; Tasten in `web/app.js`): heute `span role=tab` mit `tabIndex -1` ohne `tablist`; wird `tablist` nach APG mit automatischer Aktivierung, für zwei und drei Reiter; `KUERZEL_FENSTER` bekommt „← →“.
- `vBerichtsfilter`: für den Kostenbericht ohne Gruppe Zeitraum und ohne „Rechnen ab“ (gleicher Satz wie B0355 aus R00100).

### Umfang
- I0093: 10 Bubbles, 8,5–18 h; I0094: 4 Bubbles, 3,5–8 h; zusammen 14 Bubbles, 12–26 h. Richtwerte nach dem Muster der Nachbar-Interactions, ungemessen (Hypothese). Vorher 12 Bubbles, 10–20 h; neu B0375 (1–2 h) und B0376 (0,5–1 h), B0370 und B0372 je von 1–2 auf 1–3 h (Beschriftung und Breiten bzw. Kopfleiste, zwei Leerzustände, Menübeschreibung); mit PO Z. 103–105 B0374 von 0,5–1 auf 1–2 h (Knopf im zweiten Leerzustand, Zurücksetzen ohne Zeitraum, Breitenprobe 3 Breiten × 3 Zustände), Stand davor 11,5–25 h. Alles bis Bubble geplant.

## Tests
Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** Konstruktor `Kosten` je Regel mit Grenz- und Gegenwert; Rundlauf des Formats über alle Cent-Werte 0–100.000 plus Ränder; Umwandlung des Rohwerts je Fehlfall; `web/kosten.js`: Mitte 0,60/1,61 → 1,11, 0,10 + 0,20 + 0,30 → 0,60, Format je Währung, Kostentabelle, Kostenbericht mit allen Rechenbeispielen der Akzeptanzkriterien.

**Integration:** PATCH einzeln und `/mehrere` gegen einen echten Ordner mit Git: Commit-Zahl vorher/nachher, Datei neu gelesen, jeder Fehlfall 400 mit Datei byte-gleich; defekte Datei → nur lesbar.

**E2E:** US-1 bis US-20 gegen das laufende Programm auf freiem Port; Live mit Warten auf das Ereignis; Prüfsumme der Board-Datei vor und nach dem Öffnen des Berichts.

## Abhängigkeiten
- Abhängig von: R00004 Board ansehen (I0004, gruen), R00011 Aufgabe ansehen und bearbeiten (I0011, gruen), R00081 Berichtsfilter (I0069, gruen); Freigabe der Artboards D0002, D0003, D0006 durch den Auftraggeber.
- Berührt: R00100 Bestand nach Labels (I0092, rot) — derselbe Satz „Zeitraum gilt hier nicht“ und dieselbe Menügruppe; wer zuerst gebaut wird, legt beides an.
- Blockiert: —

## Offene Fragen
- Freigabe der Artboards D0002, D0003 und D0006 beim Auftraggeber (PO Z. 76); bis dahin warten die Oberflächen-Bubbles.
- Entschieden und eingearbeitet (2026-11-06): Reiter ohne Etikett (PO Z. 85), Ort und Name des Berichts (PO Z. 86), Reihenfolge der Währungszeilen, Einzelbetrag und kein „≈“ in der Summe (PO Z. 87); „Zurücksetzen“ in jedem Leerzustand bei aktivem Filter, Linktext „API für Agenten“, schmale Breiten des Berichts (PO Z. 103–105).
- Entschieden (PO Z. 106): „Zurücksetzen“ hebt im Kostenbericht Zeitraum, Messbasis und „Rechnen ab“ nicht auf, weil sie hier nicht gelten und gespeichert unverändert bleiben (PO Z. 80); für alle Berichte hebt der eine gemeinsame Knopf genau auf, was die Leiste des gezeigten Berichts zeigt und als aktiv zählt. Der heutige Knopf setzt Zeitraum und Messbasis pauschal mit zurück (`FILTER_LEER`, web/berichte.js:7, web/app.js:739); B0374 baut die Regel zentral in `bf-leeren`.

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
- **Bewusst außerhalb:** ein Schalter `reporting.cost` (PO Z. 82); das Erkennen oder Ausnehmen von Gemeinkosten (PO Z. 83); Bearbeiten des Etiketts in der Oberfläche; Rechnen aus Tokens (PO Z. 18); Umrechnung zwischen Währungen und eine EUR-Schaltung (PO Z. 45–46); ein Zeitraum nach Ankunft in der Abschlussspalte (PO Z. 80, spätere Ausbaustufe auf Wunsch); ein Kürzel `g o` für den Bericht (PO Z. 100, erst gemeinsam für beide Bestandsberichte auf Wunsch oder Befund); Summen in einer `role=status`-Region (PO Z. 101); eine Liste der Aufgaben hinter der Summe (PO Z. 102, spätere Ausbaustufe auf Wunsch); der versteckte zugängliche Name am Zeit-Σ (PO Z. 91); die übrigen Punkte der Karte #8 — Fokusfalle, Menüs, `role=radio`-Gruppen (PO Z. 88).
- **Verworfene Alternativen** (Schnitt): eine Interaction für alles — 12 Bubbles und zwei Dialogs, über der Schnittgrenze; Chip als eigene Interaction unter D0002 — er hat keine eigene Tür, nur Darstellung derselben Daten.
- **Detailplanung:** WBS I0093 (F0038–F0040, B0363–B0370) und I0094 (F0041–F0042, B0371–B0374), 2026-11-06.
- **Einarbeitung PO Z. 85–102** (2026-11-06): Reiterleiste als `tablist` (F0043, B0375), Rückfall mit Fokusregel (B0376), zugänglicher Name, Ort und Kontrast des Etiketts (B0368), Tabelle mit `caption`, Zeilenköpfen und „Summe“ (B0369, B0370), schmale Breiten (B0370), Kopfleiste, Menüeintrag, Umfangstext nach Filter und zwei Leerzustände (B0371–B0374); 51 → 75 Akzeptanzkriterien (6 davon ausdrücklich Gegenbeispiele, vorher 0), US-15 bis US-18 neu. Die Probe aus PO Z. 89 („1, 2 und 3 ausgeschlossene Spalten“) läuft mit einer vierten Spalte „Prüfung“, weil im Grundbestand drei ausgeschlossene Spalten m = 0 ergeben und dann der Leerzustand nach Filter (PO Z. 96) ohne „nach Filter, auch archivierte“ steht.
- **Einarbeitung PO Z. 103–105** (2026-11-06): „Zurücksetzen“ in jedem Leerzustand bei aktivem Filter, mit Klick-Ergebnis und Gegenbeispiel „nur gespeicherter Zeitraum → kein Knopf“; Zurücksetzen lässt Zeitraum und „Rechnen ab“ stehen (abgeleitet aus PO Z. 80); Link „API für Agenten“ auf `/api` im neuen Tab mit `rel="noopener"`; ganze Seite des Kostenberichts bei 320, 375, 414 px ohne waagrechtes Scrollen (B0372, B0374); 75 → 81 Akzeptanzkriterien (2 geändert, 6 neu, davon 1 Gegenbeispiel), US-14 geändert, US-19 und US-20 neu.
- **Einarbeitung PO Z. 106** (2026-11-06): „Zurücksetzen“ lässt auch die Messbasis stehen, die Notiz „abgeleitet, vom PO zu bestätigen“ ist entschieden, die Regel gilt für alle Berichte (ein Knopf, hebt auf, was die Leiste des gezeigten Berichts zeigt und zählt); Funktionale Anforderung „Zurücksetzen in jedem Leerzustand“, ein Akzeptanzkriterium (Gegeben und Dann um Messbasis 30 Tage), US-19 und Ablauf 3.2 geändert; Anzahl der Kriterien unverändert; WBS B0374 Entwurfsnotiz.
