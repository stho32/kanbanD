---
id: R00036
status: Erledigt
datum: 2026-10-18
---

# R00036: Neue Aufgabe im Dialog

## Beschreibung

Eine neue Aufgabe entsteht in einem Dialog, der sofort alle Felder anbietet — wie in Kanbanflow: Titel, Beschreibung, Teilaufgaben, Board und Spalte, Klasse, Zuständige, Labels, Fälligkeit, Herkunft. Die Knöpfe „+ Karte“ am Fuß der Spalten entfallen; der Dialog öffnet sich über `n`, das „+“ im Spaltenkopf, „Neue Aufgabe“ in der Kopfzeile, das Spaltenmenü und die Aufgabenliste. „Anlegen und weitere“ lässt den Dialog für die nächste Aufgabe offen.

Löst ab: das Anlegen in der Bahn aus R00005, R00027 (Einfügen in „+ Karte“) und R00028 (Vorschau unter „+ Karte“). Die Regeln dort — nächste Nummer, ein Commit, Listen einfügen, Schnelleingabe — gelten im Dialog weiter.

Zahlt ein auf: [Vision](R00000-vision.md) — „gewohnte Konventionen“, „Ein Commit je Aktion“.

## Geschäftlicher Nutzen

Eine Aufgabe ist in einem Schritt vollständig erfasst, statt erst angelegt und dann geöffnet zu werden.

## Funktionale Anforderungen

- `POST /api/aufgaben` (und je Eintrag in `/mehrere`) nimmt zusätzlich `beschreibung` und `teilaufgaben` (Texte) an.
- Dialog: Titel (mit Schnelleingabe-Vorschau), Beschreibung, Teilaufgaben (Enter fügt an und bleibt im Feld, ✕ entfernt), Board und Spalte (oder „kein Board“), Klasse, Zuständige (alle aktiven Personen, vorbelegt mit mir), Labels, Fälligkeit mit „heute/morgen/+1 Woche“, Herkunft.
- Anlegen: Enter im Titel oder Strg+Enter überall; „Anlegen und weitere“: Umschalt+Strg+Enter — Titel, Beschreibung, Teilaufgaben werden geleert, Board, Spalte, Klasse, Zuständige bleiben. Esc schließt ohne Anlegen.
- Eine eingefügte Liste im Titel legt je Zeile eine Aufgabe mit den übrigen Feldern des Dialogs an.
- Einstiege: `n` (Spalte der fokussierten Karte, sonst erste), „+“ im Spaltenkopf, „Neue Aufgabe“ in der Kopfzeile, „Karte hinzufügen“ im Spaltenmenü, „Neue Aufgabe“ in der Aufgabenliste (ohne Board vorbelegt).
- Am Fuß der Spalten gibt es keinen „+ Karte“-Knopf mehr.

## Akzeptanzkriterien

- [x] API: Anlegen mit Beschreibung und zwei Teilaufgaben → Datei enthält beide, ein Commit
- [x] `n` öffnet den Dialog mit der Spalte der fokussierten Karte; Titel, Klasse, Mia, zwei Teilaufgaben, Strg+Enter → Karte mit allem, Dialog zu
- [x] „Anlegen und weitere“ → Dialog bleibt offen, Titel leer, Spalte und Klasse bleiben
- [x] „+“ im Spaltenkopf von „In Arbeit“ → Spalte vorbelegt; Esc → nichts angelegt
- [x] Kein „+ Karte“-Knopf mehr am Spaltenfuß
- [x] Liste in den Titel einfügen → je Zeile eine Aufgabe mit den Feldern des Dialogs

## Betroffene Verzeichnisstruktur

`src/dienst/aufgabe_anlegen.rs`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/mehrere.rs`, `e2e/tests/r00036-neue-aufgabe.spec.js` und die angepassten E2E-Tests der abgelösten Wege.

## Abhängigkeiten
- Abhängig von: R00011, R00027, R00028

## Offene Fragen
