---
id: R00223
status: Erledigt
datum: 2026-11-21
---

# R00223: Phasen werden gewöhnliche Spalten

## Beschreibung

Karte #227, Scheibe **S3** des Rückbaus der WBS (Auftrag des Betreibers 2026-11-20). Technik nach [ADR-0034](../Dokumentation/ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) Regel 2 und 3, Nachtrag N4 Regel 1–5 (Variante A für die gespeicherte Wahl); Produktentscheidungen po-entscheidungen Z. 432 (Altbestände), Z. 499 (Phasen zwischen S2 und S3), Z. 501 (Datenpflege JoinPuya), Z. 502 (Tooltips der Bindung), Z. 503 (Bau ohne Nachzeichnung), Z. 504 (Wortlaute an Spaltenkopf, Wie lange noch und Fever Chart). Inventur des architekt: Lauf 227-architekt-1.

kanbanD kennt keine Phasen mehr. Ein Board hat Spalten, und die Berichte rechnen je Spalte. Es entfallen:

- das **Lesen der Phasen-Datei** neben der WBS (`src/dienst/phasen.rs:57–58`, der letzte Dateizugriff im Arbeits-Repository) und `src/phasen.rs` ganz;
- das **Nachtragen von Phasen-Spalten** beim Lesen eines Boards mit eigenem Commit („Phasen-Spalten von „<Board>“ ergänzt: …“, Person `kanbanD`);
- `phasen` in `GET /api/boards/{slug}` und in `GET /api/berichte/bewegungen`, `uebersprungen` je Aufgabe in `bewegungen`, das Feld `phase` je Spalte;
- `phasen` in `PATCH /api/aufgaben/{nr}` und im Aufgabenmodell (`phases` wird ein unbekannter Schlüssel der Aufgabe);
- `column-phases` im Board-Modell: überlesen, beim nächsten Schreiben des Boards weg;
- in den Berichten jeder Zweig „mit Phasen“ (Burndown, Durchsatz, Kumulativer Fluss, Durchlaufzeit, Wie lange noch, Fever Chart);
- in der Oberfläche das Feld „Phasen“ im Aufgabenfenster, die Leiste `#phasen-hinweis` am Board, der Phasenname am Spaltenkopf, der Phasen-Wortlaut in „Wie lange noch“ und im Fever Chart, der Phasen-Teil der Tooltips unter „GEBUNDEN AN“;
- `Warnung.knoten` und `Warnung.details` (Restposten aus S2, N4 Regel 1).

Was bleibt: die Spalten selbst mit Namen, Grenzen, Eigentümern, Notizen und Farben; die Bindung `applications` ohne eigene Wirkung (ADR-0034 Regel 4); das Textfeld `phase` der Durchläufe (`kanbanD-runs`, R00094); der Lese-Rückfall `wbs`/`requirements` des Registers, aber nur als Startordner der Wurzel für `kd:<hash>` (N4 Regel 4); `fieberSchluessel` unverändert (N4 Variante A); die Leiste `#pruefungen-hinweis` für unbekannte Eigentümer.

**Abnahme-Probe der Karte (Auftrag des Directors, wörtlich):** „Ein Board mit `column-phases` liefert kein `phasen` und erzeugt keinen Auto-Commit. Die Berichte (Burndown, Fieber, Wie lange noch) sind gleich denen desselben Boards ohne `column-phases`.“ Sie steckt in AK 1.

Ändert [R00058](R00058-phasen-als-spalten.md) (Phasen als Spalten), [R00062](R00062-leere-anwendungsliste-loest-die-bindung.md) (Tooltips der Bindung) und die Phasenzweige von [R00046](R00046-wie-lange-noch.md), [R00078](R00078-projekt-fever-chart.md), [R00166](R00166-erledigt-heisst-je-board-fuer-burndown-durchsatz-und-fever-chart.md), [R00167](R00167-durchsatz-von-spalte-waehlbar-zugang-als-zweiter-balken.md), [R00169](R00169-kumulativer-fluss-und-durchlaufzeit-folgen-der-zielspalte.md). Sie bleiben unverändert als Historie stehen.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Aufgaben sind der Stand“ („Spalten sind Spalten“; kanbanD liest, schreibt und zeigt die WBS nicht), Nicht-Ziel „Kein Ersatz für Vision, Anforderungen und WBS“.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — verliert das Feld „Phasen“.
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) — die Leiste „Phasen“ am Board entfällt, die Leiste zu unbekannten Eigentümern bleibt.

## Geschäftlicher Nutzen

Nach S2 ist die Phasen-Datei der einzige Grund, warum kanbanD noch eine Datei im Arbeits-Repository öffnet, und das Nachtragen der Phasen-Spalten der einzige Grund, warum ein bloßes Ansehen eines Boards einen Commit erzeugt. Beides fällt hier weg. Danach öffnet kanbanD im Arbeits-Repository keine Datei mehr, ein `GET` schreibt nie, und die Berichte haben eine einzige Rechenart statt zwei. In der Inventur entfallen `src/phasen.rs` (260 Zeilen, 12 Tests), `src/dienst/phasen.rs` (69 Zeilen), `tests/phasen.rs` (192 Zeilen, 13 Tests), `r00058-phasen-spalten.spec.js` (5 Tests) und die Phasenfälle in `berichte.test.js` (57 Treffer); gezählt am Stand `266ce20d`, Inventur arch-227 §1, §3.

## Funktionale Anforderungen

