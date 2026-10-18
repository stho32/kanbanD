---
id: R00025
status: Erledigt
datum: 2026-10-18
---

# R00025: Defekte Dateien zeigen

## Beschreibung

Eine Datei mit Merge-Konfliktmarkern oder unlesbarem Inhalt wird nicht verschluckt: eine defekte Aufgabe erscheint als Karte mit Fehlerzeile und lässt sich nur lesen; ein defektes Board zeigt statt der Spalten eine Hinweisfläche mit Fehler und Link zum Editor; eine defekte `kanbanD.md` zeigt einen Hinweis über allem. Die Statuszeile nennt die Zahl defekter Dateien und listet sie auf Klick. Schreibende Aufrufe auf defekte Dateien werden mit 423 abgewiesen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Defekte Dateien bleiben sichtbar“, „Kein Git-Client“ (Konflikte löst der Mensch mit seinen Werkzeugen).

## Geschäftlicher Nutzen

Nach einem Merge mit Konflikt sieht man sofort, welche Datei zu reparieren ist — und nichts geht stillschweigend verloren.

## Funktionale Anforderungen

- Auf dem Board: eine referenzierte Nummer, deren Datei defekt ist, erscheint als Karte „#n — Datei defekt“ mit Fehlertext; Klick öffnet ein Fenster „nur lesbar“ mit Pfad, Fehler, Dateitext und Editor-Link.
- Defekte Board-Datei: Hinweisfläche „boards/<slug>.md ist defekt“ mit Fehler und Editor-Link; andere Boards bleiben erreichbar.
- Defekte `kanbanD.md`: Hinweisleiste oben; die Seite bleibt bedienbar, soweit sie keine Einstellungen braucht.
- Statuszeile „n defekte Dateien“ öffnet eine Liste mit Pfad und Fehler je Datei.
- Ist die Datei repariert, verschwindet der Hinweis mit dem nächsten Ereignis ohne Neuladen.

## Akzeptanzkriterien

- [x] Aufgabe #2 mit Konfliktmarkern → Karte „#2 — Datei defekt“ mit „Konfliktmarker“; Fenster zeigt den Text und keine Eingabefelder
- [x] `PATCH /api/aufgaben/2` → 423 (bestehend, R00011)
- [x] Board-Datei mit Aufgabenzeile vor der ersten Spalte → Hinweisfläche mit „vor der ersten Spalte“
- [x] `kanbanD.md` unlesbar → Hinweisleiste, Board bleibt sichtbar
- [x] Datei repariert (Editor) → Karte normal, Hinweis weg

## Betroffene Verzeichnisstruktur

`web/ansicht.js`, `web/app.js`, `web/kd-app.css`; E2E `e2e/tests/r00025-defekt.spec.js`.

## Technische Überlegungen

### Grobentwurf
- Oberfläche liest `zustand.defekte` und `GET /api/boards/<slug>` (423) bzw. `GET /api/aufgaben/<nr>` (423 mit Text)
- `defektZuNummer(nr)` (pure, über den Dateinamen)

## Tests
- E2E: alle drei Fälle und Reparatur

## Abhängigkeiten
- Abhängig von: R00004, R00007

## Offene Fragen
