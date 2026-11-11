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

### Oberfläche (Board-Umschalter) — nach UX-Vorprüfung #35

Der Board-Umschalter in der Kopfzeile („BOARDS · boards/“) ist die gesehene Gestaltung D0002. Die **UX-Vorprüfung #35 (2026-11-11, 10 Muss M1–M10)** legt Ort und Form der drei Aktionen fest; die Anforderung fixt nur: erreichbar, tastaturbedienbar, ohne die bestehende Auswahl zu zerstören. Alle Elementnamen mit „M"/„S" sind die Befund-Kürzel des Berichts (Kartenkommentar #35).

9. **Aktionsauslöser je Board-Zeile (M1).** Die Zeile selbst bleibt der Wechsel (`board-wahl`). Rechts trägt **jede Zeile einen eigenen ⋮-Auslöser** (`aria-haspopup="menu"`, SVG nach Muster `DREI_PUNKTE`) — **kein Knopf im Knopf**. Er öffnet das Aktionsmenü **dieser** Zeile (`role="menu"`) mit dem zugänglichen Namen **„Aktionen für Board ‚<Titel>‘"** und den Einträgen „Umbenennen", „Archivieren" (in der Archivzeile „wieder öffnen") und „Löschen". „Löschen" ist in `--kd-warn` abgesetzt (S1).
10. **Umbenennen (M10, S3).** „Umbenennen" öffnet **inline** in der Zeile ein mit dem heutigen Titel **vorbefülltes** Eingabefeld; `Enter` bestätigt, `Esc` verwirft ohne Schreiben. Ein Serverfehler (400) erscheint als **Feldfehler in `popFehler`** (`role="alert"`), das Feld bleibt offen. Nach dem Bestätigen tragen Umschalter und Kopfzeile den neuen Namen; die Datei heißt weiter `boards/<slug>.md`.
11. **Umbenennen fragt nicht nach; Archivieren und Löschen fragen nach (M2).** Eine Textänderung ist reversibel und sofort sichtbar; nur die auslagernde und die scharfe Aktion bekommen einen Bestätigungsdialog.
12. **Bestätigungsdialog (M2/M3/M8/M9).** `role="alertdialog" aria-modal="true"`, **höchstens zwei Aktionen** („Abbrechen" und die Bestätigung); der Fokus **startet auf „Abbrechen"**, kehrt beim Schließen an den **Auslöser** zurück, und `Esc` ist Abbrechen. Der zugängliche Name nennt das Board („<Titel> archivieren" / „<Titel> endgültig löschen"). Der **Lösch-Wortlaut** lautet wörtlich: **„Die Board-Datei `boards/<slug>.md` wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte."** Der Bestätigungsknopf liest **„endgültig löschen"** — dieselbe Wortwahl und **dieselbe Dialogkomponente wie R00141** (Aufgabe endgültig löschen). Der Dialog ist höchstens `min(360px, 100% − 32px)` breit; Text und Knöpfe brechen um, damit bei 320 px nichts quer scrollt.
13. **Archiv-Abschnitt (M5).** Archivierte Boards fallen aus der offenen Liste und erscheinen als **sichtbarer Abschnitt „ARCHIVIERT (n)"** (Vorschlag wie das Kartenarchiv, R00017), je Eintrag mit dem **Datum** („archiviert am JJJJ-MM-TT") und der Aktion **„wieder öffnen"** (`PATCH {archiviert: false}`). Der Abschnitt ist optional aufklappbar (`<details>`) und nennt als Hilfstext den Slug (`<slug>.md`).
14. **Kein Undo für das Löschen (M4).** Das Löschen hat **kein „rückgängig"** — Git ist der Papierkorb (ADR-0022 Punkt 3; ADR-0017 betrifft umkehrbare Aktionen, das Löschen ist keines). Das Archiv dagegen ist umkehrbar (**„wieder öffnen"**); die Wiederherstellung eines gelöschten Boards ist ein `git`-Vorgang.
15. **Leerzustand und letztes Board (M7).** Ist das **offene Board** archiviert oder gelöscht, wechselt die Ansicht auf das erste verbleibende Board; gibt es keines, zeigt die Seite den leeren Zustand **„Kein Board · neues anlegen"** mit dem Feld „Neues Board · Enter". **Das letzte Board darf** archiviert und gelöscht werden (Entscheidung 2026-11-11, offene Frage 1 geschlossen); ein neues entsteht mit `POST /api/boards`.
16. **Fokus (M6).** Nach dem Umbenennen oder wenn die bearbeitete Zeile verschwindet (archiviert/gelöscht), fällt der Fokus **nie auf `BODY`**: er geht auf die **nächste Board-Zeile**, sonst auf den Auslöser `#t-board`.
17. **Bedienung ohne Zeiger (M10, S2).** Alle drei Aktionen laufen per Tastatur (Menü-Muster: Pfeile, `Esc` gibt den Fokus zurück); keine erfordert Hover. Jede Aktion bestätigt sich mit einem Toast **`role="status"`**, dessen Text der **Commit-Wortlaut** ist („Board ‚Entwicklung 2026' umbenannt", „Board ‚Test' archiviert", „Board ‚Test' endgültig gelöscht").
18. **Defekte Boards (S4).** Ein defektes Board (`Ordner::board`, R00025) bleibt in der Liste als Eintrag „defekt" sichtbar; die drei Aktionen antworten **423** und melden es sichtbar — **kein stiller Fehlschlag**.
19. **Ansichtswechsel deterministisch (S6).** Nach Archivieren/Löschen eines **anderen** Boards bleibt das offene Board stehen; nur wenn das offene Board selbst betroffen ist, wechselt die Ansicht (erste verbleibende Zeile, sonst Leerzustand).

