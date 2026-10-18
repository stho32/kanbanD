---
id: R00039
status: Erledigt
datum: 2026-10-18
---

# R00039: Zuständige frei setzen

## Beschreibung

Nicht nur „mich“, sondern jede aktive Person lässt sich einer Aufgabe zuweisen und wieder abnehmen — im Aufgabenfenster (bestehend), im Dialog „Neue Aufgabe“ (R00036) und jetzt auch im Kartenmenü und im Menü der Aufgabenliste über „Zuständige ▸“. Die Taste `p` öffnet dieses Untermenü direkt an der fokussierten Karte.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“.

## Geschäftlicher Nutzen

Arbeit lässt sich vom Board aus verteilen, auch an Agenten.

## Funktionale Anforderungen

- „Zuständige ▸“ listet alle aktiven Personen (Menschen und Agenten) mit Haken bei den zuständigen; ein Klick schaltet um (ein Commit `#n geändert: Zuständige`). Stillgelegte, die zuständig sind, erscheinen mit Haken und lassen sich nur abnehmen.
- `p` auf einer fokussierten Karte öffnet das Kartenmenü mit aufgeklapptem „Zuständige ▸“; im Untermenü funktionieren ↑/↓/Enter wie überall.

## Akzeptanzkriterien

- [x] Menümodell: #1 mit `[mi]` → Einträge Stefan, Mia ✓, Claude; stillgelegte Anna erscheint nur, wenn zuständig
- [x] Rechtsklick auf #1 → „Zuständige ▸ Claude“ → `assignees: [mi, cl]`; „Mia“ → `assignees: [cl]`
- [x] Fokus auf #1, `p`, ↓, Enter → die zweite Person ist umgeschaltet

## Betroffene Verzeichnisstruktur

`web/menue.js`, `web/ansicht.js`, `web/app.js`; Tests `e2e/einheit/menue.test.js`, `e2e/tests/r00039-zustaendige.spec.js`.

## Abhängigkeiten
- Abhängig von: R00033, R00011

## Offene Fragen
