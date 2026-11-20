# ADR-0034: kanbanD ohne WBS — das Register nennt das Repository, Phasen werden Spalten, Altbestände öffnen weiter, die Factory stellt zuerst um

**Status**: Akzeptiert (2026-11-20, Nachtrag N1: Produktfragen 1–3 entschieden, po-entscheidungen Z. 430–433) — zuvor „Vorgeschlagen“. Ändert ADR-0032 Punkt 2 (Startordner der Wurzel) und ADR-0027 Regel 4 und N5 Punkt 4 (Zweig „mit Phasen“). Offen bleibt nur der Wortlaut der Vision-Leitplanke „Board-Repository und Arbeits-Repository sind getrennt“ (Betreiber über `/vision fortschreiben`); er ändert keine Regel dieser ADR.
**Datum**: 2026-11-20
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #224 „WBS-Funktionen aus kanbanD entfernen“ (Auftrag des Betreibers 2026-11-20); Scheiben als Karten #225 S1, #226 S4, #224 S2, #227 S3, #228 „Braucht zwischen Karten“ (po-entscheidungen Z. 433); Anforderungen folgen je Karte über den planer. Bezug: Vision ab11f96a, po-entscheidungen Z. 362, 426–429, R00018, R00053–R00062, R00071, R00072, ADR-0027, ADR-0028, ADR-0031, ADR-0032
**Erprobt durch**: — (keine Probe gebaut; alle Aussagen zum Ist sind am Code belegt, Stand `5efbbaa0`; Bestand gezählt in `~/Projekte/Kanban-Boards/*` am 2026-11-20)

## Kontext

Die Vision (ab11f96a) sagt: „Die Aufgaben sind der Stand. … kanbanD liest, schreibt und zeigt sie [die WBS] nicht. Ein Board bindet keine bis mehrere Anwendungen (Kürzel und Repository, etwa für Commit-Verweise). Spalten sind Spalten …; `Braucht`-Beziehungen bleiben echte Abhängigkeiten zwischen Karten.“ und „Kein Ersatz für Vision, Anforderungen und WBS … kanbanD liest und schreibt sie nicht.“

Belegt im Code:

- **Register**: `Anwendung { kuerzel, name, wbs, anforderungen }` (`src/modell/einstellungen.rs:40–46`), Standardanwendung aus `sources.wbs`/`sources.requirements` (`:48–54`, `src/modell/anwendungen.rs:42–49`). Geschrieben wird die ganze `kanbanD.md` neu, je Anwendung `{name, wbs, requirements}` (`src/format/einstellungen.rs:84–95`, `:98–121`); unbekannte Schlüssel überstehen das Schreiben nicht (ADR-0031 Kontext).
- **Wurzel des Arbeits-Repositorys** heute aus dem Ordner der WBS-Datei, ohne WBS aus dem Anforderungsordner (`src/git/arbeitsrepo.rs:148–163`, ADR-0032 Punkt 2). Daran hängen Commit-Verweise, Liste und Diff (#207–#214).
- **WBS lesen und schreiben**: `src/wbs.rs` (Rechnung), `src/wbs_datei.rs` (byte-treues Schreiben), `src/dienst/wbs.rs` (Sicht, Status, Knoten, Verwerfen), `src/dienst/wirkungen.rs` (Wirkungen, Eintritt schreibt in die WBS), `src/herkunft.rs` (Knotentabelle lesen, auch für die Herkunft), `src/dienst/herkunft.rs` (WBS und Anforderungsordner lesen), Dateiwächter für fremde WBS (`src/waechter.rs:99–160`), Git im fremden Repository ohne Härtung (`src/git.rs:344–369`, Karte #221).
- **Phasen**: `src/phasen.rs` liest die Phasen-Datei neben der WBS (`pfad_neben`, `:34–37`); `src/dienst/phasen.rs` ergänzt beim Lesen eines gebundenen Boards fehlende Phasen-Spalten mit eigenem Commit (`:36–49`); `column-phases` im Board (`src/format/board.rs:14`, `:345`), `phases.skipped` in der Aufgabe (`src/format/aufgabe.rs:18`, `:192`); die Berichte rechnen mit Phasen (`web/berichte.js:154–160`, `:387–409`, `:547–600`, `:858`; ADR-0027 Regel 4, N5 Punkt 4).
- **Plausibilität**: `column-checks` kennt genau eine Prüfung, `wbs-effects-green` (`src/pruefungen.rs:10–23`).
- **„wartet auf“** entsteht nur aus der Spalte `Braucht` der WBS (`web/ansicht.js:781–790`, R00018). Eine `Braucht`-Beziehung zwischen Karten ohne WBS gibt es in kanbanD nicht.
- **Unbekannte Schlüssel**: Aufgaben bewahren sie (`Aufgabe.weitere`, `src/format/aufgabe.rs:96`, geschrieben über `serde_yaml` in Blockform, `:526–535`); Boards und `kanbanD.md` lassen sie beim nächsten Schreiben weg.
- **Bestand** (8 Ordner): 4 Register-Einträge (`kd`, `jopu`, `lc`, `zbw`), alle mit absolutem `wbs` und `requirements`, keine Standardanwendung gesetzt; 5 Board-Dateien mit `column-phases`, 0 mit `column-checks`; 85 Aufgaben mit `wbs-effects` und 2 mit `phases` (alle JoinPuya); 363 Aufgaben mit `origins`.
- **Außerhalb von kanbanD** lesen oder schreiben: die Factory (`werkzeuge/board_binden.py` Register mit `wbs`, Vergleich über `a["wbs"]`; `tests/test_auftrag.py:236–247` erwartet `phase` je Spalte und `erreichbar.wbs`; `karten_aus_wbs.py` setzt Herkunft `<kürzel>:<knoten>`), der globale „Gebundene Modus“ (`~/.claude/commands/testen/kanband.py`: `GET /api/wbs/<kürzel>`, `phasen` aus `bewegungen`, `PATCH phasen`; ausgelöst durch `kanban:` im Frontmatter der WBS) und zwei Projektschichten (`kanbanD/AI-Team/planer.md:7`, `JoinPuyaApp/AI-Team/entwickler/rolle.md:26`: `POST /api/wbs/<kürzel>/knoten`). `kanban:` selbst liest kanbanD nicht.

Qualitätsziele (Szenarien mit Maß):

- **Q1 Altbestand**: Jeder der 8 Ordner öffnet nach dem Upgrade ohne defekte Datei; `GET /api/aufgaben/{nr}/commits` liefert für jeden hinterlegten Verweis denselben `zustand` wie vor der Karte.
- **Q2 Trennung**: Nach Öffnen, Anlegen, Bewegen durch alle Spalten, Archivieren und allen Berichten ist die WBS-Datei bytegleich (SHA-256), und mit unlesbarer WBS (`chmod 000`) verhält sich kanbanD genau gleich.
- **Q3 Kein Bruch beim Rollout**: Die Factory läuft gegen die Version vor und nach der Karte.
- **Q4 Nichts geht still verloren**: was entfällt, entfällt sichtbar in einem Commit oder bleibt in der Datei.

## Optionen (Wurzel des Repositorys)

### Option A: Neues Feld `repository` je Anwendung, Lese-Rückfall auf den Ordner von `wbs`/`requirements`, geschrieben wird nur die neue Form
- Vorteile: Das Register sagt, was es meint (Vision „Kürzel und Repository“). Kein Upgrade-Schritt: ein Altbestand öffnet und rechnet die Wurzel wie heute; mit dem nächsten Speichern der Einstellungen steht nur noch `repository` in der Datei. Der Rückfall nimmt nur den Ordner des Pfads als Startpunkt für `rev-parse --show-toplevel` und öffnet die Datei nie.
- Nachteile: Ein Rückfallzweig von wenigen Zeilen bleibt dauerhaft. Schwäche: eine ältere Programmversion findet nach dem Speichern keine Wurzel mehr (kein `wbs`), Commit-Verweise zeigen dort `repository_fehlt` — ein Zurückgehen auf die alte Version verliert die Diff-Ansicht.

### Option B: `wbs` bleibt, heißt aber „ein Pfad im Repository“
- Vorteile: Kein Formatwechsel, keine Factory-Änderung am Register, alte und neue Version lesen dieselbe Datei.
- Nachteile: Der Name sagt etwas anderes, als er bedeutet; Einrichten und API müssten „WBS“ weiter zeigen, gegen „zeigt sie nicht“. Schwäche: jeder neue Leser deutet das Feld wieder als WBS.

### Option C: Repository je Board (`repositories: {kd: <pfad>}` in der Board-Datei)
- Vorteile: Der Pfad steht dort, wo die Bindung steht.
- Nachteile: Eine Karte auf keinem oder zwei Boards hätte keine oder zwei Wurzeln für denselben Verweis; doppelte Pflege je Board. Schwäche: widerspricht dem Register aus R00053 und der PO-Entscheidung Z. 362 („über das Register“).

### Option D: Einmalige Umstellung beim Start (kanbanD schreibt `kanbanD.md` selbst um, ein Commit)
- Vorteile: Danach gibt es keinen Rückfallzweig.
- Nachteile: Ein Commit, den niemand ausgelöst hat, in jedem Ordner, den man öffnet (auch in fremden, z. B. nur zum Ansehen). Schwäche: die Schwäche von A tritt sofort und überall ein, nicht erst nach einer bewussten Änderung.

## Entscheidung

**Gewählt: Option A**, dazu folgende Regeln (Vorschlag, bis die Fragen beantwortet sind):

1. **Register**: `sources.applications.<kürzel>: {name, repository}`; `repository` ist ein Ordner im Arbeits-Repository (absolut oder relativ zum kanbanD-Ordner), die Wurzel ist `rev-parse --show-toplevel` von dort (ADR-0032 Punkt 2 im Übrigen unverändert: kein Zwischenspeicher, Härtung N2.3). Die Standardanwendung heißt `sources.repository`. **Lesen**: fehlt `repository`, gilt der Ordner von `wbs`, sonst `requirements` — nur als Startpunkt, die Datei wird nie geöffnet. **Schreiben**: nur `{name, repository}` und `sources.repository`; der Rückfallwert wird dabei als `repository` geschrieben (der Ordner, nicht die Toplevel-Wurzel — kein Git unter der Sperre). API: `Anwendung { kuerzel, name, repository }`, `GET /api/anwendungen` mit `erreichbar: {repository}`; `PUT /api/einstellungen` ignoriert mitgeschickte `wbs`/`anforderungen` (serde ohne `deny_unknown_fields`), damit ein Client in der Übergangszeit beide Formen senden kann.
2. **Altbestände** — je Dateiart, damit nichts still verloren geht und kein ungefragter Commit entsteht:

   | Datei | Schlüssel | Lesen | Schreiben |
   |---|---|---|---|
   | Aufgabe | `wbs-effects`, `phases` | werden unbekannte Schlüssel (aus `BEKANNT` gestrichen), Aufgabe öffnet | bleiben erhalten (ADR-0028 Option B); einmal Blockform statt Flussform beim ersten Schreiben der Aufgabe |
   | Aufgabe | `origins` | siehe Frage 1 | siehe Frage 1 |
   | Board | `column-phases`, `column-checks` | überlesen | entfallen beim nächsten Schreiben des Boards (wie jeder unbekannte Board-Schlüssel heute); `applications` bleibt |
   | `kanbanD.md` | `wbs`, `requirements` (Register und `sources`) | Rückfall für die Wurzel (Regel 1) | ersetzt durch `repository` beim nächsten `PUT /api/einstellungen` |

   Kein Commit beim Start, keine Migration über fremde Ordner (ADR-0031 Option B verworfen aus demselben Grund).
3. **Phasen werden Spalten**: kein Lesen der Phasen-Datei, kein Nachtragen von Phasen-Spalten, kein `phasen` in `GET /api/boards/{slug}` und `bewegungen`, kein `PATCH phasen`. Die Berichte rechnen nur noch den Zweig „ohne Phasen“ aus ADR-0027 (Regel 4, N5 Punkt 4 entfallen für Phasen). Eine gespeicherte Wahl, die eine Phase nannte (`fever.target-column`, `from-column`), fällt unter die bestehende Regel „eine Wahl, die es nicht mehr gibt, gilt als Vorgabe“ (ADR-0027 N5 Punkt 5). Durchläufe (`kanbanD-runs`, R00094) behalten ihr Textfeld `phase`: es ist ein Name, keine Bindung.
4. **Entfällt ohne Ersatz**: WBS-Sicht und ihre Endpunkte (`GET /api/wbs/{kürzel}`, `POST …/knoten`, `PATCH …/knoten/{id}`, `POST …/verwerfen`), Wirkungen (`…/wbs-effects` ×4), Plausibilität `column-checks` samt Katalog, `GET /api/herkunft` mit WBS- und Anforderungsauflösung, „wartet auf“ aus der WBS, das Feld `wbs` der Server-Ereignisse, der Dateiwächter für fremde WBS und die ungehärteten Git-Aufrufe im fremden Repository (`src/git.rs:344–369`; damit erledigt sich #221). Die Bindung `applications` am Board bleibt (Vision „Ein Board bindet keine bis mehrere Anwendungen“), ohne eigene Wirkung.
5. **Rollout**: erst die Factory und der globale Gebundene Modus (beide Versionen verträglich), dann kanbanD in Scheiben, zuletzt die Auslieferung an die Board-Instanzen. Liste „Factory muss vorher …“ und Scheiben stehen im Bericht der Inventur.

## Konsequenzen

**Positiv:**
- kanbanD öffnet keine Datei im Arbeits-Repository mehr; dort startet es nur noch gehärtetes, lesendes Git (A00011). Ein ganzer Satz Angriffs- und Fehlerfläche entfällt (byte-treues Schreiben fremder Dateien, ungehärtetes Git, Wächter außerhalb des Ordners).
- Etwa 2.300 Zeilen Rust in eigenen Modulen, rund 1.000 Zeilen Rust-Tests und 1.000 Zeilen E2E entfallen (Inventur).

**Negativ / Inkauf zu nehmen:**
- Ein Zurückgehen auf eine Version vor der Karte verliert nach dem ersten Speichern der Einstellungen die Wurzel der Commit-Verweise (Schwäche von A).
- Boards mit `column-phases` verlieren die Zeilen beim nächsten Schreiben in einem Commit, der nach der Aktion heißt (z. B. einer Bewegung). Das ist heute schon das Verhalten jedes unbekannten Board-Schlüssels; der Diff zeigt es.
- Berichte gebundener Boards ändern sich, wo mehrere Spalten eine Phase darstellten oder „gleich wie“/„eingebettet in“ galt; im Bestand bilden alle 5 Boards je Spalte genau eine Phase ab.
- Ohne Antwort auf Frage 2 verschwindet „wartet auf“, bis eine Karte `Braucht` zwischen Karten baut.

**Durchsetzung:**
- Probe Q2 als Integrationstest: WBS-Datei mit `chmod 000` neben dem Arbeits-Repository, eine Folge aus Anlegen, Bewegen durch alle Spalten, Berichten, Commit-Liste → keine Abweisung, keine Fehlerzeile im Log, Datei bytegleich. Die unlesbare Datei ist der Beleg, dass nichts sie liest.
- Legacy-Probe gegen `5efbbaa0`: Kopie eines echten Ordners (JoinPuya: `wbs-effects`, `phases`, `column-phases`, Register mit `wbs`) öffnet; `kd:<hash>`-Zustände gleich; nach `PATCH titel` stehen `wbs-effects`/`phases` semantisch gleich in der Datei; nach `PUT /api/einstellungen` steht `repository` statt `wbs`/`requirements`.
- `rg -i 'wbs' src web` ergibt nach der letzten Scheibe nur noch den Rückfall in Regel 1 und Kommentare mit Verweis auf diese ADR (Prüfpunkt des architektur-reviewer).

## Produktfragen (an den product-owner, entschieden in N1)

1. **Herkunft (`origins`)** — Empfehlung: bleibt als Verweistext an der Karte (Chips, Eingabe, Rückgängig, Schnelleingabe wie heute, Form `[kürzel:]ID` oder `thin air` unverändert geprüft), aber **ohne Auflösung**: kein Name, kein Status, kein Editor-Link, kein `GET /api/herkunft`. Grund: die Factory setzt sie (`karten_aus_wbs.py`), 363 Aufgaben tragen sie, ein Verweis ist kein Lesen der WBS. Alternative: `origins` wird unbekannter Schlüssel (bleibt in der Datei, verschwindet aus Oberfläche und API).
2. **`Braucht` zwischen Karten** — Empfehlung: „wartet auf“ aus der WBS entfällt mit #224; eine eigene Karte baut `needs: [<nr>]` an der Aufgabe mit „wartet auf #n“ (Vision verspricht es). Alternative: in #224 mitbauen (größere Karte, neue Gestaltung).
3. **Altbestände** (mit Legacy-Review) — Empfehlung wie Regel 2: Aufgaben bewahren, Boards lassen beim nächsten Schreiben weg, `kanbanD.md` stellt beim nächsten Speichern um; kein Start-Commit.

## Folgeentscheidungen / Aufgaben

- [ ] Nach Annahme: Statuszeile von ADR-0032 („Punkt 2 geändert durch ADR-0034“) und ADR-0027 (Phasenzweig entfallen) nachführen — erst nach dem Merge von #214, das ADR-0032 gerade ergänzt.
- [ ] A00011 Abschnitt Entscheidungen um diese ADR ergänzen (ebenfalls nach #214).
- [ ] Bausteine nach jeder Scheibe nachführen (Soll → Ist).
- [ ] Vision-Leitplanke „Board-Repository und Arbeits-Repository sind getrennt“ neu fassen (Vorschlag im Bericht der Inventur, Betreiber).

## Nachträge

### N1 (2026-11-20, Karte #225): Akzeptiert — Produktfragen entschieden, Schnitt in fünf Karten

**Antworten des product-owner** (po-entscheidungen Z. 430–433, bc5f5eaf):

1. **Herkunft** wie empfohlen: `origins` bleibt in der Aufgabe, wird gelesen, geschrieben (Schnelleingabe, API) und als Text angezeigt; die Schreibweise `[<kürzel>:]<id>` bzw. `thin air` bleibt geprüft. `GET /api/herkunft` und der Link in die WBS-Sicht entfallen (Karte #226, S4).
2. **Braucht**: „wartet auf“ aus der WBS entfällt mit S2 (#224); eigene Karte #228 „Braucht zwischen Karten“ direkt nach S2. Vorgabe **ein Träger**: zuerst prüfen, ob das Label `braucht:<nr>` der Träger wird, bevor ein Feld `needs` entsteht; wird es ein Feld, gehört die Übernahme der Labels in dieselbe Karte.
3. **Altbestände** wie Regel 2, mit Bedingungen: ein Altbestand öffnet **ohne Fehler und ohne Warnung** im normalen Betrieb; die **Legacy-Probe gegen eine Kopie des JoinPuya-Ordners** (85 `wbs-effects`, 2 `phases`, Boards mit `column-phases`, Register mit `wbs`) gehört zur Abnahme; Board-Schlüssel fallen **nur im Commit einer Aktion weg, die das Board ohnehin schreibt**, nie in einem eigenen Commit.

**Schnitt und Reihenfolge** (Z. 433): #225 S1 Register mit `repository` (braucht #214, ohne Factory-Sperre, weil der Rückfall auf `wbs`/`requirements` die heutige Factory bedient) → #226 S4 Herkunft als Text (braucht #225) → **Sperre**: Factory-Pflege und globale Befehle (Inventur §6) ausgerollt → #224 S2 (braucht #225) → #227 S3 Phasen werden Spalten (braucht #224) → #228 Braucht zwischen Karten (braucht #224).

**S1 und #214** (Startort in `src/git/arbeitsrepo.rs`): S1 ändert nur, **woher der Startordner kommt** (`wurzel_bis`, `:148–153`); #214 ändert dieselbe Datei an anderen Stellen (Befehlsliste, `diff_tree`, Teilausgabe) und ruft `wurzel_bis(board_ordner, anwendung, frist)` unverändert auf. Regel für den Bau: **Signaturen von `wurzel` und `wurzel_bis` bleiben**, die Wahl des Startordners wandert in eine reine Funktion (`repository`, sonst Ordner von `wbs`, sonst `requirements`). Die neuen Tests von #214 schreiben Register mit `wbs:` als Text in `kanbanD.md`; sie laufen über den Rückfall weiter und sind damit zugleich Legacy-Probe. Der Struct `Anwendung` verliert `wbs`/`anforderungen` erst, wenn #214 auf `main` ist — deshalb bleibt `braucht:214` (Reihenfolge, nicht Konfliktgefahr in derselben Zeile).

## Quellen / Bezüge

- Vision `Anforderungen/R00000-vision.md` (ab11f96a), po-entscheidungen Z. 362, 426–429
- `src/git/arbeitsrepo.rs:143–163`, `src/format/einstellungen.rs`, `src/format/aufgabe.rs:11–31`, `:96`, `:526–535`, `src/format/board.rs:14–15`, `:303–355`, `src/dienst/phasen.rs`, `src/pruefungen.rs`, `web/ansicht.js:781–790`
- Factory `werkzeuge/board_binden.py`, `werkzeuge/karten_aus_wbs.py`, `tests/test_auftrag.py`; `~/.claude/commands/testen/_testen.md` „Gebundener Modus“, `kanband.py`
- ADR-0027, ADR-0028, ADR-0031, ADR-0032
