# ADR-0008: Board-Slug geprüft vor jedem Dateizugriff; `aktion()` und `schreib()` halten Pfade unter der Wurzel

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: Karte #48 (Security-Befund aus den Auto-Reviews von #5); Bug-Anforderung folgt über den planer
**Erprobt durch**: — (Abnahme-Probe der Karte #48 ist der erste Test)

## Kontext

`board_pfad(slug)` (`src/ablage.rs:148`) und `Ordner::board` (`src/ablage.rs:118`) setzen den Slug aus Body, Pfad oder Query ungeprüft in `boards/{slug}.md` ein. Alle Schreibwege (`bewegen`, `zuordnung`, `reservierung`, `termine`, `bindung`, `berichtsfilter`, `phasen`, `aufgabe_anlegen.rs:167`, `erledigen.rs:45/79`) lesen zuerst `ordner().board(slug)` und schreiben dann `board_pfad(&b.slug)` — `b.slug` ist dabei der ungeprüfte Eingabewert (`board::lesen(slug, …)`). Lesewege: `GET /api/boards/{slug}`, Filter `?board=` (`src/web/mod.rs:311`), `verlauf.rs:42`. Dadurch lässt sich außerhalb von `boards/` lesen und schreiben (Befund #48).

Erzeugt werden Slugs nur über `modell::slug` (`src/modell/mod.rs:14`: `[a-z0-9-]`, höchstens 40 Zeichen; Aufrufer `board_anlegen.rs:24`, `einrichten.rs:61`). Die Dateien sind aber die Wahrheit und ändern sich von außen: `Ordner::boards` (`src/ablage.rs:61`) nimmt jeden Dateistamm unter `boards/` als Slug. Bestand am 2026-11-06 (nur gelesen): 7 Board-Dateien in 5 Board-Ordnern unter `~/Projekte/Kanban-Boards/` (`entwicklung`, `entwicklungsprozess`, `joinpuya`, `csv-viewer`, `test-board`) — alle in der Form.

## Optionen

### Option A: Typ `BoardSlug`, geprüft beim Erzeugen; `board_pfad` und `Board.slug` nehmen nur diesen
- Vorteile: ungeprüfter Pfad kompiliert nicht.
- Nachteile: `Board.slug` ist `String` in Modell, Format, Serde-Antworten und rund 20 Aufrufern; großer Umbau für eine Vorrang-Karte. Schwäche: hoher Änderungsradius, Risiko für bestehende Tests.

### Option B: Reine Prüfung `board::slug_gueltig` im Modell, angewandt an der einzigen Eingangstür `Ordner::board` vor jedem Lesen; `Ordner::boards` meldet Dateistämme außerhalb der Form als defekt
- Vorteile: eine Stelle für alle Lese- und Schreibwege, weil jeder Weg über `Ordner::board` läuft; Liste und Zugriff sagen dasselbe.
- Nachteile: ein künftiger Aufrufer kann `board_pfad` mit einem rohen String füttern. Schwäche: Schutz hängt an Konvention — deshalb Option D dazu.

### Option C: Nur Pfadeinschluss in der Ablage (`lies`/`schreib` prüfen „unter der Wurzel“)
- Vorteile: generisch für alle Dateiarten.
- Nachteile: `../aufgaben/0012-x` bleibt unter der Wurzel und zerstört trotzdem eine Aufgabe (Befund); Fehlercode wäre 500 statt 400. Schwäche: schützt die Platte, nicht die Fachlichkeit.

### Option D (Ergänzung, keine Alternative): zweite Linie in `aktion()` und `Ordner::schreib`
- Alle Zielpfade relativ, nur normale Bestandteile (keine `..`, keine Wurzel, kein NUL), in einer Aktion kein Pfad doppelt — geprüft **vor** dem ersten Schreiben.

## Entscheidung

**Gewählt: Option B + Option D.**

1. **Form**: `board::slug_gueltig(s)` ⇔ 1–40 Zeichen aus `[a-z0-9-]` — genau das Bild von `modell::slug` (Test: jedes nichtleere `slug(x)` ist gültig).
2. **Ort**: `Ordner::board(slug)` prüft zuerst, vor jedem Dateizugriff. Ungültige Form ⇒ `Fehler::Ungueltig` (400), auf **allen** Wegen gleich, lesend wie schreibend (`GET /api/boards/{slug}`, `?board=`, Body `board`). Gültige Form, Datei fehlt ⇒ `Fehler::NichtGefunden` (404) wie bisher. Kein Trimmen, kein Normalisieren der Eingabe außer dem bestehenden `trim` in `erledigen.rs`.
3. **Liste**: `Ordner::boards` führt einen Dateistamm außerhalb der Form unter `defekte` („Dateiname ist kein gültiger Board-Name — umbenennen“); kein automatisches Umbenennen.
4. **Zweite Linie**: `aktion()` (`src/dienst/mod.rs:156`) prüft alle Pfade der Aktion vor der Schleife (eingeschlossen, eindeutig) und bricht sonst mit `Fehler::Intern` (500) ab, ohne etwas geschrieben zu haben; `Ordner::schreib` (`src/ablage.rs:39`) prüft den Einschluss ebenfalls, damit die Anhänge außerhalb von `aktion()` mitgeschützt sind. Ein Treffer der zweiten Linie ist ein Programmierfehler, nie eine Benutzereingabe.

Option A bleibt der nächste Schritt, falls ein Befund zeigt, dass `board_pfad` mit ungeprüftem Wert gerufen wird (neue ADR).

## Konsequenzen

**Positiv:**
- Die Abnahme-Probe von #48 wird an einer Stelle grün; keine Änderung an den rund 20 Aufrufern nötig.
- Liste und Einzelzugriff widersprechen sich nicht mehr bei handbenannten Dateien.

**Negativ / Inkauf zu nehmen:**
- Eine Board-Datei mit Großbuchstaben, Unterstrich oder Leerzeichen im Namen (heute keine im Bestand) ist nach dem Update nur noch als defekt gelistet, bis sie umbenannt ist.
- `?board=` mit ungültiger Form antwortet jetzt 400 statt 404.

**Folgeentscheidungen / Aufgaben:**
- [x] Regel und Erkennungsweg in [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md) (erledigt mit dieser ADR).
- [ ] `verlauf.rs:42` auf `board_pfad(&aktuell.slug)` umstellen, damit `board_pfad` nur Werte aus `Ordner::board` sieht.

## Quellen / Bezuege

- `src/ablage.rs:39` (`schreib`), `:61` (`boards`), `:118` (`board`), `:148` (`board_pfad`); `src/dienst/mod.rs:156` (`aktion`); `src/modell/mod.rs:14` (`slug`); `src/web/mod.rs:151–152` (400/404)
- ADR-0005 (eine öffentliche Methode = eine Sperre = ein `aktion()`)
