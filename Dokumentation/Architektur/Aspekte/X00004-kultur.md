---
id: X00004
name: Kultur der Anzeige
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "ADR-0013 (Akzeptiert): Daten ISO und englische Schlüssel, Anzeige deutsch über das reine Modul web/kultur.js, Probe über alle Ansichten"
betrifft:
  - A00009
herkunft: code
quellen:
  - web/ansicht.js
  - web/berichte.js
  - web/zeiten.js
  - web/eingabe.js
  - Anforderungen/R00000-vision.md
---

# Kultur der Anzeige

## Hausantwort

Soll nach [ADR-0013](../../ADRs/0013-deutsche-anzeige-an-der-zeichengrenze.md) (Akzeptiert, Karte #11), aus der Leitplanke „Eine festgelegte Kultur“ (`Anforderungen/R00000-vision.md:164–165`):

- Dateien, API, CSV-Ausleitung, Filtersprache und Schnelleingabe bleiben bei ISO-Daten, englischen Schlüsseln und `thin air`; deutsch wird erst beim Zeichnen.
- Ein reines Modul `web/kultur.js` formt Datum (`28.10.2026`, `28.10.`, `28.10.2026 14:05`, `Mi 28.10.2026`) und führt die Tabelle `FELDER` (Schlüssel → Beschriftung, `thin air` → „ohne Herkunft“).
- ISO sichtbar nur, wo die Datei selbst gezeigt wird (Reiter „Datei“, YAML-Vorschau) und als Schlüssel-Hilfstext in Mono; der Hilfstext steht nie im Text der Beschriftung.
- `<input type=date>` bleibt nativ; sein Wert ist ISO.

## Systemantwort

Ist 2026-11-06 (kanbanD `d056623`): fünf Datumsformer mit drei Ergebnissen — `deTag` (`web/ansicht.js:617`), `vollDatum` (`web/berichte.js:453`), `deDatum` (`web/ansicht.js:1021`) deutsch; `isoD` (`web/ansicht.js:370`, `web/berichte.js:353`) und `ortszeit` (`web/zeiten.js:11`) ISO und trotzdem zur Anzeige benutzt. ISO sichtbar an Karte `:492`, Schnellvorschau `:164`, Archivleiste `:255`, Durchläufe `:282`, Kommentare `:295`, Zeiten `:312`, Reservierungen `:572`, Personen `:761`, Stundenzettel `:820`, Tabellen Burndown `:874`, Wie lange noch `:1104`, Fever-Chart `:1214` (alle `web/ansicht.js`). Englische Beschriftungen in Aufgabenfenster `:262–270`, `:407`, `:414`, `:566` und „Neue Aufgabe“ `:180–186`; „thin air“ im Chip `:385`. Deutsch mit Schlüssel als Hilfstext schon in „Einrichten“ (`:1307`).

Erkennen von Abweichungen (Durchsetzung):

- Soll: E2E-Probe über alle Ansichten und offenen Fenster (Muster `e2e/tests/ziele.spec.js`): kein sichtbarer Textknoten und kein `title` auf `/\d{4}-\d{2}-\d{2}/` außer Reiter „Datei“ und YAML-Vorschau; je Feld der Formulare enthält der Name die Beschriftung aus `FELDER`. Unit-Test `web/kultur.js`. Ausnahmeliste mit Karte je Eintrag.
- Heute ohne Probe: `grep -nE "esc\((a|s|x|t|pt)\.(faellig|datum|archiviert)\)|ortszeit\(|isoD\(" web/ansicht.js` — jeder Treffer, der in sichtbaren Text geht, ist ein Befund.