## Nicht-funktionale Anforderungen

- **Ein Commit je Aktion**; das Umbenennen und Archivieren berühren nur die Board-Datei, das Löschen Board-Datei und Cache. Karten, Aufgaben, Spalten und Einstellungen eines anderen Boards bleiben unangetastet.
- **Barrierefreiheit**: Umbenennen, Archivieren, Löschen und der Bestätigungsdialog sind per Tastatur erreichbar (keine Aktion erfordert Hover, M10); der ⋮-Auslöser trägt `aria-haspopup="menu"` und einen zugänglichen Namen mit dem Boardnamen (M1/M8); der Dialog ist `role="alertdialog" aria-modal="true"`, hält den Fokus (Start auf „Abbrechen", Rückgabe an den Auslöser, `Esc` = Abbrechen, ADR-0018/R00106/R00113) und trägt einen zugänglichen Namen mit dem Boardnamen (M2/M8). Jede Aktion bestätigt sich mit einem Toast `role="status"` im Commit-Wortlaut (S2).
- **Breite**: Umschalter, Menü, Umbenennen-Feld und Bestätigungsdialog scrollen bei 320 px nicht quer (ADR-0015, R00108); der Dialog ist höchstens `min(360px, 100% − 32px)` breit, Text und Knöpfe brechen um; alle Ziele erreichen mindestens `--kd-ziel` (M9/S5).
- **Rückwärtskompatibel**: `POST /api/boards` und sein **409** bei belegtem Slug bleiben unberührt; kein Weg ändert den Slug; das Aufgabenarchiv (R00017) bleibt unverändert.
- **Kaputte Dateien**: ein defektes Board (`Ordner::board`, R00025) ist nur lesbar; Umbenennen/Archivieren/Löschen antworten 423 wie die übrigen Board-Schreiber (R00120 PO Z. 188) und melden es sichtbar — kein stiller Fehlschlag (S4).

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar): der Ordner hat die Boards „Entwicklung“ (`boards/entwicklung.md`) und „Test“ (`boards/test.md`); „Test“ hat die Karte #7 in der Spalte „Prüfen“ mit `column-owner: human`. Heute ist der 11.11.2026.

