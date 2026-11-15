---
name: factory
projekt: /home/shoff/Projekte/kanbanD
kanband:
  ordner: /home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard
  board: entwicklung
chat:
  ordner: ~/Projekte/Kanban-Boards/Fabriken-Chat
  channel: fabriken
betreiber: sh
director: dir
empfaenger: betreiber
anwendung: kd
realist: vorschlagen
last:
  grenze_prozent: 75
angelegt: 2026-10-31
---

# Fabrik — kanbanD

Übertragen aus `AI-Team/factory.py` am 2026-11-14 (R00012 der Software-Factory). Prüfen: `python3 werkzeuge/fabrik.py pruefen <diese Datei>`.

## Auftrag

Aktiviert über `/factory start` aus der Software-Factory (`/home/shoff/Projekte/Software-Factory`). Ein Director, ein Projekt.

### Ziel

kanbanD ist ein Kanban, das ein Ordner ist: Menschen im Browser und KI-Agenten über die API arbeiten auf demselben Board aus Markdown-Dateien, und jede Aktion wird sofort committet, sodass Git das vollständige Gedächtnis ist. Das Team entwickelt es so weiter, dass es als Steuerpult und Übersicht einer Wartungsfabrik taugt (R00095–R00100).

### Einsatz des realist-consultant

Vom Betreiber beim Start festgelegt (2026-10-31), ergänzt `realist: vorschlagen`:

- **Wann**: Der `realist-consultant` berät nicht nur bei Schleifen, sondern immer dann, wenn der `product-owner` einen neuen inhaltlichen Auftrag bekommt (neue Anforderung, Kurskorrektur, neuer Umfang). Er prüft, ob Kriterien und Lösung für ihren Zweck angemessen sind, und schlägt einfachere Fassungen vor.
- **Wer entscheidet**: Der `product-owner` vertritt den Betreiber in der Diskussion und entscheidet nach bestem Wissen und Gewissen und nach der Vision. Er protokolliert in `AI-Team/po-entscheidungen.md`. Der Director setzt nichts selbst um, was nicht der Product Owner entschieden hat.
- **Strittig**: Können sich Product Owner und realist-consultant nicht einigen oder ist die Frage richtungsweisend, legt der Director eine Karte ins **Backlog**: Titel „Besprechen: <Frage>“, die Optionen beider Seiten mit Empfehlung, zuständig `sh`. Der Betreiber stößt sie selbst an, indem er sie mit dem Product Owner bespricht. Bis dahin läuft die betroffene Arbeit nach dem bisherigen Stand weiter oder wird zurückgestellt, nie nach einer der strittigen Fassungen.

## Umgebung

Wie die Dienste des Projekts starten und geprüft werden. Gilt für den Director und jede Rolle.

- **Gate**: `cargo test && node --test e2e/einheit/ && (cd e2e && npx playwright test)`
- **Installieren**: `cargo build --release`; E2E: `cd e2e && npm install && npx playwright install chromium`
- **Dienste starten**: `target/release/kanbanD <wegwerf-ordner> --port <frei> --kein-browser` (Skill `freier-port`); nie die Board-Instanz auf Port 7422
- **Health-Check**: `GET http://127.0.0.1:<port>/api/zustand` antwortet mit JSON
- **Zum Gate**: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`
- **Pfade**: `~/.cargo/bin`; Node für E2E unter `e2e/`; Board der Factory `http://127.0.0.1:7422`, Ordner `/home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard`; Auslieferung `cargo install --path . --locked` (siehe `prozess.md`)

## Rechnerlast

