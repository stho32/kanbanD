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
- **WBS** (Menüpunkt je gebundener Anwendung, `g k`): die WBS der Anwendung als eingerückte Tabelle wie in `/planung karte` — Zeile in der Ampelfarbe, Status als Plakette (gerechnete umrandet, ein Widerspruch zur Datei steht daneben), Dialog und Interaction klappbar. Der Kopf zeigt den Stand über die Slices (% funktional · in Bearbeitung · offen), den aktiven Pfad, was läuft und „nicht committet“, solange die WBS-Datei im Arbeits-Repository Änderungen hat. Die Sicht folgt der Datei live, auch wenn sie außerhalb des kanbanD-Ordners liegt. Ein Klick auf die Plakette eines Blatts setzt `rot`, `gelb` oder `gruen`; kanbanD rechnet die Vorfahren nach, setzt `zuletzt` und schreibt nur diese Zellen — „+ Knoten“ in einer Zeile legt darunter einen Knoten an (rot, nächste freie ID — auch über Zeilen, die nur noch in der Git-Historie stehen), „Verwerfen …“ im Kontextmenü der Zeile markiert ihn samt Nachfahren als `verworfen`, mit Grund in der Notiz, ohne eine Zeile zu löschen. committet wird im Arbeits-Repository nie, das bleibt bei dem, der dort arbeitet. Je Knoten zeigt die Sicht die Aufgaben, die auf ihn wirken (`#7`).
- **Wirkungen auf die WBS** (`wbs-effects` an der Aufgabe, „+ Wirkung“ im Aufgabenfenster): eine Aufgabe legt einen Knoten an (`+ kd:I0048`, rot mit der nächsten freien ID), setzt einen Knoten samt zählender Nachfahren zur Überarbeitung auf rot (`↻ kd:D0002`) oder verwirft ihn (`− kd:I0014`) — sofort, erst in der WBS, dann in der Aufgabe mit einem Commit im Board-Repository. Scheitert die WBS, bleibt die Aufgabe, wie sie ist. Die Chips an Karte und Fenster führen zur Zeile in der WBS-Sicht; eine Wirkung aus der Aufgabe zu nehmen ändert die WBS nicht. Wirkungen nennen immer ein Kürzel aus dem Register.
- **Phasen als Spalten** (`column-phases` im Board-Frontmatter, Spaltenname → Phase, mehrere Spalten dürfen dieselbe Phase darstellen): ein gebundenes Board bekommt die Phasen der Hauptspur aus der Phasen-Datei neben der WBS (`<wbs-stamm>-phasen.md`, sonst Entwicklung → Entwicklertest → Abnahme). Fehlt einer Phase die Spalte, legt kanbanD sie beim Lesen des Boards nach der Spalte der Vorphase an — eine gleichnamige freie Spalte wird zugeordnet, `Gleich wie` bekommt keine — in einem eigenen Commit „Phasen-Spalten von „<Board>“ ergänzt: …“; umgeordnet wird danach nichts, eine Spalte einer späteren Phase links einer früheren gibt einen Hinweis am Board. Ein Zug in die Spalte einer späteren Phase oder in die Abschlussspalte ist der Durchlauf; „Wie lange noch“ rechnet dann je Phase („Entwicklung durchlaufen“, …). `phases: {skipped: [Abnahme]}` an der Aufgabe (Schalter im Aufgabenfenster) nimmt sie aus dieser Phase, das Label `im-pair` erfüllt eine Phase `Eingebettet in: im-pair` mit der Vorphase.
- **Plausibilitätsprüfung je Spalte** (`column-checks` im Board-Frontmatter, Spaltenname → Liste von Prüfungen, im Spalten-Dialog schaltbar): `wbs-effects-green` verlangt, dass jeder Knoten, den die Aufgabe anlegt oder überarbeitet (`wbs-effects` `create`/`rework`), grün ist. Ein Zug aus der Spalte nach rechts (nach dem Rang der Phase, ohne Phasen nach Spaltenindex) wird immer ausgeführt und committet; die Antwort von `POST …/bewegen` trägt `warnungen: [{pruefung, text, knoten, details}]`, die Oberfläche zeigt „Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.“ mit Links in die WBS-Sicht. Karten rechts einer Spalte mit nicht erfüllter Prüfung tragen ein rotes Ausrufezeichen — gerechnet, nicht gespeichert, es verschwindet live, sobald die Knoten grün sind. Unbekannte Prüfungsnamen sind ein Hinweis am Board, kein Defekt.
- **Zählen in Berichten je Aufgabe** (`reporting: {burndown: false, forecast: false}` im Frontmatter der Aufgabe, Abschnitt „Zählt in Berichten“ im Aufgabenfenster, `PATCH /api/aufgaben/<nr> {reporting: {forecast: false | null}}`): `false` nimmt die Aufgabe aus dem Burndown bzw. aus Wie lange noch (Umfang, Nenner und Durchsatz, je Spalte und je Phase), `null` entfernt den Schlüssel — fehlt er, zählt die Aufgabe (Standard). Beide Berichte nennen die Ausgenommenen unter „Nicht enthalten“; der Berichtsfilter wirkt zusätzlich, unbekannte Schlüssel unter `reporting` bleiben erhalten. `GET /api/berichte/bewegungen` liefert `reporting` je Aufgabe mit.
- **Filter:** Text, `#12`, `@kürzel`, `class:bug`, `origin:I0023`, `label:ui`, `is:archived`.
- **Berichte** (Menü „Berichte“): Stundenzettel, Zeiten nach Aufgabe und Person, Burndown, Durchlaufzeit (Lead und Cycle Time zwischen wählbaren Spalten) und **Wie lange noch** — eine Monte-Carlo-Prognose je Spalte aus dem Durchsatz des Boards, die live mitrechnet, wenn Aufgaben bewegt, angelegt oder archiviert werden. Eine gemeinsame Filterleiste wie bei Kanbanflow: Zeitraum (heute bis dieses Jahr oder eigener), Farben und Spalten ausschließen, nur Personen, nur Labels. Die Filter stehen in einer zugeklappten Box, je Filter eine Zeile, und dauerhaft als `report-filter:` im Frontmatter der Board-Datei — für alle Berichte des Boards und alle, die es ansehen. Die Prognose (Wie lange noch, Fever Chart) misst den Durchsatz in den letzten N Tagen (Messbasis, Standard 90, gleitend, nie vor der ersten Aufgabe). „Rechnen ab“ (`start:`) lässt Burndown, Durchlaufzeit, Wie lange noch und das Fever Chart erst an einem Tag beginnen, etwa nach einer Neuplanung. Kürzel `g v`, `g d`, `g w`, `g f`. In „Wie lange noch“ lassen sich feste **Termine** eintragen (Name, Datum, Farbe, Linie durchgehend/gestrichelt/gepunktet, Stärke fein/normal/fett); sie stehen als `milestones:` im Frontmatter der Board-Datei, erscheinen als Linie im Diagramm, und je Spalte steht die Wahrscheinlichkeit, den Termin zu halten. Das **Projekt-Fever-Chart** (`g f`) zeigt je Tag Fortschritt (Anteil erledigt) gegen Pufferverbrauch bis zum Zieltermin (`target: true` an einem Termin) vor den CCPM-Zonen grün, gelb und rot; Puffer, Perzentil, Einheit, Zonen, Auflösung der Anzeige (Tag, Woche, Monat) und die Zielspalte („Erledigt heißt“: welcher Block aus „Wie lange noch“ als erledigt zählt) stehen als `fever:` am Board, die gerechneten Tage als Cache in `berichte/<board>-fieber.md` (Commit von „kanbanD“).

