---
id: R00216
status: Neu
datum: 2026-11-21
---

# R00216: Transkripte der Agentenläufe ablegen (API und Schalter in der Datei)

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karte #208), wörtlich: „… vermutlich einfach eine Ablage wie Anhänge … Die API müsste auch hier einen Endpunkt geben, so ähnlich wie die Kosten hinterlegt werden können soll auch so ein Lauf einfach hinterlegt werden können.“

**Umfang (Scheibe C1 des Feinschnitts):** Ein Agent oder ein Mensch legt das Transkript eines Agentenlaufs als schon gezippte Datei (`.jsonl.gz`) an einer Karte ab, listet die Transkripte der Karte mit ihrem Zustand, lädt eines herunter und löscht es wieder. Die Datei liegt **unversioniert** im Board-Ordner unter `transkripte/<nr>/`; versioniert wird nur ein kleiner Eintrag `transcripts` an der Karte. Ob abgelegt werden darf, entscheidet der Schalter `record-transcripts` in der Board-Datei bzw. als Vorgabe in `kanbanD.md` — in dieser Scheibe nur **von Hand in der Datei** gesetzt. **Keine Oberfläche:** kein Reiter „Läufe“ (#217), keine Laufansicht (#210), kein Schalter in Einrichten (#218).

Form, Ablage, Pfadschutz, Statuscodes und Reihenfolge der Prüfungen stehen in [ADR-0036](../Dokumentation/ADRs/0036-transkripte-unversioniert-im-ordner-eintrag-an-der-karte.md) Regeln 1–10 und „Durchsetzung“ und werden hier nicht wiederholt, nur in Beispiele übersetzt. Die API folgt dem Vorbild der Kosteneinträge ([R00165](R00165-kosteneintraege-mit-zeitstempel-rolle-und-spalte.md)): Kennung `role@at`, eigene Route, ein Commit je Aktion.

> **Schutz des Nutzers: Kein Transkript gerät je in einen Commit, und keine Aufgaben-, Board- oder Einstellungsdatei wird durch die neuen Schlüssel defekt oder verliert etwas — auch nicht in der Vorversion (AK 13). Der erste Test des Baus ist der Rundlauf einer Datei mit `transcripts` und `record-transcripts` am heutigen Stand.**

> **Schutz der Platte: Weder Anfrage noch Kartendatei nennen je einen Pfad. Der Dateiname entsteht an genau einer Stelle aus Nummer und Kennung; was außerhalb von `transkripte/<nr>/` liegt, wird nie gelesen, geschrieben oder gelöscht (AK 9).**

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110: „die Läufe der Agenten, die an ihr gearbeitet haben“) und Leitplanke „Die Dateien sind der einzige Speicher“ mit dem Zusatz zu Transkripten (Z. 169: gezippt im Ordner, nicht versioniert, vollständig löschbar).

**Beispiel in der Datei** (Schlüssel oben im Frontmatter, hinter `commits`, je Eintrag eine Flusszeile in der Reihenfolge des Hochladens):

```yaml
transcripts:
  - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, bytes: 281234}
```

und daneben, nicht versioniert: `transkripte/.gitignore` (Inhalt `*`) und `transkripte/0001/entwickler@2026-11-13T1034+0100.jsonl.gz`.

**Beispiel-Aufruf** (Kopfzeile `X-KanbanD-Wer` wie bei allen schreibenden Aufrufen):

```
curl -H 'X-KanbanD-Wer: entwickler' \
     -F at='2026-11-13 10:34+01:00' -F role=entwickler -F column=Entwicklung \
     -F datei=@lauf.jsonl.gz  http://127.0.0.1:<port>/api/aufgaben/1/transkripte
→ 201 {kennung: "entwickler@2026-11-13T10:34+01:00", at, role, column, bytes: 281234}
```

### Domänenbezug

Die Begriffe **Kosteneintrag**, **Kennung** (`role@at`), **Transkript** und **Vorgabe des Ordners** werden verwendet; nur letzterer steht im Glossar: [Vorgabe des Ordners](../Dokumentation/Domaenenwissen/D00011-vorgabe-des-ordners.md). Die übrigen fehlen (siehe Offene Fragen).

## Geschäftlicher Nutzen

