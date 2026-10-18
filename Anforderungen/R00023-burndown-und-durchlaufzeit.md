---
id: R00023
status: Neu
datum: 2026-10-18
---

# R00023: Burndown und Durchlaufzeit

## Beschreibung

Weil jede Bewegung ein Commit der Board-Datei ist, lässt sich der Verlauf eines Boards aus Git rechnen: je Kalendertag die Zahl der offenen Aufgaben (nicht in der Abschlussspalte) und der Umfang (alle Aufgaben auf dem Board), dazu je abgeschlossener Aufgabe die Durchlaufzeit vom ersten Erscheinen auf dem Board bis zum ersten Erreichen der Abschlussspalte. Der Bericht „Burndown und Durchlaufzeit“ zeigt beides.

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen aus der Geschichte“, „Git ist das Gedächtnis“.

## Geschäftlicher Nutzen

Fortschritt und Tempo sind messbar, ohne dass jemand etwas zusätzlich erfasst.

## Funktionale Anforderungen

- Quelle: alle Commits, die `boards/<slug>.md` ändern, in zeitlicher Folge; der Stand eines Tages ist der letzte Stand bis Tagesende (Ortszeit).
- Tage vom Tag des ersten Stands bis heute, auch ohne Commit (Stand des Vortags gilt weiter).
- Durchlaufzeit in Tagen (eine Nachkommastelle) = erster Stand in der Abschlussspalte − erster Stand auf dem Board; Mittel und Median über alle abgeschlossenen.
- Spätere Rückkehr aus der Abschlussspalte ändert die erste Abschlusszeit nicht.
- `GET /api/berichte/verlauf?board=<slug>` liefert `{tage: [{datum, offen, umfang}], durchlauf: [{nummer, eintritt, abschluss, tage}], mittel, median}`; unbekanntes Board → 404; ein noch nicht committetes Board liefert nur den heutigen Stand.
- Bericht: Linie „offen“ (Akzentfarbe) und gestrichelte Bezugslinie „Umfang“, Legende, Werte am Linienende, Tooltip je Tag, Tabelle der Durchlaufzeiten (neueste zuerst) mit Mittel und Median, aufklappbare Tabellenansicht der Tage.

## Akzeptanzkriterien

- [ ] Stände: Tag 1 `A: 1,2`; Tag 2 `A: 2 · Z: 1`; Tag 4 `Z: 1,2` → offen 2, 1, 1, 0; Umfang 2, 2, 2, 2; Durchlauf #1 = 1,0 Tage, #2 = 3,0 Tage; Mittel 2,0; Median 2,0
- [ ] Rückkehr von #1 aus Z an Tag 3 ändert seine Durchlaufzeit nicht
- [ ] API gegen ein echtes Repository mit drei Bewegungs-Commits liefert dieselben Zahlen wie die reine Rechnung
- [ ] Oberfläche: Bericht zeigt die Linie mit Endwert und die Durchlauftabelle

## Betroffene Verzeichnisstruktur

`src/verlauf.rs` (pure), `src/git.rs` (Stände lesen), `src/web/mod.rs`, `web/`; Tests in den Modulen, `tests/verlauf.rs`, `e2e/tests/r00023-verlauf.spec.js`.

## Technische Überlegungen

### Grobentwurf
- `verlauf(&[(NaiveDateTime, Board)], heute) -> Verlauf` (pure)
- `git::staende(wurzel, rel_pfad) -> Vec<(NaiveDateTime, String)>` (Operation: `git log`, `git cat-file --batch`)

## Tests
- Unit: Rechnung mit Lücken und Rückkehr
- Integration: Commits mit gesetztem Datum, API
- E2E: Bericht

## Abhängigkeiten
- Abhängig von: R00006

## Offene Fragen
