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
- **Zählen in Berichten je Aufgabe** (`reporting: {burndown: false, forecast: false}` im Frontmatter der Aufgabe, Abschnitt „Zählt in Berichten“ im Aufgabenfenster, `PATCH /api/aufgaben/<nr> {reporting: {forecast: false | null}}`): `false` nimmt die Aufgabe aus dem Burndown bzw. aus Wie lange noch (Umfang, Nenner und Durchsatz je Spalte), `null` entfernt den Schlüssel — fehlt er, zählt die Aufgabe (Standard). Beide Berichte nennen die Ausgenommenen unter „Nicht enthalten“; der Berichtsfilter wirkt zusätzlich, unbekannte Schlüssel unter `reporting` bleiben erhalten. `GET /api/berichte/bewegungen` liefert `reporting` je Aufgabe mit.
- **Filter:** Text, `#12`, `@kürzel`, `class:bug`, `origin:I0023`, `label:ui`, `is:archived`.
- **Berichte** (Menü „Berichte“): Stundenzettel, Zeiten nach Aufgabe und Person, Burndown, Durchlaufzeit (Lead und Cycle Time zwischen wählbaren Spalten) und **Wie lange noch** — eine Monte-Carlo-Prognose je Spalte aus dem Durchsatz des Boards, die live mitrechnet, wenn Aufgaben bewegt, angelegt oder archiviert werden. Eine gemeinsame Filterleiste wie bei Kanbanflow: Zeitraum (heute bis dieses Jahr oder eigener), Farben und Spalten ausschließen, nur Personen, nur Labels. Die Filter stehen in einer zugeklappten Box, je Filter eine Zeile, und dauerhaft als `report-filter:` im Frontmatter der Board-Datei — für alle Berichte des Boards und alle, die es ansehen. Die Prognose (Wie lange noch, Fever Chart) misst den Durchsatz in den letzten N Tagen (Messbasis, Standard 90, gleitend, nie vor der ersten Aufgabe). „Rechnen ab“ (`start:`) lässt Burndown, Durchlaufzeit, Wie lange noch und das Fever Chart erst an einem Tag beginnen, etwa nach einer Neuplanung. Kürzel `g v`, `g d`, `g w`, `g f`. In „Wie lange noch“ lassen sich feste **Termine** eintragen (Name, Datum, Farbe, Linie durchgehend/gestrichelt/gepunktet, Stärke fein/normal/fett); sie stehen als `milestones:` im Frontmatter der Board-Datei, erscheinen als Linie im Diagramm, und je Spalte steht die Wahrscheinlichkeit, den Termin zu halten. Das **Projekt-Fever-Chart** (`g f`) zeigt je Tag Fortschritt (Anteil erledigt) gegen Pufferverbrauch bis zum Zieltermin (`target: true` an einem Termin) vor den CCPM-Zonen grün, gelb und rot; Puffer, Perzentil, Einheit, Zonen, Auflösung der Anzeige (Tag, Woche, Monat) und die Zielspalte („Erledigt heißt“: welcher Block aus „Wie lange noch“ als erledigt zählt) stehen als `fever:` am Board, die gerechneten Tage als Cache in `berichte/<board>-fieber.md` (Commit von „kanbanD“).

## Der Ordner

```
<ordner>/
  kanbanD.md                 Personen (people), Klassen (classes — die Vorgabe für Boards ohne eigene), Quellpfade (sources),
                             Register der Anwendungen (sources.applications: je Kürzel name, repository)
  boards/<slug>.md           # Titel, je Spalte „## Name“, je Aufgabe „- [#12](../aufgaben/0012-….md)“;
                             im Frontmatter optional applications: [kd] — die gebundenen Anwendungen ([] = keine)
                             und classes: — eigene Klassen dieses Boards in der Form von kanbanD.md ({} = keine)
  aufgaben/0012-titel.md     Frontmatter (id, title, class, assignees, labels, due, origins, archived),
                             Beschreibung, „- [ ]“-Teilaufgaben, Codeblöcke kanbanD-time und kanbanD-comments
  aufgaben/0012-titel/       Anhänge
```

Je Anwendung nennt das Register ihr **Repository** (`repository`, ein Ordner darin genügt, absolut oder relativ zum kanbanD-Ordner; die Standardanwendung ohne Kürzel heißt `sources.repository`). Daraus ermittelt kanbanD die Wurzel für Commit-Verweise, Commit-Liste und Diff (`git rev-parse --show-toplevel`); ein gesetztes, aber fehlendes Repository fällt nicht zurück (`repository_fehlt`). Lese-Rückfall für ein Register in Altform: fehlt `repository`, gilt der Ordner von `wbs`, sonst `requirements` als Startpunkt — die Datei selbst öffnet kanbanD nie (ADR-0034 Regel 1). Geschrieben wird je Anwendung und in `sources` nur `repository`; ein mitgeschicktes Pfadfeld eines älteren Schreibers wird überlesen (200, nie 400). Ein Register in Altform öffnet ohne Commit und ohne Warnung und steht nach dem nächsten Speichern der Einstellungen in neuer Form. `GET /api/einstellungen` und `GET /api/anwendungen` liefern je Anwendung `repository` (gespeichert oder Startordner, leer = `""`) und `erreichbar.repository` (der Ordner ist vorhanden, ohne Git-Aufruf).

