# ADR-0043: `kanbanD.md` zeilengenau je Abschnitt schreiben — nur geänderte Schlüssel ersetzen, Textkörper nie, Handform im geänderten Abschnitt wird verweigert, Rücklese-Prüfung als zweite Sicherung

**Status**: Akzeptiert — product-owner 2026-11-23 (po-entscheidungen Z. 665–668, Lauf 248-product-owner-1): Bug; V4 mit geänderter Regel 6 (Verweigerung statt Normalform); Wortlaut der 409 wörtlich. Technisch durch Code-Lesen getragen. Nachtrag N1 (2026-11-23, Akzeptiert): Vorschau in „Einrichten“ als Trockenlauf `POST /api/einstellungen/vorschau` desselben Schreibwegs (Regel 8), entprellt; Wortlaute nach PO Z. 693–694.
**Datum**: 2026-11-23
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #248, Läufe 248-architekt-1 und -2); product-owner (Z. 665–668)
**Kontext-Anforderung**: — (Karte #248, entstanden im Entwicklertest von #218, R00220). Bezug: ADR-0036 Nachtrag „Umschalten“ Regel 4 (Schalter zeilengenau), ADR-0034 N2 Regel 2 (alte Form des Registers wird beim `PUT` umgestellt), ADR-0031 Regel 1 (ein Schreiber für `classes`), PO Z. 492, Vision „Git-freundliche Form“ und „Die Dateien sind der einzige Speicher“
**Erprobt durch**: — (am Code gelesen, Stand `d79b70f2`; sechs echte `kanbanD.md` unter `~/Projekte/Kanban-Boards/*/` und ihre Git-Geschichte nur lesend geprüft)

## Kontext

- **Belegt (Code)**:
  - Jeder Schreibweg der Einstellungen läuft durch `Kanban::einstellungen_aendern` (`src/dienst/einstellungen.rs:172–189`): Modell lesen, ändern, normalisieren, prüfen, bei Änderung `einstellungen::schreiben(&neu)` als ganze Datei (`:187`). Betroffen sind `PUT /api/einstellungen` („Speichern“ in „Einrichten“, `einstellungen_setzen` `:191`; Oberfläche `web/app.js:4548`), `POST /api/personen` und `PATCH`/Stilllegen von Personen (`person_anlegen`, `person_aendern`; Routen `src/web/mod.rs:91–92`). Die Factory schreibt über dieselben Routen (`GET`→`PUT`, ADR-0034 N2 Anlass).
  - `einstellungen::schreiben` (`src/format/einstellungen.rs:115–142`) erzeugt die Datei aus dem Modell: `people`, `classes`, `signals` (nur wenn nicht leer), `record-transcripts`, `sources` in fester Reihenfolge, danach den **Standard-Textkörper** („# kanbanD …“). Das Modell `Einstellungen` (`src/modell/einstellungen.rs:88–97`) kennt nur diese fünf Felder; alles andere — Kommentare, unbekannte Schlüssel, Reihenfolge, Textkörper — gibt es im Modell nicht und geht beim Schreiben verloren.
  - „Einrichten“ schreibt in `kanbanD.md` **Personen, Klassen des Ordners, Signale und das Register (`sources`, `applications`)**. Spalten, Klassen je Board, Termine, Fieber gehören in die Board-Datei (eigene Routen `PUT /api/boards/{slug}/…`), nicht in `kanbanD.md`. Der Schalter `record-transcripts` wird von `PUT` nie geschrieben, sondern aus der Datei übernommen (`:193–194`).
  - Für den Schalter gibt es schon den zeilengenauen Weg: `format::board::schalter_im_text` (`src/format/board.rs:102–135`) ersetzt bzw. entfernt die Zeile samt eingerückter Folgezeilen oder fügt sie vor das schließende `---` ein; BOM und Zeilenende der Datei bleiben. `vorgabe_transkripte_setzen` (`src/dienst/schalter.rs:55–72`) liest danach zurück und verweigert mit Fehler, wenn der Wert sich anders liest.
  - `einrichten` (`src/dienst/einrichten.rs:108–121`) legt die Datei einmalig neu an; dort ist das Erzeugen aus dem Modell richtig.
- **Belegt (Bestand, nur lesend)**: Sechs echte Ordner (`Entwicklungsprozess`, `goaltreetoolA`, `JoinPuyaApp`, `kanbanD-Demo`, `kanbanD`, `localchatA`), 2–24 Commits an `kanbanD.md` je Ordner, jeder Commit von kanbanD selbst („Einstellungen geändert“, „Person … angelegt“, „Transkripte, Vorgabe des Ordners: an“, „kanbanD eingerichtet“). Kein Ordner enthält Kommentare, unbekannte Schlüssel oder eigenen Textkörper; `people`, `classes`, `signals` stehen in Normalform. Zwei Abweichungen von der heutigen Normalform:
  1. **Alle sechs** tragen `sources` in alter Form (`wbs: ""`, `requirements: ""`, Anwendungen mit `wbs`/`requirements`). Das erste `PUT` stellt nach ADR-0034 N2 Regel 2 auf `repository` um — gewollt, zählt als geänderte Zeilen.
  2. `kanbanD-Kanbanboard/kanbanD.md` trägt `record-transcripts: true` **hinter** `sources` (eingefügt von `schalter_im_text`). `schreiben` setzt den Schalter **vor** `sources` (`src/format/einstellungen.rs:135–137`): das nächste „Speichern“ verschiebt die Zeile heute ohne Anlass. Das ist der echte, heute rote Legacy-Fall.
- **Belegt (Planung)**: PO Z. 492: „`kanbanD.md` ist dagegen die Einstellungsdatei, die Menschen von Hand pflegen“ — dort bleiben Kommentare, unbekannte Schlüssel, Reihenfolge und Textkörper beim Schalter zeichengleich; für die Board-Datei gilt die Normalform. Vision „Git-freundliche Form … ändern sich nur dort, wo sich etwas ändert“.
- **Qualitätsziel (Szenario mit Maß)**: Ein Mensch benennt in „Einrichten“ eine Person um und speichert → `git show HEAD -- kanbanD.md` zeigt genau eine geänderte Zeile; Kommentar, fremder Schlüssel, Reihenfolge und Textkörper sind zeichengleich (Probe der Karte, heute rot). Für eine Datei in Normalform gilt dasselbe: Diff = nur die Zeilen der geänderten Einträge (+ einmalig der Block `sources` bei alter Form).

## Optionen

| Option | Stärke | Schwäche | Preis (geschätzt) |
|---|---|---|---|
| **V1 — zeilengenau je Abschnitt**: nur die Abschnitte (`people`, `classes`, `signals`, `sources`), deren Modellwert sich ändert, werden als Block im Text der Datei ersetzt, entfernt oder vor `---` eingefügt; alles andere bleibt Byte für Byte | Verallgemeinert `schalter_im_text` (eine Funktion, gleiche Blockregel); die Abschnittsschreiber gibt es schon (`klassen_schreiben`, Personen-/Signal-/Quellen-Teil von `schreiben`); bei Normalform-Dateien zeigt der Diff nur die geänderten Einträge; Textkörper, Kommentare zwischen Abschnitten, fremde Schlüssel und Reihenfolge bleiben | Innerhalb eines **geänderten** Abschnitts verlieren eingerückte Kommentare und handgewählte Schreibweise (Block- statt Flussform, andere Anführung) ihre Form | klein: eine Formatfunktion, Abschnittsvergleich im Dienst, ~15 Tests |
| V2 — zeilengenau je Eintrag: wie V1, aber innerhalb eines Abschnitts nur die Zeilen des geänderten Eintrags (`  sh: {…}`), neue Einträge ans Ende des Abschnitts, entfernte (Klassen, Signale, Anwendungen) heraus | erhält auch Kommentare und Handform innerhalb geänderter Abschnitte | Eintragsgrenzen in Blockform über mehrere Zeilen, zweite Ebene (`sources.applications`), Umsortieren nach Kürzel (Register) und Entfernen sind eigene Fälle: etwa doppelter Code und doppelte Testmatrix; heute ohne einen einzigen echten Bestand, der es braucht | mittel |
| V3 — Hinweis und Verweigerung: weicht der Dateitext von `schreiben(lesen(text))` ab (außer der Umstellung des Registers), antwortet `PUT` mit 409 „bitte in der Datei ändern“ | kein Formatcode; nie ein stiller Verlust | „Einrichten“ wird für jede von Hand berührte Datei unbrauchbar — genau für die Datei, die nach PO Z. 492 von Hand gepflegt wird; die Factory (`GET`→`PUT`) bräche an einem einzigen Kommentar; schon der echte Bestand `kanbanD-Kanbanboard` (Schalter hinter `sources`) würde verweigert | klein |
| **V4 — Mischform: V1 plus Rücklese-Prüfung, Verweigerung nur als Sicherung** (gewählt) | wie V1; zusätzlich: liest sich der neue Text nicht genau zum gewollten Modell zurück (zitierter Schlüssel `"people":`, Anker, doppelter Schlüssel, Abschnitt in einer Zeile mit Kommentar dahinter …), gibt es keinen Commit, sondern 409 mit Hinweis — dasselbe Sicherungsmuster wie beim Schalter (`src/dienst/schalter.rs:66–69`) | die Schwäche von V1 bleibt; seltene exotische Dateien werden verweigert statt geschrieben | klein (V1 + ein Vergleich, ein Fehlerpfad) |

## Entscheidung

Gewählt **V4** (V1 mit Rücklese-Prüfung), mit der Änderung des product-owner an Regel 6 (Z. 666: kein stiller Verlust innerhalb eines geänderten Abschnitts), weil sie die Linie aus ADR-0036 Regel 4 und PO Z. 492 auf alle Schlüssel von `kanbanD.md` ausdehnt, mit dem vorhandenen Muster und einem kleinen Preis. Regeln:

1. **Ein Blockschreiber im Format**: `format::einstellungen` (oder `format::frontmatter`) bekommt `abschnitt_im_text(text, schluessel, block: Option<&str>) -> String`. Ein Abschnitt ist eine Zeile `<schluessel>:` in Spalte 0 innerhalb des Frontmatters samt den folgenden Zeilen, die mit Leerzeichen oder Tab beginnen (Blockregel von `schalter_im_text`). `Some(block)` ersetzt ihn an Ort und Stelle; fehlt er, kommt der Block vor das schließende `---`. `None` entfernt ihn. Zeilen in Spalte 0 hinter dem Abschnitt (Kommentar, Leerzeile, nächster Schlüssel) gehören nicht dazu und bleiben. BOM und Zeilenende (`\r\n` oder `\n`) folgen der Datei, auch in den neuen Blockzeilen. Ohne Frontmatter entsteht einer vor dem Text (wie beim Schalter). `schalter_im_text` wird zum Aufruf dieser Funktion mit dem einzeiligen Block `record-transcripts: <wert>`; ihre Tests bleiben unverändert grün.
2. **Blöcke in Normalform aus den vorhandenen Schreibern**: `schreiben` wird in Abschnittsschreiber zerlegt (`personen_schreiben`, `klassen_schreiben` vorhanden, `signale_schreiben`, `quellen_schreiben`), die genau die heutigen Zeilen liefern; `schreiben` setzt sie für `einrichten` wie bisher zusammen. Leere Sätze: `people: {}`, `classes: {}`, `signals` → Abschnitt entfällt (wie heute).
3. **Nur geänderte Abschnitte**: `einstellungen_aendern` liest unter derselben Sperre neben dem Modell den Text der Datei und vergleicht je Abschnitt `alt` mit `neu` (Personen, Klassen, Signale, Quellen). Nur Abschnitte mit Unterschied gehen durch `abschnitt_im_text`, in der Reihenfolge `people`, `classes`, `signals`, `sources`. Die Umstellung der alten Registerform (ADR-0034 N2 Regel 2, `Altform::Umstellen`) ist ein Unterschied in `sources`; `Altform::Stehenlassen` bleibt wie gebaut. Ohne Unterschied kein Commit (wie heute).
4. **Textkörper, Reihenfolge, Fremdes**: Der Text nach dem Frontmatter, unbekannte Schlüssel, Kommentare außerhalb geänderter Abschnitte und die Reihenfolge der Schlüssel werden von keinem Schreibweg außer `einrichten` erzeugt oder verändert. Der Standard-Textkörper entsteht nur beim Einrichten.
5. **Rücklese-Prüfung (zweite Sicherung) und Wortlaut**: Vor dem Commit wird der neue Text mit `einstellungen::lesen` gelesen; er muss `neu` ergeben (Schalter aus der Datei). Sonst kein Commit, Datei zeichengleich, `Fehler::Konflikt` (409) mit dem Wortlaut des product-owner (Z. 667, wörtlich):
   „Nicht gespeichert: Der Abschnitt „<schluessel>“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.“
   - `<schluessel>` ist der Schlüssel, wie er in der Datei steht: `people`, `classes`, `signals`, `sources`; beim Schalter `record-transcripts`.
   - Genannt wird der **erste** betroffene Abschnitt in der Reihenfolge `people`, `classes`, `signals`, `sources`. Lässt sich ein Fehler beim Rücklesen keinem Abschnitt zuordnen, wird der erste geänderte genannt.
   - Derselbe Text für alle Schreibwege und für beide Sicherungen (Regel 5 und 6), ohne Statuscode, ohne Text des YAML-Lesers. In „Einrichten“ steht er in `#einr-fehler`, der Entwurf bleibt stehen (wie gebaut, R00209 AK 12).
6. **Kein stiller Verlust — Handform im geänderten Abschnitt wird verweigert** (PO Z. 666, ersetzt den Vorschlag „bewusster Verlust“): Ein geänderter Abschnitt wird nur ersetzt, wenn sein **bisheriger Text** genau der Normalform seines **bisherigen Werts** entspricht, also dem, was der Abschnittsschreiber aus Regel 2 für `alt` liefert. Beim Register (`sources`) gilt zusätzlich die **alte Form**, die frühere kanbanD-Versionen geschrieben haben (`wbs`/`requirements`, ADR-0034 N2 Regel 2; maßgeblich ist die Form der sechs echten Bestände) — sie wird beim Speichern wie gebaut auf `repository` umgestellt. Verglichen wird ohne Zeilenende (`\r\n` = `\n`); ein fehlender Abschnitt gilt als Normalform, wenn sein bisheriger Wert leer ist. Trägt der Abschnitt etwas von Hand (eingerückter Kommentar, Block- statt Flussform, eigene Anführung, Leerzeile), wird **nichts** geschrieben: 409 mit dem Wortlaut aus Regel 5, kein Commit, Datei zeichengleich. Die Prüfung läuft für alle geänderten Abschnitte, bevor einer geschrieben wird. Unberührte Abschnitte bleiben in jeder Form erhalten. V2 (je Eintrag) wird erst gebaut, wenn eine solche Verweigerung im Betrieb auftritt (PO Z. 666).
7. **Gilt für alle Schreibwege über `einstellungen_aendern`**: `PUT /api/einstellungen`, `POST /api/personen`, `PATCH /api/personen/{kürzel}`, Stilllegen. Der Schalter bleibt auf seiner eigenen Route (ADR-0036 „Umschalten“), nutzt aber dieselbe Funktion; für ihn gilt Regel 6 nicht (er ersetzt nur seine eine Zeile, ADR-0036 Regel 4). Scheitert beim Schalter das Rücklesen (`vorgabe_transkripte_setzen`, heute `Fehler::Intern`), antwortet kanbanD mit **409 und demselben Wortlaut** (`<schluessel>` = `record-transcripts`), kein Commit, Datei zeichengleich (PO Z. 667).

## Konsequenzen

- **Positiv**: „Speichern“ erzeugt den Diff, den die Vision verlangt; Handgepflegtes geht nie still verloren, weder zwischen noch in Abschnitten. Der echte Fall `kanbanD-Kanbanboard` (Schalter hinter `sources`) bleibt beim Speichern unberührt. Ein Schreibmuster für die ganze Datei statt Modell-Neuschreiben plus Ausnahme.
- **Inkauf**: Regel 6 — wer in einem Abschnitt von Hand gestaltet hat, kann diesen Abschnitt nicht mehr über „Einrichten“ ändern, sondern trägt die Änderung in der Datei ein (sichtbar, mit Wortlaut). Der Bestand (sechs Ordner in Normalform bzw. alter Registerform) wird nie verweigert. Die Rücklese-Prüfung verweigert zusätzlich seltene YAML-Formen (zitierte Schlüssel, Anker). Ein unbekannter Schlüssel, der zufällig `people` heißt, gibt es nicht: die vier Namen gehören dem Format.
- **Board-Datei unverändert**: Für Board-Dateien gilt weiter die Normalform (PO Z. 492); diese ADR ändert dort nichts.
- **Lastprofil**: ein zusätzliches Lesen des Textes derselben kleinen Datei unter der Sperre; vernachlässigbar.
- **Durchsetzung**: Rundlauf-Test „Datei mit Kommentar, fremdem Schlüssel vor den bekannten, eigenem Textkörper, CRLF und BOM; je Schreibweg eine Änderung → Diff genau die erwarteten Zeilen“; Legacy-Test gegen Kopien der sechs echten `kanbanD.md` (Fixtures ohne Personendaten außer den vorhandenen Rollennamen, sonst anonymisiert); Review-Punkt für den architektur-reviewer: kein Aufruf von `einstellungen::schreiben` außerhalb von `einrichten`.

## Folgeentscheidungen / Aufgaben

- [x] product-owner: Bug, V4 mit Regel 6 als Verweigerung, Wortlaut (Z. 665–668) — Status Akzeptiert
- [ ] Anforderung über den planer (Bug): Regeln 1–7, Abnahme-Ideen unten
- [ ] nach dem Bau: Modell A00005 (Schreiber `kanbanD.md`) und A00004 (`einstellungen_aendern`) von Soll auf Ist nachführen

### Abnahme-Ideen für den planer

- **Probe der Karte**: `kanbanD.md` mit `# von Hand` als erster Frontmatter-Zeile, `eigener-schluessel: 1` vor `people`, eigenem Textkörper; `PUT /api/einstellungen` mit umbenannter Person → `git show HEAD -- kanbanD.md` ändert genau die Zeile der Person; Rest zeichengleich (heute rot).
- **Varianten**: neue Person über `POST /api/personen` (eine Zeile mehr, an das Ende von `people`); Stilllegen (eine Zeile geändert); letztes Signal entfernen (Abschnitt `signals` entfällt, sonst nichts); erstes Signal anlegen (Abschnitt vor `---`, hinter `eigener-schluessel`); Kommentarzeile in Spalte 0 zwischen `people` und `classes` bleibt bei Änderung in `people`; CRLF-Datei bleibt CRLF; BOM bleibt; `record-transcripts` hinter `sources` bleibt dort bei Änderung in `sources`; alte Registerform → nur der Block `sources` ändert sich (plus die eigentliche Änderung).
- **Handform verweigert (Regel 6, PO Z. 666)**: eingerückte Kommentarzeile `  # Vertretung` innerhalb von `people`; `PUT` benennt eine Person um → 409 mit dem Wortlaut aus Regel 5 (`<schluessel>` = `people`), kein Commit, Datei zeichengleich. Dasselbe über `PATCH /api/personen/{kürzel}`. Mutant „Normalform-Vergleich entfernt“ macht diesen Test rot.
- **Handform bleibt, wo nichts geändert wird (Regel 6)**: eingerückte Kommentarzeile innerhalb von `classes`; `PUT` benennt eine Person um → Commit, Diff genau die Zeile der Person, der Abschnitt `classes` samt Kommentar zeichengleich.
- **Reihenfolge im Wortlaut**: Handform in `classes` und in `sources`, beide geändert → 409 nennt `classes`.
- **Sicherung**: `"people":` zitiert → `PUT` 409 mit Wortlaut, kein Commit, Datei zeichengleich. Mutant „Rücklese-Prüfung entfernt“ macht diesen Test rot.
- **Schalter (Regel 7)**: Rücklesen scheitert beim Umschalten (z. B. `"record-transcripts":` zitiert) → 409 mit Wortlaut, `<schluessel>` = `record-transcripts`, kein Commit, Datei zeichengleich (heute `Fehler::Intern`, 500).
- **Legacy**: Kopien der sechs echten `kanbanD.md`; je Datei eine Person umbenennen über `PUT` → Diff = diese Zeile + Block `sources` (alte Form); über `PATCH /api/personen` → Diff = genau eine Zeile. Für `kanbanD-Kanbanboard`: `record-transcripts: true` bleibt die letzte Frontmatter-Zeile (heute rot).
- Zweites `PUT` ohne Änderung: kein Commit.

## Quellen / Bezüge

- `src/dienst/einstellungen.rs:172–195`, `src/format/einstellungen.rs:115–142`, `src/format/board.rs:102–135`, `src/dienst/schalter.rs:55–72`, `src/dienst/einrichten.rs:108–121`, `src/modell/einstellungen.rs:88–97`, `web/app.js:4548` (Stand `d79b70f2`)
- ADR-0036 Nachtrag „Umschalten“ Regel 4–5; ADR-0034 N2; ADR-0031 Regel 1
- po-entscheidungen Z. 492, Z. 665–668; Vision „Git-freundliche Form“, „Die Dateien sind der einzige Speicher“
- Bestand: `~/Projekte/Kanban-Boards/{Entwicklungsprozess,goaltreetoolA,JoinPuyaApp,kanbanD-Demo,kanbanD,localchatA}-*/kanbanD.md` und `git log -p -- kanbanD.md` dort (nur gelesen, 2026-11-23)

## Nachtrag 2026-11-23 N1: Vorschau in „Einrichten“ als Trockenlauf desselben Schreibwegs — `POST /api/einstellungen/vorschau`, entprellt, Stand sichtbar (Karte #248, Nacharbeit 1 von 2)

**Status `Akzeptiert`.** Anlass: Muss M1 des code-reviewer (`#einr-vorschau` baut `kanbanD.md` im Browser aus dem Modell und zeigt bei Datei H nicht das Gespeicherte; R00209 AK 11 wörtlich verletzt). Entschieden hat der product-owner (po-entscheidungen Z. 683): Der Server liefert per Trockenlauf genau den Text, den `einstellungen_aendern` nach den Regeln 5–6 schreiben würde, ohne Datei und ohne Commit; bei 409 zeigt die Vorschau den Wortlaut aus Z. 667. Dieser Nachtrag legt Form, Takt, Gleichlauf, Sicherheit und Proben fest. Die zwei Wortlaute (N1.2) hat der product-owner entschieden (Z. 693–694). Regeln 1–7 bleiben stehen; N1 ergänzt sie um Regel 8.

### N1.1 Form des Aufrufs

| Variante | Stärke | Schwäche |
|---|---|---|
| **A — eigener Pfad `POST /api/einstellungen/vorschau`** (gewählt) | Der Pfad sagt, dass nichts geschrieben wird; die Proben „nichts geschrieben“ hängen an einer Route; Endpunktliste und OpenAPI zeigen ihn als eigenen, nicht schreibenden Aufruf; kein bestehender Aufrufer (Factory `GET`→`PUT`) ändert sich | eine Route mehr, die Rumpf, Fehlerabbildung und Rechte mit `PUT` teilen muss — getragen von N1.3 (eine Dienstfunktion) |
| B — Schalter am `PUT` (`?trocken=ja` oder Header) | keine neue Route, der Rumpf ist offensichtlich derselbe | ein vergessener oder verschluckter Schalter **schreibt** (Proxy, Tippfehler im Parameter, älterer Server ohne den Schalter antwortet 200 und committet); ein `PUT`, das nicht schreibt, widerspricht seiner Bedeutung (RFC 9110 §9.3.4); die Probe „nichts geschrieben“ prüft eine Verzweigung statt einer Route |
| C — `GET /api/einstellungen/vorschau?entwurf=<json>` | lesend schon in der Methode | der Entwurf (Register mit Pfaden, viele Personen) gehört nicht in eine URL (Länge, Server-Log); Abfrageparameter brauchen eine eigene Kodierung des Modells |

**Entscheidung A.** Rumpf genau wie `PUT /api/einstellungen` (`crate::modell::Einstellungen`, derselbe `JsonKoerper`, dieselbe Körpergrenze). `X-KanbanD-Wer` ist **optional** (Endpunktliste `wer: false`, „Lesen braucht keine Identität“): mit Header gelten die Rechte dieser Person wie beim `PUT` (unbekannt oder stillgelegt → 400, Agent ändert Menschen → 403); ohne Header wird wie für einen Menschen gerechnet — „Einrichten“ speichert ohnehin nur als Mensch (`ichNoetig`, `web/app.js:500`).

Antworten (JSON wie alle Antworten der API, `Content-Type: application/json`):

- **200** `{"text": "<ganze Datei>", "geaendert": true|false}` — `text` ist Zeichen für Zeichen der Inhalt, den `PUT` mit demselben Rumpf in diesem Moment schreiben würde, samt BOM und Zeilenenden der Datei; ohne Änderung (`geaendert: false`) der heutige Inhalt der Datei.
- **400** `{fehler}` ungültiger Entwurf (dieselben Texte wie `PUT`, z. B. „Kürzel „x“ ist doppelt“), fehlender oder falscher Rumpf; **403** `PersonenartVerboten {fehler, kuerzel}`; **409** `{fehler}` — Regel 5/6 mit dem Wortlaut aus Z. 667, oder „noch nicht eingerichtet“, oder Personen entfernt; **423** Datei defekt; **500** Dateisystem.
- Statuscode und `fehler` sind immer **dieselben**, die `PUT` mit demselben Rumpf in diesem Moment gäbe.

OpenAPI: eigener Handler `einstellungen_vorschau` mit `#[utoipa::path(post, path = "/api/einstellungen/vorschau", tag = "Ordner", request_body = crate::modell::Einstellungen, …)]`, Antwortschema `Einstellungsvorschau {text: String, geaendert: bool}` (`utoipa::ToSchema`), Antworten 200, 400, 403 (`PersonenartVerboten`), 409, 423, 500 wie bei `PUT`; Header `X-KanbanD-Wer` als optionaler Parameter. Beschreibung (gleich in `src/web/endpunkte.rs`): „Trockenlauf von PUT /api/einstellungen mit demselben Rumpf: {text, geaendert} — text ist genau die Datei kanbanD.md, die PUT jetzt schreiben würde (BOM und Zeilenenden der Datei), ohne Änderung die heutige; dieselben Fehler wie PUT (400, 403, 409 mit dem Wortlaut der Handform, 423); schreibt nichts, kein Commit; X-KanbanD-Wer optional (ohne: gerechnet wie für einen Menschen) (R00250, ADR-0043 N1)“. Die Route steht in `src/web/mod.rs` neben `einstellungen_lesen, einstellungen_setzen`.

### N1.2 Takt und Zustände in der Oberfläche

| Variante | Stärke | Schwäche |
|---|---|---|
| bei jeder Eingabe | immer aktuell | eine Anfrage je Taste, Antworten überholen sich, die Vorschau flackert |
| **entprellt nach Eingabe, sofort nach Klick-Aktionen** (gewählt) | wenige Anfragen, Stand nach der letzten Taste spätestens nach Entprellzeit plus Antwort | dazwischen ist die Vorschau kurz veraltet — wird als „wartet“ gekennzeichnet |
| bei Verlassen des Feldes | kaum Anfragen | während des Tippens dauerhaft veraltet; wer nach der letzten Eingabe auf die Vorschau schaut, sieht den alten Stand (AK 11 „vor dem Speichern“) |

**Entscheidung: entprellt.**

1. **Ein Anstoß** `vorschauAnfordern(sofort)` in `web/app.js`. Eingaben (`input` in „Einrichten“) stoßen mit **250 ms** Entprellung an; Aktionen, die den Entwurf per Klick ändern (Person, Klasse, Signal, Anwendung anlegen/entfernen, Farbe, Reihenfolge, „Verwerfen“), stoßen ohne Wartezeit an. Außerdem: beim Öffnen von „Einrichten“, nach jedem beendeten „Speichern“ (Erfolg wie Fehler) und nach jedem Nachladen von `S.zustand`, solange „Einrichten“ offen ist (eine fremde Änderung an `kanbanD.md` ändert den Trockenlauf).
2. **Nur die jüngste Antwort zählt**: jede Anfrage trägt eine laufende Nummer; eine Antwort wird nur übernommen, wenn ihre Nummer die zuletzt vergebene ist und „Einrichten“ noch offen ist. Höchstens eine Anfrage ist unterwegs; was während einer laufenden Anfrage angestoßen wird, geht nach deren Ende einmal los (letzter Stand). Die Vorschau läuft **nicht** durch `durchDieSchlange` (sie schreibt nicht und darf „Speichern“ nicht aufhalten).
3. **Zustände** am Element `#einr-vorschau` als `data-stand`:
   - `aktuell` — `text` der Antwort steht im `pre`, unverändert (`textContent`; BOM und `\r` bleiben, sind unsichtbar).
   - `wartet` — ab dem Anstoß bis zur Antwort: der letzte Text bleibt stehen, `aria-busy="true"`; erst wenn die Antwort länger als 400 ms ausbleibt, wird der Text gedämpft und die Statuszeile `#einr-vorschau-stand` zeigt „Vorschau wird aktualisiert …“ (PO Z. 693; kein Flackern beim Tippen). Vor der ersten Antwort ist das `pre` leer und die Statuszeile zeigt dasselbe.
   - `verweigert` — Antwort 4xx (400, 403, 409, 423): das `pre` zeigt statt eines Dateitexts wörtlich das `fehler` der Antwort, das „Speichern“ in `#einr-fehler` zeigen würde (bei Handform wörtlich Z. 667), ohne eigenen Vorsatz (PO Z. 694). Ein kurzzeitig ungültiger Entwurf beim Tippen (z. B. Kürzel doppelt) zeigt den Fehler nach der Entprellung.
   - `fehler` — keine Antwort oder 5xx: der letzte Text bleibt gedämpft stehen, die Statuszeile `#einr-vorschau-stand` (gedämpft, kein Fehlerrot) zeigt (PO Z. 693, wörtlich):
     - keine Antwort (Netz, Frist von `api`): „Vorschau nicht aktuell — keine Antwort vom Server.“
     - Antwort 5xx: „Vorschau nicht aktuell: <fehler der Antwort | Fehler im Server> (<Status>).“ — `fehler` der Antwort, fehlt es, „Fehler im Server“; dahinter der Status.
     Es gibt **keinen** Rückfall auf einen Nachbau im Browser — der wäre die zweite Schreibregel, die M1 beseitigt.
   „Speichern“ bleibt in jedem Zustand bedienbar; die Vorschau sperrt nichts. Die Statuszeile ist `role="status"`; das `pre` ist keine Live-Region (keine Ansage je Taste).
4. **`einstellungenText` nur noch für eine neue Datei**: Die Vorschau „Erster Start“ (`#vorschau-einstellungen`) baut weiter im Browser — dort schreibt der Server mit `einstellungen::schreiben` neu (`einrichten`, Regel 2), also ist der Nachbau dort die richtige Regel. `#einr-vorschau` wird nie mehr aus `einstellungenText` gesetzt (`web/ansicht.js:2211`, `web/app.js:5103`); der Parameter `schalter` und `S.transkripteVorgabe` entfallen dort. Der Vergleich „weitergetippt“ in `einr-ok` (`web/app.js:4703/4711`) darf `einstellungenText` als Fingerabdruck des Entwurfs behalten.

### N1.3 Ein Schreibweg, Trockenlauf ohne den letzten Schritt (Regel 8)

8. **Trockenlauf und Speichern teilen alles bis auf `aktion`.** `einstellungen_aendern` (`src/dienst/einstellungen.rs:172`) wird geteilt in
   - `einstellungen_entwerfen(&self, _sperre: &MutexGuard<'_, ()>, art: Art, altform, aendern) -> Result<Entwurf<T>, Fehler>` — Modell lesen, `aendern`, `normalisieren`, `einstellungen_pruefen`, `personen_pruefen`, Vergleich mit `vergleich`, Text lesen, `abschnitte_schreiben` (Regeln 3–6, mit den Nacharbeiten S1/S2 dieser Karte). `Entwurf` trägt `datei: Option<String>` (`None` = keine Änderung), den bisherigen `text`, `nachricht` und `ergebnis`. Die Sperre ist Parameter, damit der Aufruf nur unter ihr möglich ist; die Funktion schreibt nichts, merkt nichts vor (`eigene.merken`) und ruft weder `aktion` noch Git.
   - `einstellungen_aendern` = `gesperrt()` → `einstellungen_entwerfen` → bei `Some(datei)` `aktion(… Schritt::schreiben(DATEI, datei))`.
   - `einstellungen_vorschau(&self, art: Art, neu: Einstellungen) -> Result<Einstellungsvorschau, Fehler>` = `gesperrt()` → `einstellungen_entwerfen` mit `Altform::Umstellen` und **derselben** Änderungsfunktion wie `einstellungen_setzen` → Sperre fallen lassen → `text = datei.unwrap_or(text)`, `geaendert = datei.is_some()`.
   - Die Änderungsfunktion des `PUT` (Schalter aus der Datei, Rest aus dem Rumpf, `src/dienst/einstellungen.rs:196–198`) wird **eine** benannte Funktion, die `einstellungen_setzen` und `einstellungen_vorschau` aufrufen; zwei Abschriften der Closure sind verboten.
   - `abschnitte_schreiben` hat genau einen Aufrufer: `einstellungen_entwerfen` (neben `einstellungen::schreiben` nur aus `einrichten`, R00250 AK 10). Review-Punkt für den architektur-reviewer.
   - Gesichert durch den Gleichlauf-Test (Probe V5): für jeden Bestand der Matrix `vorschau(x)` und danach `PUT(x)` → bei 200 `text` byte-gleich mit der Datei danach, bei Fehler gleicher Status und gleiches `fehler`.

### N1.4 Sicherheit

- **Schreibt nichts**: kein `ordner.schreib`, keine Temporärdatei (`*.kanbanD-tmp`), kein `create_dir_all`, kein Commit, kein `eigene.merken` (sonst verschluckte der Wächter das nächste echte Ereignis). Folge: kein Live-Ereignis, kein Nachladen in anderen Fenstern.
- **Sperre nur für Lesen und Rechnen**: gehalten wird sie für zwei Lesezugriffe auf `kanbanD.md` (Modell und Text) und das reine Rechnen auf diesem Text; sie fällt vor dem Serialisieren der Antwort. Kein Git, kein Netz, kein weiterer Dateizugriff unter ihr. Die Entprellung (N1.2) hält die Zahl der Anfragen klein; jede Anfrage läuft über `blockierend` wie `PUT`.
- **Nur `kanbanD.md` wird gelesen**: der Pfad ist die Konstante `einstellungen::DATEI` relativ zur Ordnerwurzel; nichts aus dem Rumpf wird zu einem Pfad. Pfade im Rumpf (`quellen.repository`, `anwendungen[].repository`) sind nur Text — weder `normalisieren`, `repository_ergaenzen` noch die Prüfungen greifen auf sie zu (`src/modell/einstellungen.rs:119–131`: „kein Dateizugriff“); „erreichbar“ prüft weiter nur `GET`. Eine künftige Prüfung mit Dateizugriff in `einstellungen_pruefen` würde den Trockenlauf mittreffen — das ist ein Review-Punkt, kein neuer Weg.
- **Offenlegung**: `text` enthält die Datei samt Kommentaren und Textkörper. Neu ist das nicht: dieselbe Datei liegt im Git des Ordners, und die API liest Commits und Diffs dieses Ordners schon heute ohne Identität.

### N1.5 Prüfliste für den entwickler

Datei H wie R00250 „Ausgangslage“; „Vergleich in der Oberfläche“ heißt: BOM entfernt, `\r\n` → `\n`, dann gleich. Jede Oberflächenprobe liest `#einr-vorschau` erst bei `data-stand="aktuell"` (bzw. `verweigert`).

| # | Probe | Erwartet | heute |
|---|---|---|---|
| V1 | **Abnahme des PO**: H in „Einrichten“, `sh` → „Sven Hansen“, warten auf `aktuell`, Text lesen, „Speichern“ | Text vor dem Speichern = `kanbanD.md` nach dem Speichern (Vergleich in der Oberfläche); er enthält `# von Hand`, `eigener-schluessel: 1`, `# Klassen folgen`, `# Unser Ordner`, nicht `# kanbanD` | rot (`crev-248/vorschau.js`) |
| V2 | V1 mit H in CRLF und BOM; dazu über HTTP `POST …/vorschau` | Oberfläche wie V1; über HTTP ist `text` byte-gleich mit der Datei nach `PUT` (BOM und `\r\n` erhalten) | rot |
| V3 | R00209 AK 9/10/11: Register in alter Form (`kd: {name, wbs, requirements}`), Repository ändern bzw. WBS leeren | Vorschau zeigt `sources` mit `repository`, gleich der Datei nach dem Speichern; R00209-Specs grün | grün im Bestand, bleibt grün |
| V4 | **Handform**: H mit `  # Vertretung` in `people`, `sh` umbenennen. Variante „Kürzel doppelt“ (PO Z. 694): auf H eine zweite Person mit Kürzel `sh` im Entwurf | `data-stand="verweigert"`, `#einr-vorschau` = „Nicht gespeichert: Der Abschnitt „people“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.“; „Speichern“ → derselbe Text in `#einr-fehler`, kein Commit, Datei zeichengleich. Variante: `verweigert`, Text = `fehler` von `PUT` mit demselben Rumpf (400) | rot (Vorschau zeigt Dateitext) |
| V5 | **Gleichlauf** (Rust, Dienst und HTTP): Matrix H, H CRLF+BOM, gemischte Zeilenenden (S1), `signals: {}` + erstes Signal (S2), Handform in `people`, Handform in `classes` mit Änderung an `sh`, sechs Bestände aus `tests/altbestaende/`, Entwurf ohne Änderung, ungültiger Entwurf (Kürzel doppelt) — je Fall `vorschau` dann `PUT` mit demselben Rumpf | 200: `text` byte-gleich mit der Datei nach `PUT`, `geaendert` = es gab einen Commit; sonst gleicher Status und gleiches `fehler`. Mutant „Vorschau baut mit `einstellungen::schreiben`“ und Mutant „Vorschau mit `Altform::Stehenlassen`“ machen den Test rot | — (neu) |
| V6 | Ohne Änderung: `POST …/vorschau` mit dem Rumpf aus `GET /api/einstellungen` auf H (Register in neuer Form) | 200, `geaendert: false`, `text` = Datei byte-gleich | — |
| V7 | **Schreibt nichts**: 20 × `POST …/vorschau` mit Änderung, Handform und ungültigem Rumpf auf H | `HEAD` unverändert, `git status --porcelain` leer, Bytes und `mtime` von `kanbanD.md` gleich, keine `*.kanbanD-tmp`, keine Wächter-Meldung an ein offenes Fenster (kein Nachladen). Mutant „Vorschau ruft `aktion`“ rot | — |
| V8 | Rechte: Header `ag` (Agent), Entwurf ändert Mensch `sh`; ohne Header; Header unbekannt | 403 `{fehler, kuerzel}` wie `PUT`; ohne Header 200; unbekannt 400 wie `PUT` | — |
| V9 | Pfade: `quellen.repository` = `/etc`, `../../x` und ein FIFO im Testordner | 200 in normaler Zeit (ein Öffnen des FIFO bliebe hängen), kein Zugriff außer `kanbanD.md` | — |
| V10 | Takt (E2E, `page.route` zählt): fünf Zeichen schnell tippen | höchstens 2 Anfragen; die übernommene Vorschau trägt den letzten Stand | — |
| V11 | Verzögerter Fake: erste Antwort 1 s verzögert, zweite sofort | Endstand = zweite Antwort; während des Wartens `data-stand="wartet"`, `aria-busy="true"`, alter Text steht; nach > 400 ms Statuszeile „Vorschau wird aktualisiert …“ | — |
| V12 | Server antwortet nicht (`route.abort`); Variante 5xx (`route.fulfill` mit 500 `{fehler: "x"}` und mit 503 ohne `fehler`) | `data-stand="fehler"`, alter Text gedämpft, „Speichern“ bedienbar; Statuszeile wörtlich nach N1.2 (PO Z. 693): „Vorschau nicht aktuell — keine Antwort vom Server.“ bzw. „Vorschau nicht aktuell: x (500).“ und „Vorschau nicht aktuell: Fehler im Server (503).“ | — |
| V13 | Klick-Aktion (Person anlegen) ohne Tastatureingabe; danach „Speichern“ | Vorschau aktualisiert sich ohne `input`; nach dem Speichern `aktuell` und = neue Datei | — |
| V14 | Erster Start, OpenAPI, Endpunkte | `#vorschau-einstellungen` wie bisher (R00002-Spec grün); `/api/openapi.json` enthält `post` an `/api/einstellungen/vorschau` mit Schema `Einstellungsvorschau`; `/api/endpunkte` nennt ihn mit `wer: false`; Vollständigkeitstest der Endpunktliste grün | — |
| V15 | Bestehende Specs mit `#einr-vorschau` (R00010, R00053, R00076, R00209, R00222) | warten vor jeder Prüfung auf `data-stand="aktuell"`; `not.toContainText` erst danach | — |

### N1 Konsequenzen

- **Positiv**: Vorschau und Datei können nicht auseinanderlaufen, weil es nur noch eine Schreibregel gibt; die 409 ist vor dem Klick sichtbar; der Nachbau im Browser für „Einrichten“ entfällt.
- **Inkauf**: Die Vorschau braucht den Server und ist nach jeder Eingabe bis zu 250 ms plus Antwortzeit veraltet (gekennzeichnet). Eine Änderung an `kanbanD.md` von außen kommt erst mit dem Nachladen in die Vorschau. Eine Route mehr.
- **Lastprofil**: eine Anfrage je Pause beim Tippen, je kleine Datei, Sperre nur für Lesen und Rechnen.

### N1 Folgeaufgaben

- [ ] entwickler (#248, Nacharbeit): N1.1–N1.4, Prüfliste N1.5
- [x] product-owner: Fragen 1 und 2 (Wortlaute) — PO Z. 693–694, in N1.2 Punkt 3, V4 und V12 nachgezogen
- [ ] nach dem Bau: A00003 (Route), A00004 (`einstellungen_entwerfen`), A00009 (Vorschau aus dem Server) von Soll auf Ist
