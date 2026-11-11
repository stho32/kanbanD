---
id: R00118
status: Neu
datum: 2026-11-11
---

# R00118: Härtung der WIP-Grenze: Texte, Proben, Modell

## Beschreibung

Die Reviews der abgenommenen Karte #2 (R00096, WIP-Grenze für Agenten durchsetzen) ließen Sollte-, Kann- und Optional-Befunde übrig, die nach der Regel „Nacharbeit nur für Muss“ nicht mehr in R00096 selbst, sondern in die Härtungskarte #23 gesammelt wurden (Stand `dbd899b`). Diese Anforderung ist ihre Heimat.

Die Befunde sind keine neuen Muss-Fehler; sie sind Text-, Probe- und Modellpflege. Die WIP-Grenze ist gebaut (R00096, I0085, F0005–F0009, B0274–B0284, `tests/wip_grenze.rs`); die Härtung schließt die Lücken, die die Reviews von #2 sichtbar gemacht haben:

1. **Rechtschreib-Review (Sollte):** `src/web/openapi.rs` (Feld `fehler` im Schema `GrenzeErreicht`) sagt `immer „Grenze erreicht"` — das schließende Anführungszeichen ist ein gerades `"` statt eines deutschen `“`. Probe: `grep -n 'Grenze erreicht"$' src/web/openapi.rs` = 0.
2. **Rechtschreib-Review (Sollte):** `src/web/endpunkte.rs` und `src/web/openapi.rs` bei `bewegen`, `bewegen-mehrere` und `ziehen` schreiben `Warnung grenze „Grenze erreicht: „<Spalte>“ hat n von g“` — verschachtelte gleiche Anführungszeichen. Ziel: `Warnung grenze: Grenze erreicht: „<Spalte>“ hat n von g`. Probe: `grep -c '„Grenze erreicht: „' src/web/endpunkte.rs src/web/openapi.rs` = 0 je Datei.
3. **Rechtschreib-Review (Kann):** `POST /api/boards/{slug}/aufgaben` sagt „eine schon liegende Karte“ — Ziel: „eine schon liegende Aufgabe“. Probe: `grep -n 'schon liegende Karte' src/web/endpunkte.rs src/web/mod.rs` = 0.
4. **Code-Review (Optional):** `Zurückholen` überspringt defekte Board-Dateien (`zurueckholen_pruefen` liest `ordner().boards()?` und verwirft die Defekte-Liste); als Grenzfall in Aspekt X00001 nennen oder so lassen.
5. **Code-Review (Optional):** Der Test für zwei gleichzeitige Züge belegt das Ergebnis, nicht die Sperre selbst; der Test sollte die Sperre belegen (z. B. Halter zwischen Prüfung und Handlung, oder deterministischer Zwischenstand).
6. **Code-Review (Optional):** `src/dienst/zugregeln.rs:44` nutzt `crate::modell::Person` voll qualifiziert, obwohl `Person` importiert ist.
7. **Architektur-Review (Optional):** Die Probe „Aufruf vergessen“ (jede Dienst-Methode, die eine Board-Datei an `aktion()` gibt, ruft vorher die Grenzprüfung auf) ist zu breit formuliert; der Architekt hat sie verengt (15 Schreiber, 6 Karten bewegende Wege; Ausnahmeliste in X00001 fehlt).
8. **Architektur-Review (Optional):** ADR-0002 Option B nennt die alte Signatur; der gebaute Stand steht in X00001.
9. **Entwicklertest (Anmerkung):** 409 bei `bewegen-mehrere` nennt die Anzahl vor dem Zug; ein Agent sieht nicht, um wie viel er überzieht.
10. **Entwicklertest (Anmerkung):** Ziehen per Maus ohne gewählte Person öffnet „Ich bin …“; der Zug wird danach nicht ausgeführt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board“; die Grenze wirkt nur, wenn ihre Beschreibung, ihre Probe und ihr Modell so genau sind wie die Regel selbst.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Die WIP-Grenze ist die einzige Stelle, an der ein Agent den Takt der Fabrik nicht selbst bestimmt. Die Reviews von #2 haben fünf Stellen gefunden, an denen die Grenze zwar wirkt, aber ihre Beschreibung oder ihre Probe nicht mit ihr Schritt hält: ein gerades Anführungszeichen im Schema, verschachtelte Anführungszeichen in den Warnungen, „Karte“ statt „Aufgabe“ in der Beschreibung, ein übersprungener Grenzfall beim Zurückholen und ein Test, der die Sperre nicht selbst belegt. Jede einzelne Stelle ist klein; jede weitere Durchsicht, die sie findet, kostet einen Lauf. Eine Karte, die jede Stelle mit einer Probe schließt, macht die API-Beschreibung und die Wächter schärfer — und die nächste Durchsicht findet dieselbe Stelle nicht wieder.

