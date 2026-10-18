---
id: R00047
status: Erledigt
datum: 2026-10-18
---

# R00047: Termine in Wie lange noch

## Beschreibung

Im Bericht „Wie lange noch“ (R00046) lassen sich dauerhafte Termine eintragen — etwa „Deadline · rot · fette durchgehende Linie · 31.10.2027“, dazu beliebig weitere wie „Review mit Kunde · blau · gestrichelt · 15.11.2026“. Ein Termin hat Name, Datum, Farbe (Palette der Klassen oder eigenes Hex), Linienart (durchgehend, gestrichelt, gepunktet) und Stärke (fein, normal, fett). Termine gehören zum Board und stehen im Frontmatter seiner Datei; sie sind versioniert wie alles andere und für alle sichtbar.

Das Diagramm zeichnet jeden Termin als senkrechte Linie mit Namen und Datum und reicht bis zum spätesten Termin. Zu jedem Termin nennt der Bericht je Spalte die Wahrscheinlichkeit, sie bis dahin zu erreichen — aus denselben Ziehungen wie die Perzentile, in der 7- und der 5-Tage-Woche.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“, „Git als Archiv“.

## Geschäftlicher Nutzen

Der Abgleich „schaffen wir den Termin?“ steht neben der Prognose, mit Wahrscheinlichkeit statt Bauchgefühl.

## Funktionale Anforderungen

- Board-Datei: `milestones:` im Frontmatter, je Termin `{name, date, color, line, width}` mit `line` ∈ solid/dashed/dotted, `width` ∈ thin/normal/bold; ein unlesbarer Termin macht die Datei defekt (kein stiller Verlust).
- `PUT /api/boards/{slug}/termine` mit `[{name, datum, farbe, linie, staerke}]` (`linie` durchgehend/gestrichelt/gepunktet, `staerke` fein/normal/fett) ersetzt die Termine, nach Datum sortiert; Name nicht leer, Datum `JJJJ-MM-TT`; ein Commit — „Termin „X“ (TT.MM.JJJJ) angelegt / entfernt“ bei genau einem, sonst „Termine von „Board“ geändert“; ohne Änderung kein Commit.
- `GET /api/boards/{slug}` liefert `termine`.
- Bericht: Abschnitt „Termine“ mit Tabelle (Linie als Vorschau, Name, Datum, Chance „fertig“) und Formular zum Anlegen, Ändern (✎) und Entfernen (✕); ohne Identität „Ich bin …“.
- Je Spaltenblock: je Termin „bis <Datum>: x % (7-Tage-Woche) · y % (5-Tage-Woche)“; vorbei → „vorbei“; nichts offen → „erreicht“; ungemessen → „keine Aussage“.
- Live: Termine anderer erscheinen ohne Neuladen.

## Akzeptanzkriterien

- [x] Format: Rundlauf mit zwei Terminen stabil; Board ohne Termine unverändert; falsches Datum und unbekannte Linie sind Formatfehler
- [x] API: zwei Termine setzen → Frontmatter, sortiert, Commit „Termine von „Entwicklung“ geändert“; einen entfernen → „Termin „Review“ (15.11.2026) entfernt“; leerer Name → 400; Bewegen erhält die Termine
- [x] Unit: Chance bis zu einem Tag aus den Ziehungen; Werktage bis zum Termin
- [x] E2E: Termin „Deadline“ rot, durchgehend, fett anlegen → Linie im Diagramm mit Farbe, Stärke und Name; Block zeigt die Chance; ändern und entfernen

## Betroffene Verzeichnisstruktur

`src/modell/board.rs`, `src/format/board.rs`, `src/dienst/termine.rs` (neu), `src/web/mod.rs`, `src/web/endpunkte.rs`, `web/berichte.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/termine.rs`, `e2e/einheit/berichte.test.js`, `e2e/tests/r00047-termine.spec.js`.

## Abhängigkeiten
- Abhängig von: R00046

## Offene Fragen
