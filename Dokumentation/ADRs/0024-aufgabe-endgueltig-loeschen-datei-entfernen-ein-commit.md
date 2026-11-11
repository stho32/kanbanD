# ADR-0024: Aufgabe endgültig löschen — Datei und Board-Zeilen entfernen, ein Commit; Git bleibt das Gedächtnis

**Status**: Vorgeschlagen
**Datum**: 2026-11-11
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #36)
**Kontext-Anforderung**: Karte #36 „Aufgabe endgültig löschen“ (Vorprüfung architekt 2026-11-11, Kartenkommentar #36); Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: — (getragen von der bestehenden Systemantwort: Archivieren/Zurückholen unter `gesperrt()` → `archivieren_pruefen` → `aufgabe_schreiben` (`src/dienst/archiv.rs:9–37`); Anhänge werden entfernt und über `committen()` committet (`src/dienst/anhaenge.rs:78–89`); `git::committen` staged auch gelöschte Pfade (`src/git.rs:31–56`); `Board::abnehmen` nimmt eine Zeile heraus (`src/modell/board.rs:370–376`); ADR-0021 „Git ist das Gedächtnis“)
**Nachträge**: keine

## Kontext

- **Karte #36** verlangt, eine Aufgabe **endgültig** zu löschen — nicht nur zu archivieren. Herkunft: Beratung des product-owners vom 2026-11-03 („übliche Kanban-Funktionen, die fehlen“). Beleg: heute gibt es nur Archivieren (R00017); `PATCH /api/aufgaben/{nr}` kennt kein Löschen. Referenz: Trello, Kanboard. Priorität PO: niedrig.
- **Drei verschiedene Dinge, die leicht verwechselt werden:**
  - **archivieren** (R00017, `src/dienst/archiv.rs`): schreibt `archived: <Datum>` in die Aufgabe und stoppt laufende Timer; **Datei bleibt liegen, Board-Zeile bleibt**. Umkehrbar über `zurueckholen`.
  - **von Board nehmen** (`zuordnung.rs::von_board_nehmen`): entfernt nur die Zeile aus **einer** Board-Datei; die Aufgabe bleibt bestehen und darf auf anderen Boards liegen. Umkehrbar über `auf_board_legen`.
  - **endgültig löschen** (diese ADR): die Aufgabendatei verschwindet aus dem Arbeitsbaum, ihre Zeile aus **allen** Board-Dateien, ihr Anhangsordner; nur die **Git-Historie** behält sie.
- **Vision** `Anforderungen/R00000-vision.md`:
  - Z. 51–53: „**Aufgaben sind unabhängige Daten.** Eine Aufgabe ist eine Markdown-Datei mit Frontmatter im Aufgabenverzeichnis, bei Bedarf mit einem eigenen Ordner für Anhänge. Sie weiß nicht, auf welchem Board und in welcher Spalte sie liegt.“
  - Z. 55–59: „**Das Board besitzt seine Struktur.** … verweist auf Aufgaben … Eine Aufgabe zu bewegen ändert nur die Board-Datei …“
  - Z. 61–66: „**Git ist das Gedächtnis.** Jede Aktion in kanbanD ergibt einen eigenen Commit. Die Git-Geschichte ist damit das vollständige Archiv … wann eine Aufgabe angelegt, geändert und wohin sie bewegt wurde, steht in den Commits.“
  - Leitplanken: „**Die Dateien sind der einzige Speicher**“ (Z. 150–153), „**Ein Commit je Aktion**“ (Z. 159–160), „**Git-freundliche Form**“ (Z. 154–158).
- **Belegt (Code), die Bausteine gibt es schon:**
  - Die Aufgabendatei liegt unter `aufgaben/<nr>-<slug>.md`, der Anhangsordner unter `aufgaben/<nr>-<slug>/` (`src/modell/aufgabe.rs:428–431` `anhangordner()` = Dateiname ohne `.md`).
  - `Ordner::aufgabenpfad(nr)` liefert den Pfad **auch für eine defekte Datei** (`src/ablage.rs:97–108`) — zum Entfernen braucht es den Inhalt nicht.
  - `anhaenge.rs::anhang_entfernen` (`:78–89`) zeigt das Muster: Datei entfernen, leeren Ordner aufräumen, `committen()` — eine Abweichung von `aktion()`, in X00001 als solche geführt.
  - `git::committen` committet genau die genannten Pfade, auch **gelöschte** (`add -A --`, `src/git.rs:37`; `relevante_pfade` lässt Pfade durch, die Git kennt, `:51–57`).
  - `Board::abnehmen(nr)` (`src/modell/board.rs:370–376`) entfernt die Nummer aus allen Spalten eines Boards; `board_text(&b, None)` rendert die Board-Datei danach neu.
  - Die Entnahme-Sperre (R00097) gibt es als board-übergreifende Prüfung schon: `archivieren_pruefen` (`src/dienst/zugregeln.rs:71–81`) liefert einem Agenten **403** (`entnahme_erlaubt`), sobald die Karte auf **irgendeinem** Board in einer Menschen-Spalte liegt, und **423**, sobald eine Board-Datei unlesbar ist (R00120, PO Z. 188).
  - `git::staende` überspringt Commits, in denen die Datei **gelöscht** ist (`src/git.rs:59–60`); das ist dieselbe Randfrage, die ADR-0021 offen führt.
