---
id: R00203
status: Neu
datum: 2026-11-19
---

# R00203: Commit-Verweise nach einem Rebase ersetzen (API)

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karte #207, Nachtrag N1: „hinterlegen während der Arbeit“) und Karte #219.

**Umfang (Scheibe A1b des Feinschnitts, baut auf [R00202](R00202-commit-verweise-an-der-karte-hinterlegen-und-entfernen.md)):** Nach einem Rebase tragen die Commits des Kartenzweigs neue Hashes; die Verweise an der Karte zeigen dann auf die alten. Ein Agent oder Mensch nennt **Paare alt → neu** und ersetzt alle Verweise mit **einem** Aufruf und **einem** Commit im Board-Repository. Der neue Verweis nimmt den **Platz** des alten ein und trägt dasselbe Kürzel. Eine Wiederholung desselben Aufrufs ist harmlos (200 ohne Commit). **Keine Oberfläche**, keine Zustände (`verwaist` u. ä. kommen mit A2), kein Nachfolgervorschlag (A5), keine Änderung des Dateiformats.

Form, Fehlerstufen und Wiederholungsregel stehen in [ADR-0032](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) Nachtrag N1.4 und werden hier nicht wiederholt, nur in Beispiele übersetzt.

> **Schutz des Arbeits-Repositorys: kanbanD startet dort nur dieselben `rev-parse`-Aufrufe wie R00202, und nur für `neu`; ein `alt` erreicht Git nie, und kein Text, der die Form verletzt, erreicht Git (AK 8, AK 9).**

> **Schutz des Nutzers: Ersetzen ändert nur die Zeilen unter `commits`, in Zahl und Platz wie beschrieben; kein Verweis geht verloren, wird doppelt oder wandert (AK 1, AK 11).**

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: im Arbeits-Repository nur lesen).