Die Factory kann nach dieser Scheibe das Transkript jedes Laufs an seiner Karte ablegen, verknüpft über die Kennung mit dem Kosteneintrag desselben Laufs. Die Daten sammeln sich, bevor Reiter und Laufansicht (#217, #210) gebaut werden — diese werden an echten Läufen gebaut statt an Testdaten. Weil die Dateien nicht versioniert sind, wächst das Repository des Boards nicht mit, und ein Transkript lässt sich vollständig löschen.

## Funktionale Anforderungen

1. `POST /api/aufgaben/{nr}/transkripte` (multipart: `at`, `role`, `column`, Datei `datei`) legt eine gzip-Datei bis 10.485.760 Byte ab und schreibt den Eintrag an der Karte in einem Commit, der nur die Aufgabendatei enthält.
2. Der Dateiname entsteht nur aus der Kennung: Rolle kleingeschrieben, jede Folge von Zeichen außerhalb `[a-z0-9]` wird `-`, `-` am Rand entfällt, leer → `lauf`; Zeitpunkt als `JJJJ-MM-TTTHHMM±HHMM`.
3. Abgelegt wird nur, wenn der Schalter für die Aufgabe wirksam „an“ ist: alle Boards der Aufgabe (auch archivierte) sind „an“; Board ohne eigenen Wert → Vorgabe aus `kanbanD.md`; ohne beides „aus“; Aufgabe auf keinem Board → Vorgabe.
4. Bei „aus“ antwortet die API 409 `{fehler, erfassung: "aus", boards}`, bevor sie den Körper liest; nichts wird geschrieben.
5. `GET /api/aufgaben/{nr}/transkripte` liefert `{erfassen, boards_aus, transkripte: [{kennung, at, role, column, bytes, zustand}]}` mit `zustand` ∈ `vorhanden`, `fehlt`, `abweichend`, `unlesbar`, ohne zu entpacken.
6. `GET /api/aufgaben/{nr}/transkripte/{kennung}` liefert die Datei unverändert als `application/gzip` im Antwortbudget; `DELETE` entfernt Eintrag (ein Commit) und Datei.
7. `GET /api/aufgaben/{nr}` und `/api/zustand` liefern die gespeicherten Einträge als `transkripte`, `GET /api/boards[/{slug}]` den eigenen Schalterwert als `transkripte_erfassen` — ohne Zugriff auf `transkripte/`.
8. Endgültiges Löschen einer Aufgabe entfernt `transkripte/<nr>/` ganz; Archivieren, Zurückholen, Ausschalten und Board-Aktionen lassen Einträge und Dateien stehen; Duplizieren nimmt `transcripts` nicht mit.
9. Board- und Einstellungs-Schreiber tragen `record-transcripts` bei jedem Schreiben mit; keine Route setzt ihn in dieser Scheibe.
10. Endpunktliste unter `/api`, OpenAPI-Beschreibung und README „Für Agenten“ nennen die vier Routen und die neuen Felder.

## Nicht-funktionale Anforderungen

- **Lastprofil** (bis 10 Agenten, lesend p95 < 200 ms bei 5.000 Aufgaben): `GET /api/aufgaben`, `GET /api/aufgaben/{nr}` und `/api/zustand` greifen nicht auf `transkripte/` zu; die Kartendatei trägt je Lauf eine Zeile.
- **Speicher:** Hochladen schreibt stückweise in eine Zwischendatei (konstanter Speicher je Upload); Lesen belegt Platz im gemeinsamen Antwortbudget von 64 MB **vor** dem Lesen (ADR-0032 N5.1) und liefert in 64-KB-Stücken.
- **Sicherheit:** ein Pfad unter `transkripte/` entsteht an genau einer Funktion aus Nummer und Kennung; Muster- und Symlink-Prüfung vor jedem Öffnen, Umbenennen und Löschen (ADR-0036 Regel 7). Prüfpunkt für `security-reviewer` und `architektur-reviewer`.
- **Fehlerform:** nach ADR-0003 — `fehler` als erstes Feld; nie 422.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git, Dateien und der API):

