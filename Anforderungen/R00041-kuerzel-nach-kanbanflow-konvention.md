---
id: R00041
status: Neu
datum: 2026-10-18
---

# R00041: Kürzel nach Kanbanflow-Konvention

## Beschreibung

Die Tastenkürzel gleichen sich den in Kanban-Werkzeugen gewohnten an (Kanbanflow, Kanban Tool, Kanboard): `n` legt überall eine neue Aufgabe an (Dialog aus R00036), die Leertaste startet und stoppt den eigenen Timer der fokussierten Karte, Entf archiviert sie, Strg+Enter speichert, Esc schließt. Die bestehenden Kürzel bleiben.

Eine öffentliche Liste der Kanbanflow-Kürzel gibt es nicht (sie steht nur im Hilfe-Dialog der Anwendung, „Quick help“); übernommen ist, was belegt und branchenüblich ist. Die Abweichungen sind in `kanbanD-anmerkungen.md` zur Prüfung vermerkt.

Zahlt ein auf: [Vision](R00000-vision.md) — „gewohnte Konventionen“.

## Geschäftlicher Nutzen

Wer von Kanbanflow kommt, findet die Hand-Bewegungen wieder.

## Funktionale Anforderungen

- `n`: auf dem Board in der Spalte der fokussierten Karte (sonst erste Spalte), in der Aufgabenliste und auf allen anderen Seiten ohne Board vorbelegt.
- Leertaste auf einer Karte: eigenen Timer starten oder stoppen (wie `t`).
- Entf auf einer Karte oder Zeile: archivieren (in der Liste bei archivierten: zurückholen); Rückgängig über den Hinweis.
- Die Hilfe (`?`) nennt die neuen Kürzel und den Dialog „Neue Aufgabe“.

## Akzeptanzkriterien

- [ ] Fokus auf #1, Leertaste → Timer von st läuft; Leertaste → gestoppt
- [ ] Fokus auf #1, Entf → `archived:` in der Datei
- [ ] Aufgabenliste: `n` öffnet „Neue Aufgabe“ ohne Board; Personen-Seite: `n` ebenso
- [ ] Zeile #2 in der Liste, Entf → archiviert

## Betroffene Verzeichnisstruktur

`web/app.js`, `web/ansicht.js`; E2E `e2e/tests/r00041-kuerzel.spec.js`.

## Abhängigkeiten
- Abhängig von: R00026, R00036

## Offene Fragen
