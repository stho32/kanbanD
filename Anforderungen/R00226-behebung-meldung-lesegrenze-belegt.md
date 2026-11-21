---
id: R00226
status: Neu
datum: 2026-11-21
ursprung: Bug-Report
ursprungslauf: R00204
---

# R00226: Behebung — eigene Meldung „Lesegrenze … belegt“ statt „Git … antwortete nicht innerhalb von 10 s“

## Beschreibung

Karte #238, Vorschlag aus #231 (architekt und planer, 2026-11-20). Lesevorgänge in Arbeits-Repositories teilen sich 4 Plätze, die Lesegrenze aus der Nacharbeit #211 ([R00204](R00204-commit-liste-einer-karte-per-api-lesen.md)). Wer keinen Platz bekommt, wartet bis zur Frist seiner Anfrage (10 s ab Eingang). Bekommt er bis dahin keinen Platz, antwortet heute jeder der vier Endpunkte mit 503 und „Git … antwortete nicht innerhalb von 10 s“. Dabei ist Git für diese Anfrage nie gestartet.

**Reproduktion** (Modultest, Aufbau wie `src/dienst/commits_lesen.rs:345` `belegte_lesegrenze_ist_503_nach_der_frist`): alle 4 Plätze mit ferner Frist halten, dann eine Commit-Liste mit Frist jetzt + 300 ms lesen. **Erwartet:** 503 mit einem Text, der sagt, dass die Lesegrenze belegt war und Git nicht lief. **Tatsächlich:** `Fehler::Zeitgrenze` „Git in einem Arbeits-Repository antwortete nicht innerhalb von 10 s — keine Liste“. Die Commit-Liste der Oberfläche macht daraus sogar „Das Repository antwortete nicht innerhalb von 10 Sekunden“ (`web/commits.js:113`).

Unter Last ist das der häufigere der beiden 503 (R00215, Herleitung dort: 30 Anfragen vor 4 Plätzen). Die Meldung schickt Betreiber und Agenten zum Repository, wo nichts zu finden ist. Das ist **falsch gebaut**: Die Fehlermeldung beschreibt eine Ursache, die nicht eingetreten ist. Technik: [ADR-0032 Nachtrag N9](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) (architekt, Lauf 238-architekt-1). Wortlaut: product-owner, `AI-Team/po-entscheidungen.md` Z. 512–513.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–110). Eine Fehlermeldung mit falscher Ursache lässt Mensch und Agent am falschen Ort suchen; KI-Agenten arbeiten über die API (Z. 21) und lesen den Text.

## Ursachenanalyse

### Root Cause

Belegt am Stand von `karte/238` nach Rebase auf `main` (`e0e48417`):

- `src/dienst/lesegrenze.rs:33` `betreten(frist) -> Option<Platz>` gibt `None`, wenn bis zur Frist kein Platz frei wurde. Git ist dann nicht gestartet (alle Aufrufer nehmen den Platz unmittelbar vor dem ersten Git-Prozess, Kommentar „ab hier startet Git“).
- Alle **vier** Aufrufer bilden `None` auf `Arbeitsrepofehler::Zeitgrenze` ab, also auf den Fehler „Git lief und überschritt die Frist“:
  - `src/dienst/diff.rs:314` → `abbruch` `:368` „Git im Arbeits-Repository antwortete nicht innerhalb von 10 s — kein Diff“ (Diff eines Commits)
  - `src/dienst/gesamt_diff.rs:76` → dasselbe `abbruch` aus `diff.rs` (Import `:7`) (Gesamt-Diff)
  - `src/dienst/commits_lesen.rs:45` → eigenes `abbruch` `:126` „Git in einem Arbeits-Repository antwortete nicht innerhalb von 10 s — keine Liste“
  - `src/dienst/nachfolger.rs:280` → eigenes `abbruch` `:384` „… — keine Suche nach dem Nachfolger“. Die Karte nennt diesen vierten Aufrufer nicht; er hat denselben Fehler (N9.1).
- Der vorhandene Test `belegte_lesegrenze_ist_503_nach_der_frist` (`commits_lesen.rs:345`) schreibt den Fehler fest: Er erwartet `Fehler::Zeitgrenze`.

