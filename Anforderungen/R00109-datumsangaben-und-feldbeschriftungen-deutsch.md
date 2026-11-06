---
id: R00109
status: Neu
datum: 2026-11-06
---

# R00109: Datumsangaben und Feldbeschriftungen deutsch

## Beschreibung

Die Oberfläche zeigt Datumsangaben in ISO-Form und Feldnamen als englische Schlüssel. Auf der Karte steht die Fälligkeit als „2026-11-20“ (`web/ansicht.js:492`). Das Aufgabenfenster und der Dialog „Neue Aufgabe“ beschriften ihre Felder mit `column`, `class`, `origins`, `assignees`, `labels` und `due`. Eine Aufgabe ohne Herkunft zeigt den Chip „thin air“ (Karte #11). Ähnliche Stellen gibt es in Archivleiste, Kommentaren, Durchläufen, Zeiten, Reservierungen, Personen, Stundenzettel und in den Tabellenansichten der Berichte (ADR-0013 „Kontext“, Stand d587d73). Drei Former (`deTag`, `vollDatum`, `deDatum`) schreiben schon deutsch, `isoD`, `ortszeit` und `esc(a.faellig)` schreiben ISO in den sichtbaren Text.

Diese Anforderung setzt ADR-0013 (Option A) für die ganze Oberfläche um (PO Z. 144):
- Daten bleiben in Dateien, API, CSV, Filtersprache und Schnelleingabe ISO, mit englischen Schlüsseln und dem Wert `thin air`. Deutsch wird erst beim Zeichnen.
- Ein reines Modul `web/kultur.js` formt jedes sichtbare Datum. Die Langform `28.10.2026` ist der Standard. Die Kurzform `28.10.` gibt es an drei Stellen und nur für Daten im laufenden Jahr (PO Z. 146).
- Dasselbe Modul führt die Tabelle `FELDER`: Schlüssel → deutsche Beschriftung. Der Schlüssel steht daneben als eigener Hilfstext in Mono.
- Eine Aufgabe ohne Herkunft zeigt „ohne Herkunft“. Das Herkunftsfeld nimmt diese Worte auch als Eingabe an (PO Z. 145).
- Eine Probe im Browser geht jede Ansicht ab. Ein Unit-Test prüft das Modul samt Jahreswechsel.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Eine festgelegte Kultur“ (`R00000-vision.md:164–165`): die Oberfläche ist deutsch, Datumsangaben stehen im deutschen Format. Gegenüber den Artboards D0002 und D0003, die auf der Karte ISO zeigen (`2026-11-20`), geht die Vision vor (PO Z. 144; `gemeinsam/regeln.md` der Factory, „Gestaltung“).

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md)

## Geschäftlicher Nutzen

Wer das Board liest, liest Datumsangaben ohne Umrechnen und Felder ohne Englisch. „Fällig 28.10.“ auf der Karte ist schneller erfasst als „2026-10-28“. Die Kurzform steht nur dort, wo das Jahr eindeutig das laufende ist, damit niemand über einen Jahreswechsel raten muss (R00073). Ein Feld, dessen sichtbare Beschriftung in seinem zugänglichen Namen steht, ist mit Sprachsteuerung und Screenreader unter demselben Wort erreichbar (WCAG 2.5.3 „Label in Name“, Kartentext). Weil Dateien und API unverändert bleiben, ist kein Agent und kein Werkzeug betroffen.

## Funktionale Anforderungen

### Grenze (ADR-0013 Regel 1)

1. Dateien, API, CSV-Ausleitung, Filtersprache und Schnelleingabe ändern sich nicht: ISO-Daten, englische Schlüssel, der Wert `thin air`. Der Filter `origin:"thin air"` heißt weiter so.
2. Nicht sichtbare Träger bleiben ISO: `data-*`, der `value` eines `<input type=date>`, Vergleiche wie `a.faellig <= heute`.

### Datumsformen (ADR-0013 Regel 2, PO Z. 146)

3. **Langform** `TT.MM.JJJJ` ist der Standard, mit Uhrzeit `TT.MM.JJJJ HH:MM` (Ortszeit), mit Wochentag `Mi 28.10.2026`, wo heute `deDatum` steht.
4. **Kurzform** `TT.MM.` (mit Uhrzeit `TT.MM. HH:MM`) steht nur an diesen drei Stellen, und nur, wenn das Datum im laufenden Kalenderjahr liegt (Ortszeit):
   1. Fälligkeit auf der Karte;
   2. Spalte Datum der Tabellen Durchläufe und Zeiten im Aufgabenfenster;
   3. Spaltenköpfe der Tage im Stundenzettel.
   Liegt das Datum in einem anderen Jahr, steht es dort lang.
