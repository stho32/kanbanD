# ADR-0009: Kosten je Aufgabe — Dollarbeträge als Dezimalzahl in der Datei, gerechnet in ganzen Cent; eine Prüfung für Datei und API, jeder Fehler im Rumpf `cost` ist 400

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #18 „Preisetikett je Aufgabe“ (Fassung 2026-11-01); Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: Probe im Scratchpad (2026-11-06, nicht committet): 100.001 Cent-Werte 0,00–1.000,00 $ plus Ränder bis 1.000.000,00 $ im Rundlauf Schreiben → YAML → Zahltext → Cent und JSON → Zahltext → Cent, 0 Abweichungen; JavaScript `Math.round(x * 100)` über dieselbe Spanne, 0 Abweichungen; Gegenprobe Gleitkomma: Mitte von 0,60 und 1,61 ergibt 1,10 statt kaufmännisch 1,11, `0.1 + 0.2 + 0.3` ergibt 0.6000000000000001

## Kontext

Die Karte #18 verlangt einen Abschnitt `cost` im Frontmatter der Aufgabe. Die Regeln stehen in `AI-Team/po-entscheidungen.md`, Z. 20, 28–33 und 45–46:

- `cost: {amount | min + max, currency, basis, items?}`. Ein Betrag und eine Spanne stehen nie zugleich da, min ≤ max, alle Werte ≥ 0, `basis` ist Pflicht. Ohne Schlüssel gibt es kein Etikett.
- `items: [{text, amount} | {text, min, max}, tokens?]`. Sind Positionen da, sind die Gesamtwerte ihre Summen und werden nicht gespeichert. Positionen und Gesamtangabe zugleich ergeben 400. `tokens` ist eine ganze Zahl ≥ 0 und dient nur der Anzeige.
- Die Karte zeigt einen Betrag mit „≈“: bei einer Spanne die Mitte (min + max) / 2, kaufmännisch auf Cent gerundet, im deutschen Zahlenformat. Im Detail steht ein Reiter „Kosten“, der in der ersten Ausbaustufe nur lesend ist. Der Bericht zeigt die Summen der Unter- und Obergrenzen getrennt, je Währung, mit „n von m Karten mit Etikett“ und der gemeinsamen Filterleiste.
- Abgeleitete Werte (Mitte, Summen) werden gerechnet und nie gespeichert. Es gilt überall Dollar, kanbanD rechnet nie zwischen Währungen um.
- Abnahme-Probe der Karte: Betrag und Spanne zugleich oder min > max ergeben 400.

Belege im Code (Stand b55b990):