## Der Ordner

```
<ordner>/
  kanbanD.md                 Personen (people), Klassen (classes), Quellpfade (sources),
                             Register der Anwendungen (sources.applications: je Kürzel name, wbs, requirements)
  boards/<slug>.md           # Titel, je Spalte „## Name“, je Aufgabe „- [#12](../aufgaben/0012-….md)“;
                             im Frontmatter optional applications: [kd] — die gebundenen Anwendungen ([] = keine)
  aufgaben/0012-titel.md     Frontmatter (id, title, class, assignees, labels, due, origins, archived),
                             Beschreibung, „- [ ]“-Teilaufgaben, Codeblöcke kanbanD-time und kanbanD-comments
  aufgaben/0012-titel/       Anhänge
```

Liegen WBS und Anforderungen in einem anderen Repository, trägt man die Anwendung einmal mit vollen Pfaden ins Register ein (Einrichten → Anwendungen); Aufgaben nennen ihre Herkunft dann mit Kürzel, `kd:I0007` oder `kd:R00014`. Ohne Kürzel löst eine Herkunft nur auf, solange es genau eine Anwendung gibt. Ein Board ohne `applications:` gilt bei genau einer registrierten Anwendung als an sie gebunden; `applications: []` löst es ausdrücklich (reines Kanban, keine Phasen-Spalten, keine WBS-Sicht). Die Bindung setzt der Spalten-Dialog („Gebunden an“) oder `PUT /api/boards/{slug}/anwendungen` mit `[kürzel…]`, ein Commit je Änderung. Eine Anwendung, deren Pfad fehlt, gilt als nicht erreichbar; die Boards bleiben benutzbar.