Ausgeschlossen: Die Zeitgrenze selbst ist richtig gebaut. Läuft Git über die Frist, ist „antwortete nicht innerhalb von 10 s“ wahr (Gegenprobe Z unten). Ausgeschlossen ist auch der Status: 503 bleibt richtig, `src/web/mod.rs:155` bildet `Fehler::Ausgelastet` schon auf 503 ab.

Der Defekt ist eingetreten, nicht latent: Unter Last trifft er jede fünfte und weitere gleichzeitige Leseanfrage, die bis zur Frist keinen Platz bekommt.

### Betroffene Komponenten

- `src/dienst/lesegrenze.rs`: neuer Ort des Textes (A00004 Dienste)
- `src/dienst/diff.rs`, `src/dienst/gesamt_diff.rs` (nur `:7` und `:76`), `src/dienst/commits_lesen.rs`, `src/dienst/nachfolger.rs`: je die Zeile mit `betreten`
- `src/web/endpunkte.rs:55`, `:57`, `:59` und `src/web/mod.rs:1191`, `:1206`, `:1282`: API-Beschreibung der 503
- `README.md` „Für Agenten“: die Sätze zu 503 bei Liste (`:170`), Nachfolger (`:193`) und Diff (`:221`)
- **Nicht** betroffen: `web/` (N9.3 Punkt 7, PO Z. 513). Die Oberfläche gibt den neuen Text schon heute wörtlich wieder (Probe O, unten geprobt).

**Überschneidung mit Karte #234** (baut gleichzeitig in `src/dienst/gesamt_diff.rs`, heute `:285–312`, dazu `:179`): #238 ändert dort nur `:7` (Import von `abbruch` fällt weg, falls er sonst ungenutzt ist) und `:76`. Die Probe B für den Gesamt-Diff läuft über `diff_lesen` ohne `commit` und steht deshalb im Testmodul von `src/dienst/diff.rs`, nicht in `gesamt_diff.rs`. Ein Konflikt ist unwahrscheinlich; wer zuletzt zusammenführt, prüft beide Stellen.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0032 N9.3, Option L1:

1. **Ein Ort für den Text:** `src/dienst/lesegrenze.rs` bekommt eine Funktion, die die Endung des Endpunkts nimmt und `Fehler::Ausgelastet` liefert, z. B. `belegt("kein Diff")`. `betreten` bleibt `Option`.
2. **Wortlaut** (PO Z. 512, wörtlich; die Zahlen aus `LESEN_HOECHSTENS` und `GESAMTGRENZE.as_secs()`, nie als Literal):
   - Liste: „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Liste“
   - Diff eines Commits und Gesamt-Diff: „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — kein Diff“
   - Nachfolger: „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Suche nach dem Nachfolger“
3. **Alle vier Aufrufer** nutzen die Funktion statt `abbruch(Arbeitsrepofehler::Zeitgrenze)`.
4. **Status und Rumpf bleiben:** 503, Rumpf `{fehler}`, kein Zustandswort, kein neues Feld, **kein `Retry-After`** (N9.3 Punkte 4 und 5).
5. **API-Beschreibung und README** nennen den zweiten 503-Fall.
6. `Fehler::Zeitgrenze` bleibt dem Fall vorbehalten, dass Git lief und die Frist überschritt oder zu viel ausgab.

Akzeptierte Schwäche (N9.3): Agenten unterscheiden die beiden 503 nur am Präfix „Lesegrenze“. Wessen Frist während des Wartens abläuft, bekommt „Lesegrenze“, auch wenn kurz danach ein Platz frei geworden wäre. Das ist richtig, denn Git ist nicht gestartet.

### Alternative Ansätze

Verworfen nach N9.2:
- **L2, Zustandswort im Rumpf:** `zustand` gehört dem Verweis, nicht dem Server; ein neues Wort ginge an `ZUSTANDSWOERTER` (`web/commits.js:11`) und jeden Leser, neues Schema.
- **L3, eigener `Arbeitsrepofehler` je Aufrufer:** vier Stellen für denselben Satz; die Lesegrenze ist kein Fehler des Arbeits-Repositorys.
- **L4, Zeitgrenzen-Text nur neutral fassen:** unterscheidet die Fälle nicht und bräche die Erkennung `ZEITGRENZE_TEXT` (`web/commits.js:107`).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

