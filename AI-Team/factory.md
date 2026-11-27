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

- **Gate**: `cargo test && cargo test --features lizenzen --lib && node --test "e2e/einheit/*.js" && (cd e2e && npx playwright test)`
- **Installieren**: `cargo build --release`; E2E: `cd e2e && npm install && npx playwright install chromium`
- **Dienste starten**: `target/release/kanbanD <wegwerf-ordner> --port <frei> --kein-browser` (Skill `freier-port`); nie die Board-Instanz auf Port 7422
- **Rechner seit 2026-11-15** (Ubuntu 26.04, Node 22, Rust 1.100, Playwright 1.65.1 seit #170): Node 22 nimmt für `--test` keinen Ordner an, deshalb das Muster `"e2e/einheit/*.js"`. Ein Override für Playwright ist nicht mehr nötig und darf in keinem Auftrag stehen. Die volle Playwright-Suite treibt die Last mit 4 Workern allein auf etwa 10: volle Läufe allein und nacheinander fahren.
- **Board im Netz** (Betreiber 2026-11-15): Die Board-Instanz auf Port 7422 lauscht bewusst an allen Netzwerkschnittstellen (`0.0.0.0`, Voreinstellung von kanbanD) und bleibt so — der Betreiber will sie von anderen Geräten im eigenen Netz erreichen. Kein Befund für prüfende Rollen; Wegwerf-Instanzen der Rollen starten trotzdem mit `--host 127.0.0.1`.
- **Health-Check**: `GET http://127.0.0.1:<port>/api/zustand` antwortet mit JSON
- **Zum Gate**: `cargo test` · `cargo test --features lizenzen --lib` (Unit-Tests des Lizenz-Generators, #250) · `node --test "e2e/einheit/*.js"` · `cd e2e && npx playwright test`
- **Pfade**: `~/.cargo/bin`; Node für E2E unter `e2e/`; Board der Factory `http://127.0.0.1:7422`, Ordner `/home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard`; Auslieferung `cargo install --path . --locked` (siehe `prozess.md`)

## Rechnerlast

- Höchstens etwa 75 % Systemlast, immer; vor jedem Start einer Rolle, eines Builds oder des Gates prüfen.
- Rollen gleichzeitig: 1 entwickler; daneben 1 Vorlauf-Rolle (architekt oder planer) und die prüfenden Rollen des Betriebs, solange die Lastgrenze hält
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

- **Vorlauf** (Betreiber 2026-11-15, ersetzt „Nacheinander“ vom 2026-10-31): Der entwickler bleibt der Engpass mit WIP 1. Während er baut, bereiten architekt und planer die nächsten Karten vor; in „Detailplanung“ liegt ein Puffer von höchstens 2 baufertigen Karten, in den Puffer kommt nur, was kein offenes `braucht:` hat oder dessen Vorgängerin mindestens in der Entwicklung ist. Die nächste Karte geht in die Entwicklung, sobald die vorige in die Auto-Reviews gezogen ist. Nacharbeit einer Karte geht vor dem Bau der nächsten. Zusammengeführt wird in der Reihenfolge, in der die Karten den Entwicklertest bestehen, nie zwei Merge-Wachen zugleich; nach jedem Zusammenführen bringen laufende Karten ihren Zweig auf den Stand von `main`. Neue Nummern (R, I, B, ADR) vergibt je Karte nur, wer vorher den Stand von `main` geholt hat.
- **Kleine Karten bündeln** (Betreiber 2026-11-15; seit demselben Tag begrenzt durch „Schlank arbeiten“, Abschnitt C: höchstens drei Karten, fertige Mitglieder einzeln ausliefern): Der product-owner legt kleine Karten, die dieselben Dateien oder dieselbe Ansicht berühren, zu Paketen von höchstens fünf zusammen. Eine Karte führt das Paket (ihr Kommentar nennt die Mitglieder), die übrigen tragen den Kommentar „wird mit #<nr> gebaut“ und bleiben in „Architektur“ liegen. Geplant, gebaut, geprüft und zusammengeführt wird einmal am Worktree der führenden Karte; die Anforderung nennt je Mitglied eigene Akzeptanzkriterien, die Rollen berichten je Mitglied. Besteht das Paket, ziehen alle Mitglieder gemeinsam nach „Erledigt“. Scheitert ein Mitglied zweimal in der Nacharbeit, löst der Director es aus dem Paket (eigene Karte, eigener Lauf), damit die übrigen fertig werden. Nicht gebündelt wird, was Datenformat, Zugriffsgrenzen oder eine eigene Technikfrage berührt.
- **Sparsam prüfen** (die Auswahl der Rollen regelt seit 2026-11-15 „Schlank arbeiten“, Abschnitt B): In den Auto-Reviews läuft `code-reviewer` immer, jede andere Rolle nur, wenn die Karte ihr Thema nachweislich berührt. Eine Wiederholung gibt es nur für Rollen mit Befund. Befunde, die nur über künstliche Fehlerinjektion erreichbar sind, gelten als `Sollte`; was mit `Sollte` und `Optional` geschieht, regelt „Befunde aus Reviews und Tests“.
- **Knappe Aufträge**: Der Director nennt jeder Rolle die Dateien und Abschnitte, die sie braucht, statt sie suchen zu lassen. Die Berichte bleiben im Berichtsformat, ohne Wiederholungen.
- **Rollen fortsetzen statt neu starten** (Betreiber 2026-10-31): planer, architekt, product-owner und entwickler werden für die nächste verwandte Karte bzw. für Nachträge per SendMessage fortgesetzt, solange ihr Kontext unter etwa 150.000 Tokens liegt (Wert aus der letzten Abschlussmeldung); darüber und bei fremdem Codebereich frisch starten. Prüfende Rollen (Reviews, Entwicklertest) starten je Karte frisch — der unabhängige Blick ist gewollt; nur ihre Wiederholung nach Nacharbeit an derselben Karte wird fortgesetzt. Die Agent-ID je Rolle hält der Director in der Logbuchzeile fest.
- **Reihenfolge der Karten** (Betreiber 2026-10-31, nach der UX-Durchsicht): erst #7/#14 (R00101), dann R00095 → R00096 → R00097 → R00098 → R00099 → R00100, danach die übrigen UX-Karten (#8–#13, #15, #16); Features der Wartungsfabrik bringen den größten Nutzen je Token.

### Schlank arbeiten (Betreiber 2026-11-15)

Anlass: Am 2026-11-15 war gut ein Drittel der Kosten Arbeit ohne Nutzen — Planung für eine Karte, die nicht gebaut wurde (#45, 26 $), Entscheiden und Aufschreiben als getrennte Läufe (#54: neun Läufe des product-owner, sechs des planers), Reviews ohne Fund, und ein Befund, der kein Fehler des Programms war, sondern ein eine Stunde alter Satz der Anforderung. Diese Regeln **gehen den älteren Abschnitten vor**, wo sie ihnen widersprechen (Sparbetrieb, Befunde aus Reviews und Tests, Ablauf).

**Vorrang vor allem Folgenden — Zügig bauen (Betreiber 2026-11-15, abends):** „Ich möchte, dass die Architektur-Karten zügig implementiert werden. Bitte nur die kritischsten Muss Befunde (Sicherheit / Nutzer bedroht) gelten lassen. Alles andere ist nicht notwendig.“
- **Muss ist nur noch**, was die Sicherheit verletzt (Zugriffsgrenze umgangen, Eingabe von außen richtet Schaden an, Geheimnis offen) oder den Nutzer schädigt (Datenverlust oder falscher Stand in Datei oder Git, Programm nicht mehr bedienbar, Absturz). Nur das löst eine Nacharbeit aus.
- **Alles andere** — verletzter Wortlaut eines Kriteriums ohne Schaden, fehlende Probe, Barrierefreiheit ohne Sperre, Texte, Stil, Architektur-Drift, Wackler — steht als eine Zeile im Kartenkommentar und hält nichts auf. Keine Rückfrage dazu an den product-owner.
- **Karten aus „Architektur“ gehen auf dem kürzesten Weg in den Bau**: Architektur und Detailplanung in je einem kurzen Lauf, die Anforderung mit wenigen beobachtbaren Kriterien; kein Lauf des realist-consultant und keine Angriffsmatrix vor dem Bau, außer die Karte öffnet eine Zugriffsgrenze.
- **Reviews**: `code-reviewer` immer, `security-reviewer` nur bei Zugriffsgrenze oder Eingabe von außen, `ux-reviewer` nur bei neuer sichtbarer Bedienung. Entwicklertest nur, wenn die Karte Verhalten für den Nutzer ändert. Die prüfenden Rollen bekommen diese Muss-Schwelle wörtlich in den Auftrag.

**A. Schlank planen**
- **Höchstens etwa zehn Akzeptanzkriterien je Anforderung**, alle für Mensch oder Agent beobachtbar (was er sieht, was in Datei und Git steht, was die API antwortet). Braucht eine Karte mehr, ist sie zu groß und wird geschnitten. Grenzfälle, Mutanten, Reihenfolgen im Code und Testmittel gehören dem entwickler, nicht in die Anforderung; die Anforderung nennt keine Mutantenliste.
- **Probe vor dem Kriterium**: Ist eine Technik entschieden, aber nicht am laufenden Programm ausprobiert, fährt der entwickler zuerst eine Probe von höchstens einer halben Stunde am Programm und berichtet, bevor der planer Kriterien schreibt. Aussagen „am Code gelesen, nicht gefahren“ sind kein tragfähiger Grund für ein Kriterium.
- **Wer entscheidet, schreibt auf**: Der product-owner arbeitet seine Entscheidung selbst in Anforderung und User Story ein (`/anforderung abschliessen`, im Worktree der Karte; `beginne` dann ohne `--ohne-worktree`) und protokolliert sie in `po-entscheidungen.md`. Ein eigener Lauf des planers nur dafür entfällt; der planer kommt nur, wenn sich WBS-Knoten oder der Zuschnitt ändern.
- **Fragen sammeln**: Der Director bündelt die Fragen einer Karte zu einem Lauf des product-owner je Station, statt je Frage einen Lauf zu starten; Bestätigungsfragen mit Empfehlung, die nichts aufhalten, entscheidet der Director nach der Empfehlung und nennt sie im Kartenkommentar.

**B. Prüfen nach Risiko**
- **Auswahl nach dem Diff**: In den Auto-Reviews läuft der `code-reviewer` immer. Jede weitere prüfende Rolle wählt der Director nach dem, was der Diff tatsächlich ändert — Oberfläche sichtbar geändert → `ux-reviewer`; Zugriffsgrenze, Eingabe von außen oder Abhängigkeit → `security-reviewer`; mehr als eine Handvoll neuer sichtbarer Texte → `rechtschreib-reviewer`; Server schreibt neue Fehlerpfade oder Protokollzeilen → `observability-reviewer`; Dateiformat oder API-Form → `legacy-reviewer`; neuer Schnitt, neue Abhängigkeitsrichtung oder ADR-Verstoß möglich → `architektur-reviewer`. Die Labels aus der Planung sind Hinweis, nicht Auslöser. Die Auswahl mit Grund steht im Zugkommentar.
- **Wiederholung nach einer Nacharbeit prüft genau zwei Dinge**: Ist der eigene Befund geschlossen (Abnahme-Probe wörtlich erfüllt), und hat die Nacharbeit etwas kaputt gemacht, das der Nutzer bemerkt? Keine neue Durchsicht des ganzen Pakets, keine neuen Sollte.
- **Ein Kriterium aus der Nacharbeit löst kein neues Muss aus**: Weicht das Programm vom Wortlaut eines Kriteriums ab, das erst während der Nacharbeit dieser Karte geschrieben wurde, ist das nur dann ein Muss, wenn dem Nutzer daraus ein Schaden entsteht (Datenverlust in Datei oder Git, falscher angezeigter Stand, Sperre, Sicherheitslücke). Sonst berichtigt der product-owner den Satz, und die Karte läuft weiter.
- **Muss bleibt Muss**: Was über Oberfläche oder API im normalen Betrieb einen Fehler zeigt oder ein Kriterium der ursprünglichen Anforderung verletzt, geht wie bisher in die Nacharbeit.

**C. Kleiner schneiden, früher fragen**
- **Pakete höchstens drei Karten**, und nur, wenn sie dieselbe Stelle im Code ändern. Ein fertiges, für sich prüfbares Mitglied wird einzeln zusammengeführt und ausgeliefert, sobald es die Reviews bestanden hat; es wartet nicht auf die übrigen.
- **Zum Betreiber, bevor geplant wird**: jede Karte mit „Besprechen:“ im Titel; jede Auslegung einer Entscheidung des Betreibers (insbesondere, wenn seine Begründung allgemeiner ist als seine Anweisung); jeder Widerspruch zwischen einer Betreiber-Entscheidung und der Vision; jede Lesart, bei der dem Nutzer etwas still verloren geht. Der product-owner darf eine Empfehlung dazuschreiben, aber nicht abschließen. Eine Frage je Runde, mit einem Beispiel in Alltagssprache.
- **Erst zeichnen, dann direkt bauen** (Betreiber 2026-11-16, wörtlich: „Erst zeichnen, aber dann direkt fortfahren. Bitte als generelle Richtlinie merken.“): Bekommt eine Karte neue sichtbare Bedienung, zeichnet der `gestalter` den Zustand zuerst am Artboard des Dialogs (`Dokumentation/Wireframes/D….dc.html`, in einem kurzen Lauf). Danach geht die Karte ohne Vorlage beim Betreiber, ohne Freigabe-Halt durch den product-owner und ohne Signal `frage` direkt in den Bau; die Zeichnung ist Vorgabe für den entwickler. Der Director nennt Datei und Anker im Bericht.
- **50-Dollar-Regel** (Betreiber 2026-11-15, abends; ersetzt die Kostenbremse des Directors): „Alle Aufgaben, die mehr als 50 $ gekostet haben, werden zielstrebig gegated und abgeschlossen, es werden keine weiteren Befunde aufgenommen. Sollte das Gate nicht klappen und fehlschlagen, werden diese Aufgaben nach ‚Mensch benötigt‘ verschoben, der Worktree wird bestehen gelassen, es wird mit anderen Aufgaben fortgefahren. Anscheinend liegt bei diesen Aufgaben ein schwereres Problem vor und ein Mensch sollte gucken.“ So wird sie angewandt:
  - **Maß** ist die Summe auf dem Preisetikett der Karte (`board.py karte <nr>`, „Kosten“); der Director prüft sie nach jedem `beende`. Bei einem Paket zählt die führende Karte.
  - **Über 50 $**: Der laufende Rollenlauf arbeitet bis zu einem sauberen, committeten Stand zu Ende; danach startet keine weitere prüfende, planende oder beratende Rolle mehr an der Karte. Offene und neue Befunde werden nicht mehr aufgenommen — auch kein Muss; sie stehen als eine Zeile im Kartenkommentar. Der Director geht direkt in die Merge-Wache (vorbereiten, Diff auf Fremdes und Secrets, zusammenführen) und fährt das volle Gate auf `main`.
  - **Gate grün** → Auslieferung und „Erledigt“ wie sonst.
  - **Gate rot** (auch nach einem zweiten vollen Lauf bei ruhiger Last, um einen Wackler auszuschließen) → `wache <nr> zurueck`, `main` steht wieder auf dem Stand davor; die Karte geht nach **„Ohne Mensch nicht lösbar“** (das ist auf diesem Board die Spalte „Mensch benötigt“) mit Signal `frage` und einem Kommentar: Kosten, was gebaut ist, was am Gate rot war, wo der Worktree liegt. Der Worktree und der Zweig bleiben stehen. Keine Nacharbeit, kein weiterer Versuch. Der Director fährt mit der nächsten Karte fort.
  - **Ist der Bau über 50 $ noch nicht fertig** (Bubbles offen) und ein grünes Gate im Worktree nicht mit dem laufenden Lauf zu erreichen, gilt das wie ein rotes Gate: nach „Ohne Mensch nicht lösbar“, Worktree bleibt.

### Modellverteilung (Betreiber 2026-11-14)

- **Wie gitreviewA** (Betreiber 2026-11-26, wörtlich: „Bitte konfiguriere die rollen LLMs so wie in der Factory für ~/Projekte/gitreviewA“; ersetzt alle folgenden Zeilen): alle Rollen außer dem Director über Treiber `opencode` mit `openrouter/deepseek/deepseek-v4.1-flash`; Ausnahmen über Treiber `claude`: `product-owner` immer mit Sonnet; `security-reviewer` bei Label `sicherheit` mit Sonnet; `planer` bei der Detailplanung neuer Interactions mit Sonnet (Opus nach den Merkmalen in der Rollentabelle). Ein einzelner Lauf kann mit `beginne --treiber claude` abweichen, Grund im Zugkommentar. Laufende Claude-Läufe arbeiten zu Ende.

DeepSeek ist der Standard für die übrigen Rollen, Claude steht dort, wo ein Fehler teuer ist oder ein zweites, anderes Modell mehr sieht. Anlass: Woche bis 2026-11-12 mit Claude Opus 47,89 $ je Karte (48 Karten); seit 2026-11-13 mit DeepSeek 0,48 $ (#80) und 1,03 $ (#43) je Karte, 29 Läufe ohne falschen Bericht, aber zwei ungültige Ergebnisblöcke des code-reviewers und ein Widerspruch in der Planung (#138, AK 19 gegen AK 20).

- **Opus und Sonnet statt Fable** (Betreiber 2026-11-18, wörtlich: „Bitte switche alles auf Opus oder Sonnet“; ersetzt die Zeile zu Fable darunter): `product-owner`, `realist-consultant`, `planer`, `architekt` auf **Opus**; `entwickler` nach der Prüfliste des Directors je Karte (Opus bei Datenmodell, Migration, Sicherheit, Nebenläufigkeit, unklarer Ursache, neuem Muster oder mehr als etwa 5 Bubbles, sonst Sonnet; Label `opus-entwickler`/`sonnet-entwickler`); alle prüfenden Rollen, `fachspezialist` und `gestalter` auf **Sonnet**. Laufende Fable-Läufe arbeiten zu Ende.
- **Alle Rollen auf Claude Fable 5.2** (Betreiber 2026-11-15, nach der Verlegung auf den neuen Rechner; ersetzt die folgenden Zeilen zu Sonnet, DeepSeek und opencode): jede Rolle läuft als Claude-Subagent mit dem Modell `fable`, auch `code-reviewer`, `security-reviewer` und die bisher über opencode besetzten Rollen. Der Vergleich unter „Messen“ ruht so lange.
- **Fest auf Claude Sonnet**: `code-reviewer` (läuft bei jeder Karte, letztes Tor vor dem Entwicklertest, anderes Modell als der Erbauer) und `security-reviewer` (selten, ein übersehener Fehler ist teuer). Der Director bleibt Claude.
- **Fest auf Claude Fable 5.2** (Betreiber 2026-11-15): `planer`, `architekt` und `entwickler`, Bau und Nacharbeit (`entw1`, `entw2`). Anlass: Am 2026-11-14 rissen zwei DeepSeek-Bauläufe die Zeitgrenze und einer lief 85 Minuten in einer Leseschleife ohne Änderung.
- **Umschalten je Lauf**: Soll ein einzelner Lauf über den anderen Treiber oder ein anderes Modell laufen, `board.py beginne <nr> --rolle <r> --treiber claude|opencode [--modell <m>]` (Factory seit 2026-11-14); die Entscheidung steht im Zugkommentar.
- **Alle übrigen Rollen** bleiben auf DeepSeek.
- **Messen**: nach etwa zehn Karten Nacharbeiten je Karte und Kosten je Karte aus dem Logbuch vergleichen, vorher gegen nachher.

### Befunde aus Reviews und Tests (Betreiber 2026-11-12)

Anlass: Der Backlog war auf 66 Karten gewachsen, rund die Hälfte davon Härtungskarten, Wackler und Dubletten; bei der Durchsicht am 2026-11-12 blieben 30. Die Regeln verhindern, dass Befunde ohne Nutzerwirkung wieder geparkt werden.

- **Muss** geht wie bisher in die Nacharbeit derselben Karte.
- **Sollte und Optional** entscheidet die Nacharbeit derselben Karte: beheben oder verwerfen, mit einem Satz Grund im Kartenkommentar. Es gibt keine Härtungskarten mehr.
- **Akzeptanzkriterium ohne Probe** (gilt für Kriterien der ursprünglichen Anforderung; für Kriterien aus der Nacharbeit siehe „Schlank arbeiten“, Abschnitt B): Meldet eine Rolle, dass ein Akzeptanzkriterium der Karte keine Probe hat, ist das ein Muss derselben Karte, kein Sollte.
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
4. **Push und Release** (Betreiber 2026-11-26: „Wenn du eine Karte fertigstellst, dann pushe bitte nach GitHub und stelle sicher, dass der Release Flow korrekt gelaufen ist.“): nach grünem Gate auf `main` und gelungener Auslieferung `git push github main`; 8–19 Uhr zusätzlich `git push origin main --tags` (gitnas, nachts aus). Danach den Lauf von `.github/workflows/release.yml` abwarten (`gh run list --workflow release.yml -R stho32/kanbanD`, `gh run watch`) und prüfen, dass das neue Release mit Tag und Artefakten da ist (`gh release view -R stho32/kanbanD`); Tags von GitHub holen (`git fetch github --tags`). Bei reinen Dokument-Pushes läuft der Workflow nicht (paths-ignore). Schlägt der Workflow fehl: Vorrang-Karte, kein weiterer Push. Kein Force-Push, keine `karte/*`-Zweige.

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
| product-owner | po | claude | sonnet | Rückfragen der Rollen im Sinne der Vision entscheiden, Protokoll `AI-Team/po-entscheidungen.md`; vertritt den Betreiber auch gegenüber dem realist-consultant (`auftrag.md`, „Einsatz des realist-consultant“) (Claude Sonnet wie gitreviewA: mit Flash bestätigte der PO dort jede Empfehlung ungeprüft) |
| realist-consultant | real | opencode | openrouter/deepseek/deepseek-v4.1-flash | berät den PO bei jedem neuen inhaltlichen Auftrag; Schleifenbremse |
| factory-optimizer | fopt | opencode | openrouter/deepseek/deepseek-v4.1-flash | Spalte „Factory-Optimizer“: je ausgelieferter Karte ein Optimierungsschritt der Factory nach ausgeloster Eigenschaft (Cheaper, Safer, Faster), höchstens 30 Minuten, ohne Verschlechterung der anderen (Betreiber 2026-11-26) |
| planer | plan | opencode | openrouter/deepseek/deepseek-v4.1-flash | Detailplanung: R00095–R00100 als WBS-Knoten einhängen, Interaction bis Bubble verfeinern, Anforderung schreiben; Befunde einplanen **Detailplanung neuer Interactions: Treiber `claude`, Modell `sonnet`; `opus`, sobald eines zutrifft: Label `sicherheit`, voraussichtlich mehr als 8 Bubbles, neues Muster ohne Vorbild im Code, mehrere Wünsche des Betreibers in einer Karte**; Folgearbeit bleibt bei Flash |
| architekt | arch | opencode | openrouter/deepseek/deepseek-v4.1-flash | Architektur-Modell anlegen (fehlt), ADRs zu den Regeln am Schreibweg (Sperre → Prüfung → Commit: Grenze, Eigentümer, Schlüssel) und zum Logging |
| architektur-reviewer | arev | opencode | openrouter/deepseek/deepseek-v4.1-flash | Pakete gegen Modell und ADRs, nur wenn sie Schreibweg oder Modell berühren |
| entwickler | entw1 | opencode | openrouter/deepseek/deepseek-v4.1-flash | Interactions bauen, Test zuerst, Gate; WIP 1; entw2 (Nacharbeit): Muss-Befunde im Worktree der Karte; im Sparbetrieb nur, wenn entw1 nicht baut |
| code-reviewer | crev | opencode | openrouter/deepseek/deepseek-v4.1-flash | Korrektheit, Tests, Wartbarkeit je Paket; anderes Modell als der Erbauer (Modellverteilung, Betreiber 2026-11-14) |
| security-reviewer | srev | opencode | openrouter/deepseek/deepseek-v4.1-flash | Full-Trust über `X-KanbanD-Wer`, neue 403/409-Grenzen, Eingaben von außen (Routen, Anhänge, Markdown-Darstellung) **Karten mit Label `sicherheit`: Treiber `claude`, Modell `sonnet`** |
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
| Entwicklung | Team | bauen, Test zuerst, Gate (`cargo test`, `node --test "e2e/einheit/*.js"`, betroffene Playwright-Specs; volle Suite am Kartenende) |
| Nacharbeit | Team | Muss-Befunde aus Auto-Reviews und Entwicklertest beheben, Sollte/Optional entscheiden (beheben oder verwerfen, siehe „Befunde aus Reviews und Tests“) (`entw2`, im Worktree der Karte), danach zurück in die Auto-Reviews, nur Rollen mit Befund wiederholen |
| Auto-Reviews | Team | Reviews parallel am selben Stand, je Rolle eine Teilaufgabe; code-reviewer immer, die übrigen nur, wenn die Karte ihr Thema berührt (Auswahl im Kommentar des Directors beim Zug) |
| Entwicklertest | Team | User Story wörtlich im echten Programm auf einer Wegwerf-Instanz |
| Factory-Optimizer | Team | nach der Auslieferung, vor „Erledigt“: der Director lost eine Eigenschaft aus Cheaper, Safer, Faster, die Rolle factory-optimizer ermittelt dafür einen Optimierungsschritt für die Factory (höchstens 30 Minuten), gestützt auf Transkripte und Commits der Karte; Eintrag mit erhofftem Gewinn in `~/Projekte/Factory-Optimierungen/factory-optimizer.log` (Betreiber 2026-11-26) |
| Erledigt | Mensch | fertig: nach bestandenem Entwicklertest und dem Factory-Optimizer hierher, ohne Abnahme-Spalte; beim Zug installiert der Director kanbanD neu und startet das Board neu (siehe „Auslieferung“); letzte Spalte, Abschlussspalte der Berichte |

## Ablauf

Je Team-Spalte: was ausgelöst wird, wenn eine Karte sie betritt, und wie danach entschieden wird. Für alle Spalten gilt:

- **Frage einer Rolle** → product-owner entscheidet (höchstens 2 Runden, blockiert die Karte so lange); nur Richtungsweisendes und danach noch Offenes → „Ohne Mensch nicht lösbar“ mit Signal `frage`.
- **Schleifenbremse**: steht bei einer Entscheidung „höchstens n×“, geht die Karte danach nach „Ohne Mensch nicht lösbar“ — vorher ein Vorschlag des realist-consultant auf die Karte.
- **Ein Worktree je Karte** für alle Phasen (R00013): `board.py beginne` legt ihn an (`~/Projekte/.worktrees/<projekt>/karte-<nr>`, Zweig `karte/<nr>`) und nennt ihn im Auftragskopf; Worktrees je Rolle und die Zweige `vorlauf/…`, `nacharbeit/…` gibt es nicht mehr.
- **Zusammenführen** heißt immer: Merge-Wache des Directors — Dokumente nach bestandener Detailplanung ohne Gate (`board.py dokumente`), der Code **einmal am Ende**, bevor die Karte die Team-Spalten verlässt: Rebase, Diff-Prüfung, Stand von `main` festhalten, Fast-Forward, volles Gate auf `main`; grün → Worktree und Zweig löschen, rot → `main` zurück auf den festgehaltenen Stand und Nacharbeit.
- **Rechnerlast**: über der Grenze (`last.grenze_prozent`) beginnt kein Lauf; die Karte trägt dann „Wartet auf Systemressourcen“, die Wartezeit wird aufgezeichnet (`board.py wartezeit`).
- **Störung des Treibers** (Anmeldung, Kontingent, Dienst) ist kein Ergebnis der Rolle: der Lauf hält an, die Karte bleibt, wo sie ist.
- **Prüfende Rollen wählt der Director nach dem Diff** (Wissen „Schlank arbeiten“, Abschnitt B); die Labels sind dafür Hinweis, nicht Auslöser.
- **Vor der Planung zum Betreiber** geht, was „Schlank arbeiten“, Abschnitt C, nennt.
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
  - bestanden → Zusammenführen (Gate auf `main`; rot → Nacharbeit); grün → Auslieferung (`bash AI-Team/ausliefern.sh`, höchstens 20 Minuten: kanbanD aus main installieren und die Board-Instanz neu starten); gelingt sie → Factory-Optimizer (sein Lauf startet schon nach dem Fast-Forward, parallel zum Gate; Erledigt erst nach grünem Gate, Auslieferung und Eintrag — Director-Regeln „Merge-Wache“); schlägt sie fehl → Ohne Mensch nicht lösbar („Auslieferung fehlgeschlagen — die alte Board-Instanz läuft weiter“)
  - Muss → Nacharbeit; höchstens 2×
  - `anforderung_falsch` oder `kriterium_fehlt` → Detailplanung

### Factory-Optimizer
- **Betritt die Karte die Spalte** (Betreiber 2026-11-26, „Cheaper, Safer, Faster“): der Director lost eine der drei Eigenschaften aus, gleich verteilt, mit `python3 -c "import random; print(random.choice(['Cheaper','Safer','Faster']))"`, und nennt das Los im Kommentar. Dazu die **Ebene** reihum (Betreiber 2026-11-27): Projekt → Skills/Commands/Rollen → Factory-Vorgehen → Projekt …, bestimmt aus der Ebene des letzten Eintrags im Log (Einträge ohne Ebene zählen als Skills/Commands/Rollen); auch sie steht im Kommentar und im Auftrag. Unabhängig vom Los prüft er den Lastverlauf der Karte gegen die Grenze 6,0 (75 % von 8 Kernen) und nennt jede Spitze mit Verursacher (Betreiber 2026-11-27: der Rechner pfeift, Wartezeiten stören automatische Tests). Dann ermittelt der **factory-optimizer** (eigener Lauf mit `beginne --ohne-worktree` — er schreibt nichts, und ein neuer Worktree nach `wache gruen` bliebe liegen —, höchstens 30 Minuten, Los und Orte der Ablaufdaten im Auftrag) **einen** Optimierungsschritt für die Factory, der diese Eigenschaft verbessert.
  - Grundlage sind die Ablaufinformationen der gerade ausgelieferten Karte: die Transkripte und Berichte ihrer Läufe (`.factory/laeufe/<nr>-*`, abgelegte Transkripte), das Logbuch und die Kosteneinträge, die Commits der Karte auf `main`, die Kommentare, Wartezeiten und Gates.
  - Vorher liest der factory-optimizer `~/Projekte/Factory-Optimierungen/factory-optimizer.log` ganz: was schon vorgeschlagen oder umgesetzt wurde und was es gebracht hat. Er schlägt nichts doppelt vor und bewertet im selben Zug frühere Einträge, wenn die Karte dazu Messwerte liefert (Spalte „Ergebnis“).
  - **Keine Verschlechterung** (Betreiber 2026-11-26): Der Schritt verbessert die ausgeloste Eigenschaft, ohne eine der beiden anderen zu verschlechtern. Billiger oder schneller durch Weglassen von Prüfungen (Reviews, Gate, Tests, Proben) oder durch schwächere Modelle an prüfenden Stellen geht nicht; sicherer durch zusätzliche teure oder langsame Läufe ebenso wenig. Gesucht sind Schritte, die Verschwendung entfernen: doppelte Arbeit, Warten, Fehlversuche, Nacharbeit, zu breite Lektüre, falsch geschnittene Läufe. Der Eintrag nennt je Eigenschaft die erwartete Wirkung (besser / gleich) mit Begründung; wer „schlechter“ nicht ausschließen kann, schlägt den Schritt nicht vor.
  - Der Schritt ist konkret (Ort, Änderung, Messgröße) und in höchstens 30 Minuten umsetzbar. Der factory-optimizer schreibt nichts, er liefert den Log-Eintrag im Bericht. Nach der Nachprüfung hängt der Director den Eintrag an. Gilt der Schritt der Projektschicht (`AI-Team/`) oder Commands, Rollendefinitionen, Rollenwissen, `gemeinsam/` und Werkzeugen der Factory, setzt der Director ihn gleich um (Factory: eigener Commit `[Factory] <ziel>: <was> (factory-optimizer #<nr>)`, Ergänzungshistorie, `proben/alle.sh` grün) — Freigabe des Betreibers 2026-11-26. Modellwahl nur als Vorschlag an den Betreiber. Was nach `~/.claude` gehört oder unsicher ist, kommt als Idee nach `~/Projekte/Factory-Optimierungen/ideen.md`.
  - **Schlank und selbstkritisch** (Betreiber 2026-11-27): Pflegeschritte (Gelerntes und Regeln bereinigen, verwerfen, verdichten) zählen als Schritt. Jeder Schritt ist eine Hypothese: Bewertet der Rückblick einen früheren Schritt als „nicht gebracht“ (nach mindestens drei Karten) oder „geschadet“, rollt der Director ihn zurück (`git revert`, Eintrag „zurückgerollt“). Die „Weiteren Ideen“ des Berichts legt der Director dem Betreiber in der Meldung vor.
  - **Ausblick** (Betreiber 2026-11-26): Ein Schritt darf auf kommende Karten wirken — ein Hinweis an eine unmittelbar folgende Karte (z. B. für den architekt: viele Playwright-Wackler gesehen) als Kartenkommentar, oder eine eigene Karte im Backlog, die die Ursache im ganzen System beseitigt.
  - Eintrag: genau ein Block am Ende von `~/Projekte/Factory-Optimierungen/factory-optimizer.log` (Format im Kopf der Datei; der Ordner liegt bewusst außerhalb der Factory, Betreiber 2026-11-26): Datum, Karte, Eigenschaft, Befund mit Beleg, Schritt, erhoffter Gewinn mit Messgröße, Status, Ergebnis; kein Commit im Factory-Repo.
- **Entscheidung**
  - Eintrag geschrieben → Erledigt (danach Push und Release wie bei jedem Erledigt, Retrospektive)
  - findet sich in 30 Minuten kein belegbarer Schritt → trotzdem ein Eintrag „kein Schritt“ mit dem, was geprüft wurde, → Erledigt
