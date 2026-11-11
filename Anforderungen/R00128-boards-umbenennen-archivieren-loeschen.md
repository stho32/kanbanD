---
id: R00128
status: Neu
datum: 2026-11-11
---

# R00128: Board umbenennen, archivieren und löschen in der Oberfläche

## Beschreibung

Heute kennt die Oberfläche nur **Wechseln und Anlegen** (R00008) — ein Board umzubenennen, zu archivieren oder zu löschen geht nur von Hand am Editor über die Datei `boards/<slug>.md`. Diese Anforderung bringt die drei gewohnten Kanban-Funktionen in den Board-Umschalter (Karte #35, Beratung des product-owner 2026-11-03; Vorbilder Trello, Planka, Wekan). Technisch bindend ist [ADR-0022](../Dokumentation/ADRs/0022-board-umbenennen-archivieren-loeschen.md) (Option A, Akzeptiert): **Umbenennen ändert nur den Titel, der Slug bleibt** Dateiname, Adresse und Cache-Schlüssel; **Archivieren setzt `archived: <JJJJ-MM-TT>`** ins Board-Frontmatter, die Datei bleibt liegen; **Löschen entfernt die Board-Datei** (und den verwaisten Berichte-Cache). Die neuen Wege sind `PATCH` und `DELETE /api/boards/{slug}`.

Zahlt ein auf: [Vision](R00000-vision.md) — „Das Board besitzt seine Struktur“ (ein Board ist eine Datei unter `boards/`) und „Git ist das Gedächtnis“ (das Archiv ist die Git-Geschichte, kein Papierkorb).

Nicht Teil: den **Slug/Dateinamen** umbenennen (Option B der ADR — bräuchte eine eigene ADR, weil es Adresse, Lesezeichen und `berichte/<slug>-fieber.md` bricht); ein **Papierkorb** oder zweiter Archiv-Ort (`boards/archiv/`, `.bak`); eine **Rückgängig**-Taste für das Löschen (Git ist der Papierkorb, ADR-0022 Punkt 3); eine Board-Liste mit Suche, Sortierung oder Umbenennen mehrerer Boards.

### Domänenbezug
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wer mit mehreren Boards arbeitet (Entwicklung, Test, Release), muss veraltete Boards wegräumen können, ohne den Editor und die Hand am Dateinamen zu bemühen. Heute ist der Board-Umschalter eine reine Auswahl. Umbenennen, Archivieren und Löschen an einem Ort machen die Pflege der Boards zu einer Sache der Oberfläche — und weil ADR-0022 den Slug als stabile Identität stehen lässt, kostet das Umbenennen keine einzige gebrochene Adresse, kein Lesezeichen und keinen Berichte-Cache.

## Funktionale Anforderungen

### Die drei Wege (ADR-0022 „Ausprägung des Schreibwegs“)

1. `PATCH /api/boards/{slug}` mit `{titel}` ändert nur den Anzeigenamen: geschrieben wird die `# `-Überschrift der Board-Datei (`Board.titel`); der **Slug** (Dateiname, `#/board/<slug>`, `berichte/<slug>-fieber.md`) bleibt unverändert. Leerer Titel oder Titel ohne Buchstaben/Ziffern → 400; unbekannter Slug → 404; ungültige Slug-Form → 400 (über `Ordner::board`, ADR-0008). Antwort das Board.
2. `PATCH /api/boards/{slug}` mit `{archiviert: true}` setzt `archived: <heute>` ins Board-Frontmatter, `{archiviert: false}` nimmt den Schlüssel weg. Ohne Änderung **kein Commit**. Antwort das Board mit `archiviert: <Datum> | null`.
3. `DELETE /api/boards/{slug}` entfernt `boards/<slug>.md` **und** den verwaisten Cache `berichte/<slug>-fieber.md` in **genau einem Commit** (Git ist der Papierkorb). Unbekannter Slug → 404. Antwort beschreibt das Entfernen.
4. **Ein Commit je Aktion**: Umbenennen ändert eine Überschriftzeile, Archivieren eine Frontmatter-Zeile, Löschen die Datei samt Cache. Umbenennen und Archivieren schreiben die Datei über den vorhandenen Text-Weg (`aktion()`); Löschen braucht den Datei-Löschweg (ADR-0022, A00007).

### Archiv und Liste

5. Ein Board mit `archived` (Datum) fällt aus `GET /api/boards` und aus dem Board-Umschalter (`zustand.boards`) heraus; `GET /api/boards?archivierte=ja` (und `GET /api/boards/{slug}`) nimmt es auf — dieselbe Sprache wie das Kartenarchiv (R00017). Das Board-JSON trägt `archiviert: <JJJJ-MM-TT> | null`.
6. Nach dem Umbenennen bleibt die Adresse: `#/board/<slug>` und ein Lesezeichen zeigen weiter dasselbe Board; der Cache `berichte/<slug>-fieber.md` bleibt byte-gleich.

### Eigentümer-Sperre (R00097, R00120)

7. **Archivieren und Löschen** nehmen einem Board alle Karten aus dem Blick und werden wie „vom Board nehmen“/„archivieren“ geprüft: liegt eine Karte des Boards in einer **Menschen-Spalte**, ist ein Agent gesperrt → **403 `{fehler, spalte, nummer}`** (erste gesperrte Karte, über alle Spalten, fail-safe); der brave Menschen-Fall: der Mensch ist frei. Ein `human` meinender, aber ungültiger `column-owner`-Eintrag sperrt das ganze Board (R00120 PO Z. 187). **Umbenennen** bewegt keine Karte → frei.
8. So umgeht kein Agent die Eigentümer-Regel (R00097) über das Löschen oder Archivieren eines ganzen Boards.

### Oberfläche (Board-Umschalter)

9. Der Board-Umschalter in der Kopfzeile („BOARDS · boards/“) bietet **je Board** die drei Aktionen Umbenennen, Archivieren und Löschen. Ort und Form (Aktion je Eintrag, Kontextmenü je Eintrag, getrennte Zeile) legt die **UX-Vorprüfung** fest; die Anforderung fixiert nur: erreichbar, tastaturbedienbar, ohne die bestehende Auswahl zu zerstören.
10. **Umbenennen** ändert den Namen in der Oberfläche; nach dem Bestätigen tragen der Umschalter und die Kopfzeile den neuen Namen, während der Slug (`<slug>.md`) unverändert bleibt.
11. **Archivieren und Löschen fragen nach**: ein Bestätigungsdialog nennt den Boardnamen; beim Löschen steht ausdrücklich, dass die **Board-Datei entfernt** wird (die Aufgaben bleiben erhalten, wiederherstellbar nur über die Git-Geschichte). Umbenennen braucht keine Bestätigung.
12. **Archivierte Boards** erscheinen nicht in der offenen Liste; sie sind über einen Archiv-Abschnitt (Vorschlag „Archiviert (n)“ wie das Kartenarchiv) oder `?archivierte=ja` erreichbar und lassen sich **reaktivieren** (`archiviert: false`). Ort und Form legt die UX-Vorprüfung fest.
13. Ist das **aktuell offene Board** archiviert oder gelöscht, wechselt die Ansicht auf das erste verbleibende Board; gibt es keines, zeigt die Seite den leeren Zustand („Kein Board · neues anlegen“, ADR-0022).
14. **Das letzte Board** darf (Vorschlag) archiviert oder gelöscht werden — die Instanz darf ohne Board dastehen; ein neues entsteht mit `POST /api/boards`. Die endgültige Antwort gibt der product-owner (UX/Artboard, ADR-0022 „Offene Fragen“).

## Nicht-funktionale Anforderungen

- **Ein Commit je Aktion**; das Umbenennen und Archivieren berühren nur die Board-Datei, das Löschen Board-Datei und Cache. Karten, Aufgaben, Spalten und Einstellungen eines anderen Boards bleiben unangetastet.
- **Barrierefreiheit**: Umbenennen, Archivieren, Löschen und der Bestätigungsdialog sind per Tastatur erreichbar; der Dialog führt und hält den Fokus (ADR-0018, R00106/R00113) und trägt einen zugänglichen Namen mit dem Boardnamen.
- **Breite**: Umschalter und Bestätigungsdialog scrollen bei 320 px nicht quer (ADR-0015, `--kd-ziel` ≥ 44 px, R00108).
- **Rückwärtskompatibel**: `POST /api/boards` und sein **409** bei belegtem Slug bleiben unberührt; kein Weg ändert den Slug; das Aufgabenarchiv (R00017) bleibt unverändert.
- **Kaputte Dateien**: ein defektes Board (`Ordner::board`, R00025) ist nur lesbar; Umbenennen/Archivieren/Löschen antworten 423 wie die übrigen Board-Schreiber (R00120 PO Z. 188).

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar): der Ordner hat die Boards „Entwicklung“ (`boards/entwicklung.md`) und „Test“ (`boards/test.md`); „Test“ hat die Karte #7 in der Spalte „Prüfen“ mit `column-owner: human`. Heute ist der 11.11.2026.