Eine Aufgabe zu bewegen ändert nur die Board-Datei. Ein Zug über die API ohne `index` setzt die Karte oben in die Zielspalte, damit die zuletzt bewegte Karte immer oben steht. Dieselbe Aufgabe kann auf mehreren Boards liegen. Wer an kanbanD vorbei Dateien ändert, sieht sie live in allen Browsern; committet wird das nicht von kanbanD.

Mehrere Agenten an einem Board: jede laufende Instanz nennt im Header `X-KanbanD-Instanz` eine selbst gewählte Kennung. `POST /api/boards/{slug}/ziehen {von, nach?}` nimmt atomar die oberste freie Karte einer Spalte, reserviert sie 24 h für diese Instanz (`reservation` im Frontmatter), macht die Person zuständig und zieht sie oben in die Folgespalte — zwei Instanzen bekommen nie dieselbe Karte. Menschen sehen Reservierungen als Schloss auf der Karte und unter „Alle Aufgabenreservierungen anzeigen“ im Board-Menü und können sie dort freigeben.

## Für Agenten

`GET /api` beschreibt alle Endpunkte, `GET /api/openapi.json` vollständig als OpenAPI 3.1 mit Feldern, erlaubten Werten und Formaten (erzeugt aus den Rust-Typen; `GET /api` mit `Accept: application/json` leitet dorthin), `GET /api/endpunkte` knapp als JSON. Ein Objekt kommt direkt, eine Liste verpackt (`{aufgaben: […]}`); `GET /api/aufgaben` filtert über `board`, `spalte`, `klasse`, `signal`, `zustaendig`, `reserviert`, `archivierte`. Schreibende Aufrufe nennen `X-KanbanD-Wer: <kürzel>`:

```bash
curl -X POST http://localhost:7420/api/aufgaben -H 'X-KanbanD-Wer: cl' \
     -H 'Content-Type: application/json' -d '{"titel":"Dateiwächter","board":"entwicklung"}'
```

`GET /api/ereignisse` meldet jede Änderung im Ordner als Server-Sent Event, dazu Änderungen und Commits an den WBS-Dateien der registrierten Anwendungen (`wbs: [kürzel]`). `GET /api/wbs/<kürzel>` liefert die WBS mit gerechnetem Status, erreichter Ebene, Stand und `nicht_committet`; `PATCH /api/wbs/<kürzel>/knoten/<id> {status}` setzt den Status eines Blatts (409 bei Knoten mit Kindern oder defekter Datei). `POST /api/wbs/<kürzel>/knoten {ebene, eltern, name, fertig_kriterium, …}` legt einen Knoten an und antwortet mit `{id}`; `POST /api/wbs/<kürzel>/knoten/<id>/verwerfen {grund?}` verwirft ihn. `PATCH /api/aufgaben/<nr>/wbs-effects {application, action: create|rework|remove, node?, parent?, level?, name?, done_criterion?}` hängt eine Wirkung an und führt sie aus (409, wenn die WBS scheitert); `DELETE /api/aufgaben/<nr>/wbs-effects/<i>` nimmt sie aus der Aufgabe. `GET /api/berichte/bewegungen?board=<slug>` liefert je Aufgabe die Spaltenwechsel aus Git — die Grundlage der Board-Berichte; bei einem gebundenen Board dazu `phasen {anwendung, folge, spaltenphasen}` und je Aufgabe `labels` und `uebersprungen`. `PATCH /api/aufgaben/<nr> {phasen: {uebersprungen: [...]}}` setzt die entfallenden Phasen.

## Tests

```bash
cargo test                       # Unit und Integration (gegen das echte Programm und echtes Git)
node --test e2e/einheit/         # Unit-Tests der reinen JavaScript-Funktionen
cd e2e && npm install && npx playwright install chromium && npx playwright test   # E2E im Browser
cargo llvm-cov --summary-only    # Abdeckung
```
