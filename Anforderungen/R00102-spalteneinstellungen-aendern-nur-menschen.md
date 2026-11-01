---
id: R00102
status: Neu
datum: 2026-11-01
---

# R00102: Spalteneinstellungen ändern nur Menschen

## Beschreibung

Grenze (`limits`) und Eigentümer (`column-owner`) einer Spalte ändern nur Menschen. Ein Agent, dessen `PUT /api/boards/{slug}/spalten` einen dieser Werte tatsächlich ändert, bekommt `403` ohne Commit. Gemeint ist Setzen, Ändern, Entfernen, das Löschen einer Spalte, die einen der Werte trägt, und das Umbenennen oder Tauschen einer solchen Spalte: Für Agenten vergleicht kanbanD die Einträge nach Spaltennamen, so wie sie in der Datei stehen. Alles andere am Einrichten der Spalten bleibt ihm erlaubt. Ein `PUT` ohne `grenze` behält künftig die Grenze, wie es die übrigen Felder schon tun.

Zahlt ein auf: [Vision](R00000-vision.md) — Mensch und Agent arbeiten gleichberechtigt auf einem gemeinsamen Board; der Mensch stellt die Regeln ein, nach denen die Agenten ziehen.

Zur Leitplanke „Full-Trust“ (keine Anmeldung, keine Rechteprüfung): Die Regel unterscheidet wie R00096 und R00097 nur nach `kind` der handelnden Person aus `X-KanbanD-Wer`. Es kommt keine Anmeldung und keine Rechteverwaltung dazu (PO-Entscheidung `AI-Team/po-entscheidungen.md` Z. 55, präzisiert durch Z. 57: Vergleich nach Namen).

## Geschäftlicher Nutzen

R00096 setzt die WIP-Grenze für Agenten durch, R00097 die Freigabe durch den Menschen. Beides ist wirkungslos, solange ein Agent mit einem einzigen `PUT …/spalten` die Grenze hochsetzen oder den Eigentümer der Freigabe-Spalte entfernen kann. Gerade ein Agent, der an einer `409` oder `403` abprallt, „repariert“ sonst die Spalte. Mit dieser Anforderung bleiben die Regeln so eingestellt, wie der Mensch sie eingestellt hat. Die Anforderung beantwortet Karte #21 („Dürfen Agenten WIP-Grenzen ändern?“) und ersetzt sie.

## Funktionale Anforderungen

### Was als Änderung gilt (handelnde Person mit `kind: agent`)
- **Vergleich nach Namen, nicht über `alt`** (PO Z. 57): Verglichen werden die Einträge unter `limits` (Name → Grenze) und `column-owner` (Name → Eigentümer), so wie sie in der Board-Datei stehen. „Vorher“ ist die Datei vor dem `PUT`. „Nachher“ ist der Text, den kanbanD schreiben würde, wieder eingelesen (nach dem Zurücklesen). Geprüft wird jeder Name, der in der Anfrage steht oder vorher eine Spalte war. Fehlt unter einem Namen ein Eintrag, heißt das „keine Grenze“ bzw. „kein Eigentümer“.
- **Grenze**: Unter einem Namen steht nachher eine andere wirksame Grenze als vorher. Dazu zählen setzen (keine → 3), ändern (2 → 3), entfernen (2 → `null` oder `0`), eine neue Spalte mit Grenze, das Entfernen einer Spalte mit Grenze, das Umbenennen einer Spalte mit Grenze (der alte Name verliert sie, der neue bekommt sie) und das Tauschen zweier Spalten über `alt`. `0` und „keine“ sind derselbe Wert.
- **Eigentümer**: Unter einem Namen steht nachher ein anderer `column-owner`-Eintrag als vorher, so wie er in der Datei steht. Ein unbekannter Wert (`chef`) zählt mit, also ist auch `chef` → `null` eine Änderung. Dazu zählen eine neue Spalte mit Eigentümer, das Entfernen, Umbenennen und Tauschen einer Spalte mit Eigentümer.
- Folge: Eine Spalte unter einem Namen, der vorher eine Grenze oder einen Eigentümer trug, muss sie nachher unverändert tragen. Wer die Menschen-Spalte „Eingang“ in „Eingang alt“ umbenennt und daneben eine neue „Eingang“ ohne Eigentümer anlegt, ändert also beide Namen.
- **Nicht rundlauf-stabile Namen**: Ein neuer Name, der nach dem Zurücklesen anders lautet oder seinen Eintrag verliert (z. B. mit Zeilenumbruch `"In Arbeit\nx"` oder als Zahl lesbar wie `0x10`, `0o17`, `0b101`), nimmt keine Grenze und keinen Eigentümer still mit. Entweder weist kanbanD den Namen als Formfehler mit `400` ab (dann für alle), oder der Vergleich nach dem Zurücklesen findet die Änderung und antwortet `403`. In beiden Fällen gibt es keinen Commit, und die Board-Datei bleibt unverändert. Welcher der beiden Wege, entscheidet der Entwickler.