- [ ] **1. Umbenennen ändert nur den Titel, der Slug bleibt**: Gegeben `boards/entwicklung.md` mit `berichte/entwicklung-fieber.md`; wenn ich das Board in „Entwicklung 2026“ umbenenne, dann zeigt der Umschalter und die Kopfzeile „Entwicklung 2026“, die Datei heißt weiter `boards/entwicklung.md`, `#/board/entwicklung` zeigt dasselbe Board, `GET /api/boards/entwicklung` liefert Titel „Entwicklung 2026“ und Slug `entwicklung`, `berichte/entwicklung-fieber.md` ist byte-gleich, und es gibt genau einen Commit „Board „Entwicklung 2026“ umbenannt“.
- [ ] **2. Archivieren nimmt aus der Liste**: Gegeben das Board „Test“; wenn ich es archiviere, dann steht `archived: 2026-11-11` in `boards/test.md`, „Test“ fehlt in `GET /api/boards` und im Umschalter, `GET /api/boards?archivierte=ja` und `GET /api/boards/test` liefern es mit `archiviert: 2026-11-11`, und es gibt genau einen Commit.
- [ ] **3. Reaktivieren**: Gegeben das archivierte Board „Test“; wenn ich es reaktiviere, dann ist der Schlüssel `archived` weg, „Test“ steht wieder in `GET /api/boards` und im Umschalter, und `GET /api/boards/test` liefert `archiviert: null`.
- [ ] **4. Löschen entfernt Datei und Cache, die Karten bleiben**: Gegeben das offene Board „Test“ mit der Karte #7; wenn ich es lösche und bestätige, dann fehlen `boards/test.md` und `berichte/test-fieber.md`, es gibt genau einen Commit, „Test“ fehlt in der Liste, die Karte #7 steht weiter in `GET /api/aufgaben`, und die Ansicht wechselt auf „Entwicklung“.
- [ ] **5. Agent gesperrt, Mensch frei**: Gegeben „Test“ mit #7 in der Menschen-Spalte „Prüfen“; wenn ein Agent „Test“ archiviert oder löscht, dann antwortet der Server 403 `{fehler, spalte: "Prüfen", nummer: 7}`, keine Datei ändert sich; derselbe Agent darf „Test“ **umbenennen**; ein Mensch darf „Test“ archivieren und löschen.
- [ ] **6. Fehlerfälle, kein leerer Commit**: Gegeben „Entwicklung“; wenn ich einen leeren Titel sende, dann antwortet der Server 400, die Datei bleibt byte-gleich; ein unbekannter Slug → 404; ein `PATCH` ohne tatsächliche Änderung erzeugt **keinen** Commit.
- [ ] **7. Letztes Board** (unter Vorbehalt der PO-Antwort): Gegeben nur noch das Board „Entwicklung“; wenn ich es archiviere (Empfehlung: erlaubt), dann fehlt es in der Liste und die Seite zeigt den leeren Zustand „Kein Board · neues anlegen“, ohne Fehler; ein neues Board entsteht mit `POST /api/boards`.
- [ ] **8. Bestätigungsdialog und schmales Layout**: Gegeben Fensterbreite 320 px; wenn ich im Umschalter „Löschen“ wähle, dann erscheint ein Bestätigungsdialog mit dem Boardnamen, das Fenster scrollt nicht quer, und ohne Bestätigung wird nichts geschrieben.
- [ ] **9. Rückwärtskompatibel**: Gegeben zwei Boards; wenn ich `POST /api/boards {titel: "Test"}` sende, dann antwortet der Server weiter 409; ein `PUT …/spalten`, `bewegen` und das Aufgabenarchiv (R00017) verhalten sich unverändert.

