---
id: R00201
status: Neu
datum: 2026-11-19
ursprung: Bug-Report
ursprungslauf: R00022
---

# R00201: Behebung — Personenwahl im Stundenzettel macht die Seite bei vielen Personen breiter

## Beschreibung

Herkunft: Karte #206 (Vorrang, Befund des architekt aus der Architektur von #205). Der Stundenzettel ([R00022](R00022-stundenzettel-und-csv.md)) zeigt die Personenwahl als Leiste von Segmenten, eines je aktiver Person. Die Personenzahl kommt aus den Daten und hat keine Obergrenze. Mit 20 aktiven Personen wird die ganze Seite breiter als das Fenster, bei jeder Breite. Im [schmalen Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) ist das ein Rückfall gegen [R00140](R00140-navigation-seltene-ziele-im-mehr-menue.md) („scrollt nichts quer“). Zuschnitt des product-owner: `AI-Team/po-entscheidungen.md` Z. 353–357. Technik vom architekt gemessen (Kartenkommentar #206, Messdaten `gemeinsam/scratchpad/arch-206/ergebnis.jsonl` der Factory), kein ADR.

**Beobachtet** (architekt, headless Chromium auf :7422, Stand 8dd99d8e, 20 aktive Personen, gegen `clientWidth` gemessen):

| Breite | scrollWidth | Höhe der Leiste | sichtbare Personen | Oberkante `#stundenzettel` |
|---|---|---|---|---|
| 1280 | 2069 | 131 px | 12 von 20 | 204 px |
| 320, Touch | 1733 | 243 px | 4 von 20 | 340 px |
| 375, Touch | 1733 | 226 px | 5 von 20 | 323 px |

Ein Tipp auf die letzte Person wird von einem anderen Element abgefangen. „Stefan Hoffmann“ wird abgeschnitten. Die E2E-Daten haben nur 3 Personen und zeigen den Fehler nicht.

**Ursache (architekt):** `.seg` je aktiver Person ohne Begrenzung (`web/ansicht.js:1257`, `web/kd-base.css:34`). Es ist das einzige `.seg`, das aus Daten gefüllt wird. Segmente sind nach Material 3 nur für 2–5 Optionen gedacht.

**Erwartet (PO Z. 353–355):**

1. **Immer eine Auswahlliste.** Die Personenwahl ist bei jeder Personenzahl und jeder Breite eine native Auswahlliste `<select class="mini-inp" aria-label="Person">` wie die Zeitraum-Wahl (`vZeitraumFelder`, `web/ansicht.js:1244`). Die Liste ist so breit wie ihr längster Eintrag (`width:auto`, nicht die feste Breite 110 px von `.mini-inp`, `web/kd-app.css:496`), höchstens so breit wie der Platz in der Leiste (`max-width:100%`). Nur einen Namen, der breiter ist als die Leiste, kürzt der Browser in der geschlossenen Liste. Die Liste behält beim Neuzeichnen ihren Knoten, damit ein fremdes Live-Ereignis eine offene Liste nicht schließt und der Fokus nicht springt (Vorbild `datumsknotenBehalten`, `web/app.js:915`; Sollte der UX-Vorprüfung, vom Director übernommen). Für die Personenwahl im Stundenzettel gilt Material 3 vor dem Artboard D0006.
2. **Einträge.** Ein Eintrag je aktiver Person, Wert ist das Kürzel, Text der Name wie heute. Die Reihenfolge ist die von `personen()` wie heute. Menschen und Agenten stehen gemischt, ohne `optgroup`. Stillgelegte Personen stehen nicht in der Liste (R00022 „aktive Menschen und Agenten“). Kein sichtbares Label, der Name für Hilfstechnik ist „Person“.
3. **Leerfall.** Ist die angezeigte Person keine aktive Person (die eigene Person ist stillgelegt oder unbekannt), steht als erster Eintrag „— Person wählen —“ (`value=""`, `selected`, `disabled`). Nur in diesem Fall gibt es den Eintrag. Keine Person wird stillschweigend vorgewählt, die Tabelle darunter bleibt wie heute.
4. **Wahl.** Eine gewählte Person gilt wie heute (`u.sp`, `web/app.js:2250`). Welche Person ohne Wahl angezeigt wird, bleibt unverändert (`u.sp`, sonst die eigene Person, sonst die erste aktive, `web/ansicht.js:1253`).