- [ ] **1. Umbenennen ändert nur den Titel, der Slug bleibt**: Gegeben `boards/entwicklung.md` mit `berichte/entwicklung-fieber.md`; wenn ich das Board in „Entwicklung 2026“ umbenenne, dann zeigt der Umschalter und die Kopfzeile „Entwicklung 2026“, die Datei heißt weiter `boards/entwicklung.md`, `#/board/entwicklung` zeigt dasselbe Board, `GET /api/boards/entwicklung` liefert Titel „Entwicklung 2026“ und Slug `entwicklung`, `berichte/entwicklung-fieber.md` ist byte-gleich, und es gibt genau einen Commit „Board „Entwicklung 2026“ umbenannt“.
- [ ] **2. Archivieren nimmt aus der Liste**: Gegeben das Board „Test“; wenn ich es archiviere, dann steht `archived: 2026-11-11` in `boards/test.md`, „Test“ fehlt in `GET /api/boards` und im Umschalter, `GET /api/boards?archivierte=ja` und `GET /api/boards/test` liefern es mit `archiviert: 2026-11-11`, und es gibt genau einen Commit.
- [ ] **3. Reaktivieren**: Gegeben das archivierte Board „Test“; wenn ich es reaktiviere, dann ist der Schlüssel `archived` weg, „Test“ steht wieder in `GET /api/boards` und im Umschalter, und `GET /api/boards/test` liefert `archiviert: null`.
- [ ] **4. Löschen entfernt Datei und Cache, die Karten bleiben**: Gegeben das offene Board „Test“ mit der Karte #7; wenn ich es lösche und bestätige, dann fehlen `boards/test.md` und `berichte/test-fieber.md`, es gibt genau einen Commit, „Test“ fehlt in der Liste, die Karte #7 steht weiter in `GET /api/aufgaben`, und die Ansicht wechselt auf „Entwicklung“.
- [ ] **5. Agent gesperrt, Mensch frei**: Gegeben „Test“ mit #7 in der Menschen-Spalte „Prüfen“; wenn ein Agent „Test“ archiviert oder löscht, dann antwortet der Server 403 `{fehler, spalte: "Prüfen", nummer: 7}`, keine Datei ändert sich; derselbe Agent darf „Test“ **umbenennen**; ein Mensch darf „Test“ archivieren und löschen.
- [ ] **6. Fehlerfälle, kein leerer Commit**: Gegeben „Entwicklung“; wenn ich einen leeren Titel sende, dann antwortet der Server 400, die Datei bleibt byte-gleich; ein unbekannter Slug → 404; ein `PATCH` ohne tatsächliche Änderung erzeugt **keinen** Commit.
- [ ] **7. Letztes Board (entschieden: erlaubt)**: Gegeben nur noch das Board „Entwicklung“; wenn ich es archiviere, dann fehlt es in der Liste und die Seite zeigt den leeren Zustand „Kein Board · neues anlegen“ ohne Fehler; lösche ich es, dasselbe; ein neues Board entsteht mit `POST /api/boards`. **Das letzte Board darf** archiviert und gelöscht werden (Entscheidung 2026-11-11, M7).
- [ ] **8. Bestätigungsdialog und schmales Layout (M2/M3/M8/M9)**: Gegeben Fensterbreite 320 px und zwei Boards; wenn ich im ⋮-Menü von „Test“ „Löschen“ wähle, dann erscheint ein `role="alertdialog"` mit `aria-modal="true"` und dem zugänglichen Namen „Test endgültig löschen“, **höchstens zwei Aktionen**, der Fokus steht auf „Abbrechen“; im Rumpf steht wörtlich „Die Board-Datei `boards/test.md` wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte.“; der Dialog ist höchstens `min(360px, 100% − 32px)` breit, das Fenster scrollt nicht quer und Text sowie Knöpfe brechen um; `Esc` schließt ohne Schreiben, und nach dem Abbrechen steht der Fokus wieder am Auslöser.
- [ ] **9. Rückwärtskompatibel**: Gegeben zwei Boards; wenn ich `POST /api/boards {titel: "Test"}` sende, dann antwortet der Server weiter 409; ein `PUT …/spalten`, `bewegen` und das Aufgabenarchiv (R00017) verhalten sich unverändert.

### Oberfläche nach UX-Vorprüfung #35