**Probe B (belegt), je Aufrufer ein Modultest**, Aufbau wie `commits_lesen.rs:345`: alle `LESEN_HOECHSTENS` Plätze mit Frist jetzt + 5 s halten, dann mit Frist jetzt + 300 ms aufrufen:
- `commits_lesen` (der vorhandene Test `belegte_lesegrenze_ist_503_nach_der_frist` bekommt die neue Erwartung, das ist der Fix seiner Erwartung, keine Lockerung),
- `diff_lesen` mit `commit`,
- `diff_lesen` ohne `commit` (Gesamt-Diff; im Testmodul von `diff.rs`, siehe „Überschneidung“),
- `nachfolger_suchen`.

Je Test: `Err(Fehler::Ausgelastet(m))` mit `m` gleich dem Wortlaut des Endpunkts aus Lösung Punkt 2, gewartet mindestens 300 ms, `arbeitsrepo::aufrufe()` unverändert (Git nicht gestartet); danach die Plätze freigeben, derselbe Aufruf gelingt. **Heute rot:** `Fehler::Zeitgrenze` mit „antwortete nicht innerhalb von 10 s“.

Über HTTP genügt die Abbildung: `antwort(Fehler::Ausgelastet(<Wortlaut>))` ergibt 503 mit Rumpf genau `{"fehler":"<Wortlaut>"}` (wie `src/web/mod.rs:1939`). Eine Probe über echte gleichzeitige Anfragen ist kein Gate: Über die API endet die Frist eines Wartenden fast nie nach der der Haltenden, der Fall ist dort nur ein Wettlauf (Lehre „Prüfen-dann-Handeln“, deterministische Probe statt Threads).

### Code-Extraktion für isoliertes Testing

Die Funktion aus Lösung Punkt 1 ist rein (Endung → `Fehler`). Ein Modultest in `lesegrenze.rs` prüft die drei Wortlaute und den Vertrag aus AK 2.

### Regressionstests

**Probe Z (Gegenprobe Zeitgrenze), je Aufrufer:** Lesegrenze frei, Frist schon abgelaufen (wie `commits_lesen.rs:335` `abgelaufene_gesamtgrenze_ist_503`) → weiter `Fehler::Zeitgrenze`, Text mit „antwortete nicht innerhalb von 10 s“ und der Endung des Endpunkts. Dazu ohne geänderte Erwartung grün: R00204-, R00206-, R00208-, R00215- und R00218-Tests, `e2e/einheit/commits.test.js`, `commits-zeichnen.test.js`, `diff.test.js`, `diff-zeichnen.test.js`, `nachfolger.test.js`, `e2e/tests/r00205-ansicht-commits.spec.js`, `r00207-review-seite.spec.js`.

**Probe O (Oberfläche, Einheit, Wächter):** in `e2e/einheit/commits.test.js` bzw. `diff.test.js`. Sie ist **heute schon grün** (geprobt am 2026-11-21 gegen `web/` auf `karte/238`), denn `web/` gibt den neuen Text wörtlich wieder. Sie fängt den Rückschritt aus Pre-Mortem (m) der ADR: Jemand macht später aus jedem 503 den Zeitgrenzen-Wortlaut.

## Akzeptanzkriterien

**Ausgangslage:** Aufgabe mit einem Commit-Verweis `kd:<K1>` auf ein Wegwerf-Repository (Anwendung `kd` als Standardanwendung), wie in den Modultests von `commits_lesen.rs`, `diff.rs` und `nachfolger.rs`. „Plätze halten“ heißt: `LESEN_HOECHSTENS` Plätze mit `betreten(jetzt + 5 s)` nehmen und bis nach dem Aufruf halten. **Rechenbeispiel:** `LESEN_HOECHSTENS` = 4, `GESAMTGRENZE` = 10 s → „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Liste“.

### Bug behoben

