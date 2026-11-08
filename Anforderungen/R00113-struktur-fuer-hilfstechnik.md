---
id: R00113
status: Neu
datum: 2026-11-08
---

# R00113: Struktur für Hilfstechnik

## Beschreibung

Die Oberfläche hat für Screenreader kaum Struktur (Karte #13, Sollte aus der UX-Durchsicht mit Material 3 vom 2026-10-31; Ist gelesen in kanbanD `b17c412` und `362284a`):
- **Überschriften**: In `#main` gibt es auf keiner Route eine `h1`. Das Board hat keine Überschrift. Die Berichte beginnen mit `h3.dtitel` (9 Stellen in `web/ansicht.js`, gezählt). Einrichten und der Einrichtungsmodus beginnen mit `h3` (8 Stellen, `:1357–1408`), die Aufgabenliste mit `h4` „ZIEHEN AUF“ (`:791`).
- **Karte**: Die Karte ist `div.ka` mit `tabindex=0`, ohne Rolle und ohne Namen (`web/ansicht.js:529`, defekt `:537`, fehlt `:640`). Bei Auswahl trägt sie `aria-selected="true"`, das ohne Rolle nicht gilt.
- **Navigation**: `nav.kz-nav` markiert die aktuelle Seite nur mit der Klasse `an` (`:76`), das Seitenmenü unter 600 px ebenso (`:96–103`). `aria-current` fehlt.
- **Klapp-Knopf**: „<Spalte> zuklappen“ (`:708`) und „<Spalte> aufklappen“ (`:693`) tragen kein `aria-expanded`.
- **Landmarks**: Sie stehen schon (`header.kz`, `main#main`, `footer#stat`, `web/index.html:12`, `web/ansicht.js:36–45`).

Diese Anforderung setzt ADR-0018 um (Option A mit 2a und 3a, Regeln 1–6, Aspekt X00005):
- eine visuell verborgene `h1` je Route aus `vHaupt()`;
- Abschnitte als `h2`, ohne übersprungene Ebene;
- die offene Spaltenfläche als `list`, jede Karte als `listitem` mit einem Namen aus der reinen Funktion `kartenName`;
- `aria-current="page"` unter derselben Bedingung wie die Klasse `an`;
- `aria-expanded` am Klapp-Knopf;
- eine Probe über alle Routen, abgeglichen gegen die Verzweigungen von `vHaupt()`, die gegen Mutanten rot wird.

Nicht Teil:
- die `h4` als Kopf in `role=menu` (`web/ansicht.js:103`, `:129`, `:359`; ADR-0018 Offene Fragen, möglicher Folgepunkt);
- die erneute Ansage der fokussierten Karte beim Neuzeichnen (nur mit echter Hilfstechnik messbar);
- der Lesemodus eines Screenreaders auf der Karte (Grenze, siehe Nicht-funktionale Anforderungen 5).

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Ein eigenes Design, früh vom Menschen gesehen. Es ist per Tastatur bedienbar und folgt gewohnten Konventionen“. Überschriften, Landmarks, Listen, `aria-current` und `aria-expanded` sind die Konventionen, nach denen sich Hilfstechnik zurechtfindet. Die Struktur ändert nichts Sichtbares, deshalb ist kein Artboard vor dem Bau nötig (Offene Fragen 1).

### Domänenbezug
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — der Name der Karte folgt ihm über das Neuzeichnen
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — unter 600 px ersetzt der Seitenknopf die Navigation

## Geschäftlicher Nutzen

Wer mit einem Screenreader arbeitet, springt heute auf dem Board ins Leere: keine Überschrift, keine Liste, und eine Karte im Fokus hat keinen Namen. Das Board ist damit nur für Sehende bedienbar. Mit Überschriften springt man in einem Tastendruck zur Spalte. Die Liste sagt an, wie viele Karten darin liegen. Der Name nennt die Karte so, wie Menschen sie im Gespräch nennen („#22 Login prüfen, Fehler“). Die Struktur entsteht an einer Stelle und wird von einer Probe bewacht. Jede künftige Seite erbt sie, und niemand muss sie je Sicht nachrüsten.

## Funktionale Anforderungen

### Landmarks (ADR-0018 Regel 1)

1. Je Route genau einmal `banner` (`header.kz`), `main` (`#main`) und `contentinfo` (`footer#stat`). Höchstens eine `navigation` (`nav.kz-nav`). Unter 600 px, im Einrichtungsmodus und im ersten Start gibt es keine. Keine Sicht setzt ein weiteres `header`, `nav`, `main` oder `footer`.

### Überschriften (ADR-0018 Regel 2, Entscheidung 3a)

2. Je Route und in den Zuständen erster Start, Einrichtungsmodus und defektes Board steht genau eine `h1`. Sie entsteht nur in `vHaupt()` vor der Sicht und ist visuell verborgen (`.vh`). Ihr Text beginnt mit dem Seitennamen:
   - Board: „Board · <Boardtitel>“;
   - Bericht: „Berichte · <Name des Berichts wie im Menü Berichte>“, z. B. „Berichte · Burndown“;
   - WBS-Sicht: „WBS · <Name der Anwendung>“;
   - erster Start: „Einrichten“;
   - sonst der Seitenname aus `seitenName()`: „Aufgaben“, „Personen“, „Einrichten“.
   Keine Sicht schreibt selbst eine `h1`.
3. Auf dem Board ist das erste Kind jeder `section.bahn` eine visuell verborgene `h2` mit dem reinen Spaltennamen, bei offener wie bei zugeklappter Spalte.
4. Die Abschnitte der Berichte sind `h2.dtitel` statt `h3.dtitel`. Die Abschnitte von Einrichten und Einrichtungsmodus und der Kopf „ZIEHEN AUF“ der Aufgabenliste sind `h2`. Ihre Gestaltung hängt an einer Klasse, nicht am Tag.
5. Innerhalb von `#main` folgt keiner Überschrift eine, die mehr als eine Stufe tiefer liegt.

### Karte (ADR-0018 Regeln 3, 4)

6. Die Fläche einer offenen Spalte (`div.flaeche`) trägt `role="list"`. Jede `.ka` (auch `.defekt` und `.fehlt`), `.leer` und `.nach` tragen `role="listitem"`. Die zugeklappte Spalte ist ein Knopf (`button.flaeche.zu-streifen`) und wird keine Liste.
7. Jede `.ka` trägt `aria-label` aus der reinen Funktion `kartenName` (Modul, das im Browser und in Node lädt):
   - Karte: `#<nr> <Titel>`, mit Klasse dahinter `, <Bezeichnung der Klasse>`, bei Auswahl am Ende `, ausgewählt`;
   - defekte Datei: `#<nr> Datei defekt, nur lesbar`;
   - fehlende Aufgabe: `#<nr> Aufgabe fehlt`.
8. Der Name nennt kein Datum und keine Zeit und nie den Schlüssel einer Klasse (ADR-0013). Bei unbekanntem Schlüssel entfällt der Zusatz. Datum, Signale und Zuständige liest weiter der Inhalt der Karte, die Fälligkeit mit Jahr („fällig 28.10.2026“, PO Z. 146).
9. `aria-selected` entfällt an der Karte. Die Auswahl bleibt die Klasse `.gewaehlt` und steht im Namen.
10. Den Namen schreibt nur das Zeichnen (`vKarte`, `vDefekt`, `vFehlt`). Es gibt keinen Name-Zustand, keinen Nachführer und kein `aria-live` an der Karte. Ein Live-Ereignis erneuert den Namen über `laden()` → `uebernehmen()` → `render()` (ADR-0014).
11. Tastatur (`brettTaste`, ADR-0010), Öffnen (`data-act="oeffnen"`), Ziehen (`draggable`) und Fokusführung (`fokusKarte`) bleiben unverändert. Signal-Knopf, Stopp-Knopf, Herkunfts-Link und Umbenennen-Feld bleiben Kinder der Karte mit eigener Rolle.

### Aktuelle Seite (ADR-0018 Regel 5)

12. Ab 600 px trägt genau ein `nav a` `aria-current="page"`, gesetzt unter derselben Bedingung wie die Klasse `an`:
    - auf einer Berichtsroute der Auslöser `a#t-ber`;
    - in der WBS-Sicht der Link der aktiven Anwendung.
13. Unter 600 px trägt im Seitenmenü der Eintrag mit `an` `aria-current="page"`. Der Seitenknopf heißt weiter „Seite: <Seitenname>“.

### Klapp-Knopf (ADR-0018 Regel 6)

14. `.bk-name` trägt `aria-expanded="true"`, `.zu-streifen` trägt `aria-expanded="false"`. Beides steht statisch im Renderer und folgt `spaltenZu()`. Die Namen „<Spalte> zuklappen“ und „<Spalte> aufklappen“ bleiben.

### Durchsetzung (ADR-0018 „Durchsetzung“)

15. Eine E2E-Probe prüft FA 1–3, 5, 6, 7, 12–14 auf jeder Route und in den drei Zuständen. Die Zahl ihrer Routen und Zustände wird gegen die Zahl der Verzweigungen von `vHaupt()` abgeglichen (heute 15, gezählt in `web/app.js:136–151`). Die Prüffunktion liefert die Verstöße als Liste, damit Mutanten sie lesen können.

## Nicht-funktionale Anforderungen

1. **Unsichtbar**: Board, Berichte, Einrichten, Einrichtungsmodus und Aufgabenliste sehen nach dem Bau aus wie vorher. Gemessen werden Schriftgröße, Schriftstärke, Laufweite, Farbe, Ränder und Höhe der umgestellten Überschriften sowie die Breite der Spalten. Die Werte werden vor dem Bau am heutigen Stand gemessen und im Test festgeschrieben.
2. **Rückwärtsverträglich**: Bestehende E2E-Tests bleiben grün. Die einzige Umstellung ist `e2e/tests/r00065-mehrfachauswahl.spec.js:35`: statt `aria-selected` werden `.gewaehlt` und das Namensende „, ausgewählt“ geprüft. Hinzu kommen die Snapshots in `e2e/tests/kultur.spec.js` (`:132`, `:592–605`), die um die Zeile `listitem "<Name>"` ergänzt werden.
3. **Aktualität**: Name und sichtbarer Titel einer Karte stimmen nach jedem Neuzeichnen überein, im selben `render()`. Es gibt keinen zweiten Zeitpunkt, und das Lastprofil (Live-Änderung < 1 s) bleibt.
4. **Breite**: Die verborgenen Überschriften erzeugen keine Breite. Bei 320 px scrollt nichts quer (ADR-0015 Regel 1). `ziele.spec.js`, `kontrast.spec.js` und `r00111-schmal-wie-breit.spec.js` bleiben grün.
5. **Grenze (kein Kriterium, ADR-0018 Option A, akzeptierte Schwäche)**: Im Lesemodus von NVDA oder JAWS fängt der Screenreader auf einer fokussierten Karte Pfeile und Einzelbuchstaben selbst ab. Die Karten-Kürzel aus ADR-0010 wirken erst im Fokusmodus (NVDA+Leertaste). Ohne Wechsel bleiben zwei Wege: Enter öffnet die Karte, Menütaste bzw. Umschalt+F10 öffnet das Kartenmenü mit „Verschieben nach“. Mit echter Hilfstechnik gemessen ist das nicht. Fällt es in der Abnahme als Befund an, ist der nächste Zug eine eigene Anforderung mit Widget-Rolle (ADR-0018 Pre-Mortem, Option B), kein Nachbessern hier.

## Akzeptanzkriterien

Geprüft mit dem Grundbestand aus `user-stories/R00113.md`.

- [ ] **1. Abnahme-Probe der Karte #13 (wörtlich)**: „genau eine h1 je Route; Board: je Spalte eine h2; jede `.ka` hat Rolle und zugänglichen Namen beginnend mit `#<nr>`; genau ein `nav a[aria-current=page]`; Klapp-Knopf trägt `aria-expanded` passend zum Zustand.“
  - Präzisierung des architekten (ADR-0018): „genau ein `nav a[aria-current=page]`“ gilt ab 600 px. Unter 600 px gibt es keine Navigation, dort trägt der Eintrag mit `an` im Seitenmenü `aria-current` (AK 12). Im Einrichtungsmodus und im ersten Start gibt es keine Navigation.
  - Besteht: die Probe `r00113-struktur.spec.js` ist auf allen 13 Routen und in den drei Zuständen grün.
  - Fällt durch: eine Route ohne oder mit zwei `h1`; eine Karte ohne Namen; zwei Links mit `aria-current`.
  - Prüfebene: E2E US-1, US-3, US-5, US-9, US-11; Mutanten nach AK 14.
- [ ] **2. Seitenüberschrift mit Seitenname**: Auf dem Board heißt die `h1` „Board · Entwicklung“, im Bericht Burndown „Berichte · Burndown“, in der Aufgabenliste „Aufgaben“, im ersten Start „Einrichten“. Sie ist nicht zu sehen und hat ein Rechteck von 1 × 1 px.
  - Fällt durch: sichtbare Überschrift; Text ohne Seitennamen; eine Sicht schreibt ihre eigene `h1`.
  - Prüfebene: E2E US-1.
- [ ] **3. Landmarks**: Je Route und Zustand je genau ein `banner`, `main`, `contentinfo` und höchstens eine `navigation`. Bei 560 px, im ersten Start und im Einrichtungsmodus gibt es keine `navigation`.
  - Fällt durch: zwei `main`; eine `navigation` im ersten Start.
  - Prüfebene: E2E US-1. Heute schon erfüllt, die Prüfung ist Schutz.
- [ ] **4. Spalten als zweite Ebene**: Das Board „Entwicklung“ hat genau drei `h2`: „Zu erledigen“, „In Arbeit“ (zugeklappt) und „Erledigt“, je als erstes Kind ihrer `section.bahn`.
  - Fällt durch: die zugeklappte Spalte ohne `h2`; `h2` mit dem Text des Klapp-Knopfs („In Arbeit aufklappen“); sichtbare `h2`.
  - Prüfebene: E2E US-3.
- [ ] **5. Keine übersprungene Ebene, Gestaltung gleich**: Auf keiner Route folgt einer Überschrift eine, die mehr als eine Stufe tiefer liegt. Die Berichte, Einrichten, der Einrichtungsmodus und „ZIEHEN AUF“ beginnen unter der `h1` mit `h2`. Die berechneten Werte nach NFA 1 sind gleich den vor dem Bau festgeschriebenen, die Breite jeder `section.bahn` ebenso.
  - Fällt durch: der Bericht Burndown springt von `h1` auf `h3` (heute); „ZIEHEN AUF“ als `h4` (heute); `h2.dtitel` mit anderer Schriftgröße als `h3.dtitel` vorher; Einrichten-Köpfe ohne ihren grauen Balken (`.einr h3` greift nicht mehr).
  - Prüfebene: E2E US-4; Bildschirmfotos vorher/nachher auf dem Abnahmezettel.
- [ ] **6. Karte als Listeneintrag mit Namen**: Die Spalte „Zu erledigen“ ist eine `list` mit drei `listitem` „#1 eins, Fehler“, „#2 zwei, Funktion“, „#3 Ölwechsel & <Prüfung>“. In #1 finden `getByRole('button')` den Signal-Knopf und `getByRole('link')` die Herkunft.
  - Fällt durch: Name mit `&amp;` oder ohne Klasse; Kinder als bloßer Text; die zugeklappte Spalte als `list`.
  - Gegenprobe M3: eine Mutante, die `aria-label` von `.ka` nimmt, macht die Probe rot.
  - Prüfebene: Unit `e2e/einheit/kartenname.test.js`; E2E US-5.
- [ ] **7. Auswahl im Namen**: Nach Strg+Klick auf #1 heißt die Karte „#1 eins, Fehler, ausgewählt“, nach erneutem Strg+Klick „#1 eins, Fehler“. Keine Karte trägt `aria-selected`.
  - Fällt durch: `aria-selected` bleibt; Name ändert sich nicht.
  - Prüfebene: E2E US-6, `r00065-mehrfachauswahl.spec.js` umgestellt.
- [ ] **8. Defekt und fehlend**: #4 heißt „#4 Datei defekt, nur lesbar“, #9 „#9 Aufgabe fehlt“, beide als `listitem`.
  - Prüfebene: Unit; E2E US-7.
- [ ] **9. Live**: Ändert Claude über die API den Titel von #2 in „umbenannt“, heißt #2 nach `kdTest.gezeichnet()` „#2 umbenannt, Funktion“, ohne Neuladen. Name und sichtbarer Titel `.t` stimmen überein.
  - Fällt durch: alter Titel im Namen; Name erst nach `page.reload`.
  - Prüfebene: E2E US-8.
- [ ] **10. Kultur**: Kein Name einer Karte enthält ein Datum (keine Ziffernfolge `TT.MM.`, kein ISO-Datum) oder einen Klassenschlüssel (`bug`, `feature`). Der Inhalt von #1 liest weiter „fällig 28.10.2026“. Die Kultur-Probe (`kultur.spec.js`) bleibt grün.
  - Fällt durch: „#1 eins, bug“; „#1 eins, Fehler, fällig 28.10.“.
  - Prüfebene: Unit; E2E US-5; `kultur.spec.js`.
- [ ] **11. Aktuelle Seite breit**: Bei 1280 × 800 gibt es auf jeder Route genau ein `nav a[aria-current=page]`: „Board“, „Aufgaben“, „Personen“, `a#t-ber` auf jeder der acht Berichtsrouten, „WBS“ in der WBS-Sicht, „Einrichten“.
  - Gegenprobe M4: eine Mutante, die `aria-current` zusätzlich an „Aufgaben“ setzt, macht die Probe auf dem Board rot.
  - Prüfebene: E2E US-9.
- [ ] **12. Aktuelle Seite schmal**: Bei 560 × 800 in der Aufgabenliste gibt es keine `navigation`, der Seitenknopf heißt „Seite: Aufgaben“, und im offenen Seitenmenü trägt genau ein Eintrag `aria-current="page"`: „Aufgaben“, der mit `.an`.
  - Prüfebene: E2E US-10.
- [ ] **13. Klappzustand**: „Zu erledigen zuklappen“ ist ein Knopf mit `aria-expanded="true"`. Nach dem Klick und nach dem Neuladen ist „Zu erledigen aufklappen“ ein Knopf mit `aria-expanded="false"`. Nach dem zweiten Klick ist der Zustand wieder `true`.
  - Fällt durch: Attribut fehlt; Attribut bleibt `true` nach dem Zuklappen; geänderter Name.
  - Prüfebene: E2E US-11; `r00074-spalten-zuklappen.spec.js` grün.
- [ ] **14. Probe vollständig und negativ geprüft**: Die Probe prüft so viele Routen und Zustände, wie `vHaupt()` Verzweigungen hat (heute 15). Gegen die Mutanten M1 (`h2.wbs-titel` als `h1`) und M2 (eine Verzweigung mehr im Quelltext von `vHaupt()`) wird sie rot und nennt „2 Überschriften erster Ebene in WBS-Sicht“ bzw. „Route ohne Prüfung“. M3 und M4 stehen in AK 6 und 11.
  - Fällt durch: die Probe bleibt gegen eine Mutante grün.
  - Prüfebene: E2E US-2.
- [ ] **15. Nichts sonst geändert**: Pfeile, Ziffern und Buchstaben auf der Karte, Enter, Ziehen und der Fokus nach dem Neuzeichnen verhalten sich wie vorher. `npx playwright test` und `node --test e2e/einheit/` sind grün, mit der Umstellung nach NFA 2 als einziger Änderung an bestehenden Tests.
  - Prüfebene: gesamte Suite.

## Betroffene Verzeichnisstruktur

```
web/
├── app.js                 # vHaupt: h1 vor der Sicht
├── ansicht.js             # h2 je Spalte, h2.dtitel, Einrichten/Ziele h2, list/listitem, aria-label,
│                          # aria-current (vNavigation, vWbsMenue, vSeitenPop), aria-expanded
├── kartenname.js          # neu: kartenName, kartenNameDefekt, kartenNameFehlt
├── index.html             # lädt kartenname.js
└── kd-app.css             # .einr h3, .ziele h4 auf Klassen gezogen
e2e/
├── einheit/kartenname.test.js         # neu
└── tests/
    ├── r00113-struktur.spec.js        # neu: Routenprobe, Mutanten, US-1..US-11
    ├── r00065-mehrfachauswahl.spec.js # aria-selected → .gewaehlt und Name
    └── kultur.spec.js                 # Snapshots mit listitem
```

## Technische Überlegungen

Nach ADR-0018 (Akzeptiert). Baustein A00009 (Oberfläche) und Aspekt X00005 tragen das Soll.

### Ablauf

`render()` → `vHaupt()` setzt `h1` aus dem Seitennamen → Sicht zeichnet → `vLane`/`vLaneZu` setzen die `h2` und `aria-expanded` → `vKarte`/`vDefekt`/`vFehlt` rufen `kartenName` → `vNavigation`/`vSeitenPop` setzen `aria-current` neben `an`. Ein Live-Ereignis läuft über `laden()` → `uebernehmen()` → `render()` und erneuert damit alles.

### Grobentwurf

- `seitenUeberschrift(S)` als reine Funktion neben `seitenName()`. Der Berichtsname kommt aus derselben Liste wie das Menü Berichte, nicht aus einer zweiten.
- `kartenName({ nummer, titel, klasse }, klassen, gewaehlt)` liefert Klartext. `esc()` wendet der Renderer beim Einsetzen ins Attribut an.
- Die Probe liest die Verzweigungen von `vHaupt()` aus dem Quelltext (`return v…()`), wie `FENSTER_IM_MARKUP` in `r00111-schmal-wie-breit.spec.js` die Fenster abgleicht.
- Mutanten über `page.route` auf `**/ansicht.js` bzw. auf den Quelltext für M2. Die Prüffunktion gibt Verstöße als Liste zurück.

### Gestaltung

Nichts wird neu sichtbar:
- `h1` und Spalten-`h2` sind `.vh`.
- Berichte, Einrichten und „ZIEHEN AUF“ wechseln nur den Tag. Die Gestaltung wird auf die Klasse gezogen und über NFA 1 als unverändert geprüft.
- Kein Artboard nach PO Z. 153. Bildschirmfotos vorher/nachher stehen auf dem Abnahmezettel (Offene Fragen 1).

### Umfang

I0102: 5 Features, 14 Bubbles, 10,5–17 h, ungemessen (Hypothese).
- Herleitung: Summe der Bubble-Spannen:
  - F0068: 2,5–4,5 h (B0483 1-1,5, B0484 1-2, B0485 0,5-1);
  - F0069: 3–4,5 h (B0486 1-1,5, B0487 0,5-1, B0488 0,5, B0489 1-1,5);
  - F0070: 3–5 h (B0490 1-1,5, B0491 1-1,5, B0492 1-2);
  - F0071: 1–2 h (B0493 0,5-1, B0494 0,5-1);
  - F0072: 1 h (B0495 0,5, B0496 0,5).
- Gezählte Eingänge (Stand `362284a`, `web/ansicht.js`, `web/app.js`):
  - 15 Verzweigungen in `vHaupt()`; 13 Routen in `ansichtenDerAnwendung` plus 3 Zustände;
  - 9 × `h3.dtitel`, 8 × `h3` in Einrichten und Einrichtungsmodus, 1 × `h4` in `vZiele`;
  - 3 Kartenrenderer, 3 Stellen mit `an` in der Navigation (`vNavigation`, `vWbsMenue`, `vSeitenPop`), 2 Klapp-Knöpfe;
  - 2 CSS-Regelgruppen an Tags, die wechseln (`.einr h3` `web/kd-app.css:395–397`, `.ziele h4` `:691`);
  - 1 bestehender Test mit `aria-selected` an der Karte.

### Vorplanung (Bubbles in `Dokumentation/Planung/kanbanD.md`)

| Bubble | Feature | Inhalt | Aufwand | Braucht |
|---|---|---|---|---|
| B0483 | F0068 | Akzeptanztest Routenprobe Seitenüberschrift und Landmarks | 1-1,5 | — |
| B0484 | F0068 | Seitenüberschrift aus vHaupt | 1-2 | B0483 |
| B0485 | F0068 | Mutante der Routenprobe (M1, M2) | 0,5-1 | B0484 |
| B0486 | F0069 | Akzeptanztest Abschnitte zweiter Ebene und gleiche Gestaltung | 1-1,5 | B0483 |
| B0487 | F0069 | Spaltenname als verborgene Überschrift | 0,5-1 | B0486 |
| B0488 | F0069 | Berichtsabschnitte als zweite Ebene | 0,5 | B0486 |
| B0489 | F0069 | Einrichten und Aufgabenliste ohne Sprung | 1-1,5 | B0486 |
| B0490 | F0070 | Kartenname als reine Funktion | 1-1,5 | — |
| B0491 | F0070 | Akzeptanztest Karte als Listeneintrag | 1-1,5 | B0483 |
| B0492 | F0070 | Rollen und Namen beim Zeichnen (M3) | 1-2 | B0490, B0491 |
| B0493 | F0071 | Akzeptanztest aktuelle Seite breit und schmal | 0,5-1 | B0483 |
| B0494 | F0071 | aria-current wie die Klasse an (M4) | 0,5-1 | B0493 |
| B0495 | F0072 | Akzeptanztest Klappzustand | 0,5 | B0483 |
| B0496 | F0072 | aria-expanded im Markup der Spalte | 0,5 | B0495 |

Die Bubbles sind Vorgabe für den Bau, keine Vereinbarung. Geprüft wird gegen die Akzeptanzkriterien und die User Story. Nach B0483 sind F0069–F0072 parallel baubar, B0490 schon vorher.

## Tests

Nach Skill `test-pyramide`. Jede US-Szene wird ein Test, und jeder Test prüft eine beobachtbare Eigenschaft der gezeichneten Seite oder eine Änderung nach einer Aktion (Skill `test-ehrlichkeit`).

- **Unit (node --test)**: `e2e/einheit/kartenname.test.js` mit und ohne Klasse, Auswahl, defekt, fehlt, Sonderzeichen (`&`, `<`), unbekanntem Klassenschlüssel (kein Zusatz) und Titel mit Datum im Text (bleibt, wie er ist; der Name fügt keines hinzu). Optional `seitenUeberschrift` je Verzweigung.
- **E2E (Playwright)**: neu `e2e/tests/r00113-struktur.spec.js` mit US-1 bis US-11, Routenliste aus `ansichtenDerAnwendung` plus drei Zuständen und Abgleich gegen `vHaupt()`. Die Prüfung läuft über `getByRole` und `ariaSnapshot`, nicht über Klassen, außer wo die Anforderung eine Klasse nennt.
- **Mutanten**: M1–M4 als eigene Tests, die die Prüffunktion gegen veränderten Code laufen lassen und rot erwarten (Lehre „Abnahme-Probe positiv und negativ“).
- **Rot vor dem Bau**: Jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #13. Ausnahme: der Landmark-Teil von US-1 ist heute schon grün (Schutz, so im Test vermerkt).
- **Gestaltung**: Die Werte aus NFA 1 werden vor dem Bau gegen `main` gemessen und als Konstante mit Herkunft (Commit, Datum) in den Test geschrieben.
- **Mitlaufend grün**: `r00065`, `r00074`, `r00054`, `r00058`, `kultur`, `ziele`, `kontrast`, `r00111-schmal-wie-breit`, die Tests zu ADR-0010.

## Abhängigkeiten

- ADR-0018 (Akzeptiert); ADR-0007 (Neuzeichnen, Sicherer), ADR-0010 (Tastatur, Fokus), ADR-0012 (Probe über alle Ansichten), ADR-0013 (zugänglicher Name ist sichtbarer Text), ADR-0014 (nur die neueste Antwort), ADR-0015 (Breite).
- Abhängig von (Code auf main): I0062 Spalten zuklappen (R00074), I0098 Datumsangaben und Feldbeschriftungen deutsch (R00109, `kultur.spec.js`).
- Blockiert: keine Interaction.

## Offene Fragen

1. **Gestaltung vor dem Bau**: offen, an den product-owner. Nach PO Z. 153 braucht nur das ein Artboard, was neu zu sehen ist. Hier wird nichts neu sichtbar: `h1` und Spalten-`h2` sind verborgen, die übrigen Überschriften wechseln nur den Tag bei gleicher Gestaltung. NFA 1 prüft das mit gemessenen Werten. Empfehlung: kein Artboard, kein Warten. Als Auflage stehen Bildschirmfotos von Board, Bericht Burndown, Einrichten und Aufgabenliste bei 1280 und 414 px vor und nach dem Bau auf dem Abnahmezettel. Der product-owner entscheidet und trägt eine Zeile ins Protokoll ein. Bis dahin sind alle Bubbles frei baubar, weil keine an einer Gestaltung hängt.
2. **Lesemodus eines Screenreaders**: geschlossen, ADR-0018 Option A, als Grenze in NFA 5.
3. **Datum im Namen**: geschlossen, keine Frage. Der Name nennt kein Datum (ADR-0018 Regel 3). PO Z. 146 verlangt das Jahr im zugänglichen Namen des Datums selbst („fällig 28.10.2026“), und das bleibt im Inhalt der Karte (FA 8, AK 10).

## Manuelle Vorbereitungstätigkeiten
Keine.

## Manuelle Nachbereitungstätigkeiten
Bildschirmfotos vorher/nachher auf dem Abnahmezettel (Offene Fragen 1).

## Warum löst diese Anforderung das Problem? (Pflicht)

Hilfstechnik findet sich über Rollen, Namen, Überschriften und Zustände zurecht, nicht über Farbe und Lage.

Das Board hat heute davon nichts. Die Karte ist ein fokussierbares `div` ohne Rolle, also ein Ziel, das nichts über sich sagt. Die Spalten sind nur Flächen. Die aktuelle Seite und der Klappzustand stehen nur in Klassen, die man sehen muss.

Die Anforderung gibt jedem dieser Dinge die Bedeutung, nach der ein Screenreader fragt:
- die `h1` als Einstieg;
- die `h2` als Sprungmarken;
- die Liste mit ihrer Anzahl;
- den Namen der Karte so, wie man sie nennt;
- `aria-current` und `aria-expanded` als hörbaren Zustand.

Dass es so bleibt, hat zwei Gründe:
- Die Struktur entsteht an den Stellen, die heute schon jede Sicht, jede Karte und jede Navigation zeichnen, ohne eigenen Zustand und ohne zweiten Schreibweg. Der Name kann deshalb nicht veralten.
- Die Probe über alle Routen ist gegen `vHaupt()` abgeglichen und gegen Mutanten geprüft. Eine neue Sicht, die etwas vergisst, macht sie rot.

## Missing-Docs
- Glossar: kein Eintrag für „Karte“, „Spalte“, „Klasse“ (mit Bezeichnung und Schlüssel) und „Route“. Die Begriffe stehen nur in ADRs und Anforderungen.
- A00009 und X00005 beschreiben ADR-0018 als Soll. Nach dem Bau trägt der Entwickler die Systemantwort nach, einschließlich Einrichten und „ZIEHEN AUF“ (FA 4), die die Ist-Liste von ADR-0018 nicht nennt.

## Notizen
- **Abnahme der Karte #13**: Die Abnahme-Probe steht wörtlich in AK 1, mit der Präzisierung des architekten für schmale Breiten und die Zustände ohne Navigation.
- **Optionen (ADR-0018)**:
  - A, gewählt: Karte als `listitem` in einer `list`. Die Kinder behalten ihre Rollen, Tastatur und Ziehen bleiben unberührt. Preis ist der Lesemodus (NFA 5).
  - B, verworfen: `listbox`/`option`. Die Kinder würden bloßer Text, Signal-Knopf und Herkunfts-Link müssten ins Menü (Umbau an R00076 und R00018).
  - C, verworfen: Karte als `button`. Dieselbe Schachtelungsfrage wie B, und ein Knopf, der gezogen und mit Pfeilen bewegt wird, widerspricht der Konvention.
  - D, verworfen: `grid`. Ein Board hat keine fachlichen Zeilen, und das wäre der größte Umbau am Markup.
  - Name: 2a (abgeleitet beim Zeichnen) statt `aria-labelledby` (2b) oder Nachführen beim Ereignis (2c).
  - Ort der `h1`: 3a (`vHaupt()`) statt je Sicht (3b) oder fester Knoten (3c).
- **Entscheidungen des planers**:
  - Elterndialog D0002: Karte, Spalten und Klapp-Knopf liegen auf dem Board. `h1` und `aria-current` gelten quer über alle Routen, wie bei I0096.
  - Einrichten, Einrichtungsmodus und „ZIEHEN AUF“ sind aufgenommen, weil ADR-0018 Regel 2 „innerhalb von `#main` werden keine Ebenen übersprungen“ verlangt. Die Ist-Liste der ADR nennt diese Stellen nicht. Gezählt beim Lesen von `web/ansicht.js`.
  - Die Ebenenfolge (AK 5) ist zusätzlich in die Probe aufgenommen. Die Durchsetzung der ADR nennt sie nicht, Regel 2 verlangt sie aber, und ohne Probe fällt die nächste Sicht wieder darauf herein.
  - Vertikal geschnitten, je Zusage der Karte ein Slice. F0068 ist der Walking Slice, weil er die Routenprobe bringt, die die anderen erweitern.
  - Die Mutanten M3 und M4 liegen in den Bubbles, die das Geprüfte bauen (B0492, B0494). Vorher wären sie trivial grün.