- **Board-Ordner** (Git-Repository) mit Board „fabrik“ (Spalten „Eingang“, „Entwicklung“, „Fertig“) und Board „zweit“ (Spalten „Eingang“, „Fertig“). #1 „Transkript ablegen“ in fabrik/„Entwicklung“; #2 in fabrik/„Eingang“ und zugleich in zweit/„Eingang“; #3 in fabrik/„Eingang“. Personen: Mensch `sh`, Agent `entwickler`.
- **Schalter:** `kanbanD.md` trägt `record-transcripts: true`, die Board-Dateien tragen keinen eigenen Wert — außer ein Kriterium sagt es anders. Der Schalter wird von Hand in die Datei geschrieben und committet.
- **Dateien zum Hochladen:** `G1` = gzip von `{"art":"nachricht","wer":"agent","text":"hallo"}` plus Zeilenumbruch, Größe `<g1>` Byte. `G10` = 10.485.760 Byte, beginnt mit `1f 8b 08` (Rest beliebig — der Server entpackt nicht). `G10+1` = dasselbe mit einem Byte mehr. `Z` = 3 Byte `50 4b 03` (Zip statt gzip).
- **Felder:** `at=2026-11-13 10:34+01:00`, `role=entwickler`, `column=Entwicklung`. Daraus Kennung `K = entwickler@2026-11-13T10:34+01:00` und Datei `N = transkripte/0001/entwickler@2026-11-13T1034+0100.jsonl.gz`.
- „Commit-Zahl“ ist `git rev-list --count HEAD` im Board-Ordner.

### Ablegen

- [ ] **AK 1 Ablegen (Abnahme-Probe der Karte):** Gegeben #1 ohne Transkripte und Commit-Zahl n, wenn `entwickler` `G1` mit den Feldern hochlädt, dann antwortet die API 201 mit `{kennung: K, at, role: "entwickler", column: "Entwicklung", bytes: <g1>}`; `N` ist byte-gleich zu `G1`; `transkripte/.gitignore` enthält `*`; die Commit-Zahl ist n+1, Autor `entwickler`, und `git show --name-only HEAD` nennt nur `aufgaben/0001-…md`; die Datei von #1 trägt unter `transcripts` genau die Zeile `- {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, bytes: <g1>}`; `git status --porcelain` ist leer und `git ls-files transkripte` liefert nichts; `GET /api/aufgaben/1` liefert `transkripte: [{kennung: K, at, role, column, bytes}]`.
- [ ] **AK 2 Ablage ohne Eingriff in fremde Dateien:** Gegeben `transkripte/.gitignore` mit dem Inhalt `# von Hand` und `*` (zwei Zeilen), wenn `G1` hochgeladen wird, dann ist die `.gitignore` danach byte-gleich. Gegeben ein frischer Ordner ohne `transkripte/`, wenn kanbanD startet, dann gibt es danach keinen Ordner `transkripte/`. Die `.gitignore` in der Wurzel des Board-Ordners bleibt in beiden Fällen byte-gleich.

### Schalter

- [ ] **AK 3 Wirksamer Schalter (Rechenbeispiel):** Je Zeile: Gegeben die Werte, wenn `G1` an die genannte Aufgabe hochgeladen wird, dann die Antwort. Bei 409 lautet der Rumpf `{fehler, erfassung: "aus", boards: [...]}`, die Commit-Zahl bleibt gleich, und unter `transkripte/` entsteht nichts (auch keine `.gitignore`, keine Zwischendatei).

  | `kanbanD.md` | fabrik | zweit | Aufgabe | Antwort |
  |---|---|---|---|---|
  | — | — | — | #1 | 409, `boards: ["fabrik"]` |
  | `true` | — | — | #1 | 201 |
  | `true` | `false` | — | #1 | 409, `boards: ["fabrik"]` |
  | `false` | `true` | — | #1 | 201 |
  | `true` | — | `false` | #2 | 409, `boards: ["zweit"]` |
  | `true` | — | `false`, zweit archiviert | #2 | 409, `boards: ["zweit"]` |
  | `true` | `true` | `true` | #2 | 201 |
  | `false` | — | — | Aufgabe, deren einziges Board gelöscht wurde | 409, `boards: []` |
  | `true` | — | — | Aufgabe, deren einziges Board gelöscht wurde | 201 |

  „—“ heißt: kein Schlüssel in der Datei. Die 409 kommt, bevor der Körper gelesen wird: ein Upload mit `G10+1` bei „aus“ ergibt ebenfalls 409, nicht 413.