### Abweisung
- Antwort `403` `{fehler, spalte, einstellung}` ohne Commit, die Board-Datei bleibt unverändert.
  - `fehler`: „Grenze der Spalte „<Name>“ ändern nur Menschen“ bzw. „Eigentümer der Spalte „<Name>“ ändern nur Menschen“
  - `spalte`: der Name, unter dem die Änderung festgestellt wird — der Name aus der Anfrage oder, wenn es ihn nachher nicht mehr gibt, der bisherige Name
  - `einstellung`: `"grenze"` oder `"eigentuemer"`
- Bei mehreren Verletzungen nennt die Antwort die erste. Zuerst kommen die Namen der Anfrage in Anfragereihenfolge (das ist die neue Reihenfolge von links nach rechts). Danach kommen die Namen, die es nachher nicht mehr gibt (entfernte und umbenannte Spalten), in ihrer bisherigen Reihenfolge. Je Name steht die Grenze vor dem Eigentümer.
- Formfehler (`400`, z. B. leerer Name, Farbe kein `#rrggbb`) und „Spalte enthält Aufgaben“ (`409`) werden vor der `403` gemeldet, wie heute.

### Erlaubt bleibt (auch für Agenten)
- Spalten ohne Grenze und ohne Eigentümer anlegen, umbenennen und (leer) entfernen; umsortieren ohne Namenswechsel
- `pruefungen`, `notiz` und `farbe` ändern
- ein `PUT`, das `grenze` und `eigentuemer` unverändert mitschickt oder gar nicht mitschickt

### Fehlendes `grenze` behält den Wert (für alle)
- `grenze` fehlt: Die Spalte behält die Grenze der Spalte, die sie über `alt` übernimmt. `grenze: null` oder `0` entfernt die Grenze, `n > 0` setzt sie. Heute entfernt ein fehlendes `grenze` die Grenze. Das gilt künftig nicht mehr, für Menschen wie für Agenten. Damit verhält sich `grenze` wie `pruefungen`, `notiz`, `farbe` und `eigentuemer` (PO Z. 56).

### Mensch
- Für Menschen ändert sich nichts außer dem fehlenden `grenze`. Beim Umbenennen wandern Grenze und Eigentümer über `alt` mit wie heute. Der Spalten-Dialog sendet `grenze` immer und verhält sich unverändert.

### Beschreibung
- `/api`, `/api/endpunkte` und `/api/openapi.json` nennen an `PUT /api/boards/{slug}/spalten` die Regel samt Vergleich nach Namen (Umbenennen und Tauschen einer Spalte mit Grenze oder Eigentümer zählen als Änderung), die `403` mit Rumpf und Reihenfolge sowie das Verhalten von fehlendem `grenze`, `null` und `0`.
- `/api` nennt die bekannte Grenze: Wer sich per `PATCH /api/personen/{kuerzel}` zum Menschen macht, kommt durch. Die Regel schützt vor Versehen, nicht vor Absicht.

## Nicht-funktionale Anforderungen

- Sicherheit: Wie R00096 und R00097 beruht die Regel auf `X-KanbanD-Wer` (Full-Trust). Ein Agent, der sich als Mensch ausgibt oder seine Art über `PATCH /api/personen/{kuerzel}` auf `human` setzt, kommt durch. Das ist gewollt und steht in der Beschreibung.
- Atomarität: Die Prüfung läuft unter derselben Sperre wie das Schreiben (`gesperrt()` vor `aktion()`, ADR-0002). Abgewiesen wird immer die ganze Anfrage, nie ein Teil.

