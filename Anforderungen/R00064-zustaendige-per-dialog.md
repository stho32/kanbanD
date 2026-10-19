---
id: R00064
status: Erledigt
datum: 2026-10-19
---

# R00064: Zuständige per Dialog, Mitglieder rechts auf der Karte

## Beschreibung

Die Karte wird ruhiger: Der Direktknopf „+ mich“ / „− mich“ der Kartenleiste entfällt, die zuständigen Mitglieder stehen rechtsbündig in der unteren Zeile der Karte. Zuständige setzt man stattdessen im Dialog „Zuständige zuweisen …“: Er listet alle aktiven Mitglieder mit Kästchen, vorbelegt mit den aktuell Zuständigen, und überträgt die Auswahl erst bei „Speichern“ auf die Aufgabe, von der aus er geöffnet wurde.

Löst ab: aus R00029 die Regel „„+ mich“ bzw. „− mich“ für die eigene Zuständigkeit“ in der Kartenleiste; aus R00039 das Untermenü „Zuständige ▸“, das jeden Klick sofort speichert, samt seiner Tastenführung.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“ und „Ein eigenes Design, früh vom Menschen gesehen“.

## Geschäftlicher Nutzen

Die Karte zeigt beim Zeigen nur noch den Timer, die Mitglieder stehen an fester Stelle rechts. Mehrere Zuständige lassen sich in einem Zug setzen statt Klick für Klick mit je einem Commit.

## Funktionale Anforderungen

- Karte: die Kartenleiste enthält nur noch ▶ bzw. ■ für den eigenen Timer; sie steht in der unteren Zeile direkt links neben den Mitgliedern und verdeckt sie nicht. Die Mitglieder stehen rechtsbündig; mit Fälligkeit lautet die Reihenfolge rechts: Fälligkeit, Leiste, Mitglieder.
- Kartenmenü und Menü der Aufgabenliste: Eintrag „Zuständige zuweisen …“ (Kürzel `p` im Kartenmenü) öffnet den Dialog; das Untermenü „Zuständige ▸“ entfällt.
- Taste `p` auf einer fokussierten Karte öffnet den Dialog direkt.
- Dialog „Zuständige für #n“: je aktivem Mitglied (Menschen und Agenten) ein Kästchen mit Kürzel und Name, vorbelegt mit den Zuständigen; Stillgelegte erscheinen nur, wenn sie zuständig sind, markiert als „stillgelegt“, und lassen sich nur abwählen. Leertaste schaltet das fokussierte Kästchen um.
- „Speichern“ (oder Enter) überträgt die Auswahl als `assignees` auf die Aufgabe — ein Commit `#n geändert: Zuständige`, keiner, wenn sich nichts geändert hat. „Abbrechen“, `Esc` oder ein Klick neben den Dialog verwerfen die Auswahl. Danach hat die Karte bzw. die Zeile wieder den Fokus.
- Bleiben: Menüeintrag „Mir zuweisen“ / „Mich abnehmen“ und die Taste `m`.

## Akzeptanzkriterien

- [x] Die Karte hat keinen Knopf „mich zu #n“ mehr; die Mitglieder stehen rechtsbündig, beim Zeigen steht ▶ links neben ihnen, ohne sie zu überdecken
- [x] Menümodell: Karten- und Listenmenü enthalten „Zuständige zuweisen …“ und kein Untermenü „Zuständige“
- [x] Personenmodell des Dialogs: #1 mit `[mi]` → Stefan, Mia ✓, Claude; stillgelegte Anna nur, wenn zuständig
- [x] Rechtsklick auf #1 (Mia zuständig) → „Zuständige zuweisen …“ → Claude an, Mia ab → Speichern → `assignees: [cl]`, genau ein Commit
- [x] Abbrechen und `Esc` lassen `assignees` unverändert
- [x] Fokus auf #1, `p` → Dialog offen; Leertaste und Enter speichern; die Karte hat danach den Fokus
- [x] Zeile der Aufgabenliste: Rechtsklick → „Zuständige zuweisen …“ → Speichern überträgt auf diese Aufgabe
- [x] „Mir zuweisen“ im Menü und Taste `m` funktionieren weiter

## Betroffene Verzeichnisstruktur

`web/menue.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `e2e/einheit/menue.test.js`, `e2e/tests/r00029-karte-direkt.spec.js`, `e2e/tests/r00039-zustaendige.spec.js`, neu `e2e/tests/r00064-zustaendige-dialog.spec.js`.

## Abhängigkeiten
- Abhängig von: R00029, R00033, R00039

## Offene Fragen
- keine
