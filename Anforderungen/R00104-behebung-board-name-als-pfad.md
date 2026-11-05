---
id: R00104
status: Neu
datum: 2026-11-06
ursprung: Bug-Report
ursprungslauf: R00099
---

# R00104: Behebung des Board-Namens als Pfad — Lesen und Schreiben außerhalb des Board-Ordners

## Beschreibung

Der Board-Name aus Body, Pfad oder Filter wird ungeprüft zum Dateipfad `boards/{name}.md`. Wer über die API einen Namen wie `../../fremd/boards/b` oder `../aufgaben/0012-x` schickt, liest oder schreibt eine Datei außerhalb des Board-Ordners — bis außerhalb des Arbeitsordners — und kann eine eigene Aufgabendatei zerstören. Befund des Security-Reviews von Karte #5 (Karte #48, 2026-11-06).

Reproduktion (Karte #48, heute rot):
- `POST /api/aufgaben/erledigen` mit gültigem key/text/signal und `board: "../../fremd/boards/b"` → 500, die fremde Datei neben dem Arbeitsordner ist umgeschrieben, die eigene Aufgabendatei bleibt uncommittet liegen.
- Dasselbe mit `board: "../aufgaben/0012-x"` → 200, die Aufgabendatei `aufgaben/0012-x.md` hat ihr Frontmatter verloren, und das ist committet.
- `GET /api/boards/..%2F..%2Ffremd%2Fboards%2Fb` → 200 mit dem Inhalt der fremden Datei; `POST /api/aufgaben` mit `board` hat dieselbe Lücke.

Erwartet: Ein Board-Name, der nicht die Form hat, die kanbanD selbst erzeugt, wird vor jedem Dateizugriff mit 400 abgewiesen; nichts wird gelesen, geschrieben oder committet.

Zahlt ein auf: [Vision](R00000-vision.md) — „Das Board liegt im Repository, und Git ist sein Gedächtnis“: das Gedächtnis gilt nur, wenn die API keine Dateien außerhalb des Boards ändert und keine Aufgabe zerstört.

## Ursachenanalyse

### Root Cause

Belegt im Code (Stand `ea5df9d`, ADR-0008 Kontext):

- `board_pfad(slug)` setzt den Namen ungeprüft ein: `format!("{}/{slug}.md", board::ORDNER)` (`src/ablage.rs:148–150`).
- `Ordner::board(slug)` liest `board_pfad(slug)` ohne Prüfung und gibt `board::lesen(slug, …)` zurück — `Board.slug` ist damit der rohe Eingabewert (`src/ablage.rs:118–122`). `Ordner::lies` und `Ordner::schreib` hängen den relativen Pfad nur an die Wurzel (`src/ablage.rs:30–47`); `..` führt hinaus.
- Die Schreibwege lesen zuerst `ordner().board(slug)` und schreiben dann `board_pfad(&b.slug)`: Erledigen `src/dienst/erledigen.rs:89` und `:123`, Anlegen `src/dienst/aufgabe_anlegen.rs:167` und `:184`; ebenso bewegen, zuordnung, reservierung, termine, bindung, berichtsfilter, phasen (35 Fundstellen von `board_pfad` in `src/`).
- Lesewege: `GET /api/boards/{slug}` (`src/web/mod.rs:273–275`), Filter `?board=` (`src/web/mod.rs:311`), Verlauf `src/dienst/verlauf.rs:41–42` (bildet `board_pfad(slug)` aus dem Eingabewert statt aus dem gelesenen Board).
- `aktion()` schreibt jede Datei der Liste nacheinander und committet danach (`src/dienst/mod.rs:156–164`); es prüft weder Einschluss noch Doppelte. Bei `../aufgaben/0012-x` sind Board-Pfad und Aufgabendatei dieselbe Datei — die zweite Schreibung überschreibt die erste, das Ergebnis wird committet. Bei `../../fremd/…` liegt der Pfad außerhalb des Repositorys; der Commit scheitert (500), die bereits geschriebenen Dateien bleiben stehen.
- Die Liste nimmt jeden Dateistamm unter `boards/` als Namen (`Ordner::boards`, `src/ablage.rs:61–72`), auch einen, den kanbanD nie erzeugen würde.

Erzeugt werden Board-Namen nur über `modell::slug` (`src/modell/mod.rs:14`: `[a-z0-9-]`, höchstens 40 Zeichen). Ausgeschlossen: Der Fehler liegt nicht im Routing (axum dekodiert `%2F` im Pfadparameter korrekt) und nicht in `board::lesen` (das Format liest, was es bekommt).

Eingetreten (Abnahme-Probe der Karte #48) auf dem Weg Erledigen aus R00099; latent seit dem Anlegen mit `board` und dem Einzelabruf eines Boards. `ursprungslauf: R00099`, weil der Security-Review dieses Laufs den Befund gefunden hat und der zerstörende Weg (Aufgabendatei committet) mit R00099 dazukam.

### Betroffene Komponenten

- `src/modell/board.rs` (neu: Prüfung der Form)
- `src/ablage.rs`: `Ordner::board`, `Ordner::boards`, `Ordner::schreib`
- `src/dienst/mod.rs`: `aktion()`
- `src/dienst/verlauf.rs:42`
- mittelbar alle Lese- und Schreibwege mit Board-Namen, ohne Änderung an ihnen

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0008 (Option B + D, verbindlich):

1. **Form**: reine Funktion `board::slug_gueltig(&str) -> bool` ⇔ 1–40 Zeichen, jedes aus `[a-z0-9-]` — genau das Bild von `modell::slug`.
2. **Eingangstür**: `Ordner::board(slug)` prüft zuerst, vor jedem Dateizugriff. Ungültige Form ⇒ `Fehler::Ungueltig` (400) auf allen Wegen, lesend wie schreibend. Gültige Form, Datei fehlt ⇒ `Fehler::NichtGefunden` (404) wie bisher. Kein Normalisieren; das bestehende `trim` in `erledigen.rs:55` bleibt.
3. **Liste**: `Ordner::boards` führt einen Dateistamm außerhalb der Form unter `defekte` mit dem Text „Dateiname ist kein gültiger Board-Name — umbenennen“; nichts wird umbenannt.
4. **Zweite Linie**: `aktion()` prüft alle Pfade der Aktion vor dem ersten Schreiben — relativ, nur normale Bestandteile (kein `..`, keine Wurzel, kein NUL), kein Pfad doppelt — sonst `Fehler::Intern` (500) ohne Schreiben; `Ordner::schreib` prüft den Einschluss ebenfalls (schützt die Anhänge außerhalb von `aktion()`). Ein Treffer ist ein Programmierfehler, nie eine Benutzereingabe.
5. `verlauf.rs:42` bildet den Pfad aus `aktuell.slug`, damit `board_pfad` nur Werte aus `Ordner::board` sieht.

### Alternative Ansätze

- **Typ `BoardSlug`** (ADR-0008 Option A): verworfen für diese Vorrang-Karte — `Board.slug` ist `String` in Modell, Format, Antworten und rund 20 Aufrufern; bleibt der nächste Schritt, falls `board_pfad` doch mit ungeprüftem Wert gerufen wird.
- **Nur Pfadeinschluss in der Ablage** (Option C): verworfen — `../aufgaben/0012-x` bleibt unter der Wurzel und zerstört trotzdem eine Aufgabe; Antwort wäre 500 statt 400.
- **Prüfung je Endpunkt**: verworfen — rund 20 Stellen, jede neue vergisst sie; die Eingangstür `Ordner::board` deckt alle.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest `tests/akzeptanz_r00104.rs` gegen einen echten Arbeitsordner mit Git (Muster `tests/akzeptanz_r00099.rs`): die Matrix der Akzeptanzkriterien (Werte × drei Wege), je Fall vorher/nachher `git rev-list --count HEAD`, `git status --porcelain`, Bytes der fremden Datei und Frontmatter von `aufgaben/0012-x.md`. Ohne Fix rot (heute 500/200/200 statt 400), mit Fix grün. Dazu Unit-Tests `board::slug_gueltig` (Grenzwerte, Zeichenklassen, jedes nichtleere `modell::slug(x)` ist gültig).

### Code-Extraktion für isoliertes Testing

Die Formprüfung ist eine reine Funktion im Modell (`board::slug_gueltig`), die Pfadprüfung der zweiten Linie ebenfalls (Pfadliste → in Ordnung oder Grund), damit beide ohne Ordner testbar sind; `aktion()` und `Ordner::schreib` rufen sie nur.

### Regressionstests

- Integration: Kontrollpaar `fabrik` auf allen drei Wegen (200 bzw. 201, Commit wie bisher); bestehende Suiten `tests/akzeptanz_r00099.rs`, `tests/aufgabe_anlegen.rs`, Board-, Verlaufs- und Zug-Tests grün.
- Unit: zweite Linie in `aktion()` und `Ordner::schreib` (Einschluss, Doppelte, kein Schreiben vor dem Abbruch).
- E2E: unverändert; die Oberfläche erzeugt nur gültige Namen.

## Akzeptanzkriterien

Gegeben jeder Prüfung: Arbeitsordner `w` mit Git, sauber (`git status --porcelain` leer); Board `fabrik` (`boards/fabrik.md`) mit Spalten „In Arbeit“ und „Fertig“; Aufgabe #12 `aufgaben/0012-x.md` (id 12, title „x“, key `k12`) in „In Arbeit“; fremde Datei `b.md` im Nachbarordner `fremd/boards/` neben `w` (außerhalb des Repositorys). Handelnde: Agent `bot`. „Nichts geändert“ heißt: kein neuer Commit, `git status --porcelain` leer, fremde Datei byte-gleich, `aufgaben/0012-x.md` behält id 12, title „x“, key `k12`.

Fehlfälle F = `../../fremd/boards/b`, `../aufgaben/0012-x`, `..`, `.`, `a/b`, `./fabrik`, `fabrik\0` (NUL am Ende), 41 × `a`, `Fabrik`; Leerfall `""`.

### Bug behoben (Pflicht)
- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün

### Erledigen
- [ ] Gegeben #12 in „In Arbeit“, wenn `bot` `POST /api/aufgaben/erledigen {key: "k12", board: "../aufgaben/0012-x", text: "behoben", signal: "behoben"}` schickt, dann antwortet kanbanD 400 und nichts ist geändert — ebenso für jeden Wert aus F und für `""`
- [ ] Gegeben dasselbe, wenn `board` 40 × `a` ist (gültige Form, kein solches Board), dann 404 und nichts ist geändert
- [ ] Kontrollpaar: Gegeben dasselbe, wenn `board: "fabrik"`, dann 200 mit ergebnis „erledigt“, #12 in „Fertig“, genau ein neuer Commit; mit `board: " fabrik "` ebenso (das bestehende Trimmen bleibt)

### Anlegen
- [ ] Gegeben derselbe Ordner, wenn `bot` `POST /api/aufgaben {titel: "neu", board: "../../fremd/boards/b"}` schickt, dann 400, keine Datei `aufgaben/0013-*.md`, nichts ist geändert — ebenso für jeden Wert aus F, für `""` und für `" fabrik"`
- [ ] Gegeben dasselbe mit `board` 40 × `a`, dann 404, keine neue Aufgabendatei, nichts geändert
- [ ] Kontrollpaar: mit `board: "fabrik"` → 201, #13 „neu“ unten in „In Arbeit“, genau ein neuer Commit

### Lesen
- [ ] Gegeben derselbe Ordner, wenn `GET /api/boards/..%2F..%2Ffremd%2Fboards%2Fb` gerufen wird, dann 400 und die Antwort enthält nichts aus der fremden Datei — ebenso für `..%2Faufgaben%2F0012-x`, `%2E%2E`, `%2E`, `a%2Fb`, `.%2Ffabrik`, `fabrik%00`, 41 × `a`, `Fabrik`
- [ ] Gegeben dasselbe, wenn `GET /api/aufgaben?board=<Wert>` mit denselben kodierten Werten gerufen wird, dann 400 (bisher 404 bzw. 200)
- [ ] Gegeben 40 × `a`, dann `GET /api/boards/aaaa…a` → 404 und `?board=aaaa…a` → 404
- [ ] Kontrollpaar: `GET /api/boards/fabrik` → 200 mit Titel und Spalten von `fabrik`; `?board=fabrik` → 200 mit #12; nach allen Lesefällen kein neuer Commit, `git status --porcelain` leer

### Handbenannte Board-Datei
- [ ] Gegeben zusätzlich `boards/Alt_Board.md` mit gültigem Board-Inhalt (von Hand angelegt), wenn `GET /api/zustand` gerufen wird, dann steht `boards/Alt_Board.md` unter `defekte` mit „Dateiname ist kein gültiger Board-Name — umbenennen“ und nicht unter den Boards; `GET /api/boards` listet nur `fabrik`; die Datei liegt danach unverändert unter demselben Namen, kein neuer Commit
- [ ] Gegeben dasselbe, wenn `GET /api/boards/Alt_Board` gerufen wird, dann 400

### Zweite Linie (Unit-Ebene)
- [ ] Gegeben ein Ordner mit `aufgaben/0001-a.md`, wenn `aktion()` die Pfade `["aufgaben/0001-a.md", "../x.md"]` schreiben soll, dann `Fehler::Intern` (500), `aufgaben/0001-a.md` byte-gleich, keine Datei `../x.md`, kein Commit — ebenso für einen absoluten Pfad, einen Pfad mit NUL und für `["aufgaben/0001-a.md", "aufgaben/0001-a.md"]` (doppelt)
- [ ] Gegeben derselbe Ordner, wenn `Ordner::schreib("../x.md", …)` gerufen wird, dann ein Fehler und keine Datei `../x.md`; `Ordner::schreib("anhaenge/1/bild.png", …)` schreibt wie bisher
- [ ] `board::slug_gueltig`: `fabrik`, `a`, 40 × `a`, `kanban-d-2` gültig; `""`, 41 × `a`, `Fabrik`, `a_b`, `a b`, `a/b`, `.`, `..`, `fabrik\0`, `ä` ungültig; für jeden Titel x mit nichtleerem `modell::slug(x)` ist `slug_gueltig(slug(x))` wahr (geprüft über eine Liste von Titeln mit Umlauten, Sonderzeichen und 60 Zeichen)

## Implementierungshinweise

- Test zuerst je Bubble (WBS I0091): B0339 Matrix rot → B0340 Form und Eingangstür → grün; B0341 Liste, B0342 zweite Linie, B0343 Verlauf.
- Prüfung in `Ordner::board` **vor** `board_pfad`/`lies`; die Fehlermeldung nennt den Namen nicht roh, wenn er Steuerzeichen enthält (NUL) — sonst nur „Board-Name ungültig: 1–40 Zeichen aus a–z, 0–9, -“.
- Die Pfadprüfung der zweiten Linie arbeitet auf `std::path::Path::components()` (nur `Component::Normal`) plus NUL-Prüfung; „doppelt“ vergleicht die Pfadtexte der Aktion.
- Schreibwege nach X00001 (Spalte Pfadregel, ergänzt mit ADR-0008).
- Keine Änderung an den Aufrufern von `board_pfad` außer `verlauf.rs:42`.

## Offene Fragen

- keine — Richtung durch ADR-0008 entschieden; die Grenze 400 für `?board=` mit ungültiger Form (bisher 404) ist dort als Konsequenz genannt.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass ein Wert aus der Anfrage ohne Prüfung Teil eines Dateipfads wird und `..` den Board-Ordner verlässt. Wenn `Ordner::board` den Namen gegen genau die Form prüft, die kanbanD selbst erzeugt, dann erreicht kein `..`, `/` oder NUL mehr `board_pfad` und das Dateisystem — und weil jeder Lese- und Schreibweg über diese eine Tür geht, sind alle rund 20 Wege auf einmal geschlossen, ohne sie einzeln anzufassen. Der Hebel sitzt an der Eingangstür statt an der Platte, weil ein reiner Pfadeinschluss `../aufgaben/0012-x` durchließe (unter der Wurzel, trotzdem zerstörerisch) und mit 500 statt 400 antworten würde. Die zweite Linie in `aktion()` und `Ordner::schreib` fängt einen künftigen Aufrufer ab, der die Tür umgeht, bevor ein Byte geschrieben ist. So bleibt Git das vollständige Gedächtnis des Boards: nichts außerhalb wird geändert, keine Aufgabe still überschrieben.

## Notizen

- Priorität: Kritisch (Vorrang-Karte #48; Schreiben außerhalb des Arbeitsordners, Zerstörung einer Aufgabe mit Commit)
- Betroffene Nutzer/Systeme: jeder API-Client, besonders Agenten mit fehlerhaftem oder böswilligem Board-Namen; Menschen nicht über die Oberfläche (sie erzeugt nur gültige Namen)
- Workaround: keiner; Bestand am 2026-11-06 hat nur gültige Board-Dateien (7 in 5 Ordnern, ADR-0008), Umbenennen entfällt
- Abnahme-Probe der Karte #48 (Security-Review) ist wörtlich in den Kriterien „Erledigen“, „Anlegen“, „Lesen“ enthalten; ergänzt um Grenzwert 40/41, `Fabrik`, Trimmen beim Erledigen und `?board=`
- Entscheidung: ADR-0008, Aspekt X00001