- `GET /api/boards/{slug}` liest nur: kein Commit, kein Nachtragen von Spalten, kein Schlüssel `phasen`, je Spalte kein `phase`; `hinweise` (unbekannte Eigentümer) bleibt.
- Kein `GET` der API erzeugt einen Commit.
- `GET /api/berichte/bewegungen` liefert keinen Schlüssel `phasen` und je Aufgabe kein `uebersprungen`.
- kanbanD öffnet keine Datei im Arbeits-Repository: weder WBS noch Phasen-Datei, auch nicht zur Prüfung, ob sie existiert (`is_file`).
- `column-phases` an einem Board wird überlesen. Die Zeilen bleiben in der Datei, bis eine Aktion das Board ohnehin schreibt (Bewegen, Spalten einrichten, Bindung setzen …), und fehlen im Commit dieser Aktion (ADR-0034 Regel 2, PO Z. 432, N4 Regel 3). Es gibt keinen eigenen Commit dafür.
- `phases` an einer Aufgabe ist ein unbekannter Schlüssel: die Aufgabe öffnet ohne Fehler und ohne Warnung, auch in einer Form, die heute als defekt gilt (`phases: [Abnahme]`). Beim Schreiben der Aufgabe bleibt der Schlüssel inhaltlich erhalten (ADR-0028 Option B), beim ersten Schreiben in Blockform. Die API zeigt ihn nicht.
- Ein mitgeschicktes `phasen` in `PATCH /api/aufgaben/{nr}` wird überlesen: 200, keine Änderung, kein Commit, wenn sonst nichts geändert wird (N4 Regel 2, wie `PUT` mit `wbs` in N2).
- Warnungen in Antworten haben nur noch `pruefung` und `text`; `knoten` und `details` entfallen in Antwort und OpenAPI-Schema (N4 Regel 1).
- Die Berichte rechnen nur noch je Spalte: Ein Block heißt „Spalte X erreicht“ (X oder rechts davon). Für ein Board mit `column-phases` ergeben Burndown, Durchsatz, Kumulativer Fluss, Durchlaufzeit, Wie lange noch und Fever Chart dasselbe wie für dasselbe Board ohne `column-phases`.
- Eine gespeicherte Wahl („Erledigt heißt“ `fever.target-column`, Von-Spalte `from-column`), die eine Spalte nennt, gilt als diese Spalte, auch wenn eine Phase gleich hieß. Eine Wahl, die keine Spalte nennt, gilt als Vorgabe (ADR-0027 N5 Punkt 5). kanbanD übersetzt keine gespeicherte Wahl (N4 Variante A).
- `fieberSchluessel` bleibt unverändert: derselbe Start, derselbe Filter und dieselbe Wahl ergeben denselben Schlüssel wie am Stand `266ce20d`. Die gespeicherten Tage im Fieber-Cache eines Boards ohne Wahl bleiben gültig.
- Durchläufe bleiben unverändert: `POST /api/aufgaben/{nr}/durchlaeufe` mit `phase` (1–40 Zeichen), der Block `kanbanD-runs` und die Tabelle „DURCHLÄUFE“ im Aufgabenfenster.
- Tooltips der Bindung (PO Z. 502, wörtlich): „Der Tooltip eines Schalters unter „GEBUNDEN AN“ lautet „„<Name>“ (<Kürzel>)“, der des Schalters „keine“ lautet „applications: []“. Die Wörter „Phasen-Spalten aus“, „reines Kanban:“ und „— keine Phasen; vorhandene Spalten bleiben“ entfallen; kein neuer Satz.“ Die Beschreibung von `PUT /api/boards/{slug}/anwendungen` in Endpunktliste und OpenAPI verliert „reines Kanban, keine Phasen, nachgetragene Spalten bleiben“ ebenso.
- Aufgabenfenster ohne Feld „Phasen“ (`#phasen-entfallen`, Beschriftung `phases`, Aktion `phase-entfaellt`); Board ohne Leiste `#phasen-hinweis` und ohne Phasennamen am Spaltenkopf; „Wie lange noch“ und Fever Chart ohne die Wörter „durchlaufen“, „DURCHLAUFEN“, „bzw. ihre Phase durchlaufen“, „bzw. die letzte Phase“, ohne den Methodik-Punkt zur Phasenfolge und ohne „Vorphase“ im Tabellenkopf. Was dort stehen bleibt, legt PO Z. 504 (a)–(d) fest (wörtlich unter „Nicht-funktionale Anforderungen“, „Gestaltung, Wortlaute“): Spaltenkopf mit Name, Zeichen, Grenze und Anzahl; Tabellenkopf „Nicht vor (Spalte links)“; Methodik von Wie lange noch mit dem Spalten-Punkt; erster Methodik-Punkt des Fever Charts im Wortlaut (d).
- README: der Absatz „Phasen als Spalten“ entfällt, `bewegungen` wird ohne Phasen beschrieben.
- Durchsetzung (ADR-0034 N4 Regel 5, präzisiert in „Technische Überlegungen“): nach der Karte nennt `src` und `web` das Wort „Phase“ nur noch für Durchläufe, im Wort „Speicherphase“ und in Kommentaren mit Verweis auf ADR-0034.

## Nicht-funktionale Anforderungen

- Sicherheit: kanbanD öffnet im Arbeits-Repository keine Datei mehr. Dort startet es nur noch das gehärtete, lesende Git für Commit-Verweise (A00011).
- Verträglichkeit (ADR-0034 Q3): Factory und Gebundener Modus lesen weder `phasen` noch `spaltenphasen`, `uebersprungen`, `knoten` oder `details` (Inventur §6). Die Factory läuft gegen dieses Programm unverändert (`tests.test_auftrag`).
- Gestaltung (PO Z. 503, wörtlich): „Gestaltung: nur Wegfall (Feld „Phasen“ im Aufgabenfenster, Leiste `#phasen-hinweis` am Board, Wort „durchlaufen“ und „bzw. ihre Phase durchlaufen“ in „Wie lange noch“), kein neues Element und kein geändertes Aussehen eines verbleibenden Elements, die Leiste `#pruefungen-hinweis` bleibt wie sie ist; keine Zeichnung vor dem Bau. Der gestalter zieht nach dem Bau D0001, D0002 und D0003 nach.“ Bedingung (PO Z. 503): kein Querscrollen bei 375, 641, 768 und 980 px, Farben unverändert in Hell und Dunkel (AK 13).
- Gestaltung, Wortlaute (PO Z. 504, wörtlich): „Gestaltung: nur Wegfall, auch (a) der Phasenname am Spaltenkopf (`.v.ph`, Tooltip `ph:`); der Spaltenkopf zeigt sonst unverändert Name, Zeichen, Grenze und Anzahl; (b) im Tabellenkopf von „Wie lange noch“ heißt die letzte Spalte immer „Nicht vor (Spalte links)“; (c) die Methodik von „Wie lange noch“ nennt immer den Punkt „Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt; es zählt das erste Erreichen. Je Spalte (außer der ersten) eine Kurve „noch nicht erreicht“.“, der Punkt zur Phasenfolge entfällt; (d) der erste Punkt der Methodik des Fever Charts lautet: „Fortschritt: Anteil der Aufgaben, die die Zielspalte erreicht haben — ohne Wahl die Abschlussspalte („Erledigt heißt“) —, am Umfang des Tages. Prognose und Durchsatz gehören zu demselben Block wie in „Wie lange noch“. Neue Aufgaben senken ihn — der Punkt springt nach links.“ Kein neuer Satz, keine Zeichnung vor dem Bau; der gestalter zieht D0001–D0003 nach dem Bau nach (wie Z. 503).“
- Altbestand (PO Z. 432, N1 Punkt 3): ein Altbestand öffnet ohne Fehler und ohne Warnung; kein Commit beim Start, keiner beim Lesen.

