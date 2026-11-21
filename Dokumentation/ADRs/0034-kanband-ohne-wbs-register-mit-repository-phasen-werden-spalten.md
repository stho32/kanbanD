# ADR-0034: kanbanD ohne WBS — das Register nennt das Repository, Phasen werden Spalten, Altbestände öffnen weiter, die Factory stellt zuerst um

**Status**: Akzeptiert (2026-11-20, Regel 1 „Schreiben“ geändert durch Nachtrag N2; Nachtrag N1: Produktfragen 1–3 entschieden, po-entscheidungen Z. 430–433; Nachtrag N3: Technik von S4, „wartet auf“ entfällt schon mit S4; Nachtrag N4: Technik von S3, Bestand berichtigt, gespeicherte Wahl mit Phasennamen) — zuvor „Vorgeschlagen“. Ändert ADR-0032 Punkt 2 (Startordner der Wurzel) und ADR-0027 Regel 4 und N5 Punkt 4 (Zweig „mit Phasen“). Offen bleibt nur der Wortlaut der Vision-Leitplanke „Board-Repository und Arbeits-Repository sind getrennt“ (Betreiber über `/vision fortschreiben`); er ändert keine Regel dieser ADR.
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

### N2 (2026-11-20, Karte #225): Übergangsform des Registers — `repository` immer, `wbs`/`requirements` durchgereicht, solange ein Schreiber sie schickt (ändert Regel 1 „Schreiben“ und „`PUT` ignoriert“)

**Anlass** (planer, R00209 Offene Fragen): Regel 1 verträgt sich nicht mit „S1 ohne Factory-Sperre“ (N1, PO Z. 433) und nicht mit Q3. Belegt:
- Die Factory erkennt ihre Anwendung über `os.path.realpath(a["wbs"])` für **jeden** Eintrag aus `GET /api/einstellungen` (`werkzeuge/board_binden.py:54`); fehlt der Schlüssel, `KeyError`; ist er leer, wird die Anwendung nicht wiedererkannt und der nächste Lauf scheitert an „Kürzel … schon vergeben“ (`:56–58`).
- `board.py` `_einrichten` und `board_aus_konfig.py` schreiben die Einstellungen per `GET`→`PUT` zurück; nach Regel 1 wäre `wbs` danach fort.
- **Mein Fehler in Regel 1:** kanbanD selbst liest `wbs` bis S2–S4 weiter (WBS-Sicht `src/dienst/wbs.rs:62`, Phasen `src/dienst/phasen.rs:57`, Herkunft `src/dienst/herkunft.rs:49–55`). S1 nach Regel 1 hätte diese Funktionen beim ersten Speichern abgeschaltet, Karten vor ihrer Scheibe.

**Optionen:** (a) Übergangsform (Empfehlung des planers) — Factory und eigene Leser laufen unverändert, die neue Form entsteht erst, wenn niemand `wbs` mehr schickt; Schwäche: zwei Formen nebeneinander bis S2, und ein `PUT` in neuer Form an einer Factory-gebundenen Anwendung bricht deren Wiedererkennung. (b) Regel 1 wörtlich, Factory-Sperre vor S1 — eine Form sofort; Schwäche: S1 wartet auf die Factory-Pflege, und die eigenen WBS-Funktionen fielen trotzdem zwischen S1 und S2 aus.

**Gewählt: (a).** Regeln (ersetzen Regel 1 ab „**Schreiben**“ bis „senden kann“):