- **Die Gabelung** hat zwei Achsen: **(a)** was „endgültig“ heißt — echte Dateientfernung gegenüber einem Marker, und **(b)** der **Löschweg** — `aktion()` erweitern oder eine eigene, dokumentierte Abweichung.

## Optionen

### Option A: Echte Dateientfernung, Weg über `aktion()` erweitert, alles in einem Commit (gewählt)

Die Aufgabendatei, ihre Board-Zeilen und ihr Anhangsordner verschwinden in **einem** `aktion()`-Aufruf. `aktion()` nimmt statt nur `(pfad, text)`-Paaren eine kleine Folge von Schritten **Schreiben** oder **Entfernen**; `pfade_pruefen` läuft über **alle** Pfade beider Arten, bevor etwas geschrieben oder entfernt ist.

- Stärke: „endgültig“ ist echt — die Datei ist weg, die Nummer frei, die Board-Datei wieder klein. **Ein** Weg, **eine** Sperre, **ein** Commit (ADR-0005); das X00001-Makro bleibt einheitlich und der Wächter `tests/aufruf_vergessen.rs` sieht den neuen Board-Datei-Schreiber. Die zweite Linie gegen Pfade außerhalb des Ordners (ADR-0008) und die Git-Freundlichkeit der Board-Datei bleiben unangetastet.
- Nachteil: die Signatur von `aktion()` ändert sich — jede Aufrufstelle fasst an (mechanisches Refactoring, eigener Commit vor dem Feature). Löschen ist destruktiv: wiederherstellbar nur über die Git-Historie.

### Option B: Echte Dateientfernung, Weg als neue Abweichung nach Muster `anhaenge.rs`

`Kanban::endgueltig_loeschen` entfernt Datei und Anhangsordner direkt über `std::fs`, rendert die Board-Dateien selbst und committet über `committen()`; in X00001 als zweite Abweichung neben `anhaenge.rs` geführt.

- Stärke: `aktion()` bleibt unverändert, kein Refactoring in einem Zug; das Muster ist an den Anhängen erprobt.
- Nachteil: **zwei Wege zum Schreiben von Board-Dateien** (der reguläre über `aktion()`, der neue daneben). Der Wächter zählt Board-Datei-Schreiber über `board_pfad(`, nicht über `aktion()` — eine Prüfung, die an `aktion()` hängt (ADR-0002/ADR-0008 zweite Linie), greift hier nur, wenn sie von Hand nachgebaut wird. Genau das ist die Schwäche, die X00001 als Ausnahme festhalten müsste.

### Option C: Weiches Löschen — Marker in der Datei (`deleted: true`), Datei bleibt liegen

Wie `archived`: ein Feld in der Aufgabe, die Anzeige blendet die Karte aus.

- Stärke: vollständig Git-verträglich, ohne Dateiverlust umkehrbar; `git::staende` und der Verlauf der Karte bleiben ganz.
- Nachteil: **nicht „endgültig“.** Es ist ein zweites `archived` neben `archived` (R00017) — dieselbe Anzeige-Fiktion, nur mit anderem Namen; die Nummer bleibt belegt, der Anhangsordner bleibt liegen. Trello und Kanboard, die die Karte als Referenz nennt, löschen wirklich.

### Option D: Datei in einen Papierkorb-Ordner verschieben (`aufgaben/.papierkorb/`)

- Stärke: ohne Git wiederherstellbar; der Arbeitsbaum ist sofort frei.
- Nachteil: ein **neuer Zustandsort** neben `aufgaben/` und `boards/`, den `markdown_dateien`/`aufgaben()`/`naechste_nummer` alle überspringen müssten — eine zweite Datenhaltung genau dort, wo die Leitplanke „Die Dateien sind der einzige Speicher“ (Z. 150–153) und die klare Ordnerform (Z. 135–139) sie vermeiden. Git sieht den Vorgang als Umbenennung, nicht als Löschung.

