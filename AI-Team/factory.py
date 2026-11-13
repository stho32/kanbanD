# Factory-Konfiguration — übernommen aus prozess.md, besetzung.md, auftrag.md, umgebung.md am 2026-11-13
# (werkzeuge/konfig_aus_prozess.py, R00011). Start: factory_start.py --konfig <diese Datei>
# Prüfen: konfig.py pruefen <diese Datei> · Bild: konfig.py diagramm <diese Datei>
# DSL: werkzeuge/factory_dsl.py — normales Python, wo die DSL zu kurz kommt.
# Ablauf als Funktion (@ablauf) unten: von oben nach unten lesen; jede Aktion läuft in der Spalte des umgebenden with.
# Treiber: alle Rollen über opencode mit DeepSeek V4.1 Flash (Modell des Treibers, Betreiber 2026-11-13).
from factory_dsl import *

factory("factory")
kanband(
    url="http://127.0.0.1:7422",
    board="entwicklung",
    ordner="/home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard",
)
chat("http://127.0.0.1:7430/#/c/factory")  # Verlauf jedes Laufs in den localchatA-Kanal (Betreiber 2026-11-13)
auftrag(
    projekt="/home/shoff/Projekte/kanbanD",
    empfaenger="betreiber",
    betreiber="sh",
    director="dir",
    anwendung="kd",
    realist="vorschlagen",
    angelegt="2026-10-31",
    text="""# Auftrag — kanbanD

Aktiviert über `/factory start` aus der Software-Factory (`/home/shoff/Projekte/Software-Factory`). Ein Director, ein Projekt.

## Ziel

kanbanD ist ein Kanban, das ein Ordner ist: Menschen im Browser und KI-Agenten über die API arbeiten auf demselben Board aus Markdown-Dateien, und jede Aktion wird sofort committet, sodass Git das vollständige Gedächtnis ist. Das Team entwickelt es so weiter, dass es als Steuerpult und Übersicht einer Wartungsfabrik taugt (R00095–R00100).

## Einsatz des realist-consultant

Vom Betreiber beim Start festgelegt (2026-10-31), ergänzt `realist: vorschlagen`:

- **Wann**: Der `realist-consultant` berät nicht nur bei Schleifen, sondern immer dann, wenn der `product-owner` einen neuen inhaltlichen Auftrag bekommt (neue Anforderung, Kurskorrektur, neuer Umfang). Er prüft, ob Kriterien und Lösung für ihren Zweck angemessen sind, und schlägt einfachere Fassungen vor.
- **Wer entscheidet**: Der `product-owner` vertritt den Betreiber in der Diskussion und entscheidet nach bestem Wissen und Gewissen und nach der Vision. Er protokolliert in `AI-Team/po-entscheidungen.md`. Der Director setzt nichts selbst um, was nicht der Product Owner entschieden hat.
- **Strittig**: Können sich Product Owner und realist-consultant nicht einigen oder ist die Frage richtungsweisend, legt der Director eine Karte ins **Backlog**: Titel „Besprechen: <Frage>“, die Optionen beider Seiten mit Empfehlung, zuständig `sh`. Der Betreiber stößt sie selbst an, indem er sie mit dem Product Owner bespricht. Bis dahin läuft die betroffene Arbeit nach dem bisherigen Stand weiter oder wird zurückgestellt, nie nach einer der strittigen Fassungen.
""",
)
umgebung(
    installieren="`cargo build --release`; E2E: `cd e2e && npm install && npx playwright install chromium`",
    dienste="`target/release/kanbanD <wegwerf-ordner> --port <frei> --kein-browser` (Skill `freier-port`); nie die Board-Instanz auf Port 7422",
    health="`GET http://127.0.0.1:<port>/api/zustand` antwortet mit JSON",
    gate_hinweis="`cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`",
    gate='cargo test && node --test e2e/einheit/ && (cd e2e && npx playwright test)',
    pfade="`~/.cargo/bin`; Node für E2E unter `e2e/`; Board der Factory `http://127.0.0.1:7422`, Ordner `/home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard`; Auslieferung `cargo install --path . --locked` (siehe `prozess.md`)",
    logging="Ziel stderr und `~/.local/state/kanbanD/<ordnername>/kanbanD.log`, nie im Board-Ordner (Git); Rotation täglich, Aufbewahrung 14 Tage; Standardstufe Information, umschaltbar `--log <stufe>` bzw. `KANBAND_LOG`; Stufen Debug · Information (Start, Commit je Aktion mit Wer/Instanz) · Warning (abgewiesene Züge 403/409, defekte Dateien) · Error (Fachlogik) · Exception (Programmfehler, Panik); keine Inhalte von Beschreibungen und Kommentaren. Heute nur `eprintln!` — ADR durch den architekt, sobald eine Karte Fehlerpfade berührt (Betreiber 2026-10-31)",
    hinweise="""Wie die Dienste des Projekts starten und geprüft werden. Gilt für den Director und jede Rolle.
""",
)
wissen(
    lastprofil_betreiber_2026_10_31="""| Dimension | Ziel |
|---|---|
| gleichzeitige Menschen | 1–3 Browser-Tabs |
| gleichzeitige Agenten | bis 10 Instanzen (Sensoren, Behandler) |
| Schreibrate | bis 5 schreibende Aufrufe/s in Spitzen, je ein Commit |
| Bestand je Ordner | bis 5.000 Aufgaben (davon 4.000 archiviert), 10 Boards |
| Antwortzeit | lesend p95 < 200 ms bei 5.000 Aufgaben; schreibend inkl. Commit p95 < 500 ms; `ziehen` unter Konkurrenz von 10 Agenten p95 < 1 s |
| Live | Änderung in allen offenen Sichten < 1 s |
""",
    rechnerlast="""Gilt für Director und Rollen (Regeln: `rollen/director/regeln.md`, „Rechnerlast“). Immer höchstens etwa 75 % Systemlast; neu gestartet wird nur, was darunter passt. Rechner: 8 Kerne, 31 GB. Sparbetrieb nach `prozess.md` (Betreiber 2026-10-31).

| Betrieb | Zeit | Entwickler | prüfende Rollen | Job-Grenze | nice | Test-Worker | Lasttests |
|---|---|---|---|---|---|---|---|
| Tag | 8–21 Uhr | 1 | bis 3 parallel (Auto-Reviews) | 2 | 10 | Standard | auf Ansage |
| Nacht | 21–8 Uhr | 1 | 1 | 1 | 19 | 2 | nie |
""",
    sparbetrieb_betreiber_2026_10_31="""Ein Wochenlimit für Tokens steht bevor. Ziel ist, möglichst viele Karten **ganz** fertigzustellen, bevor es greift, denn was begonnen und nicht abgeschlossen ist, bleibt bis zum Reset offen.

- **Nacheinander**: Es ist höchstens eine Karte zwischen „Architektur“ und „Entwicklertest“ unterwegs. Die nächste Karte wird erst freigegeben und gezogen, wenn die vorige in „Erledigt“ oder „Ohne Mensch nicht lösbar“ liegt. Es gibt keinen Vorlauf und keinen Puffer, und `entw2` baut nur, während `entw1` nicht baut.
- **Sparsam prüfen**: In den Auto-Reviews läuft `code-reviewer` immer, jede andere Rolle nur, wenn die Karte ihr Thema nachweislich berührt. Eine Wiederholung gibt es nur für Rollen mit Befund. Befunde, die nur über künstliche Fehlerinjektion erreichbar sind, gelten als `Sollte`; was mit `Sollte` und `Optional` geschieht, regelt „Befunde aus Reviews und Tests“.
- **Knappe Aufträge**: Der Director nennt jeder Rolle die Dateien und Abschnitte, die sie braucht, statt sie suchen zu lassen. Die Berichte bleiben im Berichtsformat, ohne Wiederholungen.
- **Rollen fortsetzen statt neu starten** (Betreiber 2026-10-31): planer, architekt, product-owner und entwickler werden für die nächste verwandte Karte bzw. für Nachträge per SendMessage fortgesetzt, solange ihr Kontext unter etwa 150.000 Tokens liegt (Wert aus der letzten Abschlussmeldung); darüber und bei fremdem Codebereich frisch starten. Prüfende Rollen (Reviews, Entwicklertest) starten je Karte frisch — der unabhängige Blick ist gewollt; nur ihre Wiederholung nach Nacharbeit an derselben Karte wird fortgesetzt. Die Agent-ID je Rolle hält der Director in der Logbuchzeile fest.
- **Reihenfolge der Karten** (Betreiber 2026-10-31, nach der UX-Durchsicht): erst #7/#14 (R00101), dann R00095 → R00096 → R00097 → R00098 → R00099 → R00100, danach die übrigen UX-Karten (#8–#13, #15, #16); Features der Wartungsfabrik bringen den größten Nutzen je Token.
""",
    befunde_aus_reviews_und_tests_betreiber_2026_11_12="""Anlass: Der Backlog war auf 66 Karten gewachsen, rund die Hälfte davon Härtungskarten, Wackler und Dubletten; bei der Durchsicht am 2026-11-12 blieben 30. Die Regeln verhindern, dass Befunde ohne Nutzerwirkung wieder geparkt werden.

- **Muss** geht wie bisher in die Nacharbeit derselben Karte.
- **Sollte und Optional** entscheidet die Nacharbeit derselben Karte: beheben oder verwerfen, mit einem Satz Grund im Kartenkommentar. Es gibt keine Härtungskarten mehr.
- **Akzeptanzkriterium ohne Probe**: Meldet eine Rolle, dass ein Akzeptanzkriterium der Karte keine Probe hat, ist das ein Muss derselben Karte, kein Sollte.
- **Neue Karte nur mit Nutzerwirkung**: Ein Befund außerhalb des Pakets (Vorbestand) wird nur dann Karte, wenn er für Mensch oder Agent beobachtbar ist — sichtbarer Fehler, Datenverlust, Bruch des API-Kontrakts, Sicherheit. Vorher gleicht der Director mit dem Backlog ab: Passt der Befund zu einer offenen Karte, wird er dort ein Kommentar.
  - #138 doppelte Auslösung · #139 E2E-Wackler · #140 schmale Breite · #141 Tastatur und Fokus · #55 kleine sichtbare Mängel · #143 Akzeptanzkriterien ohne Probe
- **Nie eine Karte** (verwerfen, im Bericht genügt eine Zeile): überlebende Mutanten und Lücken in Wächtern ohne beobachtbaren Fehler, Stil und Benennung, Zeilen- und SHA-Verweise in Doku, Rechtschreibung in Anforderungen, WBS und `Gelerntes.md`, Drift in Architektur-Modell und ADRs (die nimmt `/architektur pruefen` mit).
- **Keine Härtung der Härtung**: Reviews einer Karte, die selbst aus Befunden entstanden ist, melden nur Muss.
- **Wackler**: ein neuer Wackler wird Kommentar an #139, keine eigene Karte. Ein Test, der unter einer benennbaren Bedingung immer scheitert (Wochentag, Uhrzeit), ist kein Wackler, sondern ein Bug.
- **Prüfende Rollen** bekommen im Auftrag die Liste oben mit. Was dort schon steht oder hier verworfen ist, melden sie nicht erneut.
""",
    auslieferung_bei_erledigt_betreiber_2026_10_31="""Das Board, das der Betreiber für das Projekt beobachtet, ist zugleich die Instanz, auf der er die neuen Features sieht. Nach jedem Zug nach „Erledigt“:

1. `cargo install --path /home/shoff/Projekte/kanbanD --locked` (installiert nach `~/.cargo/bin/kanbanD`);
2. die Board-Instanz neu starten: alte PID beenden, `~/.cargo/bin/kanbanD /home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard --port 7422 --kein-browser` neu starten (losgelöst, PID in `.claude/factory/board.pid` des Projekts), `GET /api/zustand` muss antworten;
3. eine Logbuchzeile mit Version bzw. Commit. Schlägt die Installation fehl, bleibt die alte Instanz laufen, und die Karte wird eine Befundkarte.

Rückmeldungen gibt der Betreiber von sich aus („wenn ich was zu nörgeln habe, sage ich es“). Sie werden über den PO zu Karten im Backlog.
""",
    signal_ich_habe_fragen_betreiber_2026_10_31="""Hat der Director eine Frage, die der Betreiber entscheiden muss (richtungsweisend laut product-owner, Konflikt mit der Vision), setzt er auf der betroffenen Karte das Signal `frage` („Ich habe Fragen“, orange; steht in der Reihenfolge der Signale vorn, die Karte trägt also seine Farbe) und schreibt die Frage als Kartenkommentar: ein Satz Kontext, nummerierte Optionen, Empfehlung zuerst. Dieselbe Frage stellt er auch in der Session. Ist sie beantwortet, nimmt er das Signal zurück und vermerkt die Antwort als Kommentar. Fragen ohne Karte bekommen eine Karte „Frage: …“ oben im Backlog.
""",
    token_kosten_je_karte_betreiber_2026_10_31="""Nach jedem Rollenauftrag notiert der Director das Token-Volumen aus der Abschlussmeldung des Subagents; beim Zug nach „Erledigt“ steht auf der Karte ein Kommentar „Token-Kosten der Karte“ mit einer Zeile je Rollenauftrag und der Summe. Der Anteil des Directors ist nicht messbar und wird nicht geschätzt. Einmalige Aufträge für das ganze Board (z. B. eine Durchsicht) werden getrennt genannt, nicht auf eine Karte gerechnet. Die Logbuchzeile je Auftrag nennt die Tokens in der Notiz.
""",
    preisetikett_je_karte_betreiber_2026_10_31="""Sobald kanbanD ein Preisetikett an Aufgaben kennt (Wunsch des Betreibers vom 2026-10-31, beim product-owner in Klärung), stattet der Director **jede** Karte damit aus: beim Zug nach „Erledigt“ den Preis, der den API-Kosten entsprochen hätte (Grundlage: die Token-Kosten der Karte, Preise des verwendeten Modells, Annahme zur Aufteilung genannt). Bis dahin stehen Token-Kosten **und Preis** als Kartenkommentar (Betreiber 2026-10-31): Preis als API-Gegenwert mit Modellpreisen; lässt er sich nicht genau sagen, als Spanne von–bis (Betreiber 2026-10-31), mit der Annahme dahinter (heute: plausibel 85 % Cache-Lesen / 10 % Input / 5 % Output, Spanne alles-Cache bis alles-Output).
""",
    kosten_messen_einzel_und_gemeinkosten_betreiber_2026_10_31="""- **Einzelkosten** einer Karte werden gemessen, nicht geschätzt: `python3 werkzeuge/token_kosten.py <Protokolle der Subagents dieser Karte>` (Factory); die Protokolle liegen unter `<scratchpad-elternordner>/tasks/<agent-id>.output`, die Agent-ID steht in der Logbuchzeile. Ergebnis ist eine Spanne (Cache-Schreiben 5 oder 8 $ je Mio.). Ein fortgesetzter Subagent, der mehrere Karten bedient, wird nach seinen Läufen geteilt, sonst als „einschließlich …“ genannt.
- **Gemeinkosten** (Director-Session, einmalige Aufträge für das ganze Board) stehen auf der Sammelkarte „Gemeinkosten: Director und Einmaliges“, je Tag fortgeschrieben; die Director-Session wird über ihr Protokoll `~/.claude/projects/-home-shoff-Projekte-Software-Factory/<session>.jsonl` gemessen.
- **Preis-Kommentar** beim Zug nach „Erledigt“: „Preis: <von>–<bis> USD · Basis: …“ mit den Einzelkosten je Rolle, dazu getrennt „Gemeinkostenanteil: … USD (Zuschlag … % nach Einzelkosten)“.
- Die Abschlussmeldungen der Subagents (Token-Summe) zählen das Cache-Lesen nicht und unterschätzen stark; sie werden nicht mehr für Preise benutzt.
""",
    freigabe_von_artboards_betreiber_2026_11_07="""Artboards und Skizzen gibt der product-owner frei, bevor gebaut wird (Vision R00000, Leitplanke „Jede Gestaltung wird freigegeben“). Der Director legt sie ihm vor, nicht dem Betreiber; der PO protokolliert die Freigabe in `po-entscheidungen.md`. Der Betreiber darf weiterhin selbst freigeben, muss es aber nicht.
""",
)
last(
    grenze_prozent=75,
    rollen_gleichzeitig=1,
    tag={"zeit": "8–21 Uhr", "entwickler": "1", "pruefende_rollen": "bis 3 parallel (Auto-Reviews)", "job_grenze": "2", "nice": "10", "test_worker": "Standard", "lasttests": "auf Ansage"},
    nacht={"zeit": "21–8 Uhr", "entwickler": "1", "pruefende_rollen": "1", "job_grenze": "1", "nice": "19", "test_worker": "2", "lasttests": "nie"},
)

