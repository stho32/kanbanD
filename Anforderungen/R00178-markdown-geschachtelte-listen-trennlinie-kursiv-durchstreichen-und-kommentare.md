---
id: R00178
status: Neu
datum: 2026-11-16
---

# R00178: Markdown — geschachtelte Listen, Trennlinie, _kursiv_, Durchstreichen und Kommentare

## Beschreibung

Herkunft: Karte #186, vom Betreiber am 2026-11-16 als vierte Karte bestellt („geschachtelte Listen, Trennlinie, _kursiv_, Durchstreichen, Markdown in Kommentaren“). Heute erscheinen geschachtelte Listen flach; `---`, `_kursiv_`, `__fett__`, `~~durchgestrichen~~` und `####` bleiben Text; Kommentare zeigen Rohtext, auch Links sind dort nicht klickbar. Fehlender Umfang, kein Fehler: [R00030](R00030-beschreibung-als-markdown-lesen.md) zählt die Elemente abschließend auf.

**Gewünscht:** Die Lesesicht der Beschreibung im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) kennt diese Elemente, und Kommentare werden wie die Beschreibung gerendert. Unterstrich und Tilde wirken nur an Wortgrenzen ([ADR-0030](../Dokumentation/ADRs/0030-markdown-aus-fremdem-text-erst-maskieren-feste-elemente.md) Punkte 5 und 6). Sicherheit nach ADR-0030 (Punkte 1–8); die Adressprüfung baut Karte #187 voraus.

**Wirkung auf den Bestand (gezählt am Board des Projekts: 182 Aufgaben, 1403 Kommentare): drei Beschreibungen zeigen eine Linie statt „---“; etwa 395 Kommentare erscheinen formatiert (121 mit Listen, einer mit Tabelle); Wörter mit Unterstrich bleiben unverändert.**

Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0003.dc.html#markdown-elemente`. Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (Markdown bleibt Markdown, kanbanD zeigt es lesbar).

## Akzeptanzkriterien

- [ ] **AK 1 Abnahme-Probe der Karte:** Gegeben eine Beschreibung mit einer Liste in drei Ebenen, einer Zeile `---`, dem Satz `_schräg_ und ~~weg~~ und cost_from_column` und ein Kommentar `siehe https://example.org und **wichtig**`. Wenn ich die Aufgabe öffne, dann sind die drei Ebenen eingerückt, die Linie ist eine Linie, „schräg“ kursiv, „weg“ durchgestrichen, `cost_from_column` unverändert; im Kommentar ist die Adresse ein Link und „wichtig“ fett. Heute rot.
- [ ] **AK 2 Nur an Wortgrenzen:** `_schräg_` wird kursiv, `__fett__` fett, `~~weg~~` durchgestrichen — in Beschreibung, Kommentar und Teilaufgabe. `cost_from_column` und `__init__.py` bleiben unverändert; `https://x.org/a_b_c` bleibt ein Link mit unverändertem Ziel.
- [ ] **AK 3 Geschachtelte Listen:** Drei Ebenen behalten ihre Einrückung, Punkte und Nummern gemischt: `- a` / `  1. b` / `    - c` zeigt unter „a“ eine nummerierte Liste mit „b“ und darunter einen Punkt „c“.
- [ ] **AK 4 Trennlinie und Überschrift:** `---` auf eigener Zeile wird eine Linie — auch direkt unter einer Textzeile, nie eine Überschrift, nie eine Tabelle. `#### T` wird eine Überschrift, eine Stufe kleiner als `###` (im Aufgabenfenster `h6`).
- [ ] **AK 5 Kommentare:** Ein Kommentar zeigt alle Elemente, die die Beschreibung kann (Liste, Link, Code, Tabelle); ein mehrzeiliger Kommentar behält seine Zeilenumbrüche; beim Bearbeiten steht der Rohtext im Feld.
- [ ] **AK 6 Fremder Text:** Die feindlichen Texte aus ADR-0030 bleiben Text, in Beschreibung und Kommentar; kein Link liegt in einem Knopf.
- [ ] **AK 7 Bleibt:** Alles, was heute gerendert wird, wird weiter gleich gerendert (fester Vergleich), außer: `_…_`, `__…__` und `~~…~~` an Wortgrenzen werden formatiert · `---` wird Linie · `####` wird Überschrift · eingerückte Listenpunkte werden geschachtelt statt flach · Kommentare erscheinen formatiert statt roh.

## Tests

Unit zuerst (AK 1 rot), fester Vergleich um die fünf benannten Abweichungen erweitert; E2E als Spec für AK 1 und AK 5.

## Implementierungshinweise

- Bauart (architekt, mit `node` geprobt): nur der Listenzweig in `web/markdown.js` bekommt einen Stapel nach Einrückung; die Trennlinie ist ein Zweig vor Überschrift und Tabelle; Kommentare laufen über `markdownHtml` (`web/ansicht.js` um `:458`); das CSS von `.besch-lesen` wandert auf die gemeinsame Klasse aus R00176.
- **Nicht hinein:** Bilder (würden fremde Adressen laden) · Checklisten `- [ ]` als Kästchen (bewusst Text) · rohes HTML · Fortsetzungszeilen in Listenpunkten, verschachtelte Zitate.

## Warum löst diese Anforderung das Problem?

Auslöser: Agenten schreiben Kommentare mit Listen und Links, der Mensch liest Rohtext mit Sternen und Strichen. Werden Kommentare und die fehlenden Elemente gerendert (X), sieht der Mensch Gliederung, Links und Gestrichenes so, wie sie gemeint sind (Y); er folgt einem Verweis aus dem Kommentar mit einem Klick, und Bezeichner mit Unterstrich bleiben lesbar (Z).

## Offene Fragen

Keine.