- Höchstens etwa 75 % Systemlast, immer; vor jedem Start einer Rolle, eines Builds oder des Gates prüfen.
- Rollen gleichzeitig: 1
- **Tagbetrieb**: zeit: 8–21 Uhr; entwickler: 1; pruefende rollen: bis 3 parallel (Auto-Reviews); job grenze: 2; nice: 10; test worker: Standard; lasttests: auf Ansage
- **Nachtbetrieb**: zeit: 21–8 Uhr; entwickler: 1; pruefende rollen: 1; job grenze: 1; nice: 19; test worker: 2; lasttests: nie
- Tagbetrieb 8–21 Uhr, Nachtbetrieb 21–8 Uhr; Last- und Dauerproben nur auf ausdrücklichen Auftrag des Betreibers, nie nachts.

Gilt für Director und Rollen (Regeln: `rollen/director/regeln.md`, „Rechnerlast“). Immer höchstens etwa 75 % Systemlast; neu gestartet wird nur, was darunter passt. Rechner: 8 Kerne, 31 GB. Sparbetrieb nach `prozess.md` (Betreiber 2026-10-31).

| Betrieb | Zeit | Entwickler | prüfende Rollen | Job-Grenze | nice | Test-Worker | Lasttests |
|---|---|---|---|---|---|---|---|
| Tag | 8–21 Uhr | 1 | bis 3 parallel (Auto-Reviews) | 2 | 10 | Standard | auf Ansage |
| Nacht | 21–8 Uhr | 1 | 1 | 1 | 19 | 2 | nie |

## Wissen

### Lastprofil (Betreiber 2026-10-31)

| Dimension | Ziel |
|---|---|
| gleichzeitige Menschen | 1–3 Browser-Tabs |
| gleichzeitige Agenten | bis 10 Instanzen (Sensoren, Behandler) |
| Schreibrate | bis 5 schreibende Aufrufe/s in Spitzen, je ein Commit |
| Bestand je Ordner | bis 5.000 Aufgaben (davon 4.000 archiviert), 10 Boards |
| Antwortzeit | lesend p95 < 200 ms bei 5.000 Aufgaben; schreibend inkl. Commit p95 < 500 ms; `ziehen` unter Konkurrenz von 10 Agenten p95 < 1 s |
| Live | Änderung in allen offenen Sichten < 1 s |

### Sparbetrieb (Betreiber 2026-10-31)

Ein Wochenlimit für Tokens steht bevor. Ziel ist, möglichst viele Karten **ganz** fertigzustellen, bevor es greift, denn was begonnen und nicht abgeschlossen ist, bleibt bis zum Reset offen.

- **Nacheinander**: Es ist höchstens eine Karte zwischen „Architektur“ und „Entwicklertest“ unterwegs. Die nächste Karte wird erst freigegeben und gezogen, wenn die vorige in „Erledigt“ oder „Ohne Mensch nicht lösbar“ liegt. Es gibt keinen Vorlauf und keinen Puffer, und `entw2` baut nur, während `entw1` nicht baut.
- **Sparsam prüfen**: In den Auto-Reviews läuft `code-reviewer` immer, jede andere Rolle nur, wenn die Karte ihr Thema nachweislich berührt. Eine Wiederholung gibt es nur für Rollen mit Befund. Befunde, die nur über künstliche Fehlerinjektion erreichbar sind, gelten als `Sollte`; was mit `Sollte` und `Optional` geschieht, regelt „Befunde aus Reviews und Tests“.
- **Knappe Aufträge**: Der Director nennt jeder Rolle die Dateien und Abschnitte, die sie braucht, statt sie suchen zu lassen. Die Berichte bleiben im Berichtsformat, ohne Wiederholungen.
- **Rollen fortsetzen statt neu starten** (Betreiber 2026-10-31): planer, architekt, product-owner und entwickler werden für die nächste verwandte Karte bzw. für Nachträge per SendMessage fortgesetzt, solange ihr Kontext unter etwa 150.000 Tokens liegt (Wert aus der letzten Abschlussmeldung); darüber und bei fremdem Codebereich frisch starten. Prüfende Rollen (Reviews, Entwicklertest) starten je Karte frisch — der unabhängige Blick ist gewollt; nur ihre Wiederholung nach Nacharbeit an derselben Karte wird fortgesetzt. Die Agent-ID je Rolle hält der Director in der Logbuchzeile fest.
- **Reihenfolge der Karten** (Betreiber 2026-10-31, nach der UX-Durchsicht): erst #7/#14 (R00101), dann R00095 → R00096 → R00097 → R00098 → R00099 → R00100, danach die übrigen UX-Karten (#8–#13, #15, #16); Features der Wartungsfabrik bringen den größten Nutzen je Token.