treiber("opencode", modell="openrouter/deepseek/deepseek-v4.1-flash")  # DeepSeek V4.1 Flash, latest (= 1017)

# Rollen: Name, Kürzel am Board, Treiber (claude | opencode), Modell
product_owner = rolle("product-owner", "po", treiber="opencode", einsatz="Rückfragen der Rollen im Sinne der Vision entscheiden, Protokoll `AI-Team/po-entscheidungen.md`; vertritt den Betreiber auch gegenüber dem realist-consultant (`auftrag.md`, „Einsatz des realist-consultant“)")
realist_consultant = rolle("realist-consultant", "real", treiber="opencode", einsatz="berät den PO bei jedem neuen inhaltlichen Auftrag; Schleifenbremse")
planer = rolle("planer", "plan", treiber="opencode", einsatz="Detailplanung: R00095–R00100 als WBS-Knoten einhängen, Interaction bis Bubble verfeinern, Anforderung schreiben; Befunde einplanen")
architekt = rolle("architekt", "arch", treiber="opencode", einsatz="Architektur-Modell anlegen (fehlt), ADRs zu den Regeln am Schreibweg (Sperre → Prüfung → Commit: Grenze, Eigentümer, Schlüssel) und zum Logging")
architektur_reviewer = rolle("architektur-reviewer", "arev", treiber="opencode", einsatz="Pakete gegen Modell und ADRs, nur wenn sie Schreibweg oder Modell berühren")
entwickler = rolle("entwickler", "entw1", treiber="opencode", einsatz="Interactions bauen, Test zuerst, Gate; WIP 1; entw2 (Nacharbeit): Muss-Befunde im Worktree `kanbanD-entw2`; im Sparbetrieb nur, wenn entw1 nicht baut")
code_reviewer = rolle("code-reviewer", "crev", treiber="opencode", einsatz="Korrektheit, Tests, Wartbarkeit je Paket")
security_reviewer = rolle("security-reviewer", "srev", treiber="opencode", einsatz="Full-Trust über `X-KanbanD-Wer`, neue 403/409-Grenzen, Eingaben von außen (Routen, Anhänge, Markdown-Darstellung)")
entwicklertester = rolle("entwicklertester", "etst", treiber="opencode", einsatz="User Story im echten Programm (Browser und API) auf einer Wegwerf-Instanz")
ux_reviewer = rolle("ux-reviewer", "ux", treiber="opencode", einsatz="Oberfläche mit Material 3 als Referenz, Tastatur, Barrierefreiheit; Vorprüfung in der Detailplanung")
rechtschreib_reviewer = rolle("rechtschreib-reviewer", "rsr", treiber="opencode", einsatz="deutsche Oberfläche, Fehlermeldungen, API-Beschreibung, Anforderungen")
legacy_reviewer = rolle("legacy-reviewer", "leg", treiber="opencode", einsatz="bestehende Board-Ordner (`~/Projekte/Kanban-Boards/*`) und Agenten-Clients (`kanband.py` der Factory) öffnen und nutzen nach jeder Änderung an Dateiformat oder API weiter")
observability_reviewer = rolle("observability-reviewer", "obs", treiber="opencode", einsatz="Logging gegen das Konzept in `umgebung.md`, nur bei neuen Fehlerpfaden oder Protokollzeilen")
fachspezialist = rolle("fachspezialist", "fach", treiber="opencode", einsatz="Glossar unter `Dokumentation/Domaenenwissen/` anlegen und pflegen, Benennung neuer Begriffe")
gestalter = rolle("gestalter", "ges", treiber="opencode", einsatz="Dialog-Artboards und Skizzen unter `Dokumentation/Wireframes/` in der entschiedenen Richtung verfeinern (`/wireframe verfeinern`), vor dem Bau; der product-owner gibt frei (Betreiber 2026-11-11)")
berater("product-owner", bei="frage", an=["product-owner"], blockiert=True, runden=2, ziel="entscheidung")

