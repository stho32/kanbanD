---
id: R00159
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00120
---

# R00159: Behebung — Agent archiviert bei defektem Board: 423 statt 403

## Beschreibung

Liegt im Ordner eine defekte Board-Datei und will ein **Agent** eine Karte archivieren oder endgültig löschen, die auf einem lesbaren Board in einer Menschen-Spalte liegt, antwortet kanbanD heute mit **403** `{fehler, spalte, nummer}`. Zugesagt ist **423**: R00120 AK 6 und US-2 beschreiben genau diese Lage und verlangen 423 wörtlich. Die Ordnung „423 vor 403 vor 409“ steht in [ADR-0003 Nachtrag N2](../Dokumentation/ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md); der Code weicht davon ab.

Reproduziert am fertigen Programm vom Stand `main` `5c2eb38` (architekt, 2026-11-15; Wegwerf-Ordner mit lesbarem Board, `column-owner: Eingang: human`, daneben `boards/kaputt.md` mit `start: kaputt`; Agent `cl`):

| Anfrage | heute | Soll |
|---|---|---|
| `POST /api/aufgaben/1/archivieren`, #1 in „Eingang“ | 403 `{fehler, spalte, nummer}` | **423** |
| `POST /api/aufgaben/archivieren` `{nummern: [3, 2]}`, #2 in „Eingang“ | 403 | **423** |
| `DELETE /api/aufgaben/5`, #5 in „Eingang“ | 403 | **423** |

Die Menge der abgewiesenen Anfragen ändert sich nicht: jede Anfrage, die heute 403 bekommt, bekommt bei defektem Ordner künftig 423; keine bisher abgewiesene wird erlaubt, keine erlaubte abgewiesen. Es ändern sich Status und Rumpf (`{fehler}` statt `{fehler, spalte, nummer}`).

Herkunft: Karte #121 (Entwicklertest aus #26/R00120, Architektur-Befund arev B3). Entscheidung des Betreibers vom 2026-11-13 im Kartenkommentar und des product-owner vom 2026-11-15 (`AI-Team/po-entscheidungen.md:228`): „423 einheitlich (Option 1): der defekte Ordner hat Vorrang“ — ein Fehler gegen eine abgenommene Zusage, kein neuer Umfang. R00120 bleibt abgenommen und unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — „Defekte Dateien bleiben sichtbar … und sind bis zur Reparatur nur lesbar“; und Zielbild „Mehrere Boards über einem Aufgabenbestand“: „Archiviert“ gilt für alle Boards, auf denen die Karte liegt.

## Ursachenanalyse

### Root Cause

Belegt am Stand `5c2eb38` (ADR-0003 N2, Abschnitt „Nachgeführt 2026-11-15“):

- `Kanban::archivieren_pruefen` (`src/dienst/zugregeln.rs:102–112`): der Mensch ist sofort frei (`:103–105`), dann kommt die Entnahmesperre der lesbaren Boards (`:107`, 403), **erst danach** der Defekt (`:108–111`, 423). Der Kommentar `:100–101` nennt die falsche Ordnung als Absicht („eine Sperre der lesbaren Boards (403) geht vor“).
- Drei Aufrufer erben den Fehler: Archivieren einzeln (`src/dienst/archiv.rs:14`), endgültig löschen (`:51`), Archivieren mehrere (`:134`).
- Ein Test hält die falsche Ordnung fest: `tests/haertung_spalten.rs:138–148` (`p6_gesundes_board_sperrt_vor_dem_defekten`) erwartet 403.

Ausgeschlossen: die Abbildung der Fehlerart (`Fehler::Defekt` → 423, `src/web/mod.rs:160`, richtig); die Wege mit Slug (vom Board nehmen, bewegen, ziehen, erledigen lesen ihr eines Board zuerst, Ordnung richtig, `p5_…`); die Board-Wege (`tests/boards.rs:254`); der Fall „Karte in freier Spalte“ (heute schon 423).

Eingetreten, nicht latent: die Antwort ist am Programm gemessen. Schaden: der Agent bekommt eine Aussage über eine Sperre (403 mit Spalte und Nummer), die kanbanD bei unlesbarem Ordner nicht sicher treffen kann; durchgelassen wird niemand.

### Betroffene Komponenten