Trägt man die Anwendung einmal ins Register ein (Einrichten → Anwendungen), nennen Aufgaben ihre Herkunft dann mit Kürzel, `kd:I0007` oder `kd:R00014`. Die Herkunft ist ein Verweis, den kanbanD nicht auflöst; ohne Kürzel ist sie bei mehreren Anwendungen mehrdeutig (ADR-0034 N3 Regel 8). Sie wird gelesen, geschrieben, auf Schreibweise geprüft, gefiltert (`origin:`) und exportiert und als Text gezeigt — ein Sprung in den Editor und „wartet auf“ gibt es nicht. Ein Board ohne `applications:` gilt bei genau einer registrierten Anwendung als an sie gebunden; `applications: []` löst es ausdrücklich. Die Bindung hat keine eigene Wirkung auf Spalten und Berichte. Die Bindung setzt der Spalten-Dialog („Gebunden an“) oder `PUT /api/boards/{slug}/anwendungen` mit `[kürzel…]`, ein Commit je Änderung. Eine Anwendung, deren Pfad fehlt, gilt als nicht erreichbar; die Boards bleiben benutzbar.

**Klassen je Board.** Ein Board ohne `classes:` zeigt die Klassen aus `kanbanD.md` (die Vorgabe des Ordners). Trägt die Board-Datei `classes:`, gelten auf diesem Board nur seine eigenen — gemischt wird nicht; `classes: {}` heißt „dieses Board führt keine Klassen“. Eingerichtet wird das unter „Spalten einrichten“ („Klassen dieses Boards“: eigene Klassen beginnen als Kopie der Vorgabe) oder mit `PUT /api/boards/{slug}/klassen` (`{klassen: [{schluessel, bezeichnung, farbe}] | null}`, `null` kehrt zur Vorgabe zurück), ein Commit je Änderung. Die Aufgabe behält ihren einen Schlüssel (`class`): kennt das Board ihn nicht, ist die Klasse dort fremd und steht als Text ohne Farbe auf der Karte — entfernt wird sie nie. Eine Klasse setzen lässt sich nur, wenn ein Board der Aufgabe sie führt (sonst 400 mit Board und Schlüssel); in der Aufgabenliste gilt das erste Board der Aufgabe, ohne Board die Vorgabe.

Eine Aufgabe zu bewegen ändert nur die Board-Datei. Ein Zug über die API ohne `index` setzt die Karte oben in die Zielspalte, damit die zuletzt bewegte Karte immer oben steht. Dieselbe Aufgabe kann auf mehreren Boards liegen. Wer an kanbanD vorbei Dateien ändert, sieht sie live in allen Browsern; committet wird das nicht von kanbanD.

Mehrere Agenten an einem Board: jede laufende Instanz nennt im Header `X-KanbanD-Instanz` eine selbst gewählte Kennung. `POST /api/boards/{slug}/ziehen {von, nach?}` nimmt atomar die oberste freie Karte einer Spalte, reserviert sie 24 h für diese Instanz (`reservation` im Frontmatter), macht die Person zuständig und zieht sie oben in die Folgespalte — zwei Instanzen bekommen nie dieselbe Karte. Menschen sehen Reservierungen als Schloss auf der Karte und unter „Alle Aufgabenreservierungen anzeigen“ im Board-Menü und können sie dort freigeben.

## Vorlagen

Eine Vorlage ist eine gewöhnliche Karte oder ein gewöhnliches Board, das als Kopiervorlage dient — es gibt kein eigenes Format, keinen `vorlagen/`-Ordner, kein `template:`-Feld, keine Format-Versionierung und keine Aktion „Als Vorlage speichern“.

**Kartenvorlage.** Die Vorlagenkarte steht offen in der Spalte, in der die Arbeit beginnt, etwa „Eingang“ oder „Backlog“ — dann liegt die Kopie gleich am richtigen Ort; auf dieser Spalte keine WIP-Grenze, sonst weist kanbanD einen Agenten mit 409 ab. Im Kartenmenü „Duplizieren“ entsteht die Kopie in derselben Spalte, mit dem Titelzusatz „(Kopie)“. Sie trägt Beschreibung, Teilaufgaben (alle offen), Klasse, Zuständige, Labels, Fälligkeit und Herkunft, aber keinen Fremdschlüssel (`key`), keine Zeiten, Kommentare, Anhänge und keinen Verlauf; danach Titel kürzen und Felder anpassen.

