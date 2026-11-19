---
id: R00204
status: Neu
datum: 2026-11-19
---

# R00204: Commit-Liste einer Karte per API lesen

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karte #207, Nachtrag N1) und Karte #211.

**Umfang (Scheibe A2 des Feinschnitts, baut auf [R00202](R00202-commit-verweise-an-der-karte-hinterlegen-und-entfernen.md)):** `GET /api/aufgaben/{nr}/commits` liefert zu jedem Commit-Verweis der Karte, was ein Reviewer wissen will: **Titel, Autor, Datum, `+`/`−` und einen Zustand** — und beim Zustand `auf_zweig`, **auf welchen Zweigen** der Commit liegt. Gelesen wird live aus dem Arbeits-Repository des Registers, nur lesend, ohne die Sperre des Board-Ordners. **Keine Oberfläche** (B1), kein Diff (A3, A4), kein Nachfolgervorschlag (A5), kein neues Dateiformat, keine neue Zugriffsgrenze.

Die Zustände heißen nach ADR-0032 Nachtrag N1.2 `auf_zweig`, `verwaist`, `fehlt`, `repository_fehlt`, `anwendung_unbekannt` und `unlesbar`. Die Namen `vorhanden` und `nicht_auf_zweig` aus der Kartenbeschreibung und aus Punkt 5 des ADR gibt es nicht mehr (N1.2). Form, Befehlsliste, Kosten der Zweigliste und Härtung stehen in [ADR-0032](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) Punkte 2, 3 und 5, N1.2, N1.3 und N2.3 und werden hier nicht wiederholt, nur in Beispiele übersetzt.

**Abnahme-Probe der Karte (Feinschnitt A2, wörtlich):** „Wegwerf-Repository mit Worktree, fünf Verweise: auf `main` → `auf_zweig [main]`; nur auf dem Zweig des Worktrees → `auf_zweig [karte/1]`; vor dem Rebase → `verwaist`; gelöscht → `fehlt`; nur auf `refs/remotes/o/x` → `auf_zweig`, `entfernte_zweige [o/x]`. Die zweite Liste ruft kein `--contains` auf, nach Bewegen eines Zweigs wieder. **Lastprobe:** 30 Verweise, ~20.000 Commits, ~50 Zweige, ohne `commit-graph`, kalt p95 < 200 ms.“ — sie steckt in AK 1, 2, 10 und 11.

> **Schutz des Arbeits-Repositorys: Lesen führt dort nichts aus und ändert nichts. Weder ein von Hand geschriebener Verweis (AK 12) noch die Konfiguration, die Attribute oder die Umgebung des Repositorys (AK 14) bringen Git dazu, ein Programm zu starten; bei einer Zeitüberschreitung stirbt die ganze Prozessgruppe (AK 9, AK 14).**

> **Schutz des Nutzers: Lesen hält die Sperre des Board-Ordners nie (AK 8) und schreibt nie (AK 8, AK 15). Ein hängendes Git blockiert keinen Schreibvorgang und antwortet spätestens nach 15 s mit 503 (AK 9).**

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: im Arbeits-Repository nur lesen).

