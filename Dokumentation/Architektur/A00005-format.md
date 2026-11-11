---
id: A00005
name: Format
code: format
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/format/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Format

## Verantwortung

Das Format wandelt Markdown mit YAML-Frontmatter rein in Modelldaten um, in beide Richtungen ohne Dateizugriff.

## Schnittstellen

- eingehend: `format::aufgabe`, `format::board`, `format::einstellungen`, `format::fieber` — Text ↔ Modell; Fehler als `Formatfehler`
- ausgehend: keine

## Abhaengigkeiten

- [A00006 Modell](A00006-modell.md)

## Entscheidungen

- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): `cost` liest Geldwerte streng aus dem Zahltext in Cent und schreibt sie kanonisch mit zwei Nachkommastellen

## Offene Fragen

## Notizen / Quellen

- `src/format/frontmatter.rs`, `yaml.rs` gemeinsame Bausteine; eine Datei je Dateiart.
- Soll nach ADR-0009 (Karte #18): `cost` kommt in `BEKANNT`; Verstoß gegen Form oder Modellregel ist `Formatfehler` mit Pfad (Aufgabe defekt, wie `reporting`). Rundlauf-Test über alle Cent-Werte 0–100.000 plus Ränder; `basis`/`text` über `yaml::skalar`.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- nachgeführt 2026-11-11 nach R00128 (#35): das Board-Frontmatter liest/schreibt `archived: <JJJJ-MM-TT>` (`board::lesen`/`board::schreiben`); ein ungültiges Datum ist ein `Formatfehler` (wie `start`), der `---`-Block erscheint auch, wenn nur `archived` gesetzt ist; Rundlauf-Test `archiviert_im_frontmatter_rundlauf`.
- nachgeführt 2026-11-11 nach R00141 (#36, ADR-0024): **kein Formatwechsel.** Wird eine Aufgabe endgültig gelöscht, **entfällt** ihre Aufgabendatei ganz, und jede betroffene Board-Datei **verliert eine Zeile** (`- [#n](…)`), sonst bleibt die Board-Form unverändert; das dritte, unbeteiligte Board bleibt byte-gleich. Wiederherstellen ist ein `git`-Vorgang, keine Formatfrage.