## Funktionale Anforderungen

### Texte (Sollte und Kann)

1. **OpenAPI-Schema `GrenzeErreicht`**: `src/web/openapi.rs` Zeile 39 endet mit dem deutschen schließenden Anführungszeichen `“`; `grep -n 'Grenze erreicht"$' src/web/openapi.rs` liefert 0.
2. **Warnung `grenze` in `endpunkte.rs` und `openapi.rs`**: bei `bewegen`, `bewegen-mehrere` und `ziehen` steht `Warnung grenze: Grenze erreicht: „<Spalte>“ hat n von g`; keine verschachtelten gleichen Anführungszeichen. `grep -c '„Grenze erreicht: „' src/web/endpunkte.rs src/web/openapi.rs` liefert 0 je Datei.
3. **Beschreibung `POST /api/boards/{slug}/aufgaben`**: „eine schon liegende Aufgabe“ statt „eine schon liegende Karte“; `grep -n 'schon liegende Karte' src/web/endpunkte.rs src/web/mod.rs` liefert 0.

### Proben und Modell (Optional)

4. **`Zurückholen` und defekte Board-Dateien**: `zurueckholen_pruefen` liest `self.ordner().boards()?` und verwirft die Defekte-Liste. Der Grenzfall wird in X00001 als Abweichung genannt (oder die Ausnahme bleibt bewusst und wird dort begründet).
5. **Test für zwei gleichzeitige Züge**: Der Test belegt die Sperre selbst, nicht nur das Ergebnis. Deterministisch: ein Halter zwischen Prüfung und Handlung, oder ein Zwischenstand, der ohne Sperre zu einem anderen Ergebnis führt.
6. **`crate::modell::Person` in `src/dienst/zugregeln.rs:44`**: `Person` ist importiert; die voll qualifizierte Schreibweise wird auf `Person` verkürzt.
7. **Probe „Aufruf vergessen“**: X00001 nennt die verengte Formulierung (15 Schreiber, 6 Karten bewegende Wege) und die Ausnahmeliste; die Probe ist so formuliert, dass sie die Grenzprüfung vor `aktion()` prüft.
8. **ADR-0002 Option B**: nennt die alte Signatur; der gebaute Stand steht in X00001. Die Abweichung wird in X00001 benannt (oder ADR-0002 wird nachgezogen, falls der Architekt das entscheidet).

### Entwicklertest (Anmerkung)

9. **409 bei `bewegen-mehrere`**: nennt die Anzahl vor dem Zug, damit ein Agent sieht, um wie viel er überzieht.
10. **Ziehen per Maus ohne gewählte Person**: öffnet „Ich bin …“ und führt den Zug nicht aus; nach der Wahl wird der Zug nicht automatisch nachgeholt.

## Nicht-funktionale Anforderungen

- **Rückwärtskompatibel**: Die Antwortform der 409 (`{fehler, spalte, grenze, anzahl}`) und die Warnungen (`{pruefung: "grenze", text, knoten, details}`) bleiben unverändert; die Härtung ändert nur Texte, Proben und Modell.
- **Keine neue Abweisung**: Kein neuer Fehler, keine neue 409, keine neue Sperre; die Härtung schärft nur die bestehenden.
- **Kein Commit**: Die WBS-Änderung ist ein API-Commit; der Projekt-Commit für Anforderung/User Stories.

## Akzeptanzkriterien

Gegeben für jede Probe: der Stand nach #2 (`dbd899b`); die WBS-Knoten `I0108` (rot) und `B1–B10` (rot).

