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
- [ADR-0028: Kosteneinträge — eigener Schlüssel `cost-entries` neben `cost`, Kennung `role@at`, eigene Route; alte `cost.items` bleiben wörtlich](../ADRs/0028-kosteneintraege-als-eigener-schluessel-mit-kennung-und-eigener-route.md) — Soll (#166): `cost-entries` kommt in `BEKANNT`, je Eintrag eine Flusszuordnung `{at, role, column, amount, currency, tokens?}`; `cost.items` wird unverändert gelesen und geschrieben, nichts wird überführt
- [ADR-0031: Klassen je Board — eigener Satz in der Board-Datei, sonst die Vorgabe des Ordners](../ADRs/0031-klassen-je-board-mit-vorgabe-des-ordners.md) (Vorgeschlagen, Karte #200) — Soll: `classes:` im Frontmatter der Board-Datei in der Form von `kanbanD.md`, ein Leser und ein Schreiber für beide; ein Board ohne den Schlüssel bleibt zeichengleich (Regeln 1, 4)
- [ADR-0034: kanbanD ohne WBS — Register mit Repository, Phasen werden Spalten](../ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) (Akzeptiert, #224–#228) — Soll: Register `{name, repository}` mit Lese-Rückfall auf `wbs`/`requirements`; `wbs-effects`/`phases` werden unbekannte Schlüssel der Aufgabe, `column-phases`/`column-checks` entfallen beim Schreiben des Boards
- [ADR-0035: `Braucht` zwischen Karten — das Label `braucht:<nr>` ist der eine Träger](../ADRs/0035-braucht-zwischen-karten-als-label.md) — gebaut S1 (#228, R00214): **kein Formatwechsel, kein neuer Schlüssel.** `labels` bleibt eine Textliste; das Label `braucht:<n>` trägt Bedeutung, die das Modell deutet (A00006). Lesen und Schreiben der Datei bleiben zeichengleich, auch für Labels mit dem Präfix in anderer Form
- [ADR-0036: Transkripte der Agentenläufe — gzip unversioniert unter `transkripte/<nr>/`, Eintrag `transcripts` an der Karte, Schalter `record-transcripts`](../ADRs/0036-transkripte-unversioniert-im-ordner-eintrag-an-der-karte.md) (Akzeptiert, Karte #208, Nachtrag 2026-11-21 „Gebaut“) — gebaut (#208, R00216, auf main seit `c37b74cc`): `transcripts` hinter `commits` als Flusszeilen `{at, role, column, bytes}`, formwidrig ≠ defekt; `record-transcripts: true|false` in Board-Datei und `kanbanD.md`, bei jedem Schreiben mitgeführt; die Dateien unter `transkripte/` gehören nicht zum versionierten Format — Einzelheiten unter Notizen
- [ADR-0043: `kanbanD.md` zeilengenau je Abschnitt schreiben](../ADRs/0043-kanband-md-zeilengenau-je-abschnitt-schreiben.md) (Vorgeschlagen, Karte #248) — Soll: ein Blockschreiber `abschnitt_im_text` (Verallgemeinerung von `schalter_im_text`) ersetzt nur geänderte Abschnitte `people`/`classes`/`signals`/`sources`; Textkörper, Kommentare, fremde Schlüssel und Reihenfolge bleiben; `einstellungen::schreiben` nur noch für `einrichten`

## Offene Fragen

- #248: Bug oder Umfang, zeilengenau (ADR-0043 V4) oder Hinweis — liegt beim product-owner

## Notizen / Quellen

- `src/format/frontmatter.rs`, `yaml.rs` gemeinsame Bausteine; eine Datei je Dateiart.
- Soll nach ADR-0009 (Karte #18): `cost` kommt in `BEKANNT`; Verstoß gegen Form oder Modellregel ist `Formatfehler` mit Pfad (Aufgabe defekt, wie `reporting`). Rundlauf-Test über alle Cent-Werte 0–100.000 plus Ränder; `basis`/`text` über `yaml::skalar`.
- nachgeführt 2026-11-06 nach #18 (ADR-0009)
- nachgeführt 2026-11-11 nach R00128 (#35): das Board-Frontmatter liest/schreibt `archived: <JJJJ-MM-TT>` (`board::lesen`/`board::schreiben`); ein ungültiges Datum ist ein `Formatfehler` (wie `start`), der `---`-Block erscheint auch, wenn nur `archived` gesetzt ist; Rundlauf-Test `archiviert_im_frontmatter_rundlauf`.
- nachgeführt 2026-11-11 nach R00141 (#36, ADR-0024): **kein Formatwechsel.** Wird eine Aufgabe endgültig gelöscht, **entfällt** ihre Aufgabendatei ganz, und jede betroffene Board-Datei **verliert eine Zeile** (`- [#n](…)`), sonst bleibt die Board-Form unverändert; das dritte, unbeteiligte Board bleibt byte-gleich. Wiederherstellen ist ein `git`-Vorgang, keine Formatfrage.
- nachgeführt 2026-11-11 nach dem Bau von #37 (R00129, ADR-0023): `estimate` in `BEKANNT` (`src/format/aufgabe.rs:11`) und in der Schreibreihenfolge, kanonisch `estimate: <minuten>` (`:391`); gelesen über `geschaetzte_minuten_pruefen` (`:78`); fehlend keine Zeile; Rundlauf-Test über 1..=100.000 plus Ränder, formwidrige Werte (z. B. `2:30`, `0`, `-1`) ergeben `Formatfehler` (`:580–597`).
- nachgeführt 2026-11-12 nach R00124 (ADR-0021): `column-dates` im Board-Frontmatter (`src/format/board.rs:19` gelesen über `yaml::zuordnung`, `:350` in Spaltenreihenfolge geschrieben); fehlender Schlüssel heißt Standard (`None`), ein Nicht-Wahrheitswert gilt nicht; `Spalte.datums_trenner` siehe [A00006](A00006-modell.md).
- nachgeführt 2026-11-20 nach R00214 (#228, ADR-0035): das Format bleibt unverändert; `braucht:<n>` ist ein gewöhnlicher Eintrag in `labels` (Bestand meist als `"braucht:226"` in Anführungszeichen). Bedeutung, Prüfung an der Tür und das Lesefeld `braucht` liegen in Modell und Diensten, nicht im Format.
- nachgeführt 2026-11-21 nach #208 (R00216, ADR-0036 mit Nachtrag „Gebaut“, `c37b74cc`), Architektur-Review 208-1:
  - Aufgabe: Schlüssel `transcripts` (`TRANSKRIPTE`, `src/format/aufgabe.rs:27`) steht **nicht** in `BEKANNT`, sondern gilt wie `commits` nur als bekannt, wenn er eine Liste (oder leer) ist (`:91–93`, `:101`). Was keine Liste ist, bleibt als unbekannter Schlüssel wörtlich stehen — nie defekt. Geschrieben wird er hinter `commits` und vor `archived` (`:550–551`), je Eintrag eine Flusszeile `  - {at: …, role: …, column: …, bytes: …}` in fester Schlüsselfolge, danach unbekannte Schlüssel des Eintrags (`transkript_schreiben`, `:160`). Ohne Einträge keine Zeile, eine Datei ohne `transcripts` bleibt zeichengleich.
  - Ein formwidriger Eintrag (keine Zuordnung, Feld fehlt, Regel von ADR-0028 Punkt 2 verletzt) wird `Transkriptzeile::Unlesbar` mit dem Rohwert ([A00006](A00006-modell.md)). Er macht die Aufgabe nicht defekt und wird inhaltsgleich zurückgeschrieben, als Flusszeile über `yaml::wert` — der Inhalt bleibt, die Schreibweise einer von Hand geschriebenen Zeile kann sich ändern.
  - Schalter `record-transcripts` (`SCHALTER`, `src/format/board.rs:9`): gelesen von `schalter_lesen` (`:94`) für Board-Datei (`:46`) **und** `kanbanD.md` (`src/format/einstellungen.rs:26`), ein Leser für beide. `true`/`false` gelten, fehlend oder `null` heißt `None`. Jeder andere Wert ist ein `Formatfehler` — die Datei ist dann defekt, statt still „aus“ zu lesen und beim Schreiben zu verlieren oder still einzuschalten. Geschrieben wird er im Board-Frontmatter am Ende vor `---` (`schalter_zeile`, `:103`, `:424`; der Frontmatter-Block erscheint auch, wenn nur der Schalter gesetzt ist, `:348`), in `kanbanD.md` hinter `signals` (`src/format/einstellungen.rs:135–137`).
  - Die gz-Dateien unter `transkripte/<nr4>/` und `transkripte/.gitignore` sind kein Teil des Formats; `format` kennt den Ordner nicht. Sein Name liegt im Modell (`TRANSKRIPTE_ORDNER`, A00006).
