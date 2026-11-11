# Besetzung

Rollen dieses Projekts aus der Kollektion der Factory (`/factory rollen`). Das Kürzel ist die Person der Rolle auf dem kanbanD-Board (1–8 Kleinbuchstaben oder Ziffern). Festgelegt vom Betreiber am 2026-10-31.

| Rolle | Kürzel | Einsatz |
|---|---|---|
| product-owner | po | Rückfragen der Rollen im Sinne der Vision entscheiden, Protokoll `AI-Team/po-entscheidungen.md`; vertritt den Betreiber auch gegenüber dem realist-consultant (`auftrag.md`, „Einsatz des realist-consultant“) |
| realist-consultant | real | berät den PO bei jedem neuen inhaltlichen Auftrag; Schleifenbremse |
| planer | plan | Detailplanung: R00095–R00100 als WBS-Knoten einhängen, Interaction bis Bubble verfeinern, Anforderung schreiben; Befunde einplanen |
| architekt | arch | Architektur-Modell anlegen (fehlt), ADRs zu den Regeln am Schreibweg (Sperre → Prüfung → Commit: Grenze, Eigentümer, Schlüssel) und zum Logging |
| architektur-reviewer | arev | Pakete gegen Modell und ADRs, nur wenn sie Schreibweg oder Modell berühren |
| entwickler | entw1 | Interactions bauen, Test zuerst, Gate; WIP 1 |
| entwickler (Nacharbeit) | entw2 | Muss-Befunde im Worktree `kanbanD-entw2`; im Sparbetrieb nur, wenn entw1 nicht baut |
| code-reviewer | crev | Korrektheit, Tests, Wartbarkeit je Paket |
| security-reviewer | srev | Full-Trust über `X-KanbanD-Wer`, neue 403/409-Grenzen, Eingaben von außen (Routen, Anhänge, Markdown-Darstellung) |
| entwicklertester | etst | User Story im echten Programm (Browser und API) auf einer Wegwerf-Instanz |
| ux-reviewer | ux | Oberfläche mit Material 3 als Referenz, Tastatur, Barrierefreiheit; Vorprüfung in der Detailplanung |
| rechtschreib-reviewer | rsr | deutsche Oberfläche, Fehlermeldungen, API-Beschreibung, Anforderungen |
| legacy-reviewer | leg | bestehende Board-Ordner (`~/Projekte/Kanban-Boards/*`) und Agenten-Clients (`kanband.py` der Factory) öffnen und nutzen nach jeder Änderung an Dateiformat oder API weiter |
| observability-reviewer | obs | Logging gegen das Konzept in `umgebung.md`, nur bei neuen Fehlerpfaden oder Protokollzeilen |
| fachspezialist | fach | Glossar unter `Dokumentation/Domaenenwissen/` anlegen und pflegen, Benennung neuer Begriffe |
| gestalter | ges | Dialog-Artboards und Skizzen unter `Dokumentation/Wireframes/` in der entschiedenen Richtung verfeinern (`/wireframe verfeinern`), vor dem Bau; der product-owner gibt frei (Betreiber 2026-11-11) |

Nicht besetzt: `dokumentar`, `abnahmetest-schreiber`, `performance-reviewer` (erst mit Lastprofil-Zielen). Auf Abruf: `testability-consultant` bei wackligen Tests. Beratung über `/factory fragen`: keine nötig.