## Betroffene Verzeichnisstruktur

```
src/
├── format/board.rs        # `archived` lesen/schreiben (Frontmatter), Rundlauf-Test
├── modell/board.rs        # Feld `archiviert: Option<String>`, Board-Literale; Entnahmesperre board-weit
├── dienst/                # board_anlegen.rs erweitern oder eigenes board_verwalten.rs: umbenennen/archivieren/löschen
├── dienst/mod.rs          # `aktion()` ein Commit; der neue Datei-Löschweg (A00007)
└── web/                   # endpunkte.rs + mod.rs: PATCH/DELETE /api/boards/{slug}, Liste/Schalter, OpenAPI
web/
├── ansicht.js             # Board-Umschalter: Aktionen je Board, Archiv-Abschnitt, Bestätigungsdialog
├── app.js                 # Aufrufe PATCH/DELETE /api/boards/{slug}; Ansichtswechsel nach Archivieren/Löschen
└── kd-app.css             # Dialog/Archiv-Abschnitt (Form nach UX-Vorprüfung)
tests/ · e2e/
├── tests/boards.rs        # Integration: PATCH/DELETE, 400/404/403/409, ein Commit, Cache weg
└── e2e/tests/r00128-boards-verwalten.spec.js (neu); r00008-boards.spec.js läuft mit
Dokumentation/Architektur/  # A00005/A00006/A00007 nachziehen, Aspekt X00001 (Ausnahmen-Liste, Löschweg)
```

