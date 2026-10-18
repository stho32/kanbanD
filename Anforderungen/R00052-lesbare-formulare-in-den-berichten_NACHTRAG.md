---
id: R00052
status: Erledigt
datum: 2026-10-18
---

# R00052: Lesbare Formulare in den Berichten (Nachtrag)

## Beschreibung

Rekonstruiert aus zwei Korrekturen nach der Sichtprüfung (Commit `ae6244e` und B0115 von R00047): Im Bericht „Durchlaufzeit“ waren die Spaltenwahlen „von“/„bis“ zu schmal, Namen wie „Zu erledigen“ wurden abgeschnitten. Im Termin-Formular von „Wie lange noch“ zeigte die Farbauswahl die englischen Palettennamen der Datei (`red`), und das Namensfeld schnitt den Platzhalter ab. Regel: Auswahlfelder in Berichten zeigen ihren Inhalt ungekürzt und auf Deutsch. Die Datei behält die englischen Schlüssel (`color: red`), angezeigt wird „rot“.

Zahlt ein auf: [Vision](R00000-vision.md) — „gewohnte Konventionen“; ergänzt [R00045](R00045-durchlaufzeit-als-eigener-bericht.md) und [R00047](R00047-termine-in-wie-lange-noch.md).

## Geschäftlicher Nutzen

Formulare sind ohne Raten lesbar.

## Funktionale Anforderungen

- Spaltenwahl der Durchlaufzeit: mindestens 140 px breit.
- Termin-Formular: Farbnamen deutsch (gelb, bernstein, orange, rot, rosé, pink, magenta, violett, indigo, blau, himmelblau, cyan, petrol, grün, limette, grau), Wert bleibt der Palettenschlüssel; Namensfeld 200 px.

## Akzeptanzkriterien

- [x] E2E `R00052 US-1`: Spaltenwahl „von“ mit „Zu erledigen“ ist nicht abgeschnitten (scrollWidth ≤ clientWidth)
- [x] E2E `R00052 US-2`: Farbauswahl zeigt „rot“, gewählt wird der Wert `red`; Namensfeld zeigt den Platzhalter ungekürzt

## Betroffene Verzeichnisstruktur

`web/ansicht.js` (`vTermine`), `web/kd-app.css`; Test `e2e/tests/r00052-lesbare-formulare.spec.js`.

## Abhängigkeiten
- Abhängig von: R00045, R00047

## Offene Fragen
