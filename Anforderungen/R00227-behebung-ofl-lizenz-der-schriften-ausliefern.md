---
id: R00227
status: Erledigt
datum: 2026-11-21
ursprung: Bug-Report
ursprungslauf: R00002
---

# R00227: Behebung — die Lizenz der eingebetteten Schriften (OFL) wird mit ausgeliefert

## Beschreibung

Karte #243, gefunden vom architekt bei #216. kanbanD bettet fünf Schriftdateien der Familie IBM Plex in das Programm ein und liefert sie unter `/web/fonts/` aus. Die SIL Open Font License 1.1 verlangt, dass ihr Text mitkommt, wenn die Schrift weitergegeben wird. Das Programm gibt die Schriften weiter. Die Lizenz liegt zwar im Repository (`web/fonts/LICENSE-OFL.txt`), wird aber nicht eingebettet.

**Reproduktion:** kanbanD auf einem Wegwerf-Ordner starten, dann `GET /web/fonts/LICENSE-OFL.txt` aufrufen. **Erwartet:** 200, `text/plain; charset=utf-8`, Lizenztext. **Tatsächlich:** 404 „nicht gefunden“.

Das ist **falsch gebaut**: Seit R00002 (Einrichtungsseite, Commit `4aee19c2`) liefert das Programm die Schriften aus, die Lizenz aber nicht. Prism zeigt, wie es richtig geht: Programm und Lizenz stehen beide in `dateien!` ([ADR-0037](../Dokumentation/ADRs/0037-syntax-hervorhebung-je-hunk-seite-als-auflage-mit-grenze.md) Punkt 1, `:44–45`).

Zahlt ein auf: [Vision](R00000-vision.md), Leitplanke „ein Programm, das Weboberfläche und WebApi zugleich ausliefert“ (Z. 40) und „die Oberfläche ist in das Programm eingebettet“ (Z. 145). Was das Programm an fremdem Werk enthält, muss es mit den Bedingungen seiner Lizenz ausliefern.

## Ursachenanalyse

### Root Cause

Belegt am Stand von `karte/243` nach Rebase auf `main` (`f6f3dbd1`):

- `src/web/statisch.rs:9–15`: Das Makro `dateien!` bettet nur die Dateien ein, die es namentlich aufzählt (`include_bytes!` je Eintrag), und baut daraus `DATEIEN`.
- `src/web/statisch.rs:57–61` zählt die fünf `.woff2` auf, `fonts/LICENSE-OFL.txt` fehlt.
- `liefern` (`:64–69`) findet den Namen nicht in `DATEIEN` und antwortet deshalb mit 404.

Der Defekt ist eingetreten, nicht latent: Jedes ausgelieferte Programm seit R00002 enthält die Schriften ohne ihre Lizenz. Kein Test prüft, ob jede Datei unter `web/` auch in `DATEIEN` steht. Deshalb blieb die Lücke unbemerkt.