**Beispiel-Aufruf** (Kopfzeile `X-KanbanD-Wer` wie bei allen schreibenden Aufrufen; an #1 stehen `kd:K1…`, `kd:W1…`, `kd:K2…`):

```
POST /api/aufgaben/1/commits/ersetzen
{"ersetzungen": [{"alt": "kd:3f2a9c1", "neu": "kd:8e20ad9"}, {"alt": "kd:9c6b91f", "neu": "kd:1d4c7e2"}]}
→ 200, die Aufgabe mit commits: ["kd:8e20ad9…", "kd:W1…", "kd:1d4c7e2…"]
```

### Domänenbezug

Die Begriffe **Anwendung**, **Register**, **Standardanwendung** und **Commit-Verweis** wie in R00202; im Glossar fehlen sie weiterhin (dort als offene Frage genannt).

## Geschäftlicher Nutzen

Die Factory rebased den Kartenzweig vor jedem Wachlauf; ohne Ersetzen müsste sie je Verweis einmal entfernen und einmal hinterlegen (2n Aufrufe, 2n Commits, die Reihenfolge ginge verloren, und zwischen den Aufrufen stünde die Karte halb umgestellt da). Mit einem Aufruf bleibt die Karte stimmig, und es häufen sich keine verwaisten Verweise an. Die Scheibe ist Voraussetzung von E1 (Factory hinterlegt und ersetzt) und von A5 (Nachfolgervorschlag bestätigt über diese Route).

## Funktionale Anforderungen

1. `POST /api/aufgaben/{nr}/commits/ersetzen` mit `{ersetzungen: [{alt, neu}, …]}` ersetzt alle Paare in einem Commit des Board-Repositorys oder keines (alles oder nichts).
2. `alt` ist ein Verweis an **dieser Karte** — voller Hash oder an der Karte eindeutiger Präfix ab 7 Zeichen, wie bei `DELETE` (R00202 FA 5). Geprüft wird nur gegen die Karte, nie gegen das Arbeits-Repository: auch ein fehlender oder nirgends erreichbarer Commit lässt sich ersetzen.
3. `neu` wird geprüft wie beim Hinterlegen (R00202 FA 2 und 3): Form, Kürzel registriert, Commit im Arbeits-Repository, gleich auf welchem Zweig; ein Kurz-Hash wird zum vollen Hash aufgelöst und so gespeichert.
4. `alt` und `neu` tragen dasselbe Kürzel; beide ohne Kürzel (Standardanwendung) gelten als dasselbe. `kd:<hash>` gegen `<hash>` ist verschieden.
5. Der neue Verweis steht danach **an der Stelle des alten**; alle anderen Einträge behalten Platz und Wortlaut.
6. **Wiederholung:** Ein Paar, dessen `alt` nicht (mehr) an der Karte steht und dessen `neu` schon an der Karte steht, gilt als erledigt und wird übersprungen — ohne das Arbeits-Repository zu fragen. Bleibt kein Paar übrig, antwortet die API 200 ohne Commit.
7. Fehler (nichts geschrieben, Rumpf `{fehler, verweis?}` nach ADR-0003, nie 422), in dieser Reihenfolge geprüft: **400** für Rumpf, Form, Kürzel, ein Verweis doppelt im Aufruf (als `alt` oder `neu`, auch Kurz- gegen Voll-Hash), eine Kette (ein `neu` ist zugleich ein `alt` im selben Aufruf), mehr als 500 Paare, leere Liste, mehrdeutigen Präfix von `alt`, ein `neu`, das es nicht gibt oder kein Commit ist; **404** wenn `alt` nicht an der Karte steht und `neu` auch nicht (oder die Aufgabe fehlt); **409** wenn `alt` und `neu` beide an der Karte stehen; **503** bei Git über 10 s. Der Rumpf nennt bei 400, 404 und 409 den auslösenden Text aus der Anfrage unter `verweis`; bei 409 ist das das `alt`, das sich mit `DELETE` entfernen lässt.
8. Der Aufruf antwortet bei Erfolg mit der Aufgabe (wie `POST …/commits`); `GET /api/aufgaben/{nr}` bleibt unverändert und startet kein Git.
9. Endpunktliste unter `/api`, OpenAPI-Beschreibung und README „Für Agenten“ nennen die Route.

## Nicht-funktionale Anforderungen

- **Lastprofil:** Git im Arbeits-Repository starten nur die Prüfung von `neu` (je Anwendung eine Wurzelsuche, je `neu` ein `rev-parse`), nie `alt`, nie ein Paar, das als Wiederholung erkannt ist; `GET`-Aufrufe wie bei R00202 nie.
- **Sperre:** Git läuft vor der Sperre des Board-Ordners; unter der Sperre prüft das Ersetzen Karte, Wiederholung, 404 und 409 **erneut** gegen die frisch gelesene Datei (Prüfen-dann-Handeln).
- **Zeitgrenze:** je Git-Prozess höchstens 10 s, danach 503, nichts geschrieben.
- **Höchstzahl:** Ersetzen ändert die Zahl der Verweise nicht; die 500 je Aufgabe (R00202) sind hier nie der Grund für einen Fehler.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API; erweitert die von R00202):

- **Arbeits-Repository R** (Wegwerf, `git init -b main`) mit `Dokumentation/Planung/app.md`. Auf `main` die Commits **K1**, **K2** (wie R00202) und danach **K3** („c.txt anlegen“), **K4** („d.txt anlegen“). Worktree `R-karte-1` auf `karte/1`, abgezweigt von K2, mit dem Commit **W1** („b.txt anlegen“). Ein Commit **V1** auf losgelöstem `HEAD`, den kein Zweig erreicht. `<W1'>` ist der Commit, den `git rebase main` im Worktree aus W1 macht (neuer Hash, gleicher Inhalt, Elternteil K4).
- **Board-Ordner** mit Board „fabrik“, #1 „Verweise ersetzen“ in „Entwicklung“, #2 in „Eingang“. Personen: Mensch `sh`, Agent `entw1` (Kürzel höchstens 8 Zeichen — siehe Notizen). Register über `PUT /api/einstellungen`: Anwendung `kd` mit `wbs: <R>/Dokumentation/Planung/app.md`; **ohne** Standardanwendung, außer AK 3 sagt es anders.
- **Karte #1** trägt, über `POST …/commits` hinterlegt, in dieser Reihenfolge `kd:<K1>`, `kd:<W1>`, `kd:<K2>`.
- Schreibweise wie R00202: `<K1>` voller Hash, `<K1:7>` die ersten 7 Zeichen; „Commit-Zahl“ ist `git rev-list --count HEAD` im Board-Ordner.

### Ersetzen