# Spalten in der Reihenfolge des Boards (Beschreibung = Notiz am Board)
ohne_mensch_nicht_loesbar = spalte(
    "Ohne Mensch nicht lösbar",
    beschreibung="Schleifen und Entscheidungen, die der Betreiber treffen muss",
    mensch=True,
    schleifen=True,
)
backlog = spalte(
    "Backlog",
    beschreibung="Sammlung; der Betreiber gibt frei, indem er Karten nach „Architektur“ legt; hier liegen auch die Karten „Besprechen: …“ aus PO und realist-consultant",
    mensch=True,
)
architektur = spalte(
    "Architektur",
    beschreibung="prüfen, ob die Karte eine Technikfrage aufwirft; wenn ja entscheiden und als ADR festhalten, sonst sofort weiter; die erste Karte bringt das Architektur-Modell",
    wissen=['lastprofil_betreiber_2026_10_31'],
)
detailplanung = spalte(
    "Detailplanung",
    beschreibung="WBS-Knoten anlegen bzw. Interaction bis Bubble verfeinern, Anforderung schreiben oder abgleichen; ux-reviewer nur als Vorprüfung bei Oberfläche; fachspezialist auf Abruf bei neuen Begriffen; der planer setzt die zutreffenden Labels der Karte: „oberflaeche“ (sichtbare Änderung der Oberfläche → ux-reviewer), „text“ (neuer oder geänderter sichtbarer Text, API-Beschreibung → rechtschreib-reviewer), „sicherheit“ (Full-Trust über `X-KanbanD-Wer`, neue 403/409-Grenzen, Eingaben von außen → security-reviewer), „fehlerpfad“ (neue Fehlerpfade oder Protokollzeilen → observability-reviewer), „architektur“ (Schreibweg oder Modell → architektur-reviewer), „datenformat“ (Dateiformat des Board-Ordners oder API → legacy-reviewer), „begriffe“ (neue Fachbegriffe → fachspezialist) — nur danach laufen die Prüfer dieser Themen",
    wissen=['freigabe_von_artboards_betreiber_2026_11_07'],
)
entwicklung = spalte(
    "Entwicklung",
    beschreibung="bauen, Test zuerst, Gate (`cargo test`, `node --test e2e/einheit/`, betroffene Playwright-Specs; volle Suite am Kartenende)",
    phase="Entwicklung",
)
nacharbeit = spalte(
    "Nacharbeit",
    beschreibung="Muss-Befunde aus Auto-Reviews und Entwicklertest beheben, Sollte/Optional entscheiden (beheben oder verwerfen, siehe „Befunde aus Reviews und Tests“) (`entw2`, Worktree `kanbanD-entw2`, Zweig `nacharbeit/<nr>`), danach zurück in die Auto-Reviews, nur Rollen mit Befund wiederholen",
    wissen=['befunde_aus_reviews_und_tests_betreiber_2026_11_12'],
)
auto_reviews = spalte(
    "Auto-Reviews",
    beschreibung="Reviews parallel am selben Stand, je Rolle eine Teilaufgabe; code-reviewer immer, die übrigen nur, wenn die Karte ihr Thema berührt (Auswahl im Kommentar des Directors beim Zug)",
    zurueck_erlaubt={"Detailplanung": ["anforderung_falsch", "kriterium_fehlt"]},
    wissen=['befunde_aus_reviews_und_tests_betreiber_2026_11_12'],
)
entwicklertest = spalte(
    "Entwicklertest",
    beschreibung="User Story wörtlich im echten Programm auf einer Wegwerf-Instanz",
    zurueck_erlaubt={"Detailplanung": ["anforderung_falsch", "kriterium_fehlt"]},
    phase="Entwicklertest",
    wissen=['befunde_aus_reviews_und_tests_betreiber_2026_11_12'],
)
erledigt = spalte(
    "Erledigt",
    beschreibung="fertig: nach bestandenem Entwicklertest direkt hierher, ohne Abnahme-Spalte; beim Zug installiert der Director kanbanD neu und startet das Board neu (siehe „Auslieferung“); letzte Spalte, Abschlussspalte der Berichte",
    mensch=True,
)


