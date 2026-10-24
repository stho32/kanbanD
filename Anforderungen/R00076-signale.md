---
id: R00076
status: Erledigt
datum: 2026-10-21
---

# R00076: Signale

## Beschreibung

Ein **Signal** hebt eine Aufgabe hervor — gesetzt von einem Menschen per Klick oder von einem Programm über die API, etwa „Neue E-Mail“ oder „Coding-Agent ist fertig / hat Fragen“.

- **Einrichten**: Signale stehen in `kanbanD.md` unter `signals:` — je Schlüssel eine Bedeutung (`label`) und eine Farbe (`color`, Palettenname oder `#rrggbb`), gepflegt unter „Einrichten“ wie die Klassen. Der Schlüssel `due` ist vergeben (siehe Fälligkeit).
- **An der Aufgabe**: Frontmatter `signals: [mail, fragen]`; jedes Setzen und Zurücknehmen ist ein Commit. Nur eingerichtete Signale lassen sich setzen.
- **Karte**: je gesetztem Signal ein kleines pulsierendes Fackelsymbol in der Farbe des Signals, Tooltip mit der Bedeutung; ein Klick auf die Fackel nimmt das Signal zurück. Bei reduzierter Bewegung (`prefers-reduced-motion`) pulsiert nichts.
- **Aufgabenfenster**: Feld „Signale“ mit einem Schalter je eingerichtetem Signal (setzen und zurücknehmen).
- **Spaltenkopf**: je Signal, das Karten der Spalte tragen, das Symbol mit der Zahl (`🔥×3`); ein Klick filtert nach diesem Signal.
- **Filter**: `signal:<schlüssel>`, `signal:due` (fällig), `signal:any` (irgendein Signal).
- **Fälligkeit als Signal**: eine Aufgabe, deren Fälligkeit heute ist oder überschritten, trägt das Standardsignal `due` mit Kalendersymbol — rot bei überschritten, bernsteinfarben bei heute; nicht in der Abschlussspalte. Es wird gerechnet, nicht gespeichert, und verschwindet, wenn die Fälligkeit geändert wird.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen und Agenten arbeiten am selben Board; was Aufmerksamkeit braucht, fällt auf.

## Geschäftlicher Nutzen

Agenten und Integrationen können eine Karte für Menschen sichtbar markieren, ohne Titel oder Labels zu verbiegen; Menschen sehen auf einen Blick, wo etwas wartet, und quittieren es mit einem Klick.

## Funktionale Anforderungen

- Einstellungen: `signals: {mail: {label: Neue E-Mail, color: blue}}`; `PUT /api/einstellungen` nimmt `signale: [{schluessel, bezeichnung, farbe}]`; Schlüssel `due` oder leer → 400.
- `PUT /api/aufgaben/{nr}/signale/{schlüssel}` setzt, `DELETE …` nimmt zurück — Commit „#n Signal „<Bedeutung>“ gesetzt“ bzw. „… zurückgenommen“; schon gesetzt bzw. nicht gesetzt: kein Commit; unbekanntes Signal → 400.
- `PATCH /api/aufgaben/{nr}` mit `signale: [...]` ersetzt die Liste (geprüft wie oben).
- Unbekannte Signale in einer Datei bleiben erhalten und werden ohne Farbe gezeigt.

## Akzeptanzkriterien

- [x] Ein Signal unter „Einrichten“ anlegen (Schlüssel, Bedeutung, Farbe) schreibt `signals:` in `kanbanD.md`
- [x] `PUT …/signale/mail` setzt das Signal; die Karte zeigt eine Fackel in der Farbe, Tooltip mit der Bedeutung; zweites PUT: kein Commit
- [x] Klick auf die Fackel nimmt das Signal zurück (ein Commit); im Aufgabenfenster lässt es sich wieder setzen
- [x] Der Spaltenkopf zeigt je Signal Symbol und Zahl; Klick filtert `signal:<schlüssel>`
- [x] Filter `signal:mail`, `signal:due`, `signal:any` treffen die richtigen Karten
- [x] Fälligkeit heute bzw. überschritten zeigt das Kalendersignal (bernstein bzw. rot), nicht in der Abschlussspalte
- [x] Unbekanntes Signal per API → 400, die Datei bleibt unverändert

## Betroffene Verzeichnisstruktur

`src/modell/einstellungen.rs`, `src/format/einstellungen.rs`, `src/dienst/einstellungen.rs`, `src/modell/aufgabe.rs`, `src/format/aufgabe.rs`, `src/dienst/signale.rs`, `src/web/mod.rs`, `src/web/endpunkte.rs`; `web/filter.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Tests `tests/signale.rs`, `e2e/einheit/filter.test.js`, `e2e/tests/r00076-signale.spec.js`.

## Abhängigkeiten
- Abhängig von: R00011 (Aufgabe bearbeiten), R00009 (Spalten), Einrichten (Klassen)

## Offene Fragen
- keine