**Boardvorlage über die Datei.** `boards/<vorlage>.md` kopieren, den Dateinamen neu setzen (er ist Slug und Adresse `#/board/<slug>`) und die `# `-Überschrift anpassen, die Aufgabenzeilen `- [#nr](../aufgaben/…)` entfernen und ein `archived:` aus dem Frontmatter streichen. Die übrigen Schlüssel bleiben und tragen die Struktur mit: `limits`, `column-notes`, `column-colors`, `column-owner`, `column-dates`, `milestones`, `start`, `fever`, `report-filter`, `report-labels` und `applications`. Die kopierte Datei committet der Mensch selbst; das neue Board erscheint im Board-Umschalter.

**Boardvorlage ohne Datei.** Im Board-Umschalter „Neues Board · Enter“ anlegen — die drei Standardspalten „Zu erledigen“, „In Arbeit“ und „Erledigt“ kommen mit —, dann die Struktur im Spalten-Dialog (`PUT /api/boards/{slug}/spalten`) einrichten und Termine (R00047), Berichtsfilter (R00043) und „Rechnen ab“ in den Berichten nachziehen.

**Karten ins neue Board.** Der Mensch dupliziert die Karte auf der Vorlagen-Seite (die Kopie bleibt in der Quellspalte), legt sie im Kartenmenü „Auf Board legen“ und nimmt sie in der Aufgabenliste „Von Board nehmen“. Ein Agent ruft `POST /api/aufgaben/{nr}/duplizieren {board, spalte}` und bekommt die Kopie direkt in der Zielspalte.

**Grenzen.** Keine Automatik — beim Anlegen wird keine Vorlage angeboten. Keine Wahl von Zielboard und Zielspalte im Kartenmenü — die Kopie bleibt in der Spalte der Quelle. kanbanD kopiert keine Board-Struktur. Vorlagen zählen nur auf ihrem Board in den Berichten; Berichte und Berichtsfilter gelten je Board.

## Für Agenten

`GET /api` beschreibt alle Endpunkte, `GET /api/openapi.json` vollständig als OpenAPI 3.1 mit Feldern, erlaubten Werten und Formaten (erzeugt aus den Rust-Typen; `GET /api` mit `Accept: application/json` leitet dorthin), `GET /api/endpunkte` knapp als JSON. Ein Objekt kommt direkt, eine Liste verpackt (`{aufgaben: […]}`); `GET /api/aufgaben` filtert über `board`, `spalte`, `klasse`, `signal`, `zustaendig`, `reserviert`, `archivierte`. Schreibende Aufrufe nennen `X-KanbanD-Wer: <kürzel>`:

```bash
curl -X POST http://localhost:7420/api/aufgaben -H 'X-KanbanD-Wer: cl' \
     -H 'Content-Type: application/json' -d '{"titel":"Dateiwächter","board":"entwicklung"}'
```

Der Link auf eine Aufgabe ist `http://<host>:7420/#/board/<slug>/aufgabe/<nr>` — er öffnet das Board mit dem Aufgabenfenster; für eine Aufgabe ohne Board `#/aufgaben/aufgabe/<nr>` (die Aufgabenliste mit dem Fenster).

`GET /api/instanz` nennt `{ordner, port, version}` — den bedienten Ordner absolut und kanonisch, den gebundenen Port und die Programmversion: Daran erkennt ein Agent seine Instanz, wenn mehrere auf wechselnden Ports laufen (das Programm weicht bei belegtem Port auf den nächsten freien aus). Die Antwort kommt ohne `X-KanbanD-Wer` und liest den Ordner nicht — auch dann, wenn `GET /api/zustand` an einer Datei scheitert.

`GET /api/ereignisse` meldet jede Änderung im Ordner als Server-Sent Event `{pfade, extern}`. `GET /api/berichte/bewegungen?board=<slug>` liefert je Aufgabe die Spaltenwechsel aus Git — die Grundlage der Board-Berichte, je Aufgabe mit `labels` und `reporting`; die Berichte rechnen je Spalte.

### Transkripte ablegen

Ein Agent legt das Transkript seines Laufs als schon gezippte JSON-Lines-Datei (`.jsonl.gz`, höchstens 10 MB) an der Karte ab — mit derselben Kennung `role@at` wie der Kosteneintrag desselben Laufs (ADR-0036):

```bash
curl -H 'X-KanbanD-Wer: entwickler' \
     -F at='2026-11-13 10:34+01:00' -F role=entwickler -F column=Entwicklung \
     -F datei=@lauf.jsonl.gz  http://127.0.0.1:<port>/api/aufgaben/1/transkripte
→ 201 {kennung: "entwickler@2026-11-13T10:34+01:00", at, role, column, bytes: 281234}
```