**Verhältnis zu R00106 und R00022** (beide bleiben, wie sie sind; ihre Dateien werden nicht geändert): Ab dieser Anforderung ist „Person“ im Stundenzettel keine Radiogruppe mehr. R00106 „Betroffene Gruppen“ (Z. 93) gilt nur noch für „Bereich“, „Aufgabenbereich“ und „Personen“. Das Kriterium „Leerfall“ von R00106 (Z. 212) gilt in dieser Fassung: Ohne aktive gewählte Person zeigt die Liste „— Person wählen —“, und Tab erreicht die Liste mit einem Tab-Halt (AK 4, 5). Die Absicht beider Stellen bleibt: Die Person ist per Tastatur wählbar, und der Leerfall ist erkennbar (PO Z. 357). R00022 „Person wählbar (aktive Menschen und Agenten)“ gilt unverändert, nur das Bedienelement wechselt.

**Außen vor:** Umbruch, Querscroll-Rahmen, Menüknopf und „Segment bis 5 Personen“ (Varianten A, B, D, E, PO Z. 353 verworfen). Gruppen nach Menschen und Agenten (später ohne Umbau ergänzbar). Eine Zeichnung vor dem Bau (PO Z. 356). Die Kopfzeile ohne gewählte Person bei 320 px (Karte #205, R00200).

Zahlt ein auf: [Vision](R00000-vision.md) — kanbanD ist auch auf dem Telefon bedienbar, und ein Board mit vielen Agenten bleibt lesbar. Optionen: entfallen, der Lösungsraum ist durch die Entscheidung des product-owner (Z. 353) entschieden; die fünf Varianten des architekt stehen oben unter „Außen vor“.

### Domänenbezug

[Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md). Neue Fachbegriffe: keine.

## Akzeptanzkriterien

**Ausgangslage:** E2E-Grundbestand von R00022 (Stefan 1:30, Claude 0:30 in dieser Woche) plus 17 weitere aktive Personen über `POST /api/personen`, zusammen 20 aktive Personen. Zwei der neuen Namen sind mindestens 30 Zeichen lang (Beispiel „Entwicklertesterin Oberfläche Nord“, 34 Zeichen). Einer der neuen Namen ist mindestens 60 Zeichen lang und breiter als die Leiste bei 414 px (Beispiel „Entwicklertesterin Oberfläche Nord für die Abnahme der Stundenzettel-Ansicht“, 76 Zeichen); er ist der längste Eintrag der Liste. Ohne ihn passt die Liste auch ohne `max-width:100%` in 320 px, und der Mutant „ohne `max-width`“ bliebe grün (UX-Vorprüfung). Eine Person „Gast“ ist stillgelegt (`DELETE /api/personen/<kürzel>`). Im Tab ist Stefan gewählt (`alsPerson`), damit die Kopfzeile bei 320 px nicht von Karte #205 abhängt. Breiten 1280 ohne Touch sowie 320, 375 und 414 mit Touch (isMobile, hasTouch), Höhe 844 px, Themen hell und dunkel.

- [ ] **AK 1 Kein Querscrollen mit 20 Personen (Abnahme-Probe des architekt, wörtlich):** Gegeben die Ausgangslage, wenn der Stundenzettel bei 1280, 320, 375 und 414 px geöffnet wird, dann gilt `document.documentElement.scrollWidth ≤ clientWidth` (nicht `innerWidth`, das mit isMobile mit dem Inhalt wächst), und die rechte Kante der Personenwahl liegt ≤ `clientWidth`. Heute rot: 2069 bei 1280, 1733 bei 320 (gemessen, arch-206).
- [ ] **AK 1b Liste so breit wie ihr längster Eintrag:** Gegeben die Ausgangslage bei 1280 px, wenn der Stundenzettel geöffnet wird, dann ist die Breite der Liste ≥ Textbreite des längsten Namens + 24 px (Canvas `measureText` in der berechneten Schrift der Liste) und ≤ Breite der Leiste. Ebenso im Leerfall (AK 4) für „— Person wählen —“. Heute im Nachbau mit `.mini-inp` rot: 110 px gegen 262 px (UX-Vorprüfung). Grenzfall: Bei 320/375/414 px ist der 76-Zeichen-Name breiter als die Leiste; dort gilt nur die Obergrenze aus AK 1.
- [ ] **AK 2 Immer eine Auswahlliste:** Gegeben die Ausgangslage mit 20 Personen und gegeben der Grundbestand mit 3 Personen, wenn der Stundenzettel bei 1280 und 375 px geöffnet wird, dann ist die Personenwahl `select.mini-inp` mit dem zugänglichen Namen „Person“, und es gibt keine Radiogruppe „Person“. Die Einträge sind genau die aktiven Personen mit ihrem Namen als Text und dem Kürzel als Wert, in der Reihenfolge von `personen()`, ohne `optgroup`. „Gast“ steht nicht in der Liste (Grenzfall Stillgelegte). Der Eintrag der angezeigten Person ist `selected`.
- [ ] **AK 3 Jede Person wählbar:** Gegeben die Ausgangslage bei 1280 px, wenn nacheinander jede der 20 Personen gewählt wird (`selectOption`), dann hat die Liste danach deren Kürzel als Wert, und der Stundenzettel zeigt deren Woche. Rechenbeispiel: Stefan → Summe 1:30, Claude → Summe 0:30, eine neue Person ohne Zeiten → „<Name> hat in dieser Woche keine Zeiten.“ Bei 375 px mit Touch trifft ein Tipp auf die Mitte der Liste die Liste selbst (`document.elementFromPoint` liefert die Liste), er wird nicht abgefangen.
- [ ] **AK 4 Leerfall:** Gegeben die Ausgangslage bei 1280 und 375 px, aber im Tab ist „Gast“ (stillgelegt) als eigene Person gemerkt und keine Person gewählt, wenn der Stundenzettel geöffnet wird, dann ist der erste Eintrag „— Person wählen —“ mit `value=""`, `selected` und `disabled`, und keine Person ist gewählt. Wird danach Stefan gewählt, zeigt der Stundenzettel 1:30, und den Eintrag „— Person wählen —“ gibt es nicht mehr. Gegenfall: Ist eine aktive Person angezeigt, gibt es den Eintrag nicht.
- [ ] **AK 5 Tastatur:** Gegeben die Ausgangslage bei 1280 px, wenn auf den Titel „Stundenzettel“ geklickt und danach Tab gedrückt wird, dann steht der Fokus nach einem Halt auf der Liste (ein Tab-Halt für die ganze Wahl). Mit ↓ wird die nächste Person gewählt, der Stundenzettel zeigt deren Woche, und der Fokus steht nach dem Neuzeichnen weiter auf der Liste. Der Fokusring der Liste (`.mini-inp:focus`, `--kd-accent`, `web/kd-app.css:495`) hat ≥ 3:1 gegen den Hintergrund in hell und dunkel. Ein fremdes Live-Ereignis lässt den Fokus auf der Liste (Raster `e2e/tests/r00106-fokus-raster.spec.js` bleibt grün).
- [ ] **AK 6 Tabelle bleibt oben:** Gegeben die Ausgangslage bei 375 px mit Touch, wenn der Stundenzettel geöffnet wird, dann liegt die Oberkante von `#stundenzettel` bei ≤ 400 px. Heute 323 px (gemessen, die Leiste ragt seitlich hinaus); mit `width:auto` maß die UX-Vorprüfung 321 px, das Kriterium bleibt also mit Abstand erfüllbar; der verworfene Umbruch hätte 947 px ergeben (gemessen, Variante A). Das Kriterium hält den Platzgewinn der Liste fest.
- [ ] **AK 7 Probe im Gate, Bestandstests umgestellt:** Eine Spec mit der Ausgangslage (20 Personen, zwei Namen ≥ 30 Zeichen, einer ≥ 60 Zeichen) prüft AK 1–6, 1b und 9. Sie war vor dem Fix rot und läuft in der vollen Suite. Die Bestandstests, die die Radiogruppe „Person“ ansprechen, prüfen jetzt die Liste und sind grün: `e2e/tests/r00106-fokus.spec.js:446` (US-9 Leerfall → AK 4, 5), `:796` (Ring je Gruppe, „Person“ → Ring der Liste), `e2e/tests/r00022-berichte.spec.js:24` (Klick auf das Radio „Claude“ → Wahl in der Liste, Summe 0:30).
- [ ] **AK 9 Live-Ereignis lässt die Liste stehen:** Gegeben die Ausgangslage bei 1280 px und der Fokus auf der Liste, wenn über die API ein fremdes Live-Ereignis ausgelöst wird (z. B. Claude ändert den Titel einer Aufgabe), dann ist `document.activeElement` danach dasselbe Element wie vorher (Gleichheit des Knotens, nicht nur des Selektors), und Wert und Auswahl der Liste sind unverändert. Mutant: Liste wird beim Neuzeichnen ersetzt → `document.activeElement` ist ein anderer Knoten, rot.
- [ ] **AK 8 Artboard nachgezogen (gestalter, keine Bedingung für den Bau):** In `Dokumentation/Wireframes/D0006.dc.html` zeigt der Stundenzettel (Z. 752) die Personenwahl als Auswahlliste statt als Segment mit sechs Personen, ohne Freigaberunde (PO Z. 353).

## Tests

Test zuerst: die Spec mit 20 Personen (AK 1, 1b, 2, 3, 6) bei 1280 und 320/375/414 mit Touch, heute rot (scrollWidth 2069 bzw. 1733). Sie misst `documentElement` gegen `clientWidth` (Vorbild `breiteMessen`, `e2e/tests/ziele-hilfen.js:171`). Dann E2E für AK 4 (Leerfall mit „Gast“) und AK 5 (Tab, ↓, Fokus nach dem Neuzeichnen, Ring hell und dunkel), danach die Bestandstests aus AK 7 umstellen. Dann AK 9 (Live-Ereignis, Knotengleichheit). Mutanten, die rot werden müssen: Liste ohne `max-width:100%` mit dem 76-Zeichen-Namen (rechte Kante > `clientWidth`) · Liste mit fester Breite 110 px von `.mini-inp` (AK 1b) · Liste wird beim Neuzeichnen ersetzt (AK 9) · Stillgelegte in der Liste · „— Person wählen —“ auch bei aktiver Person · Leereintrag ohne `disabled` · stille Vorwahl der ersten Person im Leerfall · Fokus nach der Wahl auf `body` · Probe misst `innerWidth`.

## Implementierungshinweise

- `vStundenzettel` (`web/ansicht.js:1250–1257`): die Leiste `.seg[role=radiogroup]` durch das `<select>` ersetzen, Vorbild `vZeitraumFelder` (Z. 1244). Die Wahl setzt `u.sp` wie heute der Fall `sp` (`web/app.js:2250`); ob über ein `change` mit eigenem Datenattribut oder über den vorhandenen Weg der Berichtsfilter-Felder, entscheidet der entwickler. Der Fokus muss nach dem Neuzeichnen auf der Liste bleiben (Haltemechanik nach R00106/R00138, `data-halt`); bei einem fremden Live-Ereignis behält die Liste ihren Knoten wie `datumsknotenBehalten` (`web/app.js:915`), Wert und Optionen werden nur nachgezogen, wenn sie sich ändern. Die Breite: `width:auto` an dieser Liste statt der 110 px von `.mini-inp` (`web/kd-app.css:496`), ohne `.mini-inp` allgemein zu ändern (Zeitraum-Wahl bleibt).
- Ob die Liste in der Leiste schrumpft (`min-width:0`, `flex` der `.leiste`), prüft AK 1 bei 320 px mit dem langen Namen.
- **Nicht hinein:** neue Tokens · Änderungen an R00022, R00106 oder ihren User Stories · eine Zeichnung (PO Z. 356) · die Kopfzeile ohne Person (#205).

## Warum löst diese Anforderung das Problem?

Auslöser: Auf einem Board mit 20 aktiven Personen öffnet jemand den Stundenzettel, auf dem Telefon oder am Rechner. Statt 20 Segmenten nebeneinander steht eine Liste, die höchstens so breit ist wie die Leiste (X). Damit passt die Seite in jede Breite, und die Tabelle beginnt weit oben (Y). Jede Person ist mit einem Tipp, einem Klick oder per Tastatur wählbar, keine wird verdeckt oder abgefangen (Z). Die Probe mit 20 Personen hält den Fall im Gate, den die E2E-Daten mit 3 Personen nie zeigten.

## Offene Fragen

Keine.

## Notizen

- Priorität: Hoch (Vorrang-Karte). Betroffen: jedes Board mit mehr als etwa 8 aktiven Personen am Rechner, auf dem Telefon schon ab etwa 5 (Hypothese aus den sichtbaren Personen 12 bzw. 4–5 von 20). Workaround: keiner, verdeckte Personen sind auf dem Telefon nicht wählbar.
- Abhängigkeit zu #205: Ohne gewählte Person ragt bei 320 px die Kopfzeile hinaus, bis R00200 auf main ist. Die Ausgangslage wählt deshalb Stefan im Tab; der Leerfall (AK 4) wird bei 1280 und 375 px geprüft, nicht bei 320.
- Nacharbeit 2026-11-19 (UX-Vorprüfung, Kartenkommentar #206): Erwartet 1 um Breite und Knotenerhalt ergänzt, Ausgangslage um den 60-Zeichen-Namen, AK 1b und AK 9 neu (angehängt, keine Umnummerierung), AK 5 eindeutiger, AK 6 gegen die Messung mit `width:auto` geprüft (321 px).
- AK 8 erledigt der gestalter nach dem Bau (PO Z. 353, 356). Es hält den Bau nicht auf, wohl aber die Abnahme.
