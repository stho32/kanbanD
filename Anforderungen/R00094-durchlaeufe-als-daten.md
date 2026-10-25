---
id: R00094
status: In Arbeit
datum: 2026-10-25
---

# R00094: Durchläufe als Daten

## Beschreibung

Wenn ein Agent oder Mensch eine Phase für eine Karte abschließt (Entwicklung bestanden, Code-Review mit Befund …), steht das heute nur als Freitext-Kommentar („Entwicklung bestanden (entw, 103 min …)“). Künftig hält die Karte **Durchläufe** als strukturierte Daten — Zeitpunkt, Phase, Ergebnis, Wer, Dauer, Text — in einem eigenen Block der Aufgabendatei; angelegt über die API, sichtbar im Aufgaben-Detail. Die Auswertung (z. B. Befunde je Phase und Rolle) folgt später.

Zahlt ein auf: [Vision](R00000-vision.md) — Git als vollständiges Gedächtnis: wer wann was getan hat.

## Geschäftlicher Nutzen

Durchläufe werden auswertbar: wie oft eine Phase Befunde liefert, welche Rolle wie lange braucht — Grundlage für spätere Berichte, ohne Freitext zu parsen.

## Funktionale Anforderungen

- Block `kanbanD-runs` in der Aufgabendatei, eine Zeile je Durchlauf: `<zeitpunkt> · <phase> · <ergebnis> · <wer> · <dauer h:mm oder -> · <text>`; der Text ist der Rest der Zeile (darf ` · ` enthalten, keine Zeilenumbrüche — Umbrüche werden zu Leerzeichen).
- `ergebnis` ∈ `bestanden | befund | entfaellt`.
- `POST /api/aufgaben/{nr}/durchlaeufe {phase, ergebnis, dauer?, text?, wer?}` (braucht Wer): Zeitpunkt jetzt mit Versatz (R00084); `phase` 1–40 Zeichen, nicht leer; `dauer` im Format von `dauer_lesen`; `wer` wie in R00090 (Standard: handelnde Person); Antwort die Aufgabe.
- Zugleich entsteht ein Kommentar „<Phase> <ergebnis> (<wer>, <dauer>): <text>“, damit Menschen den Durchlauf im Verlauf lesen wie bisher — derselbe Commit.
- Die Aufgabe in der API trägt `durchlaeufe: [{zeitpunkt, phase, ergebnis, wer, dauer_minuten?, text}]`.
- Aufgaben-Detail: Abschnitt „Durchläufe“ als Tabelle (Datum, Phase, Ergebnis farbig, Wer, Dauer, Text), neueste oben; ohne Durchläufe kein Abschnitt.
- Unbekannte Zeilen im Block bleiben beim Rundlauf erhalten.

## Akzeptanzkriterien

- [ ] `POST …/durchlaeufe {phase: "Entwicklung", ergebnis: "bestanden", dauer: "1:43", text: "Gate grün", wer: "entw"}` → Zeile `… · Entwicklung · bestanden · entw · 1:43 · Gate grün` im Block und Kommentar „Entwicklung bestanden (entw, 1:43): Gate grün“, ein Commit
- [ ] `ergebnis: "ok"` → `400`; `phase: ""` → `400`; `dauer: "x"` → `400`
- [ ] Text mit ` · ` und Zeilenumbruch → Rundlauf liefert denselben Text (Umbruch als Leerzeichen)
- [ ] Rundlauf lesen → schreiben ohne Änderung ist verlustfrei
- [ ] Detail zeigt die Tabelle mit „befund“ in Warnfarbe

## Betroffene Verzeichnisstruktur

`src/modell/aufgabe.rs` (`Durchlauf`), `src/format/aufgabe.rs` (Block lesen/schreiben), `src/dienst/durchlaeufe.rs` (neu), `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/ansicht.js`, `web/kd-app.css`; Tests `tests/`, `e2e/tests/r00094-durchlaeufe.spec.js`.

## Technische Überlegungen

- Blockformat analog `kanbanD-time` (`TRENNER`), Text als letztes Feld per `splitn(6, " · ")`.
- `Durchlauf` (DTO, immutable) — `zeitpunkt`, `phase`, `ergebnis: Ergebnis`, `wer`, `dauer_minuten: Option<i64>`, `text`.
- `Ergebnis` (Enum, serde `bestanden|befund|entfaellt`).

## Tests
**Unit:** Zeile lesen/schreiben (Rundlauf, Text mit Trenner). **Integration:** API-Kriterien. **E2E:** Tabelle im Detail.

## Abhängigkeiten
- Abhängig von: R00013, R00084, R00090 (`wer` für andere Person)
- Blockiert: R00093

## Offene Fragen
- keine — „Block an der Karte, Auswertung später“ entschieden am 2026-10-25 (Feedback-Runde Punkt 15)

## Manuelle Nachbereitungstätigkeiten
- Agenten-Rollen und `kanband.py` können Durchläufe künftig über den Endpunkt eintragen (eigene Anpassung außerhalb dieses Repos).

## Notizen
### Verworfene Alternativen
- Gleich mit Bericht „Befunde je Phase und Rolle“: erst Daten sammeln.
- Aus den Zügen ableiten: Wer und Dauer bleiben ungenau.

## Warum löst diese Anforderung das Problem? (Pflicht)

Durchlauf nur als Freitext → nicht auswertbar, jedes Skript parst anders. Strukturierter Block mit eigenem Endpunkt → Phase, Ergebnis, Wer und Dauer sind Daten → Auswertungen zählen sie direkt; der begleitende Kommentar hält die Lesbarkeit für Menschen.