- `src/dienst/zugregeln.rs` — `archivieren_pruefen` (A00004 Dienste, Aspekt X00001 Schreibweg und Regeln an Zügen).
- `src/dienst/archiv.rs` — nur Kommentare (`:8`, `:44`, `:50`).
- `src/web/endpunkte.rs` (`:58`, `:63`, `:77`) und die gleichlautenden `description` in `src/web/mod.rs` — Beschreibung der drei Endpunkte.
- Tests: `tests/haertung_spalten.rs` (P6 umgekehrt, neue Proben), Beschreibungstest nach dem Muster `tests/openapi.rs`.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0003 N2, „Kleinster Bau — eine Stelle“: in `archivieren_pruefen` die beiden Prüfungen tauschen — erst die Liste der defekten Board-Dateien (erste → 423), dann die Entnahmesperre je lesbarem Board (403). Der frühe Ausstieg für den Menschen bleibt die erste Zeile. Die drei Aufrufer erben; in `archiv.rs` ändern sich nur Kommentare. Kein neuer Wortlaut einer Meldung, keine neue Fehlerart, kein neuer Statuscode: die 423 trägt den bestehenden Satz für defekte Dateien (`zugregeln.rs:109`).

### Wortlaut der Beschreibung (Vorschlag des planers, siehe Offene Fragen)

An allen drei Endpunkten derselbe Satzteil, nach dem Vorschlag aus ADR-0003 N2: „Agent bei einer defekten Board-Datei im Ordner → 423 {fehler}, geht der 403 vor“. Bei `DELETE /api/aufgaben/{nr}` ersetzt er den Klammerzusatz „defektes Board 423“.

### Alternative Ansätze

- **Je Aufrufer eine eigene Defekt-Prüfung in `archiv.rs`**: drei Stellen statt einer; eine zweite Reihenfolge neben `archivieren_pruefen` ist nach ADR-0003 N2 („Durchsetzung“) ein Review-Befund.
- **Defekt-Prüfung als gemeinsamer Vorfilter aller Schreibwege**: träfe Wege, die die Boardliste nicht lesen und nach N2 („Grenze“) kein 423 liefern; ändert das Zurückholen mit (Abweichung B0537, nicht diese Karte).
- **403 vor 423 lassen und R00120 AK 6 ändern**: verworfen in ADR-0003 N2 — erklärt eine Lage für bekannt, die es nicht ist; dieselbe Ursache hätte auf zwei Wegen zwei Codes.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm, `tests/haertung_spalten.rs` (Helfer `ordner`, `fabrik_mit`, `stand`, `senden`): AK 1–4 als erste Tests, **rot ohne Fix** (je 403); die gemessenen Antworten stehen im Commit der ersten Bubble. Der bestehende Test `p6_gesundes_board_sperrt_vor_dem_defekten` wird dafür **umgekehrt** (AK 9), nicht ergänzt.

### Code-Extraktion für isoliertes Testing

Nicht nötig: `archivieren_pruefen` ist eine Prüfung ohne Schreiben und über die drei Endpunkte vollständig erreichbar.

### Regressionstests

Ohne geänderte Erwartung grün: `p5_defektes_board_auf_allen_wegen_423`, `tests/aufgabe_loeschen.rs` (`ak6_defektes_board_423`), `tests/boards.rs` (`defektes_board_423`), `tests/eigentuemer_sperre.rs`, die 403-vor-409-Probe in `src/dienst/zugregeln.rs`, `tests/wip_grenze.rs` (`zurueckholen_ueberspringt_defekte_board_dateien`).

## Akzeptanzkriterien

**Grundbestand** (herstellbar mit `ordner` und `fabrik_mit` aus `tests/haertung_spalten.rs`, von Hand erweitert und vor dem Start committet; Start mit `--port 0`): `cl` ist Agent, `st` Mensch. Board „fabrik“ mit `column-owner: Eingang: human` und den Spalten „Eingang“, „In Arbeit“, „Erledigt“. #1 liegt in „Eingang“ (Menschen-Spalte), #2 in „In Arbeit“ (freie Spalte), #3 in „Erledigt“ und trägt `archived: 2026-11-01`. Daneben die **defekte Board-Datei** `boards/kaputt.md` mit dem Frontmatter `start: kaputt` (Formatfehler), der Überschrift `# Kaputt` und der Spalte `## Eingang`; keine der drei Karten steht darin. Jede Anfrage trägt `X-KanbanD-Wer: cl`, wo nicht anders gesagt. Jedes Kriterium beginnt mit einem frischen Grundbestand.

