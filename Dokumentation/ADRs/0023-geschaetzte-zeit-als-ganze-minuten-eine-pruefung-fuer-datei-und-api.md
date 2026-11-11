# ADR-0023: Geschätzte Zeit je Karte — ganze Minuten in der Datei, Anzeige `h:mm` erst beim Zeichnen; eine Prüfung für Datei und API, jeder Fehler 400

**Status**: Akzeptiert
**Datum**: 2026-11-11
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #37 „Feld „geschätzte Zeit" je Karte (rein informativ)" (angelegt 2026-11-11); Entscheidung des Auftraggebers `AI-Team/po-entscheidungen.md:61` (2026-11-03); Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: Probe im Scratchpad (2026-11-11, nicht committet): `estimate: 2:30` liest serde_yaml 0.9.34 als Text „2:30", PyYAML 6.0.2 als Zahl 150, Ruby Psych als Zahl 9000 — dieselbe Datei bedeutet je Werkzeug etwas anderes; `estimate: 150` liest sich in allen dreien als 150.

## Kontext

Die Karte #37 verlangt ein optionales Feld „geschätzte Zeit" je Karte. Der Auftraggeber hat nach Beratung des product-owners entschieden (`AI-Team/po-entscheidungen.md:61`, 2026-11-03):

- Keine Story Points. Ja zu einem Feld „geschätzte Zeit" je Karte (wie Kanbanflow „Time estimated").
- Nur eingeblendet, wenn gesetzt; rein informativ — keine Auswertung, Prognose oder Warnung rechnet damit.

Das verträgt sich mit dem Nicht-Ziel „Auswertungen rechnen aus dem, was geschehen ist" (`Anforderungen/R00000-vision.md:183`), solange keine Auswertung den Wert nutzt. Für „nur eingeblendet, wenn gesetzt" gibt es das Vorbild: die gebuchte Zeit zeigt die Karte schon als `Σ h:mm`, leer bei 0 (R00089, `web/ansicht.js:562–568`, `:578–590`).

Belege im Code (Stand 92718c9):

- `estimate` ist heute ein **unbekannter** Schlüssel. `BEKANNT` (`src/format/aufgabe.rs:11`) führt 15 Namen ohne `estimate`; alles Unbekannte landet in `weitere` und wird beim Schreiben wieder ausgegeben (`:78–82`, `:405–413`). Der Test `handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel` (`:556–569`) benutzt genau `estimate: 3` als Beispiel eines unbekannten Schlüssels, der den Rundlauf übersteht. Gelesen, gesetzt, geprüft oder angezeigt wird der Wert nicht.
- Die Tür für Felder der Aufgabe ist `PATCH /api/aufgaben/{nr}` (`Aufgabenaenderung` → `Aufgabe::aendern` → `Fehler::Ungueltig` → 400). Entfernbare Felder sind `Option<Option<T>>`, `null` entfernt den Wert (`src/modell/aufgabe.rs:434–458`, Vorbild `faellig` `:443–444` und `:552–560`). `PATCH /api/aufgaben/mehrere` nimmt dieselbe Änderung (`src/web/endpunkte.rs:56`).
- `cost` (ADR-0009) hat denselben Zuschnitt schon gebaut: kanonisch in der Datei, eine Prüfung für Datei und API, jeder Fehler 400, weil `cost` als rohes JSON ankommt und nicht typisiert deserialisiert wird (`src/modell/aufgabe.rs:450–453`, `:593–595`).
- Ein Rumpf, den serde nicht in den Zieltyp bringt, beantwortet axum mit **422**, nicht mit 400 (`tests/termine.rs:31`).
- Dauer in Minuten: `uhr::dauer_lesen` und `uhr::hm` (`src/uhr.rs:117–119`, `:122–137`); im Browser `hm` über `web/zeiten.js`/`web/ansicht.js`. Die Anzeige folgt ADR-0013: Deutsch erst beim Zeichnen, Daten bleiben maschinell.

## Optionen

