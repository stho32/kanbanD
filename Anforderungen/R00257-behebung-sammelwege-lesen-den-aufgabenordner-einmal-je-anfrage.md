---
id: R00257
status: Neu
datum: 2026-11-26
ursprung: Bug-Report
ursprungslauf: R00065
---

# R00257: Behebung — Sammelwege lesen den Aufgabenordner einmal je Anfrage, die verwandten n²-Stellen werden linear, höchstens 5000 Einträge je Sammelanfrage

## Beschreibung

Karte #241, Befund des security-reviewer bei der Nachprüfung von #228 (Lauf 228-security-reviewer-2), Bestand von `main`. `PATCH /api/aufgaben/mehrere` liest für **jede** Änderung das ganze Verzeichnis `aufgaben/` neu, und das unter der Schreibsperre. Bei n Änderungen und m Aufgabendateien kostet das n × m. Jeder mit Konto kann das auslösen, und während der Kette wartet jede andere Schreibanfrage.

**Reproduktion** (Abnahme-Probe der Karte, wörtlich): zuerst mit `python3 gemeinsam/scratchpad/srev-228/probe_nachher.py <port> 4000 1000` mindestens 4.002 Aufgaben anlegen, danach `python3 gemeinsam/scratchpad/srev-228/probe_kontrolle.py <port> 4000` (Skripte in der Ablage der Factory).

| Zeile | heute | Soll |
|---|---|---|
| `titel only` (4.000 Titeländerungen in einer Anfrage) | 18 s | unter 1 s |
| fremder `PATCH /api/aufgaben/{nr}` während der Kette | wartet 12–15 s | wartet nicht spürbar (< 1 s nach dem Ende der Kette) |

Dasselbe Muster steckt in `POST /api/aufgaben/archivieren`, `POST /api/aufgaben/zurueckholen` und `POST /api/boards/{slug}/aufgaben/mehrere`. Zwei verwandte Stellen suchen linear in einer Schleife (doppelte Nummern in `Ordner::aufgaben`, Dateiname in `board_text`); bei 30.002 Aufgaben dauert `GET /api/aufgaben` 4,1–4,6 s. Anlegen (`POST /api/aufgaben/mehrere`) und Teilaufgaben (`…/teilaufgaben/mehrere`) haben keine Obergrenze: ein Rumpf von 50 MB trägt rund 10⁶ Einträge, je einer eine Datei und ein Pfad im Commit unter der Sperre.

**Erwartet:** Eine Sammelanfrage kostet unter der Sperre O(m + n), höchstens 5000 Einträge sind erlaubt, und eine fremde Einzeländerung wartet nicht spürbar. **Tatsächlich:** O(n × m), ohne Obergrenze der Einträge.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen und Agenten arbeiten gleichzeitig am selben Ordner; ein Agent mit Konto darf mit einer Anfrage niemanden 18 s lang aussperren. Mehrfachauswahl und „Spalte archivieren“ (R00065) bleiben bei vollen Boards bedienbar.

### Domänenbezug

„Sammelanfrage“ und „Sammelweg“ sind Begriffe aus ADR-0044 und B0344 (eine Anfrage mit einer Liste von Einträgen, ein Commit) und haben im Glossar keinen Eintrag. Der Hinweis D00007 ist nicht betroffen: die Oberfläche zeigt die neue 400 dort, wo sie heute jeden Fehler der Sammelwege zeigt.

## Ursachenanalyse

### Root Cause

Belegt am Code (`0e7eb0b9`, gelesen, ADR-0044 „Kontext“):

