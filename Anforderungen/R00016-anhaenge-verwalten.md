---
id: R00016
status: Neu
datum: 2026-10-18
---

# R00016: Anhänge verwalten

## Beschreibung

Eine Aufgabe kann Anhänge haben: Dateien im Ordner neben der Aufgabendatei (`aufgaben/0012-titel/`). Im Aufgabenfenster lassen sie sich hochladen (wählen oder hineinziehen), öffnen und entfernen; jede Aktion ist ein Commit.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben sind unabhängige Daten“ (mit Ordner für Anhänge).

## Geschäftlicher Nutzen

Bildschirmfotos, Protokolle und Entwürfe liegen bei der Aufgabe und reisen mit dem Repository.

## Funktionale Anforderungen

- Ordner der Anhänge = Dateiname der Aufgabe ohne `.md`.
- Dateinamen werden bereinigt: nur der letzte Pfadteil, keine Steuerzeichen, kein führender Punkt, höchstens 120 Zeichen; leer → `anhang`. Gibt es den Namen schon, wird `-2`, `-3`, … vor die Endung gesetzt.
- `POST /api/aufgaben/<nr>/anhaenge` (multipart, Feld `datei`, bis 50 MB) legt die Datei ab; `GET …/anhaenge` listet `{name, groesse}`; `GET …/anhaenge/<name>` liefert die Datei; `DELETE …/anhaenge/<name>` entfernt sie; ein leerer Ordner verschwindet.
- Nachrichten: `#<nr> Anhang „<name>“ hinzugefügt` bzw. `… entfernt`.
- Das Fenster zeigt „Anhänge“ mit Link, Größe und ✕ sowie „+ Datei wählen oder hierher ziehen“.

## Akzeptanzkriterien

- [ ] `bereinigen("../../etc/passwd")` → `passwd`; `bereinigen(".env")` → `env`; `bereinigen("")` → `anhang`; zweites `bild.png` → `bild-2.png`
- [ ] Hochladen von `bild.png` als `st` → Datei unter `aufgaben/0001-eins/bild.png`, Commit von Stefan nur mit dieser Datei
- [ ] `GET …/anhaenge/bild.png` liefert genau die Bytes; Entfernen löscht Datei und leeren Ordner, Commit
- [ ] Unbekannter Anhang → 404
- [ ] Oberfläche: Datei wählen → erscheint in der Liste mit Link; ✕ → verschwindet

## Betroffene Verzeichnisstruktur

`src/dienst/anhaenge.rs`, `src/web/mod.rs`, `web/`; Tests `src/dienst/anhaenge.rs`, `tests/anhaenge.rs`, `e2e/tests/r00016-anhaenge.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `anhangname_bereinigen(&str) -> String`, `freier_name(name, vorhandene) -> String` (pure)
- `Kanban::anhang_ablegen | anhaenge | anhang_lesen | anhang_entfernen` (Integration/Operation)

## Tests
- Unit: Bereinigen, freie Namen
- Integration: Hochladen, Ausliefern, Entfernen mit Git-Prüfung
- E2E: Wählen und Entfernen im Fenster

## Abhängigkeiten
- Abhängig von: R00011

## Offene Fragen