- [ ] **AK 1 Probe B, je Aufrufer (N9.4, wörtlich):** Bei gehaltenen Plätzen und Frist jetzt + 300 ms ergibt
  - `commits_lesen` → `Fehler::Ausgelastet` „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Liste“,
  - `diff_lesen` mit `commit=kd:<K1>` → `Fehler::Ausgelastet` „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — kein Diff“,
  - `diff_lesen` ohne `commit` (Gesamt-Diff) → derselbe Text „… — kein Diff“,
  - `nachfolger_suchen` für `kd:<K1>` → `Fehler::Ausgelastet` „Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Suche nach dem Nachfolger“.

  Je Aufruf vergehen mindestens 300 ms, und `arbeitsrepo::aufrufe()` steigt um 0. Nach dem Freigeben der Plätze gelingt derselbe Aufruf. Heute: `Fehler::Zeitgrenze` mit „Git … antwortete nicht innerhalb von 10 s“ (rot).
- [ ] **AK 2 Vertrag des Textes (N9.3 Punkt 3):** Jeder der drei Wortlaute beginnt mit `Lesegrenze`, passt nicht auf `/antwortete nicht (?:innerhalb von|in) \d+ s/`, beginnt nicht mit `Antwortbudget`, enthält keinen Pfad und keinen Verweis. Die Zahlen stammen aus `LESEN_HOECHSTENS` und `GESAMTGRENZE`: `grep -rn "von 4 gleichzeitigen\|Frist von 10 s" src/dienst` findet außerhalb von Testcode nichts.
- [ ] **AK 3 Über HTTP:** `Fehler::Ausgelastet(<Wortlaut>)` ergibt Status 503 und den Rumpf genau `{"fehler":"<Wortlaut>"}`, ohne weiteres Feld. `grep -rni "retry-after\|RETRY_AFTER" src` findet nichts.
- [ ] **AK 4 Probe Z, Gegenprobe je Aufrufer (N9.4):** Lesegrenze frei, Frist abgelaufen → `commits_lesen`, `diff_lesen` mit und ohne `commit` und `nachfolger_suchen` ergeben weiter `Fehler::Zeitgrenze` mit „antwortete nicht innerhalb von 10 s“ und ihrer Endung („— keine Liste“, „— kein Diff“, „— keine Suche nach dem Nachfolger“). Der Wortlaut der Zeitgrenze ändert sich nicht.
- [ ] **AK 5 Probe O, Oberfläche (N9.4, PO Z. 512–513):** Mit `fehler` = Wortlaut des Endpunkts und Status 503 ergibt
  - `fehlerText` (`web/commits.js`) genau „Die Commits ließen sich nicht lesen: Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet — keine Liste (503).“ — nicht „Das Repository antwortete nicht innerhalb von 10 Sekunden“;
  - `listeFehlerText` (`web/diff.js`) genau „Die Liste der Commits ließ sich nicht lesen: Lesegrenze … — keine Liste (503).“ mit dem vollen Wortlaut;
  - `nachfolgerDeuten` (`web/commits.js`) den Satz „Der Nachfolger ließ sich nicht suchen: Lesegrenze … — keine Suche nach dem Nachfolger (503).“ mit dem vollen Wortlaut;
  - `fehlerArt` (`web/diff.js`) für „… — kein Diff“ weiter `zeitgrenze`: Die Diff-Seite behält den Kopf „Zeitgrenze überschritten.“ und darunter „Der Diff ließ sich nicht lesen: Lesegrenze … — kein Diff (503).“ (PO Z. 513).

  Der vorhandene Fall „Zeitgrenzen-Text → Wortlaut des PO“ (`commits.test.js:145`) bleibt grün. `web/` wird nicht geändert.
