---
id: R00033
status: Erledigt
datum: 2026-10-18
---

# R00033: Kontextmenü der Karte

## Beschreibung

Ein Rechtsklick auf eine Karte — oder die Menütaste bzw. Umschalt+F10 auf einer fokussierten Karte — öffnet ein Menü mit allem, was man mit ihr tun kann, jeweils mit dem Tastenkürzel daneben. Untermenüs führen zu Spalte, Klasse, Fälligkeit und anderen Boards. Das Menü ist mit Maus und Tastatur bedienbar. Dazu kommen Kartenkürzel, die es noch nicht gab.

Zahlt ein auf: [Vision](R00000-vision.md) — „per Tastatur bedienbar und folgt gewohnten Konventionen“.

## Geschäftlicher Nutzen

Alle Handgriffe an einer Karte sind an einem Ort auffindbar; wer die Kürzel lernt, braucht das Menü bald nicht mehr.

## Funktionale Anforderungen

- Einträge: Öffnen (Enter) · Timer starten/stoppen (t) · Mir zuweisen/Mich abnehmen (m) · Umbenennen (F2) · Verschieben nach ▸ Spalten des Boards (1–9) · Klasse ▸ Klassen und „keine“ · Fälligkeit ▸ heute, morgen, +1 Woche, entfernen · Auf Board legen ▸ Boards, auf denen die Karte nicht liegt · Verweis kopieren (c) · Archivieren (a). Die aktuelle Spalte und die aktuelle Klasse sind markiert und nicht wählbar.
- Menü: erscheint am Zeiger bzw. an der Karte, bleibt im Fenster; ↑/↓ wählen (Trenner übersprungen, Umlauf), → öffnet ein Untermenü, ← schließt es, Enter führt aus, Esc oder Klick daneben schließt.
- Neue Kartenkürzel auf dem Board: `a` archiviert (mit „rückgängig“), `1`–`9` verschiebt in Spalte n (ans Ende), `c` kopiert „#n Titel“ in die Zwischenablage.
- Die Hilfe `?` listet die neuen Kürzel.

## Akzeptanzkriterien

- [x] Menümodell für #3 in „Zu erledigen“ mit laufendem eigenem Timer: Eintrag „Timer stoppen“, Spalte „Zu erledigen“ markiert, „Auf Board legen“ nennt nur Boards ohne #3
- [x] Menüschritt: von Eintrag 0 mit ↑ zum letzten Eintrag, Trenner werden übersprungen
- [x] Rechtsklick auf #1 → Menü; „Verschieben nach ▸ Erledigt“ → #1 in „Erledigt“
- [x] Tastatur: Fokus auf #1, Umschalt+F10, ↓↓, Enter → der gewählte Eintrag wirkt; Esc schließt
- [x] `a` auf #1 → archiviert, Hinweis „rückgängig“; `3` auf #2 → #2 in der dritten Spalte; `c` → Zwischenablage enthält „#2 zwei“

## Betroffene Verzeichnisstruktur

`web/menue.js` (pure), `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `e2e/einheit/menue.test.js`, `e2e/tests/r00033-kontextmenue.spec.js`.

## Tests
- Unit: Menümodell, Menüschritt
- E2E: Maus, Tastatur, neue Kürzel

## Abhängigkeiten
- Abhängig von: R00029, R00026, R00031

## Offene Fragen
