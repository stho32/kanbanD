---
id: R00053
status: In Arbeit
datum: 2026-10-18
---

# R00053: Anwendungen registrieren

## Beschreibung

Das Board-Repository liegt getrennt vom Repository der Anwendung, an der gearbeitet wird. `kanbanD.md` führt deshalb ein Register der Anwendungen: je Anwendung ein Kürzel, ein Name und die vollen Pfade zu ihrer WBS-Datei und ihrem Anforderungsordner. Ein Board nennt keine bis mehrere dieser Kürzel. Die Herkunft einer Aufgabe wird mit dem Kürzel qualifiziert (`kd:I0007`, `kd:R00014`), damit gleiche IDs aus verschiedenen Anwendungen eindeutig bleiben. Das Spiegeln von WBS und Anforderungen in den kanbanD-Ordner entfällt.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Board-Repository und Arbeits-Repository sind getrennt“, Zielbild „Die WBS als Stand, die Aufgaben als Fortschritt“.

## Geschäftlicher Nutzen

Board und Anwendung bleiben in getrennten Repositories, ohne dass Kopien auseinanderlaufen. Heute weicht `plan/kanbanD.md` in `kanbanD-test` bereits vom Original ab, und R00042 bis R00052 fehlen dort.

## Funktionale Anforderungen

- `kanbanD.md` nimmt `sources.applications` an: je Kürzel `{name, wbs, requirements}`. Das Kürzel folgt den Regeln der Personenkürzel (1–8 Kleinbuchstaben oder Ziffern).
- Pfade sind absolut. Ein relativer Pfad gilt weiter relativ zum kanbanD-Ordner. Ein nicht vorhandener Pfad macht die Anwendung „nicht erreichbar“ und nicht die Datei defekt.
- Die bisherigen `sources.wbs` und `sources.requirements` bleiben als **Standardanwendung ohne Kürzel** gültig. Sie werden beim Schreiben der Einstellungen nicht umgeschrieben.
- Das Board-Frontmatter nimmt `applications: [kd, kc]` an. Fehlt der Schlüssel oder ist er leer, ist das Board ein reines Kanban. Bei genau einer registrierten Anwendung gilt sie als gebunden.
- Gültige Herkunft wird erweitert um `<kürzel>:<WBS-ID>` und `<kürzel>:<R-ID>`. Ein unbekanntes Kürzel ergibt 400.
- Unqualifizierte Herkunft (`I0007`) löst auf, wenn genau eine Anwendung registriert ist (oder nur die Standardanwendung). Sonst zeigt die Karte sie als „mehrdeutig“, und `/api/herkunft` liefert sie nicht.
- `GET /api/herkunft` liefert Schlüssel in der Schreibweise der Aufgabe, dazu `anwendung` (Kürzel). „wartet auf“ (R00018) vergleicht qualifiziert.
- `GET /api/anwendungen` liefert das Register mit `erreichbar` je Pfad. Die Einstellungsseite (R00010) zeigt und pflegt es; jede Änderung ist ein Commit im Board-Repository.

## Akzeptanzkriterien

### Register
- [ ] `sources.applications.kd: {name: kanbanD, wbs: /tmp/x/plan.md, requirements: /tmp/x/req}` → `GET /api/anwendungen` liefert `kd` mit `erreichbar: true` für beide Pfade; nach Löschen von `/tmp/x/plan.md` liefert es `wbs: false`, und `kanbanD.md` ist nicht defekt
- [ ] Kürzel `KD!` → 400; ein Rundlauf mit zwei Anwendungen schreibt das Frontmatter stabil sortiert
- [ ] Ein Ordner mit nur `sources.wbs: plan/kanbanD.md` verhält sich wie vor R00053 (Tests aus R00018 bleiben grün)

