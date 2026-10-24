---
id: R00078
status: Erledigt
datum: 2026-10-24
---

# R00078: Projekt-Fever-Chart

## Beschreibung

Ein neuer Bericht „Projekt-Fever-Chart“ zeigt für **ein** Board das Fieberdiagramm nach Critical Chain Project Management: je Tag einen Punkt mit dem **Fortschritt** (x, Anteil erledigter Aufgaben) und dem **Pufferverbrauch** (y), vor drei schräg begrenzten Zonen grün, gelb und rot (über 100 % schwarz). Die Punkte sind chronologisch zur Bahn verbunden; der heutige ist groß und beschriftet.

Grundlage ist der Forecast aus „Wie lange noch“ (R00046): für jeden Tag seit dem Projektstart wird gerechnet, wann das Board mit dem Wissen dieses Tages fertig geworden wäre. Was dieses Ende über das geplante Ende des Arbeitsbereichs hinausschiebt, ist verbrauchter Puffer.

- **Projektstart** ist eine Einstellung des Boards (ohne Eintrag: der Tag, an dem die erste Aufgabe aufs Board kam). Er gilt auch in „Wie lange noch“: der Durchsatz wird ab Start gemessen, das Diagramm beginnt am Start; ein gewählter Zeitraum überstimmt das.
- **Zieltermin** ist einer der Termine aus „Wie lange noch“ (R00047), markiert in der Termintabelle oder im Fever Chart.
- **Gesamtdauer** = Tage vom Start bis zum Zieltermin; sie teilt sich in **Arbeitsbereich** und **Puffer**. Die Puffergröße wird im Diagramm eingestellt und am Board gespeichert; „Puffer vorschlagen“ setzt 1/3 der Gesamtdauer (die CCPM-Regel „Puffer = 50 % der Kette“).
- **Einstellbar und am Board gespeichert**: Perzentil der Prognose (Standard P95), Einheit (Standard Arbeitstage, sonst Kalendertage), Zonengrenzen (Standard Gelb 10 → 70 %, Rot 30 → 100 %).
- **Cache**: die teure Rechnung je Tag steht versioniert in `berichte/<slug>-fieber.md`. Beim Öffnen ergänzt der Bericht fehlende Tage automatisch (ein Commit, Autor „kanbanD“); der heutige Tag wird nie gespeichert. Ein Knopf verwirft den Cache und rechnet neu.

Der Berichtsfilter wirkt; Start und Filter bilden den Schlüssel des Caches. Zieltermin, Puffer, Perzentil, Einheit und Zonen ändern nur die Darstellung und rechnen nichts neu.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“, „Git als Archiv“; Steuerung mit Wahrscheinlichkeit statt Bauchgefühl.

## Geschäftlicher Nutzen

Ein Blick sagt, ob der Zieltermin gefährdet ist — nicht erst, wenn er verstrichen ist, sondern sobald der Puffer schneller schwindet, als die Arbeit vorankommt. Die Bahn zeigt, wie es dazu kam (Stillstand senkrecht, neue Aufgaben als Sprung nach links).

## Rechnung

Einheit `e` ∈ {Arbeitstage, Kalendertage}; `dauer(a, b)` = Arbeitstage nach `a` bis einschließlich `b` bzw. Kalendertage `b − a`.

- Gesamtdauer `D = dauer(Start, Zieltermin)`, Puffer `B` (1 ≤ B < D), Arbeitsbereich `W = D − B`.
- Je Tag `t` (Start ≤ t ≤ heute): Prognose wie „Wie lange noch“ mit dem Stand am Ende von `t`, Messbasis ab Start (bzw. Filterzeitraum), nur der letzte Block (Abschlussspalte bzw. letzte Phase).
  - Fortschritt `p = 100 · erreicht / Umfang` des Tages.
  - Prognostiziertes Ende `E` = Datum des gewählten Perzentils in der gewählten Woche; nichts offen → `E = t`.
  - Pufferverbrauch `b = 100 · (dauer(Start, E) − W) / B`; negativ = Puffer gewonnen, wird angezeigt.