5. **Zugänglicher Name und Tooltip** nennen immer das Jahr. Die Fälligkeit auf der Karte trägt „fällig 28.10.2026“ als `title` und Namen, auch wenn sie „28.10.“ zeigt.
6. **Langform überall sonst**, darunter: Schnellvorschau, Archivleiste, Kommentare, Reservierungen, Signal „überfällig seit“, Personen „zuletzt“, Wochenleiste des Stundenzettels (`28.10.2026 – 03.11.2026`), Kennzahlen und Leisten der Berichte, Tabellenansichten von Burndown, Verlauf, Wie lange noch und Fever.
7. Die Achsenmarken der Diagramme bleiben `TT.MM.` über `JJJJ` (R00073). Angaben ohne Datum (`seit 14:05`) bleiben.
8. Jede Form entsteht im Modul `web/kultur.js`. Die Kurzform bekommt „heute“ als Argument. Die heutigen Former `deTag`, `vollDatum` und `deDatum` werden zu Aufrufen des Moduls oder entfallen; `isoD` bleibt nur für Schlüssel und Vergleiche.

### Wo ISO sichtbar bleiben darf (ADR-0013 Regel 3)

9. Nur im Reiter „Datei“ des Aufgabenfensters, in der YAML-Vorschau in „Einrichten“ und beim ersten Start, als Schlüssel im Mono-Hilfstext und im Wert des nativen Datumsfelds. Tooltips (`title`) und zugängliche Namen sind sichtbarer Text und folgen FA 3–6.

### Feldbeschriftungen (ADR-0013 Regel 4)

10. Die Felder im Aufgabenfenster und im Dialog „Neue Aufgabe“ tragen diese Beschriftungen:

    | Schlüssel | Beschriftung |
    |---|---|
    | `board` | Board |
    | `column` | Spalte |
    | `class` | Klasse |
    | `origins` | Herkunft |
    | `assignees` | Zuständig |
    | `labels` | Labels |
    | `due` | Fällig |

11. Der Schlüssel steht neben der Beschriftung in einem eigenen Element als Hilfstext in Mono, nie im Text der Beschriftung.
12. Der zugängliche Name jedes Felds enthält den Text seiner Beschriftung. Die Auswahl der Zuständigen ist eine Gruppe mit dem Namen „Zuständig“. Vorhandene Namen, die die Beschriftung schon enthalten („Spalte“, „Klasse“, „Labels“, „Fälligkeit“, „Neue Herkunft“, „Herkunft der neuen Aufgabe“), bleiben.
13. Übrige Beschriftungen im Aufgabenfenster: `wbs-effects` → „Wirkungen“, `phases` → „Phasen“, `reservation` → „Reservierung“. In „Einrichten“: `wbs` → „WBS“, `requirements` → „Anforderungen“. Beim ersten Start: `ich` → „Ich“, `agents` → „Agenten“, `board` → „Board“, `spalten` → „Spalten“, `wbs` → „WBS“, `anforderungen` → „Anforderungen“. Der Schlüssel steht jeweils als Hilfstext daneben (FA 11).
14. „wartet auf“ ist eine Anzeige, kein Feld, und bleibt.

### Ohne Herkunft (PO Z. 145)

15. Eine Aufgabe ohne Herkunft oder mit der Herkunft `thin air` zeigt auf der Karte und im Aufgabenfenster den Chip „ohne Herkunft“.
16. Das Herkunftsfeld im Aufgabenfenster nimmt „ohne Herkunft“ und `thin air` an, ohne Rücksicht auf Groß- und Kleinschreibung und mit getrimmten Leerzeichen. Beides speichert `thin air` und ersetzt die übrigen Herkünfte, wie heute `thin air`.
17. Der sichtbare Hinweis des Felds (Tooltip) nennt „ohne Herkunft“, nicht `thin air`.

### Probe (ADR-0013 Regel 5)