1. **Je Eintrag ein Listing unter der Sperre.** `Kanban::mehrere_aendern` (`src/dienst/aufgabe_aendern.rs:50`) nimmt `gesperrt()` (`:56`) und ruft in der Schleife `self.ordner().aufgabe(nummer)` (`:64`). `Ordner::aufgabe` (`src/ablage.rs:165`) ruft `aufgabenpfad` (`:139`), und das listet bei jedem Aufruf ganz `aufgaben/` über `markdown_dateien` (`read_dir` und Sortierung, `:189`). Dieselbe Schleife steht in `mehrere_archivieren` (`src/dienst/archiv.rs:122`, archivieren und zurückholen) und in `mehrere_auf_board_legen` (`src/dienst/zuordnung.rs:37`, nur Existenzprüfung).
2. **Lineare Suche in der Schleife.** `Ordner::aufgaben` sucht doppelte Nummern mit `gut.iter().find` (`src/ablage.rs:119`), `board_text` den Dateinamen je Board-Zeile mit `aufgaben.iter().find` (`src/dienst/mod.rs:258`). Beides ist O(m²) bzw. O(Zeilen × m).
3. **Keine Grenze der Einträge.** Die Rumpfgrenze der Routen (50 MB, `src/web/mod.rs:119`) begrenzt Bytes, nicht Einträge.

Ausgeschlossen: `bewegen-mehrere` und `POST /api/aufgaben/mehrere` lesen den Ordner schon einmal je Anfrage (`aufgabe_anlegen.rs:137`, ADR-0004) und brauchen nur die Grenze; `braucht_eintragen` (`braucht.rs:106`) liest ohne Sperre, begrenzt durch die Labels einer Aufgabe — kein Sperrthema, nicht Teil.

### Betroffene Komponenten

- `src/ablage.rs` — `aufgabenpfad`, `aufgabe`, `aufgaben`; neu: Momentaufnahme der Dateinamen (Arbeitsname `Aufgabenverzeichnis`, ADR-0044 E1)
- `src/dienst/aufgabe_aendern.rs`, `src/dienst/archiv.rs`, `src/dienst/zuordnung.rs` — die drei Sammelwege mit Schleife
- `src/dienst/mod.rs` — `board_text`; Tür der Sammelwege (`ohne_doppelte`, B0344), dort die neue Grenze
- die sieben Sammelwege für die Grenze: `PATCH /api/aufgaben/mehrere`, `POST /api/aufgaben/archivieren`, `POST /api/aufgaben/zurueckholen`, `POST /api/aufgaben/mehrere`, `POST /api/boards/{slug}/aufgaben/mehrere`, `POST /api/boards/{slug}/bewegen-mehrere`, `POST /api/aufgaben/{nr}/teilaufgaben/mehrere`; ihre Beschreibungen in `src/web/mod.rs`
- Oberfläche (`web/`): **kein** neuer Code; sie zeigt die 400 wie jeden Fehler der Sammelwege (PO Z. 671)

## Lösungsvorschlag

### Langfristige Lösung

ADR-0044, akzeptiert (E1, E2, E3), Entscheidungen des PO `AI-Team/po-entscheidungen.md` Z. 669–672:

- **E1 (Option B):** Die Sammelwege bauen **einmal nach `gesperrt()`** eine Momentaufnahme der Dateinamen von `aufgaben/` (Nummer → nummerierte Pfade in Namensreihenfolge; Rückfall auf den Inhalt höchstens einmal je Anfrage und erst bei Bedarf) und fragen in der Schleife nur sie. `Ordner::aufgabe(nr)` und `aufgabenpfad(nr)` werden Aufrufe derselben Momentaufnahme: eine Implementierung der Pfadregel R00123/B0573, nicht zwei. Die Momentaufnahme ist ein lokaler Wert im Sperrbereich, nie ein Feld in `Kanban`.
- **E3:** `Ordner::aufgaben` sucht doppelte Nummern über eine `HashMap<u32, usize>`, `board_text` den Dateinamen über eine Map Nummer → Datei. Kein Verhalten ändert sich.
- **E2:** höchstens **5000 Einträge** je Sammelanfrage auf allen sieben Wegen, eine Konstante im Code. Geprüft **vor** `gesperrt()`, vor jedem Lesen und vor `ohne_doppelte`; Antwort 400 `{fehler}` mit dem Wortlaut des PO (Z. 670). Die Oberfläche teilt nicht auf (Z. 671).

### Alternative Ansätze