## Entscheidung

**Gewählt: Option A** — echte Dateientfernung, der Löschweg über ein um Löschpfade erweitertes `aktion()`, die Querwirkung (Board-Zeilen, Anhänge, Timer, Reservierung) im **selben** Commit.

Begründung: „endgültig“ soll heißen, was es sagt — die Aufgabe ist aus dem Arbeitsbaum **und** aus jeder Board-Datei verschwunden, und nur die Git-Historie behält sie. Das ist genau die Linie der Vision „Git ist das Gedächtnis“ (Z. 61–66): die Löschung ist selbst eine Aktion mit eigenem Commit, `git log`/`git show` finden die Datei wieder. Option C bricht den Auftrag („endgültig“) und verdoppelt `archived`; Option D schafft einen zweiten Speicherort, den die Leitplanke ausschließt. Unter den echten Löschwegen gewinnt A, weil es **einen** Schreibweg hält: `aktion()` bleibt der einzige Ort, an dem geschrieben und committet wird (ADR-0005: eine öffentliche Methode = eine Sperre = ein `aktion()`), die zweite Linie der Pfadprüfung (ADR-0008) greift ohne Nachbau, und der Wächter `tests/aufruf_vergessen.rs` erkennt den neuen Board-Datei-Schreiber statt ihn zu übersehen.

**Akzeptierte Schwäche.** Ich nehme bewusst in Kauf:

- **Destruktiv.** Wiederherstellen geht nur über die Git-Historie (`git checkout <commit> -- aufgaben/…`); wer die Historie umschreibt oder `git gc --prune=now` erzwingt, verliert die Karte wirklich. Das ist die Bedeutung von „endgültig“ und deckt sich mit dem Auftrag.
- **Der Verlauf endet beim Löschen.** `git::staende` überspringt Lösch-Commits (`src/git.rs:59–60`); der Karten-Verlauf (ADR-0021) zeigt die Karte bis zur Löschung, danach nicht mehr.
- **Rückwirkende Berichte ändern sich.** Liegt die Karte auf einem Board, verschwindet ihre Zeile; Auswertungen, die den aktuellen Stand lesen, zählen sie ab der Löschung nicht mehr. Die Bewegungshistorie davor bleibt in Git erhalten.
- **Signaturänderung von `aktion()`.** Das mechanische Refactoring (Schreiben/Entfernen) ist ein eigener Commit **vor** dem Feature; die bestehenden Tests der umgebauten Wege müssen grün bleiben.

## Konsequenzen

**Positiv:**

- **„Endgültig“ ist echt und vollständig.** Datei, Board-Zeilen und Anhänge gehen in einem Zug; die Nummer und der Slug werden frei.
- **Ein Weg, ein Commit, eine Sperre** (ADR-0005). X00001 bleibt Makro: der Löschweg läuft über dasselbe `aktion()` wie alle anderen; die Pfadprüfung vor dem ersten Schreiben/Entfernen und die Wächter-Probe greifen.
- **Git bleibt das Gedächtnis.** Die Löschung ist ein Commit; die Karte ist aus der Historie rekonstruierbar (ADR-0021).
- **Anschluss an Bestehendes.** Entnahme-Sperre (`entnahme_erlaubt`/`archivieren_pruefen`), `Board::abnehmen`, Anhang-Entfernung (`anhaenge.rs`), `git::committen` mit Löschpfaden — nichts davon ist neu.

**Negativ / In Kauf zu nehmen:**

- Siehe akzeptierte Schwäche (destruktiv; Verlauf endet; rückwirkende Berichte; Signaturänderung).

**Ausprägung des Schreibwegs (Soll):**