18. Eine Probe im Browser geht jede Ansicht der gemeinsamen Ansichtenliste (`e2e/tests/ansichten.js`) ab, dazu Archiv des Boards, Seite „API für Agenten“, Aufgabenfenster, „Neue Aufgabe“, die Menüs Seite, Mehr, Berichte und Ich, das Kontextmenü einer Karte, die Aufgabenreservierungen des Boards und den ersten Start. Kein sichtbarer Textknoten, kein `title` und kein zugänglicher Name passt auf `/\d{4}-\d{2}-\d{2}/`, ausgenommen FA 9.
19. Die Liste der Ausnahmen startet leer. Ein Eintrag braucht Ansicht, Selektor, Text und eine eigene Folgekarte. Verschwindet die Fundstelle, schlägt die Probe Alarm, damit die Liste nur schrumpft.

## Nicht-funktionale Anforderungen

- **Gleiche Ausgabe in Node und Browser**: Das Modul baut die Formen aus Zahlen, ohne `Intl` und ohne `new Date(iso)`, damit kein UTC-Versatz entsteht und der Unit-Test dasselbe sieht wie der Browser.
- **Ein Ort**: Ändert sich eine Datumsform oder eine Beschriftung, ändert sich eine Stelle in `web/kultur.js`.
- **Keine Änderung an Daten und API**: kein Test an API, Dateien oder CSV ändert sich. Geändert werden nur die E2E-Erwartungen an sichtbaren Text (siehe Tests).
- **Zugänglichkeit**: Rollen, Tastaturwege und die heutigen Namen der Felder bleiben (R00106); 17 bestehende Tests finden Felder über `getByLabel` und bleiben unverändert grün.

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00109.md`.

- [ ] **1. Abnahme-Probe der Karte #11 (wörtlich)**: „Für jedes Feld im Aufgabenfenster und im Fenster „Neue Aufgabe“ enthält der Accessible Name den sichtbaren Labeltext; kein sichtbarer Kartentext passt auf `/\d{4}-\d{2}-\d{2}/`; keine der Zeichenketten `column|class|origins|assignees|due|thin air` ist sichtbarer Labeltext."
  - Besteht: Beschriftung „Spalte“, daneben Hilfstext `column` in Mono, Auswahl mit dem Namen „Spalte“.
  - Besteht: Beschriftung „Labels“ (der Schlüssel heißt `labels`; der Vergleich beachtet Groß- und Kleinschreibung).
  - Fällt durch: Beschriftung „column“; Beschriftung „Spalte column“ in einem Element; Gruppe der Zuständigen ohne Namen; Karte mit der Fälligkeit „2026-10-28“.
- [ ] **2. Kurz nur im laufenden Jahr**: An den drei Stellen aus FA 4 steht ein Datum des laufenden Jahres kurz, jedes andere lang; Name und Tooltip nennen immer das Jahr.
  - Besteht (heute 06.11.2026): fällig 2026-10-28 → Karte „28.10.“, Name „fällig 28.10.2026“; fällig 2025-03-15 → „15.03.2025“; fällig 2027-01-01 → „01.01.2027“.
  - Jahreswechsel (Unit-Test, „heute“ als Argument): heute 2026-12-31, Datum 2026-12-31 → „31.12.“; Datum 2027-01-01 → „01.01.2027“; heute 2027-01-01, Datum 2026-12-31 → „31.12.2026“.
  - Fällt durch: „28.10.“ für 2025-10-28; Name „fällig 28.10.“ ohne Jahr; Durchlauf „10-28 14:05“ (heutige Form).
- [ ] **3. Karte und Aufgabenfenster**: Schnellvorschau, Archivleiste, Kommentare und die Tabelle der Aufgabenreservierungen zeigen lang; Durchläufe und Zeiten nach AK 2. Die Probe über Board, Archiv des Boards, Aufgabenfenster und „Neue Aufgabe“ findet nichts.
  - Besteht: „Archiviert am 01.10.2026“; „Claude · 17.10.2026 09:00“; Reservierung „seit 06.11.2026 14:05“ in der Tabelle.
  - Fällt durch: Reservierung „11-06 14:05“ (heutige Form, passt nicht auf die Regex).
  - Fällt durch: „Archiviert am 2026-10-01“; „Claude · 2026-10-17 09:00“.
  - Gegenbeispiel, das gleich bleibt: der Reiter „Datei“ zeigt `due: 2026-10-28`.
- [ ] **4. Ganze Oberfläche**: Personen, Stundenzettel und jeder Bericht zeigen kein Datum in ISO-Form; Achsenmarken bleiben `TT.MM.` über `JJJJ`. Die Probe aus FA 18 findet in keiner Ansicht etwas, und ihre Ausnahmeliste ist leer.
  - Besteht: Wochenleiste in der Form „28.10.2026 – 03.11.2026“; Tabellenansicht Verlauf „01.10.2026“.
  - Fällt durch: Tabellenansicht mit „2026-10-01“; ein `title` „2026-10-01“ an einem Balken.
- [ ] **5. Übrige Beschriftungen**: Wirkungen, Phasen und Reservierung im Aufgabenfenster, WBS und Anforderungen in „Einrichten“ und die Felder des ersten Starts tragen die Beschriftungen aus FA 13, der Schlüssel steht als Hilfstext daneben.
  - Fällt durch: Beschriftung „wbs-effects“, „phases“, „reservation“ oder „agents“.
  - Gegenbeispiel, das gleich bleibt: der Prüfpunkt `wbs-effects-green` (R00059, R00071) nennt seinen Prüfnamen weiter in Tooltip und Namen; er ist keine Feldbeschriftung.
- [ ] **6. Ohne Herkunft**: Eine Aufgabe ohne Herkunft zeigt „ohne Herkunft“. Die Eingabe „ohne Herkunft“ oder `thin air` im Herkunftsfeld des Aufgabenfensters speichert `thin air` und ersetzt die übrigen Herkünfte.
  - Besteht: #1 mit `origins: [I0001, R00014]`, Eingabe „  Ohne Herkunft “ → Datei `origins: [thin air]`, Chip „ohne Herkunft“.
  - Besteht: Eingabe „THIN AIR“ → dasselbe.
  - Fällt durch: Eingabe „ohne Herkunftx“ ersetzt die Herkünfte (richtig ist: `origins: [I0001, R00014, ohne Herkunftx]`).
  - Gegenbeispiel, das gleich bleibt: der Filter `origin:"thin air"` findet die Aufgabe; der Filter `origin:"ohne Herkunft"` gehört nicht zu dieser Anforderung.

## Betroffene Verzeichnisstruktur

```
web/
  kultur.js              neu: Datumsformen, FELDER, „ohne Herkunft“
  index.html             Script-Tag für kultur.js
  ansicht.js             Datumsstellen und Beschriftungen (Fundstellen siehe Grobentwurf)
  berichte.js            vollDatum (:453) über das Modul; isoD (:353) nur für Schlüssel
  app.js                 Eingabe „ohne Herkunft“ (:1146–1150)
  kd-app.css             Beschriftung und Schlüssel-Hilfstext in .felder (:334)
