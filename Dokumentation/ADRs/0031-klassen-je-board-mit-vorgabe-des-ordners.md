# ADR-0031: Klassen je Board — eigener Satz in der Board-Datei, sonst die Vorgabe des Ordners; die Karte behält ihren einen Schlüssel

**Status**: Akzeptiert (2026-11-18, Nachtrag N1) — zuvor „Vorgeschlagen“, bis die Fragen 1–4 unten beantwortet und die Vision ergänzt waren
**Datum**: 2026-11-18
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #200 „Klassen und Farben je Board statt je Instanz“ (Betreiber als Product Owner, 2026-11-18); Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: — (keine Probe gebaut; alle Aussagen zum Ist sind am Code belegt, Stand `e8523051`)

## Kontext

Der Betreiber führt in einem Ordner ein Wartungsboard und daneben ein eigenes Board für eine große Wartungsaufgabe. Das zweite Board zeigt die Klassen des ersten und kann keine eigenen haben (Karte #200, wörtlich: „die Klassen machen auf dem anderen Board keinen Sinn“). Soll: jedes Board kann eigene Klassen mit eigenen Farben haben.

Belege im Code:

- Klassen stehen heute nur in `kanbanD.md` unter `classes:` als `<schlüssel>: {label, color}` (`src/format/einstellungen.rs:26–36`, `:94–100`), im Modell `Einstellungen.klassen: Vec<Klasse>` (`src/modell/einstellungen.rs:20–25`, `:60`). Die Reihenfolge der Einträge ist die Dringlichkeit in den Berichten (`web/berichte.js:1076–1082`).
- Die Aufgabe trägt **einen** Schlüssel: `class: <schlüssel>` im Frontmatter, `Aufgabe.klasse: Option<String>` (`src/format/aufgabe.rs:60`, `src/modell/aufgabe.rs:383`). Geprüft wird beim Ändern gegen `kanbanD.md` (`src/modell/aufgabe.rs:562–569`); gelesen wird jeder Schlüssel ohne Prüfung.
- **Dieselbe Aufgabe darf auf mehreren Boards liegen, und auf keinem** (`Anforderungen/R00000-vision.md:74–76`; `Kanban::auf_board_legen`, `src/dienst/zuordnung.rs:10`, „die Aufgabe selbst bleibt unberührt“; Aufgabenliste mit „ohne Board“, `web/ansicht.js:1095–1104`).
- **Eine Klasse, die der Satz nicht kennt, gibt es heute schon**: `PUT /api/einstellungen` darf eine Klasse streichen, die Karten noch tragen (`einstellungen_pruefen`, `src/dienst/einstellungen.rs:36–51`, prüft nur Form und Dopplung). Die Oberfläche hat dafür eine Antwort: die Auswahl zeigt den Schlüssel als Eintrag ohne Farbe (`web/ansicht.js:616–621`), der Kartenname nennt keine Bezeichnung (`web/kartenname.js:6–10`), die Berichte führen sie mit Schlüssel hinter den bekannten (`web/berichte.js:1125–1130`). Die Legende zählt sie nicht (`web/ansicht.js:1037–1045`).
- Das Board kennt den Zuschnitt „Schlüssel fehlt = Standard, Schlüssel da = ausdrücklich“ schon: `Board.anwendungen: Option<Vec<String>>` (`src/modell/board.rs:356–358`, `src/format/board.rs:42`, Test `:501`). Einstellungen am Board haben je eine eigene Route (`PUT /api/boards/{slug}/berichtsfilter`, `/anwendungen`, `/termine`, `src/web/endpunkte.rs:43–52`). Der Berichtsfilter des Boards nennt Klassen schon über ihren Schlüssel (`exclude-classes`, `src/format/board.rs:200`).
- Board-Leser und -Schreiber kennen nur ihre benannten Frontmatter-Schlüssel (`src/format/board.rs:10–42`, `:303 ff.`): ein unbekannter Schlüssel wird überlesen und beim nächsten Schreiben nicht wieder ausgegeben. Dasselbe gilt für `kanbanD.md`.
- Bestand (`~/Projekte/Kanban-Boards/*`, 2026-11-18): sechs Ordner mit Boards, keiner trägt `classes` in einer Board-Datei; zwei Ordner haben zwei Boards; im Demo-Ordner liegt keine Aufgabe auf mehr als einem Board (0 von 29).
- Die Vision sagt heute das Gegenteil des Auftrags: „Personen und Klassen gelten für den ganzen Ordner und reisen mit ihm“ (`Anforderungen/R00000-vision.md:77`).

Qualitätsziele: bestehende Ordner öffnen nach dem Upgrade unverändert und behalten ihre Klassen (legacy); dem Nutzer geht nichts still verloren; lesend p95 < 200 ms bei 5.000 Aufgaben und 10 Boards; der Agenten-Client legt mit `--klasse` weiter an.

## Optionen

### Option A: Eigener Satz in der Board-Datei, sonst die Vorgabe des Ordners (ganz oder gar nicht)
- Vorteile: Das Board besitzt seine Klassen wie seine Spalten, Termine und seinen Berichtsfilter; umbenennen, archivieren, löschen (ADR-0022) nehmen sie ohne Zusatzarbeit mit. Kein Upgrade-Schritt: ein Board ohne den Schlüssel verhält sich wie heute. Die Aufgabe und ihr Format bleiben unverändert.
- Nachteile: Liegt eine Karte auf zwei Boards mit verschiedenen Sätzen, passt ihr einer Schlüssel nur zu einem. Schwäche: eine ältere Programmversion, die eine Board-Datei schreibt, lässt den neuen Schlüssel weg.

### Option B: Klassen ziehen ganz in die Boards um, `kanbanD.md` verliert `classes`
- Vorteile: Ein Ort je Board, kein Vorrang zu erklären.
- Nachteile: Das Upgrade muss jede Board-Datei jedes Ordners umschreiben; Aufgaben ohne Board haben keinen Satz mehr; ein neues Board beginnt leer oder braucht eine Kopierregel. Schwäche: ein Schreib-Upgrade über fremde Ordner ist genau das Risiko, das „legacy“ ausschließen soll.

### Option C: Klasse je Lage — das Board merkt sich die Klasse an der Kartenzeile
- Vorteile: Löst die Karte auf zwei Boards vollständig: je Board eine eigene Klasse.
- Nachteile: Neues Format der Kartenzeile, `klasse` verschwindet aus der Aufgabe (oder steht doppelt), jede Tür (`PATCH /api/aufgaben/{nr}`, Filter `?klasse=`, Duplizieren, Berichte, `kanband.py --klasse`) braucht ein Board dazu; der Bestand muss umgeschrieben werden. Schwäche: der teuerste Umbau für einen Fall, der im Bestand nicht vorkommt (0 von 29).

### Option D: Benannte Klassensätze in `kanbanD.md`, das Board nennt seinen Satz
- Vorteile: Zwei Boards können denselben Satz teilen; ein Ort für alle Farben.
- Nachteile: Ein neuer Begriff („Satz“) samt Verwaltung, den niemand verlangt; der Satz hängt am Slug oder an einem Namen und muss beim Umbenennen und Löschen des Boards nachgeführt werden. Schwäche: Indirektion ohne Anlass.

## Entscheidung

**Gewählt: Option A.** Regeln:

1. **Speicherort und Form.** Die Board-Datei bekommt im Frontmatter den Schlüssel `classes:` in genau der Form von `kanbanD.md`: `<schlüssel>: {label: <Bezeichnung>, color: <Palettenname | #rrggbb>}`, Reihenfolge = Dringlichkeit. Modell: `Board.klassen: Option<Vec<Klasse>>` nach dem Vorbild `anwendungen` — `None` = Schlüssel fehlt, `Some([])` (`classes: {}`) = das Board hat ausdrücklich keine Klassen. Gelesen und geschrieben wird mit **einer** gemeinsamen Funktion für beide Dateien; geprüft mit **einer** Prüfung (`klassen_pruefen`, herausgelöst aus `einstellungen_pruefen`): Schlüssel, Bezeichnung, Farbe, keine Dopplung.
2. **Vorrang.** Der **Klassenvorrat** eines Boards ist sein eigener Satz, wenn `classes` da ist, sonst die Vorgabe des Ordners (`classes` in `kanbanD.md`). Ganz oder gar nicht — es wird nicht gemischt, denn gemischt blieben genau die Klassen sichtbar, die auf dem Board keinen Sinn haben. Es gibt je Seite **eine** Funktion dafür (`Board::klassenvorrat(&Einstellungen)` im Modell, eine in `web/`); niemand sonst greift für Karten eines Boards direkt auf `einstellungen.klassen` zu.
3. **Außerhalb eines Boards** (Aufgabenliste, Fenster aus der Liste, Anlegen ohne Board) gilt der Vorrat des ersten Boards in der Reihenfolge der Boardliste, auf dem die Aufgabe liegt; liegt sie auf keinem, die Vorgabe des Ordners.
4. **Bestand.** Kein Upgrade-Schritt, keine Datei wird beim Start angefasst. Ein Board ohne `classes` liest und schreibt sich zeichengleich wie bisher; `kanbanD.md` behält `classes` unverändert, es heißt ab jetzt „Vorgabe für Boards ohne eigene Klassen“.
5. **Die Karte behält ihren einen Schlüssel.** `class` bleibt an der Aufgabe, eine Klasse je Karte. Kein Vorgang am Board (drauflegen, bewegen, herunternehmen, eigenen Satz einschalten, Klasse aus dem Satz streichen) ändert die Aufgabe. Kennt der Vorrat des betrachteten Boards den Schlüssel nicht, ist die Klasse dort **fremd** und wird wie die heute schon mögliche unbekannte Klasse behandelt: Schlüssel als Text, keine Farbe, in der Auswahl als eigener Eintrag, in Berichten hinter den bekannten. Das ist die verlustfreie technische Vorgabe; ob die Oberfläche darüber hinaus fragt, zuordnet oder abweist, ist Produktfrage 1.
6. **Setzen einer Klasse.** Gültig ist ein Schlüssel aus dem Vorrat eines Boards, auf dem die Aufgabe liegt (Vereinigung); liegt sie auf keinem, aus der Vorgabe. Beim Anlegen mit `board` gilt der Vorrat dieses Boards. Ein unveränderter Wert wird nicht geprüft, damit ein Client, der die ganze Aufgabe zurückschickt, an einer fremden Klasse nicht scheitert. Die Abweisung bleibt 400 und nennt Board und Schlüssel.
7. **API.** `GET /api/boards` und `GET /api/boards/{slug}` liefern `klassen: [...] | null` (eigener Satz oder keiner). Neu: `PUT /api/boards/{slug}/klassen` mit `{klassen: [{schluessel, bezeichnung, farbe}] | null}` — `null` kehrt zur Vorgabe zurück; ein Commit über den Schreibweg `gesperrt()` → Prüfung → `aktion()`. `GET/PUT /api/einstellungen`, `?klasse=` und `klasse` in `POST`/`PATCH /api/aufgaben` behalten ihre Form; nur die Gültigkeit folgt Regel 6.
8. **Oberfläche.** Karte, Legende, Klassenwahl, Kartenmenü, Schnelleingabe `class:` und die Berichte eines Boards nehmen den Vorrat des Boards. Die Board-Einstellungen bekommen den Abschnitt „Klassen dieses Boards“ (Vorgabe des Ordners verwenden oder eigene), der Editor ist der vorhandene Klassen-Editor der Ordner-Einstellungen.

## Konsequenzen

**Positiv:**
- Bestehende Ordner bleiben Byte für Byte, wie sie sind; das Verhalten ändert sich erst, wenn ein Board eigene Klassen bekommt.
- Keine Änderung am Format der Aufgabe, an `?klasse=` und am Agenten-Client (`kanband.py --klasse` sendet weiter einen Schlüssel).
- Kein Lastthema: der Vorrat ist eine Suche in einer kurzen Liste aus Dateien, die ohnehin gelesen sind.

**Negativ / Inkauf zu nehmen:**
- Eine Karte auf zwei Boards mit verschiedenen Sätzen ist auf einem der beiden fremd. Bewusst in Kauf genommen, weil der Fall im Bestand nicht vorkommt und Option C das Format der Aufgabe und jede Tür ändern würde. Kippt die Annahme (Produktfrage 2), löst eine neue ADR diese ab.
- Derselbe Schlüssel kann auf zwei Boards verschieden heißen und gefärbt sein; die Aufgabenliste zeigt dann nach Regel 3 die Fassung des ersten Boards.
- Eine ältere Programmversion, die eine Board-Datei mit `classes` schreibt, lässt den Schlüssel weg. Kein stiller Datenverlust an den Karten (`class` bleibt), der Satz liegt in der Git-Geschichte des Ordners; ein Rückschritt der Version ist kein unterstützter Weg.
- Ein Agent, der mit `--klasse vorrang` auf einem Board mit eigenem Satz ohne `vorrang` anlegt, bekommt 400. Die Meldung nennt Board und Schlüssel.

**Durchsetzung:**
- Format-Test (`src/format/board.rs`): Rundlauf mit `classes` (mehrere, `{}`) zeichengleich; ein Board ohne `classes` schreibt keine Zeile dazu; jede Board-Datei des Bestandsmusters liest und schreibt sich unverändert.
- Modell-Test: `klassenvorrat` für `None`, `Some([])`, `Some([…])`; Regel 6 mit Aufgabe auf keinem, einem und zwei Boards samt unverändertem fremdem Wert.
- API-Test: `PUT /api/boards/{slug}/klassen` (setzen, `null`, 400 bei Dopplung und falscher Farbe, ein Commit), `POST /api/aufgaben` mit `board` und `klasse` gegen eigenen Satz und gegen Vorgabe.
- Review-Punkt `architektur-reviewer`: außerhalb der beiden Vorrat-Funktionen kein Zugriff auf `einstellungen.klassen` für Karten eines Boards (`grep -n "einstellungen.klassen" web/ src/`).

## Offene Produktfragen (an den product-owner)

1. Wie zeigt und behandelt ein Board eine fremde Klasse (Regel 5) — nur anzeigen (technische Vorgabe), beim Drauflegen nachfragen, abweisen oder entfernen?
2. Bleibt es bei einer Klasse je Karte, oder braucht eine Karte je Board eine eigene (Option C)?
3. Beginnt „eigene Klassen“ mit einer Kopie der Vorgabe oder leer?
4. Darf eine Klasse aus einem Satz gestrichen werden, die Karten noch tragen (heute im Ordner ohne Rückfrage erlaubt)?

Die Regeln 1–4, 6 und 7 hängen an keiner dieser Antworten; nur Antwort 2 „je Board“ löst diese ADR ab.

## Folgeentscheidungen / Aufgaben

- [x] Vision Z. 77 ergänzen (`/vision fortschreiben`): Klassen je Board mit Vorgabe des Ordners. — erledigt 2026-11-18 (`b739ccf8`)
- [x] Anforderung über den planer: Format und Modell, Vorrat-Funktion, Route, Oberfläche (Regeln 1–8). — R00195, WBS I0185 (F0157–F0159)
- [ ] Modell nach dem Bau nachführen (A00004, A00005, A00006, A00009).

## Nachträge

### N1 (2026-11-18): Akzeptiert — alle vier Produktfragen entschieden, Vision fortgeschrieben

Die Entscheidung (Option A, Regeln 1–8) gilt unverändert. Entschieden hat der product-owner (`AI-Team/po-entscheidungen.md`, Zeilen vom 2026-11-18 zu #200):

1. **Fremde Klasse: nur anzeigen.** Regel 5 gilt als Verhalten der Oberfläche; Auflage: die fremde Klasse ist auch auf der Karte selbst erkennbar (Schlüssel als Text ohne Farbe), nicht erst im Aufgabenfenster.
2. **Eine Klasse je Karte.** Option C ist nicht gewählt; diese ADR wird nicht abgelöst.
3. **„Eigene Klassen“ beginnt in der Oberfläche mit einer Kopie der Vorgabe des Ordners**; über die API bestimmt der Aufrufer den Satz selbst, auch den leeren.
4. **Eine belegte Klasse darf gestrichen werden**, mit einer Hinweiszeile zur Zahl betroffener Karten im Klassen-Editor vor dem Speichern (kein Bestätigungsfenster), in beiden Editoren (Board und Ordner) und auch bei der Rückkehr zur Vorgabe; die API bleibt ohne Rückfrage.

Die Vision trägt die Richtung seit `b739ccf8` (Entscheidung des Betreibers vom 2026-11-18): Klassen je Board mit Vorgabe des Ordners, Personen ordnerweit. Anforderung: R00195; WBS: I0185.

### N2 (2026-11-18): Die Abweisung nennt den Ort, an dem die Klasse fehlt — „steht nicht in kanbanD.md“ bleibt, wo die Vorgabe gilt (Karte #202)

**Anlass**: Seit R00195 antwortet `Klassengeltung::pruefen` (`src/modell/board.rs:364–372`) nur noch für eine Aufgabe auf **keinem** Board mit „Klasse „…“ steht nicht in kanbanD.md“; für ein Board **ohne eigenen Satz** heißt es „gibt es auf dem Board „…“ nicht — dort gilt: …“, obwohl dort die Vorgabe aus `kanbanD.md` gilt. Der Agenten-Client der Software-Factory (`werkzeuge/board.py:379`) legt eine fehlende Klasse nur an, wenn die Meldung „steht nicht in kanbanD.md“ enthält; `karte-neu --klasse vorrang` scheitert seither. Das verletzt das Qualitätsziel oben („der Agenten-Client legt mit `--klasse` weiter an“). Ursache im Schnitt: `Klassengeltung` merkt sich je Board nur Slug und Schlüssel (`:360`), nicht, ob der Vorrat der eigene Satz oder die Vorgabe ist.

**Einordnung**: Regel 6 („bleibt 400 und nennt Board und Schlüssel“) und ADR-0003 legen Status und Form `{fehler}` fest; den Wortlaut überlässt ADR-0003 N1 dem `entwickler`. Ein Vertrag über den Wortlaut stand bisher nirgends — er ist durch den Client entstanden.

**Entscheidung** (ergänzt Regel 6, ändert sie nicht):

1. **Die Meldung nennt den Ort, an dem die Klasse fehlt.** Der Wortteil „steht nicht in kanbanD.md“ steht **genau dann** in der Meldung, wenn ein Eintrag in `kanbanD.md` die Anfrage gültig machen würde: die Aufgabe liegt auf keinem Board, oder **mindestens eines** ihrer Boards hat keinen eigenen Satz (Vereinigung nach Regel 6). Die Meldung darf das Board zusätzlich nennen.
2. **Führen alle Boards der Aufgabe einen eigenen Satz** (auch `classes: {}`), steht der Wortteil nicht; die Meldung nennt Board und Schlüssel wie heute (R00195 AK 4).
3. **Der Wortteil ist für `POST` und `PATCH /api/aufgaben` Vertrag**, solange kein maschinenlesbares Feld ihn ablöst (ADR-0003: Agenten sollen auf Felder reagieren, nicht auf Text). Der übrige Wortlaut bleibt Sache des `entwickler`.

**Grenze**: Wie `Klassengeltung` die Herkunft des Vorrats je Board trägt, ist Sache des `entwickler`. Ein Fehlercode oder Feld im Rumpf gehört nicht in Karte #202.

**Durchsetzung**: API-Test je für `POST` und `PATCH`: Board ohne `classes` → 400, Meldung enthält „steht nicht in kanbanD.md“; Board mit eigenem Satz und mit `classes: {}` → 400 ohne den Wortteil, mit Board und Schlüssel; Aufgabe auf zwei Boards, eines mit Vorgabe, eines mit eigenem Satz → 400 mit dem Wortteil. Der Wortteil steht an einer Stelle im Code, mit Verweis auf diesen Nachtrag.
