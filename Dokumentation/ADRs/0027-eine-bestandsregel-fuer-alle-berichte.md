# ADR-0027: Eine Bestandsregel für alle Berichte — „zählt am Tag“ an einer Stelle in `web/berichte.js`, Archivtag aus der Aufgabe

**Status**: Akzeptiert
**Datum**: 2026-11-15
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #155)
**Kontext-Anforderung**: — (Karte #155 „Bug: Burndown und Kumulativer Fluss zählen außerhalb der Abschlussspalte archivierte Aufgaben weiter als offen“; Anforderung und WBS-Knoten folgen über den planer). Bezug: R00023, R00044, R00046, R00121, R00122, R00081
**Erprobt durch**: Probe 2026-11-15 gegen `web/berichte.js` (Stand `karte/155`, 7 Aufgaben, Skript in der Ablage des Auftrags, nicht committet) — Ergebnis unter „Probe“; getragen von der bestehenden Systemantwort `web/berichte.js:475` („Wie lange noch“)
**Nachträge**: N6 (2026-11-17, Karte #197) „Selbsterzeugt =“ als `fever.self-labels` · N1 (2026-11-15, Karte #154) Zugang und Abgang je Tag als Zustandsübergänge · N2 (2026-11-16, Karte #156) „Erledigt heißt“ je Board: Schlüssel bleibt `fever.target-column`, die Zielspalte ist Parameter je Bericht · N5 (2026-11-16, Karte #159) Kumulativer Fluss und Durchlaufzeit bekommen das Ziel ebenfalls als Parameter; eine Regel für die ausgeschlossene Abschlussspalte (N3 und N4 siehe unten)

## Kontext

- **Anlass**: Eine außerhalb der Abschlussspalte archivierte Aufgabe („verworfen“) zählt im Burndown und im Kumulativen Fluss weiter als offen; „Wie lange noch“ nimmt sie ab dem Archivtag aus dem Umfang. Zwei Berichte nennen am selben Tag verschiedene Zahlen offener Aufgaben.
- **Belegt (Code)**:
  - Archivieren schreibt nur `archived: <heute>` in die Aufgabendatei; die Board-Zeile bleibt (`src/dienst/archiv.rs:7`, `:21`).
  - Die Verlaufsstrecke rechnet Wechsel allein aus Board-Ständen (`src/verlauf.rs:78–86`, `zuege` ab `:90`); `Bewegung` trägt `wechsel`, `labels`, `uebersprungen`, `reporting` — **keinen Archivstand** (`src/verlauf.rs:50–58`, befüllt in `src/dienst/verlauf.rs:65–76`).
  - „Vom Board genommen“ und „endgültig gelöscht“ (ADR-0024: Board-Zeilen und Datei in einem Commit) ergeben einen Wechsel mit `spalte: null`; `spalteAm` liefert ab dann `null` (`web/berichte.js:106–110`).
  - Der Archivtag kommt aus dem **Client**: `aufgabeZu(nr).archiviert` aus der Aufgabenliste (`web/ansicht.js:585`), also das **heutige** Frontmatter, tagesgenau.
  - Die Regel „verworfen“ steht heute genau einmal, eingebettet in die Prognose (`web/berichte.js:473–475`). Burndown (`:131`, `:153–159`) und Fluss (`:188–195`) fragen nur `spalte != null`.
  - Durchsatz und Durchlaufzeit rechnen aus dem **ersten Erreichen** (`:259`, `:313`, `:323–326`), „angekommen“/„fertig“ im Fluss ebenso (`:181`, `:196–198`) — Ereignisse, kein Bestand.
- **Was folgt**: #154 (Burndown: Zugang und Abgang je Tag, Zielspalte wählbar), #156 („Erledigt heißt“ je Board), #157 (Durchsatz: Von-Spalte wählbar) fassen dieselben Schleifen an und brauchen „entfernt“ und „erledigt“ als Größen.

### Probe (2026-11-15)

Sieben Aufgaben ab 02.11., am 06.11.: #3 in „Eingang“ archiviert, #4 in „Fertig“ archiviert, #5 offen gelöscht, #6 erledigt gelöscht, #7 vom Board genommen; #1 offen, #2 erledigt.

| Bericht (10.11., ohne Filter) | Ist | nach dieser Regel |
|---|---|---|
| Burndown offen / Umfang | 2 / 4 | 1 / 3 |
| Kumulativer Fluss offen / gesamt · angekommen · fertig | 2 / 4 · 7 · 3 | 1 / 3 · 7 · 3 |
| „Wie lange noch“ offen / Umfang | 1 / 3 | 1 / 3 |
| Durchsatz gesamt | 3 | 3 |

- Der Fehler der Karte trifft **auch im Kumulativen Fluss** zu (geprobt, nicht mehr vermutet).
- Gelöscht und vom Board genommen fallen in Burndown, Fluss und Prognose ab dem Tag aus dem Bestand; der Durchsatz zählt die erledigt gelöschte Aufgabe weiter.
- **Mit Personen- oder Label-Filter** verschwindet eine gelöschte Aufgabe **rückwirkend** aus allen Tagen und aus dem Durchsatz (Burndown 02.11.: 5 statt 7, Durchsatz 2 statt 3): ohne Datei kennt `aufgabePasst` weder Person noch Label (`web/berichte.js:32–39`).

### Qualitätsziele und Szenarien

- **Eine Zahl je Tag**: Burndown, Kumulativer Fluss und „Wie lange noch“ nennen für denselben Tag und Filter dieselbe Zahl offener Aufgaben (Abnahme der Karte).
- **Vergangenheit bleibt**: die Tage vor dem Archivtag ändern sich nicht.
- **Lastprofil**: lesend p95 < 200 ms bei 5.000 Aufgaben (4.000 archiviert) — die Regel darf den Bewegungs-Abruf nicht verteuern.
- **Änderbarkeit**: #154/#156/#157 ändern „erledigt“ und ergänzen „entfernt“ an **einer** Stelle.

## Optionen

### Option A: Die zwei Stellen angleichen (Bedingung aus `:475` nach Burndown und Fluss kopieren)

- Stärke: kleinster Eingriff, kein neuer Name.
- Schwäche: die Regel steht dreimal; #156 muss „außerhalb der Abschlussspalte“ an drei Stellen auf die gewählte Zielspalte umstellen — derselbe Drift, der diesen Bug erzeugt hat.

### Option B: Eine reine Bestandsfunktion im Client, Archivtag aus der Aufgabenliste (gewählt)

- Stärke: eine Stelle, ein Unit-Test; kein Server- und kein API-Eingriff; „erledigt“ ist ein Parameter, den #156 nur noch setzt; „entfernt“ für #154 fällt als Unterscheidung an derselben Stelle an.
- Schwäche: der Archivtag ist das heutige Frontmatter — Zurückholen macht die archivierten Tage rückwirkend wieder zu „offen“, mehrfaches Archivieren kennt nur den letzten Tag.

### Option C: Archivstand in die Verlaufsstrecke (Server liefert Archiv-Wechsel je Aufgabe aus den Git-Ständen der Aufgabendatei, wie `kartenverlauf`, ADR-0021)

- Stärke: geschichtstreu, auch nach Zurückholen; die Berichte hängen nicht mehr an der Aufgabenliste des Clients; gelöschte Aufgaben behielten ihre Merkmale.
- Schwäche: `git`-Stände je Aufgabendatei statt je Board-Datei — bei 5.000 Aufgaben gegen p95 < 200 ms unvermessen und vermutlich zu teuer ohne Cache; ändert den Vertrag von `GET /api/bewegungen`. Für die Abnahme von #155 nicht nötig.

## Entscheidung

**Gewählt: Option B.** Die Regel ist die, die „Wie lange noch“ schon fährt; sie wird herausgelöst und von allen Bestandsberichten benutzt.

### Regeln

1. **Eine Bestandsfunktion** in `web/berichte.js`, rein, neben `spalteAm`: aus `(wechsel, archiviert, t, erledigtSpalten)` wird der Zustand der Aufgabe am Zeitpunkt `t`:
   - `spalteAm(wechsel, t) == null` → **nicht da** (nie auf dem Board, vom Board genommen, gelöscht);
   - `archiviert` gesetzt, `t ≥` Beginn des Archivtags, Spalte **nicht** in `erledigtSpalten` → **entfernt** (verworfen), zählt weder in „offen“ noch in „Umfang“/„gesamt“ noch in einem Band;
   - sonst **da** in ihrer Spalte, **erledigt** genau dann, wenn die Spalte in `erledigtSpalten` liegt. Archiviert in einer Erledigt-Spalte bleibt erledigt.
2. **Bestandsgrößen** (Burndown offen/Umfang, Fluss-Bänder/offen/gesamt, Prognose Umfang/offen) lesen nur diese Funktion. Die eingebettete Bedingung in `:475` geht darin auf; keine zweite Fassung.
3. **Ereignisgrößen** (Durchsatz, Durchlaufzeit, Fluss „angekommen“/„fertig“) rechnen aus dem ersten Erreichen und fallen durch späteres Archivieren, Abnehmen oder Löschen **nicht** (R00023; „angekommen sinkt nicht“).
4. **`erledigtSpalten` ist Parameter**, heute `[letzte Spalte]`; #156 setzt ihn, ohne die Regel anzufassen. „Entfernt“ unterscheidet die Funktion schon von „nicht da“; #154 zählt daraus den Abgang je Tag.
5. **Filter bleiben außerhalb**: `ohneSpalten`, `aufgabePasst`, `reporting` (R00060, R00081) wirken wie bisher vor bzw. nach der Bestandsfunktion.
6. **Archivtag bleibt Client-Wissen**: Quelle ist `archiviert` der Aufgabe aus der Aufgabenliste; `Bewegungen` und `GET /api/bewegungen` ändern sich nicht.

### Akzeptierte Schwächen

- Zurückgeholte Aufgaben zählen rückwirkend an allen Tagen wieder; nur der letzte Archivtag wirkt. In Kauf genommen, weil Zurückholen die Aussage „war verworfen“ fachlich zurücknimmt und die Abnahme nur „ab dem Archivtag“ verlangt.
- Der Archivtag gilt ab 0 Uhr, auch wenn später am Tag archiviert wurde (tagesgenaues Feld) — für Berichte je Tag ohne Wirkung.
- Eine gelöschte Aufgabe verliert Person, Label und Farbe; unter einem solchen Filter fehlt sie rückwirkend (siehe Probe). Bestehendes Verhalten, mit dieser ADR nicht geändert — Produktfrage, siehe „Offene Fragen“.

### Umkehrpunkt

Verlangt eine Anforderung geschichtstreue Abgänge (z. B. #154 soll den Abgang einer später zurückgeholten Aufgabe weiter zeigen) oder Merkmale gelöschter Aufgaben, wechselt nur die **Quelle** des Archivstands auf Option C (neue ADR, mit Messung gegen das Lastprofil); die Bestandsfunktion und ihre Aufrufer bleiben.

### Durchsetzung

- Unit-Test der Bestandsfunktion (`node --test`) mit den fünf Fällen der Probe; ein Test „gleiche Zahl offen“ über Burndown, Fluss und Prognose am selben Datensatz.
- Review-Punkt (`code-reviewer`, `architektur-reviewer`): in `web/berichte.js` liest außerhalb der Bestandsfunktion keine Bestandsgröße `archiviert` oder prüft `spalte != null` selbst.

## Konsequenzen

- Burndown und Kumulativer Fluss ändern ihre Zahlen ab dem Archivtag verworfener Aufgaben; frühere Tage bleiben.
- „Wie lange noch“ ändert sich nicht (Refactoring auf dieselbe Funktion, Tests bleiben grün).
- Kein Eingriff in Server, API, Dateiformat.
- #154, #156, #157 bauen auf Regel 3 und 4 auf.

## Offene Fragen

- (product-owner) Soll eine endgültig gelöschte Aufgabe unter einem Personen-, Label- oder Farbfilter aus vergangenen Tagen und aus dem Durchsatz verschwinden (heute so), oder soll die Vergangenheit bleiben? Das Zweite verlangt Option C.
- (product-owner) Genügt bei zurückgeholten Aufgaben „zählt rückwirkend wieder“, auch für den Abgang je Tag in #154?

## Quellen / Bezüge

- `web/berichte.js:106–110`, `:131`, `:144–164`, `:171–204`, `:298–318`, `:473–476`; `web/ansicht.js:585`
- `src/dienst/archiv.rs:7–28`, `src/verlauf.rs:50–110`, `src/dienst/verlauf.rs:65–76`
- ADR-0021 (Karten-Verlauf aus der Git-Geschichte), ADR-0024 (Aufgabe endgültig löschen)
- R00121 Zeile 37 („Zählen wie im Burndown … fällt ab diesem Tag aus dem Stapel“), R00046, R00023

## Nachträge

### N1 (2026-11-15, Karte #154): Zugang und Abgang je Tag sind Übergänge derselben Bestandsfunktion

Anlass: #154 zeigt im Burndown je Tag „+ hinzugekommen“, „− erledigt“, „− entfernt“; Abnahme ist die Bilanz offen(Tag) = offen(Vortag) + hinzugekommen − erledigt − entfernt (Entscheidung des product-owner, `AI-Team/po-entscheidungen.md` Z. 207, 211).

1. **Keine zweite Regel**: „offen“ einer Aufgabe zum Zeitpunkt `t` bleibt `imBestand(f, bestandAm(…, t))` und nicht erledigt. Ein Ereignis ist ein **Wechsel dieses Wertes** an einem Änderungspunkt der Aufgabe — den Zeitpunkten ihrer `wechsel` und dem Beginn ihres Archivtags —, nicht der Vergleich zweier Tagesenden. Damit zählt eine am selben Tag angelegte und erledigte Aufgabe in „+“ und in „− erledigt“, und die Bilanz geht an jedem Tag auf, weil Stand und Ereignisse aus derselben Funktion kommen.
2. **Einordnung des Übergangs**: nicht offen → offen ist „+“ (neu auf dem Board, aus einer ausgeschlossenen Spalte in eine gezählte, aus der Abschlussspalte zurück); offen → da und erledigt ist „− erledigt“; offen → alles andere (`entfernt`, `nichtDa`, ausgeschlossene Spalte) ist „− entfernt“. Übergänge zwischen zwei nicht offenen Zuständen (erledigt archiviert, erledigt vom Board genommen) sind kein Ereignis.
3. **Abgrenzung zu Regel 3**: Diese Tagesgrößen sind Übergänge des Bestands und dürfen bei Nacharbeit mehrfach zählen; Durchsatz, Durchlaufzeit und Fluss-Ränder bleiben beim ersten Erreichen. Die Summe „− erledigt“ kann deshalb über dem Durchsatz liegen (Legende).
4. **Filter und Quelle unverändert**: `aufgabePasst` und `reporting` wählen die Aufgaben, `ohneSpalten` wirkt über `imBestand`; `erledigtSpalten` bleibt Parameter (#156). Kein Eingriff in Server, API (`GET /api/berichte/bewegungen`) oder Dateiformat; es wird nichts gespeichert.
5. **Geerbte Schwächen** (aus „Akzeptierte Schwächen“): eine zurückgeholte Aufgabe verliert ihr „− entfernt“ rückwirkend; „− entfernt“ durch Archivieren steht am Archivtag ab 0 Uhr; eine am Archivtag erst angelegte oder direkt in der Abschlussspalte angelegte Aufgabe war nie offen und erzeugt kein Ereignis. Die zweite offene Frage unten ist damit für #154 mit „genügt“ beantwortet, bis eine Anforderung geschichtstreue Abgänge verlangt (Umkehrpunkt).
6. **Durchsetzung**: ein Unit-Test rechnet für einen Datensatz mit allen Übergängen aus Punkt 2 die Bilanz an jedem Tag nach; Review-Punkt wie oben — die Ereigniszählung liest `archiviert` und `spalte` nur über `bestandAm`.

### N2 (2026-11-16, Karte #156): „Erledigt heißt“ je Board — der Schlüssel bleibt, die Zielspalte ist Parameter je Bericht

Anlass: #156 lässt die Zielspalte des Fever Charts (R00079) auch für Burndown und Durchsatz gelten (Entscheidung des product-owner, `AI-Team/po-entscheidungen.md` Z. 208); offen war, ob der Schlüssel umzieht. Am Code gelesen (Stand `168cc10`), nichts gefahren.

1. **Der Schlüssel bleibt `fever: {target-column: …}`** (`src/format/board.rs:178`, `:264–265`; Modell `Fieber.zielspalte`, `src/modell/board.rs:188`, `:232`; API-Feld `fieber.zielspalte`, gespeichert über `PUT /api/boards/{slug}/fieber`, `src/dienst/fieber.rs:41–57`). Kein Eingriff in Dateiformat, Modell, Route oder Cache-Schlüssel (`fieberSchluessel`); bestehende Board-Dateien wirken ohne Handarbeit, und eine ältere kanbanD-Version liest und schreibt dieselbe Datei wie bisher. Nicht gewählt: ein neutraler Schlüssel — er verlangte Lesen aus zwei Quellen mit Vorrangregel, und eine ältere Version, die ihn nicht kennt, zeigte im Fever Chart eine andere Zielspalte als Burndown und Durchsatz der neuen (Vermutung, nicht geprobt: sie ließe ihn beim Schreiben auch fallen). Akzeptierte Schwäche: der Name sagt „fever“, obwohl der Wert für drei Berichte gilt; der Commit-Text „Fever Chart von … eingestellt … erledigt heißt …“ ebenso (Text, kein Schaden).
2. **Der Wert ist ein Blockschlüssel, keine Spalte**: aufgelöst wird er an einer Stelle wie im Fever Chart (`web/ansicht.js:1632–1635`: Block aus `fieberBloecke`, sonst der letzte Block und der Hinweis „gibt es nicht mehr“). Diese Auflösung wird aus `fieberStand` herausgelöst und von Burndown, Durchsatz und Fever Chart gemeinsam benutzt.
3. **Regel 4 wird eingelöst — als Parameter, nicht als globaler Wert**: `bestandLeser(bew, aufgabeZu)` (`web/berichte.js:137–138`) bekommt das Ziel als weiteren Parameter mit dem heutigen Wert (`erledigtSpalten(bew)`, `:131`, letzte Spalte) als Vorgabe. Nur `burndown` (`:201`) und sein `ausgenommen`-Aufruf (`web/ansicht.js:1241`) reichen das gewählte Ziel durch. `erledigtSpalten(bew)` selbst liest die Wahl **nie**: an ihr hängen auch Kumulativer Fluss (`:282`), „Wie lange noch“ und damit das Fever Chart (`:576`) und `ausgenommen` (`:189`) — eine Änderung dort verschöbe deren Zahlen (bis #159 rechnen sie wie heute).
4. **Ohne Phasen** ist „erledigt“ die Menge der Zielspalte und aller Spalten rechts davon; **mit Phasen** je Aufgabe die Spalten, für die die Stufe des gewählten Blocks `durch(a, spalte)` meldet (`phasenStufen`, `:467–474` — hängt an den Labels der Aufgabe). `bestandAm` (`:122`) bleibt unverändert und bekommt je Aufgabe ihre Liste.
5. **Ereignisse aus N1 folgen ohne eigene Regel**: `ereignisArt` (`:264–270`) liest nur `istOffen` und `erledigt` des Zustands. „− erledigt“ ist offen → Zielblock, ein Rückläufer aus dem Zielblock ist „+“, ein Zug innerhalb des Zielblocks (B → C → Erledigt bei Ziel B) ist kein Ereignis. Archiviert im Zielblock bleibt erledigt und ist kein „− entfernt“.
6. **Durchsatz** bleibt Ereignisgröße (Regel 3): `durchsatzZiel` (`:346–353`) bekommt den Block als Parameter (Spalte: ihr Index, `erreicht` zählt schon „dort oder rechts davon“; Phase: ihre Stufe), Vorgabe wie heute. Durchlaufzeit, Fluss-Ränder (`:287`) und Prognose bekommen ihn nicht.
7. **Akzeptierte Schwäche**: Mit einer gewählten Zielspalte nennt der Burndown weniger „offen“ als Kumulativer Fluss und „Wie lange noch“ — das Qualitätsziel „eine Zahl je Tag“ gilt bis #159 nur ohne Wahl; die Kopfleisten sagen, was jeweils zählt. Eine zwischen Zielspalte und Abschlussspalte archivierte Aufgabe ist im Burndown erledigt, im Fever Chart weiter aus dem Umfang genommen (dort unverändert).
8. **Durchsetzung**: ein Unit-Test rechnet Burndown, Durchsatz, Fluss, Durchlaufzeit und Prognose an einem Datensatz einmal ohne und einmal mit `zielspalte` am Board — ohne Wahl sind alle Ergebnisse gleich dem Stand vor der Karte, mit Wahl ändern sich nur Burndown und Durchsatz. Review-Punkt: `erledigtSpalten(bew)` und die Vorgabe von `bestandLeser` lesen weder `S.board` noch `fieber`.

### N3 (2026-11-16, Karte #157): „Von“ im Durchsatz — neuer Schlüssel `fever: {from-column: …}`, die Von-Spalte ist Parameter nur des Durchsatzes

Anlass: #157 gibt dem Durchsatz eine Auswahl „von“ und je Periode einen zweiten Balken „Zugang“ (Entscheidung des product-owner, `AI-Team/po-entscheidungen.md` Z. 209, 212); offen war der Speicherort. Am Code gelesen (Stand `13f7409`), nichts gefahren.

1. **Speicherort: `fever: {from-column: <Blockschlüssel>}` neben `target-column`**; Modell `Fieber.vonspalte: Option<String>` mit `#[serde(default)]`, API-Feld `fieber.vonspalte`, gespeichert über dieselbe Route `PUT /api/boards/{slug}/fieber`. Fehlt der Schlüssel, gilt der erste Block; `None` wird nicht geschrieben, Board-Dateien ohne Wahl bleiben zeichengleich. Grund: die Von-Wahl bildet mit der Zielspalte eine Strecke, und der Client schickt schon das ganze Objekt (`web/app.js:1865` kopiert `b.fieber` und ändert ein Feld) — das neue Feld läuft durch jede Einstellung des Fever Charts unverändert mit, ohne zweite Route und ohne zweiten Schreibweg.
2. **Ältere Version — belegt, kein Unterschied zwischen den Orten**: `fieber_lesen` (`src/format/board.rs:147–184`) liest nur bekannte Schlüssel und meldet einen unbekannten nicht als Fehler; die Datei bleibt also lesbar. `schreiben` (`:286 ff.`) und der `fever`-Teil (`:245–267`) bauen das Frontmatter aber vollständig aus dem Modell — roh erhalten wird allein `column-owner` (`:20–27`). Eine ältere Version lässt deshalb **jeden** unbekannten Schlüssel beim nächsten Schreiben der Board-Datei fallen (jeder Zug einer Karte schreibt sie), gleich ob er in `fever` oder auf oberster Ebene steht; ebenso verwirft ihr `PUT …/fieber` ein unbekanntes JSON-Feld (`Fieber` ohne `deny_unknown_fields`, `src/modell/board.rs:174–192`). Kein Speicherort schützt davor; gewählt ist darum der mit dem kleinsten Eingriff. **Akzeptierte Schwäche**: wer denselben Board-Ordner mit einer älteren kanbanD-Version beschreibt, verliert die Von-Wahl still (Rückfall auf die Vorgabe, keine falsche Zahl der älteren Version, kein Schaden an anderen Schlüsseln). Nicht gewählt: eigener Schlüssel auf oberster Ebene mit eigener Route — gleicher Verlust, mehr Code; `report-filter` — die Von-Wahl ist kein Filter und gälte dem Namen nach für alle Berichte.
3. **Server prüft nur die Form**: getrimmt, ein leerer Name ist ungültig (wie `zielspalte`, `src/dienst/fieber.rs:43`, `src/modell/board.rs:232`). „Von liegt links vom Ziel“ prüft der Server **nicht**: der Wert ist wie die Zielspalte ein Blockschlüssel, den der Client unter Filter und Phasen auflöst, und Umbenennen oder Löschen einer Spalte macht jede beim Speichern gültige Wahl nachträglich ungültig — die Lesestelle muss den Fall ohnehin tragen. Der Commit-Text nennt die Von-Wahl, wenn sie gesetzt ist.
4. **Auflösung an einer Stelle im Client**, getrennt von `zielblock()` (`web/berichte.js:669`): Blockliste aus `fieberBloecke`, Vorgabe erster Block; eine Wahl, die es nicht mehr gibt, fällt auf die Vorgabe mit dem Hinweis „gibt es nicht mehr“; eine Wahl, die nicht links vom Zielblock liegt, ergibt den Hinweis der Durchlaufzeit („von“ muss links von „bis“ liegen, `web/ansicht.js:1548`) und **keinen** Zugangsbalken — der Abgang bleibt stehen. `zielblock()`, `durchsatzZiel()` ohne Parameter und `fieberSchluessel` (`:686`) lesen `vonspalte` nie; an ihnen hängen Fever Chart (samt Cache) und Burndown.
5. **Zugang ist Ereignisgröße nach Regel 3, nicht „+“ aus N1**: je Aufgabe einmal, zum Zeitpunkt des ersten Erreichens der ersten Spalte des Von-Blocks oder einer Spalte rechts davon (`erreicht`, `:443`); Rückläufer zählen nicht erneut. „+ hinzugekommen“ des Burndowns bleibt ein Übergang des Bestands (nicht offen → offen) und zählt bei Nacharbeit mehrfach — die Summen beider Berichte dürfen abweichen, die Legende des Durchsatzes sagt „erstmals“. Zeitfenster, `aufgabePasst`, `zaehltImBericht(a, 'forecast')` und „Rechnen ab“ wirken auf Zugang wie auf Abgang. `durchsatz()` (`:418`) bekommt den Von-Block als weiteren Parameter mit Vorgabe `null`; `anzahl`, `gesamt`, `durchschnitt` bleiben der Abgang, der Zugang kommt in eigenen Feldern dazu.
6. **Durchsetzung**: der Unit-Test aus N2 Punkt 8 wird um `vonspalte` erweitert — mit Von-Wahl am Board ändern sich allein die Zugangsfelder des Durchsatzes; Abgang, Burndown, Fluss, Durchlaufzeit, Prognose und der Cache-Schlüssel des Fever Charts sind gleich dem Stand vor der Karte. Ein Rust-Test liest eine Board-Datei ohne `from-column` und schreibt sie zeichengleich zurück; einer mit `from-column` übersteht Lesen, eine fremde Aktion (Karte ziehen) und `PUT …/fieber` mit geänderter Auflösung.

### N4 (2026-11-16, Karte #158): Hinweis „Zugang Ø / Abgang Ø“ in „Wie lange noch“ — Abgang ist der Durchsatz der Prognose, Zugang die Übergänge aus N1 abzüglich „entfernt“

Anlass: #158 stellt neben die Prognose je Block die Zeile „Zugang Ø x, Abgang Ø y“ und bei Zugang ≥ Abgang „kein Ende absehbar“; die Karte sagt „gezählt wie im Burndown“. Am Code gelesen (Stand `7eb6f30`), nichts gefahren.

1. **Abgang Ø ist `durchsatz` des Blocks aus `prognoseRechnen`** (`web/berichte.js:609–613`: erstes Erreichen des Blocks in der Messbasis ÷ Tage von `fenster` bis heute) — dieselbe Zahl wie „Durchsatz Ø“ im Block, nicht „− erledigt“ des Burndowns. Grund: der Hinweis beurteilt die Prognose und muss mit dem rechnen, woraus sie zieht (gleiche Tage, gleicher Block, `reporting.forecast`, erstes Erreichen); `burndown()` selbst passt nicht — es liest den Kalenderzeitraum des Filters, `reporting.burndown` und zählt Nacharbeit mehrfach.
2. **Zugang Ø sind die Übergänge „+ hinzugekommen“ minus „− entfernt“ aus N1** (`ereignisseJeTag`, `ereignisArt`) über **dieselben Tage** (`fenster` bis heute, Nulltage eingeschlossen), nie unter 0, gezählt an den Aufgaben der Prognose (`aufgabePasst`, `zaehltImBericht(a, 'forecast')`, ohne `entfaellt` des Blocks) mit dem Block als Ziel (`bestandLeser(bew, aufgabeZu, erledigtAb(bew, schluessel))`, N2 Punkt 3 — heute im letzten Block die Abschlussspalte; #159 ändert nur, welcher Block gilt). „Entfernt“ mindert den Zugang und zählt nicht zum Abgang: was dazukam und verworfen wurde, lässt den Rest nicht wachsen, und die Prognose zieht nicht daraus — als Abgang stünde neben „Durchsatz Ø“ eine zweite, größere Zahl.
3. **Vergleich an den Summen** (Zugang ≥ Läufe bei gleichem Nenner), nicht an den gerundeten Mitteln. Beide Zeilen nur in Blöcken mit Prognose (`zeilen`); unter `MIN_LAEUFE` oder ohne Offenes bleibt es beim bestehenden Satz „keine Prognose …“.
4. **Trennstelle**: Die Zugangssumme ist ein zusätzliches Feld je Block; `offen`, Tagesreihen, Ziehungen, Perzentile und der Schlüssel von `gemerkt` bleiben unberührt. Mit `nurLetzter` (Fever Chart, je Tag ein Aufruf) wird sie nicht gerechnet. Keine Simulation mit Zugang; kein Eingriff in Server, API oder Dateiformat.
5. **Akzeptierte Schwäche**: Ein Rückläufer zählt als Zugang, sein zweites Erreichen nicht als Abgang (erstes Erreichen, Regel 3); in Zwischenblöcken zählt eine später verworfene Aufgabe im Zugang, aber nicht mehr im Durchsatz. Der Hinweis irrt dann zur warnenden Seite — er kann „kein Ende absehbar“ sagen, obwohl der Rest nicht wächst, nie das Umgekehrte verschweigen.
6. **Durchsetzung**: ein Unit-Test rechnet die Prognose an einem Datensatz mit Zugang, Verworfenem und Rückläufer und vergleicht `zeilen`, `reihe7`, `durchsatz` mit dem Stand vor der Karte (gleich) sowie die Zugangssumme mit der Handrechnung.

### N5 (2026-11-16, Karte #159): Kumulativer Fluss und Durchlaufzeit folgen „Erledigt heißt“ — jeder Bericht bekommt sein Ziel als Parameter; eine Regel für die ausgeschlossene Abschlussspalte

Anlass: #159 löst die akzeptierte Schwäche aus N2 Punkt 7 für den Kumulativen Fluss ein und gibt der Durchlaufzeit die Zielspalte als Vorgabe für „bis“ (Entscheidung des product-owner, `AI-Team/po-entscheidungen.md` Z. 212); der Kommentar aus dem Code-Review von #156 (ausgeschlossene Abschlussspalte) wird mit gerichtet. Am Code gelesen (Stand `5310a1a`), nichts gefahren. Die Nummer N4 ist für Karte #158 vergeben; deshalb N5.

1. **Umfang**: Dem Ziel folgen danach Burndown, Durchsatz, Fever Chart (N2), **Kumulativer Fluss** („offen“ und „fertig“) und die **Vorgabe „bis“ der Durchlaufzeit**. „Wie lange noch“ bleibt unverändert (Karte, Abgrenzung: „zeigt schon heute je Spalte ‚offen‘ und Durchsatz und bleibt unverändert“) — sie rechnet jeden Block, ein Ziel gibt es dort nicht.
2. **Kumulativer Fluss**: `fluss()` (`web/berichte.js:290`) bekommt `zielblock = null` wie `burndown` (`:212`) und reicht `erledigtAb(bew, zielblock)` (`:152`) an `bestandLeser` (`:294`); „offen“ kommt damit aus derselben Funktion wie im Burndown. „fertig“ (`:299`, heute `w.spalte === abschluss`) ist das erste Erreichen einer Spalte aus derselben Liste je Aufgabe (ohne Ziel `erledigtSpalten(bew)`), bleibt Ereignisgröße nach Regel 3 und sinkt nicht. Bänder, „gesamt“ und „angekommen“ lesen das Ziel nicht. Der `ausgenommen`-Aufruf des Flusses (`web/ansicht.js:1323`) reicht das Ziel durch wie der des Burndowns.
3. **Durchlaufzeit**: `durchlaufzeiten()` (`:452`) hat „von“ und „bis“ schon als Parameter und ändert sich nicht. Nur die **Vorgabe** in `vDurchlauf` (`web/ansicht.js:1585`) wechselt: ohne eigene Wahl ist „bis“ die erste Spalte des Zielblocks aus `zielblock()`, „von“ die erste Spalte des Von-Blocks, sobald es `fieber.vonspalte` gibt (N3), sonst die erste Spalte. Eine abweichende Wahl bleibt möglich und wird **am Gerät je Board** gemerkt (`localStorage`, wie `kanbanD.spalten-zu.<slug>`, `web/app.js:129–138`; heute nur `S.ui`, `web/app.js:2440`); gleicht sie der Vorgabe, wird nichts gemerkt und der Bericht folgt dem Board weiter. Kein neuer Schlüssel in der Board-Datei: die boardweite Aussage ist die Zielspalte selbst, die Abweichung eine Sicht des Betrachters; Dateiformat, Modell und API bleiben.
4. **Phasen-Boards**: Für den Fluss gilt dieselbe Regel wie für den Burndown seit N2 Punkt 4 — „erledigt“ und „fertig“ je Aufgabe über `durch(a, spalte)` der gewählten Stufe (`phasenStufen`, `:483–490`). Die Durchlaufzeit misst von Spalte zu Spalte (R00045); ihre Vorgabe „bis“ ist dort die erste Spalte, die die gewählte Stufe für eine Aufgabe **ohne** Labels als durchlaufen meldet. Akzeptierte Schwäche: für Aufgaben mit eingebetteter Phase liegt das Ziel des Burndowns eine Spalte früher als dieses „bis“.
5. **Eine Regel für „ohne Wahl“** (auch für eine Wahl, die es nicht mehr gibt): Es zählt die Abschlussspalte bzw. die letzte Phase; **ist die Abschlussspalte im Berichtsfilter ausgeschlossen, zählt der letzte sichtbare Block, als wäre er gewählt** — genau der, den die Auswahl als „(Standard)“ zeigt. Aufgelöst wird das allein in `zielblock()` (`:669`): `gewaehlt`, `standard` und `worte` nennen dann diesen Block. Dadurch ändern sich gegenüber heute **nur in diesem Fall**: Burndown und Fluss zählen Aufgaben im letzten sichtbaren Block als erledigt statt offen, ihr Erreichen ist „− erledigt“ bzw. „fertig“ (heute: der Zug in die ausgeschlossene Abschlussspalte als „− entfernt“ bzw. „fertig“); der Durchsatz zählt das erste Erreichen dieses Blocks statt „ausgeschlossen“ zu melden. Das Fever Chart rechnet schon so und ändert sich nicht. Auf Phasen-Boards wirkt der Filter nicht auf die Blöcke; dort bleibt die Meldung „ausgeschlossen“ des Durchsatzes.
6. **Trennstelle**: `erledigtSpalten(bew)` (`:131`) ist nur noch die Vorgabe „kein Ziel übergeben“ und liest die Wahl nie. Das Ziel bekommen als Parameter `burndown`, `ausgenommen`, `durchsatz`/`durchsatzZiel`, `fluss` und (über „bis“) `durchlaufzeiten`. **Nicht** folgen: `prognoseRechnen` samt Schlüssel von `gemerkt` (`:575`, `:583`), `fieberTag` und `fieberSchluessel` (`:686`) — der Cache-Schlüssel liest weiter die **gespeicherte** Wahl (`block`, `web/ansicht.js:1726`), nie den nach Punkt 5 aufgelösten Block; sonst wechselte er im Fall aus Punkt 5 und der gespeicherte Verlauf würde neu gerechnet.
7. **Was danach an jedem Tag gilt** (gleicher Filter, gleiches Ziel): Burndown „offen“ = Fluss „offen“ und Burndown „Umfang“ = Fluss „gesamt“; ohne Phasen ist Fluss „offen“ die Summe der Bänder links des Zielblocks. „fertig“ ist keine Bestandsgröße und geht in diese Gleichung nicht ein.
8. **Durchsetzung**: Der Unit-Test aus N2 Punkt 8 wird umgestellt — ohne Wahl sind alle Ergebnisse gleich dem Stand vor der Karte; mit Wahl ändern sich Burndown, Durchsatz und Fluss („offen“, „fertig“), nicht Bänder, „gesamt“, „angekommen“, Prognose und `fieberSchluessel`; die Gleichung aus Punkt 7 wird an jedem Tag eines Datensatzes mit Rückläufer und Verworfenem nachgerechnet, einmal mit Phasen. Ein Test für Punkt 5 (Abschlussspalte ausgeschlossen, nichts gewählt). Review-Punkt (`code-reviewer`, `architektur-reviewer`): außerhalb von `zielblock()` liest keine Berichtsfunktion `S.board.fieber`; `erledigtSpalten(bew)` und `fieberSchluessel` lesen den aufgelösten Block nicht.
9. **Berichtigung (2026-11-16, Code-Review und Bau von #159)** — gilt vor den Punkten 2, 5, 7 und 8, wo sie widersprechen: (a) „Bänder und ‚gesamt‘ lesen das Ziel nicht“ (Punkte 2, 8) stimmt mit einer Ausnahme nicht. Eine Aufgabe, die in einer Spalte des Zielblocks links der Abschlussspalte archiviert ist, gilt mit gewähltem Ziel als erledigt statt verworfen (Regel 1, N2 Punkt 5) und bleibt deshalb in ihrem Band und in „gesamt“; nur so gilt die Gleichung aus Punkt 7 (Burndown „Umfang“ = Fluss „gesamt“ — der Burndown zählt sie seit N2 im Umfang). Entschieden: die Gleichung geht vor, die Rechnung bleibt; „angekommen“ liest das Ziel weiterhin nicht. Festgehalten im Test „R00169 (Code-Review B1)“ in `e2e/einheit/r00169-zielspalte-fluss.test.js`. (b) Punkt 5 nennt den Zug in die ausgeschlossene Abschlussspalte „heute ‚− entfernt‘“ — am Code war er schon vor der Karte „− erledigt“ (`ereignisArt` fragt den Zustand der Aufgabe, nicht den Filter); im Randfall ändert sich daran nichts, neu ist dort nur, dass schon das Erreichen des letzten sichtbaren Blocks zählt.

### N6 (2026-11-17, Karte #197): „Selbsterzeugt =“ — Schlüssel `fever: {self-labels: [...]}`, eine Auswahl von Labels je Board

Der Schlüssel steht neben `target-column` und `from-column` unter `fever:` (Modell `Fieber.selbstlabels: Vec<String>`, `#[serde(default)]`, API-Feld `fieber.selbstlabels`, Route `PUT /api/boards/{slug}/fieber`); ein eigener Schlüssel `burndown:` auf oberster Ebene mit eigener Route ist wie in N3 Punkt 2 verworfen. Ohne Wahl wird nichts geschrieben (Datei zeichengleich), ein leerer Name in der Liste ist ungültig, und eine ältere Version verliert den Schlüssel beim nächsten Schreiben wie bei `from-column` (N3 Punkt 2). Die Zahl rechnet allein der Burndown aus der Ereignisfunktion `ereignisseJeTag` (Teilmenge von „+“, disjunkt zu „davon zurückgekommen“ aus R00192) mit den **heutigen** Labels der Aufgabe.
