---
id: A00005
name: Format
code: format
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/format/
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Format

## Verantwortung

Das Format wandelt Markdown mit YAML-Frontmatter rein in Modelldaten um, in beide Richtungen ohne Dateizugriff.

## Schnittstellen

- eingehend: `format::aufgabe`, `format::board`, `format::einstellungen`, `format::fieber` — Text ↔ Modell; Fehler als `Formatfehler`
- ausgehend: keine

## Abhaengigkeiten

- [A00006 Modell](A00006-modell.md)

## Entscheidungen

- [ADR-0004: Schlüsselsuche unter der Sperre](../ADRs/0004-schluesselsuche-unter-der-sperre.md) — Nachtrag N1 (#44, Akzeptiert): die Suche sieht auch defekte Aufgabendateien — Soll: eine reine Funktion liest den Schlüssel einer defekten Aufgabendatei nachsichtig mit zwei Werten (keiner, lesbar); ein `key`, der kein gültiger einzeiliger Text ist, gilt als keiner; `lesen` bleibt streng (`src/format/aufgabe.rs:54–57`), kein Formatwechsel
- [ADR-0009: Kosten als ganze Cent, eine Prüfung für Datei und API](../ADRs/0009-kosten-als-ganze-cent-eine-pruefung-fuer-datei-und-api.md) — Soll (#18): `cost` liest Geldwerte streng aus dem Zahltext in Cent und schreibt sie kanonisch mit zwei Nachkommastellen
- [ADR-0022: Board umbenennen, archivieren, löschen](../ADRs/0022-board-umbenennen-archivieren-loeschen.md) — gebaut (#35, R00128, `a318c3b`): das Board-Frontmatter liest und schreibt `archived: <JJJJ-MM-TT>`; ein ungültiges Datum ist ein `Formatfehler` (wie `start`), der `---`-Block erscheint auch, wenn nur `archived` gesetzt ist
- [ADR-0023: Geschätzte Zeit je Karte — ganze Minuten in der Datei, Anzeige `h:mm` erst beim Zeichnen; eine Prüfung für Datei und API, jeder Fehler 400](../ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) — gebaut (Karte #37, R00129, `20b8bfa`): `estimate` steht in `BEKANNT` (`src/format/aufgabe.rs:11`) und in der Schreibreihenfolge, kanonisch `estimate: <minuten>`; fehlend heißt „keine Schätzung“; eine formwidrige Zahl ist ein `Formatfehler` mit Pfad (Aufgabe defekt, nur lesbar, wie `reporting`)
- [ADR-0024: Aufgabe endgültig löschen](../ADRs/0024-aufgabe-endgueltig-loeschen-datei-entfernen-ein-commit.md) — gebaut (#36, R00141, `2bf636e`): **kein Formatwechsel** — die Aufgabendatei entfällt ganz, jede betroffene Board-Datei verliert eine Zeile, sonst bleibt die Board-Form (das unbeteiligte Board byte-gleich)
- [ADR-0021: Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern](../ADRs/0021-karten-verlauf-aus-der-git-geschichte.md) — gebaut (#119, R00123/R00124, `902a97b`, `56ec980`): das Board-Frontmatter liest `column-dates` (`column-dates: {<Spalte>: true|false}`, `src/format/board.rs:19`, Muster `column-checks`/`column-colors`) und schreibt es in Spaltenreihenfolge (`:350`); nur ein Wahrheitswert gilt (`None` = Schlüssel fehlt = Standard), ein fehlender Eintrag schreibt den Schlüssel nicht; Rundlauf-Test `datums_trenner_im_frontmatter_rundlauf` (`:553`). R00123 verändert das Format **nicht** — der Karten-Verlauf liest nur (A00003/A00007)

## Offene Fragen

## Notizen / Quellen

- `src/format/frontmatter.rs`, `yaml.rs` gemeinsame Bausteine; eine Datei je Dateiart.
- Soll nach ADR-0009 (Karte #18): `cost` kommt in `BEKANNT`; Verstoß gegen Form oder Modellregel ist `Formatfehler` mit Pfad (Aufgabe defekt, wie `reporting`). Rundlauf-Test über alle Cent-Werte 0–100.000 plus Ränder; `basis`/`text` über `yaml::skalar`.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- nachgeführt 2026-11-11 nach R00128 (#35): das Board-Frontmatter liest/schreibt `archived: <JJJJ-MM-TT>` (`board::lesen`/`board::schreiben`); ein ungültiges Datum ist ein `Formatfehler` (wie `start`), der `---`-Block erscheint auch, wenn nur `archived` gesetzt ist; Rundlauf-Test `archiviert_im_frontmatter_rundlauf`.
- nachgeführt 2026-11-11 nach R00141 (#36, ADR-0024): **kein Formatwechsel.** Wird eine Aufgabe endgültig gelöscht, **entfällt** ihre Aufgabendatei ganz, und jede betroffene Board-Datei **verliert eine Zeile** (`- [#n](…)`), sonst bleibt die Board-Form unverändert; das dritte, unbeteiligte Board bleibt byte-gleich. Wiederherstellen ist ein `git`-Vorgang, keine Formatfrage.
- nachgeführt 2026-11-11 nach dem Bau von #37 (R00129, ADR-0023): `estimate` in `BEKANNT` (`src/format/aufgabe.rs:11`) und in der Schreibreihenfolge, kanonisch `estimate: <minuten>` (`:391`); gelesen über `geschaetzte_minuten_pruefen` (`:78`); fehlend keine Zeile; Rundlauf-Test über 1..=100.000 plus Ränder, formwidrige Werte (z. B. `2:30`, `0`, `-1`) ergeben `Formatfehler` (`:580–597`).
- nachgeführt 2026-11-12 nach R00124 (ADR-0021): `column-dates` im Board-Frontmatter (`src/format/board.rs:19` gelesen über `yaml::zuordnung`, `:350` in Spaltenreihenfolge geschrieben); fehlender Schlüssel heißt Standard (`None`), ein Nicht-Wahrheitswert gilt nicht; `Spalte.datums_trenner` siehe [A00006](A00006-modell.md).