- [ ] **AK 1 Zwei Paare, ein Commit (Abnahme-Probe der Karte):** `POST /api/aufgaben/1/commits/ersetzen` mit `X-KanbanD-Wer: entw1` und `{ersetzungen: [{alt: "kd:<K1:7>", neu: "kd:<K3:7>"}, {alt: "kd:<K2:7>", neu: "kd:<K4:7>"}]}` ergibt 200; die Commit-Zahl steigt um genau 1 (n → n+1), Autor ist `entw1`; die Datei von #1 trägt unter `commits` `kd:<K3>`, `kd:<W1>`, `kd:<K4>` (volle Hashes, Platz 1 und 3 getauscht, Platz 2 unberührt); `GET /api/aufgaben/1` liefert dieselbe Liste; sonst ändert sich in der Datei nichts.
- [ ] **AK 2 Nach einem echten Rebase:** Nach `git rebase main` im Worktree ergibt `{ersetzungen: [{alt: "kd:<W1>", neu: "kd:<W1'>"}]}` 200; `kd:<W1'>` steht an Platz 2 von #1, `kd:<W1>` steht nicht mehr da, ein Commit.
- [ ] **AK 3 Standardanwendung:** Mit `sources.wbs: <R>/Dokumentation/Planung/app.md` und einem Verweis `<K1>` (ohne Kürzel) an #1 ergibt `{alt: "<K1:7>", neu: "<K3>"}` 200 und die Zeile lautet `- <K3>` ohne Kürzel; `{alt: "kd:<K2:7>", neu: "<K3>"}` (Kürzel verschieden) ergibt 400 `{fehler, verweis}`, nichts geschrieben.
- [ ] **AK 4 Wiederholung:** Nach AK 1 ergibt derselbe Aufruf noch einmal 200 ohne Commit (Commit-Zahl gleich, Liste gleich); ein Aufruf mit dem erledigten Paar `K1 → K3` und einem neuen Paar `W1 → W1'` schreibt nur das neue, genau ein Commit. Wird R danach umbenannt, ergibt der Wiederholungsaufruf von AK 1 weiter 200 ohne Commit; ein Aufruf mit einem neuen `neu`, das nicht an der Karte steht, ergibt dann 400 mit einem `fehler`, der das fehlende Repository nennt.
- [ ] **AK 5 Höchstzahl ist kein Grund:** Trägt #1 schon 500 Verweise, ergibt ein gültiges Ersetzen 200 und die Zahl bleibt 500 (Probe im Test des Moduls; von außen brauchte es 1.000 Commits).

### Abweisen — nichts geschrieben

Für jedes Beispiel gilt: die Antwort ist wie angegeben, die Commit-Zahl bleibt gleich, die Datei von #1 ist byte-gleich. Ein Aufruf mit mehreren Paaren, von denen eines falsch ist, ändert auch die guten nicht.

- [ ] **AK 6 Rumpf und Form (400):** `{ersetzungen: []}`, `{commits: […]}`, `{ersetzungen: "x"}`, ein unbekannter Schlüssel neben `ersetzungen`, ein Paar mit drittem Schlüssel, ein Paar ohne `alt`, `neu` als Zahl oder `null`, ein Eintrag der Liste, der kein Paar ist; `alt` oder `neu` als `kd:<K1:6>` (6 Zeichen), `kd:main`, `kd:HEAD`, `kd:3f2a9cg`; `alt` oder `neu` mit unbekanntem Kürzel (`xy:<K1>`); `neu` `kd:0000000` (gibt es nicht, `verweis: "kd:0000000"`) und der Hash eines Blobs (kein Commit). Grenze: `neu` mit 7 Zeichen angenommen, mit 6 abgewiesen; 64 Zeichen haben gültige Form, 65 nicht. `neu` mit 41 Zeichen in einem SHA-1-Repository: Form gültig, Git findet nichts → 400. Eine unbekannte Aufgabe `/api/aufgaben/999/commits/ersetzen` → 404.
- [ ] **AK 7 Doppelt, Kette, Zahl (400, `verweis` nennt den zweiten Auftritt):**
  - `alt` doppelt: `K1 → K3` und `K1 → K4`; auch als `kd:<K1>` und `kd:<K1:7>`.
  - `neu` doppelt: `K1 → K3` und `K2 → K3`.
  - `alt` gleich `neu` im selben Paar: `K1 → K1`.
  - Kette: `K1 → K3` und `K3 → K4`; auch ein Tausch `K1 → K2` und `K2 → K1` ist eine Kette (400, nicht 409).
  - Mehr als 500 Paare: 501 Paare ergeben 400 ohne einen Git-Aufruf; genau 500 Paare haben gültige Zahl (Probe im Test des Moduls).
