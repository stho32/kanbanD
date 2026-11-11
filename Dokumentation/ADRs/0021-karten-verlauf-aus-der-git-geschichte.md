# ADR-0021: Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern

**Status**: Akzeptiert
**Datum**: 2026-11-11
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #119)
**Kontext-Anforderung**: Karte #119 „Log aller Erstellungen/Bewegungen/Archivierungen je Karte als Reiter in den Aufgaben-Details“; #33 geht darin auf. Anforderung und WBS-Knoten folgen über den planner.
**Erprobt durch**: — (getragen von der bestehenden Systemantwort: `verlauf::bewegungen` rechnet die Spaltenwechsel aus den committeten Ständen der Board-Datei, R00042; `git::staende` liest die committete Historie einer Datei; die Anzeige führt Reiter wie „Kosten“/„Datei“ und Tabellen wie „Durchläufe“)
**Nachträge**: keine

## Kontext

- **Karte #119** verlangt, dass der Weg jeder Karte über das Board nachvollziehbar wird: wer wann welche Karte von X nach Y verschoben hat, wann eine Aufgabe angelegt und wann sie „Erledigt“ erreicht hat (Board-Kommentar `0119-…md:7`). Das soll als **eigener Reiter „Verlauf“ in den Aufgaben-Details** erscheinen.
- **Vorprüfung (Kartenkommentar #119, 2026-11-11)**: Die Technikfrage lautet **ja** — ein kartenbezogener Verlauf braucht einen **kartenbezogenen Lese-Endpunkt** (`GET /api/aufgaben/{nr}/verlauf`) aus der Git-Geschichte; „wer“ ist der **Commit-Autor** (heute nicht gelesen). Die Datums-Trenner der Spalten (Absatz 2 der Karte) gehören als eigenes Thema unter D0002.
- **Vision** `Anforderungen/R00000-vision.md`:
  - Z. 61–66: „**Git ist das Gedächtnis.** … Die Git-Geschichte ist damit das vollständige Archiv, auch der Zeiten: wann eine Aufgabe angelegt, geändert und wohin sie bewegt wurde, steht in den Commits.“
  - Z. 68–72: „**An jeder Änderung ist ablesbar, wer gehandelt hat:** kanbanD committet unter dem Namen der handelnden Person.“
  - Z. 100–102: „**Auswertungen aus der Geschichte.** … werden aus den Dateien und ihrer Git-Geschichte gerechnet.“
  - Leitplanke Z. 150–153: „**Die Dateien sind der einzige Speicher.** … ohne Datenbank daneben.“ Ein Index/Cache „darf existieren, muss sich aber jederzeit aus den Dateien neu aufbauen lassen und wird nicht versioniert.“
  - Leitplanke Z. 159–160: „**Ein Commit je Aktion.**“; Z. 145: „Der Git-Autor eines Commits ist die handelnde Person.“
- **Belegt (Code), die Rechnung existiert schon für Berichte**:
  - `src/git.rs:61` `staende(wurzel, rel)` liefert je Datei die committeten Stände als `Vec<(NaiveDateTime, String)>` — geholt über `git log --reverse --format=%H %at` (`:67`). **Der Autor wird heute nicht gelesen.**
  - `src/dienst/verlauf.rs:40` `staende(slug)` stellt die Board-Historie zusammen und hängt den noch nicht committeten aktuellen Stand als Stand „jetzt“ an (`:47–49`).
  - `src/verlauf.rs:68` `bewegungen(staende, spalten, jetzt)` rechnet daraus je Aufgabe die Folge der Spaltenwechsel (`Wechsel { zeitpunkt, spalte }`, `:33–36`); der Endpunkt dazu ist `GET /api/berichte/bewegungen`, R00042.
  - `src/modell/aufgabe.rs:374` trägt `archiviert: Option<String>`; `src/dienst/archiv.rs:21` setzt es beim Archivieren, `:90` nimmt es beim Zurückholen zurück — Erstellung und `archived` stehen also in der **Aufgabendatei**-Historie.
- **Belegt (Code), die Anzeige hat das Muster**: `web/ansicht.js:222` `REITER = [['inhalt','Inhalt'],['datei','Datei'],['kosten','Kosten']]` mit Reiterleiste `vReiterleiste` (`:226`) und Tab-Panels (`:278–279`); `vKostenPanel` (`:232`) und `vDurchlaeufe` (`:302`) sind die Vorbilder für einen lesenden Tabellen-Reiter.
- **Die Gabelung**: Karten-Verlauf entweder **aus der GitHub-Geschichte rechnen** (wie R00042) **oder** als **Datenblock in der Karte führen** (wie `kanbanD-runs`, R00094: Zeitpunkt, Phase, Ergebnis, Wer, Dauer, Text in der Aufgabendatei).

## Optionen

### Option A: aus der Git-Geschichte rechnen (gewählt)

Je Aufgabe führt der neue Lese-Endpunkt die Historie der **Board-Datei** (Bewegungen, aus `verlauf::bewegungen`) und der **Aufgabendatei** (Erstellung = erster Commit mit der Datei, `archived` = Commit, der `archived` gesetzt hat) zeitlich zusammen; „wer“ ist der Commit-Autor.

- Stärke: **keine zweite Datenhaltung**. Git ist ohnehin das Gedächtnis (Vision Z. 61–66); der Verlauf gilt **rückwirkend** für die ganze Vergangenheit, für Änderungen von außen (Editor, Agent, `git pull`) und übersteht Merge und Rebase, ohne dass kanbanD etwas mitschreibt.
- Nachteil: **Rechnen je Öffnen** statt Lesen eines Feldes. Reorder innerhalb einer Spalte bleibt **unsichtbar** (ein Wechsel ohne Spaltenwechsel ist kein Spaltenwechsel). Und der Verlauf zeigt die **Git-Identität** des Autors, nicht ein kanbanD-Personenkürzel.

### Option B: Datenblock in der Karte (wie `kanbanD-runs`, R00094)

Beim Anlegen, Bewegen, Archivieren hängt kanbanD je einen Eintrag an einen neuen Block der Aufgabendatei (Art, Zeitpunkt, Wer, von/nach).

- Stärke: schnell zu lesen, kein Git nötig; die Daten sind am Ort der Aufgabe und gehen durch dasselbe Schreiben (kein zweiter Lese-Weg).
- Nachteil: **eine zweite Datenhaltung neben Git** — genau das, was die Leitplanke „Die Dateien sind der einzige Speicher“ (Z. 150–153) und „Git ist das Gedächtnis“ vermeiden. Jede Bewegung schreibt **Aufgabe und Board** (heute ändert Bewegen nur die Board-Datei, Vision Z. 56–58), erzeugt einen größeren Diff in der Datei, die dadurch schlechter zu mergen ist. Der Block fehlt für die gesamte **Vergangenheit** und für an kanbanD vorbei geänderte Karten; wer „wer“ von außen ändert, muss ihn mittragen.

### Option C: Verlaufsblock in der Board-Datei

Je Bewegung eine Zeile in einem `kanbanD-log`-Block der Board-Datei (Zeitpunkt, Wer, Aufgabe, von/nach).

- Stärke: alle Bewegungen des Boards an einem Ort, unabhängig von Git lesbar.
- Nachteil: die Board-Datei wächst mit jeder Bewegung und wird **genau dort** konfliktär, wo die Leitplanke „Git-freundliche Form“ kleine, konfliktarme Diffs verlangt (Z. 154–158). Erstellung und `archived` stehen in der Aufgabendatei und fehlen weiterhin — es entstünden **zwei Verlaufsorte**. Datum und Autor werden doppelt gepflegt (Git trägt sie schon).

### Option D: ein versionierter Index/Cache

Beim Start oder auf Anfrage den Verlauf in eine Datei schreiben und diese mitversionieren.

- Stärke: Abfragen wären billig.
- Nachteil: ein Cache, der **versioniert** wird, ist laut Leitplanke Z. 152–153 unzulässig; er müsste stets gleich mit Git gehalten werden und brächte die Doppelhaltung von B ohne deren Unmittelbarkeit. Scheidet aus.

## Entscheidung

**Gewählt: Option A** — den Verlauf **ableiten statt speichern**: aus der Git-Geschichte von Board- und Aufgabendatei rechnen, „wer“ aus dem Commit-Autor.

Begründung: A ist die Linie der Vision. Ihr Satz „Git ist das Gedächtnis … wann eine Aufgabe angelegt, geändert und wohin sie bewegt wurde, steht in den Commits“ (Z. 61–66) beschreibt den Karten-Verlauf bereits vollständig — er muss nicht neu erhoben, sondern nur sichtbar gemacht werden. A hält die Leitplanke „Die Dateien sind der einzige Speicher“ ein und berührt die „Git-freundliche Form“ nicht: Bewegen ändert weiterhin **nur** die Board-Datei (Z. 56–58), der kleine Diff bleibt klein, und es entsteht **kein neuer Schreibweg**. Die Rechnung gibt es für die Bewegungen schon (`verlauf::bewegungen`, R00042); sie wird um Erstellung und `archived` aus der Aufgabendatei-Historie und um den Autor erweitert.

**Akzeptierte Schwäche.** Ich nehme bewusst in Kauf:

- **Rechnen je Öffnen.** Der Endpunkt liest je Aufruf die Historie der Board-Datei und der Aufgabendatei; für eine einzelne Karte ist das klein, aber es ist Arbeit statt Lesen eines Feldes.
- **Reorder ist unsichtbar.** Eine Umsortierung innerhalb derselben Spalte ist kein Spaltenwechsel und erscheint nicht. Der Verlauf zeigt Bewegungen zwischen Spalten (und Aufnahme/Entnahme), nicht jede Positionsänderung.
- **Commit-Autor = handelnde Person.** Das trägt, solange kanbanD selbst committet — es setzt `GIT_AUTHOR_NAME/EMAIL` aus der handelnden Person (`src/git.rs:8–18`). Committet ein Mensch an kanbanD vorbei selbst, zeigt der Verlauf dessen Git-Identität; ein Kürzel aus `kanbanD.md` ist dann nicht garantiert.

## Konsequenzen

**Positiv:**

- **Ein Speicher, ein Verlauf.** Keine zweite Datenhaltung; der Verlauf gilt rückwirkend, für Änderungen von außen und über Merge/Rebase hinweg, ohne dass kanbanD mitschreibt.
- **Kein neuer Schreibweg.** Der Endpunkt ist rein lesend; das Schreiben bleibt beim bestehenden Weg (`gesperrt()` → Prüfung → `aktion()`, ein Commit je Aktion).
- **Anschluss an Bestehendes.** Bewegungen aus `verlauf::bewegungen`; Reiter und Tabellen aus dem Muster „Kosten“ (`web/ansicht.js:232`) und „Durchläufe“ (`:302`).
- **Klein und umkehrbar.** Kein Dateiformat ändert sich; die Wahl prüft nur einen Lese-Endpunkt und eine Anzeige.

**Negativ / In Kauf zu nehmen:**

- Die Rechnung bezahlt man je Öffnen (siehe akzeptierte Schwäche).
- Reorder innerhalb einer Spalte fehlt; „wer“ ist die Git-Identität.
- Erstellung ist nur so genau wie der erste Commit, der die Aufgabendatei enthält (Commit-Zeitpunkt, Versatz R00084), nicht ein Erfassungszeitpunkt.
- `git::staende` überspringt Commits, in denen die Datei **gelöscht** ist (`src/git.rs:59–60`); eine gelöschte Karte ist über den Verlauf nur eingeschränkt sichtbar (offene Frage).

**Ausprägung des Lesewegs (Soll):**

- Neuer Endpunkt **`GET /api/aufgaben/{nr}/verlauf`** (rein lesend): führt die **Board-Datei**- und die **Aufgabendatei-Git-Historie** zeitlich zusammen. Je Eintrag **Art** (`erstellt`, `bewegt` mit von/nach, `archiviert`, `zurueckgeholt`) und **`wer`**. Unbekannte Nummer → 404; steht der Endpunkt in `GET /api/endpunkte`.
- **`git::staende`** liefert je Stand zusätzlich den **Autor** (aus `git log --format=%an %ae`); die Rückabbildung auf das Personenkürzel liest `%ae` (`<kürzel>@kanbanD`, `src/git.rs:10`).
- **Reiter „Verlauf“ im Aufgabenfenster**, Muster „Kosten“/„Durchläufe“: Tabelle, neueste oben, Datum in deutscher Form (ADR-0013). Die Anzeige liest nur; die Karte trägt **keinen** Verlaufs-Datenblock.

**Durchsetzung / Proben:**

- **Endpunkt-Probe** nach dem Muster R00042 AK: drei Commits (01.10. #1/#2 angelegt, 02.10. #1 nach „Erledigt“ bewegt, 04.10. #1 archiviert) → der Verlauf nennt **Erstellung**, die **Bewegung** mit von/nach und **archiviert**, jeweils mit dem **richtigen `wer`** (zwei verschiedene Autoren). `GET /api/endpunkte` führt den Endpunkt.
- **Kultur- und Größen-Probe**: Datum deutsch (ADR-0013), Reiter als Tab wie R00105, Zielgrößen (ADR-0012).
- **Review-Punkt `architektur-reviewer` und `code-reviewer`**: Ein **zweiter Verlaufs-Datenblock** in der Aufgabendatei oder Board-Datei (`kanbanD-log` o. ä., Option B/C) ist ein **Befund** — er bricht „ableiten statt speichern“. Ein **schreibender Weg** auf den Verlauf ist ein **Befund** — es gibt keinen neuen Schreibweg.
- **Autor-Probe**: Zwei Autoren in der Historie → jeder Eintrag trägt seinen eigenen `wer`, nicht den heutigen Betrachter.

**Geltung:** Die Regel „Karten-Verlauf wird gerechnet, nicht gespeichert“ gilt für den Verlauf **einer Karte**. Die **Datums-Trenner der Spalten** (Board-Kommentar `0119-…md:9`) sind **eigenes Thema unter D0002** und nicht Teil dieser ADR.

**Folgeentscheidungen / Aufgaben:**

- [ ] Anforderung aus Karte #119 nach dieser ADR (Vorschlag im Bericht an den Director) — #33 geht darin auf.
- [ ] WBS: neue Interaction unter D0003 (über den planer).
- [ ] Datums-Trenner der Spalten: eigenes Thema unter D0002 (über den planer).

## Offene Fragen

- **Umfang**: nur Bewegungen, oder auch **Erstellung** und **Archiv**? Diese ADR trägt den vollen Umfang (Erstellung/`archived` aus der Aufgabendatei-Historie); der planner kann den Umfang je Ausbaustufe schneiden.
- **„wer“**: die Rückabbildung `%ae` → Personenkürzel (`<kürzel>@kanbanD`); wie erscheint ein Autor, der nicht in `kanbanD.md` steht (Git-fremder Commit)? — Vorschlag: Git-Name unverändert zeigen.
- **Je Board**: Bewegungen sind **board-spezifisch**; eine Aufgabe auf mehreren Boards hat je Board eine eigene Bewegungsfolge. Braucht der Endpunkt einen `board`-Bezug, oder führt er alle Boards zusammen?
- **Löschung**: eine **gelöschte** Karte (Datei weg) — soll der Verlauf sie noch zeigen? `git::staende` überspringt Lösch-Commits (`src/git.rs:59–60`).
- **Datums-Trenner**: gehört als eigenes Thema unter D0002, nicht hierher.

## Quellen / Bezüge

- Karte #119 „Zu jeder Kanban-Board MD-Datei gibt es ein Log … pro Kanban-Karte“; Vorprüfung Kartenkommentar #119 (2026-11-11); #33 geht darin auf
- Vision `Anforderungen/R00000-vision.md`: Z. 56–58, 61–66, 68–72, 100–102, 145, 150–160
- `Anforderungen/R00042-bewegungen-eines-boards.md` (Bewegungen aus der Board-Git-Historie, `GET /api/berichte/bewegungen`), `Anforderungen/R00094-durchlaeufe-als-daten.md` (Datenblock `kanbanD-runs` als Gegenmodell)
- `src/git.rs:8–18` (Autor aus der handelnden Person), `:59–60` (Lösch-Commits fehlen), `:61–102` `staende`; `src/dienst/verlauf.rs:11–51`; `src/verlauf.rs:33–36`, `:58–91` `bewegungen`; `src/modell/aufgabe.rs:374`; `src/dienst/archiv.rs:21`, `:90`
- `web/ansicht.js:222` (`REITER`), `:226` (`vReiterleiste`), `:232` (`vKostenPanel`), `:302` (`vDurchlaeufe`), `:268` (`vFenster`)
- [ADR-0005](0005-zusammengesetzte-aktionen-in-einem-commit.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md)
- Baustein [A00007 Git](../Architektur/A00007-git.md), [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