Ausgeschlossen (architekt, #243): Unter `web/` gibt es keine weiteren Lizenzdateien. Prism und seine Lizenz werden schon ausgeliefert (`:35–36`). Die Symbole sind kurze Grundformen ohne Herkunftsangabe.

### Betroffene Komponenten

- `src/web/statisch.rs`: `dateien!` bekommt eine Zeile (A00003 Web-Schicht, statische Auslieferung)
- neu ein Integrationstest nach dem Vorbild `tests/statisch_faerben.rs`
- **Nicht** betroffen: `web/` (die Datei liegt schon richtig), `index.html` (verweist nicht auf Lizenzen), README, API-Beschreibung

## Lösungsvorschlag

### Langfristige Lösung

Lokaler Fix nach dem Muster aus ADR-0037: eine Zeile `"fonts/LICENSE-OFL.txt" => "text/plain; charset=utf-8"` in `dateien!`, direkt hinter den fünf Schriften. Dazu ein Abgleich-Test: Er liest die Ordner `web/fonts/` und `web/vendor/` aus dem Dateisystem und fordert jede Datei über HTTP an. Fehlt eine Datei in `dateien!`, wird der Test rot.

### Alternative Ansätze

Ein trivialer, eindeutiger Fix. Die Varianten werden nur kurz abgewogen.

- **Ganze Ordner automatisch einbetten** (`build.rs` oder ein Crate wie `include_dir`): Damit fiele die Pflege der Liste weg, aber das Programm hätte einen Build-Schritt oder eine neue Abhängigkeit. ADR-0037 hält ausdrücklich fest: „kein Build-Schritt … keine npm-Abhängigkeit“. Verworfen, denn der Abgleich-Test schützt ebenso.
- **Lizenz nur im Repository und in der README nennen**: Das erfüllt die OFL nicht, weil das Programm die Schrift ohne den Lizenztext weitergibt. Verworfen.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest gegen das gestartete Programm, gebaut wie `tests/statisch_faerben.rs` (`gemeinsam::starten`, `senden_roh` mit `GET`). Er liegt z. B. in `tests/statisch_lizenzen.rs` und enthält zwei Tests:

1. `ofl_lizenz_wird_ausgeliefert` (AK 1). Heute rot mit 404.
2. `jede_datei_unter_fonts_und_vendor_ist_eingebettet` (AK 2). Heute rot: 7 von 8 Dateien liefern 200, `fonts/LICENSE-OFL.txt` liefert 404.

### Code-Extraktion für isoliertes Testing

Nicht nötig. `DATEIEN` bleibt privat, denn der Abgleich läuft über HTTP und damit über den echten Einstieg.

### Regressionstests

- `tests/statisch_faerben.rs` ohne geänderte Erwartung grün
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage:** kanbanD auf einem Wegwerf-Ordner mit `--port 0` gestartet (wie `mit_drei_aufgaben` in `tests/statisch_faerben.rs`). **Rechenbeispiel zum Bestand heute:** `web/fonts/` enthält 6 Dateien (5 `.woff2` und `LICENSE-OFL.txt`), `web/vendor/` enthält 2 (`prism.js`, `LICENSE-prism.txt`). Das sind 8 Dateien, davon stehen heute 7 in `dateien!`.

### Bug behoben

- [x] **AK 1 Lizenz der Schriften (Abnahme-Probe der Karte, wörtlich):** `GET /web/fonts/LICENSE-OFL.txt` ergibt Status 200 und `Content-Type` genau `text/plain; charset=utf-8`. Der Text beginnt mit „Copyright 2019 IBM Corp.“ und enthält „SIL OPEN FONT LICENSE Version 1.1“. Heute: 404 „nicht gefunden“ (rot).
- [x] **AK 2 Abgleich der Ordner (Sollte des architekt):** Ein Test liest `web/fonts/` und `web/vendor/` zur Laufzeit aus dem Dateisystem (`CARGO_MANIFEST_DIR`), ohne die Dateinamen im Test aufzuzählen. Für jede Datei verlangt er `GET /web/<ordner>/<name>` mit Status 200 und dem `Content-Type` nach Endung: `.woff2` → `font/woff2`, `.js` → `text/javascript; charset=utf-8`, `.txt` → `text/plain; charset=utf-8`. Bei einer anderen Endung schlägt der Test fehl und nennt die Datei. Der Test verlangt außerdem mindestens 8 gefundene Dateien, damit ein leer gelesener Ordner nicht grün wird. Die Fehlermeldung nennt jede fehlende Datei mit Pfad. Heute: rot für `fonts/LICENSE-OFL.txt`, die anderen 7 sind grün.
- [x] **AK 3 Mutanten:** Jeder Mutant wird von einem benannten Test getötet. Die Mutanten laufen in einer eigenen Kopie, nicht im Worktree.
  - (m1) Die Zeile `fonts/LICENSE-OFL.txt` fehlt in `dateien!` → AK 1 und AK 2 rot.
  - (m2) Die Zeile steht da, aber mit `text/html; charset=utf-8` → AK 1 und AK 2 rot.
  - (m3) Eine neue Datei `web/vendor/probe.txt` liegt im Ordner, steht aber nicht in `dateien!` → AK 2 rot und nennt `vendor/probe.txt`. Dieser Mutant belegt, dass der Test den Ordner liest und keine feste Liste prüft.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [x] **AK 4 Bug-Vorlage:** Die Reproduktionstests (AK 1, AK 2) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt im Szenario der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün, `tests/statisch_faerben.rs` ohne geänderte Erwartung.

## Implementierungshinweise

- Die Zeile gehört hinter `fonts/ibm-plex-mono-latin-500-normal.woff2` (`src/web/statisch.rs:61`).
- `senden_roh` liefert `status`, `art` und `text` (`tests/statisch_faerben.rs:9–11`). Für `.woff2` genügen Status und `art`, den Inhalt braucht der Test nicht.
- Unterordner in `web/fonts/` oder `web/vendor/` gibt es heute nicht. Taucht einer auf, ist das ein Fehlschlag mit Pfad und kein stilles Überspringen.

## Offene Fragen

- keine, die den Bau aufhält. Die Lizenzhinweise der rund 161 Rust-Pakete im Programm (`Cargo.lock`, MIT/Apache) liegen außerhalb dieser Karte. Der architekt hat dafür eine eigene Karte im Backlog vorgeschlagen, die Freigabe liegt beim Betreiber.

## Warum löst diese Anforderung das Problem? (Pflicht)

Die Lizenz fehlt, weil `dateien!` nur namentlich Aufgezähltes einbettet. Die neue Zeile bettet sie ein, und `GET /web/fonts/LICENSE-OFL.txt` liefert den Text. Damit gibt das Programm die Schrift zusammen mit ihrer Lizenz weiter, wie die OFL es verlangt. Der Abgleich-Test schließt die Ursache für die ganze Klasse: Liegt eine neue Datei unter `web/fonts/` oder `web/vendor/`, ohne eingebettet zu sein, wird das Gate rot, bevor ein Programm ohne sie ausgeliefert wird.

## Notizen

- Priorität: Mittel (Lizenzbedingung, keine Funktionsstörung)
- Betroffene Nutzer/Systeme: jeder, der das Programm weitergibt oder installiert
- Workaround: keiner im Programm; die Datei liegt nur im Repository