src/web/statisch.rs      kultur.js in der Liste dateien!
e2e/
  einheit/kultur.test.js neu: Unit-Test des Moduls
  tests/kultur-hilfen.js neu: ISO-Probe und Beschriftungsprobe mit Selbstproben
  tests/kultur.spec.js   neu: Probe über alle Ansichten
  tests/r00004-board-ansehen.spec.js, r00028-schnelleingabe.spec.js, r00017-archiv.spec.js,
        r00013-kommentare.spec.js, r00023-verlauf.spec.js, r00078-fieber.spec.js   Erwartungen an sichtbaren Text
```

## Technische Überlegungen

Entschieden in ADR-0013 (Option A, Akzeptiert); Aspekt X00004 Kultur der Anzeige, Baustein A00009 Oberfläche.

### Ablauf

Zuerst das Modul mit Unit-Test (B0426). Frei baubar sind auch die beiden Proben mit Selbstproben (B0427, B0435). Danach laufen die vier Features parallel: Datumsangaben auf Karte und Fenster (B0428, B0429, B0430), in Personen und Berichten (B0431, B0432, B0433), Beschriftungen (B0436, B0437) und „ohne Herkunft“ (B0438, B0439).

### Grobentwurf

- **Modul** `web/kultur.js` als IIFE-Modul wie `web/zeiten.js`, im Browser global, in Node über `require`. Eingetragen in `src/web/statisch.rs` (`dateien!`) und als Script-Tag in `web/index.html` vor `ansicht.js`.
  - Formen lang, kurz (mit „heute“), Zeitpunkt (über `ortszeit`), Wochentag; Namen der Funktionen entscheidet der Entwickler.
  - `FELDER` nach FA 10 und 13; Anzeigetext „ohne Herkunft“; Erkennung der Eingabe nach FA 16 als reine Funktion.
- **Fundstellen** (`web/ansicht.js`, Stand f74a8c1):
  - Datum: Schnellvorschau `:164`, Archivleiste `:255`, Durchläufe `:282` (`ortszeit().slice(5)`), Kommentare `:295`, Zeiten `:312` (`slice(5,10)`), Karte `:492`, Aufgabenreservierungen des Boards `:572` (`slice(5)`), `deTag` `:617` mit „überfällig seit“ `:623`, Personen `:761`, Stundenzettel `:820–821`, Burndown `:874`, `deDatum` `:1021`, Wie lange noch `:1104`, Fever `:1214`; `web/berichte.js` `isoD` `:353`, `vollDatum` `:453`.
  - Beschriftungen: „Neue Aufgabe“ `:180–186`, Aufgabenfenster `:262–270`, `:407`, `:414`, `:566`, Einrichten `:1296`, `:1307`, erster Start `:1372–1377`.
  - Herkunft: Chip `vHerkunftChip` `:385` und `vHerkunft` `:453`, Feld `:264`; Eingabe `web/app.js:1146–1150`.
- **Beschriftung**: Heute ist `.felder .k` die Beschriftung und zeigt den Schlüssel in Mono (`web/kd-app.css:334`). Danach trägt `.k` die deutsche Beschriftung, und der Schlüssel steht in einem eigenen Element daneben. Die Felder behalten ihre `aria-label` (FA 12); die Knopfreihe der Zuständigen bekommt `role="group"` mit dem Namen „Zuständig“.
- **Proben** in `e2e/tests/kultur-hilfen.js`:
  - ISO-Probe: sichtbare Textknoten (über `TreeWalker`, ohne `display:none` und `visibility:hidden`), `title` und zugängliche Namen; ausgenommen `#dateitext`, die YAML-Vorschau und der `value` von `input[type=date]`.
  - Beschriftungsprobe: je Feld Text der Beschriftung, zugänglicher Name, Vergleich mit `FELDER` und den Schlüsseln (exakt, Groß- und Kleinschreibung beachtet).
