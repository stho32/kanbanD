---
id: R00034
status: Erledigt
datum: 2026-10-18
---

# R00034: Kontextmenüs für Spalten und Listen

## Beschreibung

Auch Spaltenköpfe und die Zeilen der Aufgabenliste haben ein Menü (Rechtsklick, Menütaste, Umschalt+F10). Im Spaltenkopf: Karte hinzufügen, alle Karten der Spalte archivieren, die Spalte nach links oder rechts verschieben, Spalten einrichten. In der Aufgabenliste: öffnen, auf ein Board legen, von einem Board nehmen, archivieren bzw. zurückholen, Verweis kopieren.

Zahlt ein auf: [Vision](R00000-vision.md) — „gewohnte Konventionen“, „Ein Commit je Aktion“.

## Geschäftlicher Nutzen

Aufräumen der Abschlussspalte ist ein Klick; die Aufgabenliste wird ohne Zielen auf kleine Knöpfe bedienbar.

## Funktionale Anforderungen

- `POST /api/aufgaben/archivieren {nummern}` archiviert alle genannten nicht archivierten Aufgaben in **einem** Commit (`#4, #5, #7 archiviert (3 Aufgaben)`, laufende Timer werden gestoppt); `POST /api/aufgaben/zurueckholen {nummern}` entsprechend. Leere Liste → 400; unbekannte Nummer → 404, nichts geändert.
- Spaltenkopf-Menü: Karte hinzufügen (n) · Alle n Karten archivieren (nur wenn n > 0; Hinweis mit „rückgängig“) · Spalte nach links / nach rechts (nicht am Rand) · Spalten einrichten …
- Listen-Menü: Öffnen · Auf Board legen ▸ Board · Spalte · Von Board nehmen ▸ (nur Boards, auf denen sie liegt) · Archivieren bzw. Zurückholen · Verweis kopieren.
- Spaltenköpfe sind per Tab erreichbar; Listenzeilen auch.

## Akzeptanzkriterien

- [x] API: drei Nummern archivieren → ein Commit, alle drei `archived`; mit einer unbekannten → 404 und keine Änderung
- [x] Rechtsklick auf „Erledigt“ → „Alle 2 Karten archivieren“ → Spalte leer, ein Commit; „rückgängig“ → beide zurück, ein Commit
- [x] „Spalte nach rechts“ auf „Zu erledigen“ → Reihenfolge „In Arbeit · Zu erledigen · Erledigt“
- [x] Aufgabenliste: Rechtsklick auf eine Zeile → „Auf Board legen ▸ Test · Bereit“ legt sie dort ab

## Betroffene Verzeichnisstruktur

`src/dienst/archiv.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/menue.js`, `web/app.js`, `web/ansicht.js`; Tests `tests/archiv.rs`, `e2e/einheit/menue.test.js`, `e2e/tests/r00034-menues.spec.js`.

## Abhängigkeiten
- Abhängig von: R00033, R00017, R00009, R00020

## Offene Fragen
