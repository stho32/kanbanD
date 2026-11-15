# ADR-0028: Kosteneinträge — eigener Schlüssel `cost-entries` neben `cost`, Kennung `role@at`, eigene Route; alte `cost.items` bleiben wörtlich

**Status**: Akzeptiert
**Datum**: 2026-11-15
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #166)
**Kontext-Anforderung**: — (Karte #166 „Kosteneinträge mit Zeitstempel, Rolle und Spalte (Datengrundlage)“; Anforderung und WBS-Knoten folgen über den planer). Bezug: R00105 und ADR-0009 (Preisetikett), R00015 und R00090 (Zeiteinträge, Kennung), R00084 (Zeitpunkte), R00097
**Erprobt durch**: — (am Code gelesen, nicht gefahren; getragen von der bestehenden Systemantwort für unbekannte Schlüssel und vom Vorbild der Zeiteinträge — die Rundlauf-Probe unter „Durchsetzung“ ist der erste Test des Baus)

## Kontext

- **Anlass**: Kostenposten tragen heute weder Zeitpunkt noch Rolle noch Spalte (`cost.items: {text, amount | min + max, tokens}`, `src/modell/kosten.rs:29–35`); Zeitraum, Rolle und Spaltenabschnitt sind nicht rechenbar. Die Karte verlangt je Rollenlauf einen Eintrag mit Zeitstempel, Rolle, Spalte und Betrag, über die API anlegbar, änderbar, löschbar, und lesbare Altdaten.
- **Vorbild Zeiteinträge**: `Zeiteintrag { wer, beginn, ende }` mit berechneter Kennung `wer@JJJJ-MM-TTTHH:MM±HH:MM` (`src/modell/aufgabe.rs:14–64`); Routen `POST /api/aufgaben/{nr}/zeiten`, `PATCH` und `DELETE …/zeiten/{kennung}` (`src/web/mod.rs:1036–1071`); gleiche Kennung → 409, unbekannte → 404; geschrieben über `aufgabe_schreiben` (Sperre, Prüfung, ein Commit, `src/dienst/aufgabe_aendern.rs:9–16`) ohne Spaltenregel.
- **`cost` heute**: `Kosten::pruefen` verlangt genau eines von `amount`, `min` + `max`, `items` (`src/modell/kosten.rs:241–268`); `PATCH cost` ersetzt den ganzen Abschnitt und verwirft dabei unbekannte Schlüssel in `cost` (ADR-0009, „Inkauf“). Unbekannte Schlüssel **oben** im Frontmatter überstehen dagegen jedes Schreiben (`src/format/aufgabe.rs:83–86`, `:435–443`; Test `handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel`). Unbekannte Codeblöcke wandern in die Beschreibung (`:278–282`).
- **Bericht heute**: `web/kosten.js` summiert im Browser je Währung alle Etiketten, Schätzung und Positionen gleichermaßen (`:61–74`).

## Optionen

- **A — Liste unter `cost` (`cost.entries`)**: ein Ort für alles zu Kosten, die Währung steht schon da. Schwäche: eine Aufgabe nur mit Einträgen hätte ein `cost` ohne Schätzung — ältere Versionen melden sie defekt; ein `PATCH cost` (auch einer älteren Version) ersetzt den Abschnitt und löscht die Einträge still.
- **B — eigener Schlüssel `cost-entries` oben im Frontmatter, je Eintrag eine Flusszuordnung**: unabhängig vom Etikett, ältere Versionen tragen den unbekannten Schlüssel im Rundlauf mit, je Eintrag eine Diff-Zeile, erweiterbar. Schwäche: die Währung steht je Eintrag statt einmal, und Kosten stehen an zwei Stellen der Datei.
- **C — Codeblock `kanbanD-costs` im Rumpf, Zeile `Zeit · Rolle · Spalte · Betrag`**: genau die Form der Zeiteinträge, für Menschen am besten lesbar. Schwäche: ältere Versionen zeigen den Block als Beschreibungstext und können ihn beim Bearbeiten der Beschreibung zerstören; Spaltennamen mit ` · ` und optionale Felder (Tokens) brauchen eine eigene Grammatik.

## Entscheidung

**Gewählt: Option B.** Akzeptierte Schwäche: Währung je Eintrag wiederholt, zwei Orte für Kosten.

1. **Form in der Datei** — Schlüssel `cost-entries` hinter `cost`, Einträge in Reihenfolge des Anlegens, feste Schlüsselfolge, Betrag immer mit zwei Nachkommastellen (wie ADR-0009):
   ```yaml
   cost-entries:
     - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, amount: 3.46, currency: USD, tokens: 81234}
   ```
2. **Felder und Regeln** (ein Konstruktor für Datei und API, wie ADR-0009): `at` Zeitpunkt nach R00084 (alle Formen von `Zeitpunkt::lesen`, gespeichert in Ortszeit mit Versatz, nicht in der Zukunft); `role` freier einzeiliger Text, getrimmt 1–60 Zeichen, ohne `@`, **nicht** gegen `kanbanD.md` geprüft (eine Rolle ist keine Person); `column` Spaltenname; `amount` Geldwert nach ADR-0009 (Zahl, ≥ 0, höchstens zwei Nachkommastellen, in Cent gerechnet); `currency` drei Großbuchstaben; `tokens` optional, ganze Zahl ≥ 0. Alle außer `tokens` sind Pflicht. Höchstens 1000 Einträge je Aufgabe (Schutzwert). Unbekannte Schlüssel eines Eintrags bleiben in der Datei erhalten, in der API sind sie 400.
3. **Spalte**: Beim Anlegen und beim Ändern von `column` muss der Name eine Spalte eines Boards sein, auf dem die Aufgabe liegt (liegt sie auf keinem: eines Boards des Ordners) — sonst 400. Danach ist der Eintrag eine Tatsache: Umbenennen oder Entfernen einer Spalte ändert ihn nicht, das Lesen prüft die Spalte nie, die Aufgabe wird dadurch nie defekt. Ein Eintrag trägt kein Board; liegt die Aufgabe auf zwei Boards, zählt er in beiden (wie R00105).
4. **Kennung**: `role@JJJJ-MM-TTTHH:MM±HH:MM`, berechnet wie bei Zeiteinträgen, in der API als Feld `kennung`. Gleiche Kennung an derselben Aufgabe → 409, nichts geschrieben. Inkauf: zwei Läufe derselben Rolle, die in derselben Minute enden, kollidieren — der Aufrufer trägt den zweiten eine Minute später ein.
5. **API** (Feldnamen wie in der Datei, wie bei `cost`; Antwort jeweils 200 mit der Aufgabe, genau ein Commit, ohne Änderung keiner):
   - `POST /api/aufgaben/{nr}/kosteneintraege` `{at, role, column, amount, currency?, tokens?}` — fehlt `currency`, gilt `cost.currency`; gibt es keines, 400.
   - `PATCH /api/aufgaben/{nr}/kosteneintraege/{kennung}` — dieselben Felder, alle optional; neues `at` oder `role` gibt eine neue Kennung; `tokens: null` entfernt.
   - `DELETE /api/aufgaben/{nr}/kosteneintraege/{kennung}`.
   - 400 bei jedem Fehler im Rumpf (negativer Betrag, unbekannte Spalte, Typfehler — nie 422), 404 bei unbekannter Nummer oder Kennung, 409 bei doppelter Kennung, 423 bei defekter Datei. `GET /api/aufgaben/{nr}` liefert `kosteneintraege: [{at, role, column, amount, currency, tokens?, kennung}]`, leer als `[]`.
   - Schreiben dürfen Mensch und Agent über `X-KanbanD-Wer`, wie bei Zeiteinträgen und `PATCH cost`; die Regel der Menschen-Spalten (R00097) betrifft nur das Entnehmen und gilt hier nicht. Es entsteht keine neue Zugriffsgrenze.
6. **Altdaten — nichts wird überführt.** `cost.items` wird unverändert gelesen und wörtlich wieder geschrieben, auch wenn die Datei aus anderem Grund gespeichert wird; kein Posten wird in einen Eintrag verwandelt (Zeitpunkt, Rolle und Spalte wären erfunden). `PATCH cost` mit `items` bleibt angenommen, bis die Factory umgestellt ist, und berührt `cost-entries` nie; `cost: null` entfernt nur das Etikett. Eine Aufgabe darf Alt-Posten und Einträge zugleich tragen. Beim Duplizieren wandern Einträge nicht mit (wie `cost`).
7. **Anzeige, so weit die Karte sie verlangt**: Das Etikett auf der Karte bleibt, wie es ist (Schätzung; Alt-Posten wie bisher). Der Reiter „Kosten“ zeigt zusätzlich die Einträge (Zeitpunkt, Rolle, Spalte, Betrag) mit Summe je Währung. Der Bericht „Kosten“ zählt **angefallene** Kosten: Einträge plus Alt-Posten je Währung, die Alt-Posten sichtbar als eigene Zeile „ohne Datum / ohne Rolle / ohne Spalte“; eine reine Schätzung (`amount`, `min` + `max`) zählt er nicht mehr. Das löst die Summenkriterien von R00105 ab.

## Konsequenzen

**Positiv:** Aufgaben ohne Schätzung können Einträge tragen. Ältere Versionen lesen neue Dateien ohne Defekt und schreiben `cost-entries` als unbekannten Schlüssel wieder aus (Blockform statt Flusszeile, Inhalt gleich). Kein Schritt überführt Daten, also kann keiner Posten verlieren.

**Negativ / Inkauf:** Alt-Posten bleiben dauerhaft im Eimer „ohne …“. Eine ältere Version kennt die Route nicht (404) — die Factory fällt dann auf einen Posten im Etikett zurück. Beträge unter einem Cent rundet der Aufrufer. Der Bericht „Kosten“ nennt nach dieser Karte andere Zahlen als bisher (angefallen statt geschätzt).

**Durchsetzung:**
- Format-Test zuerst: eine Datei mit `cost.items` **und** `cost-entries` übersteht Lesen und Schreiben zeichengleich; dieselbe Datei durch den Stand vor dieser Karte gelesen und geschrieben, verliert keinen Eintrag und ist nicht defekt.
- API-Test: jede Regelverletzung und jeder Typfehler ist 400, die Zahl der Commits bleibt gleich; `PATCH cost` lässt `cost-entries` unverändert.

**Folgeentscheidungen / Aufgaben:**
- [ ] Auswertungen nach Zeitraum (#165) und Rolle (#167) samt Eimer für Einträge, deren Spalte es auf dem Board nicht mehr gibt.
- [ ] Factory schreibt je Rollenlauf über die neue Route (Folge des Directors, nicht Teil der Karte).

## Quellen / Bezuege

- Karte #166 (Wortlaut, Abnahme-Probe, Abgrenzung); ADR-0009; R00015, R00084, R00090, R00097, R00105
- `src/modell/kosten.rs`, `src/modell/aufgabe.rs:14–64`, `src/format/aufgabe.rs:11`, `:83–86`, `:278–282`, `:435–443`, `src/dienst/zeiten.rs`, `src/dienst/aufgabe_aendern.rs:9–16`, `src/web/mod.rs:1036–1071`, `web/kosten.js:61–74`
