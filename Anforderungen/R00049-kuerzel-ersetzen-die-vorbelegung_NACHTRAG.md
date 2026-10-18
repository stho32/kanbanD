---
id: R00049
status: Erledigt
datum: 2026-10-18
---

# R00049: @kürzel ersetzt die Vorbelegung im Dialog „Neue Aufgabe“ (Nachtrag)

## Beschreibung

Rekonstruiert aus dem Code von R00036 (`neuEintrag` in `web/app.js`). Der Dialog „Neue Aufgabe“ belegt die Zuständigen mit mir vor. Die Schnelleingabe aus R00028 setzt Zuständige über `@kürzel` im Titel. Regel: Solange niemand die Zuständigen im Dialog von Hand angeklickt hat, **ersetzt** ein `@kürzel` die Vorbelegung — so wie früher in „+ Karte“, wo `@mi` die Aufgabe nur Mia gab. Hat jemand die Zuständigen von Hand gewählt, werden die `@kürzel` **dazugenommen**. Ohne `@kürzel` gelten die Zuständigen des Dialogs.

Zahlt ein auf: [Vision](R00000-vision.md) — „gewohnte Konventionen“; ergänzt [R00036](R00036-neue-aufgabe-im-dialog.md) und [R00028](R00028-schnelleingabe-mit-kuerzeln.md).

## Geschäftlicher Nutzen

`Login reparieren @mi` bedeutet weiterhin „für Mia“, nicht „für mich und Mia“; eine bewusste Auswahl im Dialog geht nicht verloren.

## Funktionale Anforderungen

- Zuständige des neuen Eintrags: mit `@kürzel` und ohne Handauswahl → nur die `@kürzel`; mit `@kürzel` und Handauswahl → Vereinigung; ohne `@kürzel` → Auswahl im Dialog.
- Gilt auch für jede Zeile einer eingefügten Liste.

## Akzeptanzkriterien

- [x] E2E `R00028 US-1`: Dialog vorbelegt mit Stefan, Titel `Login reparieren @mi class:bug due:morgen` → `assignees: [mi]`
- [x] E2E `R00049 US-2`: Claude von Hand dazugewählt, Titel `Prüfen @mi` → `assignees: [st, cl, mi]`
- [x] E2E `R00036 US-1`: ohne `@kürzel`, Mia an- und Stefan abgewählt → `assignees: [mi]`

## Betroffene Verzeichnisstruktur

`web/app.js` (`neuEintrag`, Aktion `nf-zust`); Tests `e2e/tests/r00028-schnelleingabe.spec.js`, `e2e/tests/r00036-neue-aufgabe.spec.js`, `e2e/tests/r00049-kuerzel-vorbelegung.spec.js`.

## Abhängigkeiten
- Abhängig von: R00036, R00028

## Offene Fragen