**Beispiel-Aufruf** (kein `X-KanbanD-Wer` nötig, wie bei den anderen lesenden Aufrufen; an #1 stehen `kd:K3…`, `kd:W1…`, `kd:V2…`):

```
GET /api/aufgaben/1/commits
→ 200
{"commits": [
  {"verweis": "kd:<K3>", "anwendung": "kd", "hash": "<K3>", "zustand": "auf_zweig",
   "zweige": ["main"], "entfernte_zweige": ["o/main"],
   "titel": "c.txt anlegen", "autor": "Ada Autorin", "datum": "2026-03-01T10:00:00+01:00",
   "plus": 3, "minus": 0, "dateien": 1},
  {"verweis": "kd:<W1>", "anwendung": "kd", "hash": "<W1>", "zustand": "auf_zweig",
   "zweige": ["karte/1"], "entfernte_zweige": [], "titel": "b.txt anlegen", …},
  {"verweis": "kd:<V2>", "anwendung": "kd", "hash": "<V2>", "zustand": "fehlt"}
]}
```

### Domänenbezug

Die Begriffe **Anwendung**, **Register**, **Standardanwendung** und **Commit-Verweis** wie in R00202 und R00203; im Glossar fehlen sie weiterhin (dort als offene Frage genannt). Neu sind **Zustand** eines Verweises und **verwaist** (der Commit existiert, aber kein Zweig erreicht ihn); sie gehören ins Glossar, sobald der `fachspezialist` es pflegt.

## Geschäftlicher Nutzen

Heute weiß ein Reviewer-Agent von seiner Karte nur eine Liste von Hashes. Mit der Liste sieht er in einem Aufruf, **was** hinter der Karte steckt (Titel, Autor, Datum, Umfang) und **wo es liegt**: schon auf `main`, noch auf dem Kartenzweig, auf `origin/…` oder auf keinem Zweig mehr. Der Zustand `verwaist` meldet nach einem Rebase sofort, dass Verweise nachzuziehen sind (A1b `ersetzen`, A5 Nachfolgervorschlag); `fehlt` meldet einen verschwundenen Commit. Die Reiter B1 bis B3 und die Diffs A3 und A4 setzen auf diese Zustände auf.

## Funktionale Anforderungen

1. `GET /api/aufgaben/{nr}/commits` antwortet mit `{commits: [Eintrag, …]}`, je Verweis der Karte genau ein Eintrag, auch bei doppelten Einträgen in der Datei. Lesen darf jeder (Mensch und Agent), ohne `X-KanbanD-Wer`.
2. Jeder Eintrag trägt **immer** `verweis` (wörtlich wie in der Datei) und `zustand`. Dazu, soweit lesbar: `anwendung` (das Kürzel; leerer Text für die Standardanwendung) und `hash` (voll, kleingeschrieben).
3. **Zustände** nach ADR-0032 N1.2, geprüft in dieser Reihenfolge:
   - `unlesbar` — der Eintrag verletzt die Form (`<kürzel>:<hash>` oder `<hash>`, Hash 7–64 Zeichen `0-9a-f`, auch groß) oder ein Kurz-Hash ist mehrdeutig; Feld `grund`. Ein Eintrag, der die Form verletzt, erreicht Git nie; ein mehrdeutiger Kurz-Hash wird von `cat-file --batch-check` als `ambiguous` gemeldet und ist `unlesbar` mit `grund`, gleich welchen Typs die Treffer sind.
   - `anwendung_unbekannt` — das Kürzel ist nicht registriert, oder es gibt kein Kürzel und keine Standardanwendung.
   - `repository_fehlt` — Ordner fehlt, ist kein Git-Repository oder Git verweigert ihn; Feld `grund`.
   - `fehlt` — im Repository gibt es kein Commit-Objekt zu diesem Hash (auch nicht, wenn das Objekt ein Blob, ein Baum oder ein Tag-Objekt ist; es wird nicht zum Commit aufgelöst, nur der Typ `commit` zählt).
   - `auf_zweig` — mindestens ein lokaler oder entfernter Zweig erreicht den Commit. Felder `zweige` (lokal, ohne `refs/heads/`) und `entfernte_zweige` (ohne `refs/remotes/`, ohne `*/HEAD`), beide immer da, auch leer; je höchstens 10, alphabetisch; `zweige_weitere: n` nur wenn n > 0, gezählt über beide Listen zusammen. Tags zählen nicht.
   - `verwaist` — der Commit existiert, kein Zweig erreicht ihn (auch nicht der losgelöste `HEAD` eines Worktrees).
4. Bei `auf_zweig` und `verwaist` kommen dazu `titel` (erste Zeile der Nachricht, höchstens 500 Zeichen, siehe unten), `autor` (nur der Name, nie die E-Mail-Adresse), `datum` (Commit-Datum, ISO 8601 mit Zeitzone des Commits), `plus`, `minus` (Zeilen) und `dateien` (Zahl der berührten Dateien), gerechnet gegen den **ersten Elternteil**, beim Wurzel-Commit gegen den leeren Baum (ADR Punkt 6). Felder, die zum Zustand nicht passen, fehlen (nie `null`). **`titel` ist die erste Zeile der Nachricht, höchstens 500 Zeichen (Unicode-Zeichen, nicht Bytes). Ist sie länger, steht dort der Anfang mit genau 500 Zeichen, gefolgt von „…“ (501 Zeichen); bis einschließlich 500 Zeichen bleibt sie unverändert. Ein Zeichen wird nie mitten im Mehrbyte- oder Ersatzpaar zerschnitten.**
5. **Reihenfolge:** Einträge mit Datum aufsteigend nach dem Zeitpunkt des Commit-Datums (nicht nach dem Text), bei Gleichstand in der Reihenfolge der Datei; Einträge ohne Metadaten (`fehlt`, `unlesbar`, `repository_fehlt`, `anwendung_unbekannt`) danach in der Reihenfolge der Datei.
6. Eine Karte ohne Verweise ergibt `{commits: []}` und startet kein Git. Eine unbekannte Aufgabe ergibt 404, eine defekte Datei 423 wie `GET /api/aufgaben/{nr}`.
7. Je Repository gilt dasselbe Vorgehen für alle seine Verweise: Wurzel, Prüfung der Objekte, Metadaten, Fingerabdruck der Zweigspitzen, dann für jeden Commit ohne Treffer im flüchtigen Cache die Zweigliste (ADR-0032 N1.3, N3): je Commit `for-each-ref --contains` (Z1) oder, wenn die Messung in B0998 es verlangt, ein Lauf `rev-list --parents --branches --remotes` mit Erreichbarkeit im Speicher (Z5, ADR-0032 N3.4); beide liefern dieselben Listen. Ein defektes oder fehlendes Repository stört die Verweise anderer Anwendungen nicht.
8. Die Route steht in Endpunktliste, OpenAPI-Beschreibung und README „Für Agenten“.

## Nicht-funktionale Anforderungen

- **Lastprofil:** `GET /api/aufgaben/{nr}`, `GET /api/aufgaben` und `/api/zustand` starten weiter kein Git. Die Liste braucht bei **30 Verweisen** in einem Repository mit **~20.000 Commits und ~50 Zweigen, ohne `commit-graph`**, kalt **p95 < 200 ms** (Herleitung siehe Notizen: gemessen nur bis 2.540 Commits, der Rest ist Hypothese und wird zuerst gemessen).
- **Cache:** nur im Speicher des Prozesses, Schlüssel (Wurzel, SHA-256 des Fingerabdrucks, Hash), höchstens 10.000 Einträge, bei Überlauf wird geleert; nie auf Platte, nie im Board-Ordner. Abgelegt wird am Ende der Anfrage nach einer zweiten Fingerabdruck-Probe; ist der Fingerabdruck dann ein anderer, wird verworfen. Nur erfolgreiche, ganze Zweiglisten kommen in den Cache (nie das Ergebnis eines abgebrochenen oder fehlgeschlagenen Prozesses). Bei Z1: höchstens 4 Zweiglisten-Prozesse gleichzeitig (gilt nur für Z1; Z5 ist ein Prozess).
- **Sperre:** Lesen nimmt die Sperre des Board-Ordners nie.
- **Zeitgrenze:** je Git-Prozess höchstens 10 s, beim Lesen gekürzt auf `min(10 s, Rest der Gesamtgrenze)`; zusätzlich für den **ganzen Aufruf** 10 s ab Anfrage, danach werden alle laufenden Git-Prozesse samt ihren Kindern beendet, es werden keine weiteren gestartet, und die Antwort ist 503 `{fehler}`. Spielraum bis zur Antwort 5 s.
- **Nur lesend:** `kommando()` ist der eine Startort; neue Befehle `cat-file`, `log`, `for-each-ref` stehen in der abschließenden Liste von ADR-0032 Punkt 3.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API; erweitert die von R00203):

