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

- [ADR-0003: Abweisungen mit strukturiertem Rumpf](../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md) — Nachtrag N1 (#39): Formfehler des Rahmens (kaputtes JSON, falscher Typ, fehlendes Pflichtfeld; auch `Path`/`Query`) laufen über einen eigenen Extraktor und enden als 400 mit `{"fehler": …}` samt Feldpfad — heute liefert Axum 422, `text/plain`; Nachtrag N3 (#39): Inhalt 400, fehlender Content-Type 415 und zu großer Rumpf 413 behalten ihren Code und bekommen `{fehler}`, `Fehler` bleibt frei von Transport, 36 Handler mit `Json<T>` wechseln; Nachtrag N2 (#121): Ordnung der Abweisungen, wenn mehrere zugleich zutreffen — **423 vor 403 vor 409**, einheitlich für Board und Aufgabe (R00120 AK 6 bleibt wörtlich; Soll: `archivieren_pruefen` prüft die Defekte vor der Entnahmesperre, heute 403 zuerst)
- [ADR-0006: Einstellung verboten als dritte Abweisung](../ADRs/0006-einstellung-verboten-als-dritte-abweisung.md)
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): `cost` in `Aufgabenaenderung` als rohes JSON, damit jeder Fehler 400 statt 422 ist
- [ADR-0017: Rückgängig als Gegenaktion mit gemerktem Inhalt](../ADRs/0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) — gebaut (#12, R00112, Zweig `karte/12`, `9d246a3`): `POST /api/boards/{slug}/aufgaben` nimmt optional `index`, `POST /api/aufgaben/{nr}/teilaufgaben` optional `position` und `erledigt`. Beide Parameter sind additiv; ohne sie bleibt das Verhalten gleich
- [ADR-0022: Board umbenennen, archivieren, löschen](../ADRs/0022-board-umbenennen-archivieren-loeschen.md) — gebaut (#35, R00128, `4549a12`): `PATCH /api/boards/{slug}` ändert Titel und/oder Archiv, `DELETE /api/boards/{slug}` entfernt Board-Datei und Berichte-Cache; `GET /api/boards` und `zustand.boards` lassen Archivierte weg, `?archivierte=ja` nimmt sie auf; Agent bei Archivieren/Löschen 403 (R00097/R00120), defektes Board 423
- [ADR-0023: Geschätzte Zeit je Karte — ganze Minuten in der Datei, Anzeige `h:mm` erst beim Zeichnen; eine Prüfung für Datei und API, jeder Fehler 400](../ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) — gebaut (Karte #37, R00129, `20b8bfa`): `PATCH /api/aufgaben/{nr}` und `/mehrere` nehmen `estimate` roh (`serde_json::Value`, entfernbar) — ein Wert ersetzt, `null` entfernt, fehlend lässt unverändert; jeder Fehler im Rumpf `estimate`, auch ein Typfehler, ist 400 (nie 422) mit „estimate: ganze Zahl von Minuten ≥ 1 erwartet“; `GET` liefert `estimate` als JSON-Zahl; Endpunkt-Liste und OpenAPI nennen das Feld samt 400
- [ADR-0021: Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern](../ADRs/0021-karten-verlauf-aus-der-git-geschichte.md) — gebaut (#119, R00123/R00124, `902a97b`, `56ec980`): neuer, **rein lesender** Endpunkt `GET /api/aufgaben/{nr}/verlauf` (`src/web/mod.rs:769`, Route `:98`) — führt die Git-Historie der Aufgabendatei und jeder Board-Datei zeitlich zusammen, neueste zuerst, Antwort `crate::verlauf::Kartenverlauf`; unbekannte Nummer 404, sonst 400/423/500 als `openapi::Fehlerantwort`; steht in der Endpunkt-Liste (`src/web/endpunkte.rs:62`) und OpenAPI (`src/web/mod.rs:763`). Aus R00124 nimmt `PUT /api/boards/{slug}/spalten` je Spalte `datums_trenner` (`SpaltenAenderung.datums_trenner: Option<Option<bool>>`, roh wie `estimate` — falscher Typ 400 statt axum-422; `null` entfernt den Schlüssel, fehlend lässt ihn)

## Offene Fragen

## Notizen / Quellen

- `src/web/mod.rs` Router, `router_mit_ende`; `endpunkte.rs` Endpunkt-Liste; `openapi.rs`; `statisch.rs` eingebettete Dateien aus `web/`.
- 409 hat zwei Rumpfformen nach [ADR-0003](../ADRs/0003-abweisungen-mit-strukturiertem-rumpf.md): `openapi::Fehlerantwort { fehler }` und, für einen Agenten über der WIP-Grenze (R00096), `openapi::GrenzeErreicht { fehler, spalte, grenze, anzahl }` (`fehler` zuerst, immer „Grenze erreicht“); abgebildet in `src/web/mod.rs` aus `Fehler::GrenzeErreicht`. Die Endpunkte mit Grenze beschreiben ihre 409 mit dem Schema `openapi::Konflikt` (`untagged`-Enum beider Formen, nur für die Beschreibung, deshalb `#[allow(dead_code)]`).
- Eine weitere strukturierte Abweisung (z. B. R00097 Eigentümer, 403) folgt demselben Muster: eigene Rumpf-Struktur in `openapi.rs`, Abbildung aus der `Fehler`-Variante in `web/mod.rs`, bei mehreren möglichen Rümpfen ein Beschreibungsschema wie `Konflikt`.
- 403 hat je Endpunkt genau eine Rumpfform: an den Zug-Endpunkten `openapi::Verboten { fehler, spalte, nummer }` aus `Fehler::Verboten` (R00097, gebaut, `src/web/mod.rs:163`); an `PUT /api/boards/{slug}/spalten` `openapi::EinstellungVerboten { fehler, spalte, einstellung }` aus `Fehler::EinstellungVerboten` (R00102, Soll nach [ADR-0006](../ADRs/0006-einstellung-verboten-als-dritte-abweisung.md), noch nicht gebaut). Kein Beschreibungs-Enum für 403, solange kein Endpunkt beide Formen liefern kann.
- nachgeführt 2026-11-01 nach R00096 (Architektur-Review #2); ergänzt 2026-11-01 um die 403-Formen (R00097 Ist, R00102 Soll, Karte #27)
- Soll nach ADR-0009 (Karte #18, noch nicht gebaut): `PATCH /api/aufgaben/{nr}` und `/mehrere` nehmen `cost` roh (`serde_json::Value`, entfernbar) an — ein typisiertes Feld gäbe bei Typfehlern axum-422 (`tests/termine.rs:31`). Kein eigener Endpunkt; OpenAPI-Schema per `value_type`.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- Soll nach ADR-0017 (Karte #12, überholt durch das Ist darunter): die zwei optionalen Felder in den Anfrage-Strukturen und im OpenAPI-Schema. Ein ungültiger Wert ergibt 400, ein zu großer `index` legt unten ab. Ist (Probe 2026-11-08): `position` und `erledigt` beim Anlegen einer Teilaufgabe werden still ignoriert.
- nachgeführt 2026-11-08 nach #12 (ADR-0017)

- Ist nach ADR-0017 (Karte #12, R00112, Zweig `karte/12`, `9d246a3`): `POST /api/boards/{slug}/aufgaben` mit Rumpf `Ablage { nummer, spalte?, index? }` (`src/web/mod.rs:1243–1250`), `POST /api/aufgaben/{nr}/teilaufgaben` mit Rumpf `NeueTeilaufgabe { text, position?, erledigt? }` (`:776–798`). `index`, `position` und `erledigt` kommen roh als `serde_json::Value` an; ein falscher Typ ist 400, nie axum-422 (Muster wie ADR-0009). `ganze_zahl_ab_null` (`:1253`) prüft die Stellen: fehlt der Wert oder ist er `null`, unten; sonst eine ganze Zahl ab 0. Endpunkt-Liste und OpenAPI nennen die Felder (`src/web/endpunkte.rs`).
- nachgeführt 2026-11-08 nach dem Bau von #12 (R00112, ADR-0017)
- nachgeführt 2026-11-11 nach dem Bau von #37 (R00129, ADR-0023): `estimate` kommt in `Aufgabenaenderung` roh an (`src/modell/aufgabe.rs:477`); die Tür ist `PATCH /api/aufgaben/{nr}` (`src/web/mod.rs:749`) und `PATCH /api/aufgaben/mehrere`; jeder Fehler 400, nie 422; `GET /api/aufgaben/{nr}` (`src/web/mod.rs:722`) liefert `estimate` als JSON-Zahl; Endpunkt-Liste (`src/web/endpunkte.rs:62`) und OpenAPI (`src/web/mod.rs:744`) beschreiben das Feld in derselben `Aufgabenaenderung` wie `cost`, samt 400.
- nachgeführt 2026-11-11 nach dem Bau von #124 (R00142): neuer Endpunkt `POST /api/aufgaben/{nr}/duplizieren` (`src/web/mod.rs:723`, Route `:97`) — Rumpf optional `Zielort { board?, spalte? }` (`src/dienst/aufgabe_anlegen.rs:58`, beide oder keines; ohne Rumpf nur die Aufgabendatei, mit beiden die Kopie unten in dieser Spalte), Antwort **201** mit `Angelegt` wie beim Anlegen, 400/404/423 als `openapi::Fehlerantwort`, 409 als `openapi::Konflikt` (Agent über der WIP-Grenze: `GrenzeErreicht`); 403 kommt nicht vor, die Eigentümer-Regel sperrt beim Hineinlegen nicht (R00097). Ein Commit „#<neu> dupliziert (aus #<nr>) in „<Spalte>“ (<Board>)“. Endpunkt-Liste (`src/web/endpunkte.rs:57`) und OpenAPI tragen Beschreibung und Statuscodes; kein ADR (R00142).
- nachgeführt 2026-11-12 nach R00123/R00124 (ADR-0021): `GET /api/aufgaben/{nr}/verlauf` (`src/web/mod.rs:769`, Route `:98`) ist rein lesend und ruft `Kanban::karten_verlauf`; Endpunkt-Liste (`src/web/endpunkte.rs:62`) und OpenAPI (`src/web/mod.rs:763`) tragen ihn samt 404. `PUT /api/boards/{slug}/spalten` trägt je Spalte `datums_trenner` (R00124, `column-dates`) unverändert als optionales Feld (`SpaltenAenderung`, `Option<Option<bool>>`).
