---
id: R00267
status: Neu
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00204
---

# R00267: Behebung — die Enkel-Pipe-Probe und die beiden Zeitgrenzen-Proben aus R00204 urteilen im Gate über Zustand, Marke und Prozessende; die Wanduhr-Spanne läuft als Lastprobe

## Beschreibung

Karte #283 (Release-Lauf v1.0.48, Job `pruefen`, Run 11:02 UTC, Commit `41f9f45b`): `tests/akzeptanz_r00204.rs:664` `muss2_enkel_haelt_die_pipe` wurde auf dem GitHub-Runner rot. Die Wiederholung desselben Jobs war grün, lokal ist der Test im Gate grün, und keine Karte des Tages hat ihn oder `src/git` berührt. Der Test beurteilt neben dem Zustand eine **Wanduhr-Spanne** (`:682` `10 s ≤ d ≤ 15 s` außerhalb der Prozessgruppe, `:674` `d ≤ 5 s` in der Gruppe). Unter Fremdlast kippt die Spanne, nicht die Frist. Dieselbe Klasse tragen `ak09_zeitgrenze_503_und_prozessgruppe` (`:337`, Spanne `:347`) und `ak09_gesamtgrenze_statt_summe_der_prozessgrenzen` (`:362`, `d ≤ 15 s` `:372`).

Die Entscheidung liegt vor: **ADR-0026 Nachtrag N7** (Regel 13, Commit `0fecec13`) — im Gate urteilt der Zustand (Status samt Ursache `zeitgrenze`, die Marke „der Enkel außerhalb der Gruppe lebt nach der Antwort“, das Prozessende), die Wanduhr-Spanne läuft als Lastprobe (`#[ignore]`, Last < 2). Am Programm ändert sich nichts; `src/git/arbeitsrepo.rs` (ADR-0032 N3.1, Security Muss 2, `2bbf5074`) bleibt unberührt.

R00204 bleibt abgenommen; diese Anforderung verschiebt nur den Ort der Spannen-Messung, wie N7 es festlegt (Verweiszeile, keine Änderung an R00204).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109 f.): der `pruefen`-Job bewacht genau dieses Lesen, und ein roter Job hält jede Auslieferung auf.

## Ursachenanalyse

### Root Cause

1. **Das Maß hängt an der Maschine, nicht am Verhalten.** Die Probe misst vom Absenden bis zur Antwort; Verbindungsannahme, Aufgaben-Zeitplanung und die vier gleichzeitig laufenden `ENKEL`-Varianten (`:637`, `:665`) liegen obendrauf. Auf dem Runner (vier Kerne, Fremdlast) kippt die obere Schranke, während die Frist unverändert 10 s beträgt.
2. **Der Zustand ist schon geprüft — nur unvollständig.** `503` samt `fehler` steht (`:682`), das Prozessende in der Gruppe (`:677`), aber die **Marke** „der Enkel außerhalb der Gruppe lebt nach der Antwort“ fehlt als Zusicherung; heute steht dort nur `assert!(!pids.is_empty())` (`:670`), das allein prüft, dass überhaupt ein Enkel gestartet wurde.
3. **Die Klassengrenze aus N5a war zu weit.** N5a nahm „Grenzen im Sekundenmaßstab mit Abstand ≥ 30 %“ vom Gate aus; die 1,5-fache Obergrenze (`:682`) trägt unter Fremdlast nicht. N7 berichtigt: nicht der Abstand entscheidet, sondern **was** die Grenze misst — eine Wanduhr-Spanne um einen erwarteten Zeitablauf ist Lastprobe, der Zustandsteil bleibt im Gate.

Ausgeschlossen: ein Fehler im Programm. `gruppe_toeten` (`src/git/arbeitsrepo.rs:943`) und `bis_zum_ende` (`:963`, `recv_timeout` `:964`) sind unverändert; lokal ist der Test im Gate grün. Ob der Runner-Bruch die Spanne oder die Gruppe traf, entscheidet die `befunde`-Zeile (`:690`) des Runner-Logs (Offene Frage 1).

### Betroffene Komponenten