- **Arbeits-Repository R** (Wegwerf, `git init -b main`) mit `Dokumentation/Planung/app.md`. Commits mit festen Daten (`GIT_AUTHOR_DATE` und `GIT_COMMITTER_DATE` gleich), Autor „Ada Autorin“, wenn nicht anders genannt. Auf `main`: **K1** „a.txt anlegen“ (2 Zeilen), **K2** „a.txt ändern“, **K3** „c.txt anlegen“ (3 Zeilen, `2026-03-01T10:00:00+01:00`), **K4** „d.txt anlegen“. Worktree `R-karte-1` auf `karte/1`, abgezweigt von K2, mit **W1** „b.txt anlegen“ (Autor „Bernd Beispiel“, `2026-03-02T09:00:00+00:00`). **V1** „v.txt anlegen“ (`2026-03-03T09:00:00+00:00`) auf losgelöstem `HEAD` (dazu ein Tag `v1` auf V1). `refs/remotes/o/main` = K4, `refs/remotes/o/HEAD` zeigt auf `o/main`. **R1** „r.txt anlegen“ (`2026-03-04T09:00:00+00:00`) liegt nur auf `refs/remotes/o/x`. **V2** „w.txt anlegen“ auf losgelöstem `HEAD`, nach dem Hinterlegen aus R entfernt (`git reflog expire --expire=now --all`, `git gc --prune=now`). `<W1'>` ist der Commit, den `git rebase main` im Worktree aus W1 macht.
- **Board-Ordner** wie bei R00203: Board „fabrik“, #1 „Commit-Liste“ in „Entwicklung“, Personen Mensch `sh`, Agent `entw1`; Register über `PUT /api/einstellungen`: Anwendung `kd` mit `wbs: <R>/Dokumentation/Planung/app.md`, **ohne** Standardanwendung, außer ein Kriterium sagt es anders.
- **Karte #1** trägt, über `POST …/commits` hinterlegt, in dieser Reihenfolge `kd:<K3>`, `kd:<W1>`, `kd:<V1>`, `kd:<V2>`, `kd:<R1>`.
- Schreibweise wie R00202; „Commit-Zahl“ ist `git rev-list --count HEAD` im Board-Ordner; „Git-Spur“ ist die Datei, die ein Server mit `GIT_TRACE=<datei>` schreibt; „Marke“ ist eine Datei, die ein Skript des Tests anlegt, wenn es läuft.

### Zustände

- [ ] **AK 1 Fünf Zustände (Abnahme-Probe der Karte):** `GET /api/aufgaben/1/commits` ergibt 200 und fünf Einträge in dieser Reihenfolge (Datum aufsteigend; V2 ohne Metadaten zuletzt):
  - `kd:<K3>`: `auf_zweig`, `zweige ["main"]`, `entfernte_zweige ["o/main"]` (`o/HEAD` steht nicht da), `titel "c.txt anlegen"`, `autor "Ada Autorin"`, `datum "2026-03-01T10:00:00+01:00"`, `plus 3`, `minus 0`, `dateien 1`;
  - `kd:<W1>`: `auf_zweig`, `zweige ["karte/1"]`, `entfernte_zweige []`, `autor "Bernd Beispiel"`;
  - `kd:<V1>`: `verwaist`, mit Titel, Autor, Datum und Zahlen, **ohne** `zweige`, `entfernte_zweige`, `zweige_weitere` (der Tag `v1` zählt nicht);
  - `kd:<R1>`: `auf_zweig`, `zweige []`, `entfernte_zweige ["o/x"]`;
  - `kd:<V2>`: `fehlt`, nur `verweis`, `anwendung`, `hash`, `zustand`.
  Jeder Eintrag trägt `anwendung "kd"`, den vollen `hash` und `verweis` wörtlich wie in der Datei. Der Aufruf ändert weder die Commit-Zahl noch die Datei von #1.
