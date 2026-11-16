# ADR-0030: Markdown aus fremdem Text — erst maskieren, feste Elementliste, Adressen nach Positivliste

**Status**: Akzeptiert
**Datum**: 2026-11-16
**Entscheider**: Claude (autonom, architekt, Auftrag Betreiber, Karten #184, #185, #186)
**Kontext-Anforderung**: R00030 „Beschreibung als Markdown lesen“; Karten #184 (Tabellen), #185 (Inline in Teilaufgaben), #186 (geschachtelte Listen, Trennlinie, `_kursiv_`, Durchstreichen, Kommentare) — Anforderungen folgen über den planer.
**Erprobt durch**: Proben mit `node` am heutigen `web/markdown.js` (Stand `23a91b1`): `<script>` bleibt Text, `javascript:` und `data:` ergeben keinen Link; **Lücke gefunden**: `[x](\u0001javascript:alert%281%29)` ergibt heute einen Link (siehe Kontext). Ausführung im Browser nicht geprobt.
**Nachträge**: 2026-11-16 (Karte #184, R00176): Punkt 3 um die drei festen Attribute der Tabellen-Hülle ergänzt; die Strukturprüfung (`e2e/einheit/hilfen/markdown-struktur.js`) kennt die Hülle nur in dieser einen Form. 2026-11-16 (Karte #184, nach dem Security-Review): Punkt 9 „Die Ausgabe bleibt in der Größenordnung der Eingabe“ — gemessen 12 KB → 36 MB in 7,6 s ohne Grenze, 18 KB in 8 ms mit ihr. 2026-11-16 (Karte #186, R00178): Punkt 6 um die Zeichen ergänzt, die einen Bezeichner fortsetzen (sonst würde `__init__.py` fett), und um `~~durchgestrichen~~`; Punkt 5 um den Schutz der drei Formen samt Inhalt; Punkt 9 um die Tiefe geschachtelter Listen (höchstens acht Ebenen); die Strukturprüfung prüft zusätzlich die Schachtelung als feste Grammatik.

## Kontext

- Beschreibungen, Teilaufgaben und Kommentare sind fremder Text, auch von Agenten über die API geschrieben. Die Oberfläche setzt keine Content-Security-Policy (Suche nach `content-security` in `src/` ohne Treffer); der Renderer ist die einzige Schranke.
- `web/markdown.js` (49 Zeilen, ohne Abhängigkeit; `web/` hat kein `package.json`) arbeitet zeilenweise in einem Durchlauf mit zwei offenen Zuständen (Absatz, Liste). Jede Zeile läuft durch `inline()`, das als Erstes `esc()` aufruft (`:9`); Codeblöcke laufen direkt durch `esc()` (`:29`). Danach entstehen nur Marken, die der Renderer selbst schreibt. Inline-Code wird vor dem Formatieren durch Platzhalter ersetzt (`:9`, `:13`), Links nicht.
- Adressen prüft `erlaubt()` (`:4`): `http`, `https`, `mailto`, `vscode` oder „kein Schema erkennbar“. Der zweite Zweig ist eine Negativprüfung: eine Adresse mit führendem Steuerzeichen (U+0001–U+001F außer Leerraum) hat für den Ausdruck kein Schema, der Browser entfernt das Zeichen aber und liest `javascript:` (geprobt: `new URL('\u0001javascript:…').protocol === 'javascript:'`).
- Weil Links nicht geschützt sind, formatiert die Hervorhebung in Adressen hinein: `https://example.org/a*b*c` erhält heute `<em>` im `href` (geprobt). Mit `_kursiv_` (#186) träfe das jede Adresse mit Unterstrich.
- Einziger Test der Regel bisher: `e2e/einheit/markdown.test.js:16–23` (ein `javascript:`-Fall, ein `<script>`-Fall, ein Attribut-Ausbruch).

## Optionen

1. **Eigener Renderer bleibt, Regel wird fest** — klein, keine Abhängigkeit, die Sicherheit steht auf einer Reihenfolge, die in 50 Zeilen lesbar ist; Schwäche: GFM-Randfälle (Tabelle in Liste, Fortsetzungszeilen) werden bewusst nicht nachgebaut.
2. **Bibliothek mit Bereiniger (z. B. markdown-it oder marked mit DOMPurify)** — die ehrlichere Antwort für vollständiges GFM; Schwäche: zwei fremde Pakete in einer Oberfläche ohne Paketverwaltung und Bündelung, und die Sicherheit läge im Bereiniger statt in der Bauart.
3. **Rendern auf dem Server** — eine Stelle für Browser und API; Schwäche: neuer Vertrag der API und doppelte Regel, solange der Browser Entwürfe zeigt.

## Entscheidung

Option 1. Für jeden Aufruf des Renderers (Beschreibung, Teilaufgabe, Kommentar und alles Künftige) gilt:

1. **Erst maskieren, dann formatieren.** Jeder Text aus der Datei läuft durch `esc()`, bevor eine Marke entsteht; U+0000 wird vorher entfernt (Platzhalterzeichen). Es gibt keinen Weg, auf dem Text unmaskiert in die Ausgabe gelangt — kein rohes HTML, keine HTML-Kommentare, keine Entitäten.
2. **Feste Elementliste.** Der Renderer schreibt nur: `p br h2`–`h6 ul ol li blockquote pre code strong em del hr a table thead tbody tr th td` und eine `div`-Hülle um die Tabelle. **Nie** `img` oder ein anderes Element, das eine fremde Adresse lädt; `![alt](url)` bleibt Text mit Link.
3. **Feste Attributliste.** Aus dem Text stammt allein der Wert von `href`. `target="_blank"` und `rel="noopener"` stehen an jedem Link. Sonst nur feste Klassen aus dem Renderer; die Ausrichtung einer Tabellenspalte ist eine von drei festen Klassen (links, Mitte, rechts) — nie `style`, nie `align`, nie ein Klassenname aus dem Text. Die Hülle der Tabelle trägt fest `tabindex="0"`, `role="group"` und `aria-label="Tabelle"` für die Tastatur — diese drei Attribute stammen aus dem Renderer, nie aus dem Text.
4. **Adressen nach Positivliste.** Ein Link entsteht nur, wenn die Adresse kein Zeichen ≤ U+0020 und kein U+007F enthält **und** mit `http:`, `https:`, `mailto:` oder `vscode:` beginnt (ohne Groß-/Kleinschreibung) **oder** kein Schema trägt (relativ). Alles andere — `javascript:`, `data:`, `vbscript:`, `file:`, `blob:` — bleibt Text ohne Link.
5. **Geschütztes wird nicht formatiert.** Inline-Code und Adressen (das Ziel eines Links und der Text einer nackten Adresse) werden vor der Hervorhebung durch Platzhalter ersetzt. Der Text eines `[Text](Adresse)` wird formatiert, die Adresse nie. Nachtrag #186: auch `_…_`, `__…__` und `~~…~~` werden samt Inhalt sofort durch einen Platzhalter ersetzt — die Sterne danach schließen nie über ihre Marke hinweg, Marken liegen nie über Kreuz.
6. **Unterstrich nur an Wortgrenzen.** `_kursiv_` und `__fett__` öffnen nur nach Zeilenanfang oder einem Zeichen, das weder Buchstabe, Ziffer noch Unterstrich ist, und schließen nur vor einem solchen oder dem Zeilenende; `cost_from_column` und `__init__.py` bleiben Text. Die Regel für `*` bleibt, wie sie ist. Nachtrag #186: dieselbe Regel gilt für `~~durchgestrichen~~`. Enger als oben geschrieben: die Form öffnet auch nicht nach einem Wortzeichen mit `.`, `-`, `/`, `:`, `@` oder `\` dahinter (`obj.__dict__`) und schließt nicht vor einem dieser Zeichen mit Wortzeichen dahinter (`__init__.py`) oder vor `(` (`__init__()`) — der Punkt allein ist kein Wortende. Der Inhalt beginnt und endet ohne Leerraum und enthält das eigene Zeichen nicht; die Suche endet so am nächsten Zeichen derselben Art, ohne Rücklauf.
7. **Zwei Einstiege, ein Kern.** `markdownHtml(md, stufe)` für Blöcke und `markdownInline(text)` für eine Zeile ohne Blöcke teilen dieselbe Inline-Stufe; die Karte auf dem Board zeigt weiter reinen Text über `esc()`.
8. **Ein Link steht nie in einem Knopf** — weder in `button` noch in einem Element mit `role="button"` (R00162).
9. **Die Ausgabe bleibt in der Größenordnung der Eingabe.** Wo der Renderer mehr schreibt, als im Text steht — eine Tabelle füllt kurze Zeilen auf die Spaltenzahl des Kopfs auf —, gilt eine feste Obergrenze: höchstens 50 Spalten je Tabelle und höchstens 5000 Zellen je Aufruf (alle Tabellen eines Textes, Kopfzeilen mitgezählt). Darüber bleibt der ganze Block Text; die Spaltenzahl wird vor dem Zerlegen an den Strichen der Trennzeile geprüft, damit auch die Rechenzeit mit der Eingabe wächst und nicht mit Spalten × Zeilen. Nachtrag #186: geschachtelte Listen gehen höchstens acht Ebenen tief, darüber bleibt die Einrückung flach — die Ausgabe wächst mit der Zahl der Zeilen, nie mit der Tiefe (gemessen: 5000 Zeilen mit steigender Einrückung, 12,5 MB → 50 KB; 1 MB gemischter Kommentar → 1,8 MB in etwa 0,1 s). Nachtrag #186 (Security-Review, Befund M1): der Punkt gilt auch für die Rechenzeit — sie wächst linear mit der Länge einer Zeile. Die Klasse heißt „öffnendes Zeichen ohne Gegenstück“: ein Muster, das von jedem öffnenden Zeichen bis zum Zeilenende sucht, rechnet quadratisch (`[` 200 000-mal: 51 s). Links erkennt deshalb ein Durchlauf von Hand statt eines Ausdrucks; jeder Ausdruck des Renderers hat in `e2e/einheit/markdown-laufzeit.test.js` seinen Fall „lange Zeile ohne Gegenstück“.

Akzeptierte Schwäche: kein vollständiges GFM. Eine Tabelle in einer Liste, Fortsetzungszeilen in Listenpunkten und verschachtelte Zitate gibt es nicht; was der Renderer nicht kennt, bleibt lesbarer Text.

## Konsequenzen

- Punkt 4 schließt die heutige Lücke; sie wird mit der ersten der drei Karten (#184) behoben.
- Punkt 5 ändert eine heutige Ausgabe: Adressen mit `*…*` behalten ihr `href` unverändert — die einzige gewollte Abweichung im festen Vergleich.
- Durchsetzung: (a) ein Einheitentest fährt eine Liste feindlicher Texte durch **beide** Einstiege und prüft jede Marke der Ausgabe gegen Element- und Attributliste (Punkte 2 und 3) und jedes `href` gegen Punkt 4; (b) ein fester Vergleich „vorher = nachher“ über gespeicherte Paare Eingabe → Ausgabe des heutigen Renderers; (b2, seit #186) die Strukturprüfung liest jede Ausgabe als feste Grammatik: jede Marke schließt, was sie geöffnet hat, `li` steht nur in `ul`/`ol`, eine Liste nur ganz außen oder direkt in einem `li`, `hr` nur ganz außen und ohne Attribut; (c) Review-Punkt des security-reviewer bei jeder Änderung an `web/markdown.js`.
- Eine Content-Security-Policy wäre die zweite Schranke; sie ist nicht Teil dieser Entscheidung.

## Quellen / Bezüge

- `web/markdown.js:3–14`, `:17–46`; `web/ansicht.js:393` (Beschreibung), `:458` (Kommentare), `:463` (Teilaufgaben), `:883` (Karte auf dem Board); `e2e/einheit/markdown.test.js`
- R00030 (Elemente und Schemata), R00162 (Lesefläche ohne Knopfrolle), ADR-0018 (Überschriftenstufen aus dem Renderer)
