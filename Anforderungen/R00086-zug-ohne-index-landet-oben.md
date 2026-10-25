---
id: R00086
status: Erledigt
datum: 2026-10-25
---

# R00086: Zug ohne Index landet oben

## Beschreibung

`POST /api/boards/{slug}/bewegen` und `…/bewegen-mehrere` hängen eine Karte ohne `index` heute unten an; Agenten senden mal keinen Index, mal `index: 0`, deshalb landet eine Karte nach einem KI-Zug mal oben, mal unten. Künftig setzt ein Zug ohne Index die Karte **oben** in die Zielspalte. Ein ausdrücklicher Index gilt wie bisher. Das erledigt zugleich den Wunsch, Vorrang-Karten nach einem Zug oben zu sehen.

Zahlt ein auf: [Vision](R00000-vision.md) — Mensch und Agent auf einem gemeinsamen Board.

## Geschäftlicher Nutzen

Eine eindeutige Regel im Server: wer einem Agenten zusieht, findet die gerade bewegte Karte immer oben.

## Funktionale Anforderungen

- `bewegen` ohne `index`: Karte an Position 0 der Zielspalte; mit `index`: wie bisher (zu groß → ans Ende).
- `bewegen-mehrere` ohne `index`: die Karten stehen oben in der Reihenfolge der Anfrage (erste genannte ganz oben).
- Gilt auch für ein Umsortieren innerhalb derselben Spalte ohne Index (Karte geht nach oben).
- Die bewusste Folge ist LIFO: Arbeitsreihenfolge = sichtbare Reihenfolge von oben (siehe R00087 `ziehen`).
- Die Oberfläche sendet beim Ziehen mit der Maus und bei Tastaturzügen weiter einen ausdrücklichen Index; ihr Verhalten ändert sich nicht.
- API-Beschreibung (`/api`, `/api/endpunkte`) nennt die Regel.

## Akzeptanzkriterien

- [x] Spalte B = [5, 6]; `bewegen {nummer: 7, spalte: B}` → B = [7, 5, 6]
- [x] `bewegen {nummer: 7, spalte: B, index: 99}` → B = [5, 6, 7]
- [x] `bewegen-mehrere [{7,B},{8,B}]` ohne Index, B = [5] → B = [7, 8, 5]
- [x] Umsortieren in derselben Spalte ohne Index: A = [1, 2, 3], `bewegen {nummer: 3, spalte: A}` → A = [3, 1, 2]
- [x] Die Oberfläche: Karte mit der Maus ans Ende gezogen landet am Ende (E2E bleibt grün)

## Betroffene Verzeichnisstruktur

`src/modell/board.rs` (`bewegen`, `mehrere_bewegen`), `src/dienst/bewegen.rs`, `src/web/endpunkte.rs`; Tests in `src/modell/board.rs`, `tests/`.

## Technische Überlegungen

`index.unwrap_or(0)` statt `unwrap_or(len)`; in `mehrere_bewegen` ohne Index die Einfügeposition je Zielspalte mitzählen (0, 1, 2 …), damit die Anfragereihenfolge erhalten bleibt. `Dienst::mehrere_bewegen` reicht `Option<usize>` durch statt `usize::MAX`.

## Tests
**Unit:** `Board::bewegen`, `Board::mehrere_bewegen`. **Integration:** API-Aufrufe mit und ohne Index. **E2E:** bestehende Zug-Tests bleiben grün.

## Abhängigkeiten
- Abhängig von: R00006, R00065
- Blockiert: R00087

## Offene Fragen
- keine — „oben, bewusst LIFO“ entschieden am 2026-10-25 (Feedback-Runde Punkte 1, 2)

## Notizen
### Verworfene Alternativen
- Nach Klasse einsortieren (Vorrang oben, sonst unten): mehr Regeln, als gebraucht werden.
- Unten anhängen (FIFO): vom Nutzer bewusst verworfen; neue Karten sollen sichtbar oben stehen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Regel beim Aufrufer → jeder Agent macht es anders → Karten landen mal oben, mal unten. Regel im Server → ohne Index immer oben → das Ergebnis eines Zuges ist vorhersagbar, egal wer zieht.