- [ ] **10. Aktionen je Board-Zeile (M1/M8/S1)**: Gegeben die Boards „Entwicklung“ und „Test“; wenn ich den Umschalter öffne, dann trägt **jede Zeile rechts einen eigenen ⋮-Auslöser** (`aria-haspopup="menu"`, kein Knopf im Knopf), der ein `role="menu"` mit dem Namen „Aktionen für Board ‚Test‘“ und den Einträgen Umbenennen, Archivieren und Löschen öffnet; „Löschen“ ist in `--kd-warn` abgesetzt; ein Klick auf den Zeilennamen wechselt weiter das Board.
- [ ] **11. Umbenennen inline (M10/S3)**: Gegeben „Entwicklung“; wenn ich „Umbenennen“ wähle, dann steht ein mit „Entwicklung“ vorbefülltes Feld in der Zeile, `Enter` bestätigt (neuer Titel sichtbar), `Esc` verwirft ohne Schreiben; sende ich einen leeren Titel, dann steht die 400-Meldung des Servers als Feldfehler in `popFehler` (`role="alert"`) und das Feld bleibt offen.
- [ ] **12. Archiv-Abschnitt (M5)**: Gegeben das archivierte Board „Test“ („archiviert am 2026-11-11“); wenn ich den Umschalter öffne, dann steht ein Abschnitt **„ARCHIVIERT (1)“** mit dem Eintrag „Test“, dem Datum und der Aktion **„wieder öffnen“**; der Slug `test.md` steht als Hilfstext; ein Klick auf „wieder öffnen“ setzt `archiviert: false`, und „Test“ steht wieder in der offenen Liste.
- [ ] **13. Fokus und Rückmeldung (M6/S2)**: Gegeben „Test“ ist offen und wird gelöscht/archiviert; wenn die Zeile verschwindet, dann steht der Fokus **nicht auf `BODY`**, sondern auf der nächsten Board-Zeile (gibt es keine, auf `#t-board`); nach dem Umbenennen steht er auf der umbenannten Zeile; nach jeder Aktion erscheint ein Toast `role="status"` im Commit-Wortlaut („Board ‚Test‘ archiviert“, „Board ‚Test‘ endgültig gelöscht“).
- [ ] **14. Defekte Boards ohne stillen Fehlschlag (S4)**: Gegeben ein defektes Board in der Liste; wenn ich es umbenenne, archiviere oder lösche, dann antwortet der Server 423 und die Oberfläche meldet es sichtbar — es sieht nicht so aus, als sei etwas geschehen.
- [ ] **15. Ansichtswechsel deterministisch (S6)**: Gegeben „Entwicklung“ ist offen, „Test“ daneben; wenn ich „Test“ archiviere, dann bleibt „Entwicklung“ offen; archiviere ich „Entwicklung“ (das offene Board), dann wechselt die Ansicht auf „Test“; gibt es kein Board mehr, zeigt die Seite „Kein Board · neues anlegen“.
- [ ] **16. Kein Undo für das Löschen (M4)**: Gegeben ich habe ein Board gelöscht; dann gibt es **keinen** Knopf „rückgängig“ und keinen Toast mit Undo (anders als beim Archivieren, das „wieder öffnen“ anbietet); die Wiederherstellung ist ein `git`-Vorgang (ADR-0022).

## Betroffene Verzeichnisstruktur

```
src/
├── format/board.rs        # `archived` lesen/schreiben (Frontmatter), Rundlauf-Test
├── modell/board.rs        # Feld `archiviert: Option<String>`, Board-Literale; Entnahmesperre board-weit
├── dienst/                # board_anlegen.rs erweitern oder eigenes board_verwalten.rs: umbenennen/archivieren/löschen
├── dienst/mod.rs          # `aktion()` ein Commit; der neue Datei-Löschweg (A00007)
└── web/                   # endpunkte.rs + mod.rs: PATCH/DELETE /api/boards/{slug}, Liste/Schalter, OpenAPI
web/
├── ansicht.js             # Board-Umschalter: ⋮-Auslöser je Zeile, Aktionsmenü, Umbenennen-Feld, Archiv-Abschnitt, Bestätigungsdialog
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
   - 2.1 Der Umschalter (`vBoardPop`) bekommt **je Board-Zeile einen ⋮-Auslöser** mit eigenem Aktionsmenü (`role="menu"`, Name „Aktionen für Board ‚<Titel>‘", M1/S1); `board-wahl` bleibt für den Wechsel.
   - 2.2 Umbenennen: **inline** vorbefülltes Eingabefeld (`Enter` bestätigt, `Esc` verwirft) → `PATCH {titel}`; Fehler in `popFehler` (M10/S3).
   - 2.3 Archivieren/Löschen: **`alertdialog`** (Fokus auf „Abbrechen", Rückgabe an den Auslöser, `Esc` = Abbrechen, Lösch-Wortlaut und Bezeichnung „endgültig löschen", M2/M3/M8/M9) → `PATCH {archiviert}` bzw. `DELETE`; **kein Undo** fürs Löschen (M4); danach Ansicht neu laden (2.4) und Toast `role="status"` im Commit-Wortlaut (S2).
   - 2.4 Ist das offene Board weg, auf das erste verbleibende Board oder den leeren Zustand wechseln; **Fokus nie auf `BODY`** (nächste Zeile, sonst `#t-board`, M6); bei einem anderen Board bleibt die Ansicht (S6).
   - 2.5 Archivierter Board-Eintrag im Abschnitt **„ARCHIVIERT (n)"** mit Datum und „wieder öffnen" (M5).

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
- `web/ansicht.js` (`vBoardPop` samt ⋮-Auslöser/Menü je Zeile, Umbenennen-Feld, Archiv-Abschnitt, Bestätigungsdialog `vDialog`), `web/app.js` (Aktionen, Ansichtswechsel, Toast, Fokus), `web/kd-app.css` (Dialog/Archiv). Der **Bestätigungsdialog** ist ein gemeinsames Primitiv mit **R00141** (Notiz).

