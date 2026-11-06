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
