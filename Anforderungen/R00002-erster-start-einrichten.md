---
id: R00002
status: Neu
datum: 2026-10-18
---

# R00002: Erster Start einrichten

## Beschreibung

Öffnet kanbanD einen Ordner ohne `kanbanD.md`, zeigt die Oberfläche statt eines Boards die Einrichtungsseite: wer ich bin (Kürzel und Name), welche Agenten mitarbeiten, wie das erste Board heißt, welche Spalten es hat und wo WBS und Anforderungen liegen. Ein Klick legt `kanbanD.md` und `boards/<slug>.md` an und committet das als eine Aktion unter meinem Namen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“, „Ein Commit je Aktion“, Leitplanke „Ordneraufbau“.

## Geschäftlicher Nutzen

Der erste Start erzeugt eine lesbare, versionierte Grundlage, ohne dass jemand ein Dateiformat lernen muss.

## Funktionale Anforderungen

- `kanbanD.md` trägt im Frontmatter `people` (Kürzel → `name`, `kind: human|agent`, optional `active: false`), `classes` (Schlüssel → `label`, `color`) und `sources` (`wbs`, `requirements`); die Schlüssel bleiben in der Reihenfolge der Datei.
- Eine Board-Datei hat eine `# Titel`-Zeile, je Spalte eine `## Name`-Zeile und je Aufgabe darunter eine Zeile `- [#<nr>](../aufgaben/<datei>)`; Grenzen stehen optional im Frontmatter unter `limits`.
- `POST /api/einrichten` prüft: Kürzel aus 1–8 Kleinbuchstaben oder Ziffern, Name nicht leer, mindestens eine Spalte, Spaltennamen eindeutig, Ordner noch nicht eingerichtet.
- Die Einrichtung schreibt beide Dateien und committet sie in **einem** Commit; Autor ist die Person „ich“ (`Name <kürzel@kanbanD>`).
- Die Einrichtungsseite zeigt live die Vorschau beider Dateien; „Einrichten und committen“ führt danach zum Board.
- Ist der Ordner eingerichtet, liefert `GET /api/zustand` die Einstellungen und die Liste der Boards.

## Nicht-funktionale Anforderungen

- Git-freundlich: zweimal Lesen und Schreiben derselben Datei ergibt denselben Inhalt (stabile Form).
- Benutzerfreundlichkeit: Fehler stehen an der Seite in einem Satz.

## Akzeptanzkriterien

### Dateiformat
- [ ] `Einstellungen` → Text → `Einstellungen` ergibt das Ausgangsobjekt; Text → `Einstellungen` → Text ergibt denselben Text
- [ ] Ein Board mit Spalten „Zu erledigen“, „In Arbeit“, „Erledigt“ und Aufgabe 3 in „In Arbeit“ wird zu einer Datei mit genau einer Aufgabenzeile `- [#3](../aufgaben/0003-x.md)` unter `## In Arbeit`
- [ ] Eine Board-Zeile `- #7 irgendein Text` wird als Aufgabe 7 gelesen

### Einrichten
- [ ] Nach `POST /api/einrichten` mit ich `st`/„Stefan“, Agent `cl`/„Claude“, Board „Entwicklung“ und drei Spalten existieren `kanbanD.md` und `boards/entwicklung.md`, und `git log -1 --format=%an` liefert „Stefan“
- [ ] Der Commit enthält genau diese zwei Dateien
- [ ] Ein zweites `POST /api/einrichten` antwortet 409 und ändert nichts
- [ ] Kürzel `St!`, leerer Name, keine Spalte oder doppelte Spalte antworten 400 mit Meldung

### Oberfläche
- [ ] Ein nicht eingerichteter Ordner zeigt die Einrichtungsseite; nach dem Absenden zeigt die Seite das Board „Entwicklung“ mit drei Spalten

## Betroffene Verzeichnisstruktur

Typen in `src/modell/`, Dateiformate in `src/format/` (Unit-Tests dort), Dateizugriff in `src/ablage.rs`, Git in `src/git.rs`, Anwendungsfälle in `src/dienst/`, HTTP in `src/web/`; Oberfläche in `web/`; Integration in `tests/`, E2E in `e2e/tests/`.

## Technische Überlegungen

### Ablauf
1. **Prüfen** — `Einrichtung::pruefen()`
2. **Dateien bauen** — `Einstellungen` und `Board` aus der Einrichtung, `format::einstellungen::schreiben`, `format::board::schreiben`
3. **Schreiben und committen** — unter der Schreibsperre: Dateien schreiben, `git::committen(wurzel, pfade, autor, nachricht)`

### Grobentwurf
- `Einstellungen`, `Person`, `Klasse`, `Quellen` (DTO) — Inhalt von `kanbanD.md`
- `Board`, `Spalte` (DTO) — Inhalt einer Board-Datei
- `format::einstellungen::{lesen, schreiben}`, `format::board::{lesen, schreiben}` (pure)
- `git::committen(wurzel, pfade, autor, nachricht) -> Result` (Operation)
- `Kanban::einrichten(Einrichtung) -> Result<(), Fehler>` (Integration)
- `Fehler` (Enum) — Ungültig, Konflikt, NichtGefunden, Intern; je ein HTTP-Status

## Tests

- Unit: Formate (Rundlauf, Sonderzeichen, Reihenfolge), `Einrichtung::pruefen`, `slug`
- Integration: Einrichten gegen einen temporären Ordner mit echtem Git (Autor, Dateien im Commit, 409)
- E2E: Einrichtungsseite ausfüllen, absenden, Board sehen

## Abhängigkeiten
- Abhängig von: R00001
- Blockiert: R00003, R00004

## Offene Fragen
