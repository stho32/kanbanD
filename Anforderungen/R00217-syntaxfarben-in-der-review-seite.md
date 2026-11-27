---
id: R00217
status: Erledigt
datum: 2026-11-21
---

# R00217: Syntaxfarben in der Review-Seite

## Beschreibung

Karte #216 (Scheibe B4 des Feinschnitts, Zuschnitt des PO 2026-11-19, po-entscheidungen Z. 384–388).

**Umfang (baut auf [R00207](R00207-review-seite-eines-commits.md) und [R00210](R00210-alle-aenderungen-der-aufgabe-in-der-review-seite.md)):** Die Review-Seite färbt den Code einer offenen Datei nach ihrer Dateiendung: Schlüsselwörter, Strings, Kommentare, Zahlen, Funktionen, Typen und Makros tragen je eine Farbe, in hell und dunkel. Die Farbe ist eine **Auflage**: Text, Marken unsichtbarer Zeichen, Zeilennummern und Aufklappen bleiben genau so, wie R00207 sie zeigt. Gefärbt wird an dem einen Ort, an dem eine offene Datei gezeichnet wird, also in „Ein Commit“ und in „Alle Änderungen“ (auch in den Schritten einer Folge-Datei). **Der Text steht sofort da, die Farbe kommt einen Moment später** (gemessen 33–129 ms): die Bibliothek läuft nur in einem Hintergrund-Worker mit einer Frist von 1.000 ms ([ADR-0040](../Dokumentation/ADRs/0040-syntax-hervorhebung-im-worker-mit-frist.md)), damit ein feindlicher Commit die Seite nie lahmlegt. Eine Datei ohne bekannte Endung, eine zu große Datei, eine Datei, deren Färbung die Frist überschreitet, oder ein Fehler der Bibliothek ergibt eine Datei ohne Farbe — ohne Hinweis und ohne Meldung (po-entscheidungen Z. 457, Z. 485). **Nicht** in B4: Farbe im Markdown der Aufgabe, Sprachen außerhalb der 16 aus ADR-0040 Punkt 1 (Tabelle aus ADR-0037 Punkt 3), Content-Security-Policy, Hinweis an einer ungefärbten Datei.

**Sondierung B1105 abgeschlossen** (ADR-0037 Punkt 9): M1 verfehlt (minifiziert 352 ms, feindlicher Inhalt innerhalb der Grenzen 5,4 s im Chromium), Abbruch mit Frage an den architekt; seine Antwort ist ADR-0040, die ADR-0037 ablöst.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112): die Änderungen als Diff lesend zeigen; Farbe macht den Diff schneller lesbar, ohne etwas zu verändern.

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, liest heute Code ohne Farbe. Ein auskommentierter Block, ein String mit Code darin oder ein Schlüsselwort zwischen Bezeichnern sieht aus wie jede andere Zeile; der Mensch muss ihn erst Zeichen für Zeichen lesen. Mit Farbe erkennt er auf einen Blick, was Kommentar, was Text und was Code ist — und weil die Farbe nur aufgelegt ist, sieht er weiter jedes unsichtbare Zeichen, das ein feindlicher Commit einschmuggeln will. Weil gefärbt wird, ohne die Seite anzuhalten, kann auch ein Commit mit absichtlich teurem Inhalt die Abnahme nicht blockieren.

## Funktionale Anforderungen