- [ ] **AK 2 Nach einem Rebase und nach dem Merge:** Nach `git rebase main` im Worktree und `POST {commits: ["kd:<W1'>"]}` zeigt die Liste `kd:<W1>` als `verwaist` (kein Zweig erreicht den alten Hash) und `kd:<W1'>` als `auf_zweig ["karte/1"]`. Nach `git merge --ff-only karte/1` auf `main`, Entfernen des Worktrees und `git branch -d karte/1` zeigt der nächste Aufruf `kd:<W1'>` als `auf_zweig` mit `zweige ["main"]` und `entfernte_zweige []` (`o/main` steht noch auf K4 und erreicht W1' nicht); `kd:<W1>` bleibt `verwaist`.
- [ ] **AK 3 Zweiglisten und ihre Grenze:** Gegeben ein Commit Z, den nur 10 lokale Zweige `z01`–`z10` und 10 entfernte `o/e01`–`o/e10` erreichen (dazu ein Tag und `o/HEAD`): `zweige` nennt `z01`–`z10` alphabetisch, `entfernte_zweige` `o/e01`–`o/e10`, `zweige_weitere` fehlt. Mit einem elften lokalen (`z11`) und zwölf entfernten (`o/e11`, `o/e12`) nennen die Listen weiter je zehn, und `zweige_weitere` ist 3 (1 + 2). Ein Zweig mit dem Namen eines Kurz-Hashes (`git branch abcdef0 K3`) ändert nichts an Zustand und `hash` des Verweises `kd:<K3:7>`.
- [ ] **AK 4 Anwendung und Repository:** Gegeben #1 trägt zusätzlich `xx:<K1>` (Register später auf einen Ordner umgestellt, den es nicht gibt), `xy:<K1>` (Anwendung `xy` danach aus dem Register gelöscht), `<K1>` ohne Kürzel (hinterlegt, als es eine Standardanwendung gab, danach entfernt) und `zz:<K1>` (Anwendung `zz` zeigt auf einen Ordner, der kein Git-Repository ist). Dann ist der Zustand der vier: `repository_fehlt` mit `grund`, der den Ordner nennt, `anwendung_unbekannt`, `anwendung_unbekannt`, `repository_fehlt` mit `grund` „kein Git-Repository“; die Verweise der Anwendung `kd` aus AK 1 bleiben unverändert und der Aufruf ergibt 200. Wird `sources.wbs: <R>/Dokumentation/Planung/app.md` als Standardanwendung eingetragen, ist `<K1>` ohne Kürzel `auf_zweig` mit `anwendung ""`.
- [ ] **AK 5 Handgeschriebene Einträge mit gültiger Form:** In der Datei von #1 stehen von Hand: der Hash eines Blobs (`git hash-object -w`) und der eines Baums als `kd:<B>`, `kd:<T>` → je `fehlt`; `kd:<K3:7>` (eindeutiger Kurz-Hash) → wie `<K3>` mit dem **vollen** `hash`, `verweis` wörtlich `kd:<K3:7>`; `kd:<K3>` in Großbuchstaben → `hash` kleingeschrieben, `verweis` wörtlich; `kd:<K1>0` (41 Zeichen in einem SHA-1-Repository) → `fehlt`; ein annotiertes Tag-Objekt (`git tag -a t1 <K3>`, dessen Hash als `kd:<TAG>` von Hand in die Datei geschrieben wird) → `fehlt` (kein Auflösen zum Commit); ein Kurz-Hash, der zu zwei Objekten passt → `unlesbar` mit `grund`, von `cat-file --batch-check` als `ambiguous` erkannt, auch wenn die Treffer ein Commit und ein Blob sind (Probe im Test des Moduls; von außen brauchte es zwei Objekte mit gleichem 7er-Anfang); zweimal `kd:<K3>` → zwei Einträge mit gleichem Inhalt, und die Git-Spur zeigt nicht mehr Aufrufe als bei einem Eintrag.

### Inhalt der Einträge

- [ ] **AK 6 Zahlen, Datum, Autor:**
  - Gegeben ein Commit Z1, der `a.txt` ändert (3 Zeilen hinzu, 1 weg), `b.txt` mit 2 Zeilen anlegt und die Binärdatei `x.bin` ändert, dann ist `plus` 5, `minus` 1, `dateien` 3 (5 = 3 + 2; die Binärdatei zählt als Datei, nicht als Zeile).
  - Ein Commit, der `c.txt` unverändert nach `c2.txt` umbenennt: `plus 0`, `minus 0`, `dateien 1`.
  - Ein leerer Commit (`--allow-empty`): `plus 0`, `minus 0`, `dateien 0`, die Felder stehen da.
  - Der Wurzel-Commit K1 (2 Zeilen): `plus 2`, `minus 0`, `dateien 1`.
  - Ein Merge-Commit (`--no-ff`), der vom Seitenzweig `d.txt` mit 4 Zeilen auf `main` bringt: `plus 4`, `minus 0`, `dateien 1` — gegen den ersten Elternteil.
  - `datum` trägt die Zeitzone des Commits (`+01:00`), `autor` nie eine E-Mail-Adresse, auch nicht, wenn der Name Klammern oder `<` enthält.
- [ ] **AK 7 Reihenfolge und Grenzen des Aufrufs:**
  - Ein Commit mit Datum `2026-03-01T23:30:00-05:00` (Zeitpunkt 2026-03-02T04:30Z) steht **nach** einem mit `2026-03-02T01:00:00+00:00`, obwohl der Text kleiner ist.
  - Zwei Commits mit gleichem Zeitpunkt stehen in der Reihenfolge der Datei.
  - Verweise ohne Metadaten stehen hinter allen mit Metadaten, untereinander in der Reihenfolge der Datei.
  - #2 ohne Verweise: 200 `{commits: []}`, die Git-Spur bleibt leer.
  - `/api/aufgaben/999/commits` → 404 mit `fehler`; eine Aufgabe mit defekter Datei → 423 wie `GET /api/aufgaben/{nr}`.

### Lesen ohne Sperre, Zeitgrenze, Last

- [ ] **AK 8 Lesen ohne Sperre und nur lesend:**
  - Gegeben ein Programm `git` im `PATH` des Servers, das vor jeder Antwort 5 s schläft (Skript). Während ein `GET …/commits` hängt, ergibt `PATCH /api/aufgaben/1` (Titeländerung) 200 in unter 1 s (Schreiben soll nach ADR-0032 Punkt 9 p95 < 500 ms bleiben; die Grenze der Probe liegt mit Abstand darüber, damit sie nicht wackelt). Danach antwortet auch das `GET` mit der Liste.
  - Im Test des Moduls hält ein Schreiber die Sperre des Board-Ordners; `commits_lesen` antwortet, ohne auf ihn zu warten.
  - Nach AK 1, AK 4 und AK 7 ist die Commit-Zahl des Board-Ordners gleich und die Datei von #1 byte-gleich; in R ist `git status --porcelain` leer, keine Datei unter `R/.git` ist neuer als der Zeitpunkt vor dem Aufruf, und es gibt keine `index.lock`.
- [ ] **AK 9 Zeitgrenze und 503:** Gegeben das Programm `git` im `PATH` des Servers schläft 60 s und startet ein Kind (`sleep 300`). Dann antwortet `GET /api/aufgaben/1/commits` nach mindestens 10 s und spätestens 15 s mit 503 und `{fehler}`; danach lebt weder das Skript noch sein Kind (`pgrep -f <Kennzeichen>` leer), es sind keine weiteren Git-Prozesse mehr gestartet worden (Zähler der Aufrufe), und kein abgebrochenes Ergebnis steht im Cache: nach Entfernen des Skripts aus dem `PATH` ergibt derselbe Aufruf 200 mit der Liste aus AK 1. Bei 30 Verweisen und einem Skript, das jeden Aufruf 9 s hält, kommt dennoch nach spätestens 15 s die Antwort (Gesamtgrenze, nicht 8 × 9 s); die Grenze je Prozess ist dabei `min(10 s, Rest der Gesamtgrenze)`, kein Prozess läuft über das Ende der Gesamtgrenze hinaus. **Zweiter Fall (Teilergebnis, bei Z1):** bei 30 Verweisen liefert ein `git`-Skript die ersten 4 Zweiglisten sofort und hält jede weitere 60 s. Dann antwortet der Aufruf nach spätestens 15 s mit 503 und `{fehler}` (nie mit einer Liste, der Zweige fehlen); die Wiederholung ohne Skript ergibt 200 mit der vollständigen Liste, und ihre Git-Spur enthält **4 `--contains` weniger** als die einer kalten Liste (die 4 fertigen Zweiglisten stammen aus dem Cache, abgelegt am Ende der abgebrochenen Anfrage). Eine leere Ausgabe eines abgebrochenen Prozesses gilt nie als „kein Zweig“ (`auf_zweig` wird nicht zu `verwaist`).
- [ ] **AK 10 Lastprobe kalt (Abnahme-Probe der Karte):** Gegeben ein Wegwerf-Repository mit rund 20.000 Commits (mit `git fast-import` erzeugt), 50 Zweigen (30 lokale, 20 entfernte), ohne `commit-graph` (`gc.writeCommitGraph=false`, keine Datei `objects/info/commit-graph`), ein Register mit diesem Repository und eine Karte mit 30 Verweisen — zehn auf Spitzen, zehn tief in der Geschichte, fünf auf mehreren Zweigen, fünf verwaist. Dann liegt die Antwortzeit von `GET …/commits`, gemessen am Client von der Anfrage bis zum letzten Byte, bei 20 kalten Läufen (vor jedem Lauf wird ein Zweig bewegt, der Fingerabdruck ist neu) im 95. Perzentil (dem 19. von 20 sortierten Werten) unter 200 ms, bei Rechnerlast unter 2. Die Zahl der Git-Aufrufe je kaltem Lauf ist bei Z1 5 + 30 (Wurzel, Objektprüfung, Metadaten, Fingerabdruck, zweite Fingerabdruck-Probe am Ende, 30 Zweiglisten), bei Z5 5 + 1. Die Schwelle ändert niemand. Gemessen werden in B0998 **beide** Wege, Z1 (je Commit `--contains`, 4 gleichzeitig) und Z5 (ein Lauf `rev-list --parents --branches --remotes`), je 20 kalte Läufe, p95 über die ganze Antwort (Wurzel, `cat-file`, `log`, Fingerabdruck, Zweiglisten); die Werte stehen in der Commit-Nachricht von B0998. Der entwickler entscheidet ohne Rückfrage nach ADR-0032 N3.4: ist Z1 p95 < 200 ms, bleibt Z1; sonst, ist Z5 p95 < 200 ms, gilt Z5 an Stelle von Z1 (ein Verfahren im Dienst, kein Umschalten nach Größe); reißen beide die Schwelle, baut er nichts Weicheres und meldet `anforderung_falsch` mit den Messwerten (der architekt entscheidet dann per Nachtrag N4 über eine andere Antwortform). Bei Z5 bricht der Lauf bei 3.000.000 Zeilen ab: der Prozess wird beendet und die Antwort ist 503 `{fehler}`, nie eine gekürzte Liste.
- [ ] **AK 11 Cache:** Gegeben die Liste aus AK 1 wurde einmal geholt. Ein zweiter Aufruf bei unveränderten Zweigen startet in der Git-Spur **kein** `--contains` (genau 4 Aufrufe im Repository R: Wurzel, `cat-file`, `log`, Fingerabdruck; die Zahl 4 gilt nur für eine Liste, die ganz aus dem Cache kommt) und liefert dieselbe Liste. Die Spur der **kalten** Liste (erster Aufruf) hat 5 Aufrufe vor den Zweiglisten (Wurzel, `cat-file`, `log`, Fingerabdruck, zweite Fingerabdruck-Probe am Ende). Nach `git branch -f karte/1 <K4>` (ein Zweig bewegt sich) startet der nächste Aufruf wieder die Zweigliste (bei Z1 je Commit ein `--contains`, bei Z5 der eine Lauf), und `kd:<W1>` ist jetzt `verwaist`, nicht mehr `auf_zweig ["karte/1"]` (kein veraltetes Ergebnis). Im Test des Moduls: **nur Z1:** nie mehr als 4 Zweiglisten-Prozesse gleichzeitig und bei 30 Verweisen mindestens 2 (ein Skript zählt sie); bei mehr als 10.000 Einträgen wird der Cache geleert (kein Wachsen ohne Ende); **Zweig bewegt sich zwischen dem ersten und dem zweiten Fingerabdruck → nichts wird abgelegt** (auch bei Bewegung hin und zurück); ein Prozess mit Ausstiegscode ≠ 0 oder Zeitüberschreitung legt nichts ab; **bei Z5** ein Vergleichstest, dass Z1 und Z5 auf demselben Repository (AK 1 und AK 3) dieselben Listen liefern, und der Abbruch bei 3.000.000 Zeilen mit 503.

### Sicherheit

- [ ] **AK 12 Injection über die Datei:** In der Datei von #1 stehen von Hand die Einträge `kd:--output=x`, `kd:../x`, `kd:3f2a9c1;rm -rf x`, `kd:3f2a9c1 --all`, `kd:3f2a 9c1`, `kd:$(touch x)`, `kd:<K1>^{tree}`, `kd:<K1> ` (mit Leerzeichen am Ende), `"kd:<K1>\n<K2>"` (mit Zeilenumbruch) und `kd:<K1>\u0000`. Dann ergibt `GET …/commits` 200; jeder dieser Einträge hat `zustand: "unlesbar"` mit `grund` und `verweis` wörtlich (als JSON-Text maskiert); danach liegt weder in R noch im Board-Ordner eine Datei `x`, `git status --porcelain` in R ist unverändert, die Git-Spur enthält keinen dieser Texte, und die Einträge der gültigen Verweise `kd:<K3>` und `kd:<W1>` im selben Aufruf haben unveränderte Werte (der Zeilenumbruch verschiebt keine Antwort einer anderen Zeile). Im Test des Moduls zählt der Zähler der Git-Aufrufe für diese Einträge 0.
- [ ] **AK 13 Feindlicher Commit-Inhalt:** Gegeben ein Commit mit dem Titel `<script>alert(1)</script> "x" \ y` und dem Autor `Mallory <img src=x>`: `titel` und `autor` stehen zeichengleich als JSON-Text in der Antwort (`Content-Type: application/json`), der Autor ohne E-Mail-Teil. Ein Commit, dessen Titel und Autor die Zeichen U+001F, U+001E, Tabulator und Wagenrücklauf enthalten, behält sie (maskiert) und verschiebt keinen Wert eines anderen Eintrags. Ein Commit mit Nachricht in `latin1` (Kopfzeile `encoding`, Byte `0xE4`) ergibt 200 und `titel` als gültiges UTF-8 (`ä` oder Ersatzzeichen), nie 500.
- [ ] **AK 14 Härtung des Startpunkts (ADR-0032 N2.3):**
  - **(a) Konfiguration, Attribute, Umgebung:** In `R/.git/config` stehen `core.fsmonitor`, `core.hooksPath`, `diff.external`, `diff.x.textconv` (mit `.gitattributes` `* diff=x`), `core.pager`, `pager.log`, `log.showSignature=true` mit `gpg.program` (dazu ein Commit mit `gpgsig`-Kopfzeile), `core.sshCommand` und `core.askPass`, jedes auf ein Skript, das eine Marke anlegt. Der Server läuft zusätzlich mit `GIT_EXTERNAL_DIFF`, `GIT_PAGER`, `PAGER`, `GIT_SSH_COMMAND`, `GIT_ASKPASS`, `GIT_EXEC_PATH` und `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=core.fsmonitor`, `GIT_CONFIG_VALUE_0=<Skript>` auf Skripte mit Marke. Dann ergibt `GET …/commits` mit allen Zuständen aus AK 1 die Liste von AK 1, und **keine** Marke entsteht. Gegenprobe: derselbe Aufruf ohne Härtung (`git status` und `git log --show-signature` direkt in R) legt die Marken an — die Probe kann also rot werden.
  - **(b) Schalter aus dem Befehl:** Im Test des Moduls trägt die Befehlszeile jedes Befehls, der Diffs erzeugen kann (`log`, `diff`, `diff-tree`), `--no-ext-diff --no-textconv --no-color` und vor dem Befehl `-c core.quotepath=off`, ohne dass der Aufrufer sie nennt; der Aufrufer hat keinen Weg, sie wegzulassen oder `--ext-diff` oder `--textconv` zu nennen. Ein neuer Befehl in der Liste ohne Zuordnung bricht den Bau.
  - **(c) Prozessgruppe:** Im Test des Moduls beendet `laufen` bei Zeitüberschreitung (Grenze 1 s) ein Skript samt seinem Kind in einer eigenen Prozessgruppe; nach `Zeitgrenze` leben beide nicht mehr. Gegenprobe: mit dem heutigen `kind.kill()` lebt das Kind weiter (heute rot).
  - **(d) Nur drei Orte:** Ein Test findet `Command::new("git")` außerhalb von Tests nur in `src/git.rs`, `src/start/ordner.rs` und `src/git/arbeitsrepo.rs`; ein vierter Ort macht ihn rot (Probe: eine vierte Datei mit dem Aufruf, danach wieder entfernt).

### Bestand und Beschreibung

- [ ] **AK 15 Legacy und Bestand:**
  - (a) Eine Datei, die die Vorversion (`main` vor R00202, gebaut) nach einer Titeländerung mit 0, 1, 2, 5 und 30 Einträgen unter `commits` zurückgeschrieben hat (bei einem Eintrag in der Zeilenform `commits: - kd:<K3>`), ergibt `GET …/commits` mit 200 und genau so vielen Einträgen; bei einem Eintrag gleich viel wie die Datei nach dem Heilen, die Aufgabe ist nicht defekt (kein 423).
  - (b) `GET …/commits` schreibt nie: die Datei bleibt byte-gleich, auch die Zeilenform bleibt Zeilenform, und die Commit-Zahl des Board-Ordners bleibt gleich.
  - (c) Der Stand vor dieser Karte (`main` mit R00202 ohne R00204, gebaut) antwortet auf `GET /api/aufgaben/1/commits` nicht mit 200 (Statuscode im Test festgehalten, kein Kriterium) und liefert `GET /api/aufgaben/1` zeichengleich zu dem Stand mit dieser Karte, mit `commits` als Liste der gespeicherten Einträge und **ohne** Git-Aufruf (Git-Spur leer).
- [ ] **AK 16 Beschreibung:** Die Endpunktliste unter `/api` und die OpenAPI-Beschreibung nennen `GET /api/aufgaben/{nr}/commits` mit den Feldern, allen sechs Zuständen, den Statuscodes 200, 404, 423 und 503 und der Reihenfolge; die README „Für Agenten“ hat einen Abschnitt „Commits einer Karte lesen“ mit einem Beispiel-Aufruf und der Antwort aus dem Beispiel oben und sagt, wann `verwaist` heißt, dass Verweise nachzuziehen sind (`ersetzen`). Die Vertragstests, die die Routen zählen, werden um genau diese Route erweitert (keine geänderte Erwartung sonst).

### Länge des Titels

- [ ] **AK 17 Titel höchstens 500 Zeichen (Entscheidung des PO):** Die Länge zählt in Unicode-Zeichen nach der Umwandlung nach UTF-8 (nicht in Bytes, nicht in UTF-16-Einheiten).
  - Ein Commit mit einer ersten Zeile von 600 Zeichen (`a`) ergibt `titel` mit 501 Zeichen: die ersten 500 und „…“ am Ende.
  - Eine erste Zeile von genau 500 Zeichen bleibt unverändert (500 Zeichen, kein „…“); eine von 501 Zeichen wird 500 Zeichen plus „…“.
  - 600 Zeichen `ä` (1.200 Bytes) ergeben 500 `ä` plus „…“; eine Kürzung nach Bytes ergäbe 250.
  - 499 × `a` und an Stelle 500 ein Emoji außerhalb der Grundebene (U+1F600, 4 Bytes) als letztes Zeichen der Zeile: `titel` bleibt unverändert, ist gültiges UTF-8 und endet mit dem ganzen Emoji. Folgt dem Emoji noch Text, ist `titel` 499 × `a`, das ganze Emoji und „…“ (501 Zeichen); das Emoji ist nie zerschnitten, die Antwort nie ungültiges UTF-8 und nie 500.
  - Hat die Nachricht mehrere Zeilen, zählt nur die erste; die Zeilen danach beeinflussen `titel` nicht.

## Betroffene Verzeichnisstruktur

- `src/git/arbeitsrepo.rs` — Befehle `CatFile`, `Log`, `ForEachRef`; Schalter aus `Befehl` abgeleitet; Eingabe über `stdin` für `cat-file --batch-check`; Prozessgruppe; Aufrufzähler über Threads hinweg
- `src/modell/commit_verweis.rs` — Antwortform, Zustände, Eintrag `unlesbar` mit `grund`
- `src/dienst/commits.rs` — `commits_lesen` neben `commits_hinterlegen`, `commit_entfernen`; Zweigliste und Cache
- `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs`, `README.md` — Route und Beschreibung
- Tests: neu `tests/akzeptanz_r00204.rs`; erweitert `tests/arbeitsrepo.rs`, `tests/arbeitsrepo_spur.rs`, `tests/gemeinsam/mod.rs` (Wegwerf-Repository mit Worktree, Remote-Zweigen und `git fast-import`-Erzeuger für die Lastprobe, `git`-Skript im `PATH`), `tests/commits_dienst.rs`, Fitness-Test für `Command::new("git")`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B0998 Lastprofil zuerst messen:** das 20.000er-Repository bauen und Z1 (`for-each-ref --contains` je Commit mit 4 parallelen Prozessen) **und** Z5 (ein Lauf `rev-list --parents --branches --remotes`) messen, je 20 kalte Läufe, bevor der Dienst darum gebaut wird; der entwickler wählt ohne Rückfrage nach ADR-0032 N3.4 (Z1 bleibt, sonst Z5, sonst `anforderung_falsch`).
2. **B0999 Startpunkt härten und erweitern:** Befehle `cat-file`, `log`, `for-each-ref`, Schalter aus `Befehl`, `stdin`, Prozessgruppe, ein Zähler, der Prozesse aller Threads zählt, Fitness-Test.
3. **B1000 Zustand und Metadaten je Repository:** Eintrag und Register → `unlesbar`/`anwendung_unbekannt` ohne Git; Wurzel; `cat-file --batch-check` (nur Typ `commit` zählt, `ambiguous` → `unlesbar`); Titel auf 500 Zeichen kürzen; `log --no-walk` mit Kurzstatistik, Ausgabe robust gegen Steuerzeichen.
4. **B1001 Zweigliste:** Fingerabdruck, Zweigliste je Commit ohne Treffer (Z1: `--contains` je Commit, höchstens 4 gleichzeitig; oder Z5: ein Lauf `rev-list`, wenn B0998 es verlangt), flüchtiger Cache mit Ablage am Ende der Anfrage nach zweiter Fingerabdruck-Probe, 10er-Grenze.
5. **B1002 Dienst, Route, Beschreibung:** Aufgabe ohne Sperre lesen, Reihenfolge, Gesamtgrenze → 503, Route `GET`, Endpunktliste, OpenAPI, README.
6. **B1003 Probe im echten Programm, Gate, Anforderung abschließen.**

### Hinweise

- **Aus A1 wiederverwendet:** `arbeitsrepo::wurzel`, `commit_aufloesen`, `ZEITGRENZE`, `laufen`, `Verweisform::lesen`, `verweis_lesen`, `repo_fehler`, die Testhelfer in `tests/gemeinsam`.
- **Zähler:** `aufrufe()` zählt heute je Thread (`thread_local!`). Mit vier gleichzeitigen Prozessen in eigenen Threads zählt er falsch; der Zähler muss Prozesse aller Threads einer Anfrage oder des Tests erfassen.
- **Stdin:** `laufen` setzt die Eingabe auf null; `cat-file --batch-check` braucht eine Eingabe. Die Namen gehen über `stdin`, nie als Argument; die Form-Prüfung vorher ist die erste Linie, ein Zeilenumbruch im Eintrag erreicht `stdin` nie (AK 12).
- **Gesamtgrenze:** ADR-0032 Punkt 3 nennt 10 s je Prozess. Bei 30 Verweisen und vier Prozessen gleichzeitig wären das schlimmstenfalls 8 Wellen, also 80 s. Hier gilt zusätzlich eine Grenze für den ganzen Aufruf (siehe Offene Fragen).
- **Cache:** `Kanban` ist langlebig (trägt die Sperre), der Cache gehört dorthin oder in ein `static`; er darf einen Aufruf überleben, nie den Prozess.
- **Reihenfolge der Zustände:** `unlesbar`, dann `anwendung_unbekannt`, dann `repository_fehlt`, dann `fehlt`; so erreichen Eingaben mit verletzter Form oder fremdem Kürzel Git nie.
- Commit-Datum und Sortierung nach dem Zeitpunkt: Git-Format `%cI`; Vergleich über den Zeitpunkt in UTC, nicht über den Text.
- Tests zuerst: AK 1 mit der Ausgangslage, AK 14 (a) mit den Marken, AK 14 (c) mit der Gegenprobe am heutigen `kill()`.
- Mutationsproben: Fingerabdruck aus dem Cache-Schlüssel entfernt (veraltetes Ergebnis nach Bewegen); `--no-ext-diff` weggelassen; `core.fsmonitor`-Sperre entfernt; nur Kind statt Gruppe beendet; Gesamtgrenze entfernt; fünf statt vier Prozesse gleichzeitig; Sperre des Board-Ordners beim Lesen genommen; Tags zählen als Zweig; `o/HEAD` in der Liste; Sortierung nach Text statt Zeitpunkt; E-Mail im Autor; **Kürzung des Titels entfernt; Kürzung nach Bytes statt nach Zeichen (AK 17)**; abgebrochenes Ergebnis wird abgelegt (leere Ausgabe gilt als „kein Zweig“); Ablage ohne zweite Fingerabdruck-Probe; Tag-Objekt gilt als Commit; mehrdeutiger Kurz-Hash gilt als `fehlt`; Grenze je Prozess nicht auf den Rest der Gesamtgrenze gekürzt.

## Tests

- API-Tests gegen ein Wegwerf-Repository mit Worktree, Remote-Zweigen und echtem Rebase (AK 1–7, 13), mit `git`-Skripten im `PATH` (AK 8, 9), mit Marken und feindlicher Konfiguration (AK 14 a).
- Lastprobe als eigener Test, der nicht in jedem Lauf der Suite läuft (Erzeugen des Repositorys, Messen mit 20 kalten Läufen); sein Ergebnis steht im Commit (AK 10, 11).
- Modultests für Cache-Obergrenze, höchstens 4 Prozesse, mehrdeutigen Präfix, gehaltene Sperre, Prozessgruppe, Schalter aus dem Befehl, Fitness (AK 5, 8, 11, 14).
- Legacy-Probe gegen die gebaute Vorversion mit 0, 1, 2, 5, 30 Einträgen (AK 15).
- **Keine geänderte Erwartung** an bestehenden Tests; die Endpunktliste-Prüfung bekommt die eine Route.

## Abhängigkeiten

- **Abhängig von:** A1 #207 R00202 (Verweise, Modul Arbeits-Repository, Startpunkt) — auf `main`.
- **Berührt, ohne abzuhängen:** A1b #219 R00203 (`ersetzen`, Karte in den Reviews) ändert dieselben Dateien `src/dienst/commits.rs`, `src/modell/commit_verweis.rs`, `src/web/mod.rs` und die Endpunktliste: beim Zusammenführen sind Konflikte möglich; IDs sind getrennt vergeben (hier R00204, I0194, B0998–B1003).
- **Blockiert:** B1 #212 (Reiter „Commits“), A3 #213 (Diff je Commit, nutzt Zustände, Befehls-Schalter und Prozessgruppe), A5 #220 (Nachfolgervorschlag: nutzt `verwaist` und die Liste aus Punkt 3 mit `patch-id`).

## Offene Fragen

Keine. Die Fragen 1–7 des planers sind entschieden und eingearbeitet:

- **Produktfragen 1–4 (product-owner, `AI-Team/po-entscheidungen.md`, 2026-11-19):** (1) älteste zuerst (FA 5, AK 1, AK 7); (2) Commit-Datum (FA 4); (3) nur der Name, nie die E-Mail-Adresse (FA 4, AK 6, AK 13); (4) `titel` bei 500 Zeichen mit „…“ gekürzt, als Abnahmekriterium (FA 4, AK 17).
- **Technikfragen 5–7 (architekt, ADR-0032 Nachtrag N3):** (5) Gesamtgrenze 10 s ab Eingang, Grenze je Prozess `min(10 s, Rest)`, Antwort spätestens nach 15 s (NFR Zeitgrenze, AK 9); (6) `zweige_weitere` zählt beide Listen zusammen, nur der Typ `commit` ist ein Commit, ein mehrdeutiger Kurz-Hash ist `unlesbar` (FA 3, AK 5); (7) Rückfall der Lastprobe: Z5 gleichwertig neben Z1, entschieden vom entwickler in B0998 nach Messung, bei Reißen beider `anforderung_falsch` (AK 10, 11).

An den fachspezialist (über den Director): die Begriffe Zustand eines Verweises und verwaist im Glossar (zusätzlich zu den schon genannten).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Agenten können die Commits einer Karte ab jetzt mit Zustand und Zweigen lesen (`GET /api/aufgaben/{nr}/commits`); die Zeichnung und der Reiter (B1) folgen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Nach einem Rebase zeigt eine Karte auf Hashes, die kein Zweig mehr erreicht; heute merkt das niemand, bis ein Reviewer einen Commit sucht, der nicht mehr da ist. Ruft ein Agent die Liste ab (X), nennt jeder Eintrag Titel, Autor, Datum, Umfang und den Zustand samt Zweigen, und `verwaist` oder `fehlt` fällt sofort auf (Y), sodass die Factory nachzieht (`ersetzen`) und die Reiter und Diffs von B1 bis A4 an der richtigen Stelle ansetzen (Z). Weil die Liste live, nur lesend und ohne Sperre gelesen wird, kann ein hängendes oder feindliches Arbeits-Repository weder eine Karte blockieren noch ein Programm starten.

## Notizen

- Heimat: I0194 unter D0009 „Arbeit hinter der Karte“, Geschwister von I0192 und I0193.
- **Befund an der Kartenbeschreibung:** sie nennt „Zustand je Verweis“ mit den Namen `vorhanden` und `nicht_auf_zweig`; N1.2 (2026-11-19) hat sie ersetzt. Gilt hier N1.2.
- **Herleitung der Zahlen:** 90 ms für 30 Verweise (4 parallele Prozesse, `commit-graph` an) und 112 ms ohne `commit-graph` — gemessen am 2026-11-19 in kanbanD selbst mit 2.540 Commits und 16 Zweigen (ADR-0032 N1.3, 323 ms nacheinander). **Das Repository der Lastprobe ist 8-mal so groß an Commits und 3-mal so groß an Zweigen: der Wert 200 ms ist dort Hypothese, nicht gemessen.** Darum ist B0998 die erste Bubble.
- **Ausgangslage:** Der Agent heißt `entw1` (Kürzel höchstens 8 Zeichen), das Register wird über `PUT /api/einstellungen` gesetzt (siehe Befund in R00203).
- **Plattform:** wie R00202 Linux; die Tests mit Skripten und `/dev/null` laufen nur dort.
- **Optionen:** Z1 (Standard), Z2, Z3 stehen im ADR-0032 N1.3; Z5 (ein Lauf `rev-list --parents --branches --remotes`, Erreichbarkeit im Speicher) ist seit ADR-0032 N3.4 die gleichwertige Alternative, über die B0998 nach Messung entscheidet.
- **Messung des architekts (2026-11-19, ADR-0032 N3, Git 2.48.1, Rechnerlast 5–7 durch fremde Läufe, daher Größenordnung, keine Abnahmewerte):** Wegwerf-Repository mit 20.779 Commits, 50 Zweigen (26 lokal, 24 entfernt), ohne `commit-graph`, 30 Verweise: **Z1 1,0–1,1 s** kalt (ein einzelner `--contains` 0,15 s für einen verwaisten, 0,38 s für einen Commit auf `main`); Z2 (`rev-list` je Zweig) 1,3–1,5 s; Z3 (`rev-list --branches --remotes`, nur ja/nein) 0,11–0,12 s; **Z5 0,16–0,24 s** (nur der Git-Teil; `cat-file` und `log` für 30 Verweise zusammen 0,02 s). Damit ist die Hypothese „200 ms bei 20.000 Commits“ für Z1 nach dieser Messung widerlegt, für Z5 knapp; die Abnahme bleibt die Messung in B0998 (Last nach `uptime` ≤ 6, sonst warten).
- **Entschieden vom PO (2026-11-19):** Titel bei 500 Zeichen gekürzt als Abnahmekriterium (AK 17), nicht als Sollte; gezählt wird in Unicode-Zeichen (Codepoints), nicht in Graphemen: ein Zeichen mit angehängtem Kombinationszeichen kann an der Grenze getrennt werden (bewusst hingenommen).
- **Hinweis zu AK 10:** dort steht „bei Rechnerlast unter 2“; die Messung des architekts lief bei Last 5–7, und B0998 verlangt Last ≤ 6. Die Abnahme in B1003 braucht eine ruhige Maschine (Last unter 2) oder muss die Last im Bericht nennen.
- **Verworfene Alternativen:** (1) Zustand in der Datei speichern — veraltet beim ersten Rebase, ADR N1.2 „nie gespeichert“; (2) die Zweigliste für alle Commits mit einem Lauf `rev-list --branches --remotes` (Z3) — nennt den Zweig nicht, das verlangt der Betreiber; (3) die Liste in `GET /api/aufgaben/{nr}` einbauen — brächte Git in `/api/zustand` und das Lastprofil.