### Texte (Sollte und Kann)

- [ ] **1. `grep -n 'Grenze erreicht"$' src/web/openapi.rs` = 0**; `openapi.rs` Zeile 39 endet mit `„Grenze erreicht“`.
  - Prüfebene: `grep` (Code) + `tests/openapi.rs` (OpenAPI-Beschreibung).
- [ ] **2. `grep -c '„Grenze erreicht: „' src/web/endpunkte.rs src/web/openapi.rs` = 0 je Datei**; die Warnung steht in `Warnung grenze: Grenze erreicht: „<Spalte>“ hat n von g`.
  - Prüfebene: `grep` + `tests/openapi.rs` (Warnungstext) + `tests/wip_grenze.rs` (Warnungstext).
- [ ] **3. `grep -n 'schon liegende Karte' src/web/endpunkte.rs src/web/mod.rs` = 0**; die Beschreibung sagt „eine schon liegende Aufgabe“.
  - Prüfebene: `grep` + `tests/openapi.rs` (Beschreibung).

### Proben und Modell (Optional)

- [ ] **4. `Zurückholen`**: X00001 nennt den Grenzfall „defekte Board-Dateien“ (Abweichung) oder begründet die Ausnahme; `tests/wip_grenze.rs` prüft den Fall (defekte Board-Datei, `Zurückholen` verhält sich wie beschrieben).
  - Prüfebene: `X00001` + `tests/wip_grenze.rs`.
- [ ] **5. Test für zwei gleichzeitige Züge**: Der Test belegt die Sperre selbst; ohne Sperre ist der Test rot (deterministischer Halter oder Zwischenstand).
  - Prüfebene: `tests/wip_grenze.rs` (Mutationsprobe).
- [ ] **6. `crate::modell::Person` in `src/dienst/zugregeln.rs:44`**: `grep -n 'crate::modell::Person' src/dienst/zugregeln.rs` = 0 (oder nur der Import); `cargo test` grün.
  - Prüfebene: `grep` + `cargo test`.
- [ ] **7. Probe „Aufruf vergessen“**: X00001 nennt die verengte Formulierung (15 Schreiber, 6 Karten bewegende Wege) und die Ausnahmeliste; die Probe ist ausführbar.
  - Prüfebene: `X00001` + Probe.
- [ ] **8. ADR-0002 Option B**: X00001 nennt die alte Signatur; der gebaute Stand ist dort beschrieben.
  - Prüfebene: `X00001` + `ADR-0002`.

### Entwicklertest (Anmerkung)

- [ ] **9. 409 bei `bewegen-mehrere`**: Der Rumpf nennt `anzahl` vor dem Zug; `tests/wip_grenze.rs` prüft `anzahl` bei `bewegen-mehrere`.
  - Prüfebene: `tests/wip_grenze.rs`.
- [ ] **10. Ziehen per Maus ohne gewählte Person**: Der Zug öffnet „Ich bin …“; der Zug wird nicht ausgeführt; nach der Wahl wird er nicht automatisch nachgeholt.
  - Prüfebene: `e2e/tests/r00096-ziehen.spec.js` (oder `r00118`).

## Betroffene Verzeichnisstruktur

```
src/
├── web/
│   ├── openapi.rs        # GrenzeErreicht: schließendes Anführungszeichen; Warnungstext
│   └── endpunkte.rs      # Warnungstext; Beschreibung „Aufgabe“ statt „Karte“
└── dienst/
    └── zugregeln.rs      # crate::modell::Person; Zurückholen-Prüfung
Dokumentation/
└── Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md   # Grenzfall, Ausnahmeliste, ADR-0002
tests/
└── wip_grenze.rs         # Test für zwei gleichzeitige Züge; 409 anzahl
e2e/
└── tests/                # Ziehen per Maus ohne gewählte Person
```

## Technische Überlegungen

### Optionen (nicht-trivial: die Heimat der Härtung)