1. **Sprache nach Endung** des Pfads (`neu`, bei gelöschten Dateien `alt`), Groß- und Kleinschreibung egal, eine Sprache für beide Seiten einer Datei; Tabelle der Endungen wörtlich aus ADR-0037 Punkt 3 (16 Sprachen, gilt über ADR-0040 Punkt 1).
2. **Je Hunk und Seite**: die alte Seite (Kontext + entfernte Zeilen) und die neue Seite (Kontext + hinzugefügte Zeilen) werden je als ein Text gefärbt; eine entfernte Zeile nimmt die Farbe der alten Seite, hinzugefügte und Kontextzeilen die der neuen. Hunk-Köpfe (`@@ … @@`) und `\ No newline at end of file` bleiben ohne Farbe.
3. **Sieben Rollen** aus ADR-0037 Punkt 5 (gilt über ADR-0040 Punkt 1: Schlüsselwort, String, Kommentar, Zahl, Funktion, Typ, Makro), Klassen `tk-keyword`, `tk-string`, `tk-comment`, `tk-number`, `tk-function`, `tk-type`, `tk-macro`; bei verschachtelten Tokens gilt die innerste Rolle aus der Tabelle; alles andere erbt die Textfarbe. Nur der Kommentar ist kursiv.
4. **Grenze je Datei** (Eingangsfilter, ADR-0040 Punkt 1): gefärbt wird ein Patch mit höchstens 262.144 Zeichen, dessen Zeilen höchstens 1.000 Zeichen lang sind; sonst bleibt die ganze Datei ohne Farbe und es geht kein Auftrag an den Worker. Gezählt wird in UTF-16-Einheiten (`String.length`), je Zeile des Patch-Texts mit Vorzeichen (`+`, `-`, Leerzeichen), ohne das `\n`. Dieselbe Regel gilt für Dateien, die der Mensch nachlädt.
5. **Worker mit Frist** (ADR-0040 Punkte 2–4): Die Bibliothek läuft nur in einem Dedicated Worker aus `web/faerben.js`, nie auf der Seite. Je offener Datei ein Auftrag, ein Auftrag zur Zeit; `FRIST_MS = 1000` ab Übergabe an den Worker, danach wird der Worker beendet, die Datei bleibt ohne Farbe, und der nächste Auftrag bekommt einen neuen Worker. Der Worker antwortet nur mit Zahlen (`Int32Array` aus Viererpaaren `[Zeile, von, bis, Rolle]`, Rolle 0–6). Eine Antwort für eine Datei, die nicht mehr gezeigt oder neu gezeichnet wurde, wird verworfen; wartende Aufträge einer geschlossenen Datei entfallen.
6. **Farbe ohne Folgen**: Ohne bekannte Endung, über der Grenze, nach der Frist, ohne Worker, wenn Worker oder Bibliothek nicht laden oder die Bibliothek wirft, wird die Datei ohne Farbe gezeichnet — ohne Hinweis an der Datei, ohne Meldung in der Konsole (po-entscheidungen Z. 457, Z. 485).
7. **Zeichnen in zwei Schritten, Auflage** (ADR-0040 Punkt 5): Die Datei wird sofort ungefärbt gezeichnet; die Farbe wird danach blockweise aufgelegt, ein Block zu 500 Zeilen je Aufgabe des Hauptfadens. Text jeder Zeile, Marken für Bidi- und Steuerzeichen, Zeilennummern, Blöcke zu 500 Zeilen, geschätzte Blockbreite und Zeilenbudget sind mit und ohne Farbe gleich; Marken bleiben ohne Farbe und haben Vorrang vor einer Token-Grenze. Am Diffbereich jeder Datei steht unsichtbar `data-farbe="laeuft|ja|nein"` für Tests.
8. **Einbettung**: Prism 1.30.0 als vorab gebaute Datei `web/vendor/prism.js` mit Lizenztext `web/vendor/LICENSE-prism.txt` und das eigene Skript `web/faerben.js`, alle drei im Programm eingebettet; `web/index.html` lädt `prism.js` nicht, die Seite kennt kein `window.Prism`; ohne Inline-Skript; es wird nichts von außen nachgeladen.
9. **Farben je Thema** als `--kd-tk-*` aus dem Artboard D0009 in allen drei Themen-Blöcken von `web/kd-tokens.css`.

## Nicht-funktionale Anforderungen

- **Performance (Messziel, ADR-0040 Punkt 6):** Solange eine Datei innerhalb der Grenzen gefärbt wird, gleich mit welchem Inhalt, dauert keine Aufgabe des Hauptfadens länger als 150 ms — Startpunkt ist das Aufklappen, für nachgeladene Dateien („Änderungen anzeigen“) der Zeitpunkt, an dem die Datei `data-farbe="laeuft"` erhält (PO Z. 489), Ende `data-farbe="ja"` oder `"nein"`; geprüft über die Long Tasks API im E2E (AK 1). Gemessen (Probe des architekts, ADR-0040): längste Lücke im Hauptfaden 10–22 ms, längster Block der Auflage 28 ms — Abstand zur Grenze über 80 %. Wann die Farbe erscheint (gemessen 33–129 ms nach dem Text), ist Lastbeobachtung, kein Kriterium.
- **Frist 1.000 ms:** gutartige Prüffälle liegen weit darunter (Worker 33–84 ms), feindliche weit darüber (≥ 5,3 s im Chromium); dazwischen hängt das Ergebnis an Maschine und Last, deshalb prüft kein Test einen Fall nahe der Frist (ADR-0040 Konsequenzen). Im Unit-Test ist die Frist injizierbar, im Code bleibt sie 1.000.
- **Sicherheit:** Kein HTML stammt von Prism oder aus dem Dateiinhalt; der Worker gibt nur Zahlen zurück, Typnamen der Grammatik verlassen ihn nie; jeder Token-Text geht maskiert in ein festes Element, Klassen nur aus der Tabelle; im Worker steht `self.Prism = {disableWorkerMessageHandler: true}` vor `importScripts`; Prism nie per `<script>` auf der Seite (ADR-0040 „Review-Punkt für `security-reviewer`“).
- **Barrierefreiheit:** Kontrast jeder Rolle ≥ 4,5:1 gegen alle drei Zeilenhintergründe in allen Themenlagen; Strg+F, Bildschirmleser und Textauswahl sehen denselben Text wie ohne Farbe.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, wie R00207/R00210; jede Probe stellt ihre Aufgaben selbst her). Browser headless, Mensch `sh`. Wegwerf-Repository R mit Anwendung `kd`; Aufgabe #2 mit einem Commit K1, der enthält:

- `src/main.rs` neu, vier Zeilen: `/* Kopf`, `   zweite Zeile`, `*/`, `fn main() {}`;
- `src/seiten.rs` geändert von `let a = 1;` · `/* weg` · `*/ let c = 3;` auf `let a = 1;` · `let b = 2;` · `*/ let c = 3;` (ein Hunk: Kontext, `-/* weg`, `+let b = 2;`, Kontext `*/ let c = 3;`);
- `src/hunks.rs` mit zwei Hunks (mehr als sechs unveränderte Zeilen dazwischen): Hunk 1 endet mit der hinzugefügten Zeile `/* offen`, Hunk 2 fügt `fn b() {}` und danach `*/` hinzu (über beide Hunks gelesen wäre `fn` Kommentar, je Hunk nicht);
- `Makefile`, `notiz.unbekannt` und `Typ.TS` je mit einer geänderten Zeile `fn x() {}`, `SRC/GROSS.RS` mit `fn y() {}`;
- `alt.py` gelöscht (Inhalt `def f(): pass`), `umbenannt.txt` → `umbenannt.rs` mit Änderung `fn z() {}`;
- `grenze.rs` mit einer Zeile aus 999 × `a` (Patch-Zeile `+` + 999 = 1.000 Zeichen) und `fn g() {}`; `drueber.rs` mit einer Zeile aus 1.000 × `a` (Patch-Zeile 1.001 Zeichen) und `fn h() {}`;
- `zeichen.js` mit `let s = "‮abc";` (U+202E), einer Zeile mit `\r` am Ende, einer mit U+2028, einer mit Tab und einer mit `<img src=x onerror=window.PWN=1>`.

Dazu ein Kommentar an Aufgabe #2 mit einem Markdown-Codeblock ` ```rust ` / `fn m() {}` / ` ``` `. Die Grenze 262.144/262.145 wird an der reinen Funktion und einmal im Browser mit fester Antwort per `page.route` geprüft (ein so großer Patch kommt über die erste Antwort nur an der Grenze von 256 KB an).

**Feindlich** (ADR-0040 „Durchsetzung“): Aufgabe #3 mit Commit K2, alle Dateien neu und innerhalb beider Grenzen (je Zeile 999 Zeichen aus dem wiederholten Muster, Patch-Zeile 1 + 999 = 1.000):

