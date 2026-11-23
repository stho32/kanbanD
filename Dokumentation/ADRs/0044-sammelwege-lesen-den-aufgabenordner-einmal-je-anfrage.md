# ADR-0044: Sammelwege lesen den Aufgabenordner einmal je Anfrage — Verzeichnis der Dateinamen unter der Sperre, Grenze je Sammelanfrage

**Status**: Akzeptiert (E1, E3). E2 (Grenze je Sammelanfrage) Vorgeschlagen — Höhe und Wortlaut fragt der Bericht beim product-owner an; bis zur Antwort gilt die Empfehlung (5.000 Einträge, 400).
**Datum**: 2026-11-23
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #241, Lauf 241-architekt-1)
**Kontext-Anforderung**: — (Karte #241, Bug, Labels `bug`, `sicherheit`, `leistung`; Befund des security-reviewer aus Lauf 228-security-reviewer-2). Bezug: ADR-0004 (Suche unter der Sperre, kein Index), #131 (`aufgabenpfad` liest nur Dateinamen), R00123/B0573 (Pfadregel), R00214 (Kreisprüfung im Sammelweg)
**Erprobt durch**: — (am Code gelesen, Stand `a2def01a`; keine Lastprobe, die läuft nur auf Ansage des Betreibers)

## Kontext

**Belegt (Code, `a2def01a`)**:

- `Kanban::mehrere_aendern` (`src/dienst/aufgabe_aendern.rs:50`) nimmt `gesperrt()` (`:56`) und ruft in der Schleife je Änderung `self.ordner().aufgabe(nummer)` (`:64`).
- `Ordner::aufgabe` (`src/ablage.rs:165`) ruft `aufgabenpfad` (`:139`), und das listet bei jedem Aufruf den ganzen Ordner `aufgaben/` über `markdown_dateien` (`read_dir`, Sortierung). Bei n Änderungen und m Dateien kostet das n × m unter der Sperre. Die Probe `titel only` mit n ≈ m ≈ 4.000 braucht heute 18 s, und ein fremder PATCH wartet 12–15 s (Karte #241).
- **Dasselbe Muster** steckt in jeder Schleife über `ordner().aufgabe(nr)` unter der Sperre:
  - `mehrere_archivieren` (`src/dienst/archiv.rs:122`), also `POST /api/aufgaben/archivieren` und `…/zurueckholen`;
  - `mehrere_auf_board_legen` (`src/dienst/zuordnung.rs:37`, nur Existenzprüfung), also `POST /api/boards/{slug}/aufgaben/mehrere`.
  - `bewegen-mehrere` und `POST /api/aufgaben/mehrere` (Anlegen) lesen den Ordner einmal (`aufgabe_anlegen.rs:137`, ADR-0004) und sind nicht betroffen. `braucht_eintragen` (`braucht.rs:106`) liest je gebrauchter Nummer, aber lesend ohne Sperre und begrenzt durch die Labels einer Aufgabe. Das ist ein Leistungsthema, keine Sperrfrage.
- **Verwandte n²-Stellen ohne Verzeichnis-Listing**:
  - `Ordner::aufgaben` sucht doppelte Nummern mit `gut.iter().find` (`src/ablage.rs:119`). Bei 30.002 Aufgaben dauert `GET /api/aufgaben` 4,1–4,6 s (Karte).
  - `board_text` (`src/dienst/mod.rs:255`) sucht je Board-Zeile mit `aufgaben.iter().find`.
- Die Pfadregel von `aufgabenpfad` (R00123/B0573) gilt in dieser Reihenfolge:
  1. die erste lesbare nummerierte Datei nach Namen;
  2. sonst die erste nummerierte, auch eine defekte (dann 423);
  3. sonst entscheidet der Inhalt (`id` in einer von Hand benannten Datei).
  
  `aufgaben()` ordnet dagegen nach dem Inhalt (`id`). Beide Wege geben also nicht in jedem Randfall dieselbe Datei.
- Sperre: `gesperrt()` ist eine `Mutex` je Ordner (`src/dienst/mod.rs:259`). Prüfen und Handeln (`aktion`, ein Commit) liegen im selben Sperrbereich. Fremde Schreiber außerhalb des Prozesses (Editor, `git pull`) hält sie nicht auf, heute ebenso wenig wie danach (ADR-0004, Wächter mit 150 ms Bündelung).
- Rumpfgrenze der Routen: 50 MB (`src/web/mod.rs:119`). Daraus folgen rund 10⁶ Einträge je Sammelanfrage.
- Lastprofil (ADR-0027, Wissen im Auftrag): 5.000 Aufgaben (davon 4.000 archiviert), lesend p95 < 200 ms, eine Änderung ist in < 1 s in allen offenen Sichten.

**Qualitätsziele mit Szenario**

- **Q1 Antwortzeit:** `PATCH /api/aufgaben/mehrere` mit 4.000 Titeländerungen bei 4.002 Aufgaben antwortet in < 1 s.
- **Q2 Fairness unter der Sperre:** Ein einzelner PATCH, der während der Kette aus Q1 eingeht, wartet höchstens so lange wie der Rest dieser Kette, also nicht spürbar (< 1 s).
- **Q3 Missbrauch (`sicherheit`):** Jeder mit Konto kann eine Sammelanfrage schicken. Die Arbeit unter der Sperre wächst linear mit der Zahl der Einträge und ist nach oben begrenzt, ohne dass der Ordner das Maß ist.

## Optionen

### Option A: Alle Aufgaben einmal lesen (`aufgaben()`), dann je Nummer in einer Map nachschlagen

- Stärke: Es ist ein einziger bekannter Leseweg, die Kreisprüfung (`Tuer::ordner_lesen`) liest ihn ohnehin schon, und jede Änderung kostet danach O(1).
- Schwächen:
  - Auch eine Anfrage mit einer Änderung liest und parst alle m Dateien unter der Sperre, heute nur eine. Bei 5.000 Aufgaben wird jeder kleine Sammel-PATCH dadurch teurer.
  - Die Zuordnung läuft über den Inhalt, nicht über den Dateinamen. Damit weicht sie von der Pfadregel R00123/B0573 ab: Eine Datei `0007-x.md` mit `id: 8` und eine defekte nummerierte Datei (heute 423) verhielten sich anders.
  - Defekte Dateien müssten in einer zweiten Map nachgebildet werden.

### Option B: Einmal je Anfrage nur die Dateinamen listen — ein Verzeichnis Nummer → Pfade, danach je Nummer nur ihre Datei lesen

- Stärke:
  - Es ist genau die Pfadregel von heute, nur einmal statt n-mal ausgewertet: ein `read_dir` je Anfrage und je Änderung eine Datei.
  - Eine einzelne Änderung kostet so viel wie heute.
  - Der Rückfall auf den Inhalt (`aufgaben()`, von Hand benannte Dateien) läuft höchstens einmal je Anfrage und erst bei Bedarf.
- Schwäche:
  - Es entsteht ein neuer Typ in `ablage.rs` (Momentaufnahme der Namen) mit einer Lebensdauer, die an den Sperrbereich gebunden sein muss.
  - Wer ihn vor `gesperrt()` baut oder über die Anfrage hinaus hält, liest einen veralteten Stand. Die Prüfliste muss das festhalten.

### Option C: Cache der Aufgaben bzw. Namen im Speicher über Anfragen hinweg, gepflegt über eigene Schreibvorgänge und den Wächter

- Stärke: Nachschlagen in O(1) auch für Einzelwege und `GET`. Er ist der nächste Schritt, falls das Lesen des Ordners selbst zu teuer wird (ADR-0004, letzter Satz der Entscheidung).
- Schwächen:
  - Es entsteht ein zweiter Zustand.
  - Änderungen von außen kommen erst nach der Bündelung des Wächters an (150 ms). Genau in diesem Fenster prüft der Sammelweg gegen einen alten Stand, und Prüfen-dann-Handeln stimmt nicht mehr mit der Platte überein. ADR-0004 hat das für die Schlüsselsuche aus demselben Grund verworfen.
  - Nötig sind Invalidierung, Abgleich und eine eigene Fehlerklasse. Das ist für einen Bug mit linearer Lösung zu viel.

### Bewertung

| | Q1 Antwortzeit | Q2 fremder PATCH | Q3 Arbeit begrenzt | Prüfen-dann-Handeln unter einer Sperre | fremder Schreiber außerhalb des Prozesses | Pfadregel R00123 gleich |
|---|---|---|---|---|---|---|
| A | ja (m Dateien parsen) | ja | linear in m, auch bei n = 1 | ja | wie heute | **nein** (Inhalt statt Name) |
| B | ja (1 Listing + n Dateien) | ja | linear in n | ja | wie heute (Namensstand vom Sperrbeginn) | **ja** |
| C | ja | ja | linear in n | **nein**: Prüfung gegen den Cache, nicht gegen die Platte | bis 150 ms falsch | ja, wenn richtig gepflegt |

**Fremder Schreiber, je Art:**

- **Im Prozess** (jede andere Anfrage): Alle Schreibwege nehmen `gesperrt()`, deshalb kommt bei A, B und C niemand dazwischen. Bei A und B gilt der gelesene Stand bis zum Commit, weil die Momentaufnahme erst nach dem Sperren entsteht und mit dem Sperrbereich endet.
- **Außerhalb des Prozesses** (Editor, `git pull`): Die Sperre hält ihn heute nicht und auch nach der Änderung nicht.
  - Heute listet jede Änderung neu und sieht damit einen Mischstand aus vielen Zeitpunkten. Das ist nicht richtiger als eine Momentaufnahme.
  - Bei B gilt:
    - Eine Datei, die nach dem Listing entsteht, ist für diese Anfrage unbekannt (404).
    - Eine Datei, die nach dem Listing umbenannt wird, liest sich leer (423).
    - Ein Inhalt, der zwischen Lesen und Schreiben fremd geändert wird, wird überschrieben (lost update).
  
  Alle drei Fenster gibt es heute je Änderung genauso. Ihre Gesamtdauer schrumpft von 18 s auf < 1 s.

## Entscheidung

**E1: Option B.** `Ordner` bekommt eine Momentaufnahme der Dateinamen von `aufgaben/` (Arbeitsname `Aufgabenverzeichnis`), die die Pfadregel von `aufgabenpfad` unverändert enthält:

- Sie hält Nummer → nummerierte Pfade in Namensreihenfolge.
- Der Rückfall auf den Inhalt wird höchstens einmal und erst bei Bedarf gelesen.
- `Ordner::aufgabe(nr)` und `aufgabenpfad(nr)` werden Aufrufe derselben Momentaufnahme. Es gibt eine Implementierung der Regel, nicht zwei.
- Die Sammelwege bauen die Momentaufnahme **einmal nach `gesperrt()`** und fragen in der Schleife nur sie: `mehrere_aendern`, `mehrere_archivieren` (archivieren und zurückholen) und `mehrere_auf_board_legen`.
- Die Momentaufnahme ist ein lokaler Wert im Sperrbereich und wird nie in `Kanban` gespeichert.

**E3: Die verwandten n²-Stellen werden linear.**

- In `Ordner::aufgaben` sucht eine `HashMap<u32, usize>` (Nummer → Index in `gut`) die doppelten Nummern, statt `gut.iter().find`. Die Meldung „auch in aufgaben/<erste Datei>“ bleibt wörtlich.
- `board_text` schlägt den Dateinamen über eine Map Nummer → Datei nach.
- Das Verhalten ändert sich an keiner der beiden Stellen.

**E2 (Vorgeschlagen): Grenze je Sammelanfrage als zweite Sicherung.**

- Höchstens **5.000 Einträge** je Sammelanfrage. Das ist das Lastprofil: so viele Aufgaben, wie ein Ordner tragen soll.
- Die Grenze gilt gleich für alle Sammelwege: `PATCH /api/aufgaben/mehrere`, `POST /api/aufgaben/archivieren`, `…/zurueckholen`, `POST /api/aufgaben/mehrere`, `POST /api/boards/{slug}/aufgaben/mehrere`, `POST /api/boards/{slug}/bewegen-mehrere` und `POST /api/aufgaben/{nr}/teilaufgaben/mehrere`.
- Geprüft wird **vor** `gesperrt()` und vor `ohne_doppelte`. Darüber gibt es 400 `{fehler}`, die Meldung nennt Grenze und Anzahl, und nichts wird gelesen oder geschrieben.
- Begründung:
  - Nach E1 begrenzt bei Ändern, Archivieren und Legen schon der Ordner die Arbeit, denn eine unbekannte Nummer bricht ab.
  - Anlegen (`POST /api/aufgaben/mehrere`) und Teilaufgaben haben diese natürliche Grenze nicht. Bis zu 10⁶ Titel aus 50 MB Rumpf würden je eine Datei und einen Pfad im Commit unter der Sperre erzeugen.
  - Eine feste Grenze macht die längste Sperrdauer unabhängig von der Ordnergröße.

**Abgewogen:**

- Für B spricht, dass es die bestehende, getestete Pfadregel einmal statt n-mal auswertet. Es gibt keinen zweiten Zustand (gegen C), keinen Umweg über den Inhalt, und eine kleine Anfrage wird nicht teurer (gegen A).
- Bewusst in Kauf genommen:
  - ein neuer Typ mit einer Lebensdauerregel, die nur Prüfliste und Review durchsetzen, nicht der Compiler;
  - die Fenster für fremde Schreiber außerhalb des Prozesses, die bleiben wie heute.
- Ob die Commit-Kosten von `aktion` (4.000 Pfade in einem `git`-Commit) allein schon unter 1 s liegen, ist unvermessen. Darum trennt die Messprobe Lesen und Commit.

## Prüfliste (Durchsetzung)

1. **Zähler statt Uhr (Gate)**:
   - Ein Testzähler zählt die Aufrufe von `markdown_dateien("aufgaben")`, nur unter `cfg(test)`, je Ordner-Instanz oder thread-lokal, damit parallele Tests nicht mitzählen.
   - Für `mehrere_aendern`, `mehrere_archivieren` (beide Richtungen) und `mehrere_auf_board_legen` mit n = 1, 10 und 300 Änderungen gilt jeweils:
     - Listings bei n = 300 = Listings bei n = 1 ≤ 3. Die Zahl hängt nicht von n ab.
     - Gezählt werden die Momentaufnahme und die bestehenden Einmal-Leser des ganzen Ordners: Kreisprüfung `Tuer::ordner_lesen` (nur mit neuem `braucht:`-Label), `archivieren_pruefen`/`zurueckholen_pruefen`/`grenzen_pruefen` (`src/dienst/zugregeln.rs:94`, `:117`) und `board_text`.
     - Einzeldateilesungen außerhalb dieser Einmal-Leser ≤ n + 1.
   - Heute ist der Zähler rot: Listings ≥ n.
2. **Pfadregel gleich**: Die bestehenden Tests `src/ablage.rs:356–359` laufen unverändert gegen `aufgabe`/`aufgabenpfad`. Dazu kommt ein Test „Sammelweg = Einzelweg“ mit denselben vier Dateien im selben Aufruf (`0007-sieben.md`, defekte `0008-kaputt.md`, `von-hand.md` mit `id: 9`, Nummer 99 fehlt): `PATCH …/mehrere` auf 7 ändert, auf 8 gibt 423, auf 9 ändert `von-hand.md`, auf 99 gibt 404. Jedes Mal wird nichts geschrieben, wenn eine Nummer scheitert.
3. **Lebensdauer**:
   - Die Momentaufnahme entsteht in jedem Sammelweg nach `let _sperre = self.gesperrt();`.
   - `Kanban` hat kein Feld vom Typ `Aufgabenverzeichnis`, prüfbar mit `grep`.
   - Deterministische Probe, Prüfen-dann-Handeln:
     - Ein Test hält die Sperre und legt im Ordner eine Datei `0010-neu.md` an. Danach startet `mehrere_aendern([10])` auf einem zweiten Thread, und der Test gibt die Sperre frei.
     - Erwartet: Die Änderung findet #10. Die Momentaufnahme stammt also aus der Zeit nach dem Warten, nicht von davor.
4. **E3**:
   - Die Meldungen zu doppelten Nummern sind wörtlich gleich, Test mit drei Dateien derselben Nummer.
   - `board_text` liefert für ein Board mit 3 Aufgaben dieselbe Datei wie vorher, eine davon von Hand benannt.
5. **E2 (nach Freigabe)**:
   - Je Sammelweg 5.000 Einträge → normales Verhalten, 5.001 → 400 mit Grenze und Anzahl in der Meldung.
   - Kein Commit, kein Listing: Zähler = 0.
   - Mutanten „Grenze 4.999“, „Grenze 50.000“ und „Prüfung entfernt“ müssen rot werden (Spanne, `gemeinsam/gelerntes.md`).

## Messprobe (Lastbeobachtung, kein Gate; nur auf Ansage des Betreibers)

- Aufbau wie Karte #241:
  - `python3 gemeinsam/scratchpad/srev-228/probe_nachher.py <port> 4000 1000` (≥ 4.002 Aufgaben);
  - danach `probe_kontrolle.py <port> 4000`, gegen das Release-Programm auf freiem Port.
- Soll:
  - `titel only` < 1 s;
  - ein fremder einzelner `PATCH /api/aufgaben/{nr}`, der 100 ms nach Beginn der Kette startet, endet < 1 s nach dem Ende der Kette;
  - ohne Kette p95 eines Einzel-PATCH bei 5.000 Aufgaben wie vorher (± 10 %).
- Getrennt protokollieren: Dauer bis `aktion` (Lesen, Prüfen) und Dauer von `aktion` (Schreiben, Commit).
- Bleibt `titel only` ≥ 1 s, während der Lesepfad < 200 ms braucht, liegt der Rest im Commit. Dann wird eine neue Karte zum Commit-Weg nötig, kein Nachbessern hier.
- E3 beobachtet `GET /api/aufgaben` bei 30.002 Aufgaben: heute 4,1–4,6 s, Erwartung deutlich darunter. Ein Soll wird nicht gesetzt, weil das Lastprofil 5.000 Aufgaben nennt.

## Konsequenzen

**Positiv:**

- Die Sammelwege kosten O(m + n) statt O(n × m) unter der Sperre. Q1 und Q2 erreicht der Lesepfad, sofern der Commit mitspielt (Messprobe).
- Es bleibt eine Pfadregel an einer Stelle (`ablage.rs`). Einzel- und Sammelwege können nicht auseinanderlaufen.
- ADR-0004 gilt weiter: kein Index über Anfragen hinweg, die Platte ist die Wahrheit.

**Negativ / in Kauf genommen:**

- Die Lebensdauerregel der Momentaufnahme ist Konvention (Prüfliste 3), nicht vom Typ erzwungen.
- Externe Schreiber können weiter dazwischenkommen, wie heute.
- E2 macht 5.001 Einträge zum Fehler. Ein Client mit „alle markieren“ über mehr als 5.000 Karten muss in Teilen senden.

## Folgeentscheidungen / Aufgaben

- [ ] Umsetzung E1 + E3 mit Prüfliste 1–4 (Vorschlag für eine Anforderung an den planer)
- [ ] E2 nach Antwort des product-owner (Höhe, Status 400 oder 413, Wortlaut der Meldung), Prüfliste 5
- [ ] Messprobe auf Ansage des Betreibers; bei Rest im Commit neue Karte