### Option A: Ganze Minuten als Zahl in der Datei (`estimate: 150`) und in der API
- Vorteile: Eindeutig für jeden YAML- und JSON-Leser; genau eine Zahl, keine Deutung. Keine neue Abhängigkeit, keine eigene Grammatik. Die Anzeige rechnet einmal mit dem vorhandenen `hm` (`150 → 2:30`). Gleiche Linie wie `cost` in ganzen Cent: der gespeicherte Wert ist die kanonische Zahl, das Anzeigebild entsteht erst beim Zeichnen.
- Nachteile: Ein Mensch liest „150" nicht als „2 h 30", sondern muss umrechnen. Schwäche: Von Hand geschrieben ist `estimate: 2` zwei Minuten, nicht zwei Stunden — die Einheit steht nur im Feldnamen und in der Doku.

### Option B: Dauertext in der Datei (`estimate: 2:30`), gelesen über `uhr::dauer_lesen`
- Vorteile: Die Datei ist ohne Umrechnen lesbar, in der Sprache der Karte (`2:30`), und `dauer_lesen` nimmt schon `0:45`, `1,5`, `90 min`, `20m`.
- Nachteile: Die Probe zeigt die Falle. `2:30` liest serde_yaml als Text, PyYAML als 150, Ruby Psych als 9000 — dieselbe Datei bedeutet je Werkzeug etwas anderes. Die Factory und Agenten lesen Board-Dateien mit Python, `yq` oder Ruby; ein Wert, der woanders still eine andere Zahl ist, ist kein Speicherformat. Schwäche: Um die Mehrdeutigkeit zu bannen, müsste kanbanD den Text beim Schreiben quoten (`"2:30"`), was die Handschreibbarkeit gerade wieder nimmt.

### Option C: Ganze Sekunden in der Datei (`estimate: 9000`)
- Vorteile: Wie A eindeutig, und beliebig fein.
- Nachteile: Nutzlos fein — eine geschätzte Zeit ist nie sekundengenau — und noch schwerer zu lesen als A. Schwäche: Sekunden verleiten zu Scheingenauigkeit in einem rein informativen Feld.

### Option D: ISO-8601-Dauer (`estimate: PT2H30M`) oder `estimate: {h: 2, m: 30}`
- Vorteile: Genormt bzw. ohne Umrechnen fürs Auge; ein Objekt könnte später eine Spanne tragen.
- Nachteile: Neue Grammatik bzw. neuer Namensraum für einen rein informativen Wert; `PT2H30M` liest kein Mensch flüssig und kein vorhandener Helfer. Schwäche: mehr Code als das Feld wert ist. Eine Spanne verlangt niemand (Karte, PO Z. 61).

## Entscheidung

**Gewählt: Option A.** Dazu gelten die Regeln zu Repräsentation, Prüfort und Tür unten.