## Technische Überlegungen

Nach [ADR-0022](../Dokumentation/ADRs/0022-board-umbenennen-archivieren-loeschen.md) (Akzeptiert, Commit `100dd81`); die ADR entscheidet die Technik, diese Anforderung den Weg durch die Oberfläche. Nachzuziehen sind A00005 (Format), A00006 (Modell), A00007 (Git/Löschen) und X00001 (Schreibweg).

### Ablauf

1. **Server** (`src/dienst/`, `src/web/`):
   - 1.1 `PATCH /api/boards/{slug}` prüft zuerst die Slug-Form und dass das Board existiert (`Ordner::board`, ADR-0008), dann die Werte (Titel nicht leer; `archiviert` boolesch).
   - 1.2 Titel ändern: `Board.titel` neu setzen, `board::schreiben` → `aktion()` (ein Commit „Board „<neu>“ umbenannt“).
   - 1.3 Archiv setzen: `archiviert` = heute (`true`) bzw. `None` (`false`); ohne Änderung kein Commit („Board „<titel>“ archiviert“ / „… wieder geöffnet“).
   - 1.4 `DELETE /api/boards/{slug}`: alle Pfade prüfen (ADR-0008), Datei `boards/<slug>.md` und `berichte/<slug>-fieber.md` entfernen, **ein Commit** (neuer Löschweg in A00007).
   - 1.5 Eigentümer-Sperre vor 1.3 und 1.4 für Agenten (board-weite Prüfung über `Board::entnahme_erlaubt`/`entnahme_pruefen`).