- [ ] **AK 6 API-Beschreibung (N9.3 Punkt 6):** Die Endpunktliste unter `/api` und die OpenAPI-Beschreibung nennen für `GET …/commits`, `GET …/diff` (mit und ohne `commit`) und `GET …/commits/{verweis}/nachfolger` beim 503 beide Fälle: Git über der Gesamtgrenze von 10 s, **oder** alle 4 Plätze der Lesegrenze bis zur Frist belegt, `fehler` beginnt mit „Lesegrenze“. Quelle: `src/web/endpunkte.rs` `COMMITS_LESEN`, `DIFF_LESEN`, `NACHFOLGER_SUCHEN` und die 503-Antworten in `src/web/mod.rs` (heute `:1191`, `:1206`, `:1282`). Die Beschreibung darf die Zahlen als Literal nennen wie die vorhandenen 503-Teile (`const &str`); AK 2 gilt nur für den Text in `fehler`.
- [ ] **AK 7 README „Für Agenten“:** Die Abschnitte Commit-Liste, Nachfolger und Diff (heute `:170`, `:193`, `:221`) sagen in je einem Satz, dass 503 auch kommt, wenn alle 4 Plätze der Lesegrenze bis zur Frist belegt sind; `fehler` beginnt dann mit „Lesegrenze“, Git ist nicht gestartet, und kanbanD wiederholt nicht selbst. Der Abschnitt „Alle Änderungen der Karte lesen“ (`:223–246`) bleibt unverändert: Er verweist für Grenzen auf den Diff je Commit, und Karte #234 schreibt dort (R00225 AK 8).
- [ ] **AK 8 Mutanten (N9.4):** Jeder Mutant wird von einem benannten Test getötet.
  - (m1) Jede Zeitgrenze heißt Lesegrenze (in einem der drei `abbruch`) → AK 4 rot.
  - (m2) Nur drei Aufrufer umgestellt (je einer der vier ausgelassen, vier Varianten) → AK 1 für den ausgelassenen rot.
  - (m3) Text ohne Präfix `Lesegrenze` → AK 1 und AK 2 rot.
  - (m4) Richtiger Text, aber als `Fehler::Zeitgrenze` → AK 1 rot.
  - (m5) Falsche Endung (Gesamt-Diff mit „— keine Liste“) → AK 1 rot.
  - (m6) `fehlerText` ersetzt jeden 503 durch den Wortlaut der Zeitgrenze → AK 5 rot.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [ ] **AK 9 Bug-Vorlage:** Die Reproduktionstests (AK 1) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt im Szenario der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün, darin die Regressionstests oben ohne geänderte Erwartung außer `belegte_lesegrenze_ist_503_nach_der_frist` (neue Erwartung nach AK 1).

## Implementierungshinweise

- `GESAMTGRENZE` liegt in `commits_lesen.rs:14` und ist über `super::GESAMTGRENZE` erreichbar (`src/dienst/mod.rs:17`); `LESEN_HOECHSTENS` liegt in `lesegrenze.rs:14`.
- Vorbild für den Text aus Konstanten: „Antwortbudget von {} MB belegt“ (`src/dienst/diff.rs:335`).
- Review-Punkt gegen Pre-Mortem (l) der ADR: `betreten` nur zusammen mit der Funktion aus Lösung Punkt 1.
- Kein Agenten-Client der Factory liest diese Texte (`werkzeuge/*.py` geprüft am 2026-11-21: kein Treffer auf „antwortete nicht“, „Antwortbudget“, `/diff`, `/commits`).

## Offene Fragen

Keine. Wortlaut und Diff-Seite sind entschieden (PO Z. 512–513).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Unter Last warten mehr Leseanfragen als die 4 Plätze der Lesegrenze, und eine Anfrage erreicht ihre Frist, ohne dass Git für sie lief. Heute wird daraus der Fehler der Zeitgrenze, und der Text sagt, Git habe nicht geantwortet (X). Entsteht der Fehler an der einzigen Stelle, an der das Warten scheitert, als eigener Text mit „Git nicht gestartet“, dann sagt die Antwort die wahre Ursache (Y). Der Betreiber sucht nicht im Repository, ein Agent unterscheidet Überlast (Präfix „Lesegrenze“, wie „Antwortbudget“) von einem hängenden Git, und die Commit-Liste gibt den Text wörtlich wieder, ohne dass `web/` sich ändert (Z). Der Hebel sitzt im Dienst, nicht in der Oberfläche: So stimmt die Aussage für alle vier Endpunkte und jeden Leser der API.

## Notizen

- Priorität: Mittel. Die Antwort ist richtig (503), nur ihre Begründung ist falsch; Inhalt fällt nicht aus.
- Betroffene Nutzer und Systeme: Betreiber auf der Commit-Liste, der Review-Seite und bei der Nachfolgersuche; Reviewer-Agenten über die API.
- Workaround: keiner nötig; erneut lesen, wenn die Last sinkt.
- Heimat: I0216 unter D0009, eigene Interaction statt Bubble an I0194, I0196, I0198 oder I0208 (Lehre #17/#80).