- [ ] **AK 4 Zustand vorher lesbar:** Gegeben die fünfte Zeile von AK 3, wenn ein Agent `GET /api/aufgaben/2/transkripte` ruft, dann erhält er `{erfassen: false, boards_aus: ["zweit"], transkripte: []}`; `GET /api/boards/zweit` liefert `transkripte_erfassen: false`, `GET /api/boards/fabrik` liefert `transkripte_erfassen: null`. Mit `fabrik: true` liefert `GET /api/boards/fabrik` `true`.
- [ ] **AK 5 Schalter übersteht jedes Schreiben, keine Route setzt ihn:** Gegeben fabrik mit `record-transcripts: true` und `kanbanD.md` mit `record-transcripts: false`, wenn #1 nach „Fertig“ gezogen und über `PUT /api/einstellungen` eine Person ergänzt wird, dann stehen beide Schlüssel danach mit unverändertem Wert in ihren Dateien. Wenn `entwickler` oder `sh` `PUT /api/einstellungen` bzw. eine Board-Route mit dem Schalter im Rumpf (`record-transcripts`, `recordTranscripts` oder `transkripte_erfassen`, je `true`) sendet, dann steht in den Dateien danach weiter der alte Wert (Antwort wie bei jedem Schlüssel, den die Route nicht kennt).

### Abweisen — nichts geschrieben

Für jedes Beispiel gilt: die Commit-Zahl bleibt gleich, die Datei von #1 ist byte-gleich, und unter `transkripte/` liegt danach keine neue Datei und keine `*.kanbanD-tmp`.