- **Erkennung im Review**: `grep -nE "esc\((a|s|x|t|pt)\.(faellig|datum|archiviert)\)|ortszeit\(|isoD\(" web/ansicht.js` (X00004) findet danach nur Schlüssel und Vergleiche.

### Gestaltung

Artboards: `Dokumentation/Wireframes/D0003.dc.html` (Seitenleiste des Aufgabenfensters, „Neue Aufgabe“), `D0002.dc.html` (Karte), `D0001.dc.html` (erster Start), Betrieb `lokal`.
- Die Datumsform ist kein neuer Zustand: D0002 und D0003 zeigen ISO auf der Karte, die Vision geht vor (PO Z. 144). Der Director nimmt Bildschirmfotos von Karte, Aufgabenfenster und einer Berichtstabelle auf den Abnahmezettel (Auflage PO Z. 144).
- Die Beschriftung mit Schlüssel als Hilfstext ist ein neuer Zustand: D0003 und D0001 zeigen die Schlüssel als Beschriftung. Ob der gestalter ihn vor B0436 und B0437 zeichnet, ist Offene Frage 2.

### Umfang

I0098: 4 Features, 14 Bubbles, 14–28,5 h, ungemessen (Hypothese).
- Herleitung: Summe der Bubble-Spannen — F0052 5,5–10,5 h (B0426 1,5-2,5, B0427 1-2, B0428 1-2, B0429 1,5-2,5, B0430 0,5-1,5), F0053 4–9,5 h (B0431 0,5-1,5, B0432 1,5-3, B0433 1-2, B0434 1-3), F0054 3,5–6,5 h (B0435 1-2, B0436 1,5-2,5, B0437 1-2), F0055 1–2 h (B0438 0,5-1, B0439 0,5-1).
- Die Spannen sind ungemessen, nach dem Muster von I0095–I0097.
- B0434 ist bedingt: Findet die Probe nach B0433 nichts, entfällt sie, und der Umfang sinkt auf 13–25,5 h.
- Gezählte Eingänge (Stand f74a8c1): 14 Datumsstellen in `web/ansicht.js` und 4 Former (`deTag`, `deDatum`, `vollDatum`, `isoD` in `web/berichte.js`), 26 Beschriftungen, die einen Schlüssel zeigen (`grep 'class="k"' web/ansicht.js`), 6 E2E-Dateien mit Erwartungen an sichtbaren ISO-Text. Fenster, Menüs, WBS-Sicht und erster Start sind nicht abgesucht; ihre Zahl ist unbekannt.
- Offene Frage 1 brächte bei Zustimmung eine Bubble mit 0,5–1 h dazu.

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Feature | Inhalt | Aufwand | Braucht |
|---|---|---|---|---|
| B0426 | F0052 | Kulturmodul mit Jahreswechsel-Test | 1,5-2,5 | — |
| B0427 | F0052 | ISO-Probe mit Selbstproben | 1-2 | — |
| B0428 | F0052 | Fälligkeit auf der Karte und Schnellvorschau | 1-2 | B0426 |
| B0429 | F0052 | Datumsangaben im Aufgabenfenster | 1,5-2,5 | B0426 |
| B0430 | F0052 | Probe über Karte und Fenster | 0,5-1,5 | B0427, B0428, B0429 |
| B0431 | F0053 | Personen und Stundenzettel | 0,5-1,5 | B0426 |
| B0432 | F0053 | Berichte über das Kulturmodul | 1,5-3 | B0426 |
| B0433 | F0053 | Probe über alle Ansichten | 1-2 | B0430, B0431, B0432 |
| B0434 | F0053 | Restfunde der Probe (bedingt) | 1-3 | B0433 |
| B0435 | F0054 | Beschriftungsprobe mit Selbstproben | 1-2 | — |
| B0436 | F0054 | Beschriftungen im Aufgabenfenster und in „Neue Aufgabe“ | 1,5-2,5 | B0426, B0435 |
| B0437 | F0054 | Übrige Beschriftungen | 1-2 | B0426, B0435 |
| B0438 | F0055 | Chip und Hinweis „ohne Herkunft“ | 0,5-1 | B0426 |
| B0439 | F0055 | Eingabe „ohne Herkunft“ | 0,5-1 | B0426 |