- Die Datei liegt danach **unversioniert** unter `transkripte/<nr>/` (der Ordner ignoriert sich selbst über `transkripte/.gitignore`); versioniert wird nur der Eintrag `transcripts` an der Karte, in einem Commit nur mit der Aufgabendatei. Der Dateiname entsteht aus der Kennung, die Rolle auf `a-z0-9-` gefaltet.
- Abgelegt wird nur, wenn ein Mensch `record-transcripts: true` in die Board-Datei oder als Vorgabe in `kanbanD.md` geschrieben hat (keine Route setzt ihn). Liegt die Karte auf mehreren Boards, müssen alle „an“ sein. Sonst antwortet die API **409** `{fehler, erfassung: "aus", boards}`, bevor sie die Datei liest; `GET /api/aufgaben/{nr}/transkripte` zeigt das vorher (`erfassen`, `boards_aus`), `GET /api/boards/{slug}` den Wert des Boards als `transkripte_erfassen`.
- Weitere Antworten: 413 über 10.485.760 Byte, 400 ohne gzip-Kennbytes (`1f 8b 08`) oder bei fehlenden bzw. ungültigen Feldern (`column` ist eine Spalte eines Boards der Karte, `at` nicht in der Zukunft), 409 `{fehler, kennung}` bei derselben Kennung oder demselben gefalteten Dateinamen (eine Minute später ablegen), 409 ab 1000 Transkripten je Karte. Die Höchstzahl prüft die API vor dem Körper, die Kennung vor der Datei, wenn `at`, `role` und `column` vor `datei` stehen (wie im Beispiel).
- `GET /api/aufgaben/{nr}/transkripte` listet `{erfassen, boards_aus, transkripte: [{kennung, at, role, column, bytes, zustand}]}` mit `zustand` `vorhanden`, `fehlt`, `abweichend` oder `unlesbar`; `GET …/transkripte/{kennung}` (Kennung URL-kodiert, `+` als `%2B`) liefert die Datei als `application/gzip` (bei vollem Antwortbudget 503), `DELETE …/transkripte/{kennung}` entfernt Eintrag und Datei. Endgültiges Löschen der Karte räumt `transkripte/<nr>/`.

### Alte Kostenposten nachtragen

Seit den Kosteneinträgen (`cost-entries`, ADR-0028) trägt eine Aufgabe ihre angefallenen Kosten je Rollenlauf mit Zeitpunkt, Rolle und Spalte. Ältere Aufgaben tragen stattdessen Posten ohne diese Angaben (`cost.items`); der Bericht „Kosten“ führt sie in der Zeile „ohne Datum / ohne Rolle / ohne Spalte“. kanbanD überführt sie nicht selbst — Zeitpunkt, Rolle und Spalte wären erfunden. Wer sie nachtragen will (Mensch oder Agent), geht je Aufgabe so vor:

1. **Lesen:** `GET /api/aufgaben/{nr}` liefert die alten Posten unter `cost.items` und die vorhandenen Einträge unter `kosteneintraege`.
2. **Herleiten:** Zeitpunkt und Spalte aus der Git-Geschichte der Aufgabendatei (`git log -p -- aufgaben/<datei>`: der Commit, der den Posten schrieb, und die Spalte, in der die Aufgabe damals lag), die Rolle aus dem Text des Postens. Was sich nicht belegen lässt, ist geraten — in einer Liste ausweisen.
3. **Eintragen**, je Posten ein Aufruf:

   ```bash
   curl -X POST http://localhost:7420/api/aufgaben/42/kosteneintraege -H 'X-KanbanD-Wer: cl' \
        -H 'Content-Type: application/json' \
        -d '{"at":"2026-11-10 09:00","role":"entwickler","column":"Entwicklung","amount":0.30,"currency":"USD"}'
   ```

4. **Alte Posten entfernen**, sobald alle Posten der Aufgabe eingetragen sind — sonst zählt der Bericht ohne Zeitraum und Spaltenabschnitt beides: `PATCH /api/aufgaben/42` mit `{"cost": null}` entfernt den ganzen Abschnitt `cost` (auch eine Schätzung darin; soll sie bleiben, stattdessen `{"cost": {"currency": "USD", "amount": 1.50}}` ohne `items` senden). Die Einträge berührt das nicht.

Worauf zu achten ist:

- `at` darf nicht in der Zukunft liegen; ohne Versatz gilt die Ortszeit des Rechners.
- `column` muss eine Spalte eines Boards sein, auf dem die Aufgabe liegt, sonst 400 — bei umbenannten Spalten den heutigen Namen nehmen.
- Ein Eintrag ist durch Rolle und Minute bestimmt (`kennung`): derselbe Aufruf ein zweites Mal gibt 409 und schreibt nichts — das Nachtragen lässt sich also gefahrlos wiederholen. Zwei Posten derselben Rolle in derselben Minute: den zweiten eine Minute später eintragen.
- Jeder Aufruf ist ein Commit im Ordner; ein Fehlgriff lässt sich über `DELETE /api/aufgaben/{nr}/kosteneintraege/{kennung}` oder die Git-Geschichte zurücknehmen.

### Commits an der Karte hinterlegen