**423 in der Form:** Status 423, Rumpf mit genau dem Feld `fehler` — **weder `spalte` noch `nummer`**. Die Meldung ist der bestehende Satz für defekte Dateien, kein neuer Text: sie beginnt mit dem Pfad der defekten Datei (`boards/kaputt.md: `), nennt den Grund, den `GET /api/zustand` unter `defekte` für diese Datei nennt, und endet auf „ — nur lesbar, bis die Datei repariert ist“.

**Nichts geschrieben:** `git rev-parse HEAD` und `git status --porcelain` des Ordners sind vor und nach der Anfrage gleich; `boards/fabrik.md` und die Dateien unter `aufgaben/` sind unverändert.

### Bug behoben

- [ ] **AK 1 Abnahme-Probe der Karte — Archivieren einzeln** (ADR-0003 N2, „Durchsetzung“, wörtlich): „Wegwerf-Ordner, ein Board mit Formatfehler, dazu ein lesbares Board mit Spalte „Eingang“ (`column-owner: human`) und #1 darin; Agent ruft `POST /api/aufgaben/1/archivieren` → **423** `Fehler::Defekt` mit der Meldung der defekten Datei, kein Commit. Heute: 403 (rot). Dieselbe Probe für `DELETE /api/aufgaben/1` (endgültig löschen) und für das Archivieren mehrerer Nummern.“ Im Grundbestand: 423 in der Form, nichts geschrieben, #1 trägt kein `archived`. Heute: 403 `{fehler: "Spalte „Eingang“ gehört dem Menschen", spalte: "Eingang", nummer: 1}`.
  - Mehrere defekte Board-Dateien: liegt zusätzlich `boards/zerbrochen.md` mit demselben Formatfehler vor, nennt die Meldung `boards/kaputt.md` (die erste der Boardliste, nach Dateiname; R00120 AK 6).
- [ ] **AK 2 Archivieren mehrere:** Gegeben der Grundbestand. Wenn `POST /api/aufgaben/archivieren` mit `{"nummern": [2, 1]}` gesendet wird, dann 423 in der Form für die ganze Anfrage; nichts geschrieben — auch #2 (freie Spalte) ist nicht archiviert. Heute: 403 mit `nummer: 1`.
- [ ] **AK 3 Endgültig löschen:** Gegeben der Grundbestand. Wenn `DELETE /api/aufgaben/1` gesendet wird, dann 423 in der Form; nichts geschrieben — die Aufgabendatei von #1 und ihre Zeile in `boards/fabrik.md` stehen noch. Heute: 403 mit `nummer: 1`.
- [ ] **AK 4 Auch ein ungültiger Dateiname zählt als defekt:** Gegeben der Grundbestand, aber statt `boards/kaputt.md` die Datei `boards/Kaputt_Board.md` mit lesbarem Inhalt (`# Kaputt`, `## Eingang`) — ihr Name ist kein gültiger Board-Name (`src/ablage.rs:67–69`). Wenn `POST /api/aufgaben/1/archivieren` gesendet wird, dann 423 in der Form; die Meldung beginnt mit `boards/Kaputt_Board.md: ` (Grund am Code gelesen: „Dateiname ist kein gültiger Board-Name — umbenennen“); nichts geschrieben. Heute: 403.

### Grenzen (heute schon so, bleiben so)

