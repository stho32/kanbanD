---
id: R00091
status: Neu
datum: 2026-10-25
---

# R00091: Einstellungen lesen und Personen einzeln pflegen

## Beschreibung

Einstellungen gibt es über die API nur als `PUT /api/einstellungen` (alles ersetzen); gelesen werden sie nur versteckt in `GET /api/zustand`. Ein Agent, der eine Rollen-Person anlegen will, muss alles lesen, zusammensetzen und ersetzen. Künftig gibt es `GET /api/einstellungen` und die Sammlung `/api/personen` mit Anlegen, Ändern und Stilllegen einer einzelnen Person.

Zahlt ein auf: [Vision](R00000-vision.md) — KI-Agenten über die API als gleichwertige Nutzer.

## Geschäftlicher Nutzen

Agenten richten ihre Rollen-Personen selbst ein, ohne Gefahr, dabei Klassen, Signale oder andere Personen zu überschreiben.

## Funktionale Anforderungen

- `GET /api/einstellungen` → dieselbe Form, die `PUT` annimmt.
- `GET /api/personen` → `{personen: [...]}` (Liste verpackt, R00092-Regel).
- `POST /api/personen {kuerzel, name, art, aktiv?}` (braucht Wer) → `201` mit der Person; Prüfregeln wie bei `PUT` (Kürzel 1–8 Kleinbuchstaben/Ziffern, Name nicht leer); Kürzel vorhanden → `409`.
- `PATCH /api/personen/{kürzel} {name?, art?, aktiv?}` → die geänderte Person; unbekannt → `404`.
- `DELETE /api/personen/{kürzel}` → **stilllegen** (`aktiv: false`), denn Personen werden nie entfernt (bestehende Regel); Antwort die Person.
- Jede Änderung ist ein Commit der Einstellungsdatei; ohne Änderung kein Commit.

## Akzeptanzkriterien

- [ ] `GET /api/einstellungen` → `PUT` derselben Antwort ändert nichts (kein Commit)
- [ ] `POST /api/personen {kuerzel: "crev", name: "Code-Reviewer", art: "agent"}` → `201`; zweites Mal → `409`; Kürzel `Crev!` → `400`
- [ ] `PATCH /api/personen/crev {name: "Reviewer"}` → Name geändert, andere Personen, Klassen und Signale unverändert
- [ ] `DELETE /api/personen/crev` → `aktiv: false`, Person bleibt in der Liste
- [ ] `PATCH /api/personen/xyz` → `404`

## Betroffene Verzeichnisstruktur

`src/dienst/einstellungen.rs` (Personen einzeln), `src/web/mod.rs`, `src/web/endpunkte.rs`; Tests `tests/einstellungen.rs` bzw. ein neuer Test für Personen.

## Technische Überlegungen

Personenoperationen lesen die Einstellungen, ändern eine Person und schreiben über denselben Pfad wie `einstellungen_setzen` (inkl. `einstellungen_pruefen`), damit die Regeln an einer Stelle bleiben.

## Tests
**Integration:** alle Kriterien über HTTP. **Unit:** keine neue pure Logik außer der Änderungsanwendung `PersonAenderung::anwenden`.

## Abhängigkeiten
- Abhängig von: R00010, R00024
- Blockiert: R00093

## Offene Fragen
- keine — Sammlung `/api/personen` entschieden am 2026-10-25 (Feedback-Runde Punkt 10); `DELETE` = stilllegen folgt der bestehenden Regel „Personen nur stilllegen“

## Notizen
### Verworfene Alternativen
- `PATCH /api/einstellungen` mit Merge der obersten Ebene: eine einzelne Person ändert man weiter über die ganze Liste.
- Nur `GET`: Schreiben bliebe gefährlich.

## Warum löst diese Anforderung das Problem? (Pflicht)

Nur `PUT` auf alles → Agent muss den Gesamtzustand rekonstruieren → Risiko, Fremdes zu überschreiben. `GET` plus Einzeloperationen → der Agent ändert genau eine Person → nichts anderes kann verloren gehen.
