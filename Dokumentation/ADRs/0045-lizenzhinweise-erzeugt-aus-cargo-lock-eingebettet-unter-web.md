# ADR-0045: Lizenzhinweise der eingebetteten Rust-Pakete — erzeugt aus `Cargo.lock` und den Registrarlizenztexten, ausgeliefert als eingebettete Datei unter `/web/LIZENZEN.md`

**Status**: Akzeptiert (belegt: Hausform `web/vendor/LICENSE-prism.txt`, bestehende Route `/web/{*name}`, Probe P0).
**Datum**: 2026-11-27
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #250, Lauf 250-architekt-1)
**Kontext-Anforderung**: — (Karte #250, „Lizenzhinweise der eingebetteten Rust-Pakete mitliefern“; gefunden bei #243)
**Erprobt durch**: Probe P0, 2026-11-27, Stand `69cb5590` (Lizenzabdeckung im Registrarcache, siehe Kontext); der Generator selbst ist noch nicht gebaut, seine erste Abnahme nennt „Folgeentscheidungen“.

## Kontext

**Belegt (Code, `69cb5590`)**:

- Das Release-Binary bettet die Oberfläche per `include_bytes!` ein — das Programm ist eine einzige Datei (`src/web/statisch.rs:9–68`, Kommentar `:1`). Ein Muster für eine mitgelieferte Fremdlizenz gibt es dort schon: `web/vendor/LICENSE-prism.txt` und `web/fonts/LICENSE-OFL.txt` sind committet, werden über dasselbe `dateien!`-Makro eingebettet und sind über die Route `GET /web/{*name}` erreichbar (`statisch.rs:80`).
- `Cargo.lock` listet **161 Pakete**; kanbanD selbst steht unter MIT, Copyright 2026 Stefan Hoffmann (`LICENSE`). Viele Abhängigkeiten stehen unter MIT oder Apache-2.0. Beide Lizenzen verlangen, dass Lizenz‑ und Urheberhinweis (bei Apache-2.0 zusätzlich der Lizenztext und ein etwaiges NOTICE) bei der Weitergabe mitkommt. Heute liefert kanbanD keinen dieser Hinweise mit.
- Release-Weg: `.github/workflows/release.yml` baut `target/release/kanbanD` (`:134–136`) und packt in das Archiv nur das Programm und `README.md` (`:138–156`, `cp` in `:149`). `AI-Team/ausliefern.sh` installiert über `cargo install --path … --locked` nach `~/.cargo/bin/kanbanD` (`:14`) und startet die Board-Instanz auf Port 7422 (`:25`) — beide Wege tragen heute keine Hinweisdatei.
- **Kein neues Crate nötig**: `serde_json` ist bereits normale Abhängigkeit (`Cargo.toml`), `cargo metadata --format-version 1` liefert Name, Version, `license`, `license_file` und den aufgelösten Abhängigkeitsgraph.
- **Probe P0 (lesend, ohne Bau)**: Von den 161 Paketen aus `Cargo.lock` liegen 151 im Registrarcache `~/.cargo/registry/src/index.crates.io-…/`; **alle 151 tragen eine Lizenzangabe oder eine Lizenzdatei** (`LICENSE`/`COPYING`/`NOTICE`), keines ohne. Die 10 fehlenden sind das Workspace-Paket selbst und dev-, bau- oder plattformabhängige Pakete (`bumpalo 3.20.4` gegen Cache `3.20.3`, `cc`, `shlex`, `find-msvc-tools`, `wasm-streams`, macOS-/iOS-only `kqueue`, `kqueue-sys`, `objc2-*`). `cargo metadata --offline` bricht hier an genau dieser Lücke ab — der Generator braucht den aufgelösten Graph, wie ihn jeder Build nach dem Herunterladen ohnehin hat.
- #239 (siehe Karte) hat gezeigt, dass **dev-Abhängigkeiten** wie `tower` (`Cargo.toml`, `[dev-dependencies]`) in `Cargo.lock` stehen, aber nicht im Release-Binary landen. Ein vollständiges Abarbeiten von `Cargo.lock` würde sie zu Unrecht als Weitergabe darstellen.

**Qualitätsziele mit Szenario**

- **Q1 Vollständigkeit:** Wird eine Abhängigkeit geändert (`cargo update`, vgl. `1041ffcd` „37 Pakete“), bricht das Gate, solange ein Paket im Verzeichnis fehlt — ohne dass ein Mensch die 161 Einträge von Hand nachzählt.
- **Q2 Ein-Datei-Programm bleibt:** Nach `cargo install`/Archiventpacken finden Empfänger den Hinweis, ohne dass das Programm auf Zielrechnern den Registrarcache lesen muss.
- **Q3 Keine unnötige Abhängigkeit:** Die Erzeugung kommt ohne ein neues Fremdwerkzeug und ohne ein neues Crate aus.

## Optionen

### Option A (gewählt): Erzeugt aus `Cargo.lock` + `cargo metadata` + Registrarlizenztexten; committet unter `web/LIZENZEN.md`; eingebettet und über `/web/LIZENZEN.md` ausgeliefert; zusätzlich lose ins Release-Archiv

- **Stärke:** Quelle der Wahrheit ist `Cargo.lock`, nicht ein zweites Verzeichnis von Hand — Drift ist strukturell ausgeschlossen. Es nutzt genau die vorhandene Hausform (committete Fremdlizenz unter `web/`, eingebettet per `dateien!`, erreichbar über `/web/{*name}`), kein neuer Mechanismus. Das Programm bleibt eine Datei; dieselbe committete Datei wird im Archiv mitkopiert. Die Erzeugung ist ein kleines Rust-Kommando im Repository und braucht kein neues Crate (`serde_json` ist da).
- **Schwäche:** Die committete Datei kann veralten. Sie wird deshalb an zwei Stellen gehalten: der Gate-Test prüft die Vollständigkeit (offline, gegen `Cargo.lock`), der Release-Schritt erzeugt neu und vergleicht (`--pruefen`). Ohne diese zwei Wächter wäre die Datei still falsch.

### Option B: Von Hand gepflegte Hinweisdatei (`THIRD-PARTY-NOTICES.md`, redaktionell)

- **Stärke:** Kuratiert, keine Registry-Abhängigkeit, Lizenzen könnten redaktionell zusammengefasst werden; kein Erzeugungsschritt.
- **Schwäche:** 161 Pakete, die sich mit jedem `cargo update` verschieben (Vorbild `1041ffcd`: 37 Pakete in einem Zug). Handpflege driftet und ist bei Weitergabe rechtlich nicht belastbar; der von der Karte geforderte „bricht, wenn ein Paket fehlt“‑Test müsste gegen eine handgeführte Liste laufen und wäre selbst Teil des Problems.

### Option C: Fremdwerkzeug `cargo-about` (oder `cargo-bundle-licenses`)

- **Stärke:** Erprobt, kennt Ausnahmefälle (mehrere Lizenzen je Paket, `license-file`, `OR`-Auswahl), fertige Vorlagen und Konfiguration.
- **Schwäche:** Ein neues Werkzeug im Release (eigene Version, eigene `about.toml`, eigene Vorlagen), also eine zusätzliche Abhängigkeit und ein weiteres Stück, das gepflegt werden muss — für „Hinweise mitliefern“ überdimensioniert. Die Karte verlangt ausdrücklich eine Begründung für ein neues Werkzeug; hier trägt sie nicht.

## Entscheidung

**Gewählt: Option A.**

Der Vorteil, der überwiegt: die Hinweise haben `Cargo.lock` als einzige Quelle und werden über die schon vorhandene Hausform (`web/`‑Datei, `dateien!`, Route `/web/{*name}`) ausgeliefert — Vollständigkeit und Ein-Datei-Programm zugleich. Bewusst in Kauf genommen: die committete Datei ist ein Erzeugnis und kann veralten; ohne Gate-Test und Release-Prüfschritt ist sie still falsch. Diese Schwäche ist die einzige, die trägt — deshalb sind beide Wächter Pflichtteil der Entscheidung, nicht Zubehör.

**Durchsetzung der Regel „jedes im Release-Binary enthaltene Paket bekommt einen Hinweis“** (sonst ein Wunsch): Der Gate-Test `tests/lizenzen.rs` bricht, wenn ein Paket aus `Cargo.lock` weder im Verzeichnis noch mit Grund in der Ausnahmetabelle steht; der Release-Schritt `… --pruefen` bricht, wenn die Datei nicht mehr zum aufgelösten Graph passt.

## Konsequenzen

**Positiv:**

- Hinweispflicht (MIT/Apache-2.0) erfüllt, ohne das Ein-Datei-Programm aufzugeben: derselbe Cache liefert die Texte, die Oberfläche sie aus.
- `Cargo.lock` als Quelle der Wahrheit; kein zweites, von Hand gehaltenes Paketverzeichnis.
- Wiederverwendung statt Neubau (`dateien!`, `/web/{*name}`, Muster `web/vendor/LICENSE-prism.txt`).
- Kein neues Crate, kein neues Fremdwerkzeug (Q3).

**Negativ / Inkauf zu nehmen:**

- Die committete `web/LIZENZEN.md` kann veralten — Gegenmittel sind der Gate-Test (offline) und der Release-Prüfschritt (`--pruefen`, mit aufgelöstem Graph). Beide gehören in dieselbe Anforderung wie die Datei; ohne sie ist die Aussage wertlos.
- Lizenztexte kommen aus dem lokalen Registrarcache. Fehlt ein Paket dort (Probe P0: 10 von 161, darunter macOS-only `kqueue`/`objc2-*`, `wasm-streams`, sowie das Workspace-Paket selbst), hängt die Vollständigkeit am `cargo fetch`-Stand des Release-Baus. Der Generator löst deshalb **für die Release-Ziele** auf (Linux‑x64 und Windows‑x64, `--filter-platform`; nur die Kanten `normal` und `build`, keine `dev`) und nimmt das Workspace-Paket selbst aus.
- Pakete, die nur für andere Plattformen oder nur für Tests aufgelöst werden (dev-dep `tower` aus #239), dürfen nicht in der Datei stehen; sonst behauptet kanbanD eine Weitergabe, die es nicht gibt. Die Auswahl folgt dem aufgelösten Graph, nicht dem rohen `Cargo.lock`.
- `/web/LIZENZEN.md` ist für jeden mit Zugriff auf die Instanz lesbar. Das ist gewollt (es ist ein Hinweis, kein Geheimnis).

**Folgeentscheidungen / Aufgaben:**

- [ ] Generator, erzeugte Datei, Einbettung und Route (Karte/Anforderung; Abnahme: `GET /web/LIZENZEN.md` liefert 200 mit Name, Version, Lizenz und Urhebertext je enthaltenem Paket).
- [ ] Gate-Test `tests/lizenzen.rs` (offline) und Release-Schritt `lizenzen --pruefen` — siehe Hinweise an den planer im Bericht.
- [ ] `README.md` nennt den Ort des Hinweises (`/web/LIZENZEN.md`), damit das Archiv allein genügt.

## Quellen / Bezuege

- [A00003 Web-Schicht](../Architektur/A00003-web-schicht.md) (primär; eingebettete Dateien, Route `/web/{*name}`), [A00002 kanbanD-Programm](../Architektur/A00002-kanbanD-programm.md) (Ein-Datei-Container, Release), [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
- Code, Stand `69cb5590`: `src/web/statisch.rs:1`, `:9–68`, `:77–81`; `Cargo.toml` (`license`, `[dependencies]`); `Cargo.lock`; `LICENSE`; `.github/workflows/release.yml:134–136`, `:138–156`; `AI-Team/ausliefern.sh:14`, `:25`
- Probe P0 (lesend): Registrarcache `~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/`, 151/151 Pakete mit Lizenzangabe oder Lizenzdatei; `cargo metadata --offline` bricht an `bumpalo 3.20.4` ab
- Karten #239 (dev-dep `tower` nicht im Binary), #243 (Fund), #250 (diese Entscheidung)
- Skill `adr-vorlage`; Regeln „keine neue Abhängigkeit ohne Begründung“ (`gemeinsam/regeln.md`, „Quellen“)
