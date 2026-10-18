# kanbanD

Ein Kanban, das ein Ordner ist. Aufgaben und Boards sind Markdown-Dateien, jede Aktion ist ein Git-Commit unter dem Namen der handelnden Person — Mensch im Browser oder Agent an der API.

Zielbild: [Anforderungen/R00000-vision.md](Anforderungen/R00000-vision.md) · Umfang: [Dokumentation/Planung/kanbanD.md](Dokumentation/Planung/kanbanD.md) · Gestaltung: [Dokumentation/Wireframes/](Dokumentation/Wireframes/)

## Start

```bash
cargo build --release
./target/release/kanbanD <ordner> [--port 7420] [--host 0.0.0.0] [--kein-browser]
```

Der Ordner wird bei Bedarf angelegt, ein Git-Repository bei Bedarf eingerichtet; der Browser öffnet sich mit der Adresse. Beim ersten Start fragt die Seite nach „ich“, Agenten, Board und Spalten.

## Bedienen in Kürze

- **Neue Aufgabe:** `n` (überall), „+“ im Spaltenkopf oder „+ Neue Aufgabe“ öffnet einen Dialog mit allen Feldern — Titel, Beschreibung, Teilaufgaben, Board und Spalte, Klasse, Zuständige, Labels, Fälligkeit, Herkunft. Strg+Enter legt an, Umschalt+Strg+Enter legt an und lässt den Dialog für die nächste offen.
- **Mehrere auf einmal:** eine Liste (aus Notiz, Mail, Protokoll) in den Titel des Dialogs oder in „+ Teilaufgabe“ einfügen — je Zeile eine, ein Commit. Teilaufgaben lassen sich ohne Wartezeit hintereinander tippen.
- **Schnelleingabe:** `Login reparieren @mi class:bug label:ui due:morgen I0007` setzt Zuständige, Klasse, Label, Fälligkeit und Herkunft gleich beim Anlegen; die Vorschau zeigt, was erkannt wurde.
- **An der Karte:** die erste offene Teilaufgabe mit Kästchen zum Abhaken, ▶/■ Timer, „+ mich“, Doppelklick auf den Titel benennt um.
- **Aufgabenliste:** Zeilen auf eine Spalte eines Boards oder ins Archiv ziehen.
- **Tastatur auf dem Board:** Pfeile wählen, Umschalt+Pfeile verschieben, `1`–`9` in Spalte n, Enter öffnet, `n` neue Aufgabe, `t`/Leertaste Timer, `m` mir zuweisen, `p` Zuständige (alle Personen), F2 umbenennen, `a`/Entf archivieren, `c` Verweis kopieren, `/` Filter, Strg+Z macht die letzte Bewegung oder Anlage rückgängig.
- **Rechtsklick-Menüs:** auf Karten (alles, was man mit einer Karte tun kann, mit Kürzel daneben), auf Spaltenköpfen (Karte hinzufügen, alle archivieren, Spalte verschieben) und auf Zeilen der Aufgabenliste; per Tastatur mit Menütaste oder Umschalt+F10.
- **Überall:** `g b` / `g a` / `g p` / `g s` / `g z` / `g v` / `g e` wechseln die Seite, `b` Board wechseln, `i` Ich bin …; im Aufgabenfenster `t m a e b s k d`; in der Aufgabenliste Pfeile, `a`, `c`. `?` zeigt die Kürzel des Orts.
- **Filter:** Text, `#12`, `@kürzel`, `class:bug`, `origin:I0023`, `label:ui`, `is:archived`.
- **Berichte** (Menü „Berichte“): Stundenzettel, Zeiten nach Aufgabe und Person, Burndown, Durchlaufzeit (Lead und Cycle Time zwischen wählbaren Spalten) und **Wie lange noch** — eine Monte-Carlo-Prognose je Spalte aus dem Durchsatz des Boards, die live mitrechnet, wenn Aufgaben bewegt, angelegt oder archiviert werden. Eine gemeinsame Filterleiste wie bei Kanbanflow: Zeitraum (heute bis dieses Jahr oder eigener), Farben und Spalten ausschließen, nur Personen, nur Labels; sie bleibt im Browser gemerkt. Kürzel `g v`, `g d`, `g w`.

## Der Ordner

```
<ordner>/
  kanbanD.md                 Personen (people), Klassen (classes), Quellpfade (sources)
  boards/<slug>.md           # Titel, je Spalte „## Name“, je Aufgabe „- [#12](../aufgaben/0012-….md)“
  aufgaben/0012-titel.md     Frontmatter (id, title, class, assignees, labels, due, origins, archived),
                             Beschreibung, „- [ ]“-Teilaufgaben, Codeblöcke kanbanD-time und kanbanD-comments
  aufgaben/0012-titel/       Anhänge
```

Eine Aufgabe zu bewegen ändert nur die Board-Datei. Dieselbe Aufgabe kann auf mehreren Boards liegen. Wer an kanbanD vorbei Dateien ändert, sieht sie live in allen Browsern; committet wird das nicht von kanbanD.

## Für Agenten

`GET /api` beschreibt alle Endpunkte, `GET /api/endpunkte` liefert sie als JSON. Schreibende Aufrufe nennen `X-KanbanD-Wer: <kürzel>`:

```bash
curl -X POST http://localhost:7420/api/aufgaben -H 'X-KanbanD-Wer: cl' \
     -H 'Content-Type: application/json' -d '{"titel":"Dateiwächter","board":"entwicklung"}'
```

`GET /api/ereignisse` meldet jede Änderung im Ordner als Server-Sent Event. `GET /api/berichte/bewegungen?board=<slug>` liefert je Aufgabe die Spaltenwechsel aus Git — die Grundlage der Board-Berichte.

## Tests

```bash
cargo test                       # Unit und Integration (gegen das echte Programm und echtes Git)
node --test e2e/einheit/         # Unit-Tests der reinen JavaScript-Funktionen
cd e2e && npm install && npx playwright install chromium && npx playwright test   # E2E im Browser
cargo llvm-cov --summary-only    # Abdeckung
```
