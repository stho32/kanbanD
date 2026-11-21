---
id: R00217
status: Neu
datum: 2026-11-21
---

# R00217: Syntaxfarben in der Review-Seite

## Beschreibung

Karte #216 (Scheibe B4 des Feinschnitts, Zuschnitt des PO 2026-11-19, po-entscheidungen Z. 384–388).

**Umfang (baut auf [R00207](R00207-review-seite-eines-commits.md) und [R00210](R00210-alle-aenderungen-der-aufgabe-in-der-review-seite.md)):** Die Review-Seite färbt den Code einer offenen Datei nach ihrer Dateiendung: Schlüsselwörter, Strings, Kommentare, Zahlen, Funktionen, Typen und Makros tragen je eine Farbe, in hell und dunkel. Die Farbe ist eine **Auflage**: Text, Marken unsichtbarer Zeichen, Zeilennummern und Aufklappen bleiben genau so, wie R00207 sie zeigt. Gefärbt wird an dem einen Ort, an dem eine offene Datei gezeichnet wird, also in „Ein Commit“ und in „Alle Änderungen“ (auch in den Schritten einer Folge-Datei). Eine Datei ohne bekannte Endung, eine zu große Datei oder ein Fehler der Bibliothek ergibt eine Datei ohne Farbe — ohne Hinweis und ohne Meldung. **Nicht** in B4: Farbe im Markdown der Aufgabe, Sprachen außerhalb der 16 aus ADR-0037 Punkt 3, Content-Security-Policy, Hinweis an einer ungefärbten Datei (offen beim PO, bis zur Antwort: kein Hinweis).

**Zuerst die Sondierung** (ADR-0037 Punkt 9): höchstens 30 Minuten, tagsüber. Trifft sie M1 oder M2 nicht, wird keine Farbe ausgeliefert, und die Frage geht an den architekt zurück (po-entscheidungen Z. 387).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112): die Änderungen als Diff lesend zeigen; Farbe macht den Diff schneller lesbar, ohne etwas zu verändern.

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, liest heute Code ohne Farbe. Ein auskommentierter Block, ein String mit Code darin oder ein Schlüsselwort zwischen Bezeichnern sieht aus wie jede andere Zeile; der Mensch muss ihn erst Zeichen für Zeichen lesen. Mit Farbe erkennt er auf einen Blick, was Kommentar, was Text und was Code ist — und weil die Farbe nur aufgelegt ist, sieht er weiter jedes unsichtbare Zeichen, das ein feindlicher Commit einschmuggeln will.

## Funktionale Anforderungen

1. **Sprache nach Endung** des Pfads (`neu`, bei gelöschten Dateien `alt`), Groß- und Kleinschreibung egal, eine Sprache für beide Seiten einer Datei; Tabelle der Endungen wörtlich aus ADR-0037 Punkt 3 (16 Sprachen).
2. **Je Hunk und Seite**: die alte Seite (Kontext + entfernte Zeilen) und die neue Seite (Kontext + hinzugefügte Zeilen) werden je als ein Text gefärbt; eine entfernte Zeile nimmt die Farbe der alten Seite, hinzugefügte und Kontextzeilen die der neuen. Hunk-Köpfe (`@@ … @@`) und `\ No newline at end of file` bleiben ohne Farbe.
3. **Sieben Rollen** aus ADR-0037 Punkt 5 (Schlüsselwort, String, Kommentar, Zahl, Funktion, Typ, Makro), Klassen `tk-keyword`, `tk-string`, `tk-comment`, `tk-number`, `tk-function`, `tk-type`, `tk-macro`; bei verschachtelten Tokens gilt die innerste Rolle aus der Tabelle; alles andere erbt die Textfarbe. Nur der Kommentar ist kursiv.
4. **Grenze je Datei**: gefärbt wird ein Patch mit höchstens 262.144 Zeichen, dessen Zeilen höchstens 1.000 Zeichen lang sind; sonst bleibt die ganze Datei ohne Farbe. Gezählt wird in UTF-16-Einheiten (`String.length`), je Zeile des Patch-Texts mit Vorzeichen (`+`, `-`, Leerzeichen), ohne das `\n`. Dieselbe Regel gilt für Dateien, die der Mensch nachlädt.
5. **Farbe ohne Folgen**: Ohne bekannte Endung, über der Grenze, ohne geladene Bibliothek oder wenn die Bibliothek wirft, wird die Datei ohne Farbe gezeichnet — ohne Hinweis an der Datei, ohne Meldung in der Konsole.
6. **Auflage**: Text jeder Zeile, Marken für Bidi- und Steuerzeichen, Zeilennummern, Blöcke zu 500 Zeilen, geschätzte Blockbreite und Zeilenbudget sind mit und ohne Farbe gleich; Marken bleiben ohne Farbe und haben Vorrang vor einer Token-Grenze.
7. **Einbettung**: Prism 1.30.0 als vorab gebaute Datei `web/vendor/prism.js` mit Lizenztext `web/vendor/LICENSE-prism.txt`, beide im Programm eingebettet, geladen ohne Inline-Skript und ohne automatisches Färben; es wird nichts von außen nachgeladen.
8. **Farben je Thema** als `--kd-tk-*` aus dem Artboard D0009 in allen drei Themen-Blöcken von `web/kd-tokens.css`.