Eine Aufgabe trägt unter `commits` die Commits, die für sie entstanden sind — als Verweis `<kürzel>:<hash>` auf das Arbeits-Repository einer registrierten Anwendung (`<hash>` allein meint die Standardanwendung aus `sources.repository`). Ein Agent hängt seine Commits gleich nach dem Bericht an, auch wenn sie noch auf dem Kartenzweig im Worktree liegen:

```bash
curl -X POST http://localhost:7420/api/aufgaben/42/commits -H 'X-KanbanD-Wer: entwickler' \
     -H 'Content-Type: application/json' -d '{"commits": ["kd:3f2a9c1", "kd:9c6b91f"]}'
```

- kanbanD prüft nur lesend (`git rev-parse` im Repository des Registers), dass es den Commit gibt, und speichert den vollen Hash. Ein Kurz-Hash ab 7 Zeichen genügt; ist er mehrdeutig, den längeren nennen.
- Alles oder nichts: ein falscher Verweis (Form, Kürzel, Repository, Commit) gibt 400 `{fehler, verweis}` und schreibt keinen. Schon hinterlegte Verweise werden übersprungen — derselbe Aufruf noch einmal gibt 200 ohne Commit, das Hinterlegen lässt sich also gefahrlos wiederholen.
- Entfernen: `DELETE /api/aufgaben/42/commits/kd:3f2a9c1` (voller Hash oder an der Karte eindeutiger Präfix) — auch wenn das Repository fehlt.
- `GET /api/aufgaben/42` liefert die gespeicherten Verweise unter `commits`; angezeigt werden sie noch nicht.

Beispiel „nach einem Rebase nachziehen“: Hat `git rebase` die Commits des Kartenzweigs neu gehasht, nennt der Agent Paare alt → neu und ersetzt alle Verweise mit einem Aufruf und einem Commit (`alt` aus der Liste vor, `neu` aus der Liste nach dem Rebase):

```bash
curl -X POST http://localhost:7420/api/aufgaben/42/commits/ersetzen -H 'X-KanbanD-Wer: entw1' \
     -H 'Content-Type: application/json' \
     -d '{"ersetzungen": [{"alt": "kd:3f2a9c1", "neu": "kd:8e20ad9"}, {"alt": "kd:9c6b91f", "neu": "kd:1d4c7e2"}]}'
```

- Der neue Verweis steht an der Stelle des alten und trägt dasselbe Kürzel; alle anderen Verweise behalten Platz und Wortlaut. 1 bis 500 Paare, ein Verweis höchstens einmal (auch nicht als Kette oder Tausch).
- `neu` wird geprüft wie beim Hinterlegen, `alt` nur gegen die Karte, nie im Arbeits-Repository — auch ein verschwundener Commit lässt sich ersetzen.
- Alles oder nichts, und wiederholbar: ein Paar, dessen `alt` nicht mehr und dessen `neu` schon an der Karte steht, gilt als erledigt; bleibt keines übrig, ist die Antwort 200 ohne Commit.
- Fehler `{fehler, verweis}`: 400 (Rumpf, Form, Kürzel, doppelt, Kette, mehrdeutiger Präfix, `neu` unbekannt), 404 (`alt` und `neu` stehen nicht an der Karte), 409 (beide stehen dort; `verweis` ist das `alt`, das sich mit `DELETE` entfernen lässt), 503 (Git über 10 s).

### Commits einer Karte lesen

`GET /api/aufgaben/{nr}/commits` liefert zu jedem Verweis der Karte, was ein Reviewer wissen will — live und nur lesend aus dem Arbeits-Repository des Registers, ohne `X-KanbanD-Wer`:

```
GET /api/aufgaben/1/commits
→ 200
{"commits": [
  {"verweis": "kd:<K3>", "anwendung": "kd", "hash": "<K3>", "zustand": "auf_zweig",
   "zweige": ["main"], "entfernte_zweige": ["o/main"],
   "titel": "c.txt anlegen", "autor": "Ada Autorin", "datum": "2026-03-01T10:00:00+01:00",
   "plus": 3, "minus": 0, "dateien": 1},
  {"verweis": "kd:<W1>", "anwendung": "kd", "hash": "<W1>", "zustand": "auf_zweig",
   "zweige": ["karte/1"], "entfernte_zweige": [], "titel": "b.txt anlegen", …},
  {"verweis": "kd:<V2>", "anwendung": "kd", "hash": "<V2>", "zustand": "fehlt"}
]}
```