- Neuer Endpunkt **`DELETE /api/aufgaben/{nr}`** (Thema „Aufgaben“, braucht `X-KanbanD-Wer`), in der Liste `src/web/endpunkte.rs` und damit in `/api` und `/api/endpunkte`. Antwort **200 `{nummer}`**; **404** unbekannt; **403** Agent, dessen Karte auf einem Board in einer Menschen-Spalte liegt (`{fehler, spalte, nummer}`, ADR-0003); **423** bei defekter Board-Datei des Ordners; nichts wird geschrieben.
- **Dienstmethode** `Kanban::endgueltig_loeschen(wer, nr)` in `src/dienst/archiv.rs` (die dritte Bewegung der Archiv-Familie: archivieren / zurückholen / endgültig löschen) unter `let _sperre = self.gesperrt();`:
  1. **Prüfung** vor jedem Schreiben: `archivieren_pruefen`-analog über **alle** Boards — ein Agent wird **403**, sobald die Karte irgendwo in einer Menschen-Spalte liegt; eine unlesbare Board-Datei des Ordners ist **423** (R00120, PO Z. 188). Mensch: frei. Prüfung über `entnahme_erlaubt` je Board in der Reihenfolge der Boardliste (erste Sperre nennt die Abweisung).
  2. Für jedes Board mit der Karte: `Board::abnehmen(nr)`, dann `board_text(&b, None)` — die Zeile ist weg, das Board wird neu gerendert (kleiner Diff, Z. 154–158).
  3. **Ein** `aktion()`-Aufruf mit den Schritten: Aufgabendatei **entfernen**; jede geänderte Board-Datei **schreiben**; jede Datei des Anhangsordners `aufgaben/<nr>-<slug>/` **entfernen** und den leeren Ordner aufräumen. `aktion()` prüft alle Pfade (Schreiben **und** Entfernen) vor dem ersten Schritt (ADR-0008) und committet genau einmal.
  4. Die in Speicher gehaltenen Start-Zeitpunkte (`timer_beginn`) der Nummer werden verworfen; laufende Timer enden mit der Datei, eine Reservierung verschwindet mit ihr (das Frontmatter `reservation:` ist Teil der gelöschten Datei).
  - **Defekte Aufgabendatei:** der Löschweg nutzt `aufgabenpfad(nr)` (den Pfad), nicht das geparste Modell; eine defekte Datei lässt sich damit entfernen (die Prüfung liest nur die Boards). Das ist erwünscht — „kaputte Datei weg“ — und steht als offene Frage zur Bestätigung.
- **Commit-Nachricht:** `#<nr> gelöscht` (bei Anhängen `, k Anhänge`, bei mehreren Boards ` (m Boards)`), Muster `#<nr> archiviert`.
- **Geltung:** Die Regel „endgültig löschen entfernt Datei, Board-Zeilen und Anhänge in einem Commit“ gilt für das Löschen **einer Aufgabe**. „archivieren“ (R00017) und „von Board nehmen“ bleiben unberührt.

**Durchsetzung / Proben:**

- **Endpunkt-/Atomaritäts-Probe** (Integration): eine Karte #1 auf **zwei** von drei Boards, mit einem Anhang, einem laufenden Timer und einer Reservierung. `DELETE /api/aufgaben/1` → Aufgabendatei weg vom Datenträger, **beide** Board-Dateien ohne die Zeile, Anhangsordner weg, das dritte Board unverändert — alles in **genau einem** Commit (`git rev-list --count` +1); `git show` zeigt die Löschung; `git log -- aufgaben/0001-…md` findet die Historie weiter; `git status --short` sauber.
- **403-Probe (R00097-analog):** dieselbe Karte in einer Menschen-Spalte → Agent `DELETE` liefert **403** `{fehler, spalte, nummer}`, **nichts** geändert, kein Commit; ein Mensch wird durchgelassen.
- **423-Probe:** eine defekte Board-Datei im Ordner → Agent **423**, nichts geändert (R00120 Punkt 2).
- **Zweite-Linie-Probe (ADR-0008):** das erweiterte `aktion()` bricht bei doppeltem oder aus dem Ordner führendem Pfad **vor** dem ersten Schreiben/Entfernen ab (`Fehler::Intern`), nichts geschrieben, nichts entfernt — Erweiterung des bestehenden Tests `aktion_bricht_vor_dem_ersten_schreiben_ab` (`src/dienst/mod.rs:211`).
- **Wächter-Probe:** der neue Board-Datei-Schreiber steht in `SCHREIBER` (`tests/aufruf_vergessen.rs:21`) und in X00001; ein nicht eingetragener Schreiber macht `board_datei_schreiber_liste_ist_vollstaendig` rot.
- **Review-Punkte** (`architektur-reviewer`, `code-reviewer`): ein zweiter Löschweg, der `aktion()` umgeht, ohne in X00001 als Abweichung zu stehen, ist ein **Befund** (Option B nur mit Eintrag). Ein Löschweg, der eine Board-Zeile oder einen Anhang stehen lässt, ist ein **Befund**. Ein Löschweg ohne die Entnahme-Sperre (403) ist ein **Befund**. Eine gelöschte Datei als „eigene“ Änderung zu committen, ohne die Board-Dateien mitzunehmen, ist ein **Befund** (ein Commit je Aktion, Z. 159–160).

