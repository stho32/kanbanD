---
id: R00222
status: Neu
datum: 2026-11-21
---

# R00222: WBS-Sicht, Wirkungen und Plausibilität entfernen

## Beschreibung

Karte #224, Scheibe **S2** des Rückbaus der WBS (Auftrag des Betreibers 2026-11-20). Technik nach [ADR-0034](../Dokumentation/ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) Regel 2 und 4, Nachtrag N2 Regel 4 (Ende der Übergangsform des Registers); Produktentscheidungen po-entscheidungen Z. 431 („wartet auf“, erledigt mit S4), Z. 432 (Altbestände), Z. 433 (Schnitt, Labels), Z. 435 (Hinweis am Feld „WBS“ fällt mit S2), Z. 436 (Hinweistext „Anwendungen“), Z. 497–500 (erster Start, Hinweistext ohne dritten Satz, Phasen zwischen S2 und S3, Bau ohne Nachzeichnung).

kanbanD liest die WBS nicht mehr, schreibt sie nicht mehr und zeigt sie nicht mehr. Es entfallen:

- die **WBS-Sicht** mit ihren Endpunkten (`GET /api/wbs/{kürzel}`, `POST …/knoten`, `PATCH …/knoten/{id}`, `POST …/knoten/{id}/verwerfen`), dem Menüeintrag „WBS“, dem Tastenkürzel `g k` und der Adresse `#/wbs/…`;
- die **Wirkungen** von Aufgaben auf Knoten (`wbs-effects`, vier Endpunkte `…/wbs-effects`, Feld im Aufgabenfenster, Wirkungspunkt auf der Karte);
- die **Plausibilität** `column-checks` mit ihrer einzigen Prüfung `wbs-effects-green` (Schalter im Spalten-Dialog, Warnung beim Bewegen);
- der **fremde Wächter** auf WBS-Dateien außerhalb des Ordners und das Ereignisfeld `wbs`;
- die **Git-Hilfen** der WBS-Sicht im fremden Repository (`staende_der_datei`, `geaendert`, `git_verzeichnis`; erledigt damit #221);
- die Felder **„WBS“ und „Anforderungen“** im Register: in `GET`-Antworten, in „Einrichten“ (je Anwendung und in den Quellen) samt Hinweis Z. 435 und im ersten Start. Geschrieben wird nur noch `repository` (ADR-0034 N2 Regel 4).

Was bleibt: die Bindung eines Boards an Anwendungen (`applications`), die Herkunft als Text (R00212), Commit-Verweise `kd:<hash>` mit Liste und Diff, der Lese-Rückfall der Wurzel auf den **Ordner** von `wbs`/`requirements` (ADR-0034 Regel 1, die Datei wird nie geöffnet), die Phasen bis S3 (#227).

**Abnahme-Probe der Karte (architekt, wörtlich aus dem Auftrag):** „Die WBS mit `chmod 000` stört nichts, und die Datei bleibt bytegleich. `GET /api/wbs/kd` antwortet mit 404. Kein Menüeintrag nennt die WBS.“ Sie steckt in AK 1, AK 2 und AK 3.

Ändert [R00053](R00053-anwendungen-registrieren.md) (Register mit WBS- und Anforderungspfad), [R00054](R00054-wbs-sicht.md)–[R00057](R00057-wirkungen-von-aufgaben-auf-die-wbs.md), [R00059](R00059-plausibilitaetspruefung-je-spalte.md), [R00061](R00061-behebung-wbs-sicht-e2e-unter-last.md), [R00071](R00071-wirkungen-vermerken-und-eintreten-lassen.md), [R00072](R00072-wirkungsstand-als-punkt-auf-der-karte.md) und [R00209](R00209-register-fuehrt-das-repository-der-anwendung.md) (Übergangsform). Sie alle bleiben unverändert als Historie stehen.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Aufgaben sind der Stand“ („kanbanD liest, schreibt und zeigt sie [die WBS] nicht. Ein Board bindet keine bis mehrere Anwendungen (Kürzel und Repository, etwa für Commit-Verweise)“), Nicht-Ziel „Kein Ersatz für Vision, Anforderungen und WBS“.

### Domänenbezug

- [Hauptnavigation](../Dokumentation/Domaenenwissen/D00009-hauptnavigation.md) — nennt heute WBS als eines der Ziele im Menü „…“; nach dieser Anforderung sind es drei (Missing-Docs).
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — verliert das Feld `wbs`.
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — verliert das Feld „Wirkungen“.

## Geschäftlicher Nutzen

Die WBS ist ein Planungswerkzeug des Entwicklers; sobald es die Aufgaben gibt, sind sie der Stand (Betreiber 2026-11-20). Solange kanbanD die WBS liest, schreibt und im fremden Repository ungehärtetes Git startet, bleibt eine zweite Wahrheit neben den Karten und eine Angriffsfläche außerhalb des Ordners (#221). Nach S2 öffnet kanbanD im Arbeits-Repository keine Datei mehr, nur noch gehärtetes, lesendes Git für Commit-Verweise. Etwa 1.900 Zeilen Rust samt Tests und die zugehörigen E2E-Specs entfallen (Inventur arch-224 §1, §3).

## Funktionale Anforderungen

- `GET|POST|PATCH` unter `/api/wbs/…` und `GET|PATCH|POST|DELETE` unter `/api/aufgaben/{nr}/wbs-effects…` antworten mit 404.
- `GET /api/endpunkte`, `/api/openapi.json` und README nennen weder `/api/wbs` noch `wbs-effects` noch einen Tag „WBS“ noch das Ereignisfeld `wbs`.
- Keine Ansicht, kein Menüeintrag, kein Tastenkürzel und keine Kürzelhilfe nennt die WBS; `#/wbs/<kürzel>` zeigt wie jede unbekannte Adresse das Board.
- Mit einer unlesbaren WBS (`chmod 000`) verhält sich kanbanD in Start, Board, Aufgaben, Bewegen, Berichten, Commit-Liste und Einstellungen genau gleich wie mit lesbarer; die Datei bleibt bytegleich.
- `wbs-effects` an einer Aufgabe ist ein unbekannter Schlüssel: die Aufgabe öffnet ohne Fehler und Warnung, die Einträge bleiben beim Schreiben inhaltlich erhalten (ADR-0028 Option B), beim ersten Schreiben in Blockform; die API zeigt sie nicht.
- `column-checks` an einem Board wird überlesen und fällt beim nächsten Schreiben des Boards weg, nur im Commit der Aktion, die das Board ohnehin schreibt (PO Z. 432); beim Bewegen gibt es keine Prüf-Warnung mehr, Grenzwarnungen (WIP) bleiben.
- Änderungen oder Commits an einer WBS-Datei lösen kein Live-Ereignis aus; das Ereignis hat kein Feld `wbs`.
- `PUT /api/einstellungen` nimmt je Anwendung und in `quellen` die Felder `wbs` und `anforderungen` weiter an (200, nie 400) und ignoriert sie; geschrieben werden je Anwendung `{name, repository}` und `sources.repository`, nie `wbs`/`requirements` (ADR-0034 N2 Regel 4, Regel 2 Tabelle).
- `GET /api/einstellungen` und `GET /api/anwendungen` liefern je Anwendung `kuerzel`, `name`, `repository` (gespeichert oder Startordner aus dem Rückfall) und `erreichbar: {repository}`; die Schlüssel `wbs`/`anforderungen` fehlen.
- Der Lese-Rückfall bleibt: fehlt `repository` in der Datei, gilt der Ordner von `wbs`, sonst `requirements` als Startordner; die Dateien werden nie geöffnet.
- „Einrichten“ zeigt je Anwendung und in den Quellen nur noch das Feld „Repository“ mit Zustandswort; das Feld „WBS“, das Feld „Anforderungen“ und der Hinweis Z. 435 entfallen; der Hinweistext „Anwendungen“ verliert seinen dritten Satz, der Rest bleibt wörtlich (PO Z. 498). Steht das Register in Altform (nur `wbs` oder `requirements`), zeigt das Feld „Repository“ den Startordner aus dem Lese-Rückfall mit seinem Zustandswort, nie ein leeres Feld.
- Erster Start (PO Z. 497, wörtlich): „Der erste Start fragt weder „WBS“ noch „Anforderungen“ und zeigt an ihrer Stelle kein neues Feld; die angelegte `kanbanD.md` enthält weder `wbs` noch `requirements`. Das Repository der Standardanwendung setzt der Betreiber bei Bedarf in „Einrichten“.“ `ersteEinstellungen` liefert keine `quellen: {wbs, anforderungen}` mehr; die Vorschau „KANBAND.MD“ zeigt keine Zeile `sources:` ohne Einträge.
- Phasen zwischen S2 und S3 (PO Z. 499, wörtlich): „Zwischen S2 und S3 gilt: Trägt das Register `wbs` noch in der Datei, liefern Board und Berichte die Phasen wie vor der Karte; nach dem ersten Speichern der Einstellungen rechnen die Berichte dieses Boards ohne Phasen, wie nach S3 (#227). `column-phases` bleibt in der Board-Datei erhalten; kein Commit, keine Warnung entsteht dadurch.“
- Die alte Adresse `#/wbs/<kürzel>` hinterlässt keine Spur: Fenstertitel und Seitenüberschrift sind die des Boards (kein „WBS“, keine Prozentzahl); die Sonderform des Fenstertitels für die WBS-Sicht (`fenstertitelName` mit `wbsStand`/`wbsName` in `web/seitenname.js`) entfällt.
- Die Farbvariablen `--kd-wbs-*` heißen danach ohne `wbs`; jede Farbe, die sie heute tragen (Diff-Zeichen, Bidi-Marken, Meldungen, Statuswörter), bleibt in Hell und Dunkel gleich.

## Nicht-funktionale Anforderungen

- Sicherheit: kanbanD startet im Arbeits-Repository kein Git mehr außer den gehärteten, lesenden Aufrufen für Commit-Verweise (A00011); kein Dateiwächter außerhalb des Ordners.
- Verträglichkeit (ADR-0034 Q3): die Factory ab Commit 1dd703c läuft gegen dieses Programm unverändert (`tests.test_auftrag`, `board_binden.binde` idempotent).
- Gestaltung (PO Z. 500, wörtlich): „Gestaltung: nur Wegfall, kein neues Element und kein geändertes Aussehen eines verbleibenden Elements; keine Zeichnung vor dem Bau. Der gestalter zieht nach dem Bau D0001, D0002, D0003, D0009 und die Kopie `Dokumentation/Wireframes/kd-tokens.css` (neue Farbnamen) nach; ADR-0011 (Kontrastpaare) zieht der architekt nach.“ Sicherung sind AK 10 (kein Querscrollen bei 375/641/768/980 px) und AK 11 (Farben unverändert, Hell und Dunkel).
- Altbestand (PO Z. 432): ein Altbestand öffnet ohne Fehler und ohne Warnung; kein Commit beim Start.

## Akzeptanzkriterien

Ausgangslage (herstellbar mit Git und der API): Arbeits-Repository `R` mit der WBS `R/Dokumentation/Planung/kd.md` (Knoten `I0007`), dem Ordner `R/Anforderungen` und zwei Commits `C1`, `C2`. kanbanD-Ordner `K` mit Register `kd: {name: KD, repository: R, wbs: R/Dokumentation/Planung/kd.md, requirements: R/Anforderungen}`. Board `entwicklung` mit den Spalten Offen, In Arbeit, Review, Erledigt, `applications: [kd]` und `column-checks: {Review: [wbs-effects-green]}`, WIP-Grenze 1 an „In Arbeit“. Aufgabe #1 in „Review“ mit `commits: [kd:<C1>]` und zwei Wirkungen in Flussform, `- {application: kd, action: create, node: I0048, parent: D0002, level: Interaction, name: Export, done-criterion: US-1}` und `- {application: kd, action: rework, node: D0002, executed: 2026-11-01}`. Aufgabe #2 in „Offen“ ohne Wirkungen. Vor jedem AK sind SHA-256 der WBS und `git rev-list --count HEAD` von `R` notiert.

### Trennung von der WBS

- [x] **AK 1** Gegeben die Ausgangslage und die WBS mit `chmod 000`. Wenn kanbanD startet, das Board geöffnet, eine Aufgabe #3 angelegt und durch alle vier Spalten bewegt, #1 nach „Erledigt“ bewegt, jeder Bericht des Boards geladen, die Commit-Liste von #1 gelesen und die Einstellungen mit `GET` gelesen und unverändert mit `PUT` geschrieben werden, dann antwortet keine Anfrage mit 4xx oder 5xx, im Log steht keine Fehler- oder Warnzeile, kein Live-Ereignis nennt die WBS, und SHA-256 der WBS sowie die Zahl der Commits in `R` sind gleich wie vorher. Dieselbe Folge mit lesbarer WBS liefert dieselben Antworten (bis auf Zeitstempel und Nummern). Heute: das Bewegen aus „Review“ liest die WBS (Prüfung `wbs-effects-green`) und der Wächter beobachtet sie.
- [x] **AK 2** Gegeben die Ausgangslage. Wenn `GET /api/wbs/kd`, `POST /api/wbs/kd/knoten`, `PATCH /api/wbs/kd/knoten/I0007`, `POST /api/wbs/kd/knoten/I0007/verwerfen`, `GET` und `PATCH /api/aufgaben/1/wbs-effects`, `POST /api/aufgaben/1/wbs-effects/0/eintritt` und `DELETE /api/aufgaben/1/wbs-effects/0` aufgerufen werden, dann ist jede Antwort 404, es entsteht kein Commit, und die WBS ist bytegleich. `GET /api/endpunkte` und `GET /api/openapi.json` enthalten die Zeichenfolge `wbs` nicht (ohne Groß-/Kleinschreibung). Heute: `GET /api/wbs/kd` 200.

### Oberfläche

- [x] **AK 3** Gegeben die Ausgangslage. Wenn der Betreiber das Board öffnet, das Menü „…“ und die Kürzelhilfe (`?`) öffnet, `g` und dann `k` tippt und die Adresse `#/wbs/kd` aufruft, dann nennt kein Eintrag des Menüs „…“ und der Seitenleiste die WBS (weder „WBS“ noch „WBS · kd“), die Kürzelhilfe hat keine Zeile `g k`, `g k` ändert weder Adresse noch Ansicht, und `#/wbs/kd` zeigt das Board wie jede unbekannte Adresse; im Netzwerkmitschnitt gibt es keine Anfrage an einen Pfad mit `/api/wbs`. Nach dem Laden von `#/wbs/kd` enthält `document.title` weder „WBS“ noch eine Prozentzahl (kein Muster `\d+ %`), `document.title` und die Seitenüberschrift sind dieselben wie nach dem Laden von `#/board/entwicklung`, und im Menü „…“ zählt `[aria-current]` 0. Probe: Adresse laden, `document.title` und Überschrift mit denen des Boards vergleichen, `[aria-current]` im geöffneten Menü „…“ zählen. Heute: Eintrag „WBS“ im Menü; `fenstertitelName` kennt die Sonderform „<Stand> % · WBS · <Name>“.
- [x] **AK 4** Gegeben die Ausgangslage. Wenn der Betreiber #1 im Aufgabenfenster öffnet, dann gibt es dort keine Zeile „Wirkungen“, keinen Knopf „+ Wirkung“, keine Ampel und keinen Eintritts-Schalter, und die Karte #1 trägt keinen Wirkungspunkt (`.wpunkt`); es geht keine Anfrage an `…/wbs-effects`. `GET /api/aufgaben/1` hat keinen Schlüssel `wirkungen`.

### Altbestand an Aufgabe und Board

- [x] **AK 5** Gegeben die Ausgangslage. Wenn ein Agent `PATCH /api/aufgaben/1 {titel: "Export prüfen"}` schickt, dann ist die Antwort 200 mit genau einem Commit, und `wbs-effects` steht danach in der Datei mit denselben zwei Einträgen in derselben Reihenfolge und mit denselben Schlüsseln und Werten (als YAML gelesen gleich, `executed: 2026-11-01` eingeschlossen); Blockform statt Flussform ist erlaubt. Ein zweites `PATCH` ändert an `wbs-effects` kein Byte mehr. Grenzfall: eine Aufgabe mit `wbs-effects: []` öffnet und behält den Schlüssel ebenso.
- [x] **AK 6** Gegeben die Ausgangslage. Wenn das Board geöffnet wird, entsteht kein Commit und keine Warnung. Wenn danach #1 von „Review“ nach „Erledigt“ bewegt wird, dann enthält die Antwort keine Prüf-Warnung, es entsteht genau ein Commit, und in diesem Commit fehlt die Zeile `column-checks` der Board-Datei. Der Dialog „Spalten einrichten“ zeigt keinen Prüfschalter; `PUT /api/boards/entwicklung/spalten` mit `pruefungen: [wbs-effects-green]` an einer Spalte antwortet 200 und schreibt kein `column-checks`. Gegenprobe: wird #2 nach „In Arbeit“ bewegt, während dort schon eine Aufgabe steht, kommt die WIP-Warnung wie vor der Karte.
- [x] **AK 7** Gegeben die Ausgangslage. Wenn die WBS geändert und in `R` committet wird, dann sendet `GET /api/ereignisse` dafür kein Ereignis, und kein Ereignis trägt ein Feld `wbs`. Gegenprobe: eine Änderung an einer Aufgabe in `K` meldet das Ereignis wie vor der Karte.

### Commit-Verweise

- [x] **AK 8** Gegeben die Ausgangslage, in drei Formen des Registers: (a) nur `repository: R`, (b) nur `wbs: R/Dokumentation/Planung/kd.md`, (c) nur `requirements: R/Anforderungen`; jeweils mit WBS `chmod 000`. Wenn `GET /api/aufgaben/1/commits`, der Diff von `C1` und der Gesamt-Diff von #1 gelesen werden, dann ist `zustand` von `kd:<C1>` in allen drei Formen derselbe wie mit dem Programm vor der Karte, und Diff und Gesamt-Diff antworten 200 mit demselben Inhalt (#207–#220).

### Register im Übergang

- [ ] **AK 9** Gegeben die Ausgangslage. Wenn ein Agent `PUT /api/einstellungen` schickt mit `kd: {name: KD, repository: R, wbs: R/Dokumentation/Planung/kd.md, anforderungen: R/Anforderungen}` und `quellen: {repository: "", wbs: "x.md", anforderungen: "a/"}`, dann ist die Antwort 200 (nie 400), es entsteht genau ein Commit, `kanbanD.md` trägt danach `kd: {name: KD, repository: R}` und in `sources` weder `wbs` noch `requirements`, und `GET /api/einstellungen` sowie `GET /api/anwendungen` nennen je Anwendung keinen Schlüssel `wbs` oder `anforderungen` und unter `erreichbar` nur `repository`. Rundlauf in Altform: steht im Register nur `wbs: R/Dokumentation/Planung/kd.md`, liefert `GET` `repository: R/Dokumentation/Planung`; derselbe Inhalt unverändert mit `PUT` zurück schreibt `repository: R/Dokumentation/Planung` ohne `wbs`, und `kd:<C1>` behält seinen `zustand`. Ein Start allein schreibt nichts. Factory: `KANBAND=<build> python3 -m unittest tests.test_auftrag` (Factory ab 1dd703c) ist grün, und zweimal `board_binden.binde` hintereinander erzeugt beim zweiten Mal keinen Commit.
- [x] **AK 10** (Einrichten) Gegeben die Ausgangslage. Wenn der Betreiber „Einrichten“ öffnet, dann zeigt jede Anwendung Kürzel, Name und „Repository“ mit Zustandswort und die Quellen nur „Repository“; es gibt kein Feld „WBS“, kein Feld „Anforderungen“ und keinen Satz „Die Factory erkennt die Anwendung an diesem Pfad …“. Der Hinweistext über den Anwendungen lautet: „Je Anwendung ein Kürzel und der Pfad ihres Repositorys; ein Ordner darin genügt. Daraus liest kanbanD die Commits zu Verweisen wie `kd:<hash>`. Aufgaben nennen ihre Herkunft als `kd:I0007`; Boards binden mit `applications: [kd]`.“ Register in Altform: steht in `kanbanD.md` für `kd` nur `wbs: R/Dokumentation/Planung/kd.md`, dann zeigt das Feld „Repository“ von `kd` beim Öffnen `R/Dokumentation/Planung` mit dem Zustandswort „erreichbar“ (nicht leer, nicht „ungeprüft“), und die Vorschau „KANBAND.MD“ zeigt unter `kd` die Zeile `repository: R/Dokumentation/Planung` und keine Zeile `wbs`. Speichern schreibt dieses Register auf `repository` um, ein Commit; die Vorschau zeigt danach den geschriebenen Stand. Probe: Register in Altform per Git herstellen, „Einrichten“ öffnen, Wert und Zustandswort von `getByLabel('Repository kd')` und den Vorschautext lesen, speichern, `kanbanD.md` lesen. Bei 375, 641, 768 und 980 px gibt es kein Querscrollen der Seite.

### Farben

- [x] **AK 11** Gegeben ein Commit mit einer hinzugefügten Zeile, einer entfernten Zeile und einer Zeile mit dem Steuerzeichen U+202E, an #1 hinterlegt, dazu eine Meldung „Fehler“ und eine „Warnung“ auf der Review-Seite und die WIP-Warnung aus AK 6, jeweils Hell und Dunkel. Wenn die Review-Seite, die Commit-Liste von #1 und das Board gezeichnet werden, dann sind `color`, `background-color` und `border-color` der Diff-Zeichen (`+`/`−` in Diff und Liste), der Bidi-Marke, der Statuswörter neu/entfernt/geändert, der beiden Meldungen, der WIP-Warnung samt Ausrufezeichen und von `--kd-fehler-text` gleich den Werten, die am Stand vor der Karte gemessen wurden. Kein Name in `web/` und `e2e/` beginnt mit `--kd-wbs-`, und die Kontrastproben (`e2e/einheit/kontrast.test.js`) sind mit den neuen Namen grün.

### Doku und Altbestand

- [x] **AK 12** Gegeben die README nach der Karte. Wenn man sie nach `wbs` durchsucht (ohne Groß-/Kleinschreibung), dann steht das Wort nur noch im Satz zum Lese-Rückfall der Wurzel und in der Zeile zu den Phasen (bis S3); „Bedienen in Kürze“ nennt weder WBS-Sicht noch Wirkungen noch Plausibilität, „Für Agenten“ weder `/api/wbs` noch `wbs-effects` noch ein Ereignisfeld `wbs`.
- [x] **AK 13** Gegeben eine Kopie von `~/Projekte/Kanban-Boards/JoinPuyaApp-Kanbanboard` in der eigenen Ablage (Stand 2026-11-21: 85 Aufgaben mit `wbs-effects`, 2 mit `phases`, Boards mit `column-phases`, Register `jopu` in Altform nur mit `wbs`/`requirements`). Wenn erst das Programm vor der Karte und dann dieses darauf startet, dann:
  - entsteht beim Start kein Commit, `GET /api/aufgaben` liefert 200 ohne defekte Datei, im Log steht keine Fehler- oder Warnzeile;
  - ist `zustand` jedes `jopu:<hash>` in beiden Läufen gleich;
  - stehen nach `PATCH titel` an einer Aufgabe mit `wbs-effects` deren Einträge inhaltlich gleich in der Datei (wie AK 5);
  - bleibt `column-phases` nach einer Bewegung auf einem Board erhalten (Phasen sind S3), und `GET /api/boards/<slug>` liefert `phasen` wie vor der Karte, solange das Register `wbs` in der Datei trägt;
  - steht nach `GET`→`PUT /api/einstellungen` `repository` statt `wbs`/`requirements` in `kanbanD.md`.

### Erster Start

- [x] **AK 14** Gegeben ein leerer Git-Ordner ohne `kanbanD.md`. Wenn der Betreiber kanbanD darin öffnet, Kürzel `sh`, Name `Stefan`, den Agenten Claude, Board `Entwicklung` und Spalten `Offen, In Arbeit, Erledigt` eingibt und „Einrichten und committen“ wählt, dann:
  - hat die Maske genau die Beschriftungen Ich, Agenten, Board, Spalten in dieser Reihenfolge, genau die Eingabefelder Kürzel, Name, Board, Spalten und die Agenten-Schalter Claude und Codex; kein Element trägt die Beschriftung oder den zugänglichen Namen „WBS“ oder „Anforderungen“;
  - enthält die Vorschau „KANBAND.MD“ vor dem Einrichten und die angelegte `kanbanD.md` danach weder `wbs` noch `requirements` noch eine Zeile `sources:` ohne Einträge darunter;
  - liefert `ersteEinstellungen` für diese Eingabe kein Feld `quellen` mit `wbs` oder `anforderungen`;
  - entstehen `kanbanD.md` und `boards/entwicklung.md` in genau einem Commit, und das Board öffnet mit den drei Spalten.
  Probe: e2e in `r00222-ohne-wbs.spec.js` (Felder per `getByLabel` zählen, Vorschautext ohne „wbs“, „requirements“ und leeres `sources:`), Unit-Test für `ersteEinstellungen`. Heute: Felder „WBS“ und „Anforderungen“ in der Maske, `quellen: {wbs, anforderungen}` in `ersteEinstellungen`.

## Betroffene Verzeichnisstruktur

- Entfällt: `src/wbs.rs`, `src/wbs_datei.rs`, `src/herkunft.rs`, `src/dienst/wbs.rs`, `src/dienst/wirkungen.rs`, `web/wbs.js` (Bindungsfunktionen ziehen um), `src/pruefungen.rs` bis auf `Warnung`.
- Ändert: `src/lib.rs`, `src/dienst/mod.rs`, `src/dienst/bewegen.rs`, `src/dienst/phasen.rs` (nur `unbekannte`), `src/dienst/anwendungen.rs`, `src/dienst/einstellungen.rs`, `src/dienst/einrichten.rs`, `src/modell/einstellungen.rs`, `src/modell/aufgabe.rs`, `src/modell/board.rs`, `src/format/aufgabe.rs`, `src/format/board.rs`, `src/format/einstellungen.rs`, `src/waechter.rs`, `src/git.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs`, `src/web/statisch.rs`.
- Oberfläche: `web/app.js`, `web/ansicht.js`, `web/register.js`, `web/kultur.js`, `web/tastatur.js`, `web/adresse.js`, `web/seitenname.js`, `web/sichtzustand.js`, `web/index.html`, `web/kd-app.css`, `web/kd-tokens.css`.
- Doku: `README.md`.
- Tests: entfallen `tests/wbs.rs`, `tests/wbs_schreiben.rs`, `tests/wirkungen.rs`, `tests/pruefungen.rs`, Node `e2e/einheit/wbs.test.js` (zwei Bindungstests ziehen um), `e2e/einheit/pruefungen.test.js`, e2e `r00054`–`r00057`, `r00059`, `r00071`; anpassen u. a. `tests/anwendungen.rs`, `tests/bindung.rs`, `r00061`, `r00062`, `r00209`, `kontrast`; neu `tests/akzeptanz_r00222.rs`, `e2e/tests/r00222-ohne-wbs.spec.js`. `e2e/tests/wbs-hilfen.js` bleibt, solange `r00058` (Phasen, S3) sie nutzt.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1150 Abnahme-Proben rot, Farben messen**: AK 1–4, 9, 10, 14 am heutigen Stand rot; AK 5 ist heute schon grün und bleibt Wächter gegen Rückschritt; die Farben aus AK 11 am heutigen Stand messen und als Erwartung festhalten.
2. **B1151 Plausibilität entfernen** (AK 6): `Warnung` zieht in ein eigenes Modul, weil Grenzen, Reservierung, Erledigen und Zugregeln sie brauchen.
3. **B1152 Wirkungen entfernen** (AK 4, 5): `WIRKUNGEN` aus `BEKANNT`, die Einträge laufen über `weitere`.
4. **B1153 Wächter und Git-Hilfen entfernen** (AK 7).
5. **B1154 WBS-Sicht, Endpunkte und Menü entfernen** (AK 2, 3), nach 2–4, weil diese `dienst/wbs.rs` nutzen. Räumt `web/` auf (Bauhinweis ux-reviewer): Beschriftungen `wbs`, `requirements`, `wbs-effects` in `web/kultur.js:68`, `'wbs'` in `AUSSERHALB_EINES_BOARDS` (`web/ansicht.js:673`), „WBS-Knoten“ in `web/sichtzustand.js`, `fenstertitelName`-Sonderform in `web/seitenname.js`, Kopfkommentar und Zeile 65 in `web/adresse.js`, der Hinweis-Div `WBS_HINWEIS` (`web/ansicht.js:2291`) samt `aria-describedby`. Durchsetzung bleibt `rg -i wbs web` (ADR-0034): danach nur Lese-Rückfall und Kommentare.
6. **B1155 Register ohne `wbs`/`anforderungen`** (AK 9, 10, 14): `Anwendung.wbs`/`.anforderungen` bleiben nur als intern gelesene Felder für den Startordner und für `phasenstand` (S3), nicht in der API und nicht beim Schreiben.
7. **B1156 Farbvariablen umbenennen** (AK 11).
8. **B1157 README, Endpunktliste, OpenAPI** (AK 2, AK 12).
9. **B1158 Legacy-Probe, Factory-Rundlauf, Probe im echten Programm, Gate, Anforderung abschließen** (AK 8, AK 13).

B1151, B1152, B1153, B1155 und B1156 sind nach B1150 unabhängig voneinander.

### Hinweise

- **Grenze zu S3 (#227):** `src/phasen.rs`, `src/dienst/phasen.rs` (bis auf den Aufruf `unbekannte`), `column-phases`, `phases` an der Aufgabe, `PATCH phasen`, Phasen in Berichten und Verlauf bleiben unberührt. `phasenstand` prüft nur, ob die WBS-Datei existiert (`is_file`), und liest die Phasen-Datei daneben; mit `chmod 000` ändert sich nichts.
- **Grenze zu #216:** `web/statisch.rs` und `web/index.html` ändert auch #216 (Mergekonflikt möglich, Kartenkommentar 2026-11-21 03:30).
- **Farbnamen:** Vorschlag `--kd-status-ok`, `--kd-status-warn`, `--kd-status-error`, `--kd-status-neutral`, je mit `-bg` und `-ink`; `--kd-warn` gibt es schon und bleibt. Die Kopie `Dokumentation/Wireframes/kd-tokens.css`, die Artboards D0001, D0002, D0003, D0009 (PO Z. 500) und ADR-0011 (Absatz Kontrastpaare) zieht nicht der entwickler nach, sondern gestalter bzw. architekt.
- **Herkunft:** Der Hinweis zur Schreibweise „WBS-Knoten I0001, Anforderung R00014 …“ bleibt (R00212 FA „HERKUNFT_HILFE bleibt“); er beschreibt die Form einer ID und ist kein Menüeintrag.
- Kopien von Board-Ordnern nur in der eigenen Ablage, nie im Board-Ordner selbst.

## Tests

- **Unit:** `ersteEinstellungen` ohne `quellen.wbs`/`quellen.anforderungen` (AK 14); Format der Aufgabe: Fluss- → Blockform von `wbs-effects` inhaltlich gleich (mit `executed`, leere Liste); Format des Boards: `column-checks` überlesen und nicht geschrieben; Register schreiben ohne `wbs`/`requirements`, Startordner aus dem Rückfall; `Warnung` im neuen Modul.
- **Integration:** `tests/akzeptanz_r00222.rs`: AK 1 (mit `chmod 000`, ohne Root), AK 2, AK 5, AK 6 (API-Teil), AK 7, AK 8, AK 9 (ohne Factory-Teil), AK 13 (`#[ignore]`, wenn die Kopie fehlt; in B1158 einmal gefahren und belegt). Factory-Teil von AK 9 als Integrationsprobe gegen den Build.
- **E2E:** `e2e/tests/r00222-ohne-wbs.spec.js`: AK 3, AK 4, AK 6 (Spalten-Dialog), AK 10, AK 11, AK 14.

## Abhängigkeiten

- **Abhängig von:** [R00209](R00209-register-fuehrt-das-repository-der-anwendung.md) (I0199, #225, erledigt), [R00212](R00212-herkunft-als-text-ohne-aufloesung.md) (I0202, #226, erledigt); Factory-Pflege nach Inventur §6 (Kartenkommentar 2026-11-21 14:59: Factory 1dd703c, cc8ed41; `~/.claude` 5117d6f; `kanban:` entfernt).
- **Blockiert:** #227 S3 „Phasen werden Spalten“ (braucht #224).

## Offene Fragen

Alle vier entschieden wie empfohlen (po-entscheidungen Z. 497–500); die Wortlaute stehen in FA und NFA.

1. **Erster Start** — entschieden, PO Z. 497 (FA „Erster Start“, AK 14): Die Felder „WBS“ und „Anforderungen“ ersatzlos streichen (Empfehlung: in allen 6 Ordnern mit `sources` sind `sources.wbs`/`requirements` leer, Inventur §5; das Repository lässt sich später in „Einrichten“ setzen; keine neue Gestaltung) — oder an ihrer Stelle ein Feld „Repository“ zeigen (neues Element, Zeichnung nötig).
2. **Hinweistext „Anwendungen“ (Z. 436)** — entschieden, PO Z. 498 (AK 10): den dritten Satz „WBS und Anforderungen braucht nur noch die Factory; die Felder entfallen, sobald sie umgestellt ist.“ streichen, den Rest wörtlich lassen (Empfehlung, AK 10).
3. **Phasen zwischen S2 und S3** — entschieden, PO Z. 499 (FA „Phasen zwischen S2 und S3“, AK 13): Nach dem ersten Speichern der Einstellungen fehlt `wbs` in der Datei; dann findet kanbanD die Phasen-Datei nicht mehr, und die Berichte des Boards rechnen ohne Phasen, also so wie nach S3. Empfehlung: hinnehmen (ADR-0034 N2 Regel 4 und Regel 3; S3 folgt direkt; die Boards behalten `column-phases`; alle 5 Boards bilden je Spalte genau eine Phase ab, ADR-0034 „Negativ“). Alternative: `wbs` bis S3 beim Schreiben durchreichen (widerspricht N2 Regel 4, bräuchte einen Nachtrag des architekt).
4. **Zeichnung** — entschieden, PO Z. 500 (NFA „Gestaltung“): Das Entfernen von Menüeintrag, Feldern und Wirkungen ohne Nachzeichnung bauen; der gestalter zieht D0001, D0002, D0003 und die Farbnamen in D0009 und `Dokumentation/Wireframes/kd-tokens.css` danach nach (Empfehlung, wie Z. 446).

## Manuelle Vorbereitungstätigkeiten

- Keine; die Factory ist umgestellt (Kartenkommentar 2026-11-21 14:59).

## Manuelle Nachbereitungstätigkeiten

- Auslieferung an die Board-Instanzen (`cargo install`, Neustart) durch den Director; die Register in Altform (z. B. JoinPuya) stellen sich beim nächsten Speichern der Einstellungen um.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Auftrag des Betreibers vom 2026-11-20: die WBS ist Planungswerkzeug des Entwicklers, die Aufgaben sind der Stand. Heute liest kanbanD die WBS an drei Stellen (Sicht, Prüfung beim Bewegen, Wirkungen), schreibt sie (Status, Knoten, Eintritt) und beobachtet sie mit einem Wächter und ungehärtetem Git außerhalb des Ordners. Entfallen Endpunkte, Prüfung, Wirkungen und Wächter, gibt es keinen Codepfad mehr, der die Datei öffnet; die unlesbare WBS in AK 1 belegt das, weil jedes übrig gebliebene Lesen dort als Fehler oder Warnung sichtbar würde. Weil das Register nur noch `repository` schreibt, aber `wbs`/`anforderungen` ohne 400 annimmt und ihren Ordner als Rückfall liest, bricht weder die Factory im Übergang (AK 9) noch ein Commit-Verweis (AK 8). Altdaten bleiben in den Dateien (AK 5, AK 13) und verschwinden nur dort sichtbar, wo ADR-0034 und PO Z. 432 es erlauben.

## Missing-Docs

- Glossar: [Hauptnavigation](../Dokumentation/Domaenenwissen/D00009-hauptnavigation.md) nennt WBS als Ziel im Menü „…“ (nach der Karte drei seltene Ziele; fachspezialist).
- Glossar: „Register“ / „Anwendung“ haben keinen eigenen Eintrag.

## Notizen

**Entscheidungen des planers (Lauf 224-planer-1):**

- Mitgeschickte `wbs`/`anforderungen` fallen beim Speichern weg und werden nicht erhalten: ADR-0034 Regel 1 („`PUT` ignoriert mitgeschickte `wbs`/`anforderungen`“), Regel 2 Tabelle („ersetzt durch `repository` beim nächsten `PUT`“) und N2 Regel 4 („schreibt nur noch `repository`“) sagen es übereinstimmend.
- Ein `PUT` mit nur `wbs` und leerem `repository` bekommt **kein** aus `wbs` abgeleitetes `repository`: „ignoriert“ heißt ignoriert. Verlustfrei bleibt der Rundlauf, weil `GET` `repository` immer gefüllt liefert (gespeichert oder Startordner, AK 9), und die Factory sendet seit 1dd703c immer `repository`.
- Die Farbvariablen werden umbenannt statt behalten: ADR-0034 „Durchsetzung“ verlangt, dass `rg -i 'wbs' src web` nach der letzten Scheibe nur den Rückfall und Kommentare findet; ein Variablenname ist keins von beiden.
- `PUT …/spalten` mit `pruefungen` antwortet 200 und ignoriert das Feld, wie das Register (kein Bruch eines älteren Clients).

**Verworfene Alternativen:** Wirkungen beim nächsten Schreiben entfernen (verletzt PO Z. 432 „Aufgabendaten bleiben“); die WBS-Sicht als nur lesende Sicht behalten (Vision „zeigt sie nicht“); die Farbnamen erst mit S3 umbenennen (S2 löscht die WBS-Regeln in `kd-app.css` ohnehin, der Schnitt wäre doppelt).