def label(name):
    """Bedingung: die Karte trägt das Label — die Labels setzt der planer in der Detailplanung."""
    def bedingung(k):
        return name in k.labels
    bedingung.__name__ = name
    return bedingung


oberflaeche, text, sicherheit, fehlerpfad, architekturthema, datenformat, begriffe = (label(n) for n in ('oberflaeche', 'text', 'sicherheit', 'fehlerpfad', 'architektur', 'datenformat', 'begriffe'))

# Ablauf einer Karte — von „Architektur“ bis „Erledigt“
@ablauf
def karte(k):
    # Architektur: Technikfrage? dann ADR, sonst sofort weiter
    with architektur:
        technik = architekt.arbeite(k)
        if not technik.bestanden:
            return mensch(k, "Architektur: Muss offen", technik.muss)

    # Detailplanung: der planer verfeinert und setzt die Labels, der fachspezialist klärt neue Begriffe;
    # bei Oberfläche prüft der ux-reviewer vor, ein Muss arbeitet der planer ein, danach prüft nur der ux-reviewer
    # nach — höchstens zweimal
    with detailplanung:
        planer.arbeite(k)
        fachspezialist.wenn(begriffe).arbeite(k)
        for _ in versuche(2):
            vorpruefung = ux_reviewer.wenn(oberflaeche).pruefe(k)
            if vorpruefung.bestanden:
                break
            planer.arbeite_ein(k, vorpruefung.muss)
        else:
            return mensch(k, "Schleifenbremse in der Detailplanung", vorpruefung.muss, vorschlag_von=realist_consultant)

    # Entwicklung: bauen; rotes Gate oder Rebase-Konflikt beim Zusammenführen → Nacharbeit, höchstens zweimal
    with entwicklung:
        bau = entwickler.baue(k)
    if not bau.bestanden:
        with nacharbeit:
            entwickler.behebe(k, bau.muss)
    offen = []
    for _ in versuche(3):
        gate = integriere(k)
        if gate.gruen:
            break
        offen = gate.muss
        with nacharbeit:
            entwickler.behebe(k, offen)
    else:
        return mensch(k, "Gate bleibt rot nach zwei Nacharbeiten", offen, vorschlag_von=realist_consultant)

    # Auto-Reviews: parallel — code-reviewer immer, die übrigen nur bei ihrem Label (Sparbetrieb);
    # Muss → Nacharbeit (nur Rollen mit Befund wiederholen), höchstens zweimal; erlaubter Rückweg in die Detailplanung
    for _ in versuche(3):
        with auto_reviews:
            pruefung = parallel(code_reviewer, security_reviewer.wenn(sicherheit), ux_reviewer.wenn(oberflaeche),
                                rechtschreib_reviewer.wenn(text), architektur_reviewer.wenn(architekturthema),
                                legacy_reviewer.wenn(datenformat), observability_reviewer.wenn(fehlerpfad))(k)
        if pruefung.zurueck:
            return springe(k, pruefung.zurueck["nach"])
        if pruefung.bestanden:
            break
        offen = pruefung.muss
        with nacharbeit:
            entwickler.behebe(k, offen)
            if not integriere(k).gruen:
                return mensch(k, "Gate nach der Nacharbeit rot", offen)
    else:
        return mensch(k, "Schleifenbremse nach zwei Nacharbeiten aus den Auto-Reviews", offen, vorschlag_von=realist_consultant)

    # Entwicklertest: die User Story wörtlich im echten Programm; Muss → Nacharbeit, höchstens zweimal
    for _ in versuche(3):
        with entwicklertest:
            test = entwicklertester.teste(k)
        if test.zurueck:
            return springe(k, test.zurueck["nach"])
        if test.bestanden:
            break
        offen = test.muss
        with nacharbeit:
            entwickler.behebe(k, offen)
            if not integriere(k).gruen:
                return mensch(k, "Gate nach der Nacharbeit rot", offen)
    else:
        return mensch(k, "Schleifenbremse nach zwei Nacharbeiten aus dem Entwicklertest", offen, vorschlag_von=realist_consultant)

    # Auslieferung beim Zug nach „Erledigt“ (Betreiber 2026-10-31): kanbanD aus main installieren und die
    # Board-Instanz des Betreibers (Port 7422) neu starten; schlägt das fehl, läuft die alte Instanz weiter und der
    # Mensch entscheidet
    with entwicklertest:
        auslieferung = befehl("bash AI-Team/ausliefern.sh", minuten=20)(k)
    if not auslieferung.bestanden:
        return mensch(k, "Auslieferung fehlgeschlagen — die alte Board-Instanz läuft weiter")
    nach(k, erledigt)
