---
id: R00035
status: Neu
datum: 2026-10-18
---

# R00035: Tastenkürzel überall

## Beschreibung

Nach dem Board bekommen auch die übrigen Orte Tastenkürzel: Folgen mit `g` wechseln die Seite (wie in gängigen Werkzeugen), `b` und `i` öffnen Board-Umschalter und „Ich bin …“, das Aufgabenfenster hat Kürzel für Timer, Zuständigkeit, Archiv, Titel, Beschreibung, Teilaufgabe, Kommentar und Datei-Reiter, die Aufgabenliste ist mit Pfeiltasten bedienbar. `?` zeigt überall die Kürzel des aktuellen Orts und die überall gültigen.

Zahlt ein auf: [Vision](R00000-vision.md) — „per Tastatur bedienbar und folgt gewohnten Konventionen“.

## Geschäftlicher Nutzen

Die ganze Anwendung ist ohne Maus bedienbar; wer viel damit arbeitet, wird deutlich schneller.

## Funktionale Anforderungen

- Überall (nicht in Eingabefeldern, kein Fenster offen): `g` gefolgt innerhalb von 1,5 s von `b` Board · `a` Aufgaben · `p` Personen · `s` Stundenzettel · `z` Zeiten nach Aufgabe und Person · `v` Burndown · `e` Einrichten; `b` Board-Umschalter; `i` „Ich bin …“; `?` Hilfe.
- Aufgabenfenster: `t` Timer an/aus · `m` mir zuweisen/abnehmen · `a` archivieren bzw. zurückholen · `e` Titel bearbeiten · `b` Beschreibung bearbeiten · `s` neue Teilaufgabe · `k` Kommentar schreiben · `d` Inhalt/Datei umschalten; in der Beschreibung speichert Strg+Enter.
- Aufgabenliste: ↑/↓ wechseln die Zeile (erste Zeile, wenn keine gewählt), Enter öffnet, `a` archiviert bzw. holt zurück, `c` kopiert den Verweis.
- Die Hilfe gliedert sich in „Hier“ (Board, Fenster oder Liste) und „Überall“.

## Akzeptanzkriterien

- [ ] `gFolge`: `g` dann `a` → Ziel `#/aufgaben`; `g` dann `x` → kein Ziel; `a` allein → kein Ziel
- [ ] Oberfläche: `g` `p` zeigt „Personen“; `g` `b` wieder das Board; `b` öffnet den Board-Umschalter; `i` „Ich bin …“
- [ ] Fenster: `t` startet den Timer, `m` weist mich zu, `k` setzt den Fokus ins Kommentarfeld, `d` zeigt die Datei
- [ ] Liste: ↓ ↓ Enter öffnet die zweite Zeile; `a` archiviert die gewählte Zeile
- [ ] `?` im Fenster zeigt „Hier: Aufgabenfenster“ und „Überall“

## Betroffene Verzeichnisstruktur

`web/tastatur.js`, `web/app.js`, `web/ansicht.js`; Tests `e2e/einheit/tastatur.test.js`, `e2e/tests/r00035-kuerzel.spec.js`.

## Abhängigkeiten
- Abhängig von: R00026, R00033

## Offene Fragen