## Akzeptanzkriterien

Ausgangslage (herstellbar mit Git und der API; Daten der Commits über `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`):

- Arbeits-Repository `R` mit WBS `R/Dokumentation/Planung/kd.md`, Phasen-Datei `R/Dokumentation/Planung/kd-phasen.md` (Tabelle `## Phasen`: 1 Entwicklung, 2 Reviews, 3 Abnahme) und einem Commit `C1`.
- kanbanD-Ordner `K` mit Register `kd: {name: KD, repository: R, wbs: R/Dokumentation/Planung/kd.md}`, beide Schlüssel als Text in der Datei. Am Stand vor der Karte liefert dieses Register Phasen.
- Board `entwicklung` mit `applications: [kd]`, den Spalten Offen, Entwicklung, Nacharbeit, Reviews, Erledigt, WIP-Grenze 1 an „Nacharbeit“ und `column-phases: {Entwicklung: Entwicklung, Reviews: Reviews}`. Die Phase „Abnahme“ hat keine Spalte.
- Aufgaben: #1 Offen → Entwicklung (2026-11-02) → Reviews (2026-11-03) → Erledigt (2026-11-05), mit `commits: [kd:<C1>]`; #2 Offen → Entwicklung (2026-11-02) → Nacharbeit (2026-11-04); #3 Offen → Entwicklung (2026-11-03) → Reviews (2026-11-04), mit `phases: {skipped: [Reviews]}`; #4 in Offen.
- Zwilling `K'`: gleich erzeugt, aber ohne Zeile `column-phases` (und ohne `phases` an #3).

Vor jedem AK sind `git rev-list --count HEAD` von `K` und `R` und SHA-256 der Board-Datei und der Phasen-Datei notiert.

### Board und Berichte ohne Phasen

- [x] **AK 1** (Abnahme-Probe der Karte) Gegeben `K` und `K'`. Wenn auf beiden `GET /api/boards/entwicklung` und `GET /api/berichte/bewegungen?board=entwicklung` gelesen und daraus Burndown, Fever Chart (`fieberTag` ohne Wahl für 2026-11-03, 2026-11-04 und 2026-11-05) und Wie lange noch gerechnet werden, dann:
  - hat die Board-Antwort von `K` keinen Schlüssel `phasen`, keine Spalte trägt `phase`, die Spalten sind genau die fünf aus der Ausgangslage, und `K` hat keinen neuen Commit;
  - sind die `bewegungen` beider Ordner gleich (bis auf `jetzt`), ohne Schlüssel `phasen` und ohne `uebersprungen`;
  - sind Burndown, die drei Fieber-Tage und die Blöcke von Wie lange noch in `K` und `K'` gleich, mit demselben Zufallsstartwert. Rechenbeispiel: Block „Reviews“ = 2 von 4 erreicht (#1 in Erledigt, #3 in Reviews), Block „Erledigt“ = 1 von 4 (#1);
  - zeigen die drei Berichte in der Oberfläche auf `K` denselben Text wie auf `K'`.
  
  Heute: das Lesen von `K` erzeugt den Commit „Phasen-Spalten von „entwicklung“ ergänzt: Abnahme“, die Antwort trägt `phasen`, und Wie lange noch rechnet nach ADR-0034 N4 „Reviews durchlaufen“ mit 1 von 3 (#3 fällt durch `phases.skipped` aus dem Nenner); die genaue Zahl hält B1159 fest.
- [x] **AK 2** Gegeben `K`. Wenn nacheinander `GET /api/boards`, `GET /api/boards/entwicklung` (zweimal), `GET /api/aufgaben`, `GET /api/aufgaben/3`, `GET /api/berichte/bewegungen?board=entwicklung`, `GET /api/einstellungen`, `GET /api/anwendungen` und `GET /api/aufgaben/1/commits` gelesen werden, dann hat `K` danach so viele Commits wie vorher, und die Board-Datei ist bytegleich, `column-phases` steht also noch darin. Wird danach #2 von „Nacharbeit“ nach „Reviews“ bewegt, dann entsteht genau ein Commit, er enthält nur `boards/entwicklung.md` und die Aufgabendatei, und `git show HEAD:boards/entwicklung.md` enthält `column-phases` nicht mehr. Dasselbe gilt für `PUT /api/boards/entwicklung/anwendungen` mit `[]`: ein Commit, darin fehlt `column-phases`. Der Test `tests/akzeptanz_r00222.rs:468` („Phasen bleiben bis S3“) kehrt sich dabei um: `column-phases` fehlt im Commit der Bewegung.
- [x] **AK 3** Gegeben `K` und der Ordner `R/Dokumentation/Planung` mit `chmod 000`. Wenn kanbanD startet, das Board gelesen, eine Aufgabe #5 angelegt und durch alle fünf Spalten bewegt, jeder Bericht des Boards geladen, die Commit-Liste von #1 gelesen und die Einstellungen mit `GET` gelesen und unverändert mit `PUT` geschrieben werden, dann antwortet keine Anfrage mit 4xx oder 5xx, im Log steht keine Fehler- oder Warnzeile, die Zahl der Commits in `R` und SHA-256 der Phasen-Datei sind gleich wie vorher, und `zustand` von `kd:<C1>` ist derselbe wie mit lesbarem Ordner. Dieselbe Folge mit lesbarem Ordner liefert dieselben Antworten (bis auf Zeitstempel und Nummern). Heute: mit lesbarem Ordner liefert das Board `phasen`, mit unlesbarem nicht, die Antworten unterscheiden sich.

### Aufgabe und API

- [x] **AK 4** Gegeben `K`. Wenn #3 per `GET /api/aufgaben/3` gelesen wird, dann hat die Antwort keinen Schlüssel `phasen`. Wenn ein Agent `PATCH /api/aufgaben/3 {phasen: {uebersprungen: []}}` schickt, dann ist die Antwort 200, es entsteht kein Commit, und die Aufgabendatei ist bytegleich. Wenn er `PATCH /api/aufgaben/3 {titel: "Export prüfen", phasen: {uebersprungen: []}}` schickt, dann entsteht genau ein Commit, der Titel ist geändert, und `phases` steht als YAML gelesen gleich in der Datei (`skipped: [Reviews]`). Ein zweites `PATCH titel` ändert an `phases` kein Byte. Heute: das erste `PATCH` erzeugt einen Commit, der `phases` leert.
- [x] **AK 5** Gegeben drei Aufgaben in `K`, per Git angelegt: #6 mit `phases: [Abnahme]`, #7 mit `phases: {skipped: Abnahme, reason: kein Kunde, owners: [mi]}` und #8 mit `phases:` ohne Wert. Wenn kanbanD startet und `GET /api/aufgaben` liest, dann liefert es 200 mit allen drei Aufgaben und ohne defekte Datei, im Log steht keine Warnung, und nach `PATCH titel` an jeder der drei steht `phases` als YAML gelesen gleich in der Datei; Blockform statt Flussform ist erlaubt. Heute: #6 ist eine defekte Datei („phases ist keine Zuordnung“).
- [x] **AK 6** Gegeben `K` mit einer Aufgabe in „Nacharbeit“ (#2). Wenn der Betreiber #4 nach „Nacharbeit“ bewegt, dann trägt die Antwort genau eine Warnung, und sie hat genau die Schlüssel `pruefung` (`grenze`) und `text`, ohne `knoten` und ohne `details`. Das OpenAPI-Schema `Warnung` hat genau diese zwei Eigenschaften. Heute: `knoten: []` und `details: []` stehen in der Antwort.
- [x] **AK 7** Gegeben das Programm nach der Karte. Wenn `GET /api/endpunkte` und `GET /api/openapi.json` gelesen werden, dann enthalten sie keines der Schemas `Phasenstand`, `Phasenkarte`, `Phasenfolge` oder `BoardMitPhasen`, keine Eigenschaft `phasen`, `phase` (an Spalten) oder `uebersprungen`, und die Beschreibung von `PATCH /api/aufgaben/{nr}` nennt kein `phasen?`. Die Beschreibung von `POST /api/aufgaben/{nr}/durchlaeufe` nennt `phase (1–40 Zeichen)` weiter.
- [x] **AK 8** (Gegenprobe Durchläufe) Gegeben `K`. Wenn ein Agent `POST /api/aufgaben/1/durchlaeufe {phase: "Entwicklertest", ergebnis: "bestanden"}` schickt, dann entsteht wie vor der Karte genau ein Commit mit der Zeile im Block `kanbanD-runs`. Das Aufgabenfenster von #1 zeigt in „DURCHLÄUFE“ eine Zeile mit „Entwicklertest“ und „bestanden“. Eine `phase` mit 41 Zeichen wird mit 400 abgewiesen, wie vor der Karte.

### Gespeicherte Wahl und Fieber-Cache

- [x] **AK 9** Gegeben `K` mit `fever: {target-column: Reviews}` am Board. Wenn der Fever Chart gerechnet wird, dann zählt #3 in „Reviews“ als erledigt: erledigt 2 von 4 (#1, #3). Mit der Wahl „Abnahme“, die keine Spalte nennt, gilt die Vorgabe (Abschlussspalte, 1 von 4). `fieberSchluessel` ergibt für Start `2026-11-01`, den leeren Filter und keine Wahl genau die Zeichenfolge, die er am Stand `266ce20d` ergab, mit Wahl „Reviews“ ebenso. Probe: Node-Test mit den zwei Zeichenfolgen als Literal, am Stand `266ce20d` erzeugt.

### Oberfläche

- [x] **AK 10** Gegeben `K` und zusätzlich ein Board `zuordnung` mit den Spalten Offen, Bereit, Live, `applications: [kd]` und `column-phases: {Bereit: Abnahme, Live: Abnahme}` (zwei Spalten, eine Phase, wie JoinPuya), dazu `column-owner: {Offen: chef}`. Wenn der Betreiber beide Boards öffnet und #3 im Aufgabenfenster im Reiter „Details“ öffnet, dann:
  - hat der Reiter „Details“ keine Zeile „Phasen“, kein Element `#phasen-entfallen` und keine Beschriftung `phases`. Die Probe öffnet ausdrücklich den Reiter „Details“, denn nur dort stand das Feld; in der Standardansicht „Inhalt“ wäre sie auch am Stand vor der Karte grün;
  - hat keines der Boards ein Element `#phasen-hinweis`, und kein Spaltenkopf zeigt einen Phasennamen (auf `zuordnung` weder „Abnahme“ an „Bereit“ noch an „Live“), geprüft am sichtbaren Text jedes Spaltenkopfs, nicht nur am Fehlen von `.v.ph`;
  - zeigt `zuordnung` die Leiste `#pruefungen-hinweis` mit dem Hinweis zum Eigentümer „chef“ wie vor der Karte, mit gleichen berechneten Farben;
  - geht beim Öffnen keine Anfrage hinaus, die einen Commit erzeugt.
  
  Heute (Probe rot): im Reiter „Details“ steht die Zeile „Phasen“ mit Schaltern „… entfällt“; nach der Karte fehlt sie (grün). Dazu Leiste „Phasen“ mit dem Hinweis zur fehlenden Spalte „Abnahme“ (beim ersten Lesen nachgetragen), Phasenname „Abnahme“ an „Bereit“ und „Live“.
- [x] **AK 11** Gegeben `K` mit dem Register `kd` und einer zweiten Anwendung `ab: {name: Abrechnung, repository: R}`. Wenn der Betreiber „Spalten einrichten“ von `entwicklung` öffnet, dann lautet unter „GEBUNDEN AN“ der Tooltip (`title`) des Schalters „KD“ „„KD“ (kd)“, der von „Abrechnung“ „„Abrechnung“ (ab)“ und der des Schalters „keine“ „applications: []“. Kein Tooltip unter „GEBUNDEN AN“ enthält „Phasen“, „reines Kanban“ oder „Spalten bleiben“. Heute: „Phasen-Spalten aus „KD“ (kd)“ und „reines Kanban: applications: [] — keine Phasen; vorhandene Spalten bleiben“.
- [x] **AK 12** Gegeben `K`. Wenn der Betreiber „Wie lange noch“ und den Fever Chart von `entwicklung` öffnet, dann enthält der sichtbare Text beider Berichte samt Tabellenansicht und „Lesehinweise und Methodik“ weder „durchlaufen“ noch „DURCHLAUFEN“ noch „Vorphase“ noch „bzw. ihre Phase“ noch „bzw. die letzte Phase“. Jeder Block heißt „ERREICHT“ (etwa „2 VON 4 ERREICHT“ für „Reviews“), kein Block trägt `data-phase`, und die letzte Spalte jedes Tabellenkopfs heißt „Nicht vor (Spalte links)“ (PO Z. 504 (b)). Die Methodik von Wie lange noch nennt den Punkt „Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt; es zählt das erste Erreichen. Je Spalte (außer der ersten) eine Kurve „noch nicht erreicht“.“ wie heute auf einem Board ohne Bindung (PO Z. 504 (c)). Der erste Punkt der Methodik des Fever Charts lautet wörtlich „Fortschritt: Anteil der Aufgaben, die die Zielspalte erreicht haben — ohne Wahl die Abschlussspalte („Erledigt heißt“) —, am Umfang des Tages. Prognose und Durchsatz gehören zu demselben Block wie in „Wie lange noch“. Neue Aufgaben senken ihn — der Punkt springt nach links.“ (PO Z. 504 (d), erwarteter Wortlaut; der Test vergleicht den ganzen Punkt).
  - Sichttext-Probe: Wenn der Betreiber nacheinander das Board `entwicklung`, das Aufgabenfenster von #3 im Reiter „Details“, „Spalten einrichten“ von `entwicklung`, Wie lange noch und den Fever Chart öffnet, jeweils mit aufgeklappter Tabellenansicht und „Lesehinweise und Methodik“, dann trifft `/phase/i` den sichtbaren Text (`innerText`) keiner dieser Ansichten. Ausgenommen ist nur der Bereich `#durchlaeufe` im Aufgabenfenster; dort bleibt die Spalte „Phase“ der Durchläufe (R00094). Die Probe fängt Reste, die die Wortliste nicht nennt (etwa „gerechnet wird je Phase“, „Phasen-Spalten“).
  
  Heute: der Fever Chart sagt „… erreicht bzw. ihre Phase durchlaufen haben — ohne Wahl die Abschlussspalte bzw. die letzte Phase …“; die Sichttext-Probe trifft mindestens die Leiste „Phasen“ am Board, die Zeile „Phasen“ im Reiter „Details“ und die Methodik beider Berichte.
- [x] **AK 13** (Gestaltung, PO Z. 503) Gegeben `K` und `zuordnung` aus AK 10, das Aufgabenfenster von #3, Wie lange noch und Fever Chart, jeweils Hell und Dunkel. Für Wie lange noch zusätzlich ein Board `breit` mit sieben Spalten (Offen, Bereit, Entwicklung, Nacharbeit, Code-Review, Reviews, Erledigt), `applications: [kd]`, `column-phases: {Entwicklung: Entwicklung, Code-Review: Reviews, Reviews: Reviews}` und den Aufgaben #9–#14, je eine in jeder Spalte außer Offen, an je einem eigenen Tag zwischen 2026-11-02 und 2026-11-07 dorthin bewegt. Nach der Karte zeigt es sechs Spaltenblöcke statt heute zwei Phasenblöcke; diese Zunahme muss die Scroll-Probe tragen (mit `entwicklung` oder `zuordnung` allein bliebe sie unbelastet). Wenn sie bei 375, 641, 768 und 980 px gezeichnet werden, dann gilt an Dokument und Bildlaufbehältern `scrollWidth ≤ clientWidth`, für Wie lange noch auch auf `breit`. `color`, `background-color` und `border-color` der Leiste `#pruefungen-hinweis`, der Blöcke von Wie lange noch (Rand und Fläche je Anteil) und der Spaltenköpfe (Farben, nicht Breiten: der Kopf wird ohne Phasennamen bewusst schmaler) sind gleich den Werten, die am Stand vor der Karte gemessen wurden.

### Durchsetzung und Doku

- [x] **AK 14** Gegeben der Stand nach der Karte. Wenn `grep -rniE 'phasen|column-phases|spaltenphasen|uebersprungen' src web` läuft, dann trifft er nur Zeilen, die „ADR-0034“ enthalten. Wenn `rg -in 'phase' src web` läuft, dann gehört jeder Treffer zu einer der erlaubten Stellen in „Technische Überlegungen“, „Durchsetzung“. Wenn `rg -n '\.v\.ph\b|ph:' web` läuft, dann trifft er nichts (Kürzel des Phasennamens am Spaltenkopf, die die beiden ersten Proben nicht finden). Heute: der erste Befehl trifft 211 Zeilen, die Probe aus „Durchsetzung“ lässt 310 übrig (gezählt am 2026-11-21 an `266ce20d`), die Kürzel-Probe trifft 4 Zeilen (`web/kd-app.css:886`, `:887`, `web/kd-base.css:12`, `web/ansicht.js:1021`; gezählt am 2026-11-21 an `81528260`).
- [x] **AK 15** Gegeben die README nach der Karte. Wenn man sie nach `phase` durchsucht (ohne Groß-/Kleinschreibung), dann steht das Wort nur noch bei den Durchläufen. Der Absatz „Phasen als Spalten“ fehlt, und die Beschreibung von `GET /api/berichte/bewegungen` nennt kein `phasen`.

### Altbestand

- [x] **AK 16** Gegeben eine Kopie von `~/Projekte/Kanban-Boards/JoinPuyaApp-Kanbanboard` in der eigenen Ablage (Stand 2026-11-21: Board `joinpuya` mit `column-phases`, N:1 für `Bereit für Produktiv` und `Produktiv stellen` → `Produktiv`, `fever: {target-column: Entwicklung}`; 2 Aufgaben mit `phases: {skipped: [Code-Review, Security-Review]}`; Register `jopu` in Altform nur mit `wbs`/`requirements`). Wenn erst das Programm am Stand `266ce20d` und dann dieses darauf startet, dann:
  - entsteht beim Start und beim Lesen von Board, Aufgaben und Berichten kein Commit, `GET /api/aufgaben` liefert 200 ohne defekte Datei, im Log steht keine Fehler- oder Warnzeile;
  - ist `fieberTag` ohne Wahl an drei Tagen (2026-11-10, 2026-11-15, 2026-11-20) in beiden Läufen gleich (`erledigt`, `umfang`, `ende7`, `ende5`);
  - ändert die Datei `berichte/joinpuya-fieber.md` beim Öffnen des Fever Charts ohne Wahl ihren Schlüssel nicht (kein neuer Abschnitt, der bestehende bleibt gültig);
  - ist `zustand` jedes `jopu:<hash>` in beiden Läufen gleich;
  - stehen nach `PATCH titel` an einer Aufgabe mit `phases` deren Einträge inhaltlich gleich in der Datei, und nach einer Bewegung fehlt `column-phases` im Commit der Bewegung.

## Betroffene Verzeichnisstruktur

- Entfällt: `src/phasen.rs`, `src/dienst/phasen.rs` (der Antworttyp mit `board` und `hinweise` zieht um, Name frei).
- Ändert: `src/lib.rs`, `src/dienst/mod.rs`, `src/dienst/verlauf.rs`, `src/dienst/bindung.rs` (Kommentar), `src/dienst/aufgabe_anlegen.rs` (Kommentar), `src/verlauf.rs`, `src/warnung.rs`, `src/modell/board.rs`, `src/modell/aufgabe.rs`, `src/modell/mod.rs`, `src/format/board.rs`, `src/format/aufgabe.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs`; Test-Konstruktoren mit `phase: None` (Inventur §1).
- Bleibt: `src/modell/einstellungen.rs`, `src/format/einstellungen.rs` (Lese-Rückfall `wbs`/`requirements`, nur `startordner()`).
- Oberfläche: `web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/kultur.js`, `web/kd-app.css`.
- Doku: `README.md`.
- Tests: entfallen `tests/phasen.rs`, `e2e/tests/r00058-phasen-spalten.spec.js`, Phasenfälle in `e2e/einheit/berichte.test.js`; anpassen `tests/akzeptanz_r00222.rs`, `tests/bindung.rs`, `tests/aufgabe_duplizieren.rs`, `tests/aufruf_vergessen.rs`, `tests/nachricht_roh.rs`, Node `r00166`, `r00169-zielspalte-fluss`, `r00167`, `kontrast`, `r00152`, `r00169-durchlaufzeit-vorgabe`, `kultur`, e2e `r00166`, `r00169`, `r00119`, `r00167`, `r00113`, `r00222-ohne-wbs`, `kultur`, Hilfen `struktur-hilfen.js`, `wbs-hilfen.js` (Inventur §3); neu `tests/akzeptanz_r00223.rs`, `e2e/einheit/r00223-ohne-phasen.test.js`, `e2e/tests/r00223-ohne-phasen.spec.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1159 Abnahme-Proben rot, Vorher-Werte festhalten**: AK 1–7, 9–12 und 14 am Stand `266ce20d` rot (AK 8 ist heute grün und bleibt Wächter). Dazu die Farben und Breiten aus AK 13, die zwei Literale von `fieberSchluessel` aus AK 9 und die Fieber-Tage von JoinPuya aus AK 16 am heutigen Stand messen und als Erwartung festhalten.
2. **B1160 Board lesen ohne Phasen** (AK 1 Board-Teil, 2, 3): `src/phasen.rs` und `src/dienst/phasen.rs` entfallen; `Spalte.phase` und `column-phases` werden überlesen und nicht geschrieben.
3. **B1161 Aufgabe ohne `phases`** (AK 4, 5): `PHASEN` aus `BEKANNT`, `Phasenangaben` und `Phasenaenderung` entfallen; der Schlüssel läuft über `weitere`.
4. **B1162 Bewegungen und Warnung ohne Phasenreste** (AK 1 `bewegungen`, 6, 7): `Bewegungen.phasen`, `Phasenkarte`, `Bewegung.uebersprungen`, `Warnung.knoten`/`details` entfallen; Endpunktliste und OpenAPI werden nachgezogen. Nach B1160, weil `src/dienst/verlauf.rs` `phasenstand` ruft.
5. **B1163 Berichte rechnen je Spalte** (AK 1 Berichte, 9): in `web/berichte.js` entfallen `phasenRang`, `phasenSchwelle`, `phasenStufen` und jeder Zweig `art === 'phase'`, `istPhase`, `nachPhasen`; der Parameter `phasen` von `prognose`, `fieberTag` und `durchsatzZiel` entfällt. `fieberSchluessel` bleibt unberührt, `ersterDurchlauf` bleibt.
6. **B1164 Oberfläche: Wegfall** (AK 10–13): Feld, Leiste, Spaltenkopf, Wortlaute nach PO Z. 504 (a)–(d), Tooltips (PO Z. 502, 503). Am Spaltenkopf fallen ausdrücklich mit weg: das Element `.v.ph` mit dem Tooltip-Schlüssel `ph:` (`data-tip`/`data-halt` `ph:<Spalte>`, `web/ansicht.js:1021`), der Selektor `.v.ph` im Touch-Block `web/kd-app.css:886–887` (`.bahn-kopf :is(.info,.ok,.v,.v.ph,.eig-z)`) und in `web/kd-base.css:12`. AK 14 findet `.ph` und `ph:` nicht, deshalb stehen sie hier; `S.bew.phasen` in `web/app.js`, Kommentare zum Nachtragen (`web/app.js:220`, `:270`), Beschriftung `phases` in `web/kultur.js`.
7. **B1165 Namen ohne „Phase“, README, Durchsetzung** (AK 14, 15): CSS `.phasenbar` und `.wl-phase*`, die Eigenschaft `phasen` des Prognose-Ergebnisses und das Testdatum „Phase 1“ werden umbenannt; das Aussehen bleibt gleich (AK 13). Zur Durchsetzung gehört zusätzlich die Gegenprobe auf die Kürzel aus B1164: `rg -n '\.v\.ph\b|ph:' web` trifft nichts mehr, heute 4 Zeilen (Touch-Block `web/kd-app.css:886–887`, `web/kd-base.css:12`, Tooltip-Schlüssel `ph:` in `web/ansicht.js:1021`).
8. **B1166 Legacy-Probe JoinPuya, Probe im echten Programm, Gate, Anforderung abschließen** (AK 8, 16).

B1160, B1161 und B1163 sind nach B1159 unabhängig voneinander.

### Durchsetzung: was nach S3 „Phase“ heißen darf

ADR-0034 N4 Regel 5 erlaubt Treffer nur für Durchläufe, für Kommentare mit Verweis auf ADR-0034 und für das Wort „Speicherphase“. Für `rg -in 'phase' src web` heißt das, erlaubt sind genau:

| Stelle | Was |
|---|---|
| `src/dienst/durchlaeufe.rs` | ganz (Durchläufe, R00094) |
| `src/modell/aufgabe.rs` | `Durchlauf` mit Feld `phase` und seiner Doku |
| `src/format/aufgabe.rs` | Zeile im Block `kanbanD-runs` (Lesen, Schreiben, Doku) und ihre Tests |
| `src/web/mod.rs`, `src/web/endpunkte.rs` | Beschreibung von `POST /api/aufgaben/{nr}/durchlaeufe` |
| `web/ansicht.js` | Tabelle „DURCHLÄUFE“ (`d.phase`) |
| `src/git/arbeitsrepo.rs` | das Wort „Speicherphase“ |
| überall | Kommentare, die „ADR-0034“ nennen |

Alles andere fällt weg oder wird umbenannt. Gemeint sind besonders die Klassennamen `.phasenbar` (trägt nach S3 nur `#pruefungen-hinweis`) und `.wl-phase`, `.wl-phase-kopf` (Blöcke von Wie lange noch), die Eigenschaft `phasen` des Ergebnisses von `prognose` (die Blöcke je Spalte), die Variable `ph`, falls sie im Namen „phase“ trägt, das Attribut `data-phase`, der Testwert „Phase 1“ in `src/dienst/einstellungen.rs:283`, `:288` und `phases: 'Phasen'` in `web/kultur.js:68`. Die neuen Namen sind frei, ein Vorschlag: `.hinweisleiste`, `.wl-block`, `.wl-block-kopf`, `bloecke`.

Probe (ohne Prüfung von Hand): `rg -in 'phase' src web | rg -v '^src/dienst/durchlaeufe\.rs:|^src/git/arbeitsrepo\.rs:.*[Ss]peicherphase|ADR-0034' | rg -v -i 'durchlauf|durchl[äa]ufe|kanbanD-runs'`. Was danach übrig bleibt, gehört in `src/format/aufgabe.rs` zur Zeile `kanbanD-runs`, in `src/modell/aufgabe.rs` zu `Durchlauf` oder in `web/ansicht.js` zur Tabelle „DURCHLÄUFE“. Der architektur-reviewer prüft diese Reste einzeln. Am Stand `266ce20d` lässt die Probe 310 Zeilen übrig.

### Hinweise

- **Reihenfolge der Abnahme-Probe**: `K'` muss ohne `column-phases` und ohne `phases` entstehen, nicht durch einen späteren Commit, der die Zeile entfernt. Beide Ordner sollen dieselbe Folge von Bewegungen haben.
- **`tests/akzeptanz_r00222.rs`**: `:468` kehrt sich um (AK 2). Die Fixtures `:155` und `:188` behalten `column-phases`, denn sie belegen jetzt das Überlesen. AK 13 von R00222 („`phasen` wie vor der Karte, solange das Register `wbs` trägt“) gilt nach S3 nicht mehr; der Test wird angepasst, R00222 bleibt als Historie stehen.
- **`e2e/tests/wbs-hilfen.js`**: Wird es nach S3 nur noch für die Probe „WBS unlesbar, bytegleich“ gebraucht, schrumpft es auf diesen Teil (Kopf ohne Spalte `Phase`).
- **Lese-Rückfall**: `Anwendung.wbs`/`anforderungen` und `Quellen.wbs`/`anforderungen` bleiben. Ihr einziger Leser ist danach `startordner()` (N4 Regel 4). `phasenstand` war der letzte andere Leser.
- Kopien von Board-Ordnern nur in der eigenen Ablage, nie im Board-Ordner selbst.

## Tests

- **Unit (Rust):** `format/board.rs` — `column-phases` überlesen und beim Schreiben weg (der Test `spaltenphasen_im_frontmatter_rundlauf` dreht sich um); `format/aufgabe.rs` — `phases` in drei Formen als unbekannter Schlüssel, Blockform beim ersten Schreiben; `modell/aufgabe.rs` — `phasen` im PATCH überlesen; `warnung.rs` — zwei Schlüssel.
- **Integration:** `tests/akzeptanz_r00223.rs`: AK 1 (API-Teil), AK 2, AK 3 (mit `chmod 000`, ohne Root), AK 4–8, AK 16 (`#[ignore]`, wenn die Kopie fehlt; in B1166 einmal gefahren und belegt).
- **Node:** `e2e/einheit/r00223-ohne-phasen.test.js`: AK 1 (Berichte aus den `bewegungen` beider Ordner gleich), AK 9 (Literale von `fieberSchluessel`, Wahl „Reviews“ und „Abnahme“), AK 16 (Fieber-Tage).
- **E2E:** `e2e/tests/r00223-ohne-phasen.spec.js`: AK 1 (Text der drei Berichte), AK 10–13.

## Abhängigkeiten

- **Abhängig von:** [R00222](R00222-wbs-sicht-wirkungen-und-plausibilitaet-entfernen.md) (I0212, #224, S2; gebaut und reviewt auf `karte/224`, `266ce20d`, im Entwicklertest, noch nicht auf `main`).
- **Blockiert:** keine Karte. ADR-0034 Folgeaufgaben (ADR-0027 Statuszeile, Bausteine A00002–A00010) zieht der architekt nach dem Bau nach.

## Offene Fragen

Keine. Die drei Produktfragen aus N4 sind entschieden (PO Z. 501–503), ebenso die Rückfrage zu Spaltenkopf, Wie lange noch und Fever Chart (PO Z. 504); ihre Wortlaute stehen in FA, NFA und „Folgen“.

## Folgen

- **Datenpflege JoinPuya (PO Z. 501, wörtlich):** „Datenpflege JoinPuya (Director, außerhalb des Codes): Sobald die laufende kanbanD-Instanz das Board JoinPuya ohne Phasen liefert, spätestens nach dem Einspielen von S3, stellt der Director dort „Erledigt heißt“ von „Entwicklung“ auf „Reviews“ um, über „Einrichten“ oder die API, mit einem Commit im JoinPuya-Ordner, dessen Nachricht sagt: gleichbedeutend mit dem bisherigen „Entwicklung durchlaufen“ (PO Z. 501). Vorher nicht, denn mit Phasen hieße „Reviews“ noch „Phase Reviews durchlaufen“. kanbanD übersetzt keine gespeicherte Wahl.“
- **Inkauf (ADR-0034 N4):** Die Berichte gebundener Boards zeigen nach S3 je Spalte einen Block statt je Phase einen (bei JoinPuya zehn statt fünf). Die Bedeutung jedes Blocks außer dem letzten verschiebt sich von „durchlaufen“ zu „erreicht“ (PO Z. 499).
- **Nach dem Bau:** gestalter zieht D0001, D0002 und D0003 nach (PO Z. 503); architekt zieht die ADR-0027-Statuszeile, A00010 (`Phasenkarte`, `uebersprungen`), A00002–A00009 und X00001 nach und hakt die Folgeaufgaben von ADR-0034 ab.

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Auslieferung an die Board-Instanzen (`cargo install`, Neustart) durch den Director, danach die Datenpflege JoinPuya („Folgen“).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Auftrag des Betreibers vom 2026-11-20: Die WBS gehört dem Entwickler, die Aufgaben sind der Stand, Spalten sind Spalten. Nach S2 hängen noch zwei Dinge an der WBS. `phasenstand` öffnet die Phasen-Datei neben `a.wbs`, und `board_mit_phasen` schreibt beim bloßen Lesen eines Boards einen Commit, sobald eine Phase keine Spalte hat. Fällt `phasenstand` weg, gibt es keinen Codepfad mehr, der eine Datei im Arbeits-Repository öffnet. Der unlesbare Ordner in AK 3 belegt das, denn jedes übrig gebliebene Lesen änderte dort die Antworten. Ohne `board_mit_phasen` schreibt kein `GET` mehr (AK 2). Rechnen die Berichte nur noch je Spalte, gibt es eine Rechenart statt zwei. Der Zwilling ohne `column-phases` in AK 1 belegt, dass die Daten der alten Phasen nichts mehr bewirken. Die Altdaten (`column-phases`, `phases`) bleiben in den Dateien, bis eine Aktion sie ohnehin schreibt (AK 2, 4, 5, 16), also geht nichts still verloren (Q4). Weil `fieberSchluessel` gleich bleibt, behalten die Fieber-Caches ohne Wahl ihre Tage (AK 9, 16). Die einzige gespeicherte Wahl, deren Bedeutung sich verschiebt (JoinPuya), stellt die Datenpflege um (Folgen).

## Missing-Docs

- Glossar: „Phase“, „Spalte“ und „Block“ (Wie lange noch, Fever Chart) haben keinen eigenen Eintrag; nach S3 ist „Phase“ nur noch der Name in einem Durchlauf (fachspezialist).
- Glossar: [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) prüfen, ob er die Leiste „Phasen“ nennt.

## Notizen

**Entscheidungen des planers (Lauf 227-planer-1):**

1. **Durchsetzung schärfer als die Inventur:** Die Inventur lässt `.wl-phase*` stehen und den Namen `.phasenbar` offen. ADR-0034 N4 Regel 5 erlaubt aber nur Durchläufe, Kommentare mit ADR-Verweis und „Speicherphase“, und der Prüfpunkt `grep … 'phasen'` träfe `.phasenbar` ohnehin. Deshalb werden die Namen umbenannt (B1165). Das ist dieselbe Linie wie bei `--kd-wbs-*` in R00222. Das Aussehen sichert AK 13.
2. **`phases: [Abnahme]` öffnet** (AK 5): Heute ist es eine defekte Datei. Als unbekannter Schlüssel (Regel 2) wird es nicht mehr geprüft. Das ist eine Folge der Regel und kein neues Verhalten, aber der Grenzfall soll sichtbar sein.
3. **Mehr Wegfall als PO Z. 503 aufzählt:** Der Phasenname am Spaltenkopf (`.v.ph`, Tooltip `ph:`), „bzw. ihre Phase durchlaufen haben — … bzw. die letzte Phase“ in der Methodik des Fever Charts, der Methodik-Punkt zur Phasenfolge und „Vorphase“ in Wie lange noch fallen ebenfalls weg. Sie hängen an `S.board.phasen` bzw. `nachPhasen`, und Z. 503 erlaubt „nur Wegfall“. Die Aufzählung in Z. 503 nenne ich wörtlich. Die übrigen Stellen hat der product-owner auf Rückfrage entschieden (PO Z. 504, „Z. 503 gilt für alle Stellen, die an den Phasen hängen“); ihr Wortlaut (a)–(d) steht in NFA „Gestaltung, Wortlaute“ und in AK 10, 12 (Lauf 227-planer-2).
4. **Kein GET schreibt**: Die Liste in AK 2 nimmt die GETs, die heute Board und Register lesen. `GET /api/ereignisse` (Strom) gehört nicht dazu.

**Verworfene Alternativen:** `column-phases` beim nächsten Lesen entfernen (Commit durch Lesen, gegen N4 Regel 3); eine gespeicherte Wahl beim Lesen übersetzen (N4 Variante D, hält Phasenlogik am Leben); `fieberSchluessel` auf `v: 3` heben (N4 Variante C, verwirft den Verlauf aller Boards).
