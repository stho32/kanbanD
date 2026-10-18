---
id: R00004
status: Neu
datum: 2026-10-18
---

# R00004: Board ansehen

## Beschreibung

Das Board zeigt seine Spalten aus der Board-Datei und darin je referenzierter Aufgabe eine Karte mit den Angaben aus der Aufgabendatei. Die Aufgabendatei hat ein festes, auch von Hand schreibbares Format.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben sind unabhängige Daten“, „Das Board besitzt seine Struktur“.

## Geschäftlicher Nutzen

Der Stand der Arbeit ist auf einen Blick sichtbar, und jede Karte ist eine lesbare Datei.

## Funktionale Anforderungen

- Aufgabendatei `aufgaben/<nr 4-stellig>-<slug>.md`, Frontmatter in dieser Reihenfolge: `id`, `title`, `class`, `assignees`, `labels`, `due`, `origins`, `archived`, danach unbekannte Schlüssel unverändert; leere Felder entfallen.
- Körper: Beschreibung (Markdown), Teilaufgaben als `- [ ]`/`- [x]`, Codeblock `kanbanD-time` mit Zeilen `JJJJ-MM-TT HH:MM · JJJJ-MM-TT HH:MM · kürzel` (`...` statt Ende = läuft), Codeblock `kanbanD-comments` mit Zeilen `JJJJ-MM-TT HH:MM · kürzel · Text`.
- Fehlt `id`, gilt die Nummer aus dem Dateinamen; eine zweite Datei mit derselben Nummer wird als defekt gemeldet.
- `GET /api/aufgaben` liefert alle lesbaren Aufgaben (mit Dateiname) und die defekten Dateien.
- Eine Karte zeigt Nummer, Herkunft, Labels, Titel, Zuständige, Klasse (Farbe), Teilaufgaben erledigt/gesamt und Fälligkeit; archivierte Aufgaben erscheinen nicht.
- Verweist die Board-Datei auf eine Nummer ohne Aufgabe, zeigt die Spalte eine Platzhalterkarte „#n — Aufgabe fehlt“.
- Jede Spalte nennt die Zahl ihrer Karten; die letzte Spalte trägt das Abschlusszeichen ✓.

## Akzeptanzkriterien

### Format
- [ ] Rundlauf Text → Aufgabe → Text ist für eine vollständige Aufgabe zeichengleich
- [ ] `2026-10-18 09:00 · ... · st` wird als laufender Zeiteintrag von st gelesen
- [ ] Ein Kommentar mit Zeilenumbruch wird als eine Zeile mit `\n` geschrieben und zurückgelesen
- [ ] Ein unbekannter Schlüssel `estimate: 3` bleibt beim Schreiben erhalten

### Board
- [ ] Board mit Aufgaben 1 und 2 in „Zu erledigen“ und 3 in „In Arbeit“ zeigt 2 + 1 Karten in dieser Reihenfolge
- [ ] Aufgabe 2 mit `class: bug` trägt die Klassenfarbe; Aufgabe 1 mit 1 von 3 erledigten Teilaufgaben zeigt „☑ 1/3“
- [ ] Ein Verweis auf #9 ohne Datei erscheint als „#9 — Aufgabe fehlt“

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs`, `src/format/aufgabe.rs`, `src/ablage.rs`, `src/web/mod.rs`; Oberfläche `web/ansicht.js`; Tests in `src/format/aufgabe.rs`, `tests/aufgaben.rs`, `e2e/tests/r00004-board-ansehen.spec.js`.

## Technische Überlegungen

### Ablauf
1. `format::aufgabe::lesen(datei, text)` / `schreiben(&Aufgabe)`
2. `Ordner::aufgaben()` — alle Dateien lesen, Nummern prüfen
3. Oberfläche: `/api/boards/<slug>` und `/api/aufgaben` laden, je Spalte die Aufgaben in Zeilenreihenfolge zeigen

### Grobentwurf
- `Aufgabe`, `Teilaufgabe`, `Zeiteintrag`, `Kommentar` (DTO)
- `format::aufgabe::{lesen, schreiben, dateiname}` (pure)
- `Ordner::aufgaben() -> (Vec<Aufgabe>, Vec<DefekteDatei>)` (Operation)

## Tests
- Unit: Format (Rundlauf, laufender Timer, Kommentare, unbekannte Schlüssel, Nummer aus Dateiname, Fehler)
- Integration: `/api/aufgaben` mit doppelter Nummer und defekter Datei
- E2E: Board mit vorbereiteten Dateien

## Abhängigkeiten
- Abhängig von: R00002
- Blockiert: R00005, R00006, R00007

## Offene Fragen
