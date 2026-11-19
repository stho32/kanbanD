---
id: R00202
status: Erledigt
datum: 2026-11-19
---

# R00202: Commit-Verweise an der Karte hinterlegen und entfernen (API)

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karte #207), wörtlich: „Und zwar hätte ich gerne ein Verzeichnis von Git Commits an den KanbanD Karten. Die Agents können die automatisch hinterlegen …“

**Umfang (Scheibe A1 des Feinschnitts, Gerüst für #207–#220):** Eine Aufgabe trägt eine Liste von **Commit-Verweisen**: je Eintrag das Kürzel einer registrierten Anwendung und der volle Hash eines Commits in deren Arbeits-Repository. Ein Agent oder ein Mensch hinterlegt Verweise über die API und entfernt sie wieder; beim Hinterlegen prüft kanbanD nur lesend, dass es den Commit im Repository gibt, auch wenn er nur auf dem Zweig eines Worktrees liegt. `GET /api/aufgaben/{nr}` liefert die gespeicherten Verweise roh. **Keine Oberfläche**, keine Zustände, keine Commit-Liste mit Titeln, kein Diff, kein „ersetzen“.

Form, Sicherheitsgrenze, Statuscodes und Befehlsliste stehen in [ADR-0032](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) Punkte 1–4 mit Nachtrag N1.1 und werden hier nicht wiederholt, nur in Beispiele übersetzt.

> **Schutz des Nutzers: Keine Aufgabendatei wird durch den neuen Schlüssel defekt oder verliert etwas — auch nicht in einer älteren Version (AK 9). Der erste Test des Baus ist der Rundlauf einer Datei mit `commits` am heutigen Stand.**

> **Schutz des Arbeits-Repositorys: kanbanD startet dort nur `rev-parse` aus der Liste von ADR-0032 Punkt 3, mit Argumentliste, ohne Shell; eine Eingabe, die die Form verletzt, erreicht Git nie (AK 4, AK 6).**

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: im Arbeits-Repository nur lesen). Baut auf [R00053](R00053-anwendungen-registrieren.md) (Register der Anwendungen) und dem Vorbild [R00165](R00165-kosteneintraege-mit-zeitstempel-rolle-und-spalte.md) (eigener Schlüssel, eigene Route, ein Commit je Aktion).

**Beispiel in der Datei** (Schlüssel oben im Frontmatter, hinter `cost-entries`, Reihenfolge des Hinterlegens; der zweite Eintrag gehört der Standardanwendung):

```yaml
commits:
  - kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e
  - 9c6b91f5d0e3a2b1c4d5e6f7a8b9c0d1e2f3a4b5
```

**Beispiel-Aufruf** (Kopfzeile `X-KanbanD-Wer` wie bei allen schreibenden Aufrufen):

```
POST /api/aufgaben/1/commits
{"commits": ["kd:3f2a9c1"]}
→ 200, die Aufgabe mit commits: ["kd:3f2a9c1e0b7d4a6f8e2c1b0a9d8e7f6a5b4c3d2e"]

DELETE /api/aufgaben/1/commits/kd:3f2a9c1
→ 200, die Aufgabe mit commits: []
```

### Domänenbezug

Die Begriffe **Anwendung**, **Register** und **Standardanwendung** stammen aus R00053 und `src/modell/anwendungen.rs`; im Glossar (`Dokumentation/Domaenenwissen/`) fehlen sie ebenso wie **Commit-Verweis** (siehe Offene Fragen).

## Geschäftlicher Nutzen

Die Factory kann sofort nach dieser Scheibe die Commits jeder Karte hinterlegen; die Daten sammeln sich, bevor Liste (A2), Diff (A3, A4) und Ansicht (B1–B4) gebaut werden — diese werden an echten Verweisen gebaut statt an Testdaten.

## Funktionale Anforderungen

