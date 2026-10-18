---
id: R00029
status: Neu
datum: 2026-10-18
---

# R00029: Karte direkt bedienen

## Beschreibung

Häufiges geht ohne das Aufgabenfenster: Beim Zeigen auf eine Karte (oder wenn sie den Fokus hat) erscheint eine kleine Leiste mit „Timer starten/stoppen“ und „mir zuweisen“; ein Doppelklick auf den Titel (oder F2) benennt die Karte direkt um. Im Fenster setzen Knöpfe die Fälligkeit auf heute, morgen oder in einer Woche.

Zahlt ein auf: [Vision](R00000-vision.md) — „Zeiterfassung, die zum Arbeiten passt“ (ohne Umstand starten), „per Tastatur bedienbar“.

## Geschäftlicher Nutzen

Die häufigsten Handgriffe brauchen einen Klick statt drei.

## Funktionale Anforderungen

- Kartenleiste (bei Zeigen oder Fokus): ▶ bzw. ■ für den eigenen Timer, „+ mich“ bzw. „− mich“ für die eigene Zuständigkeit. Ein Klick in der Leiste öffnet die Karte nicht.
- Tasten auf einer fokussierten Karte: `t` Timer an/aus, `m` mich zuweisen/abnehmen, `F2` umbenennen.
- Umbenennen: Doppelklick auf den Titel oder F2 öffnet ein Eingabefeld an Ort und Stelle; Enter speichert (ein Commit `#n geändert: Titel`), Esc oder Verlassen ohne Änderung verwirft.
- Fenster: neben „due“ die Knöpfe „heute“, „morgen“, „+1 Woche“ und „✕“.
- Ohne Identität öffnet jede dieser Aktionen „Ich bin …“.

## Akzeptanzkriterien

- [ ] Zeigen auf #1, ▶ → Timer läuft, Karte bleibt geschlossen; ■ → gestoppt
- [ ] „+ mich“ → `assignees` enthält st; erneut → entfernt
- [ ] Doppelklick auf den Titel, neuer Text, Enter → Datei und Karte geändert; Esc → nichts geändert
- [ ] Fokus auf Karte, `t` startet, `m` weist zu, F2 öffnet das Feld
- [ ] Fenster „morgen“ → `due` ist morgen; „✕“ entfernt `due`

## Betroffene Verzeichnisstruktur

`web/ansicht.js`, `web/app.js`, `web/kd-app.css`; E2E `e2e/tests/r00029-karte-direkt.spec.js`. Keine neuen Endpunkte.

## Tests
- E2E: alle Kriterien (die Logik liegt in bestehenden, bereits getesteten Endpunkten)

## Abhängigkeiten
- Abhängig von: R00011, R00014

## Offene Fragen