- Zone: `gelb(p) = g0 + (g100 − g0) · p / 100`, `rot(p)` ebenso; `b < gelb` grün, `b < rot` gelb, sonst rot; `b > 100` schwarz.
- Unter 3 Läufen in der Messbasis kein Punkt; die Bahn endet am ersten Tag mit 100 %, kommen danach Aufgaben dazu, läuft sie weiter. In der Arbeitstage-Einheit nur Punkte an Werktagen.

## Funktionale Anforderungen

- Board-Datei: `start: JJJJ-MM-TT` und `fever: {buffer, percentile, week, yellow: [g0, g100], red: [r0, r100]}` im Frontmatter, geschrieben nur, was gesetzt bzw. vom Standard verschieden ist; am Termin `target: true` (höchstens einer). Unlesbare Werte sind Formatfehler.
- `PUT /api/boards/{slug}/start` mit `{start: "JJJJ-MM-TT" | null}`, `PUT /api/boards/{slug}/fieber` mit `{puffer, perzentil, woche, gelb, rot}`; je ein Commit der handelnden Person, ohne Änderung keiner; ungültig → 400.
- `PUT /api/boards/{slug}/termine` nimmt `ziel: true`; zwei Zieltermine → 400.
- `GET /api/boards/{slug}/fieber/cache` liefert `{abschnitte: [{schluessel, tage: [{datum, erledigt, umfang, ende7: [P50, P70, P85, P95], ende5: […]}]}]}`; `POST` mit `{schluessel, tage}` ergänzt nur fehlende Tage vor heute (heute oder später → 400), ein Commit „Fever Chart „<Board>“: n Tage ergänzt“ unter dem Autor „kanbanD“, ohne Identität; nichts Neues → kein Commit. `DELETE` verwirft den Cache (Commit „Fever Chart „<Board>“: Cache verworfen“).
- Bericht „Projekt-Fever-Chart“ unter Berichte → VERLAUF, Adresse `#/berichte/fieber`: Diagramm mit Zonen als Flächen, Bahn, heutigem Punkt, Tooltip je Punkt (Datum, Fortschritt, Verbrauch, Zone, prognostiziertes Ende, Zieltermin), Vollbild wie R00073; Einstellungen (Start, Zieltermin, Puffer mit „Puffer vorschlagen“, Perzentil, Einheit, Zonen), Kennzahlen (Gesamtdauer, Arbeitsbereich, Planende), Tabellenansicht, Knopf „Cache verwerfen und neu rechnen“, Methodik.
- Ohne Zieltermin zeigt der Bericht nur die Auswahl des Zieltermins; ohne Puffer den Vorschlag.
- „Wie lange noch“: Termintabelle mit Auswahl „Ziel“; Feld „Projektstart“.

## Akzeptanzkriterien

- [x] Format: Rundlauf mit Start, Fieber-Einstellungen und Zieltermin stabil; Board ohne diese Angaben unverändert; zwei Zieltermine und unlesbare Werte sind Formatfehler
- [x] API: Start und Einstellungen setzen → Frontmatter und Commit der Person; Cache ergänzen → Datei, Commit von „kanbanD“ ohne Header; derselbe Nachtrag noch einmal → kein Commit; heute → 400; verwerfen → leer
- [x] Unit: Verbrauch, Zone und Puffervorschlag nach der Rechnung oben (inkl. Beispiel 40/20 aus der CCPM-Beschreibung); Fieberpunkte je Tag aus Bewegungen; Start als Messbasis in der Prognose
- [x] E2E: Zieltermin markieren, Puffer vorschlagen → Diagramm mit Zonen, Bahn und heutigem Punkt; Tooltip; Cache-Datei nach dem Öffnen mit den Tagen vor heute; Puffer ändern rechnet ohne neuen Cache-Commit; verwerfen und neu rechnen

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `src/format/fieber.rs` (neu), `src/dienst/termine.rs`, `src/dienst/fieber.rs` (neu), `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/fieber.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00078-fieber.spec.js`.

## Abhängigkeiten
- Abhängig von: R00046 (Wie lange noch), R00047 (Termine), R00073 (Diagramme)

## Offene Fragen
- keine — geklärt im Gespräch am 2026-10-24 (Start, Filter, Perzentil, Einheit, Pufferformel, Neuberechnung, Zonen, Autor, kein Portfolio, Ende, Anfang, Zieltermin)