1. `POST /api/aufgaben/{nr}/commits` mit `{commits: [Verweis, …]}` hinterlegt alle neuen Verweise in einem Commit des Board-Repositorys oder keinen (alles oder nichts).
2. Ein Verweis ist `<kürzel>:<hash>` oder `<hash>` (dann Standardanwendung). Kürzel nach R00053 und registriert; Hash 7–64 Zeichen `0-9a-f`, Großbuchstaben werden kleingeschrieben. Ein Kurz-Hash wird zum vollen Hash aufgelöst; gespeichert wird immer der volle Hash, kleingeschrieben.
3. Die Prüfung im Arbeits-Repository verlangt nur, dass das Objekt ein Commit ist — auf welchem Zweig er liegt, spielt keine Rolle (ADR-0032 N1.1).
4. Schon vorhandene Verweise werden übersprungen; ist nichts neu, antwortet die API mit 200 ohne Commit.
5. `DELETE /api/aufgaben/{nr}/commits/{verweis}` entfernt einen Verweis über den vollen Hash oder einen an dieser Karte eindeutigen Präfix ab 7 Zeichen, ohne das Arbeits-Repository zu fragen.
6. `GET /api/aufgaben/{nr}` liefert `commits: [Text]` — die gespeicherten Einträge wörtlich, in der Reihenfolge der Datei, ohne Einträge `[]`.
7. Duplizieren einer Aufgabe nimmt `commits` nicht mit (wie `cost-entries`).
8. Endpunktliste unter `/api`, OpenAPI-Beschreibung und README „Für Agenten“ nennen beide Routen.

## Nicht-funktionale Anforderungen

- **Lastprofil:** `GET /api/aufgaben/{nr}`, `GET /api/aufgaben` und `/api/zustand` starten keinen Git-Prozess im Arbeits-Repository (ADR-0032 Punkt 9).
- **Sperre:** Die Prüfung im Arbeits-Repository läuft vor der Sperre des Board-Ordners; die Sperre wartet nie auf Git im Arbeits-Repository (ADR-0032 Punkt 4).
- **Zeitgrenze:** Ein Git-Prozess im Arbeits-Repository läuft höchstens 10 s, danach wird er beendet → 503 `{fehler}`, nichts geschrieben (ADR-0032 Punkt 3).
- **Fehlerform:** nach ADR-0003 — `fehler` als erstes Feld, bei einem Verweis zusätzlich `verweis` mit dem Text aus der Anfrage; nie 422.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API):

- **Arbeits-Repository R** (Wegwerf, `git init -b main`) mit dem Ordner `Dokumentation/Planung/` (darin `app.md`). Auf `main` die Commits **K1** („a.txt anlegen“) und **K2** („a.txt ändern“). Ein Worktree `R-karte-1` auf dem Zweig `karte/1` mit dem Commit **W1** („b.txt anlegen“). Ein Commit **V1** auf losgelöstem `HEAD` von R, danach zurück auf `main` (V1 erreicht kein Zweig).
- **Board-Ordner** mit Board „fabrik“ (Spalten „Eingang“, „Entwicklung“, „Fertig“), #1 „Verweise hinterlegen“ in „Entwicklung“, #2 in „Eingang“, beide ohne `commits`. Personen: Mensch `sh`, Agent `entwickler`.
- **Register** über `PUT /api/einstellungen`: Anwendung `kd` mit `wbs: <R>/Dokumentation/Planung/app.md`, Anwendung `xx` mit `wbs: /gibt/es/nicht/app.md`; **ohne** `sources.wbs` und `sources.requirements` (also keine Standardanwendung), außer AK 3 sagt es anders.
- Schreibweise: `<K1>` ist der volle Hash (40 Zeichen), `<K1:7>` seine ersten 7 Zeichen. „Commit-Zahl“ ist `git rev-list --count HEAD` im Board-Ordner.

### Hinterlegen

- [x] **AK 1 Hinterlegen (Abnahme-Probe der Karte):** `POST /api/aufgaben/1/commits` mit `{commits: ["kd:<K1:7>"]}` und `X-KanbanD-Wer: entwickler` ergibt 200; in der Datei von #1 steht unter `commits` genau die Zeile `- kd:<K1>` (40 Zeichen); die Commit-Zahl steigt um genau 1 (n → n+1), Autor dieses Commits ist `entwickler`; `GET /api/aufgaben/1` liefert `commits: ["kd:<K1>"]`. Ein zweiter Aufruf mit `["kd:<K2>"]` hängt `kd:<K2>` dahinter an (Reihenfolge des Hinterlegens, nicht nach Datum).
- [x] **AK 2 Zweig eines Worktrees und verwaister Commit:** `POST` mit `["kd:<W1:7>"]` ergibt 200 und speichert `kd:<W1>`, obwohl W1 nur auf `karte/1` im Worktree liegt und das Register auf R zeigt; ebenso `["kd:<V1>"]`, obwohl kein Zweig V1 erreicht.
- [x] **AK 3 Standardanwendung:** Ohne Standardanwendung ergibt `POST` mit `["<K1>"]` (ohne Kürzel) 400 `{fehler, verweis: "<K1>"}`, die Commit-Zahl bleibt gleich. Trägt der Ordner `sources.wbs: <R>/Dokumentation/Planung/app.md`, ergibt derselbe Aufruf 200, und die Zeile lautet `- <K1>` ohne Kürzel.