- `tests/akzeptanz_r00204.rs`: `muss2_enkel_haelt_die_pipe` (`:664–691`), `ak09_zeitgrenze_503_und_prozessgruppe` (`:337–359`), `ak09_gesamtgrenze_statt_summe_der_prozessgrenzen` (`:362–376`); dazu die `#[ignore]`-Lastproben in derselben Datei (Vorbild `ak08_lastprobe_lesen_ohne_sperre`, `:306`; `last()` `:332`, `lebt()` `:276`).
- **Nicht** betroffen: `src/` (`arbeitsrepo.rs`, `fehler.rs`), `web/`, R00204, ADR-0032; die Playwright-Wanduhr-Grenzen (#279/R00260) und die übrigen Rust-Fälle (#276/R00261).

## Lösungsvorschlag

### Langfristige Lösung

**Option G1 (entschieden in ADR-0026 N7): Urteil und Messung trennen.**
- Im Gate steht nur die zeitfreie Aussage derselben Zusage: `503` mit `fehler == "zeitgrenze"` (`src/fehler.rs:33`), die Marke (der Enkel außerhalb der Gruppe lebt nach der Antwort), das Prozessende (der Enkel in der Gruppe ist danach tot); bei `ak09`/`ak09_gesamtgrenze` zusätzlich Prozess-Zähler und Cache-Zustand wie heute.
- Die Spannen (`10 s ≤ d ≤ 15 s`, `d ≤ 5 s`, `d ≤ 15 s`) laufen als `#[ignore]`-Lastproben im selben Modul, nur bei Last < 2 (1-Minuten-Wert aus `/proc/loadavg`), mit Last und `d` in der Ausgabe; bei Last ≥ 2 „keine Messung: Last < 2 nötig“ statt stillen Grüns; im Gate erscheinen sie als `ignored`.
- Die `20 s` des Clients (`:655`) bleiben allein als **Ausbleibe-Frist** (Ablauf liefert `0` und macht den Test benannt rot), kein Leistungsurteil.

### Alternative Ansätze

Alle drei in ADR-0026 N7 „Verworfen“ entschieden; hier übernommen, keine eigene Wahl:

- **G2 Spanne im Gate lassen, nur die Grenze anheben:** verschiebt das Fenster, das Gate urteilt weiter über die Maschine.
- **G3 die ganze `muss2`-Probe als Lastprobe führen:** der Zustand („der Enkel verlängert die Frist nicht“) ist zeitfrei prüfbar und verschwände sonst aus dem Gate.
- **G4 Test löschen:** die Zusage aus R00204 Security Muss 2 bliebe unbewacht.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Kein neuer roter Test: der Fehler ist ein Wettlauf gegen die Wanduhr, nicht ein reproduzierbarer Zustand. Nach der Lehre #280 (Rate statt einzelnes Rot) sind **die beiden Mutanten der Rot-Beleg** (AK 5), nicht ein Lastlauf; die Reproduktion unter Last ist Beobachtung, kein Gate. Der heutige Rot-Beleg ist der Release-Job `pruefen` (v1.0.48, Run 11:02 UTC, `41f9f45b`).

### Code-Extraktion für isoliertes Testing

Nicht nötig: die Helfer `git_skript` (`:264`), `mit_enkel` (`:645`), `lebt` (`:276`) und `last` (`:332`) liegen in der Datei und werden von den Lastproben mitbenutzt.

### Regressionstests

Alle Tests aller Ebenen grün; `cargo test --test akzeptanz_r00204` zehnmal unter Last ≥ 6 grün (AK 4). Die Zustandsaussagen der drei Fälle bleiben wörtlich erhalten.

## Akzeptanzkriterien

### Gate ohne Wanduhr — `muss2`

- [ ] **AK 1 Zustand und Marke statt Spanne:** Gegeben die vier Varianten aus `ENKEL` (`:637`, in der Gruppe, `setsid`, `setsid … 2>/dev/null` hält stdout, `setsid … >/dev/null` hält stderr) und der Shim `git_skript` (`:264`), wenn `cargo test --test akzeptanz_r00204 muss2_enkel_haelt_die_pipe` läuft, dann beurteilt **keine** Zusicherung eine Dauer, und es gilt zeitfrei: für jede Variante außerhalb der Gruppe `503` mit `fehler == "zeitgrenze"` **und mindestens ein Enkel dieser Variante lebt nach der Antwort**; für den Enkel in der Gruppe `200` **und kein Enkel dieser Variante lebt danach**. Die Dauer darf als Beobachtung in der Ausgabe stehen. Die `20 s` des Clients (`:655`) bleiben allein als Ausbleibe-Frist (Ablauf → `0` → benannt rot). Heute: `:682` und `:674` beurteilen die Spanne, und die Marke „lebt danach“ fehlt (`:670` prüft nur, dass ein Enkel gestartet wurde). **Probe:** `cargo test --test akzeptanz_r00204 muss2_enkel_haelt_die_pipe -- --nocapture` bei Last ≥ 6; die vier Varianten erscheinen mit ihren Antworten, der Fall ist grün.
- [ ] **AK 2 Nachbarn mitgezogen:** Gegeben `ak09_zeitgrenze_503_und_prozessgruppe` (`:337`) und `ak09_gesamtgrenze_statt_summe_der_prozessgrenzen` (`:362`), wenn `cargo test --test akzeptanz_r00204` läuft, dann tragen beide keine Dauer-Zusicherung mehr; ihre Zustandsaussagen bleiben wörtlich: `503` (`:345`), genau zwei gestartete Prozesse und keiner lebt nach dem Abbruch (`:348–353`), nach Entfernen des Skripts `200` mit fünf Einträgen und ohne abgebrochenes Ergebnis im Cache (`:354–358`); bei der Gesamtgrenze `503`, beide Prozesse tot, keiner über die Grenze hinaus (`:371`, `:373–375`). Heute beurteilen `:347` und `:372` die Spanne. **Probe:** der Aufruf oben; ohne `-g`-Filter erscheinen die beiden Fälle grün, und in ihren Rümpfen steht keine Zusicherung mehr auf `d` (die Wartezeit `sleep` bleibt; Gegenprobe: die Lastproben der drei Fälle messen `d`).

### Lastprobe

- [ ] **AK 3 Spanne als Lastprobe:** Gegeben Last < 2 (1-Minuten-Wert aus `/proc/loadavg`), wenn `cargo test --release --test akzeptanz_r00204 -- --ignored --nocapture` läuft, dann nennen die drei Lastproben (je Fall eine, `#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]`, Vorbild `:306`) die Last und je Messung `d` und prüfen unverändert: außerhalb der Gruppe `10 s ≤ d ≤ 15 s`, in der Gruppe `d ≤ 5 s`, bei der Gesamtgrenze `d ≤ 15 s`. Bei Last ≥ 2 steht „keine Messung: Last < 2 nötig (Last …)“ und kein Wert gilt als bestanden; im Gate erscheinen die drei als `ignored`. **Probe:** der Aufruf oben bei Last < 2 — Ausgabe mit Last und Werten; `cargo test --test akzeptanz_r00204` listet die drei neuen als `ignored` (mit `ak08_lastprobe_lesen_ohne_sperre` vier).
- [ ] **AK 4 Grün unter Last im Gate:** Gegeben Last ≥ 6 (aus `/proc/loadavg` gemessen), wenn `cargo test --test akzeptanz_r00204` zehnmal hintereinander läuft, dann sind alle zehn Läufe grün, und in den drei Fällen steht keine Zusicherung auf einer Dauer außer der Ausbleibe-Frist. **Probe:** zehn Läufe, Zähler in der Commit-Nachricht; heute kann mindestens ein Lauf an `:682` rot werden (so geschehen im Release-Job `pruefen`).

### Mutanten (Rot-Beleg, Lehre #280)

- [ ] **AK 5 Mutanten töten die Gate-Probe ohne Zeitmaß:** Gegeben eine Kopie des Standes (nicht der Worktree, `src/git/arbeitsrepo.rs`), wenn `bis_zum_ende` (`:963`) ohne Frist wartet (blockierendes `recv()` statt `recv_timeout`, `:964`, Mutant M1 „Enkel erbt die Pipe“) **oder** `gruppe_toeten(gruppe)` (`:943`) entfernt ist (M2), dann wird `muss2_enkel_haelt_die_pipe` in jedem Lauf rot — M1 über die Ausbleibe-Frist (`0` statt `503`), M2 über „Enkel lebt“ (`:677`) oder ebenfalls die Ausbleibe-Frist —, ohne dass eine Dauer beurteilt wird; beide Mutanten werden danach auf dem committeten Stand zurückgelegt (`git checkout HEAD -- …` + `touch`). `git diff --stat HEAD -- src/` ist leer. **Probe:** die beiden Mutantenläufe, je mit dem benannten roten Fall; danach Original zurück, ein Lauf grün.

## Implementierungshinweise

- **Nur Tests**, ein Slice; `src/git/` unberührt, Mutanten nur in einer Kopie des Standes (`gemeinsam/regeln.md`, „Tests und Gate“).
- Lastproben im selben Modul (die Helfer liegen dort), `last()` (`:332`) einmal je Probe nutzen, Muster `ak08_lastprobe_lesen_ohne_sperre` (`:306`); Vorbilder außerhalb: `tests/lastprobe_r00206.rs`, `tests/lastprobe_r00214.rs`.
- Keine Lastprobe nachts (21–8 Uhr, Lehre #234) und nicht neben einem anderen Gate (Lehre #155); Last aus `/proc/loadavg`, nicht angenommen.
- `assert!(befunde.is_empty(), "{befunde:#?}")` (`:690`) bleibt der eine Meldepunkt; die Befunde nennen die Variante.
- Vor dem Bau die `befunde`-Zeile des Runner-Logs feststellen (Offene Frage 1).

## Offene Fragen

1. **An den Director (vor dem Bau):** Der Kartenbefund („zweite Anfrage lief in die Frist, erwartet war 200“) widerspricht dem Code: `200` gilt nur für den Enkel **in** der Gruppe (`:674`), außerhalb erwartet der Test `503` (`:682`). Zeigt die `befunde`-Zeile des Runner-Logs (Run 11:02 UTC, `41f9f45b`) einen Bruch **in der Gruppe** (`503` statt `200` oder `d > 5 s`), dann griffe `gruppe_toeten` (`:943`) unter Last nicht — das ist ein **Programmbefund** und eine eigene Karte; diese Anforderung gilt dann nur für den Spannen-Bruch. Empfehlung: Logzeile abrufen; ist sie nicht mehr abrufbar, den Spannen-Fall bauen und den Gruppen-Fall als eigene Karte offen halten.
2. **An den product-owner:** keine Richtungsfrage; die Spannen-Grenzen selbst bleiben unverändert.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser war ein roter `pruefen`-Job im Release, der jede Auslieferung aufhält, obwohl keine Karte den geprüften Code berührt hatte. Die Ursache ist nicht das Programm, sondern ein Test, der zwei Dinge in einer Zusicherung mischt: eine Frist, die greifen **soll**, und eine Maschinenzeit, die unter Fremdlast kippt. Wenn das Gate nur den Zustand beurteilt (503 mit Ursache, Enkel lebt danach, Enkel in der Gruppe tot), dann bedeutet ein rotes Gate wieder einen echten Fehler; die Zeitzusage geht nicht verloren, sie läuft ausdrücklich bei ruhiger Maschine mit genannten Werten. Gerade diese Stelle ist der Hebel, weil der `pruefen`-Job die einzige Tür zur Auslieferung ist: ein Wackler dort kostet jeden Lauf einen Wiederholungszyklus oder eine Auslieferung.

## Missing-Docs

Keine.

## Notizen

- **Priorität:** Hoch (roter `pruefen`-Job hält jede Auslieferung auf).
- **Betroffene Nutzer/Systeme:** Factory (Release-Job, Merge-Wache); Menschen nicht betroffen.
- **Herkunft der Zahlen:** Release-Lauf v1.0.48 und Run 11:02 UTC aus der Karte #283; Zeilennummern und Bestand am Stand `0fecec13` gelesen; keine eigene Lastmessung in dieser Detailplanung.
- **Verworfene Alternativen:** G2, G3, G4 aus ADR-0026 N7 „Verworfen“ (je ein Satz oben).
- **Nicht Teil:** Playwright-Wanduhr-Grenzen der Review-Seite (#279/R00260); andere Rust-Dauer-Grenzen (#276/R00261); jede Änderung an `src/`; eine neue ADR (N7 trägt).
- User Story: `user-stories/R00267.md`.