# Anmerkungen — kanbanD

Gesammelt im Lauf `/anwendung` (Automatik auf Auftrag vom 2026-10-18: Mensch-Stationen nach bestem Wissen selbst geklärt). Jede Zeile ist eine Entscheidung, die sonst ein Mensch getroffen hätte — gelesen wird die Datei in `Z1`.

| # | Slice | Station | Anmerkung | Beleg | Status |
|---|---|---|---|---|---|
| 1 | — | A1 | Richtungsfrage „Wer“ ohne Menschen entschieden: Git-Autor des Commits ist die handelnde Person, kein zusätzliches Frontmatter-Feld | Anforderungen/R00000-vision.md, Zielbild „Mensch und Agent“ | offen |
| 2 | — | A1 | Mehrere Boards je Instanz mit Umschalter; Aufgabe darf auf mehreren oder keinem Board liegen — abgeleitet aus „weiteres Verzeichnis für Kanban-Boards“ und „Aufgaben sind unabhängige Daten“ | Anforderungen/R00000-vision.md, Zielbild „Mehrere Boards“ | offen |
| 3 | — | A1 | Timer bleibt neben den Commit-Zeitpunkten; Zeile im Codeblock `kanbanD-time` der Aufgabe, Commit bei Start und Stopp (übersteht Absturz) — aus dem gesehenen Entwurf übernommen | Dokumentation/Wireframes/CLAUDE.md, „Zeiten als Codeblock“ | offen |
| 4 | — | A1 | Board-Datei mit einer Zeile je Aufgabe unter der Spaltenüberschrift, damit Bewegungen verschiedener Aufgaben mergen | Anforderungen/R00000-vision.md, Leitplanke „Git-freundliche Form“ | offen |
| 5 | — | A1 | Änderungen an kanbanD vorbei werden live gezeigt, aber nicht committet (Autor unbekannt); kanbanD committet nur die Pfade seiner eigenen Aktion | Anforderungen/R00000-vision.md, Zielbild „Mensch und Agent“ | offen |
| 6 | — | A1 | Defekte Dateien (Konfliktmarker, kaputtes Frontmatter) werden mit Fehlerzeile gezeigt und sind nur lesbar; Schreibzugriffe werden serialisiert | Anforderungen/R00000-vision.md, Zielbild „Defekte Dateien“ | offen |
| 7 | — | A1 | Kein Rückfluss zur WBS, kein kanbanC-Import, keine weiteren Aufgabenquellen — jeweils die zurückhaltendste Option | Anforderungen/R00000-vision.md, „Ausdrücklich nicht Ziel“ | offen |
| 8 | — | A1 | Personen und Klassen gelten für den ganzen Ordner (`kanbanD.md`), nicht je Board | Anforderungen/R00000-vision.md, Leitplanke „Ordneraufbau“ | offen |
| 9 | — | A6 | Stack Rust statt C#/.NET 10 laut Auftrag; Oberfläche als eingebettetes HTML/JS (Weiterentwicklung des gesehenen Prototyps) statt Blazor | Anforderungen/R00000-vision.md, Leitplanke „Rust“ | offen |
| 10 | — | A1 | Ist der Ordner kein Git-Repository, legt kanbanD beim Start eines an (Commit je Aktion braucht eines) | Anforderungen/R00000-vision.md, Leitplanke „Git ist Voraussetzung“ | offen |
| 11 | I0001 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00001 | offen |
| 12 | I0002 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00002 | offen |
| 13 | I0003 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00003 | offen |
| 14 | I0004 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00004 | offen |
| 15 | I0005 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00005 | offen |
| 16 | I0006 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00006 | offen |
| 17 | I0007 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00007 | offen |
| 18 | I0008 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00008 | offen |
| 19 | I0009 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00009 | offen |
| 20 | I0010 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00010 | offen |
| 21 | I0004 | S3 | Station S3 (Artboard D0002) in Runde I0004 übersprungen; nachgereicht vor I0011 aus dem Prototyp | Dokumentation/Wireframes/D0002.dc.html | offen |
| 22 | I0009 | S6 | Bubble-Commit B0026 enthielt einen roten Unit-Test (Commit 0f7aaa2), im Folgecommit c2eb1d8 korrigiert; Commit-Helfer prüft seither Tests und Clippy vor jedem Bubble-Commit | 0f7aaa2 | offen |
| 23 | I0011 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00011 | offen |
| 24 | I0012 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00012 | offen |
| 25 | I0013 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00013 | offen |
| 26 | I0014 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00014 | offen |
| 27 | I0014 | S8 | Abschluss R00014 lief trotz „E2E rot“ (Gate-Ausgabe durch grep verschluckt, Exit-Code verloren); Ursache war ein Aufräum-Wettlauf in e2e/tests/hilfen.js, kein Fehler der Anwendung — behoben, Kette mit pipefail gesichert | 381fa74 | offen |
| 28 | I0015 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00015 | offen |
| 29 | I0016 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00016 | offen |
| 30 | I0017 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00017 | offen |
| 31 | I0018 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00018 | offen |
| 32 | I0019 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00019 | offen |
| 33 | I0020 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00020 | offen |
| 34 | I0021 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00021 | offen |
| 35 | I0022 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00022 | offen |
| 36 | I0023 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00023 | offen |
| 37 | I0024 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00024 | offen |
| 38 | I0025 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00025 | offen |
| 39 | I0026 | S7 | Entwicklertest steht aus (Mensch-Station, in der Automatik nicht verbucht) | R00026 | offen |