Die Bubbles sind Vorgabe für den Bau, keine Vereinbarung; geprüft wird gegen die Akzeptanzkriterien und die User Story.

## Tests

- **Unit-Test** `e2e/einheit/kultur.test.js` (node:test, wie `zeiten.test.js`):
  - Langform `2026-10-28` → `28.10.2026`; Zeitpunkt `2026-10-28T14:05+01:00` → `28.10.2026 14:05` (Ortszeit wie `ortszeit`); Wochentag wie `deDatum` für Mo bis So (Verhalten aus R00073).
  - Kurzform mit „heute“: Jahreswechsel nach AK 2 (31.12. kurz, 01.01. des Folgejahrs lang, Vorjahr lang); 28.10. mit heute 2026-11-06 kurz.
  - Mutanten fallen durch: Kurzform ohne Jahresvergleich, Tag und Monat vertauscht, fehlende führende Null.
  - `FELDER` enthält jeden Schlüssel aus FA 10 und 13 mit seiner Beschriftung; keine Beschriftung ist ein Schlüssel.
  - Erkennung „ohne Herkunft“ nach AK 6: „ohne Herkunft“, „  Ohne Herkunft “, „OHNE HERKUNFT“, „Thin Air“ → ja; „ohne Herkunftx“, „ohne“, „Herkunft“ → nein.
- **Selbstproben** in `e2e/tests/kultur-hilfen.js` (`page.setContent`, ohne kanbanD), jede Regex positiv und negativ geprüft:
  - ISO-Probe positiv: „2026-10-28“, „fällig 2026-10-28“, „2026-10-28 14:05“ im Text, im `title` und im `aria-label` werden gefunden.
  - ISO-Probe negativ: „28.10.2026“, „28.10.“, „R00108“, „kd:I0001“, „JJJJ-MM-TT“ werden nicht gefunden; ISO in `#dateitext` und im `value` eines `input[type=date]` wird nicht gefunden, derselbe Text in einem `span` daneben schon.
  - Bekannte Grenze der Regex: Die heutige Form „10-28 14:05“ (Durchläufe) passt nicht. Diese Stellen prüfen die Szenarien US-2 und US-3 mit konkreten Erwartungen.
  - Beschriftungsprobe positiv (Verstoß erkannt): Beschriftung „column“, „labels“, „Spalte column“ in einem Element, Feld mit Namen „origins“ zur Beschriftung „Herkunft“, Knopfgruppe ohne Namen.
  - Beschriftungsprobe negativ (kein Verstoß): „Spalte“ mit Namen „Spalte“, „Labels“ mit Namen „Labels“, „Herkunft“ mit Namen „Neue Herkunft“.