- `feindlich.md` und `feindlich.html` mit je 64 Zeilen aus `<!-- ` (64 × 1.001 = 64.064 Zeichen; gemessen 5,3 s bzw. 5,4 s im Chromium);
- `feindlich.js` mit 261 Zeilen aus `` /`"'/* `` (261 × 1.001 = 261.261 ≤ 262.144; 18,2 s in Node gemessen; 64 Zeilen brauchen im Chromium nur 1,4 s und lägen zu nah an der Frist);
- `gut.rs` mit `fn gut() {}`.

**Lang**: Aufgabe #4 mit Commit K3, einzige Datei `lang.rs` mit 10.000 hinzugefügten Zeilen `let a = 1;` (Patch-Zeile 11 Zeichen, 10.000 × 12 = 120.000 Zeichen ≤ 262.144; über 3.000 Zeilen, also `gross` und über „Änderungen anzeigen“ geladen, R00207 FA 7).

**Warten auf die Farbe**: Geurteilt wird über Farbe erst, wenn der Diffbereich der Datei `data-farbe="ja"` oder `"nein"` trägt — ereignisgenau, nie nach Zeit (ADR-0026).

### Messziel

- [x] **1.** Gegeben Aufgabe #3, wenn `sh` `feindlich.md` aufklappt, dann stehen alle 64 Zeilen mit ihrem Text da, solange die Datei `data-farbe="laeuft"` trägt, die Datei endet mit `data-farbe="nein"`, und vom Aufklappen bis dahin meldet die Seite keinen Long Task über 150 ms (`PerformanceObserver` mit `longtask`); ebenso für `feindlich.html` und `feindlich.js`. Klappt `sh` danach `gut.rs` auf, trägt `fn` die Rolle Schlüsselwort (`data-farbe="ja"`, ein neuer Worker hat den abgebrochenen ersetzt). Gegeben Aufgabe #4, wenn `sh` an `lang.rs` „Änderungen anzeigen“ wählt, dann endet die Datei mit `data-farbe="ja"`, `let` trägt in der ersten und in der 10.000. Zeile die Rolle Schlüsselwort, und von dem Zeitpunkt, an dem die Datei `data-farbe="laeuft"` erhält (alle 10.000 Zeilen stehen ungefärbt), bis `data-farbe="ja"` meldet die Seite keinen Long Task über 150 ms (20 Blöcke zu 500 Zeilen, je ein Block je Aufgabe). Ein Long Task, dessen `startTime` vor diesem Zeitpunkt liegt, gehört zum ungefärbten Zeichnen (R00207). Er wird gemessen und im Bericht genannt, ohne Grenze.

### Farbe

- [x] **2.** Gegeben Aufgabe #2, wenn `sh` `src/main.rs` in „Ein Commit“ und in „Alle Änderungen“ aufklappt, dann trägt `fn` in beiden Ansichten die Rolle Schlüsselwort (`tk-keyword`), alle drei Zeilen des Blockkommentars tragen die Rolle Kommentar (`tk-comment`, auch die mittlere `   zweite Zeile` ganz), und der Hunk-Kopf `@@ … @@` trägt keine Rolle.
- [x] **3.** Gegeben Aufgabe #2, wenn `sh` `src/seiten.rs` und `src/hunks.rs` aufklappt, dann trägt die entfernte Zeile `/* weg` die Rolle Kommentar (alte Seite), in der Kontextzeile `*/ let c = 3;` trägt `*/` keine Rolle Kommentar und `let` die Rolle Schlüsselwort (neue Seite), und in Hunk 2 von `src/hunks.rs` trägt `fn` die Rolle Schlüsselwort, obwohl Hunk 1 in einem offenen Kommentar endet (der Fehler bleibt im Hunk).
- [x] **4.** Gegeben Aufgabe #2, wenn `sh` alle Dateien aufklappt, dann tragen `Makefile`, `notiz.unbekannt` und `Typ.TS` keine Rolle und die Konsole der Seite enthält keinen Eintrag der Art `error` oder `warning`; `SRC/GROSS.RS` und `umbenannt.rs` (beide Seiten) sind als Rust gefärbt, die gelöschte `alt.py` als Python (`def` mit Rolle Schlüsselwort).

### Grenze, Frist und Fehlerpfad

- [x] **5.** Gegeben ein Patch mit genau 262.144 Zeichen und einer mit 262.145 Zeichen (Rechnung: 256 × 1.024 = 262.144), wenn sie gezeichnet werden, dann ist der erste gefärbt und der zweite in **keiner** Zeile; gegeben Aufgabe #2, wenn `sh` `grenze.rs` und `drueber.rs` aufklappt, dann ist `fn` in `grenze.rs` Schlüsselwort (längste Patch-Zeile 1 + 999 = 1.000) und `drueber.rs` hat in keiner Zeile eine Rolle (1 + 1.000 = 1.001). Gezählt wird in UTF-16-Einheiten: eine Patch-Zeile `+` mit 500 × 😀 hat 1 + 500 × 2 = 1.001 und ist zu lang. **Frist überschritten:** gegeben Aufgabe #3, wenn `sh` `feindlich.md` aufklappt (Färben dauert gemessen 5,3 s, die Frist ist 1.000 ms ab Übergabe an den Worker), dann trägt die Datei danach `data-farbe="nein"`, hat in keiner Zeile eine Rolle, und die Konsole der Seite enthält keinen Eintrag. Eine ungefärbte Datei trägt keinen Hinweis, gleich ob Endung, Grenze oder Frist die Ursache ist (po-entscheidungen Z. 457, Z. 485).
- [x] **6.** Gegeben Aufgabe #2, wenn `sh` `src/main.rs` aufklappt und dabei (a) `GET /web/vendor/prism.js` per `page.route` mit 404 beantwortet wird (Ladefehler im Worker), (b) `GET /web/faerben.js` mit 404 beantwortet wird, (c) die Seite ohne `Worker` läuft (`page.addInitScript`: `delete window.Worker`) oder (d) `prism.js` per `page.route` durch eine Fassung ersetzt ist, deren `Prism.tokenize` wirft, dann trägt die Datei in jedem der vier Fälle `data-farbe="nein"`, steht ohne Rolle und mit demselben Text da wie mit Farbe, die Seite meldet keinen `pageerror`, und die Konsole enthält außer der Ladefehlermeldung des Browsers zum jeweiligen 404 keinen Eintrag.

### Unverändert

- [x] **7.** Gegeben Aufgabe #2, wenn `sh` `zeichen.js` einmal mit Farbe (`data-farbe="ja"`) und einmal mit `GET /web/vendor/prism.js` → 404 (`data-farbe="nein"`) aufklappt, dann sind je Zeile der Text (`textContent` der Codezelle), die Zahl der Marken (`⟨U+202E⟩`, `␍`, U+2028 als Steuerzeichen-Marke), die Zeilennummern, die Zahl der Blöcke und die geschätzte Blockbreite gleich; `<img src=x onerror=window.PWN=1>` steht als Text da und `window.PWN` ist `undefined`; jedes Element in der Codezelle trägt nur Klassen aus den sieben `tk-…` oder den vorhandenen Marken-Klassen, nie eine Klasse `token` oder einen Typnamen der Grammatik.
- [x] **8.** Gegeben das gestartete Programm, wenn die Seite geladen ist, dann ist `window.Prism` `undefined` und `web/index.html` enthält weder ein Inline-Skript noch ein `<script>` mit `prism.js`; `GET /web/faerben.js` antwortet 200 mit `text/javascript; charset=utf-8`; `GET /web/vendor/prism.js` antwortet 200 mit `text/javascript; charset=utf-8` und einem Kopfkommentar mit Version 1.30.0, Liste der Komponenten und MIT-Hinweis, `GET /web/vendor/LICENSE-prism.txt` antwortet 200 mit `text/plain; charset=utf-8`; die Seite stellt keine Anfrage an einen fremden Host; und der Kommentar mit dem Codeblock ` ```rust ` an Aufgabe #2 enthält im Aufgabenfenster weder eine Klasse `token` noch eine Klasse `tk-…`.

