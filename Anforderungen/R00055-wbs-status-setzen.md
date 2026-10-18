---
id: R00055
status: Neu
datum: 2026-10-18
---

# R00055: WBS-Status setzen

## Beschreibung

In der WBS-Sicht und über die API lässt sich der Status eines Blattknotens (Bubble, Feature ohne Kinder, Interaction ohne Kinder) auf `rot`, `gelb` oder `gruen` setzen. kanbanD schreibt die Zeile in der WBS-Datei im Arbeits-Repository, rechnet die Status aller Vorfahren neu, schreibt sie mit und setzt `zuletzt` im Frontmatter — wie es `/planung` vorschreibt. Im Arbeits-Repository committet kanbanD **nicht**; das tut, wer dort arbeitet.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die WBS als Stand“, Nicht-Ziel „Kein Git-Client“ (kein Commit im Repository einer Anwendung).

## Geschäftlicher Nutzen

Die KI und der Mensch setzen den Stand an einem Ort, der für alle sofort sichtbar ist. Das `gruen` landet mit dem nächsten Commit im Arbeits-Repository, in der Regel im selben Commit wie der Code der Bubble, und bleibt so belastbares Datum für Auswertungen.

## Funktionale Anforderungen

- `PATCH /api/wbs/<kürzel>/knoten/<id> {status}` mit `status` ∈ `rot | gelb | gruen`; Identität Pflicht (`X-KanbanD-Wer`).
- Nur Blätter: ein Knoten mit zählenden Kindern → 409 „Status wird gerechnet“; `option`, `ausbau`, `verworfen`, `bestehend` sind hier nicht setzbar → 400.
- Geschrieben wird nur die Zelle `Status` der betroffenen Zeilen und `zuletzt`; alle anderen Bytes der Datei bleiben unverändert.
- Gleichzeitige Schreibzugriffe auf dieselbe WBS-Datei werden nacheinander ausgeführt (wie bei Board-Dateien).
- Ist die WBS-Datei defekt (Konfliktmarker, keine Knotentabelle) → 409, nichts wird geschrieben.
- Kein Commit im Arbeits-Repository. Im Board-Repository entsteht ebenfalls kein Commit, denn dort ändert sich nichts.
- In der Sicht: Klick auf die Status-Plakette eines Blatts öffnet die Wahl `rot · gelb · gruen`; ohne Identität „Ich bin …“.

## Akzeptanzkriterien

### Schreiben
- [ ] `I0002` mit Bubbles `B0001 gruen`, `B0002 rot`; `PATCH B0002 {status: gruen}` → Datei: `B0002 | … | gruen`, `I0002` und ihr Dialog `gruen`, wenn alle übrigen Geschwister grün sind; `zuletzt: <heute>`
- [ ] `git diff` im Arbeits-Repository zeigt nur die Status-Zellen und `zuletzt`; `git log` im Arbeits-Repository ist unverändert
- [ ] `PATCH I0002 {status: rot}` bei vorhandenen Bubbles → 409; `PATCH B0002 {status: option}` → 400

### Sicht
- [ ] Bubble per Klick auf `gelb` → Zeile gelb, Kopf „nicht committet“

## Betroffene Verzeichnisstruktur

`src/wbs.rs` (Zeile ändern und Vorfahren rechnen, pure), `src/dienst/wbs.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/wbs.js`; Tests `tests/wbs_schreiben.rs`, `e2e/tests/r00055-wbs-status.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `fn status_setzen(text: &str, id: &str, status: Bauzustand, heute: NaiveDate) -> Result<String, WbsFehler>` (pure; schreibt Blatt, Vorfahren, `zuletzt`)
- `Kanban::wbs_status_setzen(wer, kuerzel, id, status)` (Integration; Sperre, Lesen, Schreiben, Ereignis)

## Tests
- Unit: Vorfahren-Rechnung über drei Ebenen, Byte-Treue außerhalb der Zellen, Ablehnungen
- Integration: Temp-Arbeits-Repository, kein neuer Commit, parallele Anfragen
- E2E: Status per Klick

## Abhängigkeiten
- Abhängig von: R00054
- Blockiert: R00059

## Offene Fragen
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Die KI pflegt den Bubble-Status heute durch Lesen und Umschreiben der Tabelle und muss die Vorfahren selbst nachrechnen; das ist fehleranfällig und kostet bei jedem Bubble Kontext. Wenn kanbanD das Setzen eines Blatts als eine Operation anbietet und die Vorfahren nach der Regel des Skills rechnet, schreibt die KI genau eine Angabe, und der gerechnete Rest stimmt immer. Weil kanbanD im Arbeits-Repository nicht committet, bleibt die Commit-Hoheit dort, wo der Code entsteht, und das Datum des ersten `gruen` liegt im Commit der Bubble.

## Notizen

- Verworfen: Commit im Arbeits-Repository unter dem Namen der handelnden Person — kanbanD committet laut Vision nur im eigenen Repository.