- Zustände: `auf_zweig` (ein lokaler oder entfernter Zweig erreicht den Commit; je Liste höchstens 10 Namen, der Rest steht in `zweige_weitere`), `verwaist` (der Commit existiert, aber kein Zweig erreicht ihn), `fehlt` (kein Commit-Objekt), `repository_fehlt` und `unlesbar` (mit `grund`), `anwendung_unbekannt`.
- **`verwaist` heißt nach einem Rebase oder Squash: die Verweise sind nachzuziehen** — mit `POST /api/aufgaben/{nr}/commits/ersetzen` den alten Hash durch den neuen ersetzen; den neuen nennt `GET …/commits/{verweis}/nachfolger` (nächster Abschnitt).
- Reihenfolge: älteste zuerst nach dem Commit-Datum, Einträge ohne Datum (`fehlt`, `unlesbar`, …) danach. `titel` ist die erste Zeile der Nachricht (höchstens 500 Zeichen), `autor` nur der Name, `plus`/`minus`/`dateien` zählen gegen den ersten Elternteil.
- Hängt Git, antwortet der Aufruf nach höchstens 15 s mit 503 — nie mit einer halben Liste; Schreibvorgänge an der Karte warten nie auf ihn. Sind alle 4 Plätze der Lesegrenze bis zur Frist belegt, kommt ebenfalls 503; `fehler` beginnt mit „Lesegrenze“, Git ist nicht gestartet, und kanbanD wiederholt nicht selbst — die Liste später erneut lesen.

### Nachfolger eines verwaisten Commits suchen

`GET /api/aufgaben/{nr}/commits/{verweis}/nachfolger` sucht zu einem Verweis „auf keinem Zweig“ (`verwaist`) die Commits auf den lokalen und entfernten Zweigen, die denselben Patch tragen (gleiche `git patch-id --stable`) — die Kandidaten für den Commit, den ein Rebase oder Cherry-pick daraus gemacht hat. Nur auf Anfrage, live und nur lesend, ohne `X-KanbanD-Wer`. kanbanD ersetzt nie selbst, auch nicht bei genau einem Kandidaten.

Beispiel „Nachfolger suchen, dann ersetzen“:

```bash
curl http://localhost:7420/api/aufgaben/42/commits/kd:3f2a9c1/nachfolger
# → 200 {"verweis": "kd:3f2a9c1…", "hash": "3f2a9c1…", "durchsucht": 37,
#        "kandidaten": [{"verweis": "kd:8e20ad9…", "hash": "8e20ad9…", "titel": "Zeile zwei ändern", "autor": "Ada",
#                        "datum": "2026-11-21T09:12:00+01:00", "zweige": ["main"], "entfernte_zweige": [], "an_der_karte": false}],
#        "hinweise": []}
curl -X POST http://localhost:7420/api/aufgaben/42/commits/ersetzen -H 'X-KanbanD-Wer: entw1' \
     -H 'Content-Type: application/json' \
     -d '{"ersetzungen": [{"alt": "kd:3f2a9c1", "neu": "kd:8e20ad9…"}]}'
```

- `verweis` des Kandidaten passt wörtlich als `neu` in `ersetzen`. Steht er schon an der Karte (`an_der_karte: true`), gäbe `ersetzen` 409 — dann den verwaisten Verweis mit `DELETE /api/aufgaben/42/commits/kd:3f2a9c1` entfernen.
- Gesucht wird unter höchstens 1.000 Commits ab einem Tag vor dem Autordatum des verwaisten, Commit-Datum absteigend, dann Hash; höchstens 10 Kandidaten, der Rest steht in `kandidaten_weitere`. Kein Kandidat ist kein Fehler (`kandidaten: []`) — nach Squash oder einem anders gelösten Konflikt gibt es keinen.
- `hinweise`: `suche_gekappt` (`durchsucht`, `grund`: `fenster`, `vorfilter` oder `patch` — ein Nachfolger kann fehlen), `merge` (für einen Merge-Commit wird nicht gesucht), `leer` (der Commit ändert keine Datei). Eine unbekannte `art` überspringen.
- Die Antwort nennt nie Patch-Text, Dateinamen oder Zeilen; ein Kandidat ist kein Verweis der Karte — sein Diff bleibt gesperrt, bis er ersetzt ist.
- Statuscodes: 200, 304 (`If-None-Match` gleich dem `ETag`), 400 (Form, mehrdeutiger Präfix), 404 (Aufgabe; Verweis nicht an der Karte `{fehler, verweis}`; Zustand nicht `verwaist` `{fehler, zustand, grund?}`), 423 (defekte Datei), 503 (Git über 10 s, nie eine Teilliste). Sind alle 4 Plätze der Lesegrenze bis zur Frist belegt, kommt ebenfalls 503; `fehler` beginnt mit „Lesegrenze“, Git ist nicht gestartet, und kanbanD wiederholt nicht selbst — die Suche später erneut lesen.

### Diff eines Commits lesen

`GET /api/aufgaben/{nr}/diff?commit=<verweis>` liefert, was ein einzelner Commit der Karte geändert hat — gegen seinen ersten Elternteil, live und nur lesend aus dem Arbeits-Repository, ohne `X-KanbanD-Wer`. `commit` ist ein Verweis der Karte, wörtlich oder mit einem an der Karte eindeutigen Hash-Präfix ab 7 Zeichen:

```
GET /api/aufgaben/1/diff?commit=kd:<X1>
→ 200
{"anwendung": "kd",
 "commits": [{"verweis": "kd:<X1>", "anwendung": "kd", "hash": "<X1>", "titel": "Text, Binär, Umbenennung",
              "autor": "Ada Autorin", "datum": "2026-03-05T09:00:00+00:00", "plus": 1, "minus": 1, "dateien": 3}],
 "dateien": [
   {"alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1,
    "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false,
    "patch": "@@ -1,2 +1,2 @@\n eins\n-zwei\n+Zwei\n"},
   {"neu": "bild.bin", "status": "A", "plus": 0, "minus": 0,
    "binaer": true, "gross": false, "nachladen": false, "nicht_utf8": false},
   {"alt": "c.txt", "neu": "c2.txt", "status": "R", "aehnlichkeit": 100, "plus": 0, "minus": 0,
    "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false}],
 "hinweise": []}
```

- **`gross` und `nachladen` sind Merkmale, keine Fehler**: `gross` heißt, der Patch der Datei ist über 256 KB oder über 3.000 Zeilen; `nachladen` heißt, der Patch passte nicht mehr in die 4 MB der Antwort. Beide holt man einzeln mit `&datei=<neu>` (bei gelöschten Dateien `alt`, buchstäblich) — bis 8 MB Patch, darüber bleibt die Datei `gross` und `hinweise` nennt sie (`zu_gross_zum_anzeigen`). Eine Datei mit einem Pfad über 4.096 Byte ist immer `gross` (ebenfalls mit `zu_gross_zum_anzeigen`).
- Mehr als 2.000 Dateien: die ersten 2.000 stehen da, `hinweise` enthält `{"art": "dateien_gekappt", "gezeigt": 2000, "gesamt": …}`, und `commits[0].dateien` bleibt die wahre Zahl. Eine unbekannte `art` überspringen.
- **Sehr große Commits — über 10.000 Einträgen nur genaue Umbenennungen**: die Einträge werden ohne Umbenennungssuche gezählt (gegen den ersten Elternteil, beim Wurzel-Commit gegen den leeren Baum). Über 10.000 Einträgen sucht der Diff nur Umbenennungen mit **gleichem Inhalt**: eine unveränderte Verschiebung bleibt `R` mit `aehnlichkeit` 100, eine Umbenennung mit Änderung erscheint als `D` (alter Pfad) und `A` (neuer Pfad) — beide vollständig und über `&datei=` ladbar. Dann steht an erster Stelle von `hinweise` `{"art": "umbenennung_eingeschraenkt", "dateien": n, "schwelle": 10000}` (auch bei `&datei=`, nicht in `&format=patch`); `dateien` ist die Zahl der Einträge ohne Umbenennungssuche. Die Schwelle ist eine Konstante des Programms.
- `&format=patch` liefert dieselbe Auswahl als Text (`text/x-diff`) mit den Kopfzeilen von Git — zum Lesen, nicht für `git apply`.
- **Antwortbudget**: alle Diff-Antworten, die gerade an Clients unterwegs sind, halten zusammen höchstens 64 MB; wer seine Antwort nicht binnen 60 s liest, verliert sie. Ist das Budget belegt, kommt sofort `503 {"fehler": "Antwortbudget von 64 MB belegt — Diff in einigen Sekunden erneut laden"}` — einige Sekunden warten und erneut laden.
- Jede Antwort zu einem Verweis mit vollem Hash trägt einen `ETag`; mit `If-None-Match` kommt 304 ohne Git-Aufruf.
- Kein Diff gibt es zu den Zuständen `fehlt`, `repository_fehlt`, `anwendung_unbekannt` und `unlesbar` (404 mit `zustand`). Hängt Git, antwortet der Aufruf nach höchstens 15 s mit 503 — nie mit einem halben Diff. Sind alle 4 Plätze der Lesegrenze bis zur Frist belegt, kommt ebenfalls 503; `fehler` beginnt mit „Lesegrenze“, Git ist nicht gestartet, und kanbanD wiederholt nicht selbst — den Diff später erneut lesen. Aus dem Repository läuft dabei kein Programm (`diff.external`, `textconv`, Pager und Hooks bleiben aus).

### Alle Änderungen der Karte lesen