- [ ] **AK 6 Größe:** Gegeben #1 ohne Transkripte, wenn `G10` hochgeladen wird, dann 201 mit `bytes: 10485760`. Wenn `G10+1` hochgeladen wird (andere Kennung), dann 413 `{fehler}`. Eine Datei von 60 MB ergibt ebenfalls 413.
- [ ] **AK 7 Form der Anfrage:** `Z` → 400; leere Datei → 400; fehlt `at`, `role`, `column` oder `datei` → 400; `column=Gibtsnicht` (keine Spalte eines Boards von #1) → 400; `at=2026-13-45 10:34+01:00` → 400; `role=a@b` → 400; Rolle mit 61 Zeichen → 400; `/api/aufgaben/999/transkripte` → 404; #1 mit defekter Datei → 423. Keine Antwort ist 422.
- [ ] **AK 8 Kennung, Faltung, Höchstzahl:** Gegeben `K` steht an #1, wenn derselbe Upload noch einmal kommt, dann 409 `{fehler, kennung: K}`. Gegeben ein Eintrag mit `role=Code Reviewer` um `2026-11-13 10:34+01:00`, wenn `role=code-reviewer` mit demselben `at` hochgeladen wird, dann 409 `{fehler, kennung: "code-reviewer@2026-11-13T10:34+01:00"}` (beide falten zu `code-reviewer@2026-11-13T1034+0100.jsonl.gz`); eine Minute später (`10:35`) ergibt 201. Gegeben `N` liegt schon als Datei mit dem Inhalt `alt` ohne Eintrag (Rest einer gelöschten Aufgabe), wenn `G1` mit `K` hochgeladen wird, dann 201 und `N` ist byte-gleich zu `G1`. Gegeben #1 trägt 1000 Einträge, wenn ein weiterer kommt, dann 409 `{fehler}`; 999 + 1 wird angenommen.

### Pfadschutz

- [ ] **AK 9 Pfadangriffe über Rolle, Adresse und Symlinks:**
  - (a) Je Rolle wird `G1` mit `at=2026-11-13 10:34+01:00` hochgeladen; Antwort 201, die Datei liegt unter `transkripte/0001/` mit dem Namen der rechten Spalte, und außerhalb von `transkripte/0001/` ist keine Datei neu oder geändert (Vergleich der Dateiliste des Board-Ordners und seines Elternordners vor und nach):

    | `role` | Datei |
    |---|---|
    | `../../x` | `x@2026-11-13T1034+0100.jsonl.gz` |
    | `a/b` | `a-b@2026-11-13T1034+0100.jsonl.gz` |
    | `..` | `lauf@2026-11-13T1034+0100.jsonl.gz` |
    | `C:\x` | `c-x@2026-11-13T1034+0100.jsonl.gz` |
    | `Code Reviewer` | `code-reviewer@2026-11-13T1034+0100.jsonl.gz` |

  - (b) `GET` und `DELETE` auf `/api/aufgaben/1/transkripte/..%2F..%2Fkanban.md`, `…/%2Fetc%2Fpasswd` und `…/entwickler@2026-11-13T1034+0100.jsonl.gz` (Dateiname statt Kennung) ergeben 404; keine Datei wird gelesen oder gelöscht.
  - (c) Gegeben `transkripte/0001` ist ein Symlink auf einen Ordner `aussen/` außerhalb des Board-Ordners, in dem eine Datei mit dem Namen von `N` liegt, und #1 trägt den Eintrag `K`: `GET …/transkripte` liefert für `K` `zustand: "unlesbar"`; `GET …/transkripte/K` ergibt 404 `{fehler, zustand: "unlesbar"}`; ein Upload mit anderer Kennung ergibt 500 `{fehler}` ohne Commit (zweite Linie wie ADR-0008); `DELETE …/K` entfernt den Eintrag (200, ein Commit); endgültiges Löschen von #1 gelingt. In allen Fällen ist `aussen/` danach unverändert (gleiche Dateien, gleiche Inhalte).
  - (d) Dasselbe gilt, wenn `transkripte/` selbst ein Symlink ist, und wenn `N` selbst ein Symlink auf eine Datei außerhalb ist (dann `zustand: "unlesbar"`, die Zieldatei bleibt).

### Lesen und Löschen

- [ ] **AK 10 Liste und Zustände:** Gegeben #1 mit vier Einträgen, wenn `GET /api/aufgaben/1/transkripte` gerufen wird, dann liefert die Liste in Reihenfolge des Hochladens: Datei unverändert → `vorhanden`; Datei gelöscht → `fehlt`; Datei um ein Byte verlängert → `abweichend`; Datei mit erstem Byte `00` → `unlesbar`. Ein von Hand eingetragener formwidriger Eintrag (`- {at: gestern, role: x}`) erscheint als `unlesbar` und macht #1 nicht defekt.
- [ ] **AK 11 Herunterladen:** Gegeben `K` mit `zustand: "vorhanden"`, wenn `GET /api/aufgaben/1/transkripte/K` gerufen wird, dann 200 mit `Content-Type: application/gzip`, ohne `Content-Encoding`, mit `Content-Disposition: attachment` und `X-Content-Type-Options: nosniff`, Rumpf byte-gleich zu `G1`. Unbekannte Kennung → 404; Zustand `fehlt`, `abweichend` oder `unlesbar` → 404 `{fehler, zustand}`. Ausschalten (`kanbanD.md: false`) ändert daran nichts.
- [ ] **AK 12 Antwortbudget voll (Integrationstest):** Gegeben ein auf 12 MB verkleinertes Antwortbudget und eine Lesung von `G10`, deren Client noch nicht abgeholt hat, wenn ein zweites `G10` gelesen wird, dann antwortet die API sofort 503 `{fehler: "Antwortbudget …"}` (ADR-0032 N5.1); nachdem die erste Lesung abgeschlossen ist, ergibt dieselbe Anfrage 200. Der Platz wird belegt, **bevor** die Datei gelesen wird: ein Zähler am einzigen Leseort zeigt bei 503 null gelesene Byte.
- [ ] **AK 13 Löschen, Archivieren, endgültig Löschen, Duplizieren:**
  - (a) `DELETE /api/aufgaben/1/transkripte/K` → 200, genau ein Commit, `GET …/transkripte` ohne `K`, `N` existiert nicht mehr. Unbekannte Kennung → 404 ohne Commit. Fehlt die Datei schon oder ist der Schalter „aus“, gelingt `DELETE` trotzdem (200, ein Commit).
  - (b) Archivieren und Zurückholen von #1 lassen Einträge und Datei unverändert (`GET …/transkripte/K` vorher und nachher byte-gleich).
  - (c) Gegeben #1 mit `K`, wenn #1 endgültig gelöscht und danach eine neue Aufgabe mit der Nummer 1 angelegt wird, dann fehlt `transkripte/0001/`, und `GET /api/aufgaben/1/transkripte` liefert `transkripte: []`.
  - (d) `POST /api/aufgaben/1/duplizieren` ergibt eine Kopie ohne `transcripts`; die Datei von #1 und `N` bleiben.

### Datei und Bestand

- [ ] **AK 14 Rundlauf und Altbestand:**
  - (a) Eine von kanbanD geschriebene Datei von #1 mit `cost-entries`, `commits` und `transcripts` — mit 0, 1 und 2 Einträgen, dazu einmal mit einem formwidrigen Eintrag und einmal mit einem Eintrag mit unbekanntem Schlüssel (`model: opus`) — übersteht eine Titeländerung über die API zeichengleich bis auf den Titel; #1 ist nicht defekt.
  - (b) **Echter Altbestand:** Kopien echter Aufgabendateien aus dem Board-Ordner der Factory mit `cost-entries` und `commits` (z. B. #207), dazu die Board-Datei und `kanbanD.md` dieses Ordners, überstehen Titeländerung und Ziehen der Karte zeichengleich bis auf die Änderung; es entsteht weder ein Schlüssel `transcripts` noch `record-transcripts`; `GET` liefert `transkripte: []` und `transkripte_erfassen: null`.
  - (c) **Vorversion** (Stand vor dieser Karte, `main` 673ac073, gebaut): sie behält eine Datei mit zwei Einträgen `transcripts` bei einer Titeländerung inhaltsgleich (Blockform erlaubt). Eine Datei mit genau einem Eintrag, die die Vorversion so zurückschreibt, liegt als Beleg unter `tests/altbestaende/main-673ac073/`; diese Version liest sie, die Aufgabe ist nicht defekt, und der Eintrag ist `vorhanden`, sobald `N` daneben liegt. Gegeben `kanbanD.md` ohne Schalter und fabrik mit `record-transcripts: true`: zieht die Vorversion #1 nach „Fertig“, fehlt der Schlüssel danach in der Board-Datei, und diese Version antwortet auf einen Upload an #1 409 (sichere Richtung). Gegeben `kanbanD.md` mit `record-transcripts: true` und fabrik ohne Schalter: ergänzt die Vorversion über `PUT /api/einstellungen` eine Person, fehlt der Schlüssel danach in `kanbanD.md`, und ein Upload ergibt ebenfalls 409. In beiden Fällen bleiben Einträge und Dateien.
- [ ] **AK 15 Beschreibung, Lesen ohne Dateisystem, Wächter:** Endpunktliste unter `/api` und OpenAPI-Beschreibung nennen `POST`, `GET` (Liste und einzeln) und `DELETE` unter `/api/aufgaben/{nr}/transkripte` mit Feldern, Statuscodes (201, 200, 400, 404, 409, 413, 423, 500, 503) und die Felder `transkripte` an der Aufgabe und `transkripte_erfassen` am Board; README „Für Agenten“ hat einen Abschnitt „Transkripte ablegen“ mit dem Beispiel-Aufruf. Gegeben `transkripte/0001` ist für kanbanD nicht lesbar (Rechte `000`), wenn `GET /api/aufgaben/1` und `/api/zustand` gerufen werden, dann antworten beide 200 mit den gespeicherten Einträgen. Während eines Uploads nennt kein Live-Ereignis einen Pfad unter `transkripte/`.

## Betroffene Verzeichnisstruktur

- `src/format/aufgabe.rs` — Schlüssel `transcripts` (`BEKANNT`, lesen, Flusszeilen hinter `commits`, unbekannte Schlüssel eines Eintrags erhalten)
- `src/format/board.rs`, `src/format/einstellungen.rs` — `record-transcripts` lesen und bei jedem Schreiben mitschreiben
- `src/modell/` — Eintrag neben `kosteneintrag.rs`; reine Funktionen für Faltung, Dateiname und wirksamen Schalter
- `src/dienst/` — neuer Dienst `transkripte.rs` neben `kosteneintraege.rs` und `anhaenge.rs`; `archiv.rs` (endgültig löschen), `antwortbudget.rs` (Platz nach Größe vor dem Lesen)
- `src/waechter.rs` — `transkripte/` nicht relevant
- `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs` — Routen und Beschreibung; README „Für Agenten“
- Tests unter `tests/` (Vorbild `tests/kosteneintraege_api.rs`, `tests/anhaenge.rs`, `tests/antwortbudget_strom.rs`), Altbestand unter `tests/altbestaende/main-673ac073/`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Bubbles mit `Eingabe → Ausgabe` stehen in der WBS (`Dokumentation/Planung/kanbanD.md`, I0206):

1. **B1097 Probe am heutigen Stand:** Aufgabe mit `transcripts`, Board und `kanbanD.md` mit `record-transcripts`, echter Altbestand → Titeländerung, Ziehen, `PUT /api/einstellungen` → was heute verloren geht (erwartet: `record-transcripts` fällt beim Schreiben weg, `transcripts` übersteht über `weitere`). Beleg der Vorversion ablegen.
2. **B1098 `transcripts` in Datei und Aufgabe:** Frontmatter ⇄ Einträge (lesbar oder wörtlich `unlesbar`), Flusszeilen hinter `commits`, leer → kein Schlüssel; `transkripte` in `GET /api/aufgaben/{nr}` und `/api/zustand`; Duplizieren ohne.
3. **B1099 Schalter:** `record-transcripts` in Board und `kanbanD.md` lesen und mitschreiben; wirksamer Wert je Aufgabe als reine Funktion (Tabelle AK 3); `transkripte_erfassen` an den Boards; keine Route nimmt ihn an.
4. **B1100 Name und Pfad:** Kennung → gefalteter Name (Tabelle AK 9a) als reine Funktion; **eine** Funktion `(ordner, nr, kennung) → Pfad` mit Musterprüfung und Symlink-Prüfung von `transkripte/` und `transkripte/<nr>/`; `.gitignore` anlegen, wenn sie fehlt.
5. **B1101 Hochladen:** Route `POST` mit der Reihenfolge aus ADR-0036 Regel 5 (404 → 423 → 409 vor dem Körper → stückweise Zwischendatei mit 413/400 → unter der Sperre erneut prüfen → umbenennen, Eintrag, Commit → 201); jeder Fehler räumt die Zwischendatei; Körpergrenze 10 MB + 64 KB; Wächter ignoriert `transkripte/`.
6. **B1102 Liste und Herunterladen:** Zustand je Eintrag (ein `symlink_metadata`, drei Byte); Lesen im Antwortbudget mit Belegen nach Größe **vor** dem Lesen, 64-KB-Stücke, Kopfzeilen.
7. **B1103 Löschen und Lebenszyklus:** `DELETE` (Commit, dann Datei); endgültiges Löschen räumt `transkripte/<nr>/` ohne Symlinks zu folgen, sonst Warnzeile (X00002).
8. **B1104 Beschreibung, Probe im echten Programm, Gate, Anforderung abschließen:** Endpunktliste, OpenAPI, README; US-1..US-8 und die Abnahme-Probe der Karte am gestarteten Programm; Vorversion gegen die Dateien (AK 14c); Mutanten.

### Hinweise

- **Prüfen-dann-Handeln:** Schalter, Kennung, Höchstzahl und Namenskollision werden unter der Sperre gegen die frisch gelesene Datei erneut geprüft (ADR-0036 Regel 5). Zwei gleichzeitige Uploads derselben Kennung ergeben genau einen Eintrag — deterministische Probe mit Haken zwischen Zwischendatei und Sperre (Factory-Lehre „Prüfen-dann-Handeln“).
- **Antwortbudget:** `Antwortbudget::belegen` nimmt heute die schon gelesenen Bytes (`src/dienst/antwortbudget.rs:39`); für Regel 6 braucht es ein Belegen nach Größe, bevor gelesen wird. Zähler am einzigen Leseort (Factory-Lehre „Grenzen, die Arbeit begrenzen“).
- **Wächter:** `waechter::relevant` (`src/waechter.rs:44`) lässt heute alles außer `.git/` und `*.kanbanD-tmp` durch; ohne Änderung lädt jede 10-MB-Datei die offenen Sichten als „extern“ neu.
- Die Zwischendatei trägt die Endung `.kanbanD-tmp` und liegt im Zielordner, damit das Umbenennen auf demselben Dateisystem bleibt.
- Commit-Nachricht nach dem Vorbild der Kosteneinträge, z. B. `#1 Transkript abgelegt: entwickler@2026-11-13T10:34+01:00` bzw. `#1 Transkript entfernt: …`.
- Fundstellen: ADR-0036 „Kontext/Belegt“; Vorbild `src/dienst/kosteneintraege.rs`, `src/web/mod.rs:126–129` (multipart der Anhänge, eigene Körpergrenze), `:1302` (`anhang_ablegen`), `src/format/aufgabe.rs:110` (`yaml_heilen`). Am Code gelesen, nicht gefahren — die erste Bubble ist deshalb eine Probe am heutigen Stand.

## Tests

- **Zuerst:** Rundlauf am heutigen Stand (B1097, ADR-0036 „Durchsetzung“, Format-Test), dazu der Beleg der Vorversion.
- **Unit:** Faltung und Dateiname (Tabelle AK 9a, `+`/`-`-Versatz, 60 Zeichen), wirksamer Schalter (Tabelle AK 3), Zustand aus Metadaten.
- **Integration** gegen einen Wegwerf-Board-Ordner mit Git: AK 1–15, Commit-Zahl und `git status --porcelain` vor und nach jedem Aufruf; Budget-Probe mit verkleinertem Budget (AK 12); Symlink-Proben (AK 9c/d) mit einem Ordner `aussen/`.
- **Mutationsproben** (je ein benannter roter Test): Schalterprüfung vor dem Körper entfernt (AK 3 letzter Satz: 413 statt 409); Nachprüfung unter der Sperre entfernt; Symlink-Prüfung entfernt; Faltung lässt `/` durch; Belegen nach dem Lesen (AK 12); `transkripte/` im Wächter relevant; endgültiges Löschen ohne Räumen (AK 13c).
- **Keine geänderte Erwartung** an bestehenden Tests; die Endpunktliste-Prüfung bekommt die neuen Routen.

## Abhängigkeiten

- **Abhängig von:** I0192 Commit-Verweise an der Karte (R00202, grün) — beide schreiben das Frontmatter in `src/format/aufgabe.rs`; `transcripts` steht hinter `commits`. ADR-0036 steht auf `main` (357ffa48).
- **Blockiert:** D1 #217 (Reiter „Läufe“), D2 #210 (Laufansicht), C2 #218 (Schalter in Einrichten, löst AK 5 zweiter Satz ab), E2 (Factory legt Transkripte ab, `/factory lehren`).

## Offene Fragen

- **An den product-owner (offen, hält den Bau nicht auf):** Braucht es eine Plattengrenze je Ordner? Heute sind 1000 Einträge × 10 MB je Karte möglich. **Bis zur Antwort gilt: keine Grenze** — diese Anforderung enthält keine, eine volle Platte ergibt beim Hochladen 500, die Zwischendatei wird entfernt (ADR-0036 „Negativ“). Eine Grenze käme als eigene Scheibe.
- An den Director (für den `fachspezialist`): Die Begriffe Kosteneintrag, Kennung und Transkript fehlen im Glossar.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Agenten können ab jetzt `POST /api/aufgaben/{nr}/transkripte` nutzen, sobald ein Mensch `record-transcripts: true` in die Board-Datei oder `kanbanD.md` schreibt; angezeigt wird noch nichts (#217 folgt). Alle Instanzen am Board vorher auf diese Version heben — eine Vorversion schaltet beim Schreiben still auf „aus“ (sichere Richtung).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Heute bleibt vom Lauf eines Agenten an der Karte nur ein Kosteneintrag; was der Agent gedacht und getan hat, liegt verstreut in Protokollen der Factory, und ein Reviewer kann es an der Karte nicht nachprüfen. Legt der Agent nach jedem Lauf sein gezipptes Transkript über die API ab (X), steht es mit derselben Kennung wie der Kosteneintrag an der Karte, während die Datei selbst unversioniert im Board-Ordner bleibt (Y) — so kann die Laufansicht (#210) es lesen, ohne dass das Repository wächst oder ein Transkript je in einen Commit gerät (Z). Weil der Dateiname nur aus der geprüften Kennung entsteht und der Schalter standardmäßig „aus“ ist, entsteht dabei weder ein Zugang zu fremden Pfaden noch eine Ablage, die niemand eingeschaltet hat.

## Missing-Docs

- Wie axum 0.8.9 eine Körpergrenze je Route und `Field::chunk` zusammen verhält, wenn der Client mitten im Teil abbricht (Zwischendatei räumen) — am Code der Anhänge gelesen, nicht gefahren.

## Notizen

- Heimat: I0206 unter D0009 „Arbeit hinter der Karte“, Scheibe C1.
- Optionen: in ADR-0036 entschieden (Ablage A, Dateiname N1, Hochladen U1, Lesen L1) — kein eigenes Tableau.
- Bewusst nicht hier: Oberfläche (#217, #210), Umschalten in Einrichten mit 403 für Agenten (#218), Plattengrenze (PO-Frage), Entpacken oder Prüfen des Inhalts auf dem Server (PO Z. 375: kein Entpacken).
- Die Statuscodes für einen Symlink beim Hochladen (500, zweite Linie wie ADR-0008) und das Entfernen des Eintrags bei symlinkter Datei (200, die Datei außerhalb bleibt) legt ADR-0036 nicht wörtlich fest; sie folgen aus Regel 5 („Geht auch, wenn die Datei fehlt“) und Regel 7 und stehen als Entscheidung des planers im Bericht.