- **Option A** (alle Aufgaben einmal lesen und per Map nachschlagen): eine Anfrage mit einem Eintrag läse alle m Dateien unter der Sperre, und die Zuordnung liefe über den Inhalt statt über den Dateinamen — weicht von R00123/B0573 ab. Verworfen (ADR-0044).
- **Option C** (Cache über Anfragen hinweg): zweiter Zustand, bis 150 ms falscher Stand nach Änderungen von außen, Prüfen-dann-Handeln gegen den Cache statt gegen die Platte. Verworfen (ADR-0044, ADR-0004).
- **Nur Grenze ohne E1**: 5000 × 5000 Listings blieben möglich; die Grenze ist zweite Sicherung, nicht der Fix. Verworfen.

## Test-Strategie

Ebenen nach `gemeinsam/regeln.md` („Interactor je Interaction“): AK 1–4 und 6 als Integrationstests in-process gegen `Kanban` bzw. den Router (Rust, `tests/akzeptanz_r00257.rs` und Modultests in `src/ablage.rs`); AK 5 als E2E, denn es ist der Fehlerpfad durch die Oberfläche; AK 7 als Lastprobe (`#[ignore]`, nie im Gate); AK 8 als Tagprobe im echten Programm.

### Unit Test zur Bug-Reproduktion

**Listing-Zähler** (ADR-0044 Prüfliste 1): ein Zähler der Aufrufe von `markdown_dateien("aufgaben")`, nur unter `cfg(test)`, je Ordner-Instanz oder thread-lokal (parallele Tests zählen nicht mit). Am heutigen Stand ist er für `mehrere_aendern` mit n = 300 mindestens 300 — rot gegen „höchstens 3, unabhängig von n“. Dazu am heutigen Stand rot: 5001 Einträge an `PATCH /api/aufgaben/mehrere` ergeben heute 404 (unbekannte Nummer) statt der 400 mit Grenzmeldung, an `POST /api/aufgaben/mehrere` heute 201 mit 5001 neuen Dateien.

### Code-Extraktion für isoliertes Testing

Die Pfadregel als Funktion über der Momentaufnahme (Namen rein, Pfad oder Fehler raus) ist ohne Platte testbar; die Grenze als reine Prüffunktion `Anzahl → Ok | Fehler` für die Spanne 4999/5000/5001.

### Regressionstests