## Akzeptanzkriterien

Ausgangsboard jeder Prüfung: Board `entwicklung` mit den Spalten Eingang (`column-owner: human`), In Arbeit (`limits: In Arbeit: 2`, leer) und Erledigt, ohne weitere Grenzen und Eigentümer. Personen `st` (`kind: human`) und `bot` (`kind: agent`). Jede Anfrage schickt alle drei Spalten mit `alt` = Name, außer wo anders genannt.

### Grenze
- [ ] `bot` sendet In Arbeit mit `grenze: 3` → `403` `{fehler: "Grenze der Spalte „In Arbeit“ ändern nur Menschen", spalte: "In Arbeit", einstellung: "grenze"}`, `fehler` als erstes Feld, Board-Datei unverändert, `git log` ohne neuen Commit
- [ ] `bot` sendet In Arbeit mit `grenze: null` → `403`; mit `grenze: 0` → `403`
- [ ] `bot` sendet Erledigt mit `grenze: 4` → `403`, `spalte: "Erledigt"`
- [ ] `bot` sendet zusätzlich eine neue Spalte Review (ohne `alt`) mit `grenze: 1` → `403`, `spalte: "Review"`
- [ ] `bot` sendet nur Eingang und Erledigt (In Arbeit entfernt, leer, Grenze 2) → `403`, `spalte: "In Arbeit"`, `einstellung: "grenze"`

### Eigentümer
- [ ] `bot` sendet Erledigt mit `eigentuemer: "human"` → `403` `{fehler: "Eigentümer der Spalte „Erledigt“ ändern nur Menschen", spalte: "Erledigt", einstellung: "eigentuemer"}`, kein Commit
- [ ] `bot` sendet Eingang mit `eigentuemer: "agent"` → `403`; mit `eigentuemer: null` → `403`
- [ ] `bot` sendet nur In Arbeit und Erledigt (Eingang entfernt, leer, `human`) → `403`, `spalte: "Eingang"`, `einstellung: "eigentuemer"`
- [ ] Board mit `column-owner: {Erledigt: chef}`: `bot` sendet Erledigt mit `eigentuemer: null` → `403`, `chef` steht weiter in der Datei

### Reihenfolge der Verletzungen
- [ ] `[Eingang eigentuemer "agent", In Arbeit grenze 3, Erledigt]` → `spalte: "Eingang"`, `einstellung: "eigentuemer"`
- [ ] `[In Arbeit grenze 3, Eingang eigentuemer "agent", Erledigt]` (umsortiert) → `spalte: "In Arbeit"`, `einstellung: "grenze"`
- [ ] `[Eingang, In Arbeit grenze 3 eigentuemer "agent", Erledigt]` → `spalte: "In Arbeit"`, `einstellung: "grenze"`
- [ ] `[Erledigt eigentuemer "human", In Arbeit]` (Eingang entfernt) → `spalte: "Erledigt"`, die entfernte Spalte kommt zuletzt
- [ ] `bot` entfernt die Spalte Eingang, während sie Karte #1 enthält, und setzt dabei In Arbeit auf `grenze: 3` → `409` „Spalte „Eingang“ enthält 1 Aufgaben — erst leeren“, nicht `403`

### Umbenennen und Tauschen (Vergleich nach Namen)
- [ ] `bot` benennt Eingang → Posteingang und In Arbeit → Bau um (mit `alt`, In Arbeit mit `grenze: 2`) → `403` `{spalte: "Posteingang", einstellung: "eigentuemer"}`, Board-Datei unverändert, kein Commit
- [ ] `bot` benennt nur Eingang → Posteingang um (mit `alt`, ohne `eigentuemer`) → `403` `{fehler: "Eigentümer der Spalte „Posteingang“ ändern nur Menschen", spalte: "Posteingang", einstellung: "eigentuemer"}`, kein Commit
- [ ] `bot` benennt nur In Arbeit → Bau um (mit `alt`, ohne `grenze`) → `403` `{fehler: "Grenze der Spalte „Bau“ ändern nur Menschen", spalte: "Bau", einstellung: "grenze"}`, kein Commit; mit `grenze: 2` ebenso
- [ ] `bot` tauscht über `alt`: `[Eingang alt=In Arbeit, In Arbeit alt=Eingang, Erledigt]` (ohne `grenze` und `eigentuemer`) → `403` `{spalte: "Eingang", einstellung: "grenze"}` (unter Eingang stünde nachher Grenze 2 statt keiner), kein Commit
- [ ] `bot` sendet `[Eingang alt (alt=Eingang), Eingang (ohne alt, ohne eigentuemer), In Arbeit, Erledigt]` → `403` `{spalte: "Eingang alt", einstellung: "eigentuemer"}` (Eingang alt bekäme `human`, Eingang verlöre es), kein Commit, Datei mit `column-owner: Eingang: human` unverändert
- [ ] Rundlauf: `bot` benennt In Arbeit (Grenze 2) und, in einer zweiten Anfrage, Eingang (`human`) je in `"In Arbeit\nx"`, `"0x10"`, `"0o17"` und `"0b101"` um (mit `alt`; je einmal ohne `grenze`/`eigentuemer` und einmal mit `grenze: 2` bzw. `eigentuemer: "human"`) → jeder der 16 Fälle `400` oder `403`, kein Commit, Board-Datei byte-gleich

