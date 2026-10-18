---
id: R00059
status: Erledigt
datum: 2026-10-18
---

# R00059: Plausibilitätsprüfung je Spalte

## Beschreibung

Ein Board kann je Spalte Plausibilitätsprüfungen konfigurieren, die beim Verlassen der Spalte in Richtung Abschlussspalte laufen. Sie sperren nicht, sie warnen. Die erste Prüfung heißt `wbs-effects-green`: alle Knoten, auf die die Aufgabe wirkt (R00057), sind `gruen`. Ist sie nicht erfüllt, meldet kanbanD beim Ziehen „Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.“ und markiert die Karte mit einem kleinen roten Ausrufezeichen, solange die Bedingung nicht erfüllt ist. Keine Spalte hat eingebautes Sonderverhalten.

Zahlt ein auf: [Vision](R00000-vision.md) — „grün setzt, wer geprüft hat“, „Die WBS als Stand, die Aufgaben als Fortschritt“.

## Geschäftlicher Nutzen

Fortschritt (Karte weitergezogen) und Stand (Knoten grün) laufen nicht unbemerkt auseinander, ohne dass jemand gebremst wird oder die KI nachträglich abgleichen muss.

## Funktionale Anforderungen

- Board-Frontmatter `column-checks`: Spaltenname → Liste von Prüfungsnamen, z. B. `Entwicklung: [wbs-effects-green]`. Dasselbe Muster wie `limits`; ein unbekannter Prüfungsname macht die Datei nicht defekt, wird aber als Hinweis gezeigt.
- Katalog der Prüfungen im Programm; erster Eintrag `wbs-effects-green`: für jede Wirkung `create` und `rework` der Aufgabe ist der Knoten `gruen`; `remove`-Wirkungen zählen nicht; ohne Wirkungen ist die Prüfung erfüllt.
- Auslöser: Zug aus einer Spalte mit Prüfungen in eine Spalte rechts davon (Oberfläche, Tastatur, API). Ein Zug nach links prüft nie.
- Der Zug wird immer ausgeführt und committet. Die Antwort von `POST …/bewegen` enthält `warnungen: [{pruefung, text, knoten: [kd:I0048, …]}]`; die Oberfläche zeigt die Warnung als Hinweis mit den nicht grünen Knoten als Links in die WBS-Sicht.
- Das Ausrufezeichen wird **gerechnet, nicht gespeichert**: es steht an einer Karte, die rechts einer Spalte mit Prüfung liegt, deren Prüfung jetzt nicht erfüllt ist; es verschwindet live, sobald die Knoten grün werden. Tooltip: Prüfung und Knoten.
- Spalten konfigurieren (R00009): Prüfungen je Spalte wählbar.

## Akzeptanzkriterien

### Warnung
- [x] `column-checks: {Entwicklung: [wbs-effects-green]}`, #7 wirkt `create kd:I0048` (`rot`); Zug Entwicklung → Entwicklertest → Zug ausgeführt, ein Commit, Antwort `warnungen[0].knoten = ["kd:I0048"]`, Karte mit rotem Ausrufezeichen
- [x] `I0048` wird `gruen` (R00055) → Ausrufezeichen verschwindet ohne Neuladen
- [x] Zug Entwicklertest → Entwicklung → keine Warnung; Board ohne `column-checks` → nie eine Warnung

### Konfiguration
- [x] Rundlauf `column-checks` stabil; Bewegen erhält den Schlüssel; Prüfungsname `xyz` → Hinweis „unbekannte Prüfung“, Board bleibt lesbar und schreibbar

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs` (`column-checks`), `src/pruefungen.rs` (neu, pure: Katalog), `src/dienst/bewegen.rs` (Warnungen), `src/web/mod.rs`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests in den Modulen, `tests/pruefungen.rs`, `e2e/tests/r00059-plausibilitaet.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `Pruefung` (Enum, erweiterbar über Namen) — `WbsWirkungenGruen`
- `fn pruefen(p: Pruefung, aufgabe: &Aufgabe, knoten: &Knotenstaende) -> Pruefergebnis` (pure)
- Oberfläche rechnet das Ausrufezeichen aus Board, Aufgaben und `/api/wbs/<kürzel>` wie „wartet auf“ (R00018)

## Tests
- Unit: Prüfung mit `create`, `rework`, `remove`, ohne Wirkungen; Auslöser nur nach rechts
- Integration: Zug mit Warnung über die API, Commit trotz Warnung
- E2E: Warnung beim Ziehen, Ausrufezeichen erscheint und verschwindet live

## Abhängigkeiten
- Abhängig von: R00055, R00057, R00058, R00009

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Ohne Prüfung kann eine Karte in Entwicklertest liegen, während ihr Knoten rot ist; dann misst die Prognose einen Fortschritt, den der Stand nicht trägt, und jemand muss das später finden. Eine sperrende Prüfung würde echte Ausnahmen blockieren und eine Spalte mit Sonderrolle schaffen. Die konfigurierte Warnung mit gerechnetem Ausrufezeichen macht den Widerspruch im Moment des Zugs sichtbar und hält ihn sichtbar, bis er aufgelöst ist. So spart die KI den Abgleich, und das Board bleibt ein reines Kanban, wo nichts konfiguriert ist.

## Notizen

- Verworfen: blockierende Prüfung — gewünscht ist eine Plausibilitätswarnung.
- Verworfen: Prüfungen an der Phase statt an der Spalte und frei formulierbare Regeln.