- **Probe** `e2e/tests/kultur.spec.js` nach dem Muster von `e2e/tests/ziele.spec.js`: Grundbestand, Ansichtenliste aus `e2e/tests/ansichten.js` plus Zustände aus FA 18, Vollständigkeitstest der Liste, Ausnahmeliste leer mit Alarm; Szenarien US-1 bis US-9 mit konkreten Erwartungen.
- **Mitgeänderte E2E-Tests** (Erwartungen an sichtbaren Text, ADR-0013 Konsequenzen):
  - `r00004-board-ansehen.spec.js:37` — `.due` „2030-01-31“ → „31.01.2030“;
  - `r00028-schnelleingabe.spec.js:23` — `.due` morgen als ISO → Kurzform (am 31.12. lang);
  - `r00017-archiv.spec.js:35` — „Archiviert am 2026-10-01“ → „Archiviert am 01.10.2026“;
  - `r00013-kommentare.spec.js:19` — „Claude · 2026-10-17 09:00“ → „Claude · 17.10.2026 09:00“;
  - `r00023-verlauf.spec.js:34` — Tabelle „2026-10-01“ → „01.10.2026“;
  - `r00078-fieber.spec.js:160–161` — Tabelle `tag()` als ISO → Langform.
- **Unverändert grün**: r00073 und r00076:73 (schon deutsch), r00090:18 (`data-kennung`, nicht sichtbar), r00035:50 (`assignees` im Reiter „Datei“), r00059 (`wbs-effects-green` ist ein Prüfname), alle Prüfungen von Dateiinhalten, `e2e/einheit/filter.test.js:12, :25` (`origin:"thin air"`), die 17 Tests mit `getByLabel`.
- Abnahme-Befehle: `node --test e2e/einheit/kultur.test.js` und `npx playwright test kultur`.

## Abhängigkeiten

- ADR-0013 (Akzeptiert); Aspekt X00004 Kultur der Anzeige; Baustein A00009 Oberfläche.
- Abhängig von (alle grün): I0011 Aufgabe ansehen und bearbeiten (R00011), I0018 Herkunft und Abhängigkeiten (R00018), I0036 Neue Aufgabe im Dialog (R00036), I0061 Diagramme im Vollbild, Datum überall (R00073), I0072 Zeitpunkte mit Zeitzone (R00084), I0081 Durchläufe als Daten (R00094), I0096 Kontrast-Tokens (R00107, gemeinsame Ansichtenliste `e2e/tests/ansichten.js`), I0097 Bedienziele groß genug (R00108, Muster `e2e/tests/ziele.spec.js`).
- Blockiert: keine Interaction.

## Offene Fragen

1. **Herkunftsfeld in „Neue Aufgabe“**: Das Feld trennt die Eingabe an Leerzeichen und Kommas (`web/app.js:336`). „ohne Herkunft“ würde zwei Herkünfte „ohne“ und „Herkunft“, `thin air` schon heute „thin“ und „air“. PO Z. 145 nennt nur das Feld im Aufgabenfenster. Empfehlung: dieselbe Regel — ist der ganze Feldinhalt getrimmt „ohne Herkunft“ oder `thin air`, entsteht `[thin air]`; eine Bubble mehr unter F0055 (0,5–1 h). Bis zur Antwort nicht eingeplant und kein Akzeptanzkriterium.
2. **Gestaltung der Beschriftung vor dem Bau**: Beschriftung plus Schlüssel als Mono-Hilfstext ist ein neuer Zustand ohne Artboard. Die Vision verlangt, dass der Mensch jede Gestaltung sieht, bevor sie gebaut wird. Empfehlung: der gestalter zeichnet die Seitenleiste des Aufgabenfensters und „Neue Aufgabe“ an D0003 sowie die Felder des ersten Starts an D0001, bevor B0436 und B0437 bauen; F0052, F0053, F0055 und B0435 hängen nicht daran.

## Manuelle Vorbereitungstätigkeiten
Keine.