## Nicht-funktionale Anforderungen

- **Performance (Sondierung, Tag-Kriterium):** M1 Tokenisieren und Zerlegen eines Patches mit 262.144 Zeichen ≤ 150 ms je Sprache; M2 erster Aufbau von 10.000 gefärbten Zeilen ≤ 150 ms (ungefärbt gemessen 38 ms, ADR-0033). Gemessen nur tagsüber (8–21 Uhr) bei geringer Last — nachts gemessene Werte gelten nicht (Lehre #230). Die Messungen sind Lastbeobachtung der Sondierung, kein Test im Gate (gemeinsam/gelerntes: Wanduhr-Proben sind kein Gate).
- **Sicherheit:** Kein HTML stammt von Prism oder aus dem Dateiinhalt; jeder Token-Text geht maskiert in ein festes Element, Klassen nur aus der Tabelle; an Prism wird nur `tokenize` und `languages` benutzt (ADR-0037 Punkt 2, Review-Punkt für `security-reviewer`).
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

### Sondierung (Tag-Kriterium — nicht im Nachtbetrieb)

- [ ] **1.** Gegeben ein Patch mit 262.144 Zeichen je in Rust, JavaScript und Markdown und ein Patch aus 261 Zeilen zu 1.000 Zeichen (261 × 1.001 mit `\n` = 261.261 ≤ 262.144, also noch färbbar), wenn er tagsüber (8–21 Uhr, 1-Minuten-Last beim Start ≤ 2,0) im Chromium aus `e2e/node_modules` fünfmal tokenisiert und in Zeilenstücke zerlegt wird, dann ist der Median je Patch ≤ 150 ms (**M1**); und gegeben 10.000 gefärbte Zeilen (20 Blöcke zu 500), wenn sie erstmals gezeichnet werden, dann dauert der Aufbau gestaffelt wie in ADR-0033 im Median ≤ 150 ms (**M2**). Dazu ist am Quelltext von `prism-core` 1.30.0 belegt (Fundstelle Datei:Zeile): `tokenize` ruft keine Hooks, `data-manual` am Skript verhindert das automatische Färben, CVE-2024-53382 ist laut Changelog behoben (**M3**). Messwerte, Uhrzeit und Last stehen im Bericht. Verfehlt M1 oder M2 das Ziel, wird keine Farbe ausgeliefert, die Grenzen bleiben, und die Frage geht an den architekt.

### Farbe

- [ ] **2.** Gegeben Aufgabe #2, wenn `sh` `src/main.rs` in „Ein Commit“ und in „Alle Änderungen“ aufklappt, dann trägt `fn` in beiden Ansichten die Rolle Schlüsselwort (`tk-keyword`), alle drei Zeilen des Blockkommentars tragen die Rolle Kommentar (`tk-comment`, auch die mittlere `   zweite Zeile` ganz), und der Hunk-Kopf `@@ … @@` trägt keine Rolle.
- [ ] **3.** Gegeben Aufgabe #2, wenn `sh` `src/seiten.rs` und `src/hunks.rs` aufklappt, dann trägt die entfernte Zeile `/* weg` die Rolle Kommentar (alte Seite), in der Kontextzeile `*/ let c = 3;` trägt `*/` keine Rolle Kommentar und `let` die Rolle Schlüsselwort (neue Seite), und in Hunk 2 von `src/hunks.rs` trägt `fn` die Rolle Schlüsselwort, obwohl Hunk 1 in einem offenen Kommentar endet (der Fehler bleibt im Hunk).
- [ ] **4.** Gegeben Aufgabe #2, wenn `sh` alle Dateien aufklappt, dann tragen `Makefile`, `notiz.unbekannt` und `Typ.TS` keine Rolle und die Konsole der Seite enthält keinen Eintrag der Art `error` oder `warning`; `SRC/GROSS.RS` und `umbenannt.rs` (beide Seiten) sind als Rust gefärbt, die gelöschte `alt.py` als Python (`def` mit Rolle Schlüsselwort).

### Grenze und Fehlerpfad

- [ ] **5.** Gegeben ein Patch mit genau 262.144 Zeichen und einer mit 262.145 Zeichen (Rechnung: 256 × 1.024 = 262.144), wenn sie gezeichnet werden, dann ist der erste gefärbt und der zweite in **keiner** Zeile; gegeben Aufgabe #2, wenn `sh` `grenze.rs` und `drueber.rs` aufklappt, dann ist `fn` in `grenze.rs` Schlüsselwort (längste Patch-Zeile 1 + 999 = 1.000) und `drueber.rs` hat in keiner Zeile eine Rolle (1 + 1.000 = 1.001). Gezählt wird in UTF-16-Einheiten: eine Patch-Zeile `+` mit 500 × 😀 hat 1 + 500 × 2 = 1.001 und ist zu lang. Eine ungefärbte Datei trägt keinen Hinweis (bis zur Antwort des PO, siehe Offene Fragen).
- [ ] **6.** Gegeben Aufgabe #2 und `GET /web/vendor/prism.js` per `page.route` mit 404 beantwortet, wenn `sh` `src/main.rs` aufklappt, dann steht die Datei ohne Rolle und mit demselben Text da wie mit Farbe, und die Konsole enthält außer der Ladefehlermeldung des Browsers zu diesem 404 keinen Eintrag; ebenso ohne jede Konsolenmeldung, wenn `Prism.tokenize` beim Färben wirft.

### Unverändert

- [ ] **7.** Gegeben Aufgabe #2, wenn `sh` `zeichen.js` einmal mit Farbe und einmal ohne geladene Bibliothek aufklappt, dann sind je Zeile der Text (`textContent` der Codezelle), die Zahl der Marken (`⟨U+202E⟩`, `␍`, U+2028 als Steuerzeichen-Marke), die Zeilennummern, die Zahl der Blöcke und die geschätzte Blockbreite gleich; `<img src=x onerror=window.PWN=1>` steht als Text da und `window.PWN` ist `undefined`; jedes Element in der Codezelle trägt nur Klassen aus den sieben `tk-…` oder den vorhandenen Marken-Klassen, nie eine Klasse `token` oder einen Typnamen der Grammatik.
- [ ] **8.** Gegeben das gestartete Programm, wenn die Seite geladen ist, dann ist `Prism.manual === true`; `GET /web/vendor/prism.js` antwortet 200 mit `text/javascript; charset=utf-8` und einem Kopfkommentar mit Version 1.30.0, Liste der Komponenten und MIT-Hinweis, `GET /web/vendor/LICENSE-prism.txt` antwortet 200 mit `text/plain; charset=utf-8`; `web/index.html` enthält kein Inline-Skript; die Seite stellt keine Anfrage an einen fremden Host; und der Kommentar mit dem Codeblock ` ```rust ` an Aufgabe #2 enthält im Aufgabenfenster weder eine Klasse `token` noch eine Klasse `tk-…`.

### Farben und Kontrast

- [ ] **9.** Gegeben Aufgabe #2 mit aufgeklapptem `src/main.rs`, wenn die Seite hell, mit System dunkel, mit erzwungenem `data-theme="dark"` und mit erzwungenem `data-theme="light"` bei System dunkel gezeigt wird, dann unterscheidet sich die berechnete `color` von `.tk-keyword` zwischen hell und dunkel (die beiden dunklen Lagen gleich, die erzwungen helle gleich der hellen); jede der sieben Rollen hat in jeder der vier Lagen gegen den berechneten Hintergrund der Kontext-, der hinzugefügten und der entfernten Zeile einen Kontrast ≥ 4,5:1 (7 × 3 × 4 = 84 Messungen, alle im Bericht); nur `tk-comment` ist kursiv; die Werte stehen als `--kd-tk-*` in allen drei Themen-Blöcken von `web/kd-tokens.css` und `web/kd-app.css` enthält für `tk-…` keine Farbe als Literal.

## Betroffene Verzeichnisstruktur

- neu `web/vendor/prism.js` (vorab gebaut aus `prismjs@1.30.0`, unveränderte Minify-Dateien in der Reihenfolge aus ADR-0037 Punkt 1, Kopfkommentar) und `web/vendor/LICENSE-prism.txt`
- `src/web/statisch.rs` — zwei Einträge in `dateien!` mit MIME-Typ
- `web/index.html` — `<script src="/web/vendor/prism.js" data-manual>` vor `diff.js`
- `web/diff.js` — reine Funktionen `spracheZuPfad`, `faerbbar`, `hunkTokens`, Grenzen als benannte Konstanten; `codeHtml`/`zeileHtml` legen die Stücke auf `sichtbarTeile`
- `web/kd-tokens.css` — `--kd-tk-*` in drei Blöcken; `web/kd-app.css` — `.dz .c .tk-…` nur mit Tokens
- Tests: neu `e2e/einheit/faerben.test.js` (oder Erweiterung von `diff.test.js`), neu `e2e/tests/r00217-syntaxfarben.spec.js`; erweitert `kontrast.spec.js`; Rust-Integrationstest für die zwei Dateien in `dateien!`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Interaction I0207, Bubbles B1105–B1111 in `Dokumentation/Planung/kanbanD.md`:

1. **B1105 Sondierung M1–M3** (Zeitbox 30 Minuten, tagsüber, Wegwerfcode in der Ablage): AK 1. Fällt sie durch, endet die Karte hier.
2. **B1106 Prism einbetten:** Datei bauen, Lizenz, `dateien!`, `data-manual`.
3. **B1107 Sprache und Grenze (rein):** `spracheZuPfad(pfad)`, `faerbbar(patch)`.
4. **B1108 Tokens je Hunk und Seite (rein):** `hunkTokens(zeilen, grammatik)` → je Zeile Stücke `{text, klasse}`.
5. **B1109 Auflage beim Zeichnen:** Stücke an den Token-Grenzen auf `sichtbarTeile`, Marken mit Vorrang, Fehlerpfad still.
6. **B1110 Farben und Kontrast:** `--kd-tk-*`, CSS, Messung in vier Themenlagen.
7. **B1111 Probe im echten Programm, Mutanten, Gate, abschließen.**

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, Syntax-Block im Kopf (Zeilen 372–377: Rollen und Werte je Thema, vom PO freigegeben) und Liste Z. 483. Die Namen werden `--kd-tk-*` statt `--tk-*`; die Prism-Klassen `.token.…` des Artboards werden zu `tk-…` (ADR-0037 Punkt 5).
- **Hunk beginnt im Kommentar** (in Kauf genommen, ADR-0037): bis zum Ende des Kommentars im Hunk falsch gefärbt — kein Kriterium, kein Befund.
- **Reihenfolge der Themen-Blöcke:** `:root` (hell, gilt auch für `data-theme="light"` bei System dunkel), `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])}`, `:root[data-theme="dark"]`.
- **Rückbau der WBS (#224):** `--kd-wbs-ok-ink`/`--kd-wbs-error-ink` färben die Vorzeichen der Zeilen; B4 baut nicht auf ihnen auf.
- **Lehre #212:** Kontrast an allen Zuständen messen. Zeilen haben keinen Hover- oder Auswahlzustand außer der Textauswahl des Browsers; „alle Zustände“ heißt hier: drei Zeilenarten × vier Themenlagen.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node, Prism echt per `require`):** `spracheZuPfad` für alle Endungen der Tabelle, Großschreibung, ohne Endung, mehrere Punkte (`a.test.rs`), Pfad mit Ordner `x.rs/README`; `faerbbar` an 262.144/262.145 und 1.000/1.001 (auch mit Ersatzpaaren); `hunkTokens` für `fn`, Blockkommentar über drei Zeilen, mehrzeiligen String, Seitenwahl (AK 3), zwei Hunks, Kopf und `\ No newline`, `.unbekannt` ohne Wurf; Invariante für Bidi, `\r`, U+2028, Tab.
- **Integration (Rust):** `GET /web/vendor/prism.js` und `…/LICENSE-prism.txt` → 200 mit MIME-Typ.
- **E2E (Playwright, headless):** AK 2–9 gegen das gestartete Programm; Konsole über `page.on('console')` und `pageerror` gesammelt und im Testkörper vor dem Abbau geurteilt (Lehre #13).
- **Mutanten** (jeder macht einen benannten Test rot): `<` statt `≤` an beiden Grenzen; Zeile ohne Vorzeichen gezählt; je Zeile statt je Hunk tokenisiert (AK 2 Mittelzeile); Kontext nach der alten Seite (AK 3); über alle Hunks einer Datei tokenisiert (AK 3 Hunk 2); Marke mit `tk-…` überdeckt (AK 7); Token-Text ohne `esc` (AK 7 `window.PWN`); Typname der Grammatik als Klasse (AK 7); `data-manual` entfernt (AK 8); Fehler ins `console.error` (AK 6); `--kd-tk-*` nur im hellen Block (AK 9).

## Abhängigkeiten

- Abhängig von: [R00207](R00207-review-seite-eines-commits.md) (I0197, Karte #209, erledigt, `braucht:209`); ADR-0037 (Vorgeschlagen bis zur Sondierung), ADR-0033, ADR-0032 Punkt 10; Artboard D0009 (Syntax-Block freigegeben). Der Code von [R00210](R00210-alle-aenderungen-der-aufgabe-in-der-review-seite.md) (`web/gesamt.js`, ruft `codeHtml`) steht auf `main`.
- Blockiert: keine.

## Offene Fragen

- ~~**An den product-owner:** Soll eine Datei, die wegen der Grenze ungefärbt bleibt, einen Hinweis tragen („ohne Farbe: zu groß für die Hervorhebung“)?~~ **Entschieden** (po-entscheidungen Z. 457, 2026-11-21): kein Hinweis, die vorläufige Regel ist endgültig; AK 5 bleibt wie geschrieben.
- **An den architekt nach der Sondierung:** Status von ADR-0037 auf „Akzeptiert“ oder Wechsel zu L4 (ADR-0037 Folgeaufgaben).

## Manuelle Vorbereitungstätigkeiten

- Sondierung tagsüber einplanen (8–21 Uhr), bei geringer Last.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00207 sieht der Mensch in der Abnahme jede Zeile des Diffs, aber ohne Farbe: ein auskommentierter Block oder ein String mit Code darin unterscheidet sich nicht von echtem Code, und er muss jede Zeile ganz lesen. Wird der Code je Hunk und Seite nach der Sprache der Datei gefärbt, erkennt er Kommentar, Text und Code auf einen Blick und liest die Änderung schneller. Weil die Farbe nur eine Auflage auf den unveränderten, maskierten Text ist, bleiben die Marken gegen „Trojan Source“ und die Sicherheit von ADR-0033 unangetastet; die feste Grenze hält einen feindlichen Commit davon ab, die Seite über die Färbung lahmzulegen. Der Hebel liegt in `codeHtml`, weil dort beide Ansichten jede offene Datei zeichnen — eine Stelle, beide Ansichten.

## Missing-Docs

- Verhalten von `Prism.tokenize` ohne Hooks und von `data-manual` ist in ADR-0037 aus dem Gedächtnis beschrieben; die Sondierung belegt es am Quelltext (AK 1, M3).

## Notizen

- **Schlank arbeiten (A):** neun Kriterien; die Abnahmen 1–6 des architekts stecken in AK 2–9 (1 → AK 2, 2 → AK 4, 3 → AK 5, 4 → AK 7, 5 → AK 8 und AK 9, 6 → AK 1).
- **Optionen** sind in ADR-0037 abgewogen und entschieden: T2 je Hunk und Seite (statt T1 je Zeile, T3 je Datei, T4 ganze Datei laden), L2 feste Grenze (statt L1 alles, L3 Zeitbudget, L4 beim Sichtbarwerden oder Worker — Rückfall, falls M2 verfehlt).
- **Herleitung der Zahlen:** 262.144 = 256 × 1.024, die Grenze der ersten Antwort (ADR-0032 N5.1, UTF-16-Einheiten ≤ Bytes); 1.000 Zeichen je Zeile und 150 ms aus ADR-0037; 38 ms ungefärbt gemessen (ADR-0033); 10.000 Zeilen ist das Aufklapp-Budget (ADR-0033 Punkt 5). Die Lastschwelle 2,0 für die Sondierung ist Vorschlag des planers (Hypothese, nicht gemessen) — am 2026-11-21 um 03:32 lag die Last bei 1,63.
- **Verworfen:** ein automatisierter Zeittest im Gate für M1/M2 (Wanduhr unter Last wackelt, Lehre #230 und gemeinsam/gelerntes); ein Hinweis an ungefärbten Dateien (offen beim PO).
