---
id: R00051
status: Erledigt
datum: 2026-10-18
---

# R00051: Endpunkt „verlauf“ bleibt für Agenten (Nachtrag)

## Beschreibung

Rekonstruiert aus dem Stand nach R00042–R00045. Die Oberfläche rechnet Burndown und Durchlaufzeit seit R00044/R00045 im Browser aus `GET /api/berichte/bewegungen` und ruft `GET /api/berichte/verlauf` nicht mehr auf. Der Endpunkt bleibt bestehen, unverändert und dokumentiert: Agenten und Skripte bekommen damit ohne eigene Rechnung offene Aufgaben je Tag, Umfang und Durchlaufzeiten (Eintritt aufs Board bis Abschlussspalte) samt Mittel und Median. Er kennt keine Filter; wer filtern will, nutzt `bewegungen`.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“; ergänzt [R00023](R00023-burndown-und-durchlaufzeit.md) und [R00042](R00042-bewegungen-eines-boards.md).

## Geschäftlicher Nutzen

Bestehende Auswertungen von Agenten brechen nicht, weil sich die Oberfläche geändert hat.

## Funktionale Anforderungen

- `GET /api/berichte/verlauf?board={slug}` liefert weiter `tage` (`datum`, `offen`, `umfang`), `durchlauf` (`nummer`, `eintritt`, `abschluss`, `tage`), `mittel`, `median`; unbekanntes Board → 404.
- Der Endpunkt steht in `GET /api/endpunkte` und auf `GET /api`.

## Akzeptanzkriterien

- [x] Integration `tests/verlauf.rs`: `verlauf_aus_echten_commits`, `unterordner_und_nicht_committetes_board`, `staende_werden_nach_zeitpunkt_geordnet`
- [x] Integration `tests/api.rs`: Router und Endpunkttabelle stimmen überein (enthält `verlauf` und `bewegungen`)

## Betroffene Verzeichnisstruktur

`src/verlauf.rs`, `src/dienst/verlauf.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`; Tests `tests/verlauf.rs`, `tests/api.rs`.

## Abhängigkeiten
- Abhängig von: R00023, R00042

## Offene Fragen