1. **Form in der Datei.** Ein Schlüssel `estimate` steht im Frontmatter der Aufgabe, als ganze Zahl von **Minuten** ohne Einheit und ohne Anführungszeichen: `estimate: 150` heißt 2 h 30 min. `estimate` ist die kanonische Repräsentation; es gibt keinen zweiten Schlüssel und keine abgeleitete Angabe daneben.
2. **Lesen.** Ein Wert muss eine YAML- bzw. JSON-**Zahl** sein, ganzzahlig, ≥ 1 und ≤ 100.000 (rund 69 Tage). Gelesen wird der kürzeste Zahltext (`Number::to_string`); `2.5`, `"150"`, `150.0`, `0`, `-1`, `.inf`, `.nan` und `2:30` werden abgewiesen. Der obere Wert ist ein technischer Schutz gegen Tippfehler und Dateigröße, keine Produktregel; er darf angehoben werden, solange die Rundlauf-Probe grün bleibt. `0` gibt es nicht: eine gesetzte Schätzung ist positiv, „nicht gesetzt" ist das Fehlen des Schlüssels (PO Z. 61: nur eingeblendet, wenn gesetzt).
3. **Inhalt im Modell, ein Wert, keine Deutung.** `Aufgabe` bekommt `geschaetzte_minuten: Option<u32>`; `null`/fehlend heißt „keine Schätzung". Das Format (Datei) und die API rufen dieselbe Prüfung. `estimate` kommt in `BEKANNT` (`src/format/aufgabe.rs:11`) und in die Schreibreihenfolge, damit der Wert nicht mehr als unbekannter Schlüssel durch `weitere` läuft.
4. **Fehlerwege.** In der Datei ist eine verletzte Form ein `Formatfehler` mit Pfad (`estimate: ganze Zahl von Minuten ≥ 1 erwartet`); die Aufgabe gilt dann als defekt und ist nur lesbar (423), wie bei `reporting` und `cost`. In der API ist **jeder** Fehler im Rumpf `estimate`, auch ein Typfehler, **400** mit derselben Meldung. Dafür kommt `estimate` in `Aufgabenaenderung` wie `cost` als rohes JSON (`Option<Option<serde_json::Value>>`, entfernbar) an und geht durch denselben Leser wie das Frontmatter; sonst antwortet axum mit 422 (`tests/termine.rs:31`).
5. **Tür.** Es gibt keinen eigenen Endpunkt. `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` bekommen das Feld `estimate`. Ein Wert ersetzt den Wert, `null` entfernt ihn, ein fehlendes Feld lässt ihn unverändert. Der Commit heißt „#n geändert: Geschätzte Zeit"; ohne Änderung gibt es keinen Commit. `GET` liefert `estimate` als JSON-Zahl. Die OpenAPI beschreibt das Feld in derselben `Aufgabenaenderung` wie `cost`, samt 400 (`src/web/mod.rs:708`, `src/web/endpunkte.rs:59`).
6. **Anzeige.** Karte und Aufgabenfenster zeigen die geschätzte Zeit als `h:mm` über den vorhandenen Helfer `uhr::hm` bzw. `hm` im Browser, nur wenn der Wert gesetzt ist — auf der Karte in der unteren Zeile neben `Σ h:mm` (`.r3`, `web/ansicht.js:578–590`). Beschriftung und Feldname folgen ADR-0013 (deutsch beim Zeichnen, `FELDER`-Tabelle `estimate` → „Geschätzt", Schlüssel als Hilfstext). Die Anzeige ist eine Ableitung aus dem gespeicherten Wert und wird nie gespeichert.
7. **Kein Rechnen.** Keine Auswertung, kein Bericht, keine Prognose, keine Warnung liest `estimate` (PO Z. 61). Der Wert wird gespeichert und angezeigt, mehr nicht.
8. **Bestand.** Eine Aufgabe ohne `estimate` bekommt keine neue Zeile und wird unverändert gelesen und geschrieben. Heute trägt keine Aufgabendatei den Schlüssel als bekannten Wert; ein von Hand geschriebenes `estimate: 3` gilt nach dieser ADR als drei Minuten — die Änderung macht den bisher unbekannten Schlüssel bekannt, deshalb wird ein heute geduldetes, aber formwidriges `estimate` (z. B. `estimate: 2:30` oder `estimate: 0`) künftig als defekt gemeldet und nicht still verworfen.

## Konsequenzen

**Positiv:**
- Die Abnahme-Probe der Karte (Karte zeigt `h:mm`, nur wenn gesetzt; eine formwidrige Zahl ergibt 400) greift an einer Stelle, für Datei und API gleich.
- Keine neue Abhängigkeit, kein neuer Endpunkt, keine neue Fehlerart; 400 ist auf `PATCH /api/aufgaben/{nr}` schon beschrieben (wie `cost`).
- Die Anzeige nutzt den vorhandenen `hm` und die Linie von ADR-0013; der gespeicherte Wert ist eindeutig für alle beteiligten Werkzeuge.

**Negativ / Inkauf zu nehmen:**
- `estimate: 2` heißt zwei Minuten. Die Einheit steht nicht im Wert; sie steht in Feldname, Doku und API-Beschreibung. Wer händisch `2` für zwei Stunden schreibt, meint etwas anderes — das ist streng, aber sichtbar (die Anzeige zeigt `0:02`).
- Ein von Hand geschriebenes `2:30` oder `0` macht die Aufgabe defekt und nur lesbar, bis die Datei repariert ist — anders als heute, wo `estimate` unbekannt war und jedes Format überlebte.
- `PATCH` mit `estimate` ersetzt den Wert; es gibt weiterhin nur einen Wert, keine Spanne.

**Durchsetzung:**
- Format-Test (`src/format/aufgabe.rs`): Rundlauf ganzer Minuten 1–100.000 plus Ränder (1, 100.000) zeichengleich; `2:30`, `"150"`, `150.0`, `0`, `-1` ergeben `Formatfehler`.
- API-Test: jede Regelverletzung **und** jeder Typfehler im Rumpf `estimate` ergibt 400, nie 422 und nie 500.
- Der bestehende Test `handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel` (`:556–569`) benutzt `estimate: 3` als unbekannten Schlüssel und muss einen anderen unbekannten Schlüssel wählen, weil `estimate` jetzt bekannt ist.
- Einheitstest Oberfläche: `150 → 2:30`, `5 → 0:05`; ohne Wert kein Feld.
- Review-Punkt für `architektur-reviewer` und `code-reviewer`: keine Auswertung liest `estimate`; die Anzeige entsteht erst beim Zeichnen (kein abgeleiteter Wert in Datei oder API).

**Folgeentscheidungen / Aufgaben:**
- [ ] Schlüsselname: `estimate` (gewählt, er läuft heute schon als unbekannter Schlüssel durch die Dateien und die Probe) gegen `estimated`. Der product-owner kann den Namen kippen, ohne die Repräsentation zu ändern.
- [ ] Setzweg der ersten Ausbaustufe: nur über die API (wie `cost`, PO Z. 31), kein Eingabefeld im Fenster; ein Fenster-Setzweg ist eine spätere Ausbaustufe.
- [ ] Ort und Beschriftung auf Karte und im Fenster gehen an den planer; ADR-0013 liefert Form und `FELDER`-Eintrag „Geschätzt".
- [ ] Einheit und Obergrenze (Minuten, ≥ 1, ≤ 100.000): technischer Schutzwert, keine Produktregel.

## Quellen / Bezuege

- `AI-Team/po-entscheidungen.md:61` (Auftraggeber, 2026-11-03), `:85`, `:31`; Karte #37 (2026-11-11); `Anforderungen/R00000-vision.md:183`
- `src/format/aufgabe.rs:11` (`BEKANNT`), `:78–82` (`weitere`), `:405–413` (Schreiben), `:556–569` (Test mit `estimate: 3`); `src/format/yaml.rs:10–19` (`skalar`, Rücklese-Test)
- `src/modell/aufgabe.rs:359–397`, `:400–426` (`Aufgabe`), `:434–458` (`Aufgabenaenderung`, `entfernbar`, `faellig`), `:450–453`, `:593–595` (`cost` roh), `:552–560`, `:597–609` (`aendern`)
- `src/web/mod.rs:708`, `src/web/endpunkte.rs:56`, `:59` (PATCH-Beschreibung); `tests/termine.rs:31` (422 bei serde-Fehlern)
- `src/uhr.rs:117–119` (`hm`), `:122–137` (`dauer_lesen`); `web/ansicht.js:562–568`, `:578–590` (Karte `.r3`), R00089
- ADR-0009 (Zuschnitt: kanonisch in der Datei, eine Prüfung für Datei und API, jeder Fehler 400, keine abgeleiteten Werte gespeichert); ADR-0013 (deutsche Anzeige an der Zeichengrenze)
- Probe Scratchpad `architekt-37` (2026-11-11, nicht committet): serde_yaml 0.9.34, PyYAML 6.0.2, Ruby Psych über `estimate: 2:30` und `estimate: 150`