2. **Oberfläche** (`web/app.js`, `web/ansicht.js`):
   - 2.1 Der Umschalter (`vBoardPop`) bekommt je Board die drei Aktionen; `board-wahl` bleibt für den Wechsel.
   - 2.2 Umbenennen: Eingabefeld mit dem heutigen Titel → `PATCH {titel}`; Fehler in `popFehler`.
   - 2.3 Archivieren/Löschen: Bestätigungsdialog → `PATCH {archiviert}` bzw. `DELETE`; danach Ansicht neu laden (2.4).
   - 2.4 Ist das offene Board weg, auf das erste verbleibende Board oder den leeren Zustand wechseln.

### Grobentwurf

- `Board` (DTO, `src/modell/board.rs`) — Feld `archiviert: Option<String>` ergänzen (Format `archived`); die `Board { … }`-Literale (Code und Tests) um das Feld erweitern.
- `BoardVerwalten` (DTO, immutable, `src/dienst/`) — `{ titel: Option<String>, archiviert: Option<bool> }`; `None` heißt „nicht ändern“ (Unterscheidung zu `false` nötig).
- `Kanban` (`src/dienst/`) — zwei **öffentliche** Methoden (eine Sperre, ein Commit, ADR-0005):
  - `board_aendern(&Person, &str /*slug*/, &BoardVerwalten) -> Result<Board, Fehler>`
  - `board_loeschen(&Person, &str /*slug*/) -> Result<(), Fehler>`
- Eigentümer-Prüfung — bestehende `entnahme_pruefen` (`src/dienst/zugregeln.rs`) board-weit nutzen (alle Spalten); Antwort `{fehler, spalte, nummer}` für die erste gesperrte Karte, fail-safe ohne Spalte nach R00120 für einen ungültigen `human`-Eintrag.
- Routen (`src/web/`): `PATCH` und `DELETE /api/boards/{slug}` neben `GET`/`POST /api/boards`; `GET /api/boards` und `zustand.boards` filtern Archivierte, `?archivierte=ja` nimmt sie auf.

### Änderungen an bestehenden Klassen

- `Board` (`src/modell/board.rs`): neues Feld `archiviert`.
- `src/format/board.rs`: `archived` in Frontmatter lesen/schreiben (Rundlauf wie `:671–693`); der `---`-Block erscheint auch, wenn nur `archived` gesetzt ist.
- `src/dienst/board_anlegen.rs` oder neu `board_verwalten.rs`: die zwei Methoden.
- `src/dienst/mod.rs`: der Löschweg (Datei entfernen + Pfad committen, A00007).
- `src/web/endpunkte.rs` und `src/web/mod.rs`: Endpunkt-Tabelle, Routen, OpenAPI, Liste/Schalter.
- `web/ansicht.js` (`vBoardPop`, `vDialog`), `web/app.js` (Aktionen, Ansichtswechsel).

### Gestaltung

Der **Board-Umschalter** ist eine gesehene Gestaltung (D0002, Abschnitt `#boards`); neu sind **drei Aktionen je Eintrag** und ein **Bestätigungsdialog** (Archivieren/Löschen) samt **Archiv-Abschnitt**. Das ist ein neuer Zustand mit offener Form — nach Z. 153 der `po-entscheidungen.md` braucht es **ux-Vorprüfung und Artboard D0002 mit Freigabe des product-owner vor dem Bau der Oberfläche**. Die Vorprüfung entscheidet: (a) Lage der Aktionen (Symbol je Eintrag, Kontextmenü, ausgeklappte Zeile), (b) Wortlaut und Form des Bestätigungsdialogs, (c) ob das Archiv ein eigener Abschnitt „Archiviert (n)“ wird oder nur über `?archivierte=ja` erreichbar ist, (d) die Antwort auf die offene Frage „letztes Board“. Kein neuer Farbwert (ADR-0011), Material-3-Vorgaben aus dem Gedächtnis. Der Server-Teil (F0103) ist **frei baubar** und wartet nicht auf das Artboard.

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, der eine Zustandsänderung in der Board-Datei, im Git-Verlauf oder auf dem Schirm beobachtet (Skill `test-ehrlichkeit`).