`GET /api/aufgaben/{nr}/diff` **ohne** `commit` liefert den Gesamt-Diff der Karte für eine Anwendung: je Datei **netto** (ein Diff von der Basis — dem ersten Elternteil des ältesten Kartencommits — bis zum letzten), wo kein fremder Commit dazwischen dieselbe Datei berührt, sonst als **Folge** der Kartenschritte. Nie steht eine geänderte Zeile eines fremden Commits darin — außer der Kartenschritt löscht oder schreibt sie selbst um (dann zeigt sie schon sein Diff je Commit). Benennt ein Kartenschritt eine Datei um, gehören beide Namen zusammen: berührt ein fremder Commit einen davon, stehen beide als Folge. Beispiel (Karte #2: K1, fremd F, K2):

```
GET /api/aufgaben/2/diff
→ 200
{"anwendung": "kd",
 "spanne": {"basis": "<A0>", "letzter": "<K2>"},
 "commits": [{"verweis": "kd:<K1>", …}, {"verweis": "kd:<K2>", …}],
 "dateien": [
   {"pfad": "a.txt", "plus": 2, "minus": 2, "binaer": false,
    "schritte": [{"commit": "kd:<K1>", "alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1, …, "patch": "@@ …"},
                 {"commit": "kd:<K2>", "alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1, …, "patch": "@@ …"}]},
   {"neu": "k.txt", "status": "A", "plus": 3, "minus": 0, "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false,
    "patch": "@@ -0,0 +1,3 @@\n+k1\n+k2\n+k3\n"}],
 "hinweise": [{"art": "fremd_dazwischen", "commits": 1, "dateien": 1}]}
```

- **Netto-Einträge** sehen aus wie die Dateien des Diffs je Commit; **Folge-Einträge** tragen `pfad` und `schritte` (je Schritt `commit` = der Verweis wörtlich und die Felder einer Datei). `plus`/`minus` eines Folge-Eintrags ist die Summe der Schritte — eine Netto-Zahl gibt es dafür nicht. `dateien` steht nach dem Namen in Bytefolge.
- `anwendung=<kürzel>` wählt die Anwendung (leer = Standardanwendung); ohne gilt die erste in der Reihenfolge der Verweise, die übrigen nennt `weitere_anwendungen`.
- **Netto unverändert**: Eine Datei, die die Karte ändert und selbst wieder zurücknimmt (z. B. aus der Datei ein Verzeichnis und wieder zurück), erscheint nicht — weder in `dateien` noch in `format=patch` —, wie ein Zwischenname einer Umbenennungskette; `datei=` auf sie ergibt 404. Ihre Schritte bleiben über `?commit=` lesbar. `fremd_dazwischen` steht nur, wenn mindestens ein fremder Commit zwischen den Kartenschritten liegt (`commits` ≥ 1); belastet nur ein Merge der Karte eine Datei, ist sie Folge, und den Grund nennt `merge_ausgelassen`.
- **`hinweise`** in dieser Reihenfolge: `ganz_als_folge {grund: nicht_linear | fremd_zu_viele | fremd_zu_gross}` (dann ist `spanne` null und alles Folge), `fremd_dazwischen {commits, dateien}`, `weitere_anwendungen {anwendungen}`, `verwaist {verweis}`, `merge_ausgelassen {verweis}` (Merges an der Karte fallen heraus und bleiben über `?commit=` lesbar), `ausgelassen {verweis, zustand}`, dann `dateien_gekappt` und `zu_gross_zum_anzeigen` wie beim Diff je Commit.
- `&datei=<pfad>` liefert genau diesen Eintrag (bei einer Folge alle Schritte, bis 8 MB Patch). Steht der Pfad in keinem Kartencommit, ergibt das 404; steht er in Kartencommits, hat im Gesamtbild aber keinen Eintrag, ebenfalls 404, mit eigenem Text („… hat im Gesamtbild aber keine Änderung …“), und ist die Liste der Änderungen auch mit `datei=` zu groß, um zu sagen, ob er im Gesamtbild eine Änderung hat, 404 mit einem dritten Text, der auf `commit=` und `datei=` verweist (mit `datei=` läuft die Liste bis 20 MB statt 1 MB). `&format=patch` liefert Text: je Hinweis eine Zeile `# kanbanD: <art> …`, vor jedem Schritt `# kanbanD: Folge <pfad> — Schritt i von n, Commit <verweis>`; ohne Hinweise und Folge ist er bytegleich zu `git diff --full-index -M50% -l1000 --submodule=short <basis> <letzter>`.
- Grenzen und Antwortbudget wie beim Diff je Commit (4 MB Patch für Netto und Folge zusammen). Sind die Namen der Kartencommits länger als 4 MB (etwa 40.000 Dateien), zeigt eine Spanne ohne fremden Commit nur die Netto-Einträge bis zur Kappe; sonst bleibt `dateien` leer, und `dateien_gekappt` nennt als `gesamt` die Dateien der Kartencommits zusammen (Obergrenze) — die Dateien dann über `?commit=` je Commit laden; `ETag` gilt, solange sich kein Zweig im Repository bewegt. Keine Verweise dieser Anwendung → 404; `anwendung` zusammen mit `commit` → 400.

## Tests

```bash
cargo test                       # Unit und Integration (gegen das echte Programm und echtes Git)
node --test "e2e/einheit/*.js"  # Unit-Tests der reinen JavaScript-Funktionen
cd e2e && npm install && npx playwright install chromium && npx playwright test   # E2E im Browser
cargo llvm-cov --summary-only    # Abdeckung
```
