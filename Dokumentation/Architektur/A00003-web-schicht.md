---
id: A00003
name: Web-Schicht
code: web
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/web/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Web-Schicht

## Verantwortung

Die Web-Schicht übersetzt HTTP-Anfragen in Aufrufe der Dienste samt Fehlerabbildung auf Statuscodes.

## Schnittstellen

- eingehend: REST-API unter `/api/…` (Liste `GET /api/endpunkte`, OpenAPI `/api/openapi.json`), SSE-Ereignisstrom, statische Oberfläche
- ausgehend: `Kanban`-Methoden der [Dienste](A00004-dienste.md); Ereignisse aus dem [Wächter](A00008-waechter.md) über `broadcast`
- Handelnder: Header `X-KanbanD-Wer` → `Kanban::handelnder`

## Abhaengigkeiten

- [A00004 Dienste](A00004-dienste.md), [A00008 Wächter](A00008-waechter.md), [A00009 Oberfläche](A00009-oberflaeche.md) (eingebettet)

## Entscheidungen

- [ADR-0003: Abweisungen mit strukturiertem Rumpf](../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md)
## Offene Fragen

## Notizen / Quellen

- `src/web/mod.rs` Router, `router_mit_ende`; `endpunkte.rs` Endpunkt-Liste; `openapi.rs`; `statisch.rs` eingebettete Dateien aus `web/`.
- 409 hat zwei Rumpfformen nach [ADR-0003](../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md): `openapi::Fehlerantwort { fehler }` und, für einen Agenten über der WIP-Grenze (R00096), `openapi::GrenzeErreicht { fehler, spalte, grenze, anzahl }` (`fehler` zuerst, immer „Grenze erreicht“); abgebildet in `src/web/mod.rs` aus `Fehler::GrenzeErreicht`. Die Endpunkte mit Grenze beschreiben ihre 409 mit dem Schema `openapi::Konflikt` (`untagged`-Enum beider Formen, nur für die Beschreibung, deshalb `#[allow(dead_code)]`).
- Eine weitere strukturierte Abweisung (z. B. R00097 Eigentümer, 403) folgt demselben Muster: eigene Rumpf-Struktur in `openapi.rs`, Abbildung aus der `Fehler`-Variante in `web/mod.rs`, bei mehreren möglichen Rümpfen ein Beschreibungsschema wie `Konflikt`.
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2)
