# ADR-0037: Syntax-Hervorhebung in der Review-Ansicht — Prism je Hunk-Seite, Farbe als Auflage auf die unveränderte Zeile, Grenze je Datei, eingebettet unter `web/vendor/`

**Status**: Vorgeschlagen — wird „Akzeptiert“, sobald die Sondierung der Karte (Punkt 9) die Messziele M1 und M2 trifft. Die Wahl von Prism selbst ist schon akzeptiert (ADR-0032 Punkt 10, po-entscheidungen Z. 387).
**Datum**: 2026-11-21
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #216, Lauf 216-architekt-1)
**Kontext-Anforderung**: — (Karte #216, Scheibe B4 „Syntax-Hervorhebung“; die Anforderung schreibt der planer). Bezug: po-entscheidungen Z. 365, 367, 386–388; ADR-0030, ADR-0032 Punkt 10, ADR-0033 (Punkte 5 und 8, N1.8, Folgeaufgabe B4); Artboard D0009 (Syntaxfarben, Kontrastangaben); Feinschnitt `gemeinsam/scratchpad/arch-207/feinschnitt.md` der Factory (Zeile B4)
**Erprobt durch**: — (am Code gelesen, Stand `08232798`; nichts gefahren, Nachtbetrieb ohne Lastprobe). Die Messziele trägt die Sondierung der Karte nach.

## Kontext

- **Belegt (Code)**:
  - Der Diff wird als HTML-Text gebaut und über `innerHTML` in die Insel gesetzt. Fremder Text geht nur über `esc` in feste Elemente (`web/diff.js` `zeileHtml`, `sichtbarHtml`; ADR-0033 Punkt 8). `codeHtml(patch, pfad, esc)` ist der eine Ort, an dem eine offene Datei gezeichnet wird, für den Einzel-Diff (`web/diff.js:294`) und für „Alle Änderungen“ (`web/gesamt.js:298`).
  - `patchZeilen` zerlegt nur an `\n` und liefert `{art: kopf|plus|minus|kontext|hinweis, alt, neu, text}`. `sichtbarTeile` macht Bidi- und Steuerzeichen sichtbar, je Zeile.
  - Die API liefert nur den Patch, nie die ganze Datei. Ein Patch in der ersten Antwort hat höchstens 256 KB und 3.000 Zeilen (`plus + minus`). Einzeln nachgeladen werden bis 8 MB (ADR-0032 N5.1).
  - Eingebettet wird jede Datei unter `web/` über die Liste `dateien!` in `src/web/statisch.rs` (`include_bytes!`, Unterordner wie `fonts/` gehen über `/web/{*name}`). Skripte kommen als `<script src>` aus `web/index.html`, ohne Build-Schritt.
  - Es gibt heute **keine** Content-Security-Policy und kein Inline-Skript in `index.html`.
  - Die Themen stehen in `web/kd-tokens.css` dreifach: `:root` (hell), `@media (prefers-color-scheme:dark)` und `:root[data-theme="dark"]`.
  - `web/markdown.js` zeichnet `<pre><code>` ohne Klasse `language-…`.
- **Artboard D0009** (vom PO freigegeben): Token-Klassen keyword, string, comment, number/boolean, function, class-name, macro/attr-name; punctuation und operator erben. Die Farben stehen je Thema als `--tk-…` im Kopf der Datei. Gemessener Kontrast gegen Normal, Hinzugefügt und Entfernt: mindestens 5,45 hell und 6,03 dunkel.
- **Prism 1.30.0**: `Prism.tokenize(text, grammatik)` ruft keine Hooks auf, die laufen nur in `Prism.highlight`. Ohne `data-manual` am `<script>` färbt Prism beim Laden selbst alle Elemente mit `language-`/`lang-`-Klasse ein, und zwar über `innerHTML`. Die DOM-Clobbering-Lücke bei `document.currentScript` (CVE-2024-53382) ist in 1.30.0 behoben (aus dem Gedächtnis, nicht abgerufen; prüft die Sondierung am Changelog).

## Optionen

### Worüber tokenisiert wird (Hunk-Grenzen)

- **T1 — je Zeile**: am einfachsten. Schwäche: jeder mehrzeilige Kommentar und jeder mehrzeilige String ist ab der zweiten Zeile falsch gefärbt, und das kommt in jedem Diff vor. Verworfen.
- **T2 — je Hunk und Seite** (gewählt, wie ADR-0032 Punkt 10): Die alte Seite ist Kontext + entfernt, die neue Seite Kontext + hinzugefügt. Jede Seite wird als ein Text tokenisiert und wieder an `\n` geteilt. Stärke: Mehrzeiliges innerhalb eines Hunks stimmt, und ein Fehler bleibt im Hunk. Schwäche: Beginnt ein Hunk mitten in einem Blockkommentar oder String, ist die Färbung bis zu dessen Ende im Hunk falsch.
- **T3 — je Datei über alle Hunks einer Seite**: Mehrzeiliges über Hunk-Grenzen hinweg stimmt manchmal. Schwäche: zwischen den Hunks fehlen Zeilen. Ein offener String in Hunk 1 färbt dann alle folgenden Hunks falsch, der Fehler wandert über die ganze Datei. Verworfen.
- **T4 — ganze Datei alt und neu laden und tokenisieren**: Die Färbung ist immer richtig. Schwäche: braucht eine neue Lese-API für Blobs, lädt bis zum Doppelten der Datei statt des Patches, verletzt die Vorgabe „ohne die ganze Datei zu laden“ und das Antwortbudget (ADR-0032 N4/N5). Verworfen.

### Wie viel gefärbt wird (Laufzeit)

- **L1 — alles, was gezeichnet wird**: einfach. Schwäche: Ein nachgeladener Patch mit 8 MB liegt bei Prism im Bereich von Sekunden auf dem Hauptfaden (Regex-Maschine). Minifizierte Zeilen bis 256 KB sind der bekannte Ort für Backtracking in Grammatiken. Verworfen.
- **L2 — feste Grenze je Datei, ohne Zeitmessung** (gewählt): gefärbt wird eine Datei, deren Patch höchstens 262.144 UTF-16-Einheiten lang ist und keine Zeile über 1.000 Einheiten hat. Sonst wird die ganze Datei ohne Farbe gezeichnet. Stärke: Das Ergebnis ist deterministisch und testbar, und jede Datei, die die API sofort liefert, bleibt in der Grenze (Einheiten ≤ Bytes). Schwäche: Große nachgeladene Dateien und minifizierte Dateien bleiben grau.
- **L3 — Zeitbudget je Seite** (`performance.now()`): passt sich der Maschine an. Schwäche: nicht deterministisch, das gleiche Diff sieht je nach Last verschieden aus, und Tests würden wackeln (ADR-0026). Verworfen.
- **L4 — beim Sichtbarwerden färben** (`contentvisibilityautostatechange` bzw. IntersectionObserver) **oder in einem Web Worker**: Die Kosten fallen nur für Sichtbares bzw. nicht auf dem Hauptfaden an. Schwäche: Ein Hunk geht über Blockgrenzen. Der Zustand der Insel bekommt eine zweite Quelle, und es entstehen eigene Wege für Laden und Fehler. Für die erwarteten Größen ist das zu viel. Bleibt die Rückfalloption, falls M2 verfehlt wird.

## Entscheidung

**Gewählt: T2 und L2.** Akzeptierte Schwächen: Ein Hunk, der im Kommentar beginnt, ist falsch gefärbt. Große und minifizierte Dateien bleiben ohne Farbe.

1. **Einbettung**:
   - `web/vendor/prism.js` ist eine vorab gebaute Datei aus `prismjs@1.30.0`. Sie enthält die unveränderten Minify-Dateien aus `components/` in fester Reihenfolge: `prism-core`, `clike`, `markup`, `css`, `javascript`, `rust`, `markup-templating`, `php`, `python`, `bash`, `yaml`, `markdown`, `json`, `sql`, `csharp`, `toml`, `diff`. Ein Kopfkommentar nennt Version, Liste und Quelle und trägt den MIT-Hinweis, damit er im Binary und in jeder ausgelieferten Kopie steht.
   - Daneben liegt `web/vendor/LICENSE-prism.txt` mit dem Lizenztext aus dem Paket.
   - Beide Dateien kommen in `dateien!` (`src/web/statisch.rs`): `prism.js` als `text/javascript; charset=utf-8`, `LICENSE-prism.txt` als `text/plain; charset=utf-8`. Es gibt keinen Build-Schritt, kein Nachladen von außen und keine npm-Abhängigkeit im Baum.
   - `index.html`: `<script src="/web/vendor/prism.js" data-manual></script>` steht **vor** `diff.js`. `data-manual` statt eines Inline-Skripts `window.Prism = {manual: true}`, damit eine spätere CSP mit `script-src 'self'` ohne Ausnahme auskommt. B4 führt keine CSP ein, fügt aber auch nichts hinzu, was eine verhindert (kein Inline-Skript, kein `eval`).
2. **Benutzt wird nur `Prism.tokenize` und `Prism.languages[…]`**. Nie `highlight`, `highlightAll`, `highlightElement`, `hooks` oder Plugins. Die Zusage des PO „`textContent`, nie `innerHTML`“ (Z. 387) heißt hier: **Kein HTML stammt von Prism oder aus dem Dateiinhalt.** Jeder Token-Text geht durch dasselbe `esc`/`sichtbarHtml` in ein festes `<span>` mit einer Klasse aus der Tabelle in Punkt 5. Der Weg über den HTML-Text und `innerHTML` der Insel (ADR-0033, gemessen) bleibt. Begründung: Ein Umbau auf DOM-Knoten je Token kostete die gemessene Zeichenzeit und widerspräche ADR-0033. Die Maskierung leistet dasselbe wie `textContent` (Geist ADR-0030).
3. **Sprache nach Endung** des Pfads der Datei: `neu`, bei gelöschten `alt`. Der Vergleich ignoriert Groß- und Kleinschreibung, eine Datei hat eine Sprache für beide Seiten.
   - `.rs` rust · `.js .mjs .cjs` javascript · `.json` json · `.css` css · `.html .htm .xml .svg` markup · `.md` markdown · `.py` python · `.sh .bash` bash · `.yml .yaml` yaml · `.sql` sql · `.cs` csharp · `.toml` toml · `.php` php · `.diff .patch` diff.
   - Ohne Endung (`Makefile`) oder bei unbekannter Endung gibt es keine Farbe, keinen Hinweis und keine Meldung in der Konsole.
   - Inkauf: Bei `.php` fehlt das Zusammenspiel mit HTML (das laufen nur Hooks), PHP wird als reines PHP gefärbt.
4. **Je Hunk und Seite** (T2):
   - Je Hunk entstehen aus `patchZeilen` zwei Texte: alt = `kontext` + `minus`, neu = `kontext` + `plus`, in Reihenfolge, mit `\n` verbunden. `kopf` und `hinweis` (`\ No newline`) gehören zu keiner Seite und bleiben ungefärbt.
   - Die Token-Liste wird flach gemacht und an `\n` in Zeilen geteilt. Ein Token, das über Zeilen geht (Blockkommentar), ergibt je Zeile ein Stück mit derselben Rolle.
   - `minus` nimmt die Zeile der alten Seite, `plus` und `kontext` nehmen die der neuen (wie GitHub).
5. **Rollen** (feste Tabelle, Artboard D0009). Bei verschachtelten Tokens gewinnt die innerste Rolle, die in der Tabelle steht. Gesucht wird je Token erst `type`, dann `alias`. Alles andere bekommt keine Klasse und erbt die Textfarbe:

   | Prism `type`/`alias` | Klasse | Farbe |
   |---|---|---|
   | keyword | `tk-keyword` | `--kd-tk-keyword` |
   | string, char, template-string, regex, attr-value, url | `tk-string` | `--kd-tk-string` |
   | comment, prolog, doctype, cdata | `tk-comment` (kursiv) | `--kd-tk-comment` |
   | number, boolean | `tk-number` | `--kd-tk-number` |
   | function | `tk-function` | `--kd-tk-function` |
   | class-name | `tk-type` | `--kd-tk-type` |
   | macro, attr-name | `tk-macro` | `--kd-tk-macro` |

   - Klassen mit eigenem Präfix `tk-`, keine Prism-Klasse `token`: Die Typnamen der Grammatik kommen so nie ins Attribut, und es gibt keinen Zusammenstoß mit vorhandenen Klassen. Die CSS steht unter `.dz .c .tk-…`.
6. **Farbe ist eine Auflage auf die unveränderte Zeile**:
   - Gezeichnet wird je Zeile wie heute aus `sichtbarTeile(text)`. Die Stücke ohne Marke werden an den Token-Grenzen (Versatz im Zeilentext) in `<span class="tk-…">` geteilt. Marken für Bidi- und Steuerzeichen bleiben, wie sie sind, ohne Farbe, und haben Vorrang vor der Token-Grenze.
   - **Invariante**: Der `textContent` einer Zeile ist mit und ohne Farbe gleich, ebenso Marken, Zeilennummern, Blöcke zu 500 Zeilen, `blockBreite` und Zeichenbudget (ADR-0033 Punkt 5: gezählt werden Zeilen, nicht Spans).
   - Strg+F, Bildschirmleser und Textauswahl ändern sich nicht.
7. **Grenze je Datei** (L2): gefärbt wird, wenn `patch.length ≤ 262.144` und keine Zeile des Patches über 1.000 Einheiten lang ist. Sonst wird die ganze Datei ohne Farbe gezeichnet, ohne Hinweis (siehe Folgeaufgaben: Produktfrage). Die Grenzen stehen als benannte Konstanten in `web/diff.js`. Was der Mensch selbst aufklappt, wird nach derselben Regel gefärbt. Eine Grenze je Seite gibt es nicht: Das Aufklappen beim ersten Aufbau begrenzt schon ADR-0033 Punkt 5 (10.000 Zeilen), alles Weitere geschieht Datei für Datei auf Klick.
8. **Fehlerpfad**:
   - Fehlt `Prism` (Datei nicht geladen) oder wirft `tokenize`, wird die Datei ohne Farbe gezeichnet. Der Fehler wird gefangen und nicht in die Konsole geschrieben.
   - Farbe ist Zugabe und kein Inhalt: Ihr Fehlen verliert nichts, deshalb keine Meldung an der Datei.
   - Die Tokens hängen nur am Patch-Text und der Sprache und werden beim Zeichnen gerechnet, nicht in `S.ui.review` gehalten.
9. **Sondierung der Karte** (höchstens 30 Minuten, nicht im Nachtbetrieb, `nice -n 19`, Chromium aus `e2e/node_modules` wie ADR-0033):
   - **M1**: Tokenisieren + Zerlegen eines Patches mit 256 KB in Rust, JavaScript und Markdown, dazu eine Datei mit vielen Zeilen zu 1.000 Zeichen: je ≤ 150 ms.
   - **M2**: erster Aufbau von 10.000 gefärbten Zeilen gestaffelt ≤ 150 ms (ungefärbt gemessen 38 ms, ADR-0033). Das ist die Neumessung, die ADR-0033 als Folgeaufgabe B4 verlangt.
   - **M3**: Zeilenzerlegung bei Blockkommentar und mehrzeiligem String über drei Zeilen, hell und dunkel, Lizenzdatei ausgeliefert.
   - Trifft M1 oder M2 nicht zu, bleibt die Ansicht ohne Farbe, die Grenzen werden **nicht** vom entwickler verschoben, und die Frage geht an den architekt zurück (po-entscheidungen Z. 387). Dann ist L4 die nächste Option.

## Konsequenzen

**Positiv:**
- Mehrzeilige Kommentare und Strings sind innerhalb eines Hunks richtig gefärbt, ohne neue API und ohne mehr Daten.
- Laufzeit und Bild sind deterministisch und testbar. Ein feindlicher Commit (riesige oder minifizierte Datei) kann die Seite über die Färbung nicht lahmlegen.
- Kein HTML aus Dateiinhalt oder Bibliothek. Die Marken gegen „Trojan Source“ bleiben unverändert.
- Einzel-Diff und „Alle Änderungen“ bekommen die Farbe am selben Ort (`codeHtml`).

**Negativ / Inkauf:**
- Ein Hunk, der mitten in einem Kommentar oder String beginnt, ist bis zu dessen Ende falsch gefärbt.
- Große, nachgeladene und minifizierte Dateien bleiben grau.
- PHP ohne HTML-Anteil, Sprachen außerhalb der 16 (z. B. TypeScript, PowerShell) ohne Farbe. Eine Grammatik nachzurüsten kostet 1–3 KB gzip und eine Zeile in der Tabelle.
- 53,5 KB mehr im Binary.

**Durchsetzung:**
- Reine Funktionen in `web/diff.js`, in Node testbar. Die Tests laden `web/vendor/prism.js` per `require`, Prism exportiert sich unter Node selbst.
  - `spracheZuPfad(pfad)`.
  - `hunkTokens(zeilen, grammatik)` → je Zeile Stücke `{text, klasse}`.
  - `faerbbar(patch)`.
- **Erster Test** (Eingabe → Ausgabe, Prism echt):
  - Ein `.rs`-Patch mit `fn` ergibt in der Zeile ein Stück mit `tk-keyword`.
  - Ein Hunk mit `/*` in Zeile 1 und `*/` in Zeile 3 ergibt `tk-comment` in allen drei Zeilen.
  - Ein `.unbekannt`-Patch ergibt keine Klasse und keinen Wurf.
- **Invarianten-Test**: Für Patches mit Bidi-Zeichen, `\r`, U+2028 und Tab ist der Text der gezeichneten Zeile mit und ohne Prism gleich, und die Zahl der Marken ist gleich.
- **Grenzen-Test**: `patch.length` 262.144 → gefärbt, 262.145 → nicht. Eine Zeile mit 1.000 Einheiten → gefärbt, mit 1.001 → ganze Datei nicht.
- **E2E**:
  - `Prism.manual === true` nach dem Laden.
  - Ein Markdown-Kommentar mit Codeblock in der Aufgabe bleibt ungefärbt (kein Auto-Highlight).
  - `GET /web/vendor/LICENSE-prism.txt` gibt 200.
  - Hell und dunkel (System und `data-theme`) setzen verschiedene `color` an `.tk-keyword`.
- **Kontrast**: Die Werte aus D0009 kommen als `--kd-tk-*` in alle drei Themen-Blöcke von `kd-tokens.css`, keine Farbe als Literal in `kd-app.css`. `ux-reviewer` misst jede Rolle gegen `--kd-surface`, `--kd-c-green` und `--kd-c-red` je Thema (≥ 4,5:1). Kursiv gilt nur für den Kommentar.
- **Review-Punkt für `security-reviewer`**: Kein Aufruf außer `tokenize`/`languages` an Prism. Kein `innerHTML` mit Token-Text ohne `esc`. Klassen nur aus der Tabelle. `data-manual` vorhanden.

## Folgeentscheidungen / Aufgaben

- [ ] entwickler (Karte #216): Sondierung nach Punkt 9 zuerst. Danach trägt der architekt den Status nach (Akzeptiert oder L4).
- [ ] product-owner: Soll eine Datei, die wegen der Grenze ungefärbt bleibt, einen Hinweis tragen („ohne Farbe: zu groß für die Hervorhebung“)? Empfehlung: nein. Es fehlt kein Inhalt, und eine unbekannte Endung trägt auch keinen. Bis zur Antwort gilt: kein Hinweis.
- [ ] Rückbau der WBS (#224): `--kd-wbs-ok-ink`, `--kd-wbs-error-ink` und `--kd-wbs-warn-*` färben heute Diff-Zeichen und Bidi-Marken (`kd-app.css`, 43 Stellen). Sie dürfen beim Rückbau nicht still wegfallen, sondern müssen umbenannt oder behalten werden. B4 baut nicht auf ihnen auf.

## Quellen / Bezüge

- ADR-0032 Punkt 10 (Kandidaten, Messung `npm pack`, 2026-11-19), ADR-0033 Punkte 5 und 8, N1.8, ADR-0030, ADR-0026
- po-entscheidungen Z. 365, 367, 386–388; Artboard `Dokumentation/Wireframes/D0009.dc.html` (Syntax-Block im Kopf, Kontrastangaben)
- npm `prismjs` 1.30.0 (MIT), Bestand nach ADR-0032; das Verhalten von `tokenize` ohne Hooks und von `data-manual` ist aus dem Gedächtnis beschrieben und wird in der Sondierung am Quelltext von `prism-core` geprüft