- **Integration (`tests/boards.rs`)**: `PATCH {titel}` (Slug/Adresse/Cache bleiben, ein Commit), `PATCH {archiviert}` (Schlüssel gesetzt/entfernt, kein Commit ohne Änderung), `DELETE` (Datei und Cache weg, ein Commit), 400/404/423/409, die 403-Eigentümer-Sperre für Agenten (Archivieren und Löschen), der Mensch frei, `?archivierte=ja`; die Ausnahmen müssen die X00001-Probe („Aufruf vergessen“) grün lassen.
- **E2E (Playwright)**: neu `e2e/tests/r00128-boards-verwalten.spec.js` (Muster `r00008`): Umbenennen (Titel neu, Adresse/Slug unverändert), Archivieren (Board weg, wieder da), Löschen mit Bestätigungsdialog (Board weg, Karten bleiben, Ansicht wechselt), Fehlerfall (leerer Titel), Breitenprobe 320 px.
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #35.
- **Gegenproben (Mutanten)**: Umbenennen zieht den Slug mit (AK 1 rot, bricht ADR-0022), Archivieren lässt das Board in der Liste (AK 2 rot), Löschen ohne Bestätigung (AK 8 rot), Agent darf ein Board mit Karte in einer Menschen-Spalte löschen (AK 5 rot), Löschen ohne Cache → Cache bleibt (AK 4 rot).
- **Mitlaufend grün**: `r00008-boards.spec.js`, `tests/boards.rs`, `tests/spalten.rs`, `tests/spalteneinstellungen.rs`, `tests/openapi.rs` (Endpunkt-Tabelle ↔ OpenAPI), `ziele.spec.js`, `kontrast.spec.js`, `kultur.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- Abhängig von (grün): I0008 Boards wechseln und anlegen (R00008, `POST /api/boards`, 409, `#/board/<slug>`), I0019/I0076 Eigentümer-Sperre (R00097/R00120, `entnahme_erlaubt`, `entnahme_pruefen`), I0025 Defekte Dateien zeigen (R00025, 423).
- Vor: [ADR-0022](../Dokumentation/ADRs/0022-board-umbenennen-archivieren-loeschen.md) (Akzeptiert, `100dd81`); nachzuziehen A00005/A00006/A00007/X00001.
- Gestaltung: **ux-Vorprüfung und Artboard D0002** mit Freigabe des product-owner vor dem Bau der Oberfläche (F0104/F0105); Server-Teil F0103 frei baubar.
- Blockiert: —

## Offene Fragen

Keine, die den Bau des Servers blockieren. Empfehlungen des planers (Entscheidungen im Bericht); richtungsweisend bleibt die Artboard-/PO-Frage:

1. **Letztes Board** (ADR-0022): Darf das letzte Board archiviert oder gelöscht werden? **Empfehlung: ja** — die Instanz darf ohne Board dastehen (leerer Zustand „Kein Board · neues anlegen“); ein neues entsteht mit `POST /api/boards`. Entscheidung beim product-owner (Artboard).
2. **Umbenennen mit Bestätigung?** **Empfehlung: nein** — eine Textänderung ist reversibel und wird sofort im Umschalter sichtbar; nur Archivieren und Löschen fragen nach.
3. **Rückgängig für das Löschen?** **Empfehlung: nein, eigene Karte falls gewünscht** — Git ist der Papierkorb (ADR-0022 Punkt 3); die Wiederherstellung ist ein `git`-Vorgang, kein Oberflächenknopf. Ein „rückgängig“ (§ D00008) würde die Datei neu anlegen und wäre ein eigener Umfang.
4. **Archiv sichtbar (Abschnitt „Archiviert (n)“) oder nur `?archivierte=ja`?** UX-Thema unter D0002 (Artboard); Empfehlung: eigener Abschnitt wie das Kartenarchiv, damit „archiviert“ sichtbar ist (ADR-0022 akzeptierte Schwäche).

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel nach der UX-Vorprüfung: Board-Umschalter mit den drei Aktionen, Bestätigungsdialog (Archivieren, Löschen), Archiv-Abschnitt mit einem reaktivierten Board bei 1280, 414 und 320 px, je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist eine Lücke: Das Board ist die zentrale Sicht, aber die Pflege der Boards selbst endet bei „wechseln und anlegen“ — wer ein Board umbenennen oder wegräumen will, verlässt die Oberfläche und fasst die Datei an, mit dem Risiko, Dateiname und Anzeige auseinanderzubringen. ADR-0022 hat die Technik entschieden: Der Slug ist Identität (Dateiname, Adresse, Berichte-Cache) und bleibt, der Titel ist Anzeige und darf sich ändern; Archivieren spiegelt das Aufgabenarchiv (bestandserhaltend, ein Frontmatter-Schlüssel); Löschen überlässt die Wiederherstellung der Git-Geschichte. Diese Anforderung macht genau diese drei Wege in der Oberfläche bedienbar. Die Wirkungskette: `PATCH`/`DELETE /api/boards/{slug}` im Server → drei Aktionen im Board-Umschalter mit Bestätigung → der Mensch pflegt seine Boards, ohne die Dateien anzufassen, und keine Adresse, kein Lesezeichen und kein Cache bricht. Der Hebel ist genau hier und nicht eine Ebene tiefer: Ein Slug-umbenennender Weg (Option B) wäre der bequemere Bau, bräche aber genau die stabile Identität, die Berichte-Cache und Lesezeichen tragen — deshalb Titel statt Slug, und deshalb ein Bestätigungsdialog vor dem scharfen Löschen. Die Eigentümer-Sperre (R00097/R00120) wird auf das ganze Board ausgedehnt, damit kein Agent die Menschen-Spalten über ein gelöschtes Board umgeht.

## Missing-Docs
- Das Glossar hat keinen Eintrag für das Board selbst (Titel vs. Slug, `archived`, Archiv) — bislang trägt `D00002` nur den Hauptbereich des Fensters. Vorschlag: nach dem Bau ein Eintrag „Board“ (Slug = Identität, Titel = Anzeige, Archiv wie das Kartenarchiv).
- A00005/A00006 nennen `archived`/`Board.archiviert` noch nicht; sie werden mit dem Bau nachgezogen (Vorschlag im Bericht an den architekt).

## Notizen

**Eigene Interaction unter D0002.** Das Board trägt die Aktionen; der Umschalter liegt in der Kopfzeile des Boards. Muster: I0008/R00008 (Boards wechseln und anlegen, unter D0002) — diese Anforderung ist dessen Fortsetzung um Pflege-Aktionen. Anders als R00008 (abgenommen) eine **neue Interaction**, kein roter Nachfahre (Härtungs-/Fortschreibungsregel, `AI-Team/gelerntes.md` 2026-11-11).

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — Aktionen je Board im bestehenden Umschalter, Bestätigungsdialog für Archivieren/Löschen** (gewählt): kleinster Eingriff, alles an einem gesehenen Ort; deckt die Karte („in der Oberfläche“) und ADR-0022.
- **B — eigenes „Board verwalten“-Fenster** (wie das Aufgabenfenster): trennt Anzeige und Pflege, kostet aber einen neuen Dialog samt Fokusführung für drei Aktionen; verworfen.
- **C — Rechtsklick-Kontextmenü auf dem Boardnamen**: auf Touch unentdeckbar, Tastatur umständlich, widerspricht der Auffindbarkeit (R00033-Kontextmenüs sind Ergänzung, nicht einziger Weg); verworfen.
- **D — nur über die API** (kein UI): widerspricht der Karte; verworfen.

**Verwiesenes**
- Karte #35 „Board umbenennen, archivieren, löschen in der Oberfläche“ (Herkunft: Beratung product-owner 2026-11-03; Referenz Trello, Planka, Wekan; Priorität PO niedrig).
- ADR-0022 (Commit `100dd81`, Option A, Akzeptiert): Titel ändern/Slug bleibt, `archived`-Flag, Datei löschen.