- [ ] **AK 5 Nur der Agent wird angehalten:** Gegeben der Grundbestand. Wenn der Mensch `st` sendet — `POST /api/aufgaben/1/archivieren`; im frischen Grundbestand `POST /api/aufgaben/archivieren` mit `{"nummern": [2, 1]}`; im frischen Grundbestand `DELETE /api/aufgaben/1` —, dann je 200 und genau ein Commit: #1 archiviert; #2 und #1 archiviert; #1 gelöscht (R00120 FA 7, AK 6: der Mensch wird nie abgewiesen).
- [ ] **AK 6 Ohne defekte Datei bleibt die 403:** Gegeben der Grundbestand ohne `boards/kaputt.md` (der reparierte Ordner). Wenn der Agent `POST /api/aufgaben/1/archivieren`, `POST /api/aufgaben/archivieren` mit `{"nummern": [2, 1]}` oder `DELETE /api/aufgaben/1` sendet, dann je 403 mit genau `{fehler: "Spalte „Eingang“ gehört dem Menschen", spalte: "Eingang", nummer: 1}`; nichts geschrieben.
- [ ] **AK 7 Was vor der Sperre steht, bleibt vorn:** Gegeben der Grundbestand (mit `boards/kaputt.md`), Agent.
  - `POST /api/aufgaben/3/archivieren` → 409 „#3 ist schon archiviert“ (kein 423; dieses 409 ist keine Sperre, ADR-0003 N2 „Grenze“).
  - `POST /api/aufgaben/archivieren` mit `{"nummern": [3]}` (lauter schon archivierte Nummern) → 200 mit `[]`, kein Commit.
  - `POST /api/aufgaben/999/archivieren` und `DELETE /api/aufgaben/999` → je 404.
  - `POST /api/aufgaben/2/archivieren` (#2 in der freien Spalte) → 423 in der Form, wie heute.

### Beschreibung

- [ ] **AK 8 Beschreibung nennt die 423 und ihren Vorrang:** `GET /api` (Seite), `GET /api/endpunkte` und `GET /api/openapi.json` nennen bei `POST /api/aufgaben/{nr}/archivieren`, bei `POST /api/aufgaben/archivieren` und bei `DELETE /api/aufgaben/{nr}` je wörtlich den Satzteil „Agent bei einer defekten Board-Datei im Ordner → 423 {fehler}, geht der 403 vor“. Bei `DELETE /api/aufgaben/{nr}` steht der Klammerzusatz „defektes Board 423“ nicht mehr daneben.

### Bug-Vorlage (Pflicht)

- [ ] **AK 9 Geänderte Erwartung eines abgenommenen Tests, beim Namen:** `p6_gesundes_board_sperrt_vor_dem_defekten` (`tests/haertung_spalten.rs:138–148`, Angriffsmatrix von R00120) erwartet heute 403 und wird **umgekehrt**: er erwartet 423 in der Form und „nichts geschrieben“; Name und Kommentar sagen die neue Ordnung. Er ist die **einzige** geänderte Erwartung der bestehenden Suite — jeder andere bestehende Test ist ohne geänderte Erwartung grün.
- [ ] **AK 10 Rot ohne Fix:** Die Tests zu AK 1–4 sind am Stand vor dem Fix rot (je 403) und mit Fix grün; der Commit der ersten Bubble nennt die gemessenen Antworten vor dem Fix.
- [ ] **AK 11 Keine neuen Fehler:** `cargo test` ist grün, darunter die Regressionstests aus „Test-Strategie“.

## Implementierungshinweise

- **Abgrenzung — nicht hinein** (ADR-0003 N2, „Wege mit Urteil“):
  - Zurückholen, einzeln und mehrere: nimmt keine Karte heraus (keine 403 möglich), verwirft die Defekte-Liste (`zugregeln.rs:120`, Abweichung B0537 in X00001).
  - Wege mit Slug — vom Board nehmen, bewegen, ziehen, erledigen: lesen ihr eines Board zuerst, die Ordnung gilt dort durch die Bauart.
  - Board-Wege — archivieren, löschen, umbenennen: Ordnung schon gebaut.
  - Das 409 „schon archiviert“ vor der Sperre: keine Sperre.
  - „Mensch löscht endgültig bei defektem Board, die Zeile im defekten Board bleibt stehen“: der Mensch wird nie gesperrt; eigener Befund nur auf Beobachtung.
- **Kleinster Bau:** eine Stelle, `archivieren_pruefen`. Dazu der Kommentar `zugregeln.rs:100–101` und die Kommentare `archiv.rs:8`, `:44`, `:50`. Kein Eingriff in `archiv.rs` außer Kommentaren. Die Antwortliste in OpenAPI nennt 423 an allen drei Routen schon.
- **Keine neue Angriffsmatrix:** es entsteht keine neue Zugriffsgrenze, nur die Reihenfolge nach abgenommenem ADR. Maßstab sind die bestehenden Matrix-Tests von R00120 in `tests/haertung_spalten.rs` (P-Zeilen × Wege W1–W5); die neuen Proben stehen dort neben `p5_…` und `p6_…`. Der `security-reviewer` prüft im Auto-Review.
- **Mutanten sind Testmittel, keine Kriterien** (ADR-0003 N2, „Durchsetzung“), in einer eigenen Kopie des Standes mit eigenem Build-Ziel:
  - M1: den Tausch zurücknehmen (Entnahmesperre wieder vor dem Defekt) → die Proben zu AK 1–4 sind rot.
  - M2: die Entnahmeprüfung ganz weglassen → die Probe zu AK 6 ist rot.
- **Review-Punkt** (ADR-0003 N2, Z. 110): ein Weg, der Defekt und 403/409 entdecken kann und die 403/409 zuerst meldet, ist ein Befund; ebenso eine zweite, eigene Reihenfolge neben `archivieren_pruefen`.
- **Gründe in den Beispielen** (AK 4, Meldung der 403 in AK 1 und AK 6) sind am Code gelesen (`src/ablage.rs:68`, `tests/haertung_spalten.rs:151`). Verbindlich ist: der Grund in der 423 ist der Text, den `GET /api/zustand` unter `defekte` nennt. Weicht ein Beispiel ab, meldet der Entwickler das, statt die Erwartung still zu ändern.
- **Architektur-Modell:** X00001 nennt „Ist: 403 zuerst, #121“ an drei Stellen; mit dem Bau stimmt das nicht mehr und wird im selben Zug nachgeführt (Soll = Ist).
- Keine Oberfläche, kein Element und kein Code unter `web/` ändert sich.

## Offene Fragen

Keine, die den Bau aufhält. Dem product-owner zur Bestätigung vorgelegt:

1. Wortlaut des Satzteils der Beschreibung (AK 8): „Agent bei einer defekten Board-Datei im Ordner → 423 {fehler}, geht der 403 vor“ — nach dem Vorschlag aus ADR-0003 N2; Empfehlung: so übernehmen.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: im Ordner liegt eine unlesbare Board-Datei, und ein Agent will eine Karte archivieren, die auf einem lesbaren Board in einer Menschen-Spalte liegt. „Archiviert“ gilt für alle Boards der Karte; die Zusage „kein Agent nimmt eine Karte aus einer Menschen-Spalte“ ist deshalb nur prüfbar, wenn jede Board-Datei lesbar ist. Prüft `archivieren_pruefen` den Defekt vor der Entnahmesperre (X), dann antworten alle drei Wege der Archiv-Familie bei unlesbarem Ordner mit derselben Aussage „nicht bestimmbar, erst reparieren“ (Y), und der Agent bekommt 423 mit der defekten Datei statt einer 403 mit Spalte und Nummer, die eine Lage für bekannt erklärt, die es nicht ist (Z). Der Hebel sitzt an der einen Prüfung, die alle drei Wege teilen; eine Änderung je Weg schüfe die zweite Reihenfolge, die der ADR ausschließt.

## Notizen

- Priorität: Mittel — Bruch einer abgenommenen Zusage (R00120 AK 6, US-2); niemand wird fälschlich durchgelassen, falsch sind Status und Rumpf.
- Betroffene Nutzer/Systeme: Agenten, die über die API archivieren oder endgültig löschen, während eine Board-Datei des Ordners defekt ist.
- Workaround: die defekte Board-Datei reparieren; danach gilt die 403 der Menschen-Spalte.
- **Herkunft:** Karte #121; Technik: ADR-0003 Nachtrag N2 samt Abschnitt „Nachgeführt 2026-11-15“ (`f705a33`); Aspekt X00001; Begründung „Archiviert ist eine Eigenschaft der Karte“: ADR-0005 „Geltende Regel“ und Vision (Betreiber 2026-11-15). Bezug: R00120 (FA 7, AK 6, US-2), R00097 (Spalten mit Eigentümer), R00141 (endgültig löschen).
- **Heimat:** eigene Interaction `I0146` unter D0007 (Agenten-Schnittstelle); I0110 (R00120) ist grün und abgenommen und bleibt zu.
- Labels der Karte: `sicherheit`, `text`.