### Erlaubt bleibt
- [ ] `bot` legt eine neue Spalte Review vor Erledigt an, ohne `grenze` und `eigentuemer` → `200`, ein Commit, Review ohne Grenze und Eigentümer
- [ ] `bot` benennt Erledigt → Fertig um (mit `alt`, Erledigt hat weder Grenze noch Eigentümer) → `200`, ein Commit, Datei enthält Fertig, `limits: In Arbeit: 2` und `column-owner: Eingang: human` unverändert
- [ ] `bot` sortiert um `[In Arbeit, Eingang, Erledigt]` mit unveränderten Werten → `200`, ein Commit
- [ ] `bot` setzt `pruefungen`, `notiz` und `farbe` für Eingang → `200`, ein Commit, Eigentümer bleibt `human`
- [ ] `bot` sendet alle Spalten mit `grenze: 2` für In Arbeit und `eigentuemer: "human"` für Eingang, sonst unverändert → `200`, kein Commit (keine Änderung)
- [ ] `bot` sendet alle Spalten ohne `grenze` und ohne `eigentuemer` → `200`, `limits: In Arbeit: 2` und `column-owner: Eingang: human` bleiben
- [ ] `bot` sendet Erledigt mit `grenze: 0` (Erledigt hat keine Grenze) → `200`, Board-Datei unverändert

### Fehlendes `grenze`
- [ ] `st` sendet In Arbeit ohne `grenze` → `limits: In Arbeit: 2` bleibt; mit `grenze: null` → Eintrag entfernt; mit `grenze: 0` → Eintrag entfernt
- [ ] `st` benennt In Arbeit → Bau mit `alt` ohne `grenze` um → `limits: Bau: 2`
- [ ] Spalten-Dialog: `st` leert das Feld Grenze von In Arbeit und speichert → In Arbeit ohne Grenze (bestehende E2E des Einrichtemodus grün)

### Mensch
- [ ] `st` führt jeden der abgewiesenen Fälle aus „Grenze“ und „Eigentümer“ aus → `200`, ein Commit, Datei wie gesendet
- [ ] `st` benennt Eingang → Posteingang und In Arbeit → Bau um (mit `alt`, ohne `grenze` und `eigentuemer`) → `200`, ein Commit, Datei enthält `column-owner: Posteingang: human` und `limits: Bau: 2`

### Beschreibung
- [ ] Eintrag `PUT /api/boards/{slug}/spalten` in `/api/endpunkte` nennt „Grenze und Eigentümer ändern nur Menschen“, den Vergleich nach Namen (Umbenennen und Tauschen zählen), `403 {fehler, spalte, einstellung}`, die Reihenfolge und „`grenze` fehlt → behält, `null` oder `0` → entfernt“
- [ ] `/api/openapi.json` führt an `PUT /api/boards/{slug}/spalten` die Antwort `403` mit einem Schema, das `fehler`, `spalte` und `einstellung` enthält
- [ ] `/api` enthält den Satz zur bekannten Grenze mit `PATCH /api/personen`

## Betroffene Verzeichnisstruktur

