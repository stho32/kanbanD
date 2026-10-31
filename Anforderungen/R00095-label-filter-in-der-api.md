---
id: R00095
status: Neu
datum: 2026-10-31
---

# R00095: Label-Filter in der API

## Beschreibung

`GET /api/aufgaben` bekommt den Filter `label`, damit ein Agent Aufgaben nach Labels wie `nc:304` oder `repo:shop` abfragen kann. Labels mit Doppelpunkt funktionieren heute bereits beim Anlegen, Speichern, Anzeigen, in der Schnelleingabe und im Board-Filter. Nur die API lehnt `label` mit 400 „Unbekannter Filter“ ab.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

In der Wartungsfabrik ordnen Labels mit Präfix jede Karte einem Repository (`repo:<name>`) und einer verletzten Bedingung (`nc:<nr>`) zu. Sensoren und Behandler müssen ihre Karten danach finden können, ohne alle Aufgaben zu laden und selbst zu filtern. R00096–R00100 setzen diese Abfrage voraus.

## Bestand (geprüft am 2026-10-31, nicht Teil dieser Anforderung)

| Stelle | Ergebnis | Fundstelle |
|---|---|---|
| Speichern | `labels: ["nc:304", repo:shop]` — `nc:304` wird als JSON-String gequotet, `repo:shop` bleibt schlicht und liest sich zurück | `src/format/yaml.rs` `skalar`, `ist_qualifizierte_herkunft` |
| Anlegen über API | `POST /api/aufgaben {labels: [...]}` nimmt Labels an (Feld `Angaben.labels`), auch wenn die Endpunktbeschreibung nur `{titel, board?, spalte?}` nennt | `src/dienst/aufgabe_anlegen.rs:13`, `src/web/endpunkte.rs:52` |
| Ändern | `PATCH /api/aufgaben/{nr} {labels}` | `src/modell/aufgabe.rs:446` |
| Anzeige | Karte und Detail zeigen das Label unverändert | `web/ansicht.js:72`, `:128` |
| Schnelleingabe | `label:nc:304` → Label `nc:304` (Regex `^label:(.+)$`) | `web/eingabe.js:40` |
| Board-Filter | `label:nc:304` → Schlüssel `label`, Wert `nc:304` (Trennung am ersten Doppelpunkt) | `web/filter.js:9`, `:55` |
| API-Filter | **fehlt**: `GET /api/aufgaben?label=nc:304` → 400 | `src/dienst/aufgabenfilter.rs:48` |

## Funktionale Anforderungen

- `GET /api/aufgaben?label=<text>` liefert nur die Aufgaben, die dieses Label tragen. Verglichen wird der ganze Text ohne Unterscheidung von Groß- und Kleinschreibung, wie im Board-Filter.
- Für `label` gelten dieselben Regeln wie für die anderen Filter: Mehrfaches `label` wird mit ODER verknüpft, verschiedene Parameter mit UND, und archivierte Aufgaben sind ausgeblendet, solange `archivierte` nichts anderes sagt (R00092).
- Ein Wert, der mit `*` endet, filtert nach Präfix: `label=repo:*` trifft jedes Label, das mit `repo:` beginnt.
- Die Fehlermeldung „Unbekannter Filter“, `/api`, `/api/endpunkte` und `/api/openapi.json` nennen `label`.
- Die Endpunktbeschreibung von `POST /api/aufgaben` nennt die schon angenommenen Felder (`klasse, zustaendige, labels, faellig, herkunft, beschreibung, teilaufgaben`).

## Nicht-funktionale Anforderungen

- Keine Änderung am Dateiformat.

## Akzeptanzkriterien

### Filter
- [ ] #1 trägt `[nc:304, repo:shop]`, #2 `[nc:305]` und #3 keine Labels: `?label=nc:304` → [1]; `?label=nc:304&label=nc:305` → [1, 2]; `?label=nc:304&label=repo:shop` → [1]
- [ ] `?label=NC:304` → [1]
- [ ] `?label=nc:*` → [1, 2]; `?label=repo:*` → [1]
- [ ] #1 archiviert: `?label=nc:304` → []; `?label=nc:304&archivierte=ja` → [1]
- [ ] `?label=` ohne Wert trifft keine Aufgabe und liefert kein 400