## Manuelle Nachbereitungstätigkeiten
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die englischen und ISO-Stellen haben eine gemeinsame Ursache: Es gibt keinen Ort, an dem Anzeige geformt wird. Jede Ansicht schreibt den Wert der Datei direkt in den Text, und die drei deutschen Former stehen verstreut daneben. Ein Modul für Datumsformen und Beschriftungen macht die Kultur zu einer Stelle, die auch künftige Ansichten benutzen. Die Grenze beim Zeichnen lässt Dateien, API und Filter unberührt, deshalb bricht kein Agent. Die Probe über alle Ansichten fängt jede neue ISO-Stelle, bevor ein Mensch sie sieht, und die Beschriftungsprobe hält Wort und Name der Felder beisammen.

## Missing-Docs
- Glossar: `D00003-seitenleiste.md:23` und `D00001-aufgabenfenster.md:26` nennen „Zuständige“ und „Fälligkeit“, die Beschriftungen heißen nach ADR-0013 „Zuständig“ und „Fällig“. Abgleich nach dem Bau über `/domaenenwissen aendern`.
- Kein Glossareintrag für „ohne Herkunft“ (Anzeige von `thin air`) und für Kurz- und Langform.
- `X00004-kultur.md` (Systemantwort) und `A00009-oberflaeche.md` beschreiben das Modul als Soll. Nach dem Bau nennt der Entwickler dort Modul und Probe.

## Notizen
- **Abnahme der Karte #11**: die Abnahme-Probe steht wörtlich in AK 1.
- **PO-Entscheidungen**: Z. 144 (Umfang: alle sichtbaren Datumsangaben und Feldbeschriftungen, Probe ohne Ausnahmeliste, Vision vor Wireframe, Bildschirmfotos), Z. 145 („ohne Herkunft“ als Eingabe, Filter unverändert), Z. 146 (Lang- und Kurzform, Jahreswechsel im Unit-Test).
- **Abnahme-Idee des architekt** übernommen: Probe nach `e2e/tests/ziele.spec.js` mit `e2e/tests/ansichten.js`, Unit-Test `e2e/einheit/kultur.test.js`, jede Regex positiv und negativ, mitgeänderte E2E-Tests im Umfang.
- **Entscheidungen des planers**:
  - Elterndialog D0003: zwei der drei Teile der Abnahme-Probe, das Herkunftsfeld, `FELDER` und die Tabellen Durchläufe und Zeiten liegen im Aufgabenfenster und in „Neue Aufgabe“; auf dem Board liegt nur die Fälligkeit.
  - Vier Features: Datum auf Karte und Fenster, Datum in Personen und Berichten, Beschriftungen, „ohne Herkunft“ — je von außen prüfbar, nach dem Modul parallel baubar; eine Anforderung, eine Karte (PO Z. 144).
  - Beschriftungen für die Schlüssel, die ADR-0013 offenließ: „Wirkungen“, „Phasen“, „Reservierung“, „WBS“, „Anforderungen“, „Agenten“. „Wirkungen“ folgt dem Namen „WBS-Wirkungen“ des Prüfpunkts (`web/ansicht.js:450`).
  - Feldnamen über die vorhandenen `aria-label`, nicht über `<label for>`: sie enthalten die Beschriftung schon, und 17 Tests finden die Felder darüber (ADR-0013 Regel 4 überlässt die Wahl der Anforderung).
  - Der Vergleich „Beschriftung ist kein Schlüssel“ beachtet Groß- und Kleinschreibung, sonst fiele „Labels“ wegen `labels` durch.
  - Die ISO-Regex der Karte fängt die heutige Form „10-28 14:05“ nicht; konkrete Szenarien (US-2, US-3) decken sie.
  - Die Seite „API für Agenten“ gehört zur Probe: sie nennt Formate als „JJJJ-MM-TT“, nicht als Datum, und braucht keine Ausnahme.
  - Die Auswahl der Zuständigen bekommt einen Gruppennamen, damit auch sie ein Feld mit Namen ist.
- **Bewusst außerhalb**: Filter `origin:"ohne Herkunft"` (PO Z. 145); Sprache des Browsers im nativen Datumsfeld (ADR-0013 „Was überwiegt“); Texte außerhalb der Weboberfläche (API-Antworten, CLI).
- **Verworfene Alternativen (Schnitt)**: Karte und Fenster allein (PO Z. 144: alle); je Ansicht eine Anforderung (Modul und Probe sind gemeinsam, die Karte hat eine Abnahme); Schnitt nach Schichten (erst Modul, dann Ansichten) — nicht von außen prüfbar.