### Abweisen — nichts geschrieben

Für jedes Beispiel gilt: Antwort 400 `{fehler, verweis}` mit dem Verweis aus der Anfrage, die Commit-Zahl bleibt gleich, die Datei von #1 ist byte-gleich.

- [x] **AK 4 Form des Hashes (ohne Git-Aufruf):** `kd:3f2a9c` (6 Zeichen), `kd:main`, `kd:HEAD`, `kd:3f2a9cg`, `kd:<K1>0` (41 Zeichen in einem SHA-1-Repository: Form gültig, Git findet nichts) werden abgewiesen. `kd:<K1:7>` in Großbuchstaben wird angenommen und kleingeschrieben gespeichert. Grenze: genau 7 Zeichen angenommen, 6 abgewiesen; 64 Zeichen haben gültige Form, 65 nicht. Ein Kurz-Hash, den Git als mehrdeutig ablehnt, ergibt 400 (belegt im Test des Moduls; ein gleicher 7er-Präfix zweier Commits lässt sich von außen nur mit Zehntausenden Commits herstellen). Der Hash eines Blobs (`git rev-parse K1:a.txt`) ergibt 400 — er ist kein Commit.
- [x] **AK 5 Unbekannt, nicht vorhanden, alles oder nichts:** `xy:<K1>` (Kürzel nicht registriert) → 400; `kd:0000000` (gibt es nicht) → 400; `xx:<K1>` (Ordner des Registers fehlt) → 400 mit einem `fehler`, der das fehlende Repository nennt. `{commits: ["kd:<K2>", "kd:0000000"]}` → 400 mit `verweis: "kd:0000000"`, und `kd:<K2>` steht danach **nicht** an #1. Ein Rumpf ohne Liste (`{commits: "kd:<K1>"}`), mit unbekanntem Schlüssel oder mit leerer Liste `[]` → 400. Eine unbekannte Aufgabe `/api/aufgaben/999/commits` → 404.
- [x] **AK 6 Eingaben, die Git nie erreichen:** `kd:--output=x`, `kd:../x`, `kd:3f2a9c1;rm -rf x`, `kd:3f2a9c1 --all`, `kd:3f2a 9c1`, `kd:$(touch x)` und `kd:3f2a9c1^{tree}` ergeben je 400; danach liegt weder in R noch im Board-Ordner eine Datei `x`, `git status --porcelain` in R ist unverändert, und keiner dieser Texte kommt in einem Git-Aufruf vor (Probe: Server mit `GIT_TRACE=<datei>` gestartet, die Spur enthält keinen davon; im Test zusätzlich ein Zähler der Git-Aufrufe im Modul: 0).

### Wiederholen und Entfernen

- [x] **AK 7 Wiederholung und Grenze:** Steht `kd:<K1>` an #1, ergibt `POST` mit `["kd:<K1:7>"]` 200 ohne Commit (Commit-Zahl gleich); `["kd:<K1>", "kd:<K1:7>", "kd:<K2>"]` schreibt nur `kd:<K2>` dazu, mit genau einem Commit; derselbe Verweis zweimal im selben Aufruf zählt einmal. Trägt #1 schon 500 Verweise, ergibt jeder weitere neue Verweis 409 `{fehler}` (Vorbild Höchstzahl der Kosteneinträge), nichts geschrieben; 499 + 1 wird angenommen.
- [x] **AK 8 Entfernen:** An #1 stehen `kd:<K1>` und `kd:<K2>`. `DELETE /api/aufgaben/1/commits/kd:<K1:7>` ergibt 200, genau einen Commit, `GET` liefert nur noch `["kd:<K2>"]`; mit dem vollen Hash `kd:<K2>` ebenso. `DELETE …/kd:0000000` → 404 `{fehler, verweis}`; `DELETE …/kd:3f2a9c` (6 Zeichen) → 400. Wird R danach umbenannt (Repository fehlt), lässt sich ein Verweis trotzdem entfernen — 200, ein Commit. Passen zwei Verweise der Karte zum Präfix, → 400 `{fehler, verweis}`, nichts entfernt.