**Folgeentscheidungen / Aufgaben:**

- [ ] Anforderung aus Karte #36 nach dieser ADR (Vorschlag im Bericht an den Director) — Endpunkt, Dienstmethode, Oberfläche (Kontextmenü/Aufgabenfenster mit Rückfrage „endgültig löschen“), ux-Vorprüfung/Artboard.
- [ ] WBS: neue Interaction unter D0003 (über den planer).
- [ ] X00001 nachziehen: neuer Board-Datei-Schreiber (Löschweg) samt Wächterliste; `aktion()` um Entfernen-Schritte erweitern.
- [ ] A00005 Format (Datei wird entfernt — **keine** Formatänderung, aber die Board-Datei verliert eine Zeile) und A00007 Git (Lösch-Commits, `git::staende` überspringt sie) prüfen und fortschreiben.

## Offene Fragen

- **Verlauf der gelöschten Karte:** `git::staende` überspringt Lösch-Commits (ADR-0021, dort offene Frage). Soll der Karten-Verlauf eine gelöschte Karte noch zeigen (aus der Historie rekonstruiert), oder endet er beim Löschen?
- **Rückwirkende Berichte:** Soll eine gelöschte Karte aus Burndown/Durchsatz/Wie-lange-noch ganz verschwinden, oder sie bis zum Löschtag weiterzählen (die Bewegungshistorie in Git gibt es)?
- **Nummer/Slug-Wiederverwendung:** `naechste_nummer` rechnet aus den vorhandenen Dateinamen (`src/ablage.rs:118–122`); wird die höchste Nummer gelöscht, bekäme die nächste Aufgabe dieselbe. Sollen gelöschte Nummern nie wiederverwendet werden?
- **Schlüssel (`key`):** nach dem Löschen ist der Fremdschlüssel frei; ein späteres `POST /api/aufgaben` mit demselben `key` legt dann eine **neue** Karte an, statt wiederzuöffnen. So gewollt?
- **Sammel-Löschen** (`POST /api/aufgaben/loeschen {nummern}`) und die **Oberfläche** (Ort der Rückfrage, „endgültig“ bestätigen, Undo nur über Git): eigene Planung.
- **Voll-Trust und Destruktion:** darf ein Agent eine Aufgabe endgültig löschen (mit der 403-Regel), oder bleibt das dem Menschen vorbehalten? Die Vision ist Full-Trust, aber die Wirkung ist irreversibel — Betreiber-Frage.

## Quellen / Bezüge

- Karte #36 „Aufgabe endgültig löschen“ (Vorprüfung architekt 2026-11-11); Herkunft Beratung product-owner 2026-11-03
- Vision `Anforderungen/R00000-vision.md`: Z. 51–53, 55–59, 61–66, 150–160
- `Anforderungen/R00017-archivieren-und-zurueckholen.md` (archivieren/zurückholen, umkehrbar)
- [ADR-0005](0005-zusammengesetzte-aktionen-in-einem-commit.md) (eine Methode = eine Sperre = ein `aktion()`), [ADR-0008](0008-board-slug-geprueft-vor-jedem-dateizugriff.md) (Pfadprüfung, zweite Linie), [ADR-0003](0003-abweisungen-mit-strukturiertem-rumpf.md) (403-Rumpf), [ADR-0021](0021-karten-verlauf-aus-der-git-geschichte.md) (Git ist das Gedächtnis; `git::staende` überspringt Lösch-Commits)
- Aspekt [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md) (Schreibweg, Abweichungen, Wächter), Bausteine [A00004 Dienste](../Architektur/A00004-dienste.md), [A00005 Format](../Architektur/A00005-format.md), [A00007 Git](../Architektur/A00007-git.md)
- `src/dienst/archiv.rs:9–37`, `src/dienst/anhaenge.rs:78–89`, `src/dienst/zugregeln.rs:33–81` (`entnahme_pruefen`, `archivieren_pruefen`), `src/dienst/mod.rs:163–173` (`aktion`), `src/dienst/zuordnung.rs:56–65` (`von_board_nehmen`), `src/ablage.rs:97–122,164–191`, `src/git.rs:31–60`, `src/modell/board.rs:370–376` (`abnehmen`), `src/modell/aufgabe.rs:428–431` (`anhangordner`), `tests/aufruf_vergessen.rs`
