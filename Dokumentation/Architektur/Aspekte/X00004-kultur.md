---
id: X00004
name: Kultur der Anzeige
art: Aspekt
geltung: Makro
befund: Einheitlich
hausantwort: "ADR-0013 (Akzeptiert): Daten ISO und englische Schlüssel, Anzeige deutsch über das reine Modul web/kultur.js, Probe über alle Ansichten"
betrifft:
  - A00009
herkunft: code
quellen:
  - web/ansicht.js
  - web/berichte.js
  - web/zeiten.js
  - web/eingabe.js
  - web/kultur.js
  - web/kd-app.css
  - e2e/tests/kultur-hilfen.js
  - e2e/tests/kultur.spec.js
  - e2e/tests/kultur-selbstprobe.spec.js
  - e2e/einheit/kultur.test.js
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

Ist 2026-11-08 nach #88 (R00109, Merge kanbanD `df3409f`):

- **Datum:** gezeichnet wird nur über das reine Modul `web/kultur.js` (`datumLang` … `achsenMarke`, `:11–50`; geladen in `web/index.html:17`, Unit-Test `e2e/einheit/kultur.test.js`). `deTag` und `deDatum` gibt es nicht mehr; `vollDatum` delegiert an `datumAusMs` (`web/berichte.js:455`); `isoD` (`web/ansicht.js:382`, `web/berichte.js:354`) und `ortszeit` (`web/zeiten.js:11`) rechnen nur noch ISO-Werte als Argument („heute“) bzw. für `kultur.js`. Dass keine Ansicht ISO zeigt, belegt die Probe US-6 mit leerer Ausnahmeliste (`AUSNAHMEN`, `e2e/tests/kultur.spec.js:262`, `:329–331`).
- **Beschriftungen:** einziger Ort ist `vBeschriftung(schluessel)` (`web/ansicht.js:167–170`): Rahmen `.kb`, darin `.k` mit der Beschriftung aus `FELDER` und darunter `.sl` mit dem Schlüssel der Datei (ADR-0013 N1); Gestaltung `.felder>.kb`, `.kb .k`, `.sl` in `web/kd-app.css:336–339`. Aufgerufen in „Neue Aufgabe“ (`:192–198`), Aufgabenfenster (`:274–282`, `:438`, `:445`, `:598`), „Einrichten“ (`:1324`, `:1335`) und erstem Start (`:1400–1405`); Felder ohne Schlüssel bleiben nacktes `.k`. `FELDER` (`web/kultur.js:53–57`) führt `requirements` → „Anforderungen“, den Schlüssel `anforderungen` nicht mehr.
- **Knopfgruppen** tragen ihren Namen über `role=group` mit `aria-label` gleich der Beschriftung („Zuständig“ `web/ansicht.js:195`, `:280`; „Wirkungen“ `:438`; „Phasen“ `:445`).
- **Herkunft:** `thin air` wird nur angezeigt als „ohne Herkunft“ (`OHNE_HERKUNFT`, `herkunftAnzeige`, `web/kultur.js:59–69`; Chip `web/ansicht.js:416`).
- Abschnittsköpfe in „Einrichten“ bleiben beim Hausmuster `QUELLEN sources:` (`web/ansicht.js:1335`, ADR-0013 N1).

Erkennen von Abweichungen (Durchsetzung):

- Die Probe `e2e/tests/kultur-hilfen.js:53–112` (`imBrowserBeschriften`, `beschriftungenPruefen`) prüft je Feldzeile eines `.felder`-Rasters: keine Beschriftung ist oder enthält einen Schlüssel, unter einer Beschriftung aus `FELDER` steht außerhalb von `.k` ein Element mit genau ihrem Schlüssel, und — nur in Aufgabenfenster und „Neue Aufgabe“ (ADR-0013 Regel 5; Aufrufe `e2e/tests/kultur.spec.js:365`, `:378`, `:391`, `:397`) — der zugängliche Name des Felds enthält die Beschriftung; eine Knopfgruppe ohne `role=group` mit Namen fällt. „Einrichten“ und erster Start prüfen ohne Namen (`namen: false`, `:404`, `:416`).
- Leerlauf-Wächter: ein Fenster ohne Feldzeile ist ein Verstoß („keine Feldzeile im Fenster“, `e2e/tests/kultur-hilfen.js:67`) — eine leere Liste ist kein Beleg.
- Selbstproben ohne kanbanD, jede Regel positiv und negativ: `e2e/tests/kultur-selbstprobe.spec.js` (ISO-Probe `:12–53`, Beschriftungsprobe `:55ff`, Leerlauf `(e)` `:94–98`).
- ISO-Probe über alle Ansichten der gemeinsamen Liste mit Vollständigkeitsabgleich und Ausnahmeliste, die nur schrumpft (`e2e/tests/kultur.spec.js:328–355`, `ausnahmenAbgleichen` `e2e/tests/kultur-hilfen.js:118–125`).
- Die Lage des Schlüssels unter der Beschriftung misst kein Test (ADR-0013 N1).

## Abweichungen

- keine — US-6 ohne Ausnahme, US-7/US-8 ohne Verstoß (nachgefahren 2026-11-08 auf `ecd762c`).

## Offene Fragen

- keine

## Notizen / Quellen

- Ist 2026-11-06 (kanbanD `d056623`, vor dem Bau): fünf Datumsformer, ISO sichtbar an rund 15 Stellen, englische Beschriftungen in Aufgabenfenster und „Neue Aufgabe“, „thin air“ im Chip; Durchsetzung damals nur per `grep`. Durch den Bau von R00109 (#11, #88) überholt.
- nachgeführt 2026-11-08 nach #88 (R00109, kanbanD `df3409f`)
