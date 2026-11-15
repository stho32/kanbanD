# ADR-0003: Abweisungen mit strukturiertem Rumpf — eigene Fehlerarten für Grenze (409) und Eigentümer (403)

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00096, R00097
**Nachträge**: 2026-11-13 — Abweisungen des Rahmens in derselben Form: ein eigener Extraktor statt 422-Klartext (Karte #39), siehe [Nachtrag N1](#nachtrag-2026-11-13-n1-formfehler-des-rahmens-in-derselben-form-karte-39) · 2026-11-13 — Ordnung der Abweisungen, wenn mehrere zugleich zutreffen: **423 vor 403 vor 409**, einheitlich für Board und Aufgabe (Karte #121), siehe [Nachtrag N2](#nachtrag-2026-11-13-n2-ordnung-der-abweisungen--423-vor-403-vor-409-karte-121). · 2026-11-15 — Status je Abweisungsart des Rahmens: Inhalt **400**, fehlender Content-Type **415**, zu großer Rumpf **413**, alle mit `{fehler}`; Zählung 36 Handler (Karte #39), siehe [Nachtrag N3](#nachtrag-2026-11-15-n3-status-je-abweisungsart-des-rahmens-und-umfang-karte-39). Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert.
**Erprobt durch**: —
**Ergänzt durch**: [ADR-0006](0006-einstellung-verboten-als-dritte-abweisung.md) (dritte Variante `EinstellungVerboten`, 403, R00102)

## Kontext

`Fehler` (`src/fehler.rs`) kennt fünf Arten mit je einem Text; die Web-Schicht macht daraus `{fehler: <text>}` (`src/web/mod.rs`, `IntoResponse`). R00096 verlangt `409 {fehler: "Grenze erreicht", spalte, grenze, anzahl}`, R00097 `403 {fehler: "Spalte „…“ gehört dem Menschen", spalte, nummer}`. 403 gibt es bisher nicht. Agenten sollen auf die Felder reagieren, ohne den Text zu parsen.

## Optionen

### Option A: Fachlich benannte Varianten mit Feldern
- `Fehler::GrenzeErreicht { spalte, grenze, anzahl }` → 409, `Fehler::Verboten { meldung, spalte, nummer }` → 403; `IntoResponse` fügt die Felder an `fehler` an.
- Vorteile: typisiert, der Compiler zwingt jede `match`-Stelle zur Entscheidung; Tests vergleichen Varianten statt Texte.
- Nachteile: je neuer strukturierter Abweisung eine Variante.

### Option B: allgemeine Zusatzfelder an jeder Art (`Konflikt(String, Map)`)
- Vorteile: eine Erweiterung für alles Künftige.
- Nachteile: untypisiert (`serde_json` im Fehlertyp der Dienste), alle bestehenden Konstruktoren ändern sich, Feldnamen nur per Konvention.

### Option C: Text bleibt, Felder im Header oder als eigener Antworttyp der Web-Schicht
- Vorteile: `Fehler` unverändert.
- Nachteile: die Web-Schicht müsste fachliche Felder kennen oder den Text parsen; widerspricht der Form, die R00096/R00097 vorgeben.

## Entscheidung

**Gewählt: Option A**

Zwei Abweisungen mit fester Form rechtfertigen zwei Varianten; der Typ bleibt frei von JSON. Die „Schlüssel mehrfach vergeben“-Abweisung aus R00098 bleibt `Konflikt(String)`, weil sie keine Felder verlangt.

## Konsequenzen

**Positiv:**
- `meldung()` bleibt; der Rumpf behält `fehler` als erstes Feld, Oberfläche und bestehende Clients lesen weiter nur `fehler`.

**Negativ / Inkauf zu nehmen:**
- Jede erschöpfende `match`-Stelle über `Fehler` wird angepasst; OpenAPI (`src/web/openapi.rs`) beschreibt beide Rümpfe zusätzlich.

**Folgeentscheidungen / Aufgaben:**
- [ ] Wird ADR-0001 (Logging) angenommen: beide Varianten als Warning protokollieren.

## Nachtrag 2026-11-13 N1: Formfehler des Rahmens in derselben Form (Karte #39)

**Anlass**: Karte #39 („Typfehler im Rumpf ergeben 422 Klartext statt 400 `{fehler}`", Anmerkung A1 aus dem Entwicklertest von #27). Der Text oben entscheidet, **welche** Form eine Abweisung hat (400 mit `{fehler}`, 409 mit Feldern, 403 mit Feldern), aber nicht, **woher** eine Abweisung kommt. Der Rahmen (Axum) weist einen Rumpf mit falschem JSON-Typ ab, bevor ein Handler ihn sieht, und zwar mit **422** und `text/plain`. ADR-0003 gilt damit für jede Fachprüfung und für keinen Formfehler — die Regel hat ein Loch, durch das jeder Endpunkt fällt. Der Status bleibt `Akzeptiert`; der Nachtrag schließt das Loch, er ändert keine der oben entschiedenen Formen.

**Belegt (Code)**, kanbanD `cc9e553` (gelesen 2026-11-13):
- Jeder schreibende Endpunkt nimmt den Rumpf als `Json<T>` (`src/web/mod.rs:20` Import; z. B. `aufgabe_anlegen` `:374`, `bewegen` `:392`, `board_aendern` `:302`). Die Abweisung des Extraktors entsteht **vor** dem Handler; `Fehler` ist daran nicht beteiligt.
- `impl IntoResponse for Fehler` bildet die Formen oben ab (`:152–181`): `Ungueltig` → 400 mit `{"fehler": …}` (`:180`).
- `serde_path_to_error` liegt bereits im Baum (über `axum 0.8`, `Cargo.lock:945`); eine direkte Nutzung ist eine Zeile in `Cargo.toml` und **keine neue Abhängigkeit**.
- Die Liste der Endpunkte, über die die Probe laufen muss, steht gepflegt in `src/web/endpunkte.rs`.

### Entschieden

1. **Ein Formfehler ist ein Formfehler.** Jede Abweisung des Rahmens — kaputtes JSON, falscher Typ, fehlendes Pflichtfeld — geht durch **einen** eigenen Extraktor (`JsonKoerper<T>`, ein Modul unter `src/web/`) und wird zu `Fehler::Ungueltig` → **400**, `Content-Type: application/json`, Rumpf `{"fehler": "…"}`. Kein Handler fängt sie einzeln.
2. **Die Meldung nennt das Feld.** Der Feldpfad kommt aus `serde_path_to_error` (etwa `grenze`), die Meldung ist deutsch und übernimmt den Rahmen-Text nicht wörtlich. Damit kann ein Agent reagieren, ohne zu raten — derselbe Grund, aus dem R00096/R00097 Felder verlangen.
3. **Pfad und Query tragen dieselbe Form.** `Path`/`Query`-Abweisungen (etwa `{nr}` = `abc`) sind derselbe Fall und laufen über dieselbe Stelle; die Umsetzung darf mit dem Rumpf beginnen, der Rest folgt im selben Zug.
4. **Kein Commit bei einer Abweisung** — das ist heute schon so (die Prüfung liegt vor `aktion()`), die Probe hält es fest.

**Verworfen**:
- **Je Handler `Result<Json<T>, JsonRejection>`** (oder `WithRejection` an jeder Route): dieselbe Form an 20 Stellen, vergessbar, und der nächste Endpunkt fällt wieder durch — genau die Schwäche, wegen der ADR-0003 Option A typisierte Varianten statt allgemeiner Felder gewählt hat.
- **Ein Layer, der 422-Antworten nachträglich auf 400 umschreibt**: müsste den Rahmen-Text parsen oder ersetzen, kennt den Feldpfad nicht und wäre ein zweiter Antwortweg neben `IntoResponse for Fehler` (ADR-0003 Option C, dort schon verworfen).
- **Nur den Status ändern, Text lassen**: `text/plain` bleibt, der Feldname fehlt, die Oberfläche kann die Meldung nicht am Feld anzeigen (R00111-Muster `aria-invalid`/`aria-describedby`).
- **Titel/Steuerzeichen am Eingang abweisen** (verwandt, aber #43): nicht hier — #43 entscheidet über die Commit-Nachricht, nicht über den Rumpf.

### Durchsetzung (Fitness-Funktion)

- **Probe über alle schreibenden Endpunkte**: Liste aus `src/web/endpunkte.rs` (Methode ≠ GET) abgleichen, je Endpunkt einen Rumpf mit falschem Typ senden → 400, `content-type: application/json`, `fehler` nennt den Feldpfad, und `git log` bleibt unverändert. Eine Mutante (ein Endpunkt ohne den Extraktor) muss rot werden, sonst ist die Liste unvollständig.
- **Unit** im Extraktor: kaputtes JSON, falscher Typ, fehlendes Pflichtfeld, falscher Typ in einem verschachtelten Feld — je 400 mit Pfad.
- **Review-Punkt für `code-reviewer`**: `Json<…>` statt `JsonKoerper<…>` an einem schreibenden Endpunkt ist ein Befund; ebenso eine Abweisung, die den Rahmen-Text ungefiltert weitergibt.

**Grenze**: Wortlaut der Meldungen und die genaue Form des Feldpfads (`grenze` gegen `rumpf.grenze`) sind Sache des `entwickler`; ob die Probe als eigener Test oder in `tests/` je Endpunkt läuft, entscheidet die Planung. Die Statuscodes der Fachprüfungen (409, 403, 423) bleiben unberührt. *(→ N2: treffen mehrere von ihnen in derselben Anfrage zu, entscheidet Nachtrag N2 ihre Reihenfolge)*

## Nachtrag 2026-11-13 N2: Ordnung der Abweisungen — 423 vor 403 vor 409 (Karte #121)

**Status bleibt `Akzeptiert`.** Der Nachtrag legt fest, **in welcher Reihenfolge** die Abweisungen dieses ADR stehen, wenn in derselben Anfrage mehrere zugleich zutreffen. Er ändert keine der oben entschiedenen Rümpfe und keinen Statuscode; er beantwortet die Frage, die der Text oben offen lässt. Anlass ist Karte #121 (Entwicklertest aus #26/R00120, Architektur-Befund arev B3: „die Ordnung ‚403 vor 423' ist an keiner Modell-/Aspektstelle festgehalten“) und die Betreiber-Entscheidung vom 2026-11-13 im Kartenkommentar: „Der defekte Ordner macht jede Aussage über Sperren unsicher: **423 vor 403 vor 409**, einheitlich für Board und Aufgabe (R00120 AK 6 bleibt wörtlich).“

**R00120 AK 6, wörtlich** (bleibt unverändert): „Board-Datei mit Formatfehler im Ordner, Karte auf einem anderen Board in einer Menschen-Spalte → `POST /api/aufgaben/{nr}/archivieren` als Agent ergibt **423** `Fehler::Defekt` (Meldung „`boards/<slug>.md: <Grund> — nur lesbar, bis die Datei repariert ist`“; bei mehreren defekten Boards das erste der Boardliste), kein Commit; als Mensch wie heute erlaubt (PO Z. 188).“ Der Satz ist der Grund für diesen Nachtrag: er beschreibt genau den Fall, in dem heute 403 kommt.

**Belegt (Code)**, kanbanD `ad8ee18` (gelesen 2026-11-13):
- `Kanban::archivieren_pruefen` (`src/dienst/zugregeln.rs:88–96`) liest die Boardliste, prüft **zuerst** die Entnahmesperre auf den lesbaren Boards (`entnahme_pruefen`, `:93` — 403 möglich) und **danach** die Defekte-Liste (`:94–95` — 423). Der Kommentar darüber sagt es selbst: „eine Sperre der lesbaren Boards (403) geht vor“ (`:89–90`). Nach AK 6 ist das falsch herum: eine Karte in einer lesbaren Menschen-Spalte ergibt heute **403**, erwartet ist **423**.
- Drei Aufrufer hängen an diesem einen Helfer: `archivieren` (`src/dienst/archiv.rs:14`), `endgueltig_loeschen` (`:51`), Archivieren mehrerer (`:134`). Der Fehler steckt damit in der ganzen Archiv-Familie.
- Die **Board-Wege** haben die Ordnung schon: `board_aendern` und `board_loeschen` lesen zuerst `Ordner::board(slug)` (`src/dienst/board_verwalten.rs:27`, `:59`; defekt → 423) und prüfen danach `board_entnahme_pruefen` (403).
- 403 vor 409 ist gebaut und getestet: `entnahme_und_zug_pruefen` (`src/dienst/zugregeln.rs:66–69`), Test `:240–249`.
- `Fehler::Defekt` ist 423 (`src/web/mod.rs:158`), Rumpf `{fehler}` nach dem Text oben.

### Entschieden

1. **Die Ordnung.** Treffen in derselben Anfrage mehrere Sperr-Abweisungen zu, gilt **423 → 403 → 409**: erst der Defekt (`Fehler::Defekt`), dann die Eigentümer-Sperre (`Fehler::Verboten` an den Zug-Endpunkten und `Fehler::EinstellungVerboten` an `PUT …/spalten` nach [ADR-0006](0006-einstellung-verboten-als-dritte-abweisung.md) — beide 403), dann die WIP-Grenze (`Fehler::GrenzeErreicht`). Einheitlich für Board-Wege und Aufgaben-Wege; kein Weg hat eine eigene Ordnung.
2. **Warum der Defekt vorn steht.** Nicht „die spezifischere Regel gewinnt“, sondern das Gegenteil: solange eine Board-Datei des Ordners unlesbar ist, ist **jede** Aussage über Sperren in diesem Ordner unsicher — auch die über die lesbaren Boards. Die Karte kann in der defekten Datei in einer Menschen-Spalte liegen; die 403 der lesbaren Boards wäre dann eine Antwort auf eine Lage, die sie nicht kennt. 423 sagt genau das, was gilt: „ich kann es nicht sagen“. 403 und 409 setzen eine bekannte Lage voraus.
3. **Was der 423-Fall trägt.** Die Meldung nennt die defekte Datei (erstes defektes Board der Boardliste), nicht Karte oder Spalte — die sind nicht bestimmbar. Die 403 der Menschen-Spalte entfällt in diesem Fall und kommt, sobald der Ordner repariert ist. Kein Commit (die Prüfung liegt vor `aktion()`).
4. **Der Mensch bleibt durchgelassen** (PO Z. 188) — die Ordnung betrifft nur Abweisungen; für den Menschen entstehen 403 und 423 ohnehin nicht.
5. **Die Ordnung ist eine Aussage über die Prüf-Reihenfolge im Code**, nicht nur über die Dokumentation: `archivieren_pruefen` prüft künftig **zuerst** die Defekte-Liste und erst danach die Entnahmesperre der lesbaren Boards (Soll). Der Bau ist nicht Teil dieses Nachtrags (Welle 2, Zug 2c, `src/dienst/zugregeln.rs`/`archiv.rs`, Kartenkommentar #121; hängt mit #142 zusammen).

**Verworfen**:
- **403 vor 423** (heute): die spezifischere Sperre vor der unsicheren — erklärt eine Lage für bekannt, die es nicht ist; AK 6 bliebe dauerhaft rot.
- **Je Weg eine eigene Ordnung** (Archiv 403 zuerst, Board 423 zuerst): genau der Zustand von heute, in dem dieselbe Ursache auf zwei Wegen zwei Codes hat — dieselbe Schwäche, die R00120 Punkt 2 schon für 409 gegen 423 verworfen hat („machte dieselbe Ursache auf dem Archivweg zu einem anderen Code als auf den Wegen, die einen Slug nennen“).
- **423 nur auf dem Archivweg, sonst 403**: macht die Ordnung von der Endpunktliste abhängig statt von der Lage.

### Durchsetzung (Probe)

- **Integration, Abnahme-Probe der Karte #121**: Wegwerf-Ordner, ein Board mit Formatfehler, dazu ein lesbares Board mit Spalte „Eingang“ (`column-owner: human`) und #1 darin; Agent ruft `POST /api/aufgaben/1/archivieren` → **423** `Fehler::Defekt` mit der Meldung der defekten Datei, kein Commit. Heute: 403 (rot). Dieselbe Probe für `DELETE /api/aufgaben/1` (endgültig löschen) und für das Archivieren mehrerer Nummern.
- **Mutante**: die beiden Prüfungen in `archivieren_pruefen` getauscht (Defekt nach der Entnahme) → Probe rot. Eine Fassung, die den Defekt ganz überspringt, ist ebenfalls rot — und fällt zusätzlich in die Abweichung B0537 des Zurückholens.
- **Regression Board-Wege**: dieselbe Lage, `PATCH /api/boards/<slug>` mit `{archiviert: true}` bzw. `DELETE /api/boards/<slug>` → 423 (heute schon grün). Die Ordnung darf dort nicht kippen.
- **Regression 403 vor 409**: der Test `zugregeln.rs:240–249` bleibt grün; diese Ordnung ändert sich nicht.
- **Review-Punkt für `architektur-reviewer` und `code-reviewer`**: ein Weg, der Defekt **und** 403/409 entdecken kann und die 403/409 zuerst meldet, ist ein Befund; ebenso eine zweite, eigene Reihenfolge neben `archivieren_pruefen`.

### Grenze

- **Rümpfe und Codes unverändert**: 423 `{fehler}`, 403 `{fehler, spalte, nummer}`, 409 `{fehler, spalte, grenze, anzahl}` (Text oben, ADR-0006 für `EinstellungVerboten`). Kein neuer Code, keine vierte Variante.
- **400 bleibt vorn.** Ein Formfehler (Nachtrag N1) entsteht im Extraktor, bevor ein Dienst den Ordner liest; er ist keine Sperre. 404 und 500 ebenso.
- **Ein 409, der keine Sperre ist, liegt außerhalb der Ordnung** — etwa „#n ist schon archiviert“ (`src/dienst/archiv.rs:12`), das in der Aufgabendatei gelesen wird und heute zuerst kommt. Ob das je ein Befund wird, entscheidet eine eigene Karte, nicht dieser Nachtrag.
- **Ein Weg, der die Boardliste nicht liest, kann kein 423 liefern** — die Ordnung sagt nichts über ihn. Ob mehr Wege die Liste lesen sollen (Verwandtschaft zu B0537 beim Zurückholen), ist #142 bzw. eine eigene Karte.
- **Der `spalte`-Wert der board-weiten 403** bleibt wie in R00120 notiert (Rohschlüssel, sonst leer; gebaut: leer, `zugregeln.rs:44`); die 423 trägt kein `spalte`.
- **Der Bau ist nicht Teil des Nachtrags** (Welle 2, Zug 2c, `src/dienst/zugregeln.rs`/`archiv.rs`, Kartenkommentar #121; hängt mit #142 zusammen).

## Nachtrag 2026-11-15 N3: Status je Abweisungsart des Rahmens und Umfang (Karte #39)

**Status bleibt `Akzeptiert`.** N1 entscheidet die eine Stelle (`JsonKoerper<T>`) und nennt drei Abweisungen des Inhalts. Offen blieb, was mit den beiden Abweisungen des Transports geschieht, und die Zahl „20 Stellen“ in N1 stimmt nicht mehr. N3 ändert nichts an N1, es füllt diese zwei Lücken.

**Belegt (Code)**, kanbanD `e89e1a1` (gelesen 2026-11-15):
- `axum 0.8.9` (`Cargo.lock:36`); `JsonRejection` kennt vier Arten: `JsonDataError` (heute 422, Klartext), `JsonSyntaxError` (heute 400, Klartext), `MissingJsonContentType` (415, Klartext), `BytesRejection` (413 bei überschrittener Grenze, Klartext). Die Grenze ist 50 MiB (`src/web/mod.rs:120`).
- **36 Handler** nehmen `Json<T>` (`src/web/mod.rs:244`–`:1639`), nicht 20. Fünf weitere lesen den Rumpf als `Bytes`: `ziehen` (`:1197`) antwortet bei Formfehlern schon mit 400 `{fehler}`; `timer_stoppen` (`:1025`), `wbs_verwerfen` (`:1330`), `reservieren` und `freigeben` (`:215`) behandeln einen fehlenden oder unlesbaren Rumpf mit Absicht als „nichts angegeben“.
- `tests/termine.rs:31` hält das alte Verhalten fest (`assert_eq!(…, 422)` für den unbekannten Schlüssel `linie`).
- OpenAPI nennt an jedem Endpunkt 400 mit `Fehlerantwort` und nirgends 422 (`src/web/mod.rs:229` ff.); 415 und 413 sind nicht beschrieben.
- Kein Client wertet 422 aus: die Oberfläche liest `json.fehler`, sonst `statusText` (`web/app.js:100`), und unterscheidet nur 400, 404, 409, 423; das Factory-Werkzeug `kanband.py` reicht Code und Text nur in die Fehlermeldung durch.

### Entschieden

1. **Inhalt ist 400.** `JsonDataError` (falscher Typ, fehlendes Pflichtfeld, unbekannter Schlüssel bei `deny_unknown_fields`) und `JsonSyntaxError` werden `Fehler::Ungueltig` → 400 mit Feldpfad, wie N1.
2. **Transport behält seinen Code, bekommt aber die Form.** Fehlender oder falscher `Content-Type` bleibt **415**, ein Rumpf über der Grenze bleibt **413** — beide mit `Content-Type: application/json` und `{"fehler": "…"}` auf Deutsch. Ein Agent reagiert darauf anders als auf ein falsches Feld (Kopfzeile setzen, Anhang verkleinern); 400 würde das verdecken. Ein Lesefehler des Rumpfs ohne Grenzbezug ist 400.
3. **`Fehler` bleibt frei von Transport.** 415 und 413 werden keine Varianten von `Fehler` (`src/fehler.rs`); die Abweisung des Extraktors ist ein Typ der Web-Schicht und baut den Rumpf mit derselben Funktion wie `IntoResponse for Fehler`. **In Kauf genommen**: zwei Statuscodes entstehen außerhalb von `Fehler`; das ist vertretbar, weil kein Dienst sie je erzeugen kann.
4. **Umfang der Karte**: alle 36 `Json<T>`-Handler wechseln auf `JsonKoerper<T>`. Die roh angenommenen Felder (`cost`, `estimate`, `index`, `position`, `erledigt`, `datums_trenner` — ADR-0009, ADR-0017, ADR-0023) bleiben roh: ihre Meldungen sind fachlich und schon 400. Die fünf `Bytes`-Handler bleiben, wie sie sind. `tests/termine.rs:31` wird auf 400 umgestellt — das ist die Regression, die das neue Verhalten festhält.
5. **Der beschriebene Kontrakt ändert sich nicht.** 400 mit `Fehlerantwort` steht schon an jedem Endpunkt; der Code holt die Beschreibung ein. 415 und 413 müssen nicht in OpenAPI nachgetragen werden.

**Verworfen**:
- **Alles 400** (auch 415/413): eine Abbildung, eine Variante — aber „zu groß“ und „Feld falsch“ wären nicht mehr unterscheidbar, und ein bisher richtiger Code würde ohne Anlass geändert.
- **`Fehler::NichtUnterstuetzt` / `Fehler::ZuGross`**: einheitlicher Antwortweg, aber jede erschöpfende `match`-Stelle der Dienste müsste zwei Arten behandeln, die dort nie vorkommen.

### Durchsetzung

Zur Probe aus N1 kommen zwei Fälle je einmal (nicht je Endpunkt, sie hängen am Extraktor): `POST` ohne `Content-Type` → 415 `{fehler}`; die Unit-Probe des Extraktors mit einer kleinen Grenze → 413 `{fehler}`. Der Abgleich „Methode ≠ GET in `src/web/endpunkte.rs`“ (57 Einträge) gegen die 36 Handler mit Rumpf benennt die 21 ohne JSON-Rumpf ausdrücklich, sonst ist die Mutante aus N1 nicht prüfbar.

**Grenze**: `Path`/`Query` (N1 Punkt 3, 59 Verwendungen) bleibt Soll; ob es in dieselbe Karte gehört, entscheidet der product-owner — die Abnahme-Probe der Karte nennt nur den Rumpf.

## Quellen / Bezuege

- `src/fehler.rs`, `src/web/mod.rs` (`impl IntoResponse for Fehler`)
- ADR-0002
- Nachtrag N1: Karte #39 (Anmerkung A1 aus #27); `src/web/mod.rs:20`, `:152–181`, `:302`, `:374`, `:392`; `src/web/endpunkte.rs`; `Cargo.lock:945` (`serde_path_to_error` über `axum 0.8`)
- Nachtrag N2: Karte #121 (Betreiber-Entscheidung 2026-11-13 im Kartenkommentar, arev B3); R00120 AK 6; `AI-Team/po-entscheidungen.md:187–188`; `src/dienst/zugregeln.rs:66–69`, `:88–96`, `:240–249`; `src/dienst/archiv.rs:12`, `:14`, `:51`, `:134`; `src/dienst/board_verwalten.rs:27`, `:59`; `src/web/mod.rs:158`
- Nachtrag N3: Karte #39; `Cargo.lock:36` (`axum 0.8.9`); `src/web/mod.rs:120`, `:215`, `:244`–`:1639`, `:1025`, `:1197`, `:1330`; `src/web/endpunkte.rs`; `tests/termine.rs:31`; `web/app.js:100`