Vergleich in `src/modell/board.rs` (neben `spalten_setzen`, `entnahme_erlaubt`), Regel in `src/dienst/zugregeln.rs`, Prüfung im Schreibweg `src/dienst/spalten.rs`, Fehlerart in `src/fehler.rs` und `src/web/mod.rs`, Schema in `src/web/openapi.rs`, Beschreibung in `src/web/endpunkte.rs`. Tests im jeweiligen Modul und unter `tests/spalten.rs`; die E2E des Einrichtemodus unter `e2e/tests/` bleibt grün.

## Technische Überlegungen

Vorplanung aus der WBS (I0087, F0017–F0021, B0299–B0307). Welche Bubbles es am Ende werden, entscheidet der Entwickler.

### Ablauf
1. **`PUT …/spalten`** unter `gesperrt()`: Board lesen, Kopie als „vorher“ behalten
2. **`Board::spalten_setzen(neu)`** wie heute: Formfehler (`400`) und „enthält Aufgaben“ (`409`) zuerst; `grenze` neu als „fehlt → alt, `null`/`0` → keine“
3. **Änderungen ermitteln** (PO Z. 57): vorher + nachher (aus dem zu schreibenden Text zurückgelesen) + Reihenfolge der Anfrage → `Einstellungsaenderungen`
   - 3.1 Namen der Anfrage in Anfragereihenfolge: Grenze, dann Eigentümer-Eintrag unter diesem Namen vorher gegen nachher (`alt` spielt keine Rolle)
   - 3.2 danach Namen, die es nachher nicht mehr gibt, in bisheriger Reihenfolge, wenn sie vorher eine Grenze oder einen Eigentümer-Eintrag trugen
4. **Regel** (`zugregeln.rs`): Agent mit mindestens einer Änderung → `Fehler::EinstellungVerboten` der ersten; Mensch → weiter
5. **`aktion()`** wie heute, ohne Änderung kein Commit

### Grobentwurf

**Wichtige Einstiegsstellen:** `Kanban::spalten_setzen` (`src/dienst/spalten.rs`), Handler `spalten_setzen` (`src/web/mod.rs`), Eintrag in `src/web/endpunkte.rs`.

- `Einstellung` (Enum: `Grenze`, `Eigentuemer`) — serialisiert als `grenze` bzw. `eigentuemer`
- `Einstellungsaenderung` (DTO, immutable) — Spalte und Einstellung
- `Einstellungsaenderungen` (benannte Collection) — in Prüfreihenfolge; `fn erste(&self) -> Option<&Einstellungsaenderung>`
- `Board` (vorhanden)
  - `fn einstellungsaenderungen(&self, nachher: &Board, neu: &[SpaltenAenderung]) -> Einstellungsaenderungen` — reine Funktion; `nachher` ist das zurückgelesene Board, `neu` liefert nur die Reihenfolge der Namen
- `Fehler::EinstellungVerboten { meldung, spalte, einstellung }` (neu) → HTTP `403` (Ergänzung zu ADR-0003, Entscheidung des architekt)

### Änderungen an bestehenden Klassen
- `SpaltenAenderung.grenze`: `Option<Option<u32>>` mit `entfernbar` wie `eigentuemer`
- `Board::spalten_setzen`: fehlendes `grenze` übernimmt die Grenze der `alt`-Spalte
- `Kanban::spalten_setzen`: Board vorher behalten, Regel vor `aktion()`
- `IntoResponse for Fehler`, `openapi.rs`: neue Variante und Schema

## Tests

**Unit:** `Board::einstellungsaenderungen` mit allen Fällen der Akzeptanzkriterien „Grenze“, „Eigentümer“, „Reihenfolge“, „Umbenennen und Tauschen“ und den Gegenproben (Umbenennen einer Spalte ohne Werte, `0` auf Spalte ohne Grenze); die Regel je Zweig (Agent mit/ohne Änderung, Mensch); `IntoResponse` der neuen Variante; `spalten_setzen` mit fehlendem/`null`/`0` `grenze`.
**Integration:** jeder Fall der Akzeptanzkriterien gegen einen echten Ordner, die Rundlauf-Fälle gegen eine echte Instanz, über `PUT …/spalten` mit Status, Rumpf, Board-Datei und `git log`.
**E2E:** keine neue; die bestehende E2E des Einrichtemodus (Grenze setzen und leeren) bleibt grün.

