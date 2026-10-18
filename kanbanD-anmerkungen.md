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