### Farben und Kontrast

- [x] **9.** Gegeben Aufgabe #2 mit aufgeklapptem `src/main.rs`, wenn die Seite hell, mit System dunkel, mit erzwungenem `data-theme="dark"` und mit erzwungenem `data-theme="light"` bei System dunkel gezeigt wird, dann unterscheidet sich die berechnete `color` von `.tk-keyword` zwischen hell und dunkel (die beiden dunklen Lagen gleich, die erzwungen helle gleich der hellen); jede der sieben Rollen hat in jeder der vier Lagen gegen den berechneten Hintergrund der Kontext-, der hinzugefügten und der entfernten Zeile einen Kontrast ≥ 4,5:1 (7 × 3 × 4 = 84 Messungen, alle im Bericht); nur `tk-comment` ist kursiv; die Werte stehen als `--kd-tk-*` in allen drei Themen-Blöcken von `web/kd-tokens.css` und `web/kd-app.css` enthält für `tk-…` keine Farbe als Literal.

### Worker

- [x] **10.** Gegeben die geladene Seite und ein Worker aus `/web/faerben.js`, wenn die Seite ihm zuerst den JSON-Text `{"language":"rust","code":"fn x(){}"}` und danach einen Auftrag für `fn main() {}` als Rust in der Form schickt, die die Review-Seite benutzt, dann ist die erste Antwort des Workers die auf den Auftrag (keine Antwort mit HTML, kein `<span`, kein `token`), und sie ist ein `Int32Array`, dessen Länge durch 4 teilbar ist und dessen Rollenwerte (jedes vierte Element) alle zwischen 0 und 6 liegen.

## Betroffene Verzeichnisstruktur

