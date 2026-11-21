# ADR-0040: Syntax-Hervorhebung im Worker mit Frist — Prism nie auf dem Hauptfaden, Text sofort, Farbe als spätere Auflage

**Status**: Akzeptiert
**Datum**: 2026-11-21
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #216, Lauf 216-architekt-2)
**Kontext-Anforderung**: R00217 (Karte #216, Scheibe B4). Löst [ADR-0037](0037-syntax-hervorhebung-je-hunk-seite-als-auflage-mit-grenze.md) ab: deren Punkte 1–6 und 8 gelten mit den Änderungen unten weiter, Punkt 7 (L2 allein), Punkt 9 (Sondierung als Tor) und L4 als „zu viel“ sind widerlegt.
**Erprobt durch**: Sondierung B1105 (kanbanD `8025e2fc`, Zweig `karte/216`, Messwerte `gemeinsam/scratchpad/entw1-216/messwerte.md` der Factory); Worker-Probe des architekts 2026-11-21 08:30, Last 2,5, Chromium headless aus `e2e/node_modules`, Bundle aus B1105 (Wegwerf, `gemeinsam/scratchpad/arch-216/probe/`)

## Kontext

- **Belegt (B1105)**:
  - Gutartige Patches mit 262.144 Zeichen tokenisiert Prism in 42–71 ms. Ein minifizierter Patch mit 261 Zeilen zu 1.000 Zeichen braucht 352 ms (Ziel ≤ 150 ms, M1 verfehlt).
  - Feindlicher Inhalt **innerhalb beider Grenzen** von ADR-0037 legt den Hauptfaden lahm: 64 Zeilen `<!-- ` in Markup oder Markdown brauchen im Chromium 5,4 s, JavaScript gemischt 1,4 s, PHP 1,1 s. Mit 261 Zeilen sind es in Node über 20 s.
  - Ursache sind die gierigen Regeln (`greedy: true`). `matchGrammar` gleicht sie bis zum Ende der Hunk-Seite neu ab. Die Kosten wachsen etwa quadratisch mit der Länge der Seite: 16 kB 0,4 s, 32 kB 1,5 s, 64 kB 5,5 s. Ohne die gierigen Regeln braucht der minifizierte Fall noch 185–222 ms.
  - M2: 10.000 gefärbte Zeilen brauchen im ganzen Aufbau 226 ms. Davon fallen nur 85 ms auf DOM und Layout. Den Rest kostet das Tokenisieren auf dem Hauptfaden.
  - M3 ist erfüllt: Hooks laufen nur in `highlight*`, `data-manual` wirkt, CVE-2024-53382 ist in 1.30.0 behoben.
- **Belegt (Probe des architekts, Node)**: Eine Grenze von 4.000 Zeichen je Hunk-Seite begrenzt die Kosten einer Seite, aber nicht die einer Datei. 65 feindliche Seiten zu 3.999 Zeichen (zusammen 259.935, also unter der Dateigrenze) brauchen synchron 1,2 s (Markup) und 2,0 s (Markdown).
- **Belegt (Probe des architekts, Chromium)**: Prism läuft im Dedicated Worker über `importScripts`, mit `self.Prism = {disableWorkerMessageHandler: true}` vor dem Laden. Es liefert die Stücke als übertragenes `Int32Array` `[zeile, von, bis, rolle]*` und wird nach einer Frist von 1.000 ms mit `terminate()` abgebrochen.

  | Fall | Ergebnis | Zeit bis Antwort | längste Lücke im Hauptfaden (10-ms-Takt) | Long Tasks |
  |---|---|---|---|---|
  | Rust 262.144 | gefärbt | 84 ms (Worker 59) | 10 ms | keine |
  | minifiziert 261 × 1.000, JS | gefärbt | 33 ms | 10 ms | keine |
  | feindlich Markup `<!-- ` 64 Zeilen | Frist | 1.000 ms | 12 ms | keine |
  | feindlich Markdown `<!-- ` 261 Zeilen | Frist | 1.001 ms | 11 ms | keine |
  | feindlich JS gemischt 261 Zeilen | Frist | 1.000 ms | 22 ms | keine |
  | Rust 262.144 nach Abbruch (neuer Worker) | gefärbt | 129 ms | 14 ms | keine |
  | Auflage 10.000 Zeilen, ein Block zu 500 je Task | — | — | längster Block 28 ms, Summe 185 ms | eine (105 ms), aus dem ungestaffelten ungefärbten Aufbau der Probe, nicht aus der Auflage |

- **Belegt (Code, ADR-0033)**: Der Diffbereich ist ein stehender Knoten, den `render()` nicht ersetzt. Eine spätere Auflage findet ihn also unverändert vor. ADR-0014 regelt schon, dass nur die neueste Antwort übernommen wird.
- **Qualitätsziel**: Ein feindlicher Commit legt die Review-Seite nie lahm. Messbar heißt das: Solange eine Datei mit beliebigem Inhalt innerhalb der Grenzen gefärbt wird, dauert keine Aufgabe des Hauptfadens länger als 150 ms.

## Optionen

- **V1 — Worker mit Frist** (gewählt): Prism läuft nur in einem Dedicated Worker. Ein Auftrag je Datei, die Frist beträgt 1.000 ms, danach `terminate()` und die Datei bleibt ohne Farbe. Der Text steht sofort ungefärbt da, die Farbe kommt als Auflage nach, ein Block zu 500 Zeilen je Aufgabe.
  - Stärke: Die Garantie hängt nicht am Verhalten der Regex-Maschine. Auch Backtracking innerhalb eines einzelnen `exec` wird abgebrochen. Prism verlässt den Hauptfaden ganz und kann auf der Seite das DOM nicht mehr berühren.
  - Schwäche: Ob eine sehr teure, aber gutartige Datei Farbe bekommt, hängt an der Maschine. Gemessen ist der Abstand zur Frist bei gutartigen Dateien etwa das Dreifache (352 ms gegen 1.000 ms). Die Farbe erscheint einen Moment nach dem Text, gemessen 33–129 ms. Es entsteht ein zweiter, asynchroner Weg mit Schlange, Frist und veralteten Antworten.
- **V2 — Grenze je Hunk-Seite um 4.000 Zeichen, synchron**: Stärke: deterministisch und einfach, im Einzelfall 31 ms. Schwäche: Die Kosten einer Datei sind die Summe ihrer Seiten, und die bleibt unbegrenzt (1,2–2,0 s gemessen, siehe Kontext). Halten würde sie nur zusammen mit einer viel kleineren Dateigrenze. Außerdem bleiben neue Dateien ab etwa 100 Zeilen grau, weil sie ein einziger Hunk sind. Verworfen.
- **V3 — eigene Tokenisierung je Zeile mit Zustand** (Zeilenautomat: in Kommentar, in String, normal; linear durch Bauart): Stärke: deterministisch, synchron, ohne Fremdcode. Schwäche: 16 Grammatiken neu zu schreiben, deutlich schlechtere Farben (Funktion, Typ, Makro nur über Heuristik), die Prism-Wahl des PO fällt weg (Z. 387), und die Linearität muss für jede Grammatik im Review bewiesen werden. Verworfen, bleibt Rückfall, falls Worker in einer Zielumgebung fehlen.
- **V4 — Prism ohne gierige Regeln oder Verzicht auf Sprachen**: Stärke: bleibt synchron. Schwäche: Der minifizierte Fall verfehlt mit 185–222 ms weiter das Ziel, JavaScript selbst ist feindlich angreifbar (1,4 s), mehrzeilige Strings und Kommentare werden falsch gefärbt, und die Vendor-Datei wäre nicht mehr unverändert. Verworfen.
- **V5 — synchron mit Arbeitszähler** (die `RegExp` der Grammatik zählen ihre `exec`-Aufrufe und brechen bei einem Budget ab): Stärke: deterministisch. Schwäche: hängt an Interna von Prism, denn bei `greedy` baut Prism die `RegExp` neu und verliert damit den Zähler. Ein einzelnes `exec` mit Backtracking bleibt unbegrenzt. Verworfen.
- L4 „beim Sichtbarwerden färben“ hilft laut B1105 nicht, weil ein einziger sichtbarer feindlicher Hunk genügt. Verworfen.

## Entscheidung

**Gewählt: V1 auf T2 und L2 aus ADR-0037.** Was ich bewusst in Kauf nehme: Die Farbe erscheint kurz nach dem Text. Eine gutartige Datei, die auf einer sehr langsamen oder ausgelasteten Maschine länger als 1 s zum Tokenisieren braucht, bleibt ohne Farbe. Beides ohne Hinweis, denn Farbe ist Zugabe und kein Inhalt (ADR-0037 Punkt 8).

1. **Aus ADR-0037 bleiben**: Einbettung von `web/vendor/prism.js` und `LICENSE-prism.txt` (Punkt 1, siehe aber 2), nur `tokenize`/`languages` (Punkt 2), Sprache nach Endung (3), T2 je Hunk und Seite (4), Rollentabelle und `tk-`-Klassen (5), Auflage mit Invariante (6), Grenze je Datei 262.144 / 1.000 als Eingangsfilter (7: kein Auftrag an den Worker über der Grenze), Fehlerpfad still (8).
2. **Prism nur im Worker, nie auf der Seite**:
   - `web/index.html` lädt `prism.js` **nicht**, auf der Seite gilt `window.Prism === undefined`.
   - Neues eigenes Skript `web/faerben.js`, eingebettet über `dateien!` als `text/javascript; charset=utf-8`. Als Worker setzt es zuerst `self.Prism = {disableWorkerMessageHandler: true}` und ruft dann `importScripts('/web/vendor/prism.js')` in `try`. Ohne diese Zeile beantwortet der eingebaute Nachrichten-Handler von Prism JSON-Nachrichten mit `highlight`-HTML und Hooks.
   - Unter Node exportiert dieselbe Datei die reine Funktion `hunkTokens(zeilen, grammatik)`. Sie läuft im Test mit echtem Prism per `require`.
   - `data-manual` entfällt, weil kein Prism auf der Seite läuft. Eine spätere CSP braucht nur `worker-src 'self'` (bzw. `script-src 'self'`).
3. **Antwortform**: Je Auftrag gibt der Worker ein `Int32Array` zurück, mit Viererpaaren `[index der Patch-Zeile, von, bis, rolle]` in UTF-16-Versätzen des Zeilentexts. `rolle` ist ein Index in die feste Tabelle der sieben Klassen. Übertragen wird es als Transferable. Typnamen der Grammatik verlassen den Worker nie.
4. **Schlange und Frist** (in `web/diff.js` oder einem kleinen eigenen Modul, Kleber):
   - Ein Worker, er wird beim ersten Bedarf angelegt. Je offener Datei gibt es einen Auftrag mit Lauf-Kennung, und es läuft immer nur ein Auftrag zur Zeit.
   - `FRIST_MS = 1000` ist eine benannte Konstante. Sie zählt ab der Übergabe an den Worker. Ist sie abgelaufen, folgen `terminate()`, die Datei bleibt ohne Farbe, und der nächste Auftrag legt einen neuen Worker an.
   - Eine Antwort, deren Datei nicht mehr gezeigt wird oder neu gezeichnet wurde, wird verworfen (Geist ADR-0014). Wartende Aufträge einer geschlossenen Datei fallen aus der Schlange. Ein laufender Auftrag läuft bis zu seiner Antwort oder bis zur Frist.
   - `error` und `messageerror` des Workers, eine Antwort mit `fehler` und ein fehlendes `Worker` ergeben: ohne Farbe, `preventDefault()`, kein `console.*`.
5. **Zeichnen in zwei Schritten**:
   - `codeHtml` zeichnet wie heute ungefärbt und sofort.
   - Kommt die Antwort, legt die Auflage die Stücke Block für Block (500 Zeilen) auf die Codezellen, **ein Block je Aufgabe** (`setTimeout 0` oder `requestAnimationFrame`). Jede Zelle wird aus `sichtbarTeile` und den Stücken neu gebaut, mit derselben Invariante wie ADR-0037 Punkt 6.
   - Zeilennummern, Zeilen, Blöcke, `blockBreite` und Zeichenbudget bleiben unberührt, ersetzt wird nur der Inhalt der Codezelle.
   - Am Diffbereich zeigt ein Attribut `data-farbe="laeuft|ja|nein"` je Datei den Zustand für Tests. Es ist nicht sichtbar und ersetzt ein Warten auf Zeit (ADR-0026).
6. **Messziel statt Sondierung**: Keine Aufgabe des Hauptfadens dauert länger als 150 ms, solange eine Datei innerhalb der Grenzen gefärbt wird, gleich mit welchem Inhalt. Das prüft die Long Tasks API (`PerformanceObserver` `longtask`) im E2E. M1 und M2 aus ADR-0037 entfallen als Tor.

## Konsequenzen

**Positiv:**
- Die Garantie gegen das Lahmlegen hängt an der Frist und nicht an Prism. Das gilt auch für künftige Grammatiken und für Backtracking.
- Prism kann auf der Seite weder färben noch das DOM berühren. Die Fläche für den security-reviewer wird kleiner, denn `data-manual` und ein Auto-Highlight im Markdown sind kein Thema mehr.
- Der minifizierte Fall (352 ms) und große gutartige Dateien bekommen jetzt Farbe, statt die Grenze zu reißen.

**Negativ / Inkauf:**
- Die Farbe erscheint einen Moment nach dem Text (gemessen 33–129 ms). Eine Textauswahl, die genau in diesem Moment in der Datei liegt, kann beim Auflegen eines Blocks verloren gehen.
- Ob eine sehr teure, gutartige Datei gefärbt wird, hängt an Maschine und Last. Tests stützen sich deshalb nur auf Fälle weit unter (unter 150 ms) oder weit über der Frist (5 s und mehr).
- Ein feindlicher Auftrag kostet bis zu 1 s Rechenzeit im Hintergrund, und folgende Dateien warten so lange auf ihre Farbe.
- Ein neuer Worker kostet etwa 45 ms im Worker-Faden für das erneute Laden von Prism.
- Es gibt einen zweiten, asynchronen Weg mit eigener Schlange, die getestet werden muss.

**Durchsetzung:**
- **Unit (Node, Prism echt)**: `hunkTokens` mit den Fällen aus ADR-0037 und der Antwortform aus Punkt 3, wobei `rolle` nur Werte 0–6 annimmt. Die Schlange wird mit einem Fake-Worker getestet, der verzögert oder nie antwortet (Lehre „verzögert antwortender Fake“). Fälle: Frist abgelaufen ⇒ `terminate` und ohne Farbe; veraltete Antwort verworfen; zweite Datei wartet; Fehler still. Die Frist ist im Test injizierbar, als Konstante im Code bleibt sie 1.000.
- **E2E**:
  - Datei mit 64 Zeilen `<!-- ` zu 999 Zeichen als `.md` und als `.html` sowie JS gemischt `` /`"'/* ``, alle innerhalb der Grenzen: kein `longtask` über 150 ms vom Aufklappen bis `data-farbe="nein"`. Danach wird eine gutartige `.rs` gefärbt (neuer Worker).
  - `window.Prism === undefined` auf der Seite.
  - Eine JSON-Nachricht `{"language":"rust","code":"fn x(){}"}` an den Worker bekommt keine HTML-Antwort.
- **Mutanten**: Frist entfernt (die feindliche Probe hängt bzw. wird rot); `tokenize` auf dem Hauptfaden (`longtask` > 150 ms); `disableWorkerMessageHandler` entfernt; veraltete Antwort übernommen; alle Blöcke in einer Aufgabe aufgelegt (10.000 Zeilen ⇒ `longtask`); Fehler ins `console.error`.
- **Review-Punkt für `security-reviewer`**: Prism nur in `web/faerben.js` über `importScripts`, nie per `<script>` auf der Seite. Der Worker gibt nur Zahlen zurück. `disableWorkerMessageHandler` steht vor `importScripts`.

## Folgeentscheidungen / Aufgaben

- [ ] planer: Bubbles B1106, B1108, B1109 und B1111 nach dieser ADR nachziehen; B1109 in „Schlange mit Frist“ und „Auflage blockweise“ teilen; AK 1, 5, 6 und 8 von R00217 anpassen (Bericht des architekts, Karte #216).
- [ ] product-owner: Darf eine Datei innerhalb der Grenzen ohne Farbe bleiben, wenn das Färben länger als 1 s dauert, und darf die Farbe einen Moment nach dem Text erscheinen, beides ohne Hinweis? Empfehlung: ja. Bis zur Antwort gilt: ja, ohne Hinweis.
- [ ] Rückfall V3, falls eine Zielumgebung keinen Worker erlaubt. Heute ist keine bekannt, kanbanD läuft im Browser des Menschen.

## Quellen / Bezüge

- ADR-0037 (abgelöst), ADR-0033 Punkt 5 und stehender Diffbereich, ADR-0014, ADR-0026, ADR-0032 Punkt 10; po-entscheidungen Z. 387
- Sondierung B1105 `8025e2fc`; Worker-Probe `gemeinsam/scratchpad/arch-216/probe/` der Factory (`probe.js`, `worker.js`, `seite4000.js`, `ergebnis-1.json`; Wegwerf)
- prism-core 1.30.0 (im Bundle aus B1105 gelesen): ohne `document` und ohne `disableWorkerMessageHandler` hängt Prism einen `message`-Hörer an, der `JSON.parse(n.data)` liest und `postMessage(highlight(code, …))` antwortet; `tokenize` ohne Hooks (B1105 M3)