- Die bestehenden Tests der Pfadregel (`src/ablage.rs:356–359`) laufen unverändert gegen `aufgabe`/`aufgabenpfad`.
- Die Tests der Tür der Sammelwege (B0344, „#n doppelt in der Anfrage …“), der Kreisprüfung im Sammelweg (R00214), der Grenzen (WIP 409, 403, 423 der Archiv-Familie, R00096/R00159) und der Mehrfachauswahl (R00065) bleiben ohne geänderte Erwartung grün.
- Alle Tests aller Ebenen sind grün (Gate).

## Akzeptanzkriterien

- [ ] Der Reproduktionstest (Listing-Zähler bei n = 300) ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt im Szenario der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün

### E1 — ein Listing je Anfrage

- [ ] **AK 1 Listings unabhängig von der Zahl der Einträge:** Gegeben ein Ordner mit 400 Aufgaben (#1–#400), wenn je eine Anfrage mit n = 1, 10 und 300 Einträgen an `mehrere_aendern` (Titel), `mehrere_archivieren` (archivieren, danach zurückholen) und `mehrere_auf_board_legen` geht, dann ist für jeden der vier Wege die Zahl der Listings von `aufgaben/` bei n = 300 gleich der bei n = 1 und höchstens 3; gezählt werden die Momentaufnahme und die bestehenden Einmal-Leser des ganzen Ordners (Kreisprüfung `Tuer::ordner_lesen` nur mit neuem `braucht:`-Label, `archivieren_pruefen`/`zurueckholen_pruefen`/`grenzen_pruefen` in `src/dienst/zugregeln.rs`, `board_text`). Einzeldateilesungen außerhalb dieser Einmal-Leser sind höchstens n + 1. Rechenbeispiel: n = 300 → heute mindestens 300 Listings (eines je `aufgabenpfad`), Soll ≤ 3. Variante Rückfall: eine Anfrage mit zwei von Hand benannten Dateien (`von-hand.md` mit `id: 9`, `noch-eine.md` mit `id: 11`) liest den Inhalt des Ordners höchstens einmal — Listings weiter ≤ 3.
- [ ] **AK 2 Pfadregel im Sammelweg gleich dem Einzelweg:** Gegeben die vier Dateien `0007-sieben.md`, eine defekte `0008-kaputt.md`, `von-hand.md` mit `id: 9`, und keine Datei für #99, wenn `PATCH /api/aufgaben/mehrere` je mit genau einem Eintrag auf 7, 8, 9 und 99 geht, dann ändert 7 die Datei `0007-sieben.md`, 8 ergibt 423, 9 ändert `von-hand.md` und 99 ergibt 404 — jeweils wie `PATCH /api/aufgaben/{nr}` auf dieselbe Nummer. Eine Anfrage mit den Einträgen 7 und 99 ergibt 404, `0007-sieben.md` ist zeichengleich, kein Commit (`git rev-list --count HEAD` gleich). Dasselbe für `POST /api/aufgaben/archivieren` und `POST /api/boards/{slug}/aufgaben/mehrere` mit 7, 8, 9, 99.
- [ ] **AK 3 Momentaufnahme nach der Sperre:** Gegeben ein Test, der die Sperre des Ordners hält und dann im Ordner `aufgaben/0010-neu.md` anlegt, wenn danach auf einem zweiten Faden `mehrere_aendern` mit dem Eintrag 10 startet und der Test die Sperre erst dann freigibt, dann findet die Änderung #10 (200, Titel geändert) — die Momentaufnahme stammt aus der Zeit nach dem Warten. Am Code: `Kanban` hat kein Feld vom Typ der Momentaufnahme (`grep` in `src/dienst/mod.rs`), und in jedem der drei Sammelwege entsteht sie nach `let _sperre = self.gesperrt();`. Mutant „Momentaufnahme vor `gesperrt()`“ wird rot.

### E2 — höchstens 5000 Einträge je Sammelanfrage

- [ ] **AK 4 Grenze an allen sieben Wegen, vor der Sperre:** Gegeben ein eingerichteter Ordner, wenn an jeden der sieben Sammelwege eine Anfrage mit 5001 Einträgen geht (gezählt wird die Liste des Rumpfs: `aenderungen` bei `PATCH /api/aufgaben/mehrere`, `nummern` bei archivieren, zurückholen und auf Board legen, `titel` beim Anlegen, `ziele` bei `bewegen-mehrere`, `texte` bei Teilaufgaben), dann antwortet er 400 mit `{fehler}` wörtlich „Zu viele Einträge in einer Sammelanfrage: 5001, höchstens 5000 sind erlaubt. Bitte in Teilen senden.“, der Ordner ist zeichengleich, kein Commit, und der Listing-Zähler steht bei 0. Mit 5000 Einträgen kommt diese Meldung nicht (der Weg läuft weiter: z. B. 5000 unbekannte Nummern → 404 „Aufgabe #… gibt es nicht“, 5000 Titel → 201). Rechenbeispiele: 5000 erlaubt, 5001 abgewiesen; 12000 Einträge → „…: 12000, höchstens 5000 …“ (ohne Tausendertrenner, ohne Vorsatz `#<nummer>: `). Vorrang: 5001 Einträge, darunter #1 doppelt → die Grenzmeldung, nicht „#1 doppelt …“; eine leere Liste behält ihre heutige Antwort. Deterministisch vor der Sperre: hält ein Test die Sperre, kommt die 400 auf 5001 Einträge, ohne auf die Sperre zu warten. Mutanten „Grenze 4999“, „Grenze 50000“ und „Prüfung entfernt“ werden je von einem benannten Test rot.
- [ ] **AK 5 Die Oberfläche zeigt die 400:** Gegeben ein Board, auf dem ein Mensch „Spalte archivieren“ wählt, und der Server antwortet auf `POST /api/aufgaben/archivieren` mit 400 und dem Wortlaut aus AK 4 (in der Probe per `page.route`, denn 5001 Karten auf einem Board sind im Gate zu teuer), dann steht der Wortlaut sichtbar auf dem Board dort, wo heute jeder Fehler dieses Weges steht, keine Karte ist archiviert, und es erscheint kein Hinweis „… archiviert“ mit Rückgängig. Die Oberfläche sendet eine Anfrage, sie teilt nicht auf und zählt nicht selbst.

### E3 — die verwandten Stellen linear, ohne Verhaltensänderung

- [ ] **AK 6 Doppelte Nummern und Board-Datei unverändert:** Gegeben drei Dateien derselben Nummer (`0005-a.md`, `0005-b.md`, `0005-c.md`), wenn `GET /api/aufgaben` liest, dann ist `0005-a.md` die Aufgabe und `0005-b.md` und `0005-c.md` stehen als defekt mit wörtlich „Nummer #5 doppelt — auch in aufgaben/0005-a.md“. Gegeben ein Board mit drei Aufgaben, eine davon von Hand benannt, wenn eine Sammelaktion die Board-Datei schreibt, dann nennt jede Zeile dieselbe Datei wie vor der Änderung (Board-Datei bytegleich zum Stand vor dem Umbau). Am Code: in `Ordner::aufgaben` und `board_text` steht keine lineare Suche in der Schleife mehr (`gut.iter().find`, `aufgaben.iter().find` entfallen).

### Messung (nie im Gate)

- [ ] **AK 7 Lastprobe mit Lastbedingung:** `tests/lastprobe_r00257.rs` läuft nur ausdrücklich, mit `--release` (`#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]`, `cargo test --release --test lastprobe_r00257 -- --ignored --nocapture`, Vorbild `tests/lastprobe_r00206.rs`), nennt im Kopf und in der Ausgabe „Last unter 2“ und liest die Last selbst (`/proc/loadavg`). Gegeben 4.002 Aufgaben bei Last < 2, wenn `PATCH /api/aufgaben/mehrere` mit 4.000 Titeländerungen läuft und 100 ms nach ihrem Beginn ein fremder `PATCH /api/aufgaben/1` startet, dann gibt die Ausgabe die Last, die Dauer der Kette (Soll < 1 s, heute 18 s) und das Ende des fremden PATCH relativ zum Ende der Kette (Soll < 1 s) aus, dazu getrennt die Dauer bis `aktion` (Lesen, Prüfen) und die Dauer von `aktion` (Schreiben, Commit); grün nur, wenn beide Soll erfüllt sind. Bei Last ≥ 2 steht in der Ausgabe die Last und „keine Messung: Last < 2 nötig“, und kein Wert wird als bestanden gemeldet. Liegt die Kette bei Last < 2 über 770 ms (1 s ÷ 1,3, Abstand nach `rollen/planer/zeitkriterien.md`), nennt der Durchlauf Last, Werte und den zu kleinen Abstand als Frage an den architekt; bleibt sie ≥ 1 s, während der Lesepfad unter 200 ms liegt, liegt der Rest im Commit — dann meldet der Durchlauf eine neue Karte zum Commit-Weg, kein Nachbessern in dieser Karte (ADR-0044 „Messprobe“). Beobachtung ohne Soll: `GET /api/aufgaben` bei 30.002 Aufgaben (heute 4,1–4,6 s) mit Wert in der Ausgabe.
- [ ] **AK 8 Abnahme-Probe der Karte im echten Programm:** Release-Programm auf freiem Port, 8–21 Uhr: `probe_nachher.py <port> 4000 1000`, danach `probe_kontrolle.py <port> 4000`; die Zeilen `titel only` und „fremder PATCH“ mit Last stehen in der Commit-Nachricht. Bei Last < 2 gilt das Soll aus AK 7; bei höherer Last ist der Wert eine Beobachtung, kein Rot (Lehre #233), und die Lastprobe aus AK 7 entscheidet.

### Bestand

- [ ] **AK 9 Übrige Antworten unverändert, Beschreibung nennt die Grenze:** Alle Antworten der sieben Sammelwege außer der neuen 400 sind nach Status und Wortlaut wie vorher (Regressionstests oben). Die Beschreibung jedes der sieben Wege (`src/web/mod.rs`, damit `/api/endpunkte` und `openapi`) nennt „höchstens 5000 Einträge → 400 {fehler}“; README „Für Agenten“ nennt die Grenze in einem Satz.

## Implementierungshinweise

- Reihenfolge an der Tür jedes Sammelwegs: Identität (wie heute) → **Grenze** → leere Liste und `ohne_doppelte` (wie heute) → Einstellungen → `gesperrt()` → Momentaufnahme → Schleife.
- Die Grenze gehört an die eine Tür neben `ohne_doppelte` (`src/dienst/mod.rs:269`), eine Konstante, ein Wortlaut für alle sieben Wege; bei `bewegen-mehrere`, Anlegen und Teilaufgaben ruft der Dienst sie ebenso vor der Sperre.
- Die Momentaufnahme lebt nur als lokale Variable; `Ordner::aufgabe(nr)` für Einzelwege baut sie für die eine Nummer (ein Listing wie heute).
- Mutanten in einer eigenen Kopie, nie im Worktree (`gemeinsam/regeln.md`); nach dem Zurücklegen `touch` und Neubau.
- Lastprobe und Tagprobe nicht im Nachtbetrieb (21–8 Uhr) und nicht neben einem Gate.

## Offene Fragen

- Keine, die den Bau aufhält. Grenzwert, Status und Wortlaut hat der PO entschieden (Z. 669–672); ob die Kette auch im Commit unter 1 s bleibt, entscheidet die Messung (AK 7), nicht diese Anforderung.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die 18 s entstehen, weil jede der 4.000 Änderungen das ganze Verzeichnis von 4.002 Dateien listet und sortiert, solange die Sperre gehalten wird — rund 16 Mio. Einträge. Liest die Anfrage die Dateinamen einmal nach dem Sperren und fragt danach nur die Momentaufnahme, bleiben ein Listing und 4.000 Einzeldateien; die Sperrdauer wächst linear mit n statt mit n × m, und der fremde PATCH wartet nur noch auf den Rest einer kurzen Kette. Die Grenze von 5000 Einträgen deckelt die Arbeit auch dort, wo der Ordner sie nicht begrenzt (Anlegen, Teilaufgaben), und wird vor der Sperre geprüft, damit eine zu große Anfrage niemanden aufhält. Weil die Momentaufnahme dieselbe Pfadregel trägt wie der Einzelweg, können Einzel- und Sammelweg nicht auseinanderlaufen (AK 2), und der Zähler (AK 1) prüft die Linearität im Gate ohne Wanduhr.

## Notizen

- Priorität: Hoch (Label `sicherheit`: jeder mit Konto kann die Sperre 18 s halten)
- Betroffene Nutzer/Systeme: alle Menschen und Agenten am selben Ordner; die Oberfläche über Mehrfachauswahl und „Spalte archivieren“
- Workaround: Sammelanfragen klein halten — von außen nicht erzwingbar
- **Herkunft der Zahlen:** 18 s, 12–15 s und 4,1–4,6 s stammen aus dem Befund an Karte #241 (gemessen vom security-reviewer, nicht nachgemessen); 5000, 400 und der Wortlaut aus PO Z. 669–671; „Listings ≤ 3“ und n = 1/10/300 aus ADR-0044 Prüfliste 1; 770 ms ist Rechnung (1 s ÷ 1,3); 16 Mio. ist Rechnung (4.000 × 4.002).
- `ursprungslauf: R00065`, denn `mehrere_aendern` stammt aus der Mehrfachauswahl (Kommentar am Dienst, `src/dienst/aufgabe_aendern.rs:49`).
- Nicht Teil: `braucht_eintragen` (ohne Sperre), ein Cache über Anfragen (ADR-0004), Teilen in der Oberfläche (PO Z. 671), eine Karte zum Commit-Weg (nur, falls AK 7 es zeigt).
- User Story nach dem Bug-Format: `user-stories/R00257.md`.