### Gestaltung

Der **Board-Umschalter** ist eine gesehene Gestaltung (D0002); neu sind **drei Aktionen je Eintrag (⋮-Menü)**, ein **Bestätigungsdialog** (Archivieren/Löschen) samt **Archiv-Abschnitt**. Die **UX-Vorprüfung #35 liegt vor (2026-11-11, 10 Muss M1–M10, oben und in den AK eingearbeitet)**; danach ist Artboard **D0002** um den Zustand „Boards verwalten“ zu verfeinern (`/wireframe verfeinern D0002`) und **vor dem Bau der Oberfläche** vom product-owner freizugeben (PO Z. 153; hell/dunkel, 1280/414/320 px). Kein neuer Farbwert (ADR-0011); das „Löschen" ist in `--kd-warn` abgesetzt (S1, kein neuer Wert). Der Server-Teil (F0103) ist **frei baubar** und wartet nicht auf das Artboard; die Oberflächen-Bubbles (F0104/F0105) warten auf die Freigabe.

## Tests

Nach Skill `test-pyramide`. Jede Szene der User Story wird ein Test, der eine Zustandsänderung in der Board-Datei, im Git-Verlauf oder auf dem Schirm beobachtet (Skill `test-ehrlichkeit`).

- **Integration (`tests/boards.rs`)**: `PATCH {titel}` (Slug/Adresse/Cache bleiben, ein Commit), `PATCH {archiviert}` (Schlüssel gesetzt/entfernt, kein Commit ohne Änderung), `DELETE` (Datei und Cache weg, ein Commit), 400/404/423/409, die 403-Eigentümer-Sperre für Agenten (Archivieren und Löschen), der Mensch frei, `?archivierte=ja`; die Ausnahmen müssen die X00001-Probe („Aufruf vergessen“) grün lassen.
- **E2E (Playwright)**: neu `e2e/tests/r00128-boards-verwalten.spec.js` (Muster `r00008`): Umbenennen (Titel neu, Adresse/Slug unverändert), Archivieren (Board weg, wieder da), Löschen mit Bestätigungsdialog (Board weg, Karten bleiben, Ansicht wechselt), Fehlerfall (leerer Titel), Breitenprobe 320 px, ⋮-Menü und Dialog-Bedienung per Tastatur.
- **Rot vor dem Bau**: jeder Akzeptanztest beginnt als `test.fail` mit Verweis auf #35.
- **Gegenproben (Mutanten)**: Umbenennen zieht den Slug mit (AK 1 rot, bricht ADR-0022), Archivieren lässt das Board in der Liste (AK 2 rot), Löschen ohne Bestätigung (AK 8 rot), Agent darf ein Board mit Karte in einer Menschen-Spalte löschen (AK 5 rot), Löschen ohne Cache → Cache bleibt (AK 4 rot); **Lösch-Dialog mit Undo (AK 16 rot, M4)**, **Fokus fällt auf `BODY` (AK 13 rot, M6)**.
- **Abnahme-Proben je Muss-Befund (UX-Vorprüfung #35; heute rot, nach dem Fix je grün)**:
  - **M1 ⋮-Auslöser:** jede Board-Zeile hat einen eigenen ⋮-Knopf (`role="menu"` je Zeile, `aria-haspopup="menu"`, Name „Aktionen für Board ‚<Titel>‘"); die Zeile selbst wechselt; kein Knopf im Knopf.
  - **M2 Dialog:** `role="alertdialog" aria-modal="true"`, höchstens zwei Aktionen, Fokus startet auf „Abbrechen", `Esc` = Abbrechen, Fokus kehrt an den Auslöser zurück.
  - **M3 Wortlaut:** „Die Board-Datei `boards/<slug>.md` wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte." und Bestätigung „endgültig löschen"; dieselbe Komponente wie R00141.
  - **M4 kein Undo:** nach dem Löschen kein „rückgängig"/Undo; das Archiv hat „wieder öffnen".
  - **M5 Archiv:** sichtbarer Abschnitt „ARCHIVIERT (n)" mit Datum und „wieder öffnen".
  - **M6 Fokus:** nach Umbenennen/Verschwinden der Zeile nie `BODY`; nächste Zeile, sonst `#t-board`.
  - **M7 Leerzustand:** „Kein Board · neues anlegen" mit Weg; das letzte Board darf weg.
  - **M8 Name:** jeder Auslöser/jedes Menü/jeder Dialog trägt den Boardnamen.
  - **M9 Breite:** Dialog ≤ `min(360px, 100% − 32px)`, Text/Knöpfe umbrechen, 320 px ohne Querscrollen.
  - **M10 Tastatur:** `Enter` im Feld bestätigt, `Esc` verwirft; alles ohne Hover.
  - **Sollte:** S1 „Löschen" in `--kd-warn`; S2 Toast `role="status"` im Commit-Wortlaut; S3 inline vorbefüllt mit Feldfehler in `popFehler`; S4 defekte Boards 423 ohne stillen Fehlschlag; S5 `--kd-ziel`; S6 Ansichtswechsel deterministisch.
- **Mitlaufend grün**: `r00008-boards.spec.js`, `tests/boards.rs`, `tests/spalten.rs`, `tests/spalteneinstellungen.rs`, `tests/openapi.rs` (Endpunkt-Tabelle ↔ OpenAPI), `ziele.spec.js`, `kontrast.spec.js`, `kultur.spec.js`, `e2e/einheit/`.

## Abhängigkeiten

- Abhängig von (grün): I0008 Boards wechseln und anlegen (R00008, `POST /api/boards`, 409, `#/board/<slug>`), I0019/I0076 Eigentümer-Sperre (R00097/R00120, `entnahme_erlaubt`, `entnahme_pruefen`), I0025 Defekte Dateien zeigen (R00025, 423).
- Vor: [ADR-0022](../Dokumentation/ADRs/0022-board-umbenennen-archivieren-loeschen.md) (Akzeptiert, `100dd81`); nachzuziehen A00005/A00006/A00007/X00001.
- Gestaltung: **ux-Vorprüfung #35 liegt vor** (2026-11-11, 10 Muss M1–M10 eingearbeitet); **Artboard D0002** (Zustand „Boards verwalten“) mit Freigabe des product-owner vor dem Bau der Oberfläche (F0104/F0105); Server-Teil F0103 frei baubar.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren. Zwei Richtungsfragen sind **entschieden (2026-11-11, Betreiber-Empfehlung übernommen)**; der Rest sind Empfehlungen des planers:

1. **Letztes Board** — **entschieden: ja, es darf** archiviert und gelöscht werden; die Instanz darf ohne Board dastehen (leerer Zustand „Kein Board · neues anlegen“), ein neues entsteht mit `POST /api/boards` (M7).
2. **Umbenennen mit Bestätigung?** — **entschieden: nein** (Ziffer 11): eine Textänderung ist reversibel und wird sofort im Umschalter sichtbar; nur Archivieren und Löschen fragen nach.
3. **Rückgängig für das Löschen?** — **entschieden: nein** (M4): Git ist der Papierkorb (ADR-0022 Punkt 3); die Wiederherstellung ist ein `git`-Vorgang, kein Oberflächenknopf; das widerspräche auch ADR-0017 (umkehrbare Aktionen), und die UX-Vorprüfung #35 bestätigt es. Das Archiv dagegen hat „wieder öffnen“.
4. **Archiv sichtbar** — **entschieden: eigener Abschnitt „ARCHIVIERT (n)“** wie das Kartenarchiv, mit Datum und „wieder öffnen“ (M5), optional aufklappbar; `?archivierte=ja` bleibt der API-Weg.
5. **Geteilte Dialogkomponente** (nur Notiz, kein Umbau): der `alertdialog` ist **dieselbe Komponente wie in R00141** (Aufgabe endgültig löschen) — gemeinsames Primitiv mit Aufrufer-Text; der Lösch-Wortlaut nennt die Board-Datei, die Bezeichnung ist in beiden „endgültig löschen“.

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel nach der UX-Vorprüfung: Board-Umschalter mit ⋮-Auslöser je Zeile und offenem Aktionsmenü, Umbenennen-Feld (inline, vorbefüllt, Feldfehler), Bestätigungsdialog (Archivieren und Löschen), Archiv-Abschnitt „ARCHIVIERT (n)“ mit Datum und „wieder öffnen“, Leerzustand „Kein Board · neues anlegen“ bei 1280, 414 und 320 px, je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist eine Lücke: Das Board ist die zentrale Sicht, aber die Pflege der Boards selbst endet bei „wechseln und anlegen“ — wer ein Board umbenennen oder wegräumen will, verlässt die Oberfläche und fasst die Datei an, mit dem Risiko, Dateiname und Anzeige auseinanderzubringen. ADR-0022 hat die Technik entschieden: Der Slug ist Identität (Dateiname, Adresse, Berichte-Cache) und bleibt, der Titel ist Anzeige und darf sich ändern; Archivieren spiegelt das Aufgabenarchiv (bestandserhaltend, ein Frontmatter-Schlüssel); Löschen überlässt die Wiederherstellung der Git-Geschichte. Diese Anforderung macht genau diese drei Wege in der Oberfläche bedienbar. Die Wirkungskette: `PATCH`/`DELETE /api/boards/{slug}` im Server → drei Aktionen im Board-Umschalter mit Bestätigung → der Mensch pflegt seine Boards, ohne die Dateien anzufassen, und keine Adresse, kein Lesezeichen und kein Cache bricht. Der Hebel ist genau hier und nicht eine Ebene tiefer: Ein Slug-umbenennender Weg (Option B) wäre der bequemere Bau, bräche aber genau die stabile Identität, die Berichte-Cache und Lesezeichen tragen — deshalb Titel statt Slug, und deshalb ein Bestätigungsdialog vor dem scharfen Löschen. Die Eigentümer-Sperre (R00097/R00120) wird auf das ganze Board ausgedehnt, damit kein Agent die Menschen-Spalten über ein gelöschtes Board umgeht.

## Missing-Docs
- Das Glossar hat keinen Eintrag für das Board selbst (Titel vs. Slug, `archived`, Archiv) — bislang trägt `D00002` nur den Hauptbereich des Fensters. Vorschlag: nach dem Bau ein Eintrag „Board“ (Slug = Identität, Titel = Anzeige, Archiv wie das Kartenarchiv).
- A00005/A00006 nennen `archived`/`Board.archiviert` noch nicht; sie werden mit dem Bau nachgezogen (Vorschlag im Bericht an den architekt).
- Die drei leicht verwechselbaren Löschbegriffe (**archivieren** R00017, **von Board nehmen** R00020, **endgültig löschen** R00141) und die Board-Variante (Board-Datei entfernen, Aufgaben bleiben) sind im Domänenwissen noch nicht abgegrenzt — Vorschlag: ein Eintrag „Aufgabe aus dem Board nehmen oder löschen“ (auch R00141) und ein „Board-Papierkorb“-Hinweis (Git).

## Notizen

**Einarbeitung UX-Vorprüfung #35 (2026-11-11, 10 Muss):** M1 ⋮-Aktionsauslöser je Board-Zeile (`role="menu"` je Zeile, `aria-haspopup`, Name „Aktionen für Board ‚<Titel>‘“, kein Knopf im Knopf), M2 Bestätigungsdialog `role="alertdialog" aria-modal="true"` (höchstens zwei Aktionen, Start-Fokus „Abbrechen“, Rückgabe an den Auslöser, `Esc` = Abbrechen), M3 Lösch-Wortlaut wörtlich („Die Board-Datei `boards/<slug>.md` wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte.“), M4 kein Undo/„rückgängig“ fürs Löschen (Abgrenzung ADR-0017; das Archiv hat „wieder öffnen“), M5 sichtbarer Abschnitt „ARCHIVIERT (n)“ mit Datum und „wieder öffnen“, M6 Fokus nach Umbenennen/verschwindender Zeile (nie `BODY`; nächste Zeile, sonst `#t-board`), M7 Leerzustand „Kein Board · neues anlegen“ mit Weg, M8 zugänglicher Name mit Boardnamen je Aktion/Dialog, M9 320 px ohne Querscrollen (Dialog ≤ `min(360px, 100% − 32px)`, Text/Knöpfe umbrechen), M10 Tastatur (`Enter` im Feld, `Esc` verwirft im Feld, alles ohne Hover). **Sollte:** S1 „Löschen“ abgesetzt `--kd-warn`, S2 Toast `role="status"` je Aktion im Commit-Wortlaut, S3 Umbenennen inline vorbefüllt mit Feldfehler in `popFehler`, S4 defekte Boards ohne stille Fehlschläge (423), S5 `--kd-ziel`, S6 Ansichtswechsel deterministisch. **Optional:** Archiv aufklappbar (`<details>`), Slug als Hilfstext. Zwei Richtungsfragen entschieden: **das letzte Board darf** weg (M7), **Lösch-Wortlaut „endgültig löschen“ mit R00141 vereinheitlicht** (dieselbe `alertdialog`-Komponente).

**Geteilte Komponente (nur Notiz, kein Umbau):** Der Bestätigungsdialog ist **dieselbe `alertdialog`-Komponente** wie in **R00141** (Aufgabe endgültig löschen) — ein gemeinsames Primitiv (`role="alertdialog"`), das Aufrufer-Titel, -rumpf und -bestätigungswort erhält. R00128 setzt den Board-Wortlaut (M3), R00141 den Aufgaben-Wortlaut; beide benutzen die Bezeichnung „endgültig löschen“. Mit der UX-Vorprüfung #36 (Befund B6) bekräftigt und mit der Freigabe #35 bestätigt (`.al-dialog`, PO-Entscheidungen Z. 191). Ein eigener Umbau ist nicht nötig.

**Eigene Interaction unter D0002.** Das Board trägt die Aktionen; der Umschalter liegt in der Kopfzeile des Boards. Muster: I0008/R00008 (Boards wechseln und anlegen, unter D0002) — diese Anforderung ist dessen Fortsetzung um Pflege-Aktionen. Anders als R00008 (abgenommen) eine **neue Interaction**, kein roter Nachfahre (Härtungs-/Fortschreibungsregel, `AI-Team/gelerntes.md` 2026-11-11).

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — Aktionen je Board im bestehenden Umschalter, Bestätigungsdialog für Archivieren/Löschen** (gewählt): kleinster Eingriff, alles an einem gesehenen Ort; deckt die Karte („in der Oberfläche“) und ADR-0022.
- **B — eigenes „Board verwalten“-Fenster** (wie das Aufgabenfenster): trennt Anzeige und Pflege, kostet aber einen neuen Dialog samt Fokusführung für drei Aktionen; verworfen.
- **C — Rechtsklick-Kontextmenü auf dem Boardnamen**: auf Touch unentdeckbar, Tastatur umständlich, widerspricht der Auffindbarkeit (R00033-Kontextmenüs sind Ergänzung, nicht einziger Weg); verworfen.
- **D — nur über die API** (kein UI): widerspricht der Karte; verworfen.

**Verwiesenes**
- Karte #35 „Board umbenennen, archivieren, löschen in der Oberfläche“ (Herkunft: Beratung product-owner 2026-11-03; Referenz Trello, Planka, Wekan; Priorität PO niedrig).
- ADR-0022 (Commit `100dd81`, Option A, Akzeptiert): Titel ändern/Slug bleibt, `archived`-Flag, Datei löschen.
