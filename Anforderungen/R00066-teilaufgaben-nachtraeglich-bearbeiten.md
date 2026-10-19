---
id: R00066
status: Erledigt
datum: 2026-10-19
---

# R00066: Teilaufgaben nachträglich bearbeiten

## Beschreibung

Im Aufgabenfenster lässt sich der Text einer Teilaufgabe nachträglich ändern: Ein Klick auf das Kästchen hakt ab bzw. öffnet wieder, ein Klick auf den Text öffnet ihn zum Bearbeiten.

Löst ab: aus R00012 die Regel „Klick auf Kästchen oder Text hakt ab bzw. öffnet wieder“ — der Text hakt nicht mehr ab.

Zahlt ein auf: [Vision](R00000-vision.md) — „bedienbar ohne Umweg“.

## Geschäftlicher Nutzen

Ein Tippfehler oder eine präzisere Formulierung kostet keinen Umweg über Entfernen und Neuanlegen; Haken und Reihenfolge bleiben erhalten.

## Funktionale Anforderungen

- Klick auf das Kästchen: abhaken / wieder öffnen (unverändert).
- Klick auf den Text: an seiner Stelle erscheint ein Eingabefeld mit dem Text, der Cursor steht darin.
- Enter oder Verlassen des Feldes speichert (`PATCH /api/aufgaben/{nr}/teilaufgaben/{i} {text}`, ein Commit); unveränderter oder leerer Text speichert nichts. Esc verwirft und schließt nur das Feld, nicht das Fenster.
- Der Erledigt-Zustand bleibt beim Bearbeiten unverändert.

## Akzeptanzkriterien

- [x] Klick auf den Text einer offenen Teilaufgabe hakt sie nicht ab, sondern zeigt ein Eingabefeld mit dem Text
- [x] Neuer Text + Enter → Datei enthält den neuen Text an derselben Stelle, Haken unverändert, ein Commit
- [x] Esc verwirft die Änderung, das Aufgabenfenster bleibt offen
- [x] Verlassen des Feldes speichert
- [x] Klick auf das Kästchen hakt weiterhin ab

## Betroffene Verzeichnisstruktur

`web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Test `e2e/tests/r00066-teilaufgaben-bearbeiten.spec.js`.

## Abhängigkeiten
- Abhängig von: R00012, R00037

## Offene Fragen
- keine
