---
id: R00215
status: In Arbeit
datum: 2026-11-20
ursprung: Bug-Report
ursprungslauf: R00208
---

# R00215: Behebung — Wackler unter Last: Antwortbudget-Proben (R00208 AK 8, R00206 AK 20 b) und Register speichern (R00209 AK 9)

## Beschreibung

Gefunden im Gate der Nacharbeit #215 (2026-11-20), Befundkarte #231; zuletzt rot im Gate #230.

1. **`akzeptanz_r00208::ak08_antwortbudget`** (R00208 AK 8, Karte #214) und derselbe Aufbau in **`akzeptanz_r00206::ak20b_viele_die_nicht_lesen`** (R00206 AK 20 b): unter Last melden späte Anfragen 503 „Git im Arbeits-Repository antwortete nicht innerhalb von 10 s — kein Diff“ statt 200 oder 503 „Antwortbudget …“. Gezählt auf der Karte: allein grün in 9,9 s bei Last 5,4; die Datei parallel 22 von 23 grün bei Last 7,7, seriell 23 von 23. Erwartet: das Ergebnis hängt nur vom Antwortbudget ab, nicht von der Rechnerlast.
2. **`e2e/tests/r00209-register-repository.spec.js:58`** (R00209 AK 9): in der vollen Suite einmal rot, allein 1 von 1 und in der Datei 13 von 13 grün. Die Ursache ist nicht belegt.

`kontrast.spec.js:159` aus derselben Beobachtung ist mit bfb3cc32 (#226) behoben und gehört nicht hierher.

Zahlt ein auf: [Vision](R00000-vision.md) — die Arbeit hinter der Karte nachvollziehen (Diff live und nur lesend, geschützt durch Antwortbudget und Gesamtgrenze, ADR-0032 N5.1); ein Gate, das nur echte Fehler rot zeigt, ist Voraussetzung, dass diese Schutzzusagen geprüft bleiben.

## Ursachenanalyse

### Root Cause

**Antwortbudget-Proben (eingetreten, im Code belegt durch den architekt, Lauf 231-architekt-1):**

- Die Lesegrenze lässt höchstens 4 Lesevorgänge gleichzeitig zu (`src/dienst/lesegrenze.rs:14`, `LESEN_HOECHSTENS = 4`); wer keinen Platz bekommt, wartet bis zu seiner Frist.
- Die Frist von 10 s zählt ab Eingang der Anfrage (`src/web/mod.rs:1199` und `:1216`), also mit der Wartezeit auf einen Platz.
- Das Antwortbudget wird erst nach dem Git-Lauf belegt (`src/dienst/diff.rs:335`, `src/dienst/gesamt_diff.rs:89`).
- Beide Tests schicken **30 Anfragen gleichzeitig** über 7,3 MB (`gross1.txt`). Sie müssen nacheinander durch 4 Plätze: gemessen 7,69 s Wanduhr bei 24 s CPU in Ruhe (architekt), Abstand zur Frist nur etwa 1,3× (10 s / 7,69 s). Unter Last laufen die späten Anfragen in der Warteschlange ab → `abbruch(Zeitgrenze)` (`src/dienst/diff.rs:368`) statt Budgetentscheidung. Die Tests messen damit CPU-Durchsatz, nicht das Budget.
- Ausgeschlossen: ein Fehler des Programms. Die Gesamtgrenze und die Lesegrenze tun, was ADR-0032 N3.1, N4.1 und N5.1 verlangen; R00206 AK 20 (b) verlangt nicht, dass die N Verbindungen **gleichzeitig** anfragen, nur dass sie offen bleiben und nur die Statuszeile lesen.

**R00209 AK 9 (Hypothese, nicht belegt):** Reihenfolge-Race wie #179/#188. Der Test tippt direkt nach „gespeichert“ weiter (`repository.fill(r)`); ein spätes Nachladen (`web/app.js:3708–3718`: `laden()` nach dem PUT, dazu das Live-Ereignis des Commits) kann die Einrichtungsansicht danach neu anlegen. Ob dabei eine Eingabe verloren geht (Fehler der Seite) oder nur der Test zu früh liest (Fehler des Tests), ist offen und wird zuerst belegt (AK 7).

### Betroffene Komponenten

- `tests/akzeptanz_r00208.rs` (`ak08_antwortbudget`, `langsam`, `rest_lesen`)
- `tests/akzeptanz_r00206.rs` (`ak20b_viele_die_nicht_lesen`, `langsam`, `rest_lesen`)
- `tests/gemeinsam/mod.rs` (neuer gemeinsamer Helfer)
- `e2e/tests/r00209-register-repository.spec.js` (AK 9), nur wenn AK 7 einen Fehler der Seite belegt auch `web/app.js` (`einr-ok`)
- Nicht betroffen: `src/` (Frist, Budget, Lesegrenze bleiben, wie sie sind)

## Lösungsvorschlag

### Langfristige Lösung

**T1 Staffeln (architekt, gewählt):** Ein gemeinsamer Helfer in `tests/gemeinsam` öffnet die N Verbindungen so, dass **höchstens 4 Anfragen gleichzeitig unterwegs** sind: Platz nehmen vor dem Verbinden, Platz freigeben nach dem Eingang der Statuszeile. Alle N Verbindungen bleiben danach offen und ungelesen, bis der Test sie fallen lässt; damit halten die Antworten 200 ihr Budget, und spätere Anfragen treffen auf das volle Budget. `VmRSS` wird am selben Punkt gemessen wie heute (nach dem Eingang aller Statuszeilen). Keine Erwartung ändert sich; die Wartezeit in der Lesegrenze entfällt, also misst der Test das Budget und nicht den Durchsatz.

**R00209 AK 9:** erst belegen (AK 7), dann je nach Befund: Fehler der Seite → in `web/app.js` beheben; Fehler des Tests → auf den Zielzustand warten (ADR-0026, Renderzähler nach dem Speichern zur Ruhe); nicht reproduzierbar → der Test beschreibt bei Rot seinen Zustand selbst (AK 9).

### Alternative Ansätze

- **P1 Frist per Umgebungsvariable einstellbar:** verletzt ADR-0032 N5.1 („keine Konfiguration“) und öffnet den Schutz.
- **P2 Budget vor dem Git-Lauf belegen:** ändert das Programm für einen Testbefund; die Größe ist vor dem Lauf nicht bekannt.
- **T2 503 Zeitgrenze im Test zulassen:** schwächt die Prüfung — ein Programm, das nie ein Budget belegt, könnte dann über Zeitgrenzen grün werden.
- **T3 serielle Testgruppe oder „nur auf ruhigem Rechner“:** verschiebt das Fenster, schützt nicht (Lehre „Timing- und Flake-Fehler am beobachtbaren Urteil festmachen“).
- **T4 kleinere Datei:** ändert die Schranke ⌊64 MB / Größe⌋ und damit die Prüfung von R00206 AK 20.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Rot-Beleg **ohne künstliche Rechnerlast** (Bubble A): ein `git` vorn im `PATH` des Servers (Muster wie `tests/akzeptanz_r00206.rs:132` und `tests/akzeptanz_r00213.rs:96`), das jeden Aufruf um die Verzögerung *d* verlängert und dann das echte Git ausführt. Mit diesem `PATH` sind die heutigen `ak08_antwortbudget` und `ak20b_viele_die_nicht_lesen` (N = 30) rot mit 503 Zeitgrenze (AK 1). Derselbe Aufbau ist nach der Umstellung grün (AK 3).

### Code-Extraktion für isoliertes Testing

Die zweimal vorhandenen Hilfen `langsam` und `rest_lesen` (gleiche Bedeutung in beiden Dateien) und das Staffeln wandern in `tests/gemeinsam/mod.rs`; das langsame Git als gemeinsamer Helfer daneben, wenn beide Dateien es brauchen.

### Regressionstests

- Rust: alle Tests von `akzeptanz_r00206`, `akzeptanz_r00208`, `antwortbudget_strom`, die Modultests in `src/dienst/diff.rs` (`belegt_im_platz_der_lesegrenze`) und das Gate.
- Mutanten (AK 5) gegen den umgestellten Stand.
- Playwright: `r00209-register-repository.spec.js` mit den Verzögerungen aus AK 7, danach die volle Suite im Gate.

## Akzeptanzkriterien

Ausgangslage (herstellbar mit Git und der API, wie R00206 AK 20 und R00208 AK 8): Commit X legt `gross1.txt` mit 170.000 Zeilen zu je 45 Byte an (7,3 MB) und hängt an die Karte; frischer Server-Prozess, eigene Instanz. „Langsames Git“ heißt: ein `git` vorn im `PATH` des Servers, das jeden Aufruf um *d* verzögert und dann das echte Git ausführt.

Herleitung von *d* (Hypothese, in Bubble A gemessen und in die Commit-Nachricht geschrieben): *T* sei die Wanduhr einer **einzelnen** Anfrage `…/diff?…&datei=gross1.txt` mit langsamem Git. 30 Anfragen durch 4 Plätze sind ⌈30 / 4⌉ = 8 Wellen; die späteste Anfrage wartet also etwa 8 × *T*. *d* wird so gewählt, dass 1,5 s ≤ *T* ≤ 3 s gilt: dann ist 8 × *T* ≥ 12 s über der Frist von 10 s (heute rot), und eine einzelne Anfrage bleibt mit mindestens 70 % Abstand unter der Frist (3 s ≤ 0,3 × 10 s). Startwert *d* = 0,4 s.

- [x] **AK 1 Rot-Beleg ohne Rechnerlast:** Gegeben langsames Git mit *d* nach der Herleitung, Load average (1 min) vor dem Lauf unter 3. Wenn `ak08_antwortbudget` und `ak20b_viele_die_nicht_lesen` am heutigen Stand (vor der Umstellung, nur mit dem neuen `PATH`) je dreimal laufen, dann sind beide in 3 von 3 Läufen rot, und mindestens eine Antwort ist 503 mit `fehler`, das mit „Git im Arbeits-Repository antwortete nicht innerhalb von 10 s“ beginnt. Die gemessenen *T*, *d* und die Zahl der Zeitgrenze-Antworten stehen in der Commit-Nachricht.
- [x] **AK 2 Staffeln:** Gegeben 30 Verbindungen über den gemeinsamen Helfer. Wenn der Helfer sie öffnet, dann sind zu keinem Zeitpunkt mehr als 4 Anfragen ohne empfangene Statuszeile unterwegs (der Helfer zählt das Höchstmaß mit und der Test sichert es zu: höchstens 4, mindestens 2), und nach dem Eingang aller 30 Statuszeilen sind alle 30 Verbindungen noch offen und haben nach der Statuszeile kein Byte gelesen. Beide Tests (`ak08_antwortbudget`, `ak20b_viele_die_nicht_lesen` mit N = 6 und N = 30) benutzen diesen einen Helfer; die eigenen Kopien von `langsam` und `rest_lesen` sind entfernt.
- [x] **AK 3 Grün mit langsamem Git, Erwartung unverändert:** Gegeben derselbe `PATH` und dasselbe *d* wie in AK 1. Wenn beide Tests nach der Umstellung je fünfmal laufen, dann sind sie 5 von 5 grün mit genau diesen Zusicherungen, wörtlich wie heute:
  - Anzahl 200 mindestens 1 und höchstens ⌊64 MB / Antwortgröße⌋. Rechenbeispiel: JSON-Antwort ≈ 170.000 Zeilen × 47 Byte (`+`, 44 Zeichen, `\n` als zwei Zeichen) ≈ 7.990.000 Byte → ⌊67.108.864 / 7.990.000⌋ = 8;
  - jede übrige Antwort ist 503 mit `fehler`, das mit `Antwortbudget` beginnt;
  - R00206 (b): `VmRSS` − Ausgangswert ≤ 64 MB + 0,5 MB × N + 8 MB (N = 30: ≤ 87 MB; N = 6: ≤ 75 MB), gemessen nach dem Eingang aller Statuszeilen; (c) nach dem Schließen wird das Budget binnen 10 s wieder frei.
- [x] **AK 4 Zeitgrenze bleibt rot:** Gegeben langsames Git mit *d* so groß, dass eine einzelne Anfrage über 10 s braucht (*T* > 10 s). Wenn einer der beiden umgestellten Tests läuft, dann ist er rot, und die Meldung nennt die 503 mit „Git im Arbeits-Repository antwortete nicht“. Eine 503, deren `fehler` nicht mit `Antwortbudget` beginnt, gilt nie als bestanden.
- [ ] **AK 5 Mutanten bleiben rot:** Gegeben der umgestellte Stand ohne langsames Git. Wenn je Mutant die Rust-Tests laufen, dann:
  - „Budget nie belegt“ (`belegen` gibt den Rumpf zurück, ohne zu buchen) → `ak20b_viele_die_nicht_lesen` mit N = 30 rot und `ak08_antwortbudget` rot (30 × 200 > 8);
  - „Reservieren nach Verlassen des Lesegrenzen-Platzes“ → `ak20b_viele_die_nicht_lesen` mit N = 30 rot (R00206 AK 20 (f) wörtlich) und `belegt_im_platz_der_lesegrenze` rot.
  Je Mutant der rote Test mit Namen in der Commit-Nachricht.
- [x] **AK 6 Schutz unverändert (ADR-0032 N5.1):** Gegeben der Stand nach der Karte. Dann ist `git diff main -- src/` leer: Gesamtgrenze 10 s, Antwortbudget 64 MB und `LESEN_HOECHSTENS` = 4 bleiben, keine neue Umgebungsvariable und keine Konfiguration für Frist oder Budget.
- [x] **AK 7 R00209 AK 9 belegt:** Gegeben der Test AK 9 aus `r00209-register-repository.spec.js`, dessen Ladeanfragen nach jedem Speichern per `page.route` um 0, 150, 300 und 600 ms verzögert werden, einmal mit echtem und einmal mit langsamem Git im `PATH` des Servers. Wenn er je Kombination mit `--repeat-each=5 --workers=1` läuft, dann steht in der Commit-Nachricht je Kombination die Zahl der roten Läufe und, falls rot, der Schritt (speichern ohne Änderung, Repository ändern, Ordner fehlt, leeres Feld, WBS leeren), die gescheiterte Zusicherung und der Zustand der Seite (Wert des Felds „Repository jopu“, Text von `#einr-vorschau`, Inhalt von `kanbanD.md`, Commitzahl).
- [x] **AK 8 R00209 AK 9 behoben, Erwartung unverändert:** Gegeben AK 7 hat rot gezeigt. Wenn der Test danach mit denselben Kombinationen und `--repeat-each=10` läuft, dann ist er 0 von 80 rot, und es gilt weiter wörtlich: nach jedem Speichern ist `kanbanD.md` bytegleich zum Text von `#einr-vorschau` vor dem Speichern, und je Speichern entsteht genau ein Commit (Commitzahl +1, nicht +2). Hat AK 7 gezeigt, dass eine Eingabe nach „gespeichert“ durch ein spätes Neuladen verloren geht, ist das ein Fehler der Seite: dann behebt `web/app.js` ihn, und ein eigener Test belegt mit 600 ms Verzögerung, dass der Betreiber nach „gespeichert“ eingegebene Text im Feld „Repository jopu“ stehen bleibt (ohne Fix rot). Sonst wartet der Test nach ADR-0026 auf den Zielzustand, nie auf Zeit.
- [ ] **AK 9 Selbstbeschreibung, wenn nicht reproduzierbar:** Gegeben AK 7 zeigt in keiner Kombination Rot. Dann meldet der Test AK 9 bei einem künftigen Rot ohne Nachfahren den Schritt und den Zustand aus AK 7. Probe: Mutant „Vorschau zeigt ein Zeichen mehr als die Datei“ → der Test ist rot, und seine Meldung nennt den Schritt, beide Texte und die Commitzahl vorher und nachher.
- [ ] **AK 10 Tagprobe (nur am Tag, hält die Karte nicht):** Gegeben fremde Last mit Load average (1 min) ≥ 5 vor und nach jedem Lauf, z. B. das volle Gate des Directors. Wenn `ak08_antwortbudget`, `ak20b_viele_die_nicht_lesen` und `r00209-register-repository.spec.js` je fünfmal hintereinander laufen, dann sind alle 5 von 5 grün, ohne geänderte Erwartung. Ergebnis und gemessene Last trägt nach, wer die Probe am Tag fährt; ein Rot wird eine neue Befundkarte, keine Nacharbeit dieser Karte.
- [x] Der Reproduktionstest ist ohne Fix rot und mit Fix grün (AK 1 → AK 3)
- [x] Der ursprüngliche Fehler tritt im Szenario der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün

## Implementierungshinweise

- **Helfer (Skizze, Entwurf bleibt beim entwickler):** `gestaffelt(adresse, pfad, n, gleichzeitig) -> Vec<(TcpStream, u16)>` mit einem Zähler/Semaphor in den Threads; Platz vor `connect`, Freigabe nach der Statuszeile; Rückgabe aller offenen Verbindungen. `rest_lesen` für die 503 dazu.
- **Langsames Git:** wie `git_skript`/`langsames_git` in `akzeptanz_r00206.rs:132` bzw. `akzeptanz_r00213.rs:96` — `sleep <d>; exec <echtes git> "$@"`; Start über `starten_mit(…, &[("PATH", …)])`. Kein `nice`, keine Lastgeneratoren im Test.
- **Risiko Mutant (f):** Gestaffelt sind nie mehr als 4 Anfragen im Server, die Lesegrenze blockiert also nicht mehr. Tötet `ak20b_viele_die_nicht_lesen` (N = 30) den Mutanten „Reservieren nach Verlassen des Platzes“ danach nicht mehr, ist AK 5 rot: nicht still auf den Modultest ausweichen, sondern im Bericht melden (Rückfrage an den architekt, ob R00206 AK 20 (f) mit `belegt_im_platz_der_lesegrenze` erfüllt ist).
- **R00209:** Ladeanfragen nach dem Speichern sind `PUT /api/einstellungen` folgende `GET`s aus `laden()` und das Live-Ereignis des Commits; `page.route` nur für die `GET`s, der `PUT` bleibt unverzögert. Renderzähler `kdTest.renders()` (`web/app.js:4787`), Ruhe über `bereit` (ADR-0026 Regel 3).
- Gate nie neben einem anderen Gate; AK 1, AK 3 und AK 7 brauchen keine fremde Last und laufen auch nachts.

## Offene Fragen

- Frage an den PO (nicht blockierend, Vorschlag gilt bis zur Antwort): Zeigt AK 7, dass ein spätes Neuladen eine Eingabe überschreibt, die der Betreiber nach „gespeichert“ macht — wird das in dieser Karte als Fehler der Seite behoben? **Vorschlag: ja**, die Eingabe bleibt stehen (AK 8); das Warten im Test allein würde den Fehler verdecken.

## Warum löst diese Anforderung das Problem? (Pflicht)

30 gleichzeitige Anfragen → Warteschlange vor 4 Plätzen → Wartezeit zählt zur 10-s-Frist → unter Last Zeitgrenze statt Budgetentscheidung → Test rot ohne Fehler im Programm. Staffeln nimmt die Warteschlange heraus, ohne eine Verbindung zu lesen: höchstens 4 unterwegs → keine Wartezeit auf einen Platz → jede Anfrage braucht nur *T* (≤ 3 s mit langsamem Git, ≪ 10 s) → die Antworten 200 halten ihr Budget, die übrigen bekommen 503 „Antwortbudget …“ → das Ergebnis hängt nur vom Budget ab. Der Hebel sitzt im Test, weil das Programm tut, was ADR-0032 verlangt. Für R00209 gilt: erst belegen, dann am beobachtbaren Urteil festmachen (Lehre „Timing- und Flake-Fehler am beobachtbaren Urteil festmachen, nicht an Wartezeiten“).

## Notizen

- Priorität: Hoch (Vorrang-Karte: Wackler treffen jedes Gate unter Last, zuletzt Gate #230)
- Betroffene Nutzer/Systeme: entwickler und Director der Factory beim Gate; R00209-Teil möglicherweise der Betreiber in den Einstellungen (AK 8)
- Workaround: rote Tests einzeln nachfahren (kostet je Gate Nachfahren und Bewerten)
- Herkunft der Zahlen: 9,9 s / Last 5,4, 22 von 23 / Last 7,7, 23 von 23 seriell, 1 von 1, 13 von 13 — gezählt auf Karte #231; 7,69 s Wanduhr, 24 s CPU — gemessen vom architekt; 7.990.000 Byte und Schranke 8 — gerechnet; *d* = 0,4 s und 1,5–3 s für *T* — Hypothese, gemessen in Bubble A.
- Nicht in dieser Karte (Vorschlag des architekt, eigene Anforderung): Meldung „Lesegrenze belegt“ getrennt von „Git antwortete nicht innerhalb von 10 s“ (`src/dienst/diff.rs:368` deckt heute beide Fälle).
