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

## Offene Fragen

## Notizen / Quellen

- `src/web/mod.rs` Router, `router_mit_ende`; `endpunkte.rs` Endpunkt-Liste; `openapi.rs`; `statisch.rs` eingebettete Dateien aus `web/`.