### Datei und Bestand

- [x] **AK 9 Rundlauf und Legacy:**
  - (a) Eine von kanbanD geschriebene Datei von #1 mit `commits` aus `kd:<K1>`, `<K2>` (ohne Kürzel), dem unlesbaren Eintrag `kd:zz` und dem Hash aus lauter Ziffern `1234567890123456789012345678901234567890` übersteht eine Titeländerung über die API zeichengleich bis auf den Titel; #1 ist nicht defekt, `GET` liefert alle vier Einträge wörtlich, der Ziffern-Hash als Text (nicht als Zahl).
  - (b) Eine alte Datei ohne `commits` (#2) bekommt durch eine Titeländerung keinen Schlüssel `commits`; `GET /api/aufgaben/2` liefert `commits: []`.
  - (c) Der Stand vor dieser Karte (`main` ohne #207, gebaut) behält eine Datei mit `commits` bei einer Titeländerung zeichengleich (unbekannter Schlüssel, ADR-0028 Option B).
  - (d) `POST /api/aufgaben/1/duplizieren` ergibt eine Kopie ohne `commits`.
- [x] **AK 10 Beschreibung und Lesen ohne Git:** Die Endpunktliste unter `/api` und die OpenAPI-Beschreibung nennen `POST /api/aufgaben/{nr}/commits` und `DELETE /api/aufgaben/{nr}/commits/{verweis}` mit Rumpf, Statuscodes (200, 400, 404, 409, 503) und dem Feld `commits` an der Aufgabe; README „Für Agenten“ hat einen Abschnitt „Commits an der Karte hinterlegen“ mit dem Beispiel-Aufruf. `GET /api/aufgaben/1` und `/api/zustand` starten keinen Git-Prozess im Arbeits-Repository (Zähler im Modul: 0), auch wenn `kd:<K1>` an #1 steht.

## Betroffene Verzeichnisstruktur

- `src/format/aufgabe.rs` — Schlüssel `commits` in `BEKANNT`, lesen und schreiben (Skalar-Helfer)
- `src/modell/aufgabe.rs` — Feld der Aufgabe; neues Modell für den Verweis neben `src/modell/anwendungen.rs`
- `src/git/arbeitsrepo.rs` (Arbeitsname, ADR-0032 Punkt 3) — einziger Ort, der Git in Arbeits-Repositories startet
- `src/dienst/` — neuer Dienst `commits.rs` neben `kosteneintraege.rs`
- `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs` — Routen und Beschreibung
- `README.md` „Für Agenten“; Tests unter `tests/` mit Wegwerf-Repository samt Worktree

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B0988 Probe am heutigen Stand:** Datei mit `commits` (AK 9a-Bestand) → Titeländerung → zeichengleich, nicht defekt (heute grün über `weitere`; bleibt die Wache für AK 9c).
2. **B0989 `commits` in Datei und Aufgabe:** Frontmatter ⇄ `Vec<String>` wörtlich, Blockliste hinter `cost-entries`, Skalar-Helfer; leer → kein Schlüssel; `GET` liefert `commits`; Duplizieren ohne.
3. **B0990 Verweis lesen und Form prüfen, ohne Git:** Text → `(kürzel, hash)` oder Fehler mit `verweis`; Kürzel nach `kuerzel_gueltig` und registriert, ohne Kürzel nur Standardanwendung; Hash `^[0-9a-f]{7,64}$` nach Kleinschreibung.
4. **B0991 Modul Arbeits-Repository:** Anwendung → Wurzel (`rev-parse --show-toplevel` im Ordner der WBS, ohne WBS-Pfad im Anforderungsordner); Hash → voller Hash über `rev-parse --verify --quiet --end-of-options <h>^{commit}`; feste Befehlsliste, Argumentliste ohne Shell, Umgebung `GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0`, Zeitgrenze 10 s; Zähler der Aufrufe für Tests.
5. **B0992 Routen `POST`/`DELETE …/commits`, Endpunktliste, OpenAPI, README:** Prüfung vor der Sperre, Schreiben über `aufgabe_schreiben`; Statuscodes nach AK 4–8.
6. **B0993 Probe im echten Programm, Gate, Anforderung abschließen.**

### Hinweise

- **Prüfen-dann-Handeln:** Weil die Git-Prüfung vor der Sperre läuft, prüft der Schreibschritt unter der Sperre Duplikate und die Höchstzahl erneut gegen die frisch gelesene Datei — zwei gleichzeitige `POST` desselben Verweises ergeben einen Eintrag (deterministische Probe mit Haken zwischen Prüfung und Sperre, `gemeinsam/gelerntes.md` der Factory).
- Commit-Nachricht nach dem Vorbild der Kosteneinträge, z. B. `#1 Commits hinterlegt: kd:3f2a9c1` bzw. `#1 Commit-Verweis entfernt: kd:3f2a9c1`.
- `GIT_TRACE` als Probe für AK 6 setzt voraus, dass das Modul die Umgebung nicht leert; tut es das, gilt der Zähler im Modul.
- Ein unlesbarer Eintrag lässt sich in dieser Scheibe nur in der Datei entfernen (`DELETE` verlangt die Form); er bleibt wörtlich stehen.
- Fundstellen: ADR-0032 „Kontext/Belegt“ und „Quellen“; Vorbild `src/dienst/kosteneintraege.rs`, `src/dienst/aufgabe_aendern.rs:14`, `src/git.rs`. Am Code gelesen, nicht gefahren — die erste Bubble ist deshalb eine Probe am heutigen Stand.

## Tests

- **Zuerst:** Rundlauf der Datei mit `commits` am heutigen Stand (B0988, ADR-0032 „Durchsetzung“, Format-Test).
- API-Tests gegen ein Wegwerf-Repository mit Worktree (AK 1–8), Zahl der Commits im Board-Repository vor und nach jedem abgewiesenen Aufruf.
- Mutationsproben: `--end-of-options` entfernt; Formprüfung des Hashes auf `^[0-9a-f]+$` gelockert; Duplikatprüfung unter der Sperre entfernt; `^{commit}` entfernt (AK 4 Blob muss rot werden).
- **Keine geänderte Erwartung** an bestehenden Tests; die Endpunktliste-Prüfung (falls vorhanden) bekommt die zwei Routen.

## Abhängigkeiten

- **Abhängig von:** — (ADR-0032 mit N1 steht auf `main`, 0391f9a7)
- **Blockiert:** A1b #219 (ersetzen), A2 #211 (Commit-Liste), A3 #213, C1 #208 (beide schreiben das Frontmatter der Aufgabe), E1 (Factory hinterlegt, `/factory lehren`)

## Offene Fragen

Keine, die den Bau aufhalten. An den Director (für den `fachspezialist`): Die Begriffe Anwendung, Register, Standardanwendung und Commit-Verweis fehlen im Glossar.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Agenten können ab jetzt `POST /api/aufgaben/{nr}/commits` nutzen; angezeigt wird noch nichts (B1 folgt).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Heute weiß eine Karte nicht, welche Commits für sie entstanden sind — ein Reviewer sucht sie über Commit-Nachrichten. Hinterlegt der Agent nach jedem Bericht die Hashes seiner Karte (X), stehen sie geprüft und dauerhaft in der Kartendatei, schon während der Arbeit auf dem Kartenzweig (Y), und Liste, Diff und Review-Ansicht (A2–B4) können sie lesen, ohne zu raten (Z). Weil die Prüfung nur `rev-parse` mit fester Form startet und die Datei verlustfrei bleibt, entsteht dabei weder ein Zugang zu beliebigen Pfaden noch ein Verlust in älteren Versionen.

## Notizen

- Heimat: I0192 unter D0009 „Arbeit hinter der Karte“ (neu). Die Folgescheiben hängen dort später als Geschwister-Interactions.
- Optionen: im ADR-0032 entschieden (Verweis statt gespeichertem Diff, Form im Frontmatter, Register statt Pfad) — kein eigenes Tableau.
- Kurz-Hash-Regel nach ADR-0032 Punkt 3 (7–64 Hex, Großbuchstaben erlaubt), nicht nach PO Z. 366 (7–40): die 64 tragen SHA-256-Repositories.