| | A: eigene Interaction I0108 unter D0002 | B: Bubbles an I0085 | C: eigene Interaction I0108 unter D0007 |
|---|---|---|---|
| Abnahme von I0085 | bleibt geschlossen | öffnet sich wieder („alle AK erfüllt“) | bleibt geschlossen |
| WBS-Heimat | Board (D0002) | Agenten-Schnittstelle (D0007) | Agenten-Schnittstelle (D0007) |
| Wiederverwendung | WIP-Grenze ist ein Board-/Spaltenbegriff | WIP-Grenze ist ein Agentenbegriff | WIP-Grenze ist ein Agentenbegriff |
| Muster | I0106 (Härtung der Kopfzeile, D0002) | I0107 (Härtung an I0009) | I0106 (Härtung der Kopfzeile, D0002) |

**Entscheidung: A.** Die Härtungsregel aus `AI-Team/gelerntes.md` (2026-11-11) sagt: eine Härtungskarte bekommt eine eigene Interaction mit eigener Anforderung, weil die abgenommene I0085 sonst wieder öffnet. Die WIP-Grenze ist ein Board-/Spaltenbegriff (Grenze einer Spalte, `limits`), deshalb D0002 (Board) wie die Härtung I0106 (Kopfzeile). C wäre die zweite Wahl, weil die WIP-Grenze an der Agenten-Schnittstelle wirkt; die WBS führt die WIP-Grenze aber unter D0007, weil die Durchsetzung dort liegt. D0002 ist die Heimat, weil die Befunde (Grenze, Spalte, Warnung) Board-Begriffe sind; die Abweichung zu I0085 (D0007) wird in der Notiz genannt.

### Ablauf (den Zuschnitt entscheidet der Entwickler)

1. **Texte**: `openapi.rs` (GrenzeErreicht), `endpunkte.rs`/`openapi.rs` (Warnung), `endpunkte.rs`/`mod.rs` („Aufgabe“).
2. **Proben**: `Zurückholen` in X00001; Test für zwei gleichzeitige Züge; `crate::modell::Person`; Probe „Aufruf vergessen“; ADR-0002.
3. **Entwicklertest**: 409 anzahl; Ziehen ohne Person.

### Wächter

`tests/wip_grenze.rs`, `tests/openapi.rs`, `tests/aufgaben.rs`, `tests/spalten.rs`, `tests/erledigen.rs`, `e2e/tests/r00096-ziehen.spec.js`; die Probe „Aufruf vergessen“ als neuer `grep`-Wächter.

## Tests

Nach Skill `test-pyramide`; jede Probe prüft eine sichtbare Zustandsänderung (Skill `test-ehrlichkeit`).

- **Unit**: `grep`-Proben (Texte, `crate::modell::Person`), `tests/openapi.rs` (Schema, Beschreibung).
- **Integration**: `tests/wip_grenze.rs` (Warnung, `anzahl`, `Zurückholen`), `tests/aufgaben.rs`, `tests/spalten.rs`.
- **E2E**: `e2e/tests/r00096-ziehen.spec.js` (Ziehen per Maus ohne Person).
- **Rot vor dem Bau**: Die Texte 1–3 sind heute rot (grep 1 bzw. 4 bzw. 1); `crate::modell::Person` ist rot; `Zurückholen` ist rot (Defekte-Liste wird verworfen); der Test für zwei gleichzeitige Züge ist rot (nur Ergebnis, nicht Sperre); die Probe „Aufruf vergessen“ ist rot (keine Ausnahmeliste); ADR-0002 ist rot (alte Signatur).
- **Gegenproben (Mutanten)**: `openapi.rs` mit `"` wieder → 1 rot; `Warnung grenze „` wieder → 2 rot; „Karte“ wieder → 3 rot; `Zurückholen` ohne Defekte-Liste → 4 rot; `crate::modell::Person` wieder → 6 rot; `Aufruf vergessen` ohne Ausnahmeliste → 7 rot; `ADR-0002` alte Signatur → 8 rot; `anzahl` entfernt → 9 rot; `Ziehen` ohne Person → 10 rot.
- **Mitlaufend grün**: `tests/wip_grenze.rs`, `tests/openapi.rs`, `tests/aufgaben.rs`, `tests/spalten.rs`, `tests/erledigen.rs`, `e2e/tests/r00096-ziehen.spec.js`.

## Abhängigkeiten

