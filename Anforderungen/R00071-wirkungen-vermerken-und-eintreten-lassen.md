---
id: R00071
status: Erledigt
datum: 2026-10-20
---

# R00071: Wirkungen vermerken und eintreten lassen

## Beschreibung

Bisher führt `PATCH /api/aufgaben/{nr}/wbs-effects` jede Wirkung sofort aus (R00057). Damit lässt sich eine Karte nicht an einen bestehenden, schon gebauten Knoten binden: Für einen vorhandenen Knoten passt nur `rework`, und das setzt ihn samt Teilbaum auf rot. Wer einen Bestand nachträglich an eine WBS bindet (JoinPuya: 85 Karten, 43 davon grün), löscht so den Stand der WBS.

Künftig sind **Vermerken** und **Eintreten** getrennt:

- **Vermerken** hängt die Wirkung an die Aufgabe; die WBS bleibt unberührt. Die Bindung gilt sofort: Die WBS-Sicht zeigt die Karte am Knoten, `wbs-effects-green` prüft den Knoten, Karte und Fenster zeigen den Chip.
- **Eintritt** ist je Wirkung ein Schalter, den jede Person aus `kanbanD.md` bedienen kann, Mensch wie Agent, im Aufgabenfenster und über die API gleichermaßen; der Commit nennt, wer geschaltet hat.
  - Einschalten führt die Wirkung aus: `create` legt den Knoten an, `rework` setzt den Teilbaum auf rot, `remove` verwirft den Knoten.
  - Ausschalten macht rückgängig, wo es eindeutig geht: `create` verwirft den angelegten Knoten, `remove` hebt das Verwerfen auf (Blätter stehen danach auf rot, die oberen Knoten werden gerechnet, der Grund verschwindet aus der Notiz), `rework` nimmt nur den Vermerk zurück und lässt die Status, wie sie sind.
- **Ob eine Wirkung eingetreten ist**, wird gerechnet, wo die WBS es zeigt, und sonst vermerkt:
  - `create`: eingetreten, wenn der angelegte Knoten in der WBS steht und nicht verworfen ist.
  - `remove`: eingetreten, wenn der Knoten verworfen ist oder fehlt.
  - `rework`: eingetreten, wenn die Wirkung `executed: <Datum>` trägt. Eine Wirkung ohne `executed` stammt aus der Zeit vor R00071 und gilt als eingetreten, `executed: false` als nicht eingetreten.

Im Aufgabenfenster trägt jeder Chip eine Ampel (rot = nicht eingetreten, grün = eingetreten, grau = WBS nicht erreichbar) und den Schalter.

Die Herkunft (`origins`) bleibt, was sie ist — woher eine Karte stammt — und wird nicht zur Bindung; sonst gäbe es zwei Wege, eine Karte an einen Knoten zu binden.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die WBS als Stand, die Aufgaben als Fortschritt“.

## Geschäftlicher Nutzen

Bestehende Arbeit lässt sich anbinden, ohne ihren Stand zu verlieren; Mensch und KI sehen und steuern, welche Änderung an der WBS schon gegriffen hat.

## Funktionale Anforderungen

- `PATCH /api/aufgaben/{nr}/wbs-effects`: vermerkt nur, schreibt `executed: false`, keine Änderung an der WBS; geprüft wird gegen die WBS (Knoten bei rework/remove vorhanden, Angaben zum neuen Knoten bei create gültig, sonst 409/400). Dieselbe Wirkung auf denselben Knoten ein zweites Mal: keine zweite Zeile, kein Commit.
- `GET /api/aufgaben/{nr}/wbs-effects` → `[{i, application, action, node?, …, executed, eingetreten: true|false|null}]`, `null` heißt WBS nicht erreichbar oder Knoten unbekannt.
- `POST /api/aufgaben/{nr}/wbs-effects/{i}/eintritt {an: true|false}`: schaltet; schon im Zielzustand → 200 ohne Änderung; ein Commit im Board-Repository, die WBS ohne Commit wie bisher. `create` bekommt beim Einschalten die vergebene ID; nach dem Ausschalten bleibt sie stehen, ein erneutes Einschalten legt einen neuen Knoten an.
- `wbs_datei::wiederherstellen` hebt ein Verwerfen auf; ein nicht verworfener Knoten ist 409.
- Aufgabenfenster: Chip mit Ampel, Schalter „eingetreten“ je Wirkung, „+ Wirkung“ vermerkt nur.

## Akzeptanzkriterien

- [x] Eine `rework`-Wirkung auf einen grünen Knoten vermerken: Der Knoten bleibt grün, die Karte erscheint in der WBS-Sicht am Knoten, die Ampel ist rot
- [x] Einschalten setzt den Teilbaum auf rot und vermerkt `executed: <heute>`, Ausschalten nimmt nur den Vermerk zurück
- [x] `remove` einschalten verwirft, ausschalten hebt das Verwerfen auf; die Ampel folgt der WBS, auch nach einer Änderung von Hand
- [x] `create` einschalten legt den Knoten an und trägt die ID ein, ausschalten verwirft ihn
- [x] API und Aufgabenfenster bieten dasselbe: vermerken, Stand lesen, schalten
- [x] Wirkungen aus der Zeit vor R00071 (ohne `executed`) gelten als eingetreten

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs`, `src/format/aufgabe.rs`, `src/dienst/wirkungen.rs`, `src/dienst/wbs.rs`, `src/wbs_datei.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`; `web/ansicht.js`, `web/app.js`, `web/wbs.js`, `web/kd-app.css`; Tests `tests/wirkungen.rs`, `e2e/tests/r00057-wirkungen.spec.js`, `e2e/tests/r00071-wirkung-eintritt.spec.js`.

## Abhängigkeiten
- Abhängig von: R00056, R00057, R00059
- Ergänzt R00057: die dort verworfenen Optionen „Wirkung erst bei Spaltenwechseln“ und „reiner Verweis ohne Ausführung“ bleiben verworfen — der Eintritt geschieht ausdrücklich über den Schalter, nicht über Spaltenwechsel, und eine vermerkte Wirkung ist kein reiner Verweis, weil ihr Eintritt sichtbar und schaltbar ist.

## Offene Fragen
- keine