### Modellverteilung (Betreiber 2026-11-14)

DeepSeek ist der Standard für die übrigen Rollen, Claude steht dort, wo ein Fehler teuer ist oder ein zweites, anderes Modell mehr sieht. Anlass: Woche bis 2026-11-12 mit Claude Opus 47,89 $ je Karte (48 Karten); seit 2026-11-13 mit DeepSeek 0,48 $ (#80) und 1,03 $ (#43) je Karte, 29 Läufe ohne falschen Bericht, aber zwei ungültige Ergebnisblöcke des code-reviewers und ein Widerspruch in der Planung (#138, AK 19 gegen AK 20).

- **Fest auf Claude Sonnet**: `code-reviewer` (läuft bei jeder Karte, letztes Tor vor dem Entwicklertest, anderes Modell als der Erbauer) und `security-reviewer` (selten, ein übersehener Fehler ist teuer). Der Director bleibt Claude.
- **Fest auf Claude Fable 5.2** (Betreiber 2026-11-15): `planer`, `architekt` und `entwickler`, Bau und Nacharbeit (`entw1`, `entw2`). Anlass: Am 2026-11-14 rissen zwei DeepSeek-Bauläufe die Zeitgrenze und einer lief 85 Minuten in einer Leseschleife ohne Änderung.
- **Umschalten je Lauf**: Soll ein einzelner Lauf über den anderen Treiber oder ein anderes Modell laufen, `board.py beginne <nr> --rolle <r> --treiber claude|opencode [--modell <m>]` (Factory seit 2026-11-14); die Entscheidung steht im Zugkommentar.
- **Alle übrigen Rollen** bleiben auf DeepSeek.
- **Messen**: nach etwa zehn Karten Nacharbeiten je Karte und Kosten je Karte aus dem Logbuch vergleichen, vorher gegen nachher.

### Befunde aus Reviews und Tests (Betreiber 2026-11-12)

Anlass: Der Backlog war auf 66 Karten gewachsen, rund die Hälfte davon Härtungskarten, Wackler und Dubletten; bei der Durchsicht am 2026-11-12 blieben 30. Die Regeln verhindern, dass Befunde ohne Nutzerwirkung wieder geparkt werden.

- **Muss** geht wie bisher in die Nacharbeit derselben Karte.
- **Sollte und Optional** entscheidet die Nacharbeit derselben Karte: beheben oder verwerfen, mit einem Satz Grund im Kartenkommentar. Es gibt keine Härtungskarten mehr.
- **Akzeptanzkriterium ohne Probe**: Meldet eine Rolle, dass ein Akzeptanzkriterium der Karte keine Probe hat, ist das ein Muss derselben Karte, kein Sollte.
- **Neue Karte nur mit Nutzerwirkung**: Ein Befund außerhalb des Pakets (Vorbestand) wird nur dann Karte, wenn er für Mensch oder Agent beobachtbar ist — sichtbarer Fehler, Datenverlust, Bruch des API-Kontrakts, Sicherheit. Vorher gleicht der Director mit dem Backlog ab: Passt der Befund zu einer offenen Karte, wird er dort ein Kommentar.
  - #138 doppelte Auslösung · #139 E2E-Wackler · #140 schmale Breite · #141 Tastatur und Fokus · #55 kleine sichtbare Mängel · #143 Akzeptanzkriterien ohne Probe
- **Nie eine Karte** (verwerfen, im Bericht genügt eine Zeile): überlebende Mutanten und Lücken in Wächtern ohne beobachtbaren Fehler, Stil und Benennung, Zeilen- und SHA-Verweise in Doku, Rechtschreibung in Anforderungen, WBS und `Gelerntes.md`, Drift in Architektur-Modell und ADRs (die nimmt `/architektur pruefen` mit).
- **Keine Härtung der Härtung**: Reviews einer Karte, die selbst aus Befunden entstanden ist, melden nur Muss.
- **Wackler**: ein neuer Wackler wird Kommentar an #139, keine eigene Karte. Ein Test, der unter einer benennbaren Bedingung immer scheitert (Wochentag, Uhrzeit), ist kein Wackler, sondern ein Bug.
- **Prüfende Rollen** bekommen im Auftrag die Liste oben mit. Was dort schon steht oder hier verworfen ist, melden sie nicht erneut.

### Auslieferung bei Erledigt (Betreiber 2026-10-31)

Das Board, das der Betreiber für das Projekt beobachtet, ist zugleich die Instanz, auf der er die neuen Features sieht. Nach jedem Zug nach „Erledigt“:

1. `cargo install --path /home/shoff/Projekte/kanbanD --locked` (installiert nach `~/.cargo/bin/kanbanD`);
2. die Board-Instanz neu starten: alte PID beenden, `~/.cargo/bin/kanbanD /home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard --port 7422 --kein-browser` neu starten (losgelöst, PID in `.claude/factory/board.pid` des Projekts), `GET /api/zustand` muss antworten;
3. eine Logbuchzeile mit Version bzw. Commit. Schlägt die Installation fehl, bleibt die alte Instanz laufen, und die Karte wird eine Befundkarte.

Rückmeldungen gibt der Betreiber von sich aus („wenn ich was zu nörgeln habe, sage ich es“). Sie werden über den PO zu Karten im Backlog.

### Signal „Ich habe Fragen“ (Betreiber 2026-10-31)

Hat der Director eine Frage, die der Betreiber entscheiden muss (richtungsweisend laut product-owner, Konflikt mit der Vision), setzt er auf der betroffenen Karte das Signal `frage` („Ich habe Fragen“, orange; steht in der Reihenfolge der Signale vorn, die Karte trägt also seine Farbe) und schreibt die Frage als Kartenkommentar: ein Satz Kontext, nummerierte Optionen, Empfehlung zuerst. Dieselbe Frage stellt er auch in der Session. Ist sie beantwortet, nimmt er das Signal zurück und vermerkt die Antwort als Kommentar. Fragen ohne Karte bekommen eine Karte „Frage: …“ oben im Backlog.

### Token-Kosten je Karte (Betreiber 2026-10-31)

Nach jedem Rollenauftrag notiert der Director das Token-Volumen aus der Abschlussmeldung des Subagents; beim Zug nach „Erledigt“ steht auf der Karte ein Kommentar „Token-Kosten der Karte“ mit einer Zeile je Rollenauftrag und der Summe. Der Anteil des Directors ist nicht messbar und wird nicht geschätzt. Einmalige Aufträge für das ganze Board (z. B. eine Durchsicht) werden getrennt genannt, nicht auf eine Karte gerechnet. Die Logbuchzeile je Auftrag nennt die Tokens in der Notiz.

### Preisetikett je Karte (Betreiber 2026-10-31)

Sobald kanbanD ein Preisetikett an Aufgaben kennt (Wunsch des Betreibers vom 2026-10-31, beim product-owner in Klärung), stattet der Director **jede** Karte damit aus: beim Zug nach „Erledigt“ den Preis, der den API-Kosten entsprochen hätte (Grundlage: die Token-Kosten der Karte, Preise des verwendeten Modells, Annahme zur Aufteilung genannt). Bis dahin stehen Token-Kosten **und Preis** als Kartenkommentar (Betreiber 2026-10-31): Preis als API-Gegenwert mit Modellpreisen; lässt er sich nicht genau sagen, als Spanne von–bis (Betreiber 2026-10-31), mit der Annahme dahinter (heute: plausibel 85 % Cache-Lesen / 10 % Input / 5 % Output, Spanne alles-Cache bis alles-Output).

### Kosten messen: Einzel- und Gemeinkosten (Betreiber 2026-10-31)

- **Einzelkosten** einer Karte werden gemessen, nicht geschätzt: `python3 werkzeuge/token_kosten.py <Protokolle der Subagents dieser Karte>` (Factory); die Protokolle liegen unter `<scratchpad-elternordner>/tasks/<agent-id>.output`, die Agent-ID steht in der Logbuchzeile. Ergebnis ist eine Spanne (Cache-Schreiben 5 oder 8 $ je Mio.). Ein fortgesetzter Subagent, der mehrere Karten bedient, wird nach seinen Läufen geteilt, sonst als „einschließlich …“ genannt.
- **Gemeinkosten** (Director-Session, einmalige Aufträge für das ganze Board) stehen auf der Sammelkarte „Gemeinkosten: Director und Einmaliges“, je Tag fortgeschrieben; die Director-Session wird über ihr Protokoll `~/.claude/projects/-home-shoff-Projekte-Software-Factory/<session>.jsonl` gemessen.
- **Preis-Kommentar** beim Zug nach „Erledigt“: „Preis: <von>–<bis> USD · Basis: …“ mit den Einzelkosten je Rolle, dazu getrennt „Gemeinkostenanteil: … USD (Zuschlag … % nach Einzelkosten)“.
- Die Abschlussmeldungen der Subagents (Token-Summe) zählen das Cache-Lesen nicht und unterschätzen stark; sie werden nicht mehr für Preise benutzt.

### Freigabe von Artboards (Betreiber 2026-11-07)

Artboards und Skizzen gibt der product-owner frei, bevor gebaut wird (Vision R00000, Leitplanke „Jede Gestaltung wird freigegeben“). Der Director legt sie ihm vor, nicht dem Betreiber; der PO protokolliert die Freigabe in `po-entscheidungen.md`. Der Betreiber darf weiterhin selbst freigeben, muss es aber nicht.

### Logging

Ziel stderr und `~/.local/state/kanbanD/<ordnername>/kanbanD.log`, nie im Board-Ordner (Git); Rotation täglich, Aufbewahrung 14 Tage; Standardstufe Information, umschaltbar `--log <stufe>` bzw. `KANBAND_LOG`; Stufen Debug · Information (Start, Commit je Aktion mit Wer/Instanz) · Warning (abgewiesene Züge 403/409, defekte Dateien) · Error (Fachlogik) · Exception (Programmfehler, Panik); keine Inhalte von Beschreibungen und Kommentaren. Heute nur `eprintln!` — ADR durch den architekt, sobald eine Karte Fehlerpfade berührt (Betreiber 2026-10-31)

## Rollen

| Rolle | Kürzel | Treiber | Modell | Einsatz |
|---|---|---|---|---|
| product-owner | po | opencode | openrouter/deepseek/deepseek-v4.1-flash | Rückfragen der Rollen im Sinne der Vision entscheiden, Protokoll `AI-Team/po-entscheidungen.md`; vertritt den Betreiber auch gegenüber dem realist-consultant (`auftrag.md`, „Einsatz des realist-consultant“) |
| realist-consultant | real | opencode | openrouter/deepseek/deepseek-v4.1-flash | berät den PO bei jedem neuen inhaltlichen Auftrag; Schleifenbremse |
| planer | plan | claude | fable | Detailplanung: R00095–R00100 als WBS-Knoten einhängen, Interaction bis Bubble verfeinern, Anforderung schreiben; Befunde einplanen |
| architekt | arch | claude | fable | Architektur-Modell anlegen (fehlt), ADRs zu den Regeln am Schreibweg (Sperre → Prüfung → Commit: Grenze, Eigentümer, Schlüssel) und zum Logging |
| architektur-reviewer | arev | opencode | openrouter/deepseek/deepseek-v4.1-flash | Pakete gegen Modell und ADRs, nur wenn sie Schreibweg oder Modell berühren |
| entwickler | entw1 | claude | fable | Interactions bauen, Test zuerst, Gate; WIP 1; entw2 (Nacharbeit): Muss-Befunde im Worktree der Karte; im Sparbetrieb nur, wenn entw1 nicht baut |
| code-reviewer | crev | claude | sonnet | Korrektheit, Tests, Wartbarkeit je Paket; anderes Modell als der Erbauer (Modellverteilung, Betreiber 2026-11-14) |
| security-reviewer | srev | claude | sonnet | Full-Trust über `X-KanbanD-Wer`, neue 403/409-Grenzen, Eingaben von außen (Routen, Anhänge, Markdown-Darstellung) |
| entwicklertester | etst | opencode | openrouter/deepseek/deepseek-v4.1-flash | User Story im echten Programm (Browser und API) auf einer Wegwerf-Instanz |
| ux-reviewer | ux | opencode | openrouter/deepseek/deepseek-v4.1-flash | Oberfläche mit Material 3 als Referenz, Tastatur, Barrierefreiheit; Vorprüfung in der Detailplanung |
| rechtschreib-reviewer | rsr | opencode | openrouter/deepseek/deepseek-v4.1-flash | deutsche Oberfläche, Fehlermeldungen, API-Beschreibung, Anforderungen |
| legacy-reviewer | leg | opencode | openrouter/deepseek/deepseek-v4.1-flash | bestehende Board-Ordner (`~/Projekte/Kanban-Boards/*`) und Agenten-Clients (`kanband.py` der Factory) öffnen und nutzen nach jeder Änderung an Dateiformat oder API weiter |
| observability-reviewer | obs | opencode | openrouter/deepseek/deepseek-v4.1-flash | Logging gegen das Konzept in `umgebung.md`, nur bei neuen Fehlerpfaden oder Protokollzeilen |
| fachspezialist | fach | opencode | openrouter/deepseek/deepseek-v4.1-flash | Glossar unter `Dokumentation/Domaenenwissen/` anlegen und pflegen, Benennung neuer Begriffe |
| gestalter | ges | opencode | openrouter/deepseek/deepseek-v4.1-flash | Dialog-Artboards und Skizzen unter `Dokumentation/Wireframes/` in der entschiedenen Richtung verfeinern (`/wireframe verfeinern`), vor dem Bau; der product-owner gibt frei (Betreiber 2026-11-11) |

## Spalten

| Spalte | Art | Beschreibung |
|---|---|---|
| Ohne Mensch nicht lösbar | Mensch | Schleifen und Entscheidungen, die der Betreiber treffen muss |
| Backlog | Mensch | Sammlung; der Betreiber gibt frei, indem er Karten nach „Architektur“ legt; hier liegen auch die Karten „Besprechen: …“ aus PO und realist-consultant |
| Architektur | Team | prüfen, ob die Karte eine Technikfrage aufwirft; wenn ja entscheiden und als ADR festhalten, sonst sofort weiter; die erste Karte bringt das Architektur-Modell |
| Detailplanung | Team | WBS-Knoten anlegen bzw. Interaction bis Bubble verfeinern, Anforderung schreiben oder abgleichen; ux-reviewer nur als Vorprüfung bei Oberfläche; fachspezialist auf Abruf bei neuen Begriffen; der planer setzt die zutreffenden Labels der Karte: „oberflaeche“ (sichtbare Änderung der Oberfläche → ux-reviewer), „text“ (neuer oder geänderter sichtbarer Text, API-Beschreibung → rechtschreib-reviewer), „sicherheit“ (Full-Trust über `X-KanbanD-Wer`, neue 403/409-Grenzen, Eingaben von außen → security-reviewer), „fehlerpfad“ (neue Fehlerpfade oder Protokollzeilen → observability-reviewer), „architektur“ (Schreibweg oder Modell → architektur-reviewer), „datenformat“ (Dateiformat des Board-Ordners oder API → legacy-reviewer), „begriffe“ (neue Fachbegriffe → fachspezialist) — nur danach laufen die Prüfer dieser Themen |
| Entwicklung | Team | bauen, Test zuerst, Gate (`cargo test`, `node --test e2e/einheit/`, betroffene Playwright-Specs; volle Suite am Kartenende) |
| Nacharbeit | Team | Muss-Befunde aus Auto-Reviews und Entwicklertest beheben, Sollte/Optional entscheiden (beheben oder verwerfen, siehe „Befunde aus Reviews und Tests“) (`entw2`, im Worktree der Karte), danach zurück in die Auto-Reviews, nur Rollen mit Befund wiederholen |
| Auto-Reviews | Team | Reviews parallel am selben Stand, je Rolle eine Teilaufgabe; code-reviewer immer, die übrigen nur, wenn die Karte ihr Thema berührt (Auswahl im Kommentar des Directors beim Zug) |
| Entwicklertest | Team | User Story wörtlich im echten Programm auf einer Wegwerf-Instanz |
| Erledigt | Mensch | fertig: nach bestandenem Entwicklertest direkt hierher, ohne Abnahme-Spalte; beim Zug installiert der Director kanbanD neu und startet das Board neu (siehe „Auslieferung“); letzte Spalte, Abschlussspalte der Berichte |

## Ablauf

Je Team-Spalte: was ausgelöst wird, wenn eine Karte sie betritt, und wie danach entschieden wird. Für alle Spalten gilt:

- **Frage einer Rolle** → product-owner entscheidet (höchstens 2 Runden, blockiert die Karte so lange); nur Richtungsweisendes und danach noch Offenes → „Ohne Mensch nicht lösbar“ mit Signal `frage`.
- **Schleifenbremse**: steht bei einer Entscheidung „höchstens n×“, geht die Karte danach nach „Ohne Mensch nicht lösbar“ — vorher ein Vorschlag des realist-consultant auf die Karte.
- **Ein Worktree je Karte** für alle Phasen (R00013): `board.py beginne` legt ihn an (`~/Projekte/.worktrees/<projekt>/karte-<nr>`, Zweig `karte/<nr>`) und nennt ihn im Auftragskopf; Worktrees je Rolle und die Zweige `vorlauf/…`, `nacharbeit/…` gibt es nicht mehr.
- **Zusammenführen** heißt immer: Merge-Wache des Directors — Dokumente nach bestandener Detailplanung ohne Gate (`board.py dokumente`), der Code **einmal am Ende**, bevor die Karte die Team-Spalten verlässt: Rebase, Diff-Prüfung, Stand von `main` festhalten, Fast-Forward, volles Gate auf `main`; grün → Worktree und Zweig löschen, rot → `main` zurück auf den festgehaltenen Stand und Nacharbeit.
- **Rechnerlast**: über der Grenze (`last.grenze_prozent`) beginnt kein Lauf; die Karte trägt dann „Wartet auf Systemressourcen“, die Wartezeit wird aufgezeichnet (`board.py wartezeit`).
- **Störung des Treibers** (Anmeldung, Kontingent, Dienst) ist kein Ergebnis der Rolle: der Lauf hält an, die Karte bleibt, wo sie ist.
- **Labels der Karte** setzt der planer in der Detailplanung: `oberflaeche`, `text`, `sicherheit`, `fehlerpfad`, `architektur`, `datenformat`, `begriffe`. Nur danach laufen die Rollen dieser Themen (Sparbetrieb).

### Architektur
- **Betritt die Karte die Spalte**: architekt prüft, ob die Karte eine Technikfrage aufwirft; wenn ja, entscheidet er und hält es als ADR fest, sonst sofort weiter. Wissen im Auftrag: Lastprofil.
- **Entscheidung**
  - bestanden → Detailplanung
  - Muss offen → Ohne Mensch nicht lösbar („Architektur: Muss offen“)

### Detailplanung
- **Betritt die Karte die Spalte**, nacheinander. Wissen im Auftrag: Freigabe von Artboards.
  - planer verfeinert bis Bubble, schreibt die Anforderung und setzt die Labels
  - fachspezialist klärt neue Begriffe, wenn Label `begriffe`
  - ux-reviewer als Vorprüfung der Anforderung, wenn Label `oberflaeche`
- **Entscheidung**
  - Vorprüfung bestanden oder nicht nötig → Entwicklung
  - Muss der Vorprüfung → bei sichtbarer Gestaltung zeichnet der gestalter, der product-owner gibt frei (Betreiber 2026-11-13, #138); dann arbeitet der planer die Befunde samt Freigabe ein, danach prüft nur der ux-reviewer nach; höchstens 2×

### Entwicklung
- **Betritt die Karte die Spalte**: entwickler baut im Worktree der Karte (Zweig `karte/<nr>`), Test zuerst, und fährt dort das volle Gate.
- **Entscheidung**
  - bestanden (Gate im Worktree grün, Zahlen im Bericht) → Auto-Reviews
  - Bau nicht bestanden oder Gate im Worktree rot → Nacharbeit; höchstens 2× („Gate bleibt rot nach zwei Nacharbeiten“)

### Nacharbeit
- **Betritt die Karte die Spalte**: entwickler behebt nur die Muss-Befunde, die wörtlich auf der Karte stehen, im Worktree der Karte. Wissen im Auftrag: Befunde aus Reviews und Tests.
- **Entscheidung**
  - bestanden → zurück in die Spalte, aus der die Karte kam — dort wiederholen nur die Rollen mit Befund
  - Gate nach der Nacharbeit rot → Ohne Mensch nicht lösbar

### Auto-Reviews
- **Betritt die Karte die Spalte**: parallel am Stand des Kartenzweigs (Diff `main...karte/<nr>`, im Worktree nur lesend), je Rolle eine Teilaufgabe, abgehakt, wenn sie bestanden hat. Wissen im Auftrag: Befunde aus Reviews und Tests.
  - code-reviewer immer
  - security-reviewer, wenn Label `sicherheit`
  - ux-reviewer, wenn Label `oberflaeche`
  - rechtschreib-reviewer, wenn Label `text`
  - architektur-reviewer, wenn Label `architektur`
  - legacy-reviewer, wenn Label `datenformat`
  - observability-reviewer, wenn Label `fehlerpfad`
- **Entscheidung**
  - alle bestanden → Entwicklertest
  - Muss → Nacharbeit; höchstens 2×
  - `anforderung_falsch` oder `kriterium_fehlt` → Detailplanung
  - Sollte und Optionales → nie Karte, hält nichts auf; die Nacharbeit derselben Karte entscheidet: beheben oder verwerfen, mit Grund (siehe „Befunde aus Reviews und Tests“)

### Entwicklertest
- **Betritt die Karte die Spalte**: entwicklertester fährt die User Story wörtlich im echten Programm, am reviewten Stand des Kartenzweigs. Wissen im Auftrag: Befunde aus Reviews und Tests.
- **Entscheidung**
  - bestanden → Zusammenführen (Gate auf `main`; rot → Nacharbeit); grün → Auslieferung (`bash AI-Team/ausliefern.sh`, höchstens 20 Minuten: kanbanD aus main installieren und die Board-Instanz neu starten); gelingt sie → Erledigt; schlägt sie fehl → Ohne Mensch nicht lösbar („Auslieferung fehlgeschlagen — die alte Board-Instanz läuft weiter“)
  - Muss → Nacharbeit; höchstens 2×
  - `anforderung_falsch` oder `kriterium_fehlt` → Detailplanung
