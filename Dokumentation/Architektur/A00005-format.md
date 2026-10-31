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

## Offene Fragen

## Notizen / Quellen

- `src/format/frontmatter.rs`, `yaml.rs` gemeinsame Bausteine; eine Datei je Dateiart.