### Beschreibung
- [ ] `GET /api/openapi.json` führt den Query-Parameter `label`, die Fehlermeldung bei `?farbe=x` zählt `label` auf
- [ ] Die Beschreibung von `POST /api/aufgaben` nennt `labels`

### Bestand bleibt
- [ ] Ein Label `nc:304`, über `PATCH` gesetzt, ist nach einem Neustart unverändert da (Rundreise durch die Datei)

## Betroffene Verzeichnisstruktur

Filterlogik in `src/dienst/aufgabenfilter.rs`, Beschreibung in `src/web/endpunkte.rs` und den utoipa-Annotationen in `src/web/mod.rs`. Unit-Tests stehen im selben Modul, Integrationstests unter `tests/`.

## Technische Überlegungen

### Ablauf
1. **Abfrage lesen**: `Aufgabenfilter::aus_paaren` übernimmt `label` in `labels: Vec<String>`
2. **Prüfen**: in `passt` ein weiteres `oder(&self.labels, …)`
   - 2.1 Endet der Wert mit `*`: `starts_with` auf den Rest, ohne Groß/Klein
   - 2.2 sonst: Gleichheit ohne Groß/Klein

### Grobentwurf

**Wichtige Einstiegsstellen:** `GET /api/aufgaben` in `src/web/mod.rs`, und zwar nur dort.

- `Aufgabenfilter` (DTO, vorhanden) — neues Feld `labels: Vec<String>`
  - `fn label_trifft(muster: &str, label: &str) -> bool` (pure, privat)

### Änderungen an bestehenden Klassen
- `Aufgabenfilter::aus_paaren`, `Aufgabenfilter::passt`, Fehlermeldung für unbekannte Filter
- Endpunktbeschreibungen `GET /api/aufgaben` und `POST /api/aufgaben`

## Tests

**Unit:** `aufgabenfilter.rs` — die Rechenbeispiele aus den Akzeptanzkriterien, einschließlich Präfix und Groß/Klein.
**Integration:** `GET /api/aufgaben?label=nc:304` gegen einen echten Ordner. Die Labels werden über `POST /api/aufgaben` gesetzt und nach einem Neustart erneut gelesen.
**E2E:** keine, die Oberfläche ändert sich nicht.

## Abhängigkeiten
- Abhängig von: R00092 (Filter an `GET /api/aufgaben`)
- Blockiert: R00098 (Befund erledigt sich), R00100 (Bestand je Label-Paar)

## Offene Fragen
- keine

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Ein Sensor, der wissen will, ob es zu `repo:shop` und `nc:304` schon Karten gibt, muss heute alle Aufgaben laden und selbst filtern, weil die API `label` mit 400 ablehnt. Mit dem Filter wird daraus eine einzige Abfrage, die auch von archivierten Karten weiß. So entfällt in jedem Sensor eine eigene Filterlogik. Der Hebel sitzt in der API und nicht im Dateiformat oder in der Oberfläche, denn beide verarbeiten Labels mit Doppelpunkt nachweislich schon richtig. Die Präfixsuche `repo:*` kostet eine Zeile und erspart dem Agenten die Aufzählung aller Repositories.

## Missing-Docs
- Die Endpunktbeschreibung von `POST /api/aufgaben` nennt nicht alle angenommenen Felder. Neben diesem Fall ist zu prüfen, ob die Beschreibung (`src/web/endpunkte.rs`) auch an anderen Stellen hinter den DTOs zurückliegt.

## Notizen

**Optionen-Tableau übersprungen:** Der Filter folgt mechanisch dem Muster der vorhandenen Filter aus R00092. Neu ist nur das Präfix `*`.

**Verworfene Alternativen**
- *Präfix als eigener Parameter `labelpraefix`*: ein zweiter Name für dieselbe Sache. `*` am Ende lässt sich auch ohne Doku lesen.
- *Freitextsuche über alle Felder*: zu unscharf für Agenten, die genau eine Karte suchen.