- neu `web/vendor/prism.js` (vorab gebaut aus `prismjs@1.30.0`, unveränderte Minify-Dateien in der Reihenfolge aus ADR-0037 Punkt 1, Kopfkommentar) und `web/vendor/LICENSE-prism.txt`
- neu `web/faerben.js` — als Worker: `self.Prism = {disableWorkerMessageHandler: true}`, dann `importScripts('/web/vendor/prism.js')` in `try`, Antwort als übertragenes `Int32Array`; unter Node exportiert dieselbe Datei die reine Funktion `hunkTokens(zeilen, grammatik)` (ADR-0040 Punkt 2)
- `src/web/statisch.rs` — drei Einträge in `dateien!` mit MIME-Typ
- `web/index.html` — **kein** `<script>` für `prism.js`
- `web/diff.js` (oder ein kleines eigenes Modul) — reine Funktionen `spracheZuPfad`, `faerbbar`, Grenzen und `FRIST_MS` als benannte Konstanten; Schlange mit Frist; `codeHtml`/`zeileHtml` zeichnen ungefärbt, die Auflage legt die Stücke blockweise auf `sichtbarTeile`; `data-farbe` am Diffbereich
- `web/kd-tokens.css` — `--kd-tk-*` in drei Blöcken; `web/kd-app.css` — `.dz .c .tk-…` nur mit Tokens
- Tests: neu `e2e/einheit/faerben.test.js` (oder Erweiterung von `diff.test.js`), neu `e2e/tests/r00217-syntaxfarben.spec.js`; erweitert `kontrast.spec.js`; Rust-Integrationstest für die drei Dateien in `dateien!`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Interaction I0207, Bubbles B1105–B1111 und B1132 in `Dokumentation/Planung/kanbanD.md`:

1. **B1105 Sondierung M1–M3** — erledigt durch den Abbruch mit Frage (M1 verfehlt); Antwort ADR-0040.
2. **B1106 Prism einbetten, nur im Worker:** `web/vendor/prism.js`, Lizenz, `web/faerben.js` mit `disableWorkerMessageHandler`, `dateien!`; `index.html` lädt Prism nicht. AK 8, 10.
3. **B1107 Sprache und Grenze (rein):** `spracheZuPfad(pfad)`, `faerbbar(patch)`. AK 4, 5.
4. **B1108 Tokens je Hunk und Seite (rein, in `web/faerben.js`):** `hunkTokens(zeilen, grammatik)` → `Int32Array` `[Zeile, von, bis, Rolle]*`. AK 2, 3, 10.
5. **B1109 Schlange mit Frist:** ein Worker, ein Auftrag zur Zeit, Frist, `terminate()`, neuer Worker, veraltete Antworten verworfen, stiller Fehlerpfad; getestet mit Fake-Worker. AK 5 (Frist), 6.
6. **B1132 Auflage blockweise:** Stücke auf `sichtbarTeile`, Marken mit Vorrang, ein Block zu 500 Zeilen je Aufgabe, `data-farbe`. AK 1 (lang), 2–4, 7.
7. **B1110 Farben und Kontrast:** `--kd-tk-*`, CSS, Messung in vier Themenlagen. AK 9.
8. **B1111 Probe im echten Programm:** feindliche E2E-Probe, Mutanten aus ADR-0040 und dieser Anforderung, Gate, abschließen. AK 1–10.

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, Syntax-Block im Kopf (Zeilen 372–377: Rollen und Werte je Thema, vom PO freigegeben) und Liste Z. 483. Die Namen werden `--kd-tk-*` statt `--tk-*`; die Prism-Klassen `.token.…` des Artboards werden zu `tk-…` (ADR-0037 Punkt 5).
- **Was der Mensch anders sieht als mit ADR-0037:** die Datei erscheint erst ungefärbt, die Farbe kommt einen Moment später nach (Block für Block); eine Datei mit teurem Inhalt bleibt nach 1 s ohne Farbe; minifizierte Dateien bekommen jetzt Farbe. Eine Textauswahl, die genau beim Auflegen eines Blocks in der Datei liegt, kann verloren gehen (ADR-0040, in Kauf genommen).
- **Hunk beginnt im Kommentar** (in Kauf genommen, ADR-0037): bis zum Ende des Kommentars im Hunk falsch gefärbt — kein Kriterium, kein Befund.
- **Anfragen des Workers abfangen:** AK 6 (a), (b), (d) und AK 7 brauchen, dass `page.route` die Anfragen von `importScripts` und `new Worker` erreicht; fängt `page.route` sie in der eingesetzten Playwright-Fassung nicht ab, gilt `context.route` (erste Probe in B1106).
- **Reihenfolge der Themen-Blöcke:** `:root` (hell, gilt auch für `data-theme="light"` bei System dunkel), `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}`, `:root[data-theme="dark"]`.
- **Rückbau der WBS (#224):** `--kd-wbs-ok-ink`/`--kd-wbs-error-ink` färben die Vorzeichen der Zeilen; B4 baut nicht auf ihnen auf.
- **Lehre #212:** Kontrast an allen Zuständen messen. Zeilen haben keinen Hover- oder Auswahlzustand außer der Textauswahl des Browsers; „alle Zustände“ heißt hier: drei Zeilenarten × vier Themenlagen.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node, Prism echt per `require`):** `spracheZuPfad` für alle Endungen der Tabelle, Großschreibung, ohne Endung, mehrere Punkte (`a.test.rs`), Pfad mit Ordner `x.rs/README`; `faerbbar` an 262.144/262.145 und 1.000/1.001 (auch mit Ersatzpaaren); `hunkTokens` aus `web/faerben.js` für `fn`, Blockkommentar über drei Zeilen, mehrzeiligen String, Seitenwahl (AK 3), zwei Hunks, Kopf und `\ No newline`, `.unbekannt` ohne Wurf, Antwortform (`Int32Array`, Länge durch 4 teilbar, Rolle 0–6); Invariante für Bidi, `\r`, U+2028, Tab.
- **Unit (Schlange, Fake-Worker, der verzögert oder nie antwortet; Frist injiziert):** Frist abgelaufen ⇒ `terminate` und `data-farbe="nein"`, nächster Auftrag mit neuem Worker; veraltete Antwort (Datei zugeklappt oder neu gezeichnet) verworfen; zweite Datei wartet, bis die erste fertig ist; Auftrag einer geschlossenen Datei fällt aus der Schlange; über der Grenze kein Auftrag; `error`, `messageerror`, Antwort mit `fehler` und fehlendes `Worker` still. **Auflage:** 10.000 Zeilen werden in 20 Aufgaben zu je höchstens 500 Zeilen aufgelegt (Zähler am Planer, deterministisch; der Long-Task-E2E in AK 1 ist Beobachtung unter echter Last).
- **Integration (Rust):** `GET /web/faerben.js`, `/web/vendor/prism.js` und `…/LICENSE-prism.txt` → 200 mit MIME-Typ.
- **E2E (Playwright, headless):** AK 1–10 gegen das gestartete Programm; Konsole über `page.on('console')` und `pageerror` gesammelt und im Testkörper vor dem Abbau geurteilt (Lehre #13); Warten nur auf `data-farbe`.
- **Mutanten** (jeder macht einen benannten Test rot): `<` statt `≤` an beiden Grenzen; Zeile ohne Vorzeichen gezählt; je Zeile statt je Hunk tokenisiert (AK 2 Mittelzeile); Kontext nach der alten Seite (AK 3); über alle Hunks einer Datei tokenisiert (AK 3 Hunk 2); Marke mit `tk-…` überdeckt (AK 7); Token-Text ohne `esc` (AK 7 `window.PWN`); Typname der Grammatik als Klasse (AK 7); `--kd-tk-*` nur im hellen Block (AK 9). Aus ADR-0040: Frist entfernt (AK 1/AK 5, die feindliche Probe hängt bzw. wird rot); `tokenize` auf dem Hauptfaden (AK 1 `longtask` > 150 ms, AK 8 `window.Prism`); `disableWorkerMessageHandler` entfernt (AK 10); veraltete Antwort übernommen (Unit Schlange); alle Blöcke in einer Aufgabe aufgelegt (Unit Auflage, AK 1 `lang.rs`); Fehler ins `console.error` (AK 6).

## Abhängigkeiten

- Abhängig von: [R00207](R00207-review-seite-eines-commits.md) (I0197, Karte #209, erledigt, `braucht:209`); ADR-0040 (Akzeptiert, a9755924; übernimmt die Punkte 1–6 und 8 von ADR-0037), ADR-0033, ADR-0032 Punkt 10, ADR-0014, ADR-0026; Artboard D0009 (Syntax-Block freigegeben). Der Code von [R00210](R00210-alle-aenderungen-der-aufgabe-in-der-review-seite.md) (`web/gesamt.js`, ruft `codeHtml`) steht auf `main`.
- Blockiert: keine.

## Offene Fragen

- ~~**An den product-owner:** Soll eine Datei, die wegen der Grenze ungefärbt bleibt, einen Hinweis tragen („ohne Farbe: zu groß für die Hervorhebung“)?~~ **Entschieden** (po-entscheidungen Z. 457, 2026-11-21): kein Hinweis.
- ~~**An den architekt nach der Sondierung:** Status von ADR-0037 auf „Akzeptiert“ oder Wechsel zu L4.~~ **Entschieden** durch ADR-0040 (Worker mit Frist), ADR-0037 abgelöst.
- ~~**An den product-owner (ADR-0040):** Darf eine Datei über der Frist ohne Farbe bleiben und die Farbe einen Moment nach dem Text erscheinen, beides ohne Hinweis?~~ **Entschieden** (po-entscheidungen Z. 485, 2026-11-21): ja, beides ohne Hinweis; „kein Hinweis“ gilt für jede Ursache einer ausbleibenden Farbe.

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00207 sieht der Mensch in der Abnahme jede Zeile des Diffs, aber ohne Farbe: ein auskommentierter Block oder ein String mit Code darin unterscheidet sich nicht von echtem Code, und er muss jede Zeile ganz lesen. Wird der Code je Hunk und Seite nach der Sprache der Datei gefärbt, erkennt er Kommentar, Text und Code auf einen Blick und liest die Änderung schneller. Weil die Farbe nur eine Auflage auf den unveränderten, maskierten Text ist, bleiben die Marken gegen „Trojan Source“ und die Sicherheit von ADR-0033 unangetastet. Weil Prism nur im Worker mit Frist läuft, kann ein feindlicher Commit, der die gierigen Regeln der Grammatik ausreizt (B1105: 5,4 s innerhalb der Grenzen), die Seite nicht anhalten — der Text steht sofort, und schlimmstenfalls fehlt die Farbe. Der Hebel liegt in `codeHtml`, weil dort beide Ansichten jede offene Datei zeichnen — eine Stelle, beide Ansichten.

## Missing-Docs

- Ob `page.route` in der eingesetzten Playwright-Fassung Anfragen eines Dedicated Workers abfängt, ist nicht belegt (siehe Hinweise; erste Probe in B1106).

## Notizen

- **Schlank arbeiten (A):** zehn Kriterien. Die Abnahmen 1–6 des architekts zu ADR-0037 stecken in AK 2–9 (1 → AK 2, 2 → AK 4, 3 → AK 5, 4 → AK 7, 5 → AK 8 und AK 9, 6 → AK 1); die E2E-Durchsetzung von ADR-0040 in AK 1 (feindlich, `longtask`), AK 8 (`window.Prism`) und AK 10 (JSON-Nachricht).
- **Optionen** sind in ADR-0037 und ADR-0040 abgewogen und entschieden: T2 je Hunk und Seite, L2 feste Grenze als Eingangsfilter, V1 Worker mit Frist (statt V2 Grenze je Hunk-Seite, V3 eigene Tokenisierung, V4 Prism ohne gierige Regeln, V5 Arbeitszähler).
- **Herleitung der Zahlen:** 262.144 = 256 × 1.024, die Grenze der ersten Antwort (ADR-0032 N5.1, UTF-16-Einheiten ≤ Bytes); 1.000 Zeichen je Zeile aus ADR-0037; 150 ms und 1.000 ms aus ADR-0040; Zeiten der feindlichen Fälle gemessen in B1105 (`gemeinsam/scratchpad/entw1-216/messwerte.md` der Factory). Dass `feindlich.js` mit 261 Zeilen im Chromium weit über 1 s liegt, ist **Hypothese** aus Node (18,2 s) und dem etwa quadratischen Wachstum (64 Zeilen im Chromium 1,4 s) — nicht im Chromium gemessen. 10.000 Zeilen ist das Aufklapp-Budget (ADR-0033 Punkt 5); `lang.rs` ist die einzige Datei ihrer Seite und damit „die erste Datei immer“.
- **Verworfen:** ein Zeittest für die Färbedauer im Gate (Wanduhr unter Last wackelt, Lehre #230 und gemeinsam/gelerntes); ein Prüffall nahe der Frist (ADR-0040 Konsequenzen); ein Hinweis an ungefärbten Dateien (PO Z. 457, Z. 485). Das Tag-Kriterium der Sondierung entfällt mit ihr.
- **R00260 (#279):** AK 1 trägt kein Zeitmaß mehr im Gate; das `longtask`-Urteil über 150 ms (`feindlich.*` und `lang.rs`) läuft als Lastprobe (`KD_LASTPROBE=1`, Last < 2), das Gate prüft Text, `data-farbe`, 10.000 Zeilen und 21 Blöcke.