- `src/format/aufgabe.rs:43–80`: Unbekannte Schlüssel landen in `weitere` und bleiben erhalten. Ein formwidriger bekannter Schlüssel (`reporting`, `reservation`, `key`) ist ein `Formatfehler`, die Datei gilt dann als defekt und ist nur lesbar (423). `key` prüft beim Lesen eine Regel des Modells (`Fremdschluessel::pruefen`, R00098). Das ist der Vorläufer für Inhaltsregeln, die allein am Wert hängen.
- `src/format/yaml.rs:6–19`: `skalar` schreibt Texte so, dass YAML sie als denselben Text zurückliest (Rücklese-Test, R00098/#4). Zahlen schreibt kanbanD bisher nur als ganze Zahlen (`id`).
- `src/modell/aufgabe.rs:389–445`, `:500–600`: Die Tür für Felder der Aufgabe ist `PATCH /api/aufgaben/{nr}` (`Aufgabenaenderung` → `Aufgabe::aendern` → `Fehler::Ungueltig` → 400). Entfernbare Felder sind `Option<Option<T>>`, und `null` entfernt den Wert. `PATCH /api/aufgaben/mehrere` nimmt dieselbe Änderung über `flatten`.
- `tests/termine.rs:31`: Ein Rumpf, den serde nicht in den Zieltyp bringt, beantwortet axum mit **422**, nicht mit 400. Würde `cost` typisiert deserialisiert, käme jeder Typfehler als 422 an. Die Abnahme der Karte verlangt aber 400.
- `web/berichte.js:437–545`: Die Berichte rechnen rein im Browser (R00100 „Bestand nach Labels“, Filter über `aufgabePasst`, getestet mit `node --test e2e/einheit/`). Den Kostenbericht rechnet also JavaScript.
- Bestand am 2026-11-06 (nur gelesen): Keine der 372 Aufgabendateien unter `~/Projekte/Kanban-Boards/` trägt `cost:` oder `price:`.

Lastprofil (`AI-Team/umgebung.md`): bis 5.000 Aufgaben je Ordner, lesend p95 < 200 ms. Die Rechnung über alle Karten ist eine Summe je Aufgabe und spielt dafür keine Rolle.

## Optionen

### Option A: Dezimalzahl in Dollar in der Datei (`min: 0.60`), streng gelesen über den Zahltext, gerechnet in ganzen Cent (`i64` bzw. ganzzahliger `Number` im Browser)
- Vorteile: Die Datei ist für Menschen lesbar und von Hand änderbar, in der Sprache der Karte („0,60–1,60 $“). Es gibt keine neue Abhängigkeit. Summen und Mitte sind exakt. Höchstens zwei Nachkommastellen heißt: Was die Positionen zeigen, ergibt genau die gezeigte Summe.
- Nachteile: YAML liefert Zahlen als `f64`. Der Leser muss deshalb den kürzesten Zahltext (`Number::to_string`) streng als Dezimalzahl lesen. Die Probe zeigt, dass das bis 1.000.000 $ verlustfrei ist. Schwäche: Ein Betrag mit drei Nachkommastellen (0,004 $) ist nicht darstellbar und wird abgewiesen. Die Factory muss je Position auf Cent runden, bevor sie schreibt.

### Option B: YAML-Zahl als `f64`, gerechnet in Gleitkomma, gerundet erst bei der Anzeige
- Vorteile: Diese Option ist am wenigsten Code und braucht kein eigenes Lesen.
- Nachteile: Die Probe zeigt den Fehler. Die Mitte von 0,60 und 1,61 ergibt 1,10 statt 1,11, und Summen tragen Reste (0.6000000000000001). Das verletzt „kaufmännisch auf Cent“ (PO Z. 30). Außerdem rechnen Rust und JavaScript zwei Gleitkomma-Ketten, die auseinanderlaufen können. Schwäche: Der Fehler ist selten und klein, darum fällt er erst in der Abnahme auf.

### Option C: Ganze Cent in der Datei (`min_cents: 60`) und in der API
- Vorteile: Diese Option ist ohne jede Deutung eindeutig, und Typverwechslungen gibt es nicht.
- Nachteile: Sie widerspricht den entschiedenen Schlüsseln `amount`, `min` und `max` (PO Z. 28), und ein Mensch liest „160“ nicht als 1,60 $. Schwäche: Die Datei verliert ihre Lesbarkeit ohne kanbanD (Vision „Ein Kanban, das ein Ordner ist“).

### Option D: Dezimaltext in Anführungszeichen (`min: "0.60"`) mit einer Dezimal-Bibliothek
- Vorteile: Die Genauigkeit ist beliebig, und es gibt keinen Umweg über `f64`.
- Nachteile: Das ist eine neue Abhängigkeit für ein Problem, das ganze Cent vollständig lösen. Ein von Hand geschriebenes `min: 0.60` ohne Anführungszeichen wäre formwidrig, und genau diese Typverwechslung zwischen Text und Zahl hatte `report-labels` (R00100). Schwäche: Die Oberfläche bräuchte dieselbe Bibliothek oder einen eigenen Dezimal-Code.

## Entscheidung

**Gewählt: Option A.** Dazu gelten die Regeln zu Prüfort, Tür und Rechnung unten.

1. **Form in der Datei.** Ein Schlüssel `cost` steht im Frontmatter der Aufgabe, als Block in fester Reihenfolge: `currency`, dann `amount` oder `min` + `max`, dann `basis`, dann `items`. Jede Position steht als Flusszuordnung in einer Zeile mit `text`, `amount` oder `min` + `max` und `tokens`. Geldwerte schreibt kanbanD immer mit genau zwei Nachkommastellen ohne Anführungszeichen (`0.60`, `17.00`). Texte (`basis`, `text`) gehen über `yaml::skalar`, `tokens` ist eine ganze Zahl. Beispiel:
   ```yaml
   cost:
     currency: USD
     basis: "Token-Messung je Rolle, Opus 5.5, Preisstand 2026-10-06"
     items:
       - {text: architekt, min: 0.04, max: 0.10, tokens: 67924}
       - {text: Gemeinkostenanteil, amount: 0.30}
   ```
2. **Lesen der Geldwerte.** Ein Geldwert muss eine YAML- bzw. JSON-**Zahl** sein. Ein Text wie `"1.63"` oder `1,63` ist formwidrig. Gelesen wird der kürzeste Zahltext der Zahl (`Number::to_string`), streng als `Ziffern[.Ziffern]` mit höchstens zwei Nachkommastellen, ≥ 0 und ≤ 1.000.000. Das Ergebnis ist ein Wert in ganzen Cent. `1.005`, `-1`, `.inf` und `.nan` werden abgewiesen. `0x11` und `1e2` liest YAML selbst als Zahl (17 bzw. 100.0) und sie gelten deshalb. Beim nächsten Schreiben stehen sie als `17.00` bzw. `100.00` da.
3. **Inhalt im Modell, ein Typ, unmögliche Zustände nicht darstellbar.** `Kosten { waehrung, basis, wert: Gesamt }` mit `Gesamt = Betrag(Cent) | Spanne { min: Cent, max: Cent } | Positionen(Vec<Position>)` und `Position { text, wert: Betrag | Spanne, tokens: Option<u64> }`. Ein Konstruktor im Modell prüft alle Inhaltsregeln an einer Stelle:
   - `currency` hat genau drei Großbuchstaben A–Z und wird nicht normalisiert.
   - `basis` und `text` sind nach dem Trimmen nicht leer.
   - min ≤ max.
   - Ein Betrag steht nie zugleich mit einer Spanne da, Positionen stehen nie zugleich mit einer Gesamtangabe da.
   - Es gibt mindestens eine und höchstens 100 Positionen.

   Das Format (Datei) und die API rufen denselben Konstruktor. Das weicht bewusst von „Format liest die Form, Dienst prüft den Inhalt“ (R00100) ab, weil diese Regeln allein am Wert hängen und keinen Kontext des Boards brauchen. Vorbild ist `key` (R00098).
4. **Fehlerwege.** In der Datei ist eine verletzte Form oder Regel ein `Formatfehler` mit Pfad (`cost.items[1]: min > max`), und die Aufgabe ist defekt und nur lesbar wie bei `reporting`. In der API ist **jeder** Fehler im Rumpf `cost`, auch ein Typfehler, **400** mit derselben Meldung. Dafür kommt `cost` in `Aufgabenaenderung` als rohes JSON (`serde_json::Value`, entfernbar) an. Er wird nicht typisiert deserialisiert, sonst antwortet axum mit 422. Danach geht er durch denselben Leser wie das Frontmatter, und JSON → `serde_yaml::Value` ist für Zahlen verlustfrei (Probe). Ein unbekannter Schlüssel in `cost` oder in einer Position ist in der API 400 („cost: unbekannter Schlüssel „ammount““). In der Datei bleibt er erhalten (`weitere`, wie `reporting`).
5. **Tür.** Es gibt keinen eigenen Endpunkt. `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` bekommen das Feld `cost`. Ein Wert **ersetzt** den ganzen Abschnitt, Positionen werden nicht gemischt. `null` entfernt den Abschnitt, und fehlt das Feld, bleibt der Abschnitt unverändert. Der Commit heißt „#n geändert: Kosten“, und ohne Änderung gibt es keinen Commit. `GET` liefert `cost` in den Schlüsseln der Datei, Geldwerte als JSON-Zahl in Dollar. Unbekannte Schlüssel aus der Datei liefert `GET` nicht aus. Die OpenAPI beschreibt `cost` mit eigenem Schema (`value_type`) samt 400.
6. **Rechnen.** Gerechnet wird ausschließlich in ganzen Cent. Die Oberfläche wandelt jeden Geldwert genau einmal an der Grenze mit `Math.round(x * 100)` um. Sie rechnet Gesamtwerte aus Positionen (Summe der Unter- bzw. Obergrenzen, ein Betrag zählt als min = max), die Mitte `Math.floor((min + max + 1) / 2)` und die Berichtssummen je Währung in einem reinen Modul neben `web/berichte.js`, das `node --test` testet. Erst beim Anzeigen wird formatiert (`Intl.NumberFormat('de-DE')`, zwei Nachkommastellen, Symbol hinter dem Betrag). Der Server rechnet weder Summen noch Mitte und liefert keine abgeleiteten Werte aus. So kann ein `GET` → `PATCH` keine Ableitung in die Datei tragen.
7. **Bestand.** Eine Aufgabe ohne `cost` hat kein Etikett, wird unverändert gelesen und geschrieben und bekommt keine neue Zeile. Heute trägt keine Aufgabe den Schlüssel. Aufgaben, die ihn später von Hand formwidrig bekommen, werden defekt gemeldet und nicht still verworfen.

## Konsequenzen

**Positiv:**
- Die Abnahme-Probe der Karte (Betrag und Spanne zugleich oder min > max ergeben 400) greift an einer Stelle, für Datei und API gleich.
- Mitte und Summen sind exakt und kaufmännisch, und die gezeigten Positionen ergeben die gezeigte Summe.
- Es gibt keine neue Abhängigkeit, keinen neuen Endpunkt und keine neue Fehlerart. 400 ist auf `PATCH /api/aufgaben/{nr}` schon beschrieben und in der Oberfläche behandelt. Die erste Ausbaustufe schreibt `cost` nicht aus der Oberfläche, deshalb braucht kein Frontend-Aufrufer einen neuen Fall (Lehre #48).

**Negativ / Inkauf zu nehmen:**
- Beträge unter einem Cent sind nicht darstellbar. Die Factory rundet je Position auf Cent, bevor sie schreibt. Über zehn Positionen kann die Summe dadurch bis zu 5 ct von der ungerundeten Messung abweichen. Das liegt weit innerhalb der Spanne, die die Basis ohnehin ausweist.
- Ein von Hand geschriebener Text statt einer Zahl (`amount: "1.63"`, `1,63`) macht die Aufgabe defekt und nur lesbar, bis die Datei repariert ist. Das ist streng, aber sichtbar, wie bei `reporting`.
- `PATCH` mit `cost` ersetzt den ganzen Abschnitt. Unbekannte Schlüssel, die jemand von Hand in `cost` geschrieben hat, gehen dabei verloren.
- Die Grenzen 1.000.000 $ je Wert und 100 Positionen sind technische Schutzwerte (exakte `f64`- und JavaScript-Rechnung, Dateigröße). Sie sind keine Produktregel und können angehoben werden, solange die Rundlauf-Probe grün bleibt.

**Durchsetzung:**
- Format-Test: Rundlauf aller Cent-Werte 0–100.000 plus Ränder (999.999, 99.999.999, 100.000.000) zeichengleich. Texte aus `yaml::tests::jeder_text_im_rundlauf` stehen als `basis` und `text` im Rundlauf.
- API-Test: Jede Regelverletzung **und** jeder Typfehler im Rumpf `cost` ergibt 400, nie 422 und nie 500.
- Einheitstest Oberfläche: Die Mitte von 0,60 und 1,61 ist 1,11. Die Summe 0,10 + 0,20 + 0,30 ist 0,60.
- Review-Punkt für `architektur-reviewer` und `code-reviewer`: kein Gleitkomma-Rechnen mit Geldwerten außerhalb der einen Umwandlung an der Grenze.

**Folgeentscheidungen / Aufgaben:**
- [ ] Welche Karten der Kostenbericht zählt (Spalten, archivierte Karten) und worauf der Zeitraum der Filterleiste wirkt. Das sind Produktfragen und gehen an den product-owner, bevor der planer den Bericht schneidet.
- [ ] Ein Bearbeiten im Reiter „Kosten“ (spätere Ausbaustufe) führt 400 als neuen Fall in einen Frontend-Aufrufer ein. Dieser Aufrufer braucht dann die Meldung am Feld (Lehre #48).

## Quellen / Bezuege

- `AI-Team/po-entscheidungen.md` Z. 18–23, 28–33, 45–46; Karte #18 (Kommentar 2026-11-01)
- `src/format/aufgabe.rs:43–80` (Lesen, `weitere`, `key` mit Modellregel), `:117–144` (`reporting`), `:330–370` (Schreiben); `src/format/yaml.rs:6–19` (`skalar`, Rücklese-Test)
- `src/modell/aufgabe.rs:389–445` (`Aufgabenaenderung`, `entfernbar`), `:500–600` (`aendern`); `src/dienst/aufgabe_aendern.rs` (Fehler → `Ungueltig`)
- `src/web/mod.rs:152` (400), `:704–720` (`PATCH /api/aufgaben/{nr}`); `tests/termine.rs:31` (422 bei serde-Fehlern)
- `web/berichte.js:437–545` (Berichtsrahmen und Filter, R00100)
- ADR-0003 (strukturierte Abweisungen; hier nicht nötig, `Fehlerantwort` genügt), Lehren R00098/#4 (Rücklese-Rundlauf), R00104/#48 (neuer Fehlerstatus bis in jeden Frontend-Aufrufer)