- R00096 (WIP-Grenze, I0085), ADR-0002 (Zugregeln), ADR-0003 (Abweisungen), X00001 (Schreibweg und Regeln an Zügen), R00102 (Spalteneinstellungen), R00118 (diese Anforderung).
- Abgegrenzt, nicht Teil dieser Anforderung: neue Muss-Fehler (die gehören in die Nacharbeit), neue Grenzen (R00097), neue Abweisungen (R00098/R00099).

## Offene Fragen

- Keine blockierende. Die Heimat ist D0002 (Board) mit eigener Interaction I0108; die Abweichung zu I0085 (D0007) wird in der Notiz genannt. Der Architekt hat bestanden (keine Technikfrage, kein ADR; ADR-0002 bleibt bestätigt).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — die WBS-Änderung ist ein API-Commit; der Projekt-Commit für Anforderung/User Stories.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser sind die Sollte-/Kann-/Optional-Befunde der Reviews von #2. Die WIP-Grenze wirkt, aber ihre Beschreibung, ihre Probe und ihr Modell halten nicht mit: ein gerades Anführungszeichen im Schema, verschachtelte Anführungszeichen in den Warnungen, „Karte“ statt „Aufgabe“, ein übersprungener Grenzfall beim Zurückholen, ein Test, der die Sperre nicht selbst belegt, eine voll qualifizierte Schreibweise, eine zu breite Probe und eine veraltete ADR-Signatur. Jede Stelle ist klein; jede weitere Durchsicht, die sie findet, kostet einen Lauf. Indem jede Stelle eine eigene, wörtlich gefasste Probe bekommt (grep = 0, Test belegt die Sperre, Ausnahmeliste in X00001, ADR-0002 nachgezogen), fällt dieselbe Stelle künftig durch einen Lauf, nicht erst durch die nächste Durchsicht. Das ist dieselbe Wirkungskette wie bei der Vorbildkarte #17 (I0106/R00117): ein Befund wird zur Probe, die Probe zum Wächter.

## Missing-Docs

- Keine neue Architektur-Regel; X00001 nennt den Grenzfall und die Ausnahmeliste; ADR-0002 bleibt bestätigt (Schnitt unverändert).

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene Interaction I0108 unter D0002 (Board), mit eigener Anforderung R00118. Muster: I0106 (Härtung der Kopfzeile, D0002) und I0107 (Härtung an I0009, D0002). Verworfen: Bubbles an I0085 (D0007) hängen — I0085 ist abgenommen (gruen), ein neuer roter Nachfahre öffnete ihre Abnahme wieder (Härtungsregel `AI-Team/gelerntes.md`, 2026-11-11). Die WIP-Grenze ist ein Board-/Spaltenbegriff; die Durchsetzung liegt in D0007, die Befunde (Grenze, Spalte, Warnung) sind aber Board-Begriffe. Die Abweichung zu I0085 (D0007) wird hier genannt.
- **Elterndialog D0002**: die WIP-Grenze ist eine Spalteneigenschaft (`limits`), die Warnung erscheint auf dem Board, die Texte stehen in der API-Beschreibung; der Board-Dialog ist die Heimat. I0085 (D0007) bleibt unberührt.
- **Keine neue User Story**: Die Befunde sind Text/Probe/Modell; die Abnahme läuft über die API-Texte und die Proben (`grep` = 0, `tests/wip_grenze.rs`, `tests/openapi.rs`, X00001). Eine User Story wäre eine neue Erzählung ohne neuen Nutzer; die Härtung ist eine Probe, keine neue Fähigkeit.
- **Einarbeitung Architektur (2026-11-11, bestanden, kein ADR)**: keine Technikfrage; ADR-0002 bleibt bestätigt (Schnitt unverändert); eigene Interaction/Anforderung für die Härtung anlegen. Die Befunde sind Text/Probe/Modellpflege; die Probe „Aufruf vergessen“ ist zu breit formuliert (15 Schreiber, 6 Karten bewegende Wege; Ausnahmeliste in X00001 fehlt); ADR-0002 Option B nennt die alte Signatur, der gebaute Stand steht in X00001.
- **Herkunft**: `kd:I0085` (Karte #23); die Härtung ist die Heimat der Sollte-/Kann-/Optional-Befunde aus #2.
