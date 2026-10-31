# Umgebung

Wie die Dienste des Projekts starten und geprüft werden. Gilt für den Director und jede Rolle.

| Was | Befehl / Wert |
|---|---|
| Abhängigkeiten installieren | `cargo build --release`; E2E: `cd e2e && npm install && npx playwright install chromium` |
| Dienste starten (freier Port) | `target/release/kanbanD <wegwerf-ordner> --port <frei> --kein-browser` (Skill `freier-port`); nie die Board-Instanz auf Port 7422 |
| Health-Check | `GET http://127.0.0.1:<port>/api/zustand` antwortet mit JSON |
| Gate (alle Tests, Analyse) | `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test` |
| SDKs / Pfade | `~/.cargo/bin`; Node für E2E unter `e2e/`; Board der Factory `http://127.0.0.1:7422`, Ordner `/home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard`; Auslieferung `cargo install --path . --locked` (siehe `prozess.md`) |
| Logging | Ziel stderr und `~/.local/state/kanbanD/<ordnername>/kanbanD.log`, nie im Board-Ordner (Git); Rotation täglich, Aufbewahrung 14 Tage; Standardstufe Information, umschaltbar `--log <stufe>` bzw. `KANBAND_LOG`; Stufen Debug · Information (Start, Commit je Aktion mit Wer/Instanz) · Warning (abgewiesene Züge 403/409, defekte Dateien) · Error (Fachlogik) · Exception (Programmfehler, Panik); keine Inhalte von Beschreibungen und Kommentaren. Heute nur `eprintln!` — ADR durch den architekt, sobald eine Karte Fehlerpfade berührt (Betreiber 2026-10-31) |

## Lastprofil (Betreiber 2026-10-31)

| Dimension | Ziel |
|---|---|
| gleichzeitige Menschen | 1–3 Browser-Tabs |
| gleichzeitige Agenten | bis 10 Instanzen (Sensoren, Behandler) |
| Schreibrate | bis 5 schreibende Aufrufe/s in Spitzen, je ein Commit |
| Bestand je Ordner | bis 5.000 Aufgaben (davon 4.000 archiviert), 10 Boards |
| Antwortzeit | lesend p95 < 200 ms bei 5.000 Aufgaben; schreibend inkl. Commit p95 < 500 ms; `ziehen` unter Konkurrenz von 10 Agenten p95 < 1 s |
| Live | Änderung in allen offenen Sichten < 1 s |

## Rechnerlast

Gilt für Director und Rollen (Regeln: `rollen/director/regeln.md`, „Rechnerlast“). Immer höchstens etwa 75 % Systemlast; neu gestartet wird nur, was darunter passt. Rechner: 8 Kerne, 31 GB. Sparbetrieb nach `prozess.md` (Betreiber 2026-10-31).

| Betrieb | Zeit | Entwickler | prüfende Rollen | Job-Grenze | nice | Test-Worker | Lasttests |
|---|---|---|---|---|---|---|---|
| Tag | 8–21 Uhr | 1 | bis 3 parallel (Auto-Reviews) | 2 | 10 | Standard | auf Ansage |
| Nacht | 21–8 Uhr | 1 | 1 | 1 | 19 | 2 | nie |