- [ ] **AK 8 Karte: 404, 409, mehrdeutig:**
  - `alt` steht nicht an der Karte und `neu` auch nicht (`K4 → K3` an #1 ohne K4) → 404, `verweis` ist das `alt` aus der Anfrage.
  - `alt` und `neu` stehen beide an der Karte (`K1 → K2`) → 409, `verweis` ist das `alt`.
  - Ein Präfix von `alt`, der an der Karte zu zwei Verweisen passt → 400 (die Probe im Test des Moduls; von außen braucht es zwei Commits mit gleichem 7er-Anfang).
  - Ein Aufruf mit `K1 → K3` und `V1 → K4` (V1 steht nicht an der Karte) ergibt 404 für das zweite Paar und schreibt auch das erste nicht.
  - Ein Aufruf, der sowohl einen Formfehler als auch ein 404-Paar enthält, ergibt 400.
- [ ] **AK 9 Eingaben, die Git nie erreichen:** `kd:--output=x`, `kd:../x`, `kd:3f2a9c1;rm -rf x`, `kd:3f2a9c1 --all`, `kd:3f2a 9c1`, `kd:$(touch x)` und `kd:3f2a9c1^{tree}` ergeben, je als `alt` und je als `neu` eines sonst gültigen Aufrufs, 400; danach liegt weder in R noch im Board-Ordner eine Datei `x`, `git status --porcelain` in R ist unverändert, und die Git-Spur (Server mit `GIT_TRACE=<datei>`) enthält keinen dieser Texte; im Test des Moduls zählt der Zähler der Git-Aufrufe bei jedem Formfehler 0, auch wenn ein anderes Paar des Aufrufs gültig ist.

### Platz, verwaiste und fehlende Verweise

- [ ] **AK 10 `alt` wird nie gegen Git geprüft:**
  - Eine Karte trägt `kd:<V1>` (verwaist, über R00202 AK 2 hinterlegt) und `kd:<V2>` (ein zweiter losgelöster Commit), dessen Commit danach aus R entfernt wird (`git reflog expire --expire=now --all`, `git gc --prune=now`). Beide lassen sich ersetzen (`V1 → K3`, `V2 → K4`) und ergeben 200, ein Commit, die neuen Hashes auf den Plätzen der alten.
  - Mit `GIT_TRACE` enthält die Spur weder `<V1>` noch `<V2>`.
  - Wird R vor dem Aufruf umbenannt und das `neu` steht nicht an der Karte, ergibt der Aufruf 400 mit dem Hinweis auf das fehlende Repository (AK 4).
- [ ] **AK 11 Parallele Aufrufe (Prüfen-dann-Handeln):** Zwei geprüfte Aufrufe mit demselben Paar `K1 → K3` nacheinander unter der Sperre (Haken zwischen Prüfung und Sperre, kein Warten auf Zufall) ergeben einen Eintrag `kd:<K3>` und genau einen Commit; ein zweiter Aufruf, der zwischen Prüfung und Sperre schon `K1 → K4` geschrieben hat, ergibt für `K1 → K3` unter der Sperre 404 ohne Commit; die Karte trägt danach `K4` an Platz 1, nicht `K3`.

### Datei und Bestand

- [ ] **AK 12 Datei, Legacy und Duplizieren:**
  - (a) Eine Karte mit den Einträgen `kd:<K1>`, `kd:zz` (unlesbar) und `1234567890123456789012345678901234567890` (Ziffern-Hash) ergibt nach `K1 → K3` die Datei zeichengleich bis auf die eine Zeile `- kd:<K3>`; die beiden anderen Einträge stehen wörtlich da, der Ziffern-Hash als Text. Ein Ersetzen von `kd:zz` (unlesbare Form) ergibt 400 — er lässt sich nur in der Datei ändern (wie bei `DELETE`).
  - (b) Der Stand vor dieser Karte (`karte/207`, gebaut) behält eine nach AK 1 geschriebene Datei bei einer Titeländerung zeichengleich (kein neuer Schlüssel, keine neue Form).
  - (c) Trägt die Datei unter `commits` etwas, das keine Liste von Texten ist (Verhalten wie beim Hinterlegen), ergibt Ersetzen 409 und ändert nichts.
  - (d) `POST /api/aufgaben/1/duplizieren` ergibt nach dem Ersetzen weiter eine Kopie ohne `commits`.
- [ ] **AK 13 Beschreibung:** Die Endpunktliste unter `/api` und die OpenAPI-Beschreibung nennen `POST /api/aufgaben/{nr}/commits/ersetzen` mit dem Rumpf `{ersetzungen: [{alt, neu}]}`, den Statuscodes 200, 400, 404, 409, 503 und dem Satz zur Wiederholung; die README „Für Agenten“ hat im Abschnitt „Commits an der Karte hinterlegen“ ein Beispiel „nach einem Rebase nachziehen“ und nennt den Beispielaufruf mit einem Agenten-Kürzel von höchstens 8 Zeichen.

## Betroffene Verzeichnisstruktur

- `src/modell/commit_verweis.rs` — Paare aus dem Rumpf lesen, Struktur und Form prüfen (rein, ohne Git)
- `src/dienst/commits.rs` — `commits_ersetzen` neben `commits_hinterlegen`/`commit_entfernen`
- `src/fehler.rs` — 409 mit `verweis` (heute trägt `Konflikt` nur den Text)
- `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs` — Route und Beschreibung; `README.md` „Für Agenten“
- Tests: neben `tests/akzeptanz_r00202.rs`, `tests/commits_dienst.rs`, `tests/arbeitsrepo.rs` und `tests/gemeinsam/mod.rs` (Wegwerf-Repository mit Worktree)

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B0994 Paare lesen und prüfen, ohne Git:** Rumpf → Paare, oder 400 mit `verweis`: Form von `alt` (`Verweisform::lesen`), Form und Register von `neu` (`verweis_lesen`), gleiches Kürzel, Duplikate, Ketten, 1..=500 Paare.
2. **B0995 Ersetzen mit Prüfung vor und Austausch unter der Sperre:** Karte lesen (404, 409, Wiederholung), nur die nötigen `neu` an Git (Wurzel und `commit_aufloesen` wie `commits_pruefen`), dann `aufgabe_schreiben` mit erneuter Prüfung und Austausch an der Stelle; 409 mit `verweis`; Commit-Nachricht.
3. **B0996 Route, Endpunktliste, OpenAPI, README.**
4. **B0997 Probe im echten Programm, Gate, Anforderung abschließen.**

### Hinweise

- **Aus A1 wiederverwendet (alle auf `karte/207`):** `Verweisform::lesen` und `verweis_lesen` (`src/modell/commit_verweis.rs`), `arbeitsrepo::wurzel`, `commit_aufloesen`, `ZEITGRENZE`, Aufrufzähler (`src/git/arbeitsrepo.rs`), `HOECHSTZAHL_COMMITS`, `repo_fehler`, `abweisung`, `passt`, `kurz`, `verweise_aus`-Muster und `aufgabe_schreiben` mit Sperre (`src/dienst/commits.rs`), `Fehler::Verweis` mit `fehlt` für 404, `Herkunftsschluessel::qualifiziert`, `JsonKoerper`, `als_person`, die Testhelfer `tests/gemeinsam` (`arbeits_repository`, `mit_register`) und das Gerüst von `tests/akzeptanz_r00202.rs`. **Neu:** die Paar-Prüfung, der Austausch an der Stelle, 409 mit `verweis`, die Route.
- Wiederholung und 404/409 brauchen den Vergleich „steht an der Karte“ nach Kürzel und Präfix: das ist `passt` von `DELETE`; keine zweite Lesart bauen.
- Die Fehlerreihenfolge aus FA 7 hält Git aus allen Aufrufen heraus, die an der Karte oder an der Form scheitern. Sie ist hier festgelegt, weil ADR-0032 N1.4 sie offenlässt; ändert sie jemand, ändern sich die Statuscodes von Aufrufen mit mehreren Fehlern.
- Commit-Nachricht z. B. `#1 Commits ersetzt: kd:3f2a9c1 → kd:8e20ad9, kd:9c6b91f → kd:1d4c7e2`.
- Eine ältere Version beantwortet die Route mit 404 (ADR N1.4); heute am Code gelesen (die Route `…/commits/{verweis}` kennt nur `DELETE`, der Server könnte 405 antworten) — beim Bau am gebauten Stand `karte/207` gefahren und im Test festgehalten, kein Kriterium.
- Tests zuerst: Ausgangslage mit den Plätzen (AK 1) und der Rundlauf aus AK 12 (a).
- Mutationsproben: Platz nicht erhalten (neu hinten angehängt); Kette nicht erkannt; Prüfung der Karte unter der Sperre entfernt; `alt` doch an Git gegeben; Kürzelgleichheit entfernt; 409-Prüfung entfernt.

## Tests

- API-Tests gegen ein Wegwerf-Repository mit Worktree und echtem Rebase (AK 1–4, 8, 10), Commit-Zahl vor und nach jedem abgewiesenen Aufruf (AK 5–9).
- Modultests für 500/501 Paare, Höchstzahl und mehrdeutigen Präfix (AK 5, 7, 8), Haken-Test für AK 11.
- **Keine geänderte Erwartung** an bestehenden Tests; die Endpunktliste-Prüfung bekommt die eine Route.

## Abhängigkeiten

- **Abhängig von:** A1 #207 R00202 (Verweise schreiben, Modul Arbeits-Repository, Form und Sperre) — Stand `karte/207` in den Reviews, noch nicht auf `main`
- **Blockiert:** E1 (Factory hinterlegt und ersetzt, `/factory lehren`), A5 #220 (Nachfolgervorschlag, bestätigt über diese Route)

## Offene Fragen

An den product-owner (Produktfragen, blockieren den Bau nicht):

1. Ein unlesbarer Eintrag (`kd:zz`) lässt sich weder ersetzen noch entfernen, nur in der Datei ändern — gewollt so lassen (Empfehlung: ja, wie bei R00202) oder später eine Reparaturroute vorsehen?
2. Bei 409 nennt `verweis` das `alt`; ADR N1.4 sagt nur „`{fehler, verweis}`“ — Empfehlung: `alt`, weil der Aufrufer es mit `DELETE` entfernt.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Agenten können ab jetzt nach einem Rebase mit einem Aufruf nachziehen; E1 (Factory) kann die Route nutzen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Die Factory rebased `karte/<nr>` auf `main`, und jeder Commit der Karte bekommt dabei einen neuen Hash. Nennt der Agent die Paare (alt aus der Liste vor, neu aus der Liste nach dem Rebase) in einem Aufruf (X), tauscht kanbanD in einem Commit alle Hashes an ihrem Platz aus und prüft nur die neuen im Repository (Y), die Karte bleibt ohne Handarbeit stimmig, und Liste und Diff (A2–B4) zeigen nach dem Rebase die richtigen Commits statt verwaister (Z). Weil `alt` nie gegen Git geprüft wird, lassen sich auch verwaiste und gelöschte Verweise nachziehen; weil alles oder nichts gilt und die Wiederholung harmlos ist, kann die Factory den Aufruf nach einem Abbruch gefahrlos wiederholen.

## Notizen

- Heimat: I0193 unter D0009 „Arbeit hinter der Karte“, Geschwister von I0192.
- **Befund an R00202:** deren Ausgangslage nennt den Agenten `entwickler` (10 Zeichen) und das Register über `PUT /api/einstellungen`; Kürzel von Personen haben 1–8 Zeichen, `PUT` weist `entwickler` ab (`src/dienst/einstellungen.rs:43`). Hier heißt der Agent `entw1` (wie im echten Board), das Register steht über `PUT`. R00202 selbst bleibt unverändert (erledigt).
- Optionen: im ADR-0032 N1.4 entschieden.
- **Verworfene Alternativen:** (1) `DELETE` und `POST` je Verweis — 2n Commits, Platz geht verloren, Zwischenzustände sichtbar, nicht alles oder nichts; (2) `PUT` der ganzen Liste — überschreibt Verweise, die ein anderer Aufruf inzwischen hinterlegt hat, und löscht unlesbare Einträge; (3) kanbanD zieht selbst nach (über `patch-id`) — ist A5 und bestätigt nur über diese Route.