## Abhängigkeiten
- Abhängig von: R00096 WIP-Grenze für Agenten durchsetzen (I0085, gruen), R00097 Spalten mit Eigentümer (I0086, gebaut), R00009 Spalten einrichten
- Wirkt zusammen mit: ADR-0002 (Zugregeln gemeinsam vor der Aktion), ADR-0003 (Abweisungen mit strukturiertem Rumpf)
- Blockiert: —

## Offene Fragen
- keine (fehlendes `grenze`: PO Z. 56; Vergleich nach Namen: PO Z. 57)

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine (Karte #21 ist erledigt; der Director nennt R00102 auf Karte #27)

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist ein Loch in R00096 und R00097: Beide Regeln stehen in der Board-Datei, und genau diese Datei kann ein Agent über `PUT …/spalten` umschreiben. Ein Behandler, der an „Grenze erreicht“ scheitert, kann die Grenze von 2 auf 3 setzen und weiterziehen. Ein Sensor kann den Eigentümer des Eingangs entfernen und die Freigabe umgehen. Ebenso kann er die Menschen-Spalte umbenennen und daneben eine gleichnamige ohne Eigentümer anlegen; neue Karten, die nach Namen abgelegt werden, landen dann ungeschützt. Mit dieser Anforderung prüft kanbanD vor dem Commit nach Spaltennamen, ob ein Agent eine der beiden Einstellungen tatsächlich ändert, und weist dann die ganze Anfrage mit `403` ab. Die Regel bleibt so, wie der Mensch sie eingestellt hat, und die `409` und `403` aus R00096 und R00097 behalten ihre Wirkung. Der Hebel liegt am einzigen Schreibweg für diese Einstellungen und nicht an den Zug-Endpunkten. Board anlegen und Einrichten setzen keine Grenze und keinen Eigentümer. Alles übrige Einrichten bleibt Agenten erlaubt, so wird ihnen nichts genommen, was keine Regel trägt.

## Missing-Docs
- keine

## Notizen

**Optionen**: Die Richtung hat der PO entschieden (Z. 55, Option 1; Option 2 „erlauben wie heute“ und Option 3 „Agenten dürfen `PUT …/spalten` gar nicht“ sind dort verworfen). Ohne Rückfrage entschieden (planer):
- **Rumpf `{fehler, spalte, einstellung}` statt `Verboten {fehler, spalte, nummer}`**: Hier gibt es keine Karte, und `nummer: null` bräche den Rumpf aus R00097 (PO Z. 48). Eine eigene Variante folgt der Linie von ADR-0003 (eine Variante je strukturierter Abweisung).
- **Reihenfolge**: Spalten der Anfrage in Anfragereihenfolge, entfernte zuletzt. Wie in Z. 47 gilt die Reihenfolge, die der Agent selbst schickt, und sie ist die neue Reihenfolge von links nach rechts (Z. 28). Entfernte Spalten haben in der Anfrage keinen Platz.
- **Neue Spalte mit Grenze oder Eigentümer ist eine Änderung**: Sie setzt einen Wert, den es vorher nicht gab. „Spalten anlegen“ bleibt ohne diese Werte erlaubt.
- **Unbekannter Eigentümer zählt**: Verglichen wird der Eintrag, wie er in der Datei steht. Ein Agent soll einen von Menschen geschriebenen Wert nicht entfernen (Z. 52: unbekannter Wert bleibt erhalten).
- **Vergleich nach Namen statt über `alt`** (PO Z. 57, Rückfrage des security-review): Die Regeln stehen in der Datei nach Namen, und Menschen wie Sensoren legen Karten nach Namen ab. Ein Vergleich über `alt` ließ Umbenennen plus Neuanlegen und Tauschen durch und war deshalb abschaltbar. Verworfen: „gewollt, nur in der Beschreibung nennen“. Für Menschen bleibt der Vergleich über `alt` ohne Bedeutung, sie dürfen ohnehin alles.
- **`400`/`409` vor `403`**: Eine Anfrage, die so nicht ausführbar ist, wird zuerst als solche gemeldet. Die `403` nennt nur Änderungen, die sonst geschrieben würden.

**Außerhalb des Umfangs**: Änderungen an der Board-Datei an kanbanD vorbei (Git, Editor) und das Anlegen eines Boards (`POST /api/boards` setzt weder Grenze noch Eigentümer).