1. **Schreiben**: je Anwendung immer `repository` — das mitgeschickte, sonst der Startordner aus dem Rückfall (Ordner von `wbs`, sonst `requirements`); `wbs`/`requirements` nur, wenn mitgeschickt und nicht leer. Für `sources` ebenso. Lesen bleibt wie Regel 1.
2. **API**: `GET /api/einstellungen` und `GET /api/anwendungen` liefern je Anwendung **immer** die Schlüssel `repository`, `wbs` und `anforderungen` (leer = `""`, nie weggelassen — `board_binden.py:54` indiziert jeden Eintrag). `PUT` nimmt beide Formen an; ein `GET`→`PUT`-Rundlauf ändert die Datei nicht (bis auf ein ergänztes `repository` beim ersten Mal).
3. **Neue Form allein** entsteht nur durch einen `PUT`, der `wbs`/`anforderungen` leer lässt. Bis die Factory-Sperre fällt (N1, vor #224), schickt die Einstellungsseite die vorhandenen Werte unverändert mit, und für Factory-gebundene Anwendungen ist ein `PUT` in neuer Form nur in Proben auf Kopien erlaubt (R00209 AK 4, 8, 9).
4. **Ende der Übergangsform**: S2 (#224) entfernt die Felder `wbs`/`anforderungen` aus Einstellungsseite und API-Antwort und schreibt nur noch `repository`; der Lese-Rückfall bleibt (Regel 1). Bis dahin ist die Factory umgestellt (Inventur §6.1).

**Inkauf**: In der Übergangszeit stehen in Bestandsregistern beide Formen; ein Mensch, der `wbs` in den Einstellungen leert, trennt die Factory von ihrer Anwendung — das zeigt der nächste Factory-Start mit klarer Meldung, nicht still.

**Durchsetzung**: R00209 AK 5 (alte Form → 200, `repository` abgeleitet, `wbs` bleibt), AK 6 (Rundlauf mit der unveränderten Factory, `tests.test_auftrag`), AK 7 (Start schreibt nichts); dazu ein Test: `GET /api/einstellungen` nach einem `PUT` in neuer Form liefert `wbs: ""` (Schlüssel vorhanden).

### N3 (2026-11-20, Karte #226 S4): Herkunft als Text — was entfällt, was bleibt; „wartet auf“ geht mit S4 (ändert N1 Punkt 2 im Zeitpunkt)

**Anlass**: Technik von S4 klären (Director, Lauf 226-architekt-1). Stand `ed6baad8` (Zweig `karte/226`, main mit #225).

**Belegt am Code:**
- Die Auflösung besteht aus einem Dienst und einem Endpunkt. `Kanban::herkunft` (`src/dienst/herkunft.rs:88–106`) liest je Anwendung die WBS-Datei (`wbs_quellen`, `:51–73`) und den Anforderungsordner (`anforderungs_quellen`, `:75–86`). Der Endpunkt ist `GET /api/herkunft` (Route `src/web/mod.rs:95`, Handler `:1453–1464`, Beschreibung `src/web/endpunkte.rs:103`).
- Die Oberfläche lädt die Auflösung bei jedem Aufbau (`web/app.js:302–304`, Zustand `S.herkunft` `:2`, `:242`, `:321`). Sie braucht sie an genau drei Stellen: Link und Tooltip des Chips (`quelleLink`, `vHerkunftChip`, `web/ansicht.js:701–718`), die Bedingung `!S.herkunft[x]` von „mehrdeutig“ (`:711`) und **„wartet auf“** (`wartetAuf`, `:788–797`). „wartet auf“ nimmt `braucht` aus `S.herkunft[x].braucht`, also aus `/api/herkunft`, nicht aus der WBS-Sicht. Es steht auf der Karte (`:863`) und als Zeile im Aufgabenfenster (`:430`).
- Der Link des Chips ist ein Editor-Link (`vscode://file<datei>:<zeile>`), kein Verweis in die WBS-Sicht. Der „Herkunftslink in die WBS-Sicht“ aus po-entscheidungen Z. 430 meint diesen Link.
- `origins` wird ohne Prüfung als Textliste gelesen (`src/format/aufgabe.rs:66`) und geschrieben (`:500–501`). Geprüft wird nur beim Schreiben über die API (`src/modell/aufgabe.rs:595–606`, `herkunft_gueltig` `:532–534`, `Herkunftsschluessel::lesen` `src/modell/anwendungen.rs:19–29`). Nichts davon liest WBS oder Anforderungen.
- Geteilte Teile: `src/herkunft.rs::wbs_tabelle` wird von `src/wbs_datei.rs` und `src/dienst/wbs.rs` gebraucht (S2). `dienst::herkunft::absolut` wird von `dienst/anwendungen.rs`, `dienst/phasen.rs` und `dienst/wbs.rs` gebraucht. Keinen anderen Aufrufer haben nur `anforderungsname` (`src/herkunft.rs:51–58`) sowie `Anwendungen::aufloesen` und `Aufloesung` (`src/modell/anwendungen.rs:56–74`).
- Kein Aufrufer außerhalb von kanbanD: `api/herkunft` kommt weder in der Factory (`werkzeuge/`, `tests/`, `.claude/`) noch in `~/.claude/{commands,skills,agents}` vor (gesucht 2026-11-20).
- Bestand: 363 Aufgaben mit `origins` in 4 Ordnern (JoinPuya 139, localchatA 106, kanbanD 61, goaltreetoolA 57) mit 547 Einträgen, davon 536 qualifiziert, 8 ohne Kürzel und 3 `thin air`.

**Varianten für den Chip ohne Auflösung:**

| Variante | Stärke | Schwäche |
|---|---|---|
| **A** Text-Chip `span.org` wie heute der nicht gefundene, ohne Link und Tooltip; „ohne Herkunft“ und „mehrdeutig“ bleiben | kein neues Aussehen (Ruhezustand von `a.org` und `span.org` ist gleich, `web/kd-app.css:235`, `:262`), keine Gestaltung, rechnet nur aus Text und Register | wer den Editor-Sprung gewohnt ist, verliert ihn ohne Hinweis |
| **B** wie A, Tooltip „Verweis — kanbanD öffnet ihn nicht“ | erklärt den Wegfall | erklärt etwas, das nicht da ist; neuer Wortlaut braucht eine Freigabe; Rauschen auf 547 Chips |
| **C** Chip filtert beim Klick das Board nach der Herkunft | der Klick bekommt einen Nutzen | neuer Umfang und neue Gestaltung, nicht Auftrag der Karte |
| **D** Editor-Link im Browser aus `repository` und einer Pfadkonvention errechnet | der Sprung bleibt | ist Auflösung in anderer Form (setzt den Pfad der WBS voraus) und widerspricht der Vision („ein Verweis, den kanbanD nicht auflöst“) |

**Gewählt: A.** Pre-Mortem (S4 ist ausgeliefert und schiefgegangen, weil …):
1. … e2e-Läufe hängen: drei Specs warten auf die Antwort von `/api/herkunft`. Der Bau passt deshalb `r00171`, `r00172` und `r00196` an.
2. … „wartet auf“ schon ab S4 fehlt und niemand davon wusste. Das regelt Regel 4.
3. … ein Rest von `S.herkunft` übrig bleibt und jeder Chip „Quelle nicht gefunden“ zeigt. Deshalb entfällt der Tooltip-Zweig ganz, und die Abnahme prüft: kein `.org` hat ein `href` oder ein `title` mit „Quelle“, und es geht keine Anfrage an `/api/herkunft`.

**Regeln für S4:**
1. **Entfällt**: `src/dienst/herkunft.rs` ganz (`Quelle`, `Kanban::herkunft`, `gesucht_in`, `wbs_quellen`, `anforderungs_quellen`, `kuerzel_der`) samt `mod`/Re-Export (`src/dienst/mod.rs:29`, `:64`). Route und Handler `GET /api/herkunft` (`src/web/mod.rs:95`, `:1453–1464`) und die Zeile `src/web/endpunkte.rs:103`. Ein Aufruf liefert dann 404, denn der Router hat keinen Fallback. Außerdem `anforderungsname` samt Test (`src/herkunft.rs:51–58`, `:96–101`) und `Anwendungen::aufloesen` mit `Aufloesung` samt Test (`src/modell/anwendungen.rs`, Re-Export `src/modell/mod.rs:14`). In der Oberfläche entfallen Abruf und Zustand `S.herkunft` (`web/app.js:2`, `:242`, `:302–304`, `:321`), `quelleLink`, der Link- und Tooltip-Zweig von `vHerkunftChip` und `wartetAuf` mit Kartenzeile und Fensterzeile (`web/ansicht.js:430`, `:863`). Im CSS entfallen `a.org:hover`, `.ka[data-eigen] .r3 a.org:hover` mit ihrem Kommentar und `.ka .wartet` (`web/kd-app.css:208–215`, `:236`, `:743–744`).
2. **Bleibt unverändert**: Lesen und Schreiben von `origins`, also Format, `herkunft` in `POST`/`PATCH`/Duplizieren, Schnelleingabe (`web/eingabe.js:42`), Feld „Neue Herkunft“, Entfernen mit Rückgängig (R00185), Filter (`web/filter.js:59`) und CSV-Export. Ebenso bleiben die Prüfung der Schreibweise mit ihren Meldungen (`src/modell/aufgabe.rs:595–606`), `Herkunftsschluessel`, die Anzeige `thin air` → „ohne Herkunft“ (`web/kultur.js:72–97`) und `HERKUNFT_HILFE`.
3. **Chip (Variante A)**: `<span class="org" data-halt="herkunft:…">kd:I0007</span>` ohne `href` und ohne `title`; `org leer` und `org mehrdeutig` bleiben wie heute. „mehrdeutig“ rechnet nur noch aus Text und Register: kein Kürzel, nicht `thin air`, mehr als eine Anwendung im Ordner (`anwendungenImOrdner`). Das verhält sich wie bisher, denn der Server hat unqualifizierte Herkunft bei mehreren Anwendungen nie aufgelöst (`Aufloesung::Mehrdeutig`). Eine Nachzeichnung ist nicht nötig, weil nur der Zeige-Zustand wegfällt.
4. **„wartet auf“ geht mit S4, nicht mit S2** (ändert N1 Punkt 2 im Zeitpunkt): Es hängt allein an `/api/herkunft` und bleibt ohne den Endpunkt leer; die Abnahme von #226 nennt es schon. Damit beginnt die Lücke bis #228 früher. Die Labels `braucht:<nr>` bleiben sichtbar (Z. 431). #228 braucht technisch S4, nicht die WBS-Sicht aus S2. Wird das Label der Träger (kein Formatwechsel in `src/format/aufgabe.rs`), kann `braucht:224` an #228 zu `braucht:226` werden (Vorschlag an product-owner und Director).
5. **Geteilte Teile bleiben bis S2**: `src/herkunft.rs` behält nur `wbs_tabelle` mit angepasstem Modulkommentar; S2 löscht die Datei. `absolut` zieht nach `src/dienst/anwendungen.rs` (`pub(super)`), weil dieser Dienst S2 überlebt. `dienst/phasen.rs` und `dienst/wbs.rs` ändern nur ihre `use`-Zeile.
6. **Altbestände**: Format und Daten ändern sich nicht. Die 363 Aufgaben öffnen unverändert, weil Lesen nicht prüft. Probe: Kopie eines Bestandsordners (JoinPuya) starten; `GET /api/aufgaben` liefert 200 ohne defekte Datei, die Chips erscheinen als Text.
7. **Grenze zu S2/S3 und #229**: S4 fasst nichts an, was S2/S3 entfernen (WBS-Sicht, Wirkungen, Phasen, Register-Felder, `wbs_tabelle`). Gemeinsame Dateien sind `web/ansicht.js`, `web/app.js`, `src/dienst/mod.rs` und `web/kd-app.css`, dort aber andere Zeilen. #229 berührt `src/dienst/diff.rs`, `gesamt_diff.rs` und `src/modell/*_diff.rs`; es gibt keine Überschneidung.
8. **Doku**: README Z. 51 („Ohne Kürzel löst eine Herkunft nur auf, solange es genau eine Anwendung gibt“) wird so umformuliert: Die Herkunft ist ein Verweis, den kanbanD nicht auflöst; ohne Kürzel ist sie bei mehreren Anwendungen mehrdeutig.

**Tests** (Stand `ed6baad8`):

| Test | prüft heute | Folge |
|---|---|---|
| `tests/herkunft.rs` (2) | Auflösung von WBS und Anforderung; leer ohne Quellen | umbauen: Schreiben `origins: [I0007, R00014]` und 400 für `X1` bleiben, `GET /api/herkunft` → 404 |
| `tests/anwendungen.rs` `gleiche_id_in_zwei_anwendungen_loest_je_kuerzel_auf`, `bei_einer_anwendung_loest_auch_unqualifiziert_auf` | Auflösung je Kürzel | entfallen; die Prüfung der Schreibweise deckt `qualifizierte_herkunft_schreiben_unbekanntes_kuerzel_ist_400`; Hilfe `aufgabe` (`:86`) wird dann tot |
| `tests/aufgaben.rs:59` | Lesen bei defekter `kanbanD.md` | `api/herkunft` aus der Liste |
| Unit `name_der_anforderung` (`src/herkunft.rs`), `aufloesen_eindeutig_mehrdeutig_unbekannt` (`src/modell/anwendungen.rs`) | Auflösung | entfallen |
| e2e `r00018-herkunft.spec.js` „US-1 bis US-3“ | Link, „wartet auf“, Lage von `.wartet` | anpassen: Chip ohne `href`, kein `.wartet` trotz `Braucht` in der WBS; die Lageprüfung entfällt |
| e2e `r00053-anwendungen.spec.js` US-3 (`:58`), US-2 (`:64–87`), „mit einer Anwendung …“ (`:89–97`) | Tooltip „Quelle nicht gefunden“, Link, „wartet auf“ | anpassen: weder `title` noch `href`; „mehrdeutig“ bleibt geprüft |
| e2e `kontrast.spec.js` „Zeige-Zustand der Herkunft“ (`:672`) | `a.org:hover` | entfällt; „US-1/US-2 … Herkunft auf eigener Klassenfarbe“ bleibt |
| e2e `r00171` und `r00172` (Hilfe `waehlen`), `r00196:206` | warten auf die Antwort von `/api/herkunft` | Pfad aus der Liste streichen, sonst Zeitüberschreitung |
| neu | Abnahme | Rust: `GET /api/herkunft` → 404. e2e: Aufgabe mit `origins: [kd:I0007]` und einer WBS mit `Braucht` → Chip als Text ohne `href`/`title`, kein `.wartet` auf Karte und Fenster, keine Anfrage an `/api/herkunft`; dazu die Probe aus Regel 6 |

### N4 (2026-11-21, Karte #227 S3): Phasen werden Spalten — Bestand berichtigt, eine gespeicherte Wahl mit Phasennamen, Restposten aus S2

**Anlass**: Technik von S3 klären (Director, Lauf 227-architekt-1). Stand `266ce20d` (Zweig `karte/224`, S2 gebaut und reviewt), Bestand `~/Projekte/Kanban-Boards/*` am 2026-11-21. Regel 3 entscheidet S3 im Kern (kein Lesen der Phasen-Datei, kein Nachtragen, kein `phasen` in Board und `bewegungen`, kein `PATCH phasen`, Berichte nur ohne Phasen). Offen waren drei Punkte, die Regel 3 nicht trifft.

**Belegt:**
- **Bestand berichtigt** („Negativ“ Punkt 3 und Begründung von po-entscheidungen Z. 499): Nicht alle 5 Boards bilden je Spalte genau eine Phase ab. JoinPuya legt `Bereit für Produktiv` und `Produktiv stellen` auf die Phase `Produktiv` (N:1). Außerdem verschiebt sich auf **jedem** gebundenen Board die Bedeutung eines Blocks: „Phase X durchlaufen“ heißt „in einer Spalte einer späteren Phase oder in der Abschlussspalte“, Spalten ohne Phase (`Nacharbeit`, `Auto-Reviews`) zählen nicht (`phasenRang` −1, `web/berichte.js:549–551`); „Spalte X erreicht“ heißt „X oder rechts davon“. Nur für den letzten Block sind beide gleich, denn die Abschlussspalte hat den Rang `folge.length`. Ohne gespeicherte Wahl bleiben deshalb Vorgabe von Burndown, Durchsatz und Fever Chart gleich, auch die Fieber-Caches ohne `ziel` (kanbanD, localchatA, Demo).
- **Gespeicherte Wahl mit einem Namen, der Phase und Spalte ist**: JoinPuya `fever: {target-column: Entwicklung}` (`boards/joinpuya.md:41`) mit Cache-Abschnitt `"ziel":"Entwicklung"` (`berichte/joinpuya-fieber.md:5`). Die Regel „eine Wahl, die es nicht mehr gibt, gilt als Vorgabe“ (ADR-0027 N5 Punkt 5) greift nicht, weil es die Spalte gibt. Aus „Entwicklung durchlaufen“ (= `Reviews` oder rechts, `Nacharbeit` nicht) wird ohne Hinweis „Entwicklung erreicht“ (auch `Nacharbeit`), und unter demselben Cache-Schlüssel stehen danach Tage mit zwei Bedeutungen — gegen Q4. Das tritt schon mit S2 ein, sobald das Register von JoinPuya ohne `wbs` gespeichert ist (PO Z. 499). „Erledigt heißt: Reviews“ ist ohne Phasen gleichbedeutend mit „Entwicklung durchlaufen“, auch in der Geschichte (beide rechnen mit der heutigen Spaltenfolge).
- **Restposten aus S2**: `Warnung.knoten`/`details` (`src/warnung.rs:10–16`) stehen nur noch als leere Listen „für ältere Leser“. Es gibt keinen Leser: die Oberfläche liest `w.text` (`web/ansicht.js:1077`), die Factory `text` (`werkzeuge/board.py:277`); der globale `kanband.py` des Gebundenen Modus ist entfernt.
- Außerhalb von kanbanD liest niemand `phasen`, `spaltenphasen` oder `uebersprungen` (Factory `werkzeuge/`, `tests/`; `~/.claude/commands`, gesucht 2026-11-21). `/anwendung wie-lange-noch` liest die Phasen-Datei selbst, nicht kanbanD.
- `phases.skipped` der 2 JoinPuya-Aufgaben nennt `Code-Review`, `Security-Review` — Phasen, die es in der Folge nicht gibt; ohne Wirkung schon heute.

**Varianten für die gespeicherte Wahl:**

| Variante | Stärke | Schwäche |
|---|---|---|
| **A** kanbanD tut nichts; die Wahl wird **einmal als Datenpflege** umgestellt, sobald das Board keine Phasen mehr hat (Einrichten „Erledigt heißt“ bzw. API, ein Commit im JoinPuya-Ordner) | kein Code, keine Migration, kein ungefragter Commit (Regel 2); neuer Cache-Schlüssel, der Verlauf wird aus Git einheitlich neu gerechnet | braucht eine Handlung außerhalb des Codes zur richtigen Zeit (vorher hieße „Reviews“ noch „Reviews durchlaufen“); der alte Abschnitt bleibt ungenutzt in der Datei |
| **B** hinnehmen | nichts zu tun | still andere Bedeutung und ein Knick unter demselben Schlüssel (Q4) |
| **C** Schlüsselversion `v: 3` in `fieberSchluessel` | jeder Cache rechnet einheitlich neu | verwirft den gespeicherten Verlauf aller Boards, obwohl er ohne Wahl gleich bleibt (genau das schützt ADR-0027 N5 Punkt 6); die Bedeutung verschiebt sich trotzdem |
| **D** beim Lesen eine Wahl übersetzen, solange `column-phases` in der Datei steht | wirkt ohne Handlung | hält Phasenlogik am Leben (gegen Regel 3) und endet mit dem nächsten Schreiben des Boards |

**Gewählt: A.** Welche Bedeutung JoinPuya behält („Reviews“ = wie bisher, oder Vorgabe), ist eine Produktfrage an den product-owner; technisch gilt: kanbanD übersetzt keine Wahl.

**Regeln für S3** (ergänzen Regel 3):
1. **Entfällt**: `src/phasen.rs` und `src/dienst/phasen.rs` ganz bis auf den Typ der Board-Antwort, der `board` und `hinweise` (unbekannte Eigentümer) behält und `phasen` verliert. Damit entfallen das Lesen der Phasen-Datei neben `a.wbs` (`:57–58`, der letzte Dateizugriff im Arbeits-Repository) und das Nachtragen mit eigenem Commit. Weiter entfallen `Spalte.phase` mit Lesen und Schreiben von `column-phases` (`src/format/board.rs`, `src/modell/board.rs`), `Phasenangaben`/`PHASEN` (`phases` wird unbekannter Schlüssel nach Regel 2), `Phasenaenderung` sowie `Bewegungen.phasen`, `Phasenkarte` und `Bewegung.uebersprungen` (`src/verlauf.rs`, `src/dienst/verlauf.rs`). In `web/berichte.js` entfallen `phasenRang`, `phasenSchwelle`, `phasenStufen` und jeder Zweig `art === 'phase'`/`istPhase`/`nachPhasen`. In der Oberfläche entfallen das Phasen-Feld im Aufgabenfenster (`vPhasenFeld`, Aktion `phase-entfaellt`), die Leiste `#phasen-hinweis` und der Phasen-Wortlaut von „Wie lange noch“ („durchlaufen“). Zuletzt entfallen `Warnung.knoten`/`details` (Restposten des Katalogs aus Regel 4).
2. **Mitgeschicktes `phasen`** in `PATCH /api/aufgaben/{nr}` wird überlesen: 200, keine Änderung, kein Commit (wie `PUT` mit `wbs` in N2).
3. **Kein Commit durch Lesen**: Nach S3 erzeugt kein `GET` einen Commit. `column-phases` bleibt in der Datei, bis eine Aktion das Board ohnehin schreibt (Regel 2, PO Z. 432); `tests/akzeptanz_r00222.rs:468` („Phasen bleiben bis S3“) kehrt sich um.
4. **Bleibt**: der Lese-Rückfall `Anwendung.wbs`/`anforderungen` und `Quellen.wbs`/`anforderungen`, aber nur als Startordner der Wurzel (Regel 1, für `kd:<hash>` in Registern in Altform; JoinPuya ist heute so eines). Nach S3 ist `startordner()` sein einziger Leser. Ebenso bleiben das Textfeld `phase` der Durchläufe und die Bindung `applications` ohne eigene Wirkung.
5. **Durchsetzung**: Probe der Karte (Board mit und ohne `column-phases` → gleiche `bewegungen`, kein `phasen`, kein Commit beim Lesen). Legacy-Probe gegen `266ce20d` auf einer Kopie von JoinPuya: `fieberTag` ohne Wahl ist an drei Tagen vor und nach gleich, die Datei `berichte/*-fieber.md` eines Boards ohne Wahl ändert ihren Schlüssel nicht. Prüfpunkt des architektur-reviewer: `grep -rniE 'phasen|column-phases|spaltenphasen|uebersprungen' src web` trifft nur noch Durchläufe, Kommentare mit Verweis auf diese ADR und das Wort „Speicherphase“.

**Inkauf**: Die Berichte gebundener Boards zeigen nach S3 je Spalte einen Block statt je Phase einen (bei JoinPuya zehn statt fünf); die Bedeutung jedes Blocks außer dem letzten verschiebt sich wie oben belegt. Das hat der product-owner in Z. 499 hingenommen; der berichtigte Bestand ändert daran nur die Begründung, nicht das Ergebnis.

## Quellen / Bezüge

- Vision `Anforderungen/R00000-vision.md` (ab11f96a), po-entscheidungen Z. 362, 426–429
- `src/git/arbeitsrepo.rs:143–163`, `src/format/einstellungen.rs`, `src/format/aufgabe.rs:11–31`, `:96`, `:526–535`, `src/format/board.rs:14–15`, `:303–355`, `src/dienst/phasen.rs`, `src/pruefungen.rs`, `web/ansicht.js:781–790`
- Factory `werkzeuge/board_binden.py`, `werkzeuge/karten_aus_wbs.py`, `tests/test_auftrag.py`; `~/.claude/commands/testen/_testen.md` „Gebundener Modus“, `kanband.py`
- ADR-0027, ADR-0028, ADR-0031, ADR-0032