### Herkunft
- [ ] `PATCH {herkunft: ["kd:I0007"]}` schreibt `origins: [kd:I0007]`; `["xx:I0007"]` mit unbekanntem `xx` → 400
- [ ] Zwei Anwendungen `kd` und `kc`, beide mit `I0007` → `/api/herkunft` liefert für `kd:I0007` den Pfad der WBS von `kd` und für `kc:I0007` den von `kc`
- [ ] Zwei Anwendungen, Aufgabe mit `origins: [I0007]` → die Karte zeigt „mehrdeutig“; mit einer Anwendung zeigt sie den Knoten

### Board-Bindung
- [ ] `boards/entwicklung.md` mit `applications: [kd]` → `GET /api/boards/entwicklung` liefert `anwendungen: ["kd"]`; ein Bewegen erhält den Schlüssel

## Betroffene Verzeichnisstruktur

`src/modell/einstellungen.rs` und `src/format/einstellungen.rs` (Register), `src/modell/board.rs` und `src/format/board.rs` (`applications`), `src/modell/aufgabe.rs` (`herkunft_gueltig`), `src/dienst/herkunft.rs` (Auflösung je Anwendung), `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/`; Tests in den Modulen, `tests/anwendungen.rs`, `e2e/tests/r00053-anwendungen.spec.js`.

## Technische Überlegungen

### Ablauf
1. **Einstellungen lesen:** `sources.applications` zu `Anwendungen` (benannte Collection), Standardanwendung aus `sources.wbs`/`sources.requirements`.
2. **Herkunft prüfen:** `herkunft_gueltig(h, &anwendungen)`, das Kürzel muss registriert sein.
3. **Herkunft auflösen:** je Anwendung `wbs_knoten` und Anforderungen lesen und unter dem qualifizierten Schlüssel ablegen; unqualifiziert nur bei Eindeutigkeit.

### Grobentwurf
- `Anwendung` (DTO, immutable) — Kürzel, Name, WBS-Pfad, Anforderungspfad.
- `Anwendungen` (benannte Collection) — `fn aufloesen(&self, herkunft: &str) -> Aufloesung` (eindeutig, mehrdeutig, unbekannt).
- `Herkunftsschluessel` (DTO) — `fn lesen(&str) -> Option<Herkunftsschluessel>` mit optionalem Kürzel und ID.

## Tests
- Unit: Kürzel- und Herkunftsprüfung, Auflösung eindeutig, mehrdeutig, unbekannt
- Integration: Register mit zwei Anwendungen in getrennten Temp-Repositories, `/api/herkunft`, `/api/anwendungen`, Commit der Einstellungen
- E2E: Anwendung anlegen in den Einstellungen, Herkunft `kd:I0007` an einer Karte mit Link

## Abhängigkeiten
- Abhängig von: R00010, R00018
- Blockiert: R00054, R00057

## Offene Fragen
- keine

## Manuelle Nachbereitungstätigkeiten
- In `/home/shoff/kanbanD-test` die Kopien `plan/` und `anforderungen/` durch ein Register mit vollen Pfaden auf `~/Projekte/kanbanD` ersetzen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser sind Kopien von WBS und Anforderungen im Board-Repository, die schon auseinandergelaufen sind. Wenn das Board auf das Original im Arbeits-Repository zeigt, gibt es nur eine Fassung, und kanbanD liest immer den gültigen Stand. Der volle Pfad steht genau einmal in `kanbanD.md`, sodass ein Umzug eine Zeile ändert und nicht jedes Board. Das Kürzel macht die IDs über Anwendungen hinweg eindeutig; ohne Kürzel wären 0:N-Bindungen und Wirkungen auf Knoten (R00057) nicht adressierbar. Damit ist das Register die Voraussetzung jeder weiteren WBS-Funktion.

## Notizen

- Verworfen: volle Pfade direkt in jedem Board — der rechnerabhängige Pfad stünde an N Stellen.
- Verworfen: genau eine Anwendung je Ordner — ein Board soll Aufgaben über mehrere Anwendungen führen können.
