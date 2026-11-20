---
id: R00207
status: Neu
datum: 2026-11-20
---

# R00207: Review-Seite eines Commits

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karten #207/#209, Review-Knopf) und Karte #209.

**Umfang (Scheibe B2 des Feinschnitts, baut auf [R00206](R00206-diff-eines-commits-per-api-lesen.md) und [R00205](R00205-ansicht-commits-im-aufgabenfenster.md)):** Ein Mensch öffnet aus der Ansicht „Commits“ des [Aufgabenfensters](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) eine eigene Seite mit eigener Adresse, die den Diff **eines** Commits der Aufgabe zeigt: Commit-Kopf, Dateiliste, je Datei einklappbar der Standard-Diff mit alter und neuer Zeilennummer. Von dort blättert er mit „Zurück“ und „Vor“ von Commit zu Commit („i von n“). Gelesen wird aus `GET /api/aufgaben/{nr}/commits` (R00204) und `GET /api/aufgaben/{nr}/diff?commit=` (R00206). **Nicht** in B2: Gesamt-Diff und Umschalter „Alle Änderungen | Ein Commit“ (B3, #215), Syntaxfarben (B4, #216), Nachfolgervorschlag (A5), jede Schreibaktion.

**Grundlagen:** ADR-0033 Punkte 1–9 mit den Rändern (a)–(d) (Adresse, Navigation, Laden, Insel, Zeichenbudget, Nachladen, Fehler, fremder Text, Knopf bis B3); Artboard `Dokumentation/Wireframes/D0009.dc.html`, Anker `#diff-fenster`, `#diff-raender` (Bilder 1–10a) und `#commits-ansicht` Bild 3/3a, nachgezeichnet in 30430c4b und vom product-owner **freigegeben mit Änderung** (`AI-Team/po-entscheidungen.md` Z. 414–418). Die Zeichnung ist die Quelle für Aussehen, Abstände und Reihenfolge; diese Anforderung legt Verhalten und Wortlaute fest. Die beiden Änderungen des PO gehen der Zeichnung vor: der Zustand „wartet“ (FA 7) und der Knopfrand (FA 11).

**Ersetzt eine Aussage von R00205:** R00205 AK 2 verlangt „keinen Knopf „Alle Änderungen ansehen“ und keinen Verweis (`a[href]`) in der Liste“. Das galt bis B2 (PO Z. 409); mit dieser Anforderung kommen Knopf und Verweise (FA 1), und die Probe von R00205 AK 2 wird an diesem Punkt umgekehrt. Alle übrigen Kriterien von R00205 gelten unverändert und werden in der Abnahme erneut geprüft (AK 1).

**Wortlaut:** „Aufgabe“, nie „Karte“ (PO Z. 399). Die Zustandswörter sind die von R00205 FA 5.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: nur lesen, kein Kommentar, keine Freigabe im Diff).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — Einstieg (Ansicht „Commits“) und Ziel des Rückwegs
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — liest auf der Review-Seite nichts neu
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md) — bleibt beim Live-Ereignis, weil der Diffbereich derselbe Knoten bleibt
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — bis 640 px Blätterknöpfe als Symbol mit Namen
- Die Begriffe Review-Seite, Commit-Verweis und verwaist fehlen im Glossar (Auftrag an den fachspezialist); bis dahin gelten die Wörter von R00204 und ADR-0033.

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, liest heute die Änderungen hinter ihr nur mit Git auf einem Rechner mit dem Arbeits-Repository. Mit der Review-Seite liest er jeden Commit der Aufgabe im Board, auch auf dem Handy, und ein Link auf genau diesen Commit lässt sich weitergeben. Damit ist der Wunsch des Betreibers nach dem Review-Knopf erfüllt (PO Z. 396, 409, 411).

## Funktionale Anforderungen

1. **Einstieg aus der Liste (B1, PO Z. 409, 416):** Im Kopf der Ansicht „Commits“ steht der Knopf „Alle Änderungen ansehen“; er führt auf `…/review` (FA 2). Kurz-Hash und ganze Zeile jedes Eintrags mit Diff (`auf_zweig`, `verwaist`) sind echte Verweise (`a[href]`) auf `…/review?commit=<voller verweis>`; Einträge ohne Diff (`fehlt`, `repository_fehlt`, `anwendung_unbekannt`, `unlesbar`) tragen **keinen** Verweis. Ein einfacher Linksklick ohne Umschalt- oder Steuertaste öffnet die Seite und legt **einen** Verlaufseintrag mit Marke an (ADR-0033 Punkt 2); Mittelklick und „In neuem Tab öffnen“ bleiben Links. Hat die Aufgabe keinen Eintrag mit Diff, steht der Knopf trotzdem und führt auf den Rand (c) (FA 4), nie ins Leere.
2. **Adresse (ADR-0033 Punkt 1):** `#/board/<slug>/aufgabe/<nr>/review?commit=<verweis>` und `#/aufgaben/aufgabe/<nr>/review?commit=<verweis>`; `<verweis>` URL-kodiert, `<kürzel>:<hash>` oder `<hash>`, Hash 7 bis 64 Hex-Zeichen. Das Aufgabenfenster öffnet sich auf dieser Adresse **nicht**. Ein Verweis, der nicht die Form `^([a-z0-9]{1,8}:)?[0-9a-fA-F]{7,64}$` hat, geht in keine Anfrage; die Seite sagt „Verweis ungültig. Die Adresse nennt keinen Commit in gültiger Form.“ mit „Zur Liste der Commits“, **ohne** den Text der Adresse. `…/review` ohne `commit` zeigt den ersten Commit mit Diff und ersetzt die Adresse durch `…/review?commit=<sein voller verweis>` (`replaceState`).
3. **Blättern (ADR-0033 Punkt 2 und 9, PO Z. 411, 415):** Die Folge sind die Einträge von `GET …/commits` mit Diff (`auf_zweig`, `verwaist`) in der Reihenfolge der Antwort; „i von n“ zählt über sie. „i“ ergibt sich aus dem **vollen Hash der Diff-Antwort**, nie aus dem Text der Adresse (Rand a). „Zurück“ fehlt am ersten, „Vor“ am letzten Commit; der Platz bleibt leer, es gibt keinen Umlauf und **keinen** deaktivierten Knopf (Rand d). Jeder Schritt **ersetzt** den Verlaufseintrag. Bis 640 px sind „Zurück“ und „Vor“ Symbolknöpfe „‹“ und „›“ mit den Namen „Voriger Commit, <i−1> von <n>“ bzw. „Nächster Commit, <i+1> von <n>“.
4. **Ränder der Folge:** (b) Steht der Commit der Diff-Antwort nicht in der Folge, steht der Diff ohne „i von n“, ohne „Zurück“ und „Vor“, mit „Zum ersten Commit“ und dem Satz „<verweis> gehört nicht zu den Commits dieser Aufgabe mit Diff. Gezeigt wird sein Diff, ohne „i von n“.“ (c) Hat die Aufgabe keinen Eintrag mit Diff, bleibt die Adresse `…/review` ohne `?commit=`; die Seite sagt „Keine Änderungen zu zeigen. Zu keinem Commit der Aufgabe gibt es einen Diff:“, nennt je Eintrag Verweis, Zustandswort und Hinweis (wie R00205 FA 5) und führt mit „Zurück zur Liste der Commits“ zurück.
5. **Seite:** Kopf mit Rückweg „← #<nr>“, „Review“, Titel der Aufgabe und „liest nur“; Leiste mit Blättern, Summe („<d> Dateien · +<plus> −<minus>“) und „Alle einklappen“; Commit-Kopf mit Kurz-Hash, Zweigen oder „auf keinem Zweig“, vollem Titel, Autor, Datum, Zeilen und Dateien. Bei `verwaist` steht das Band „Dieser Commit ist verwaist: Kein Zweig führt zu ihm. Sein Diff bleibt lesbar. Nach einem Rebase mit ersetzen nachziehen; im Gesamtbild der Aufgabe zählt er nicht mit.“ Die Dateiliste nennt je Datei Status als Wort („neu“, „geändert“, „gelöscht“, „umbenannt“, „Typ geändert“), Pfad und `+`/`−`; ein Eintrag springt zur Datei und klappt sie auf. Je Datei ein Kopf als Knopf (`aria-expanded`) und darunter die Tabelle alt · neu · Zeichen · Code; Zeilennummern aus den `@@ -a,b +c,d @@`-Köpfen, zerlegt nur an `\n`; `\ No newline at end of file` ist eine Hinweiszeile ohne Nummer. Merkmale nie still: „umbenannt ← <alter Pfad> · <ähnlichkeit> %“, „Dateimodus <alt> → <neu>; der Inhalt ist unverändert.“, „Nicht als UTF-8 lesbar — nicht darstellbare Zeichen sind ersatzweise mit � wiedergegeben.“, „Binärdatei — der Inhalt wird nicht angezeigt.“, „Zu groß zum Anzeigen. Es stehen nur die Zahlen: +<plus> −<minus>.“ (ohne Knopf), gelöschte Dateien zugeklappt. Bei `dateien_gekappt` steht über den Dateien „<gezeigt> von <gesamt> Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; der Commit liegt vollständig im Repository.“, die Zahlen nur aus der Antwort. Keine Texte nennen Byte- oder MB-Grenzen.
6. **Zeichenbudget (ADR-0033 Punkt 5):** Beim ersten Aufbau werden Dateien mit `patch` in der Reihenfolge der Liste aufgeklappt, solange die Summe ihrer gezeichneten Zeilen (jede Zeile des Patch-Textes ab `@@`, Hunk-Köpfe und Hinweiszeilen eingeschlossen) einschließlich der Datei **höchstens 10.000** bleibt; die erste Datei, die nicht mehr passt, und alle folgenden bleiben zu (gelöschte immer zu). Aufgeklappte Dateien stehen in Blöcken zu 500 Zeilen mit `content-visibility: auto`. Was der Mensch aufklappt, wird ganz gezeichnet, nie gekürzt; lange Zeilen laufen quer im Bereich der Datei und werden nie umgebrochen.
7. **Nachladen und „wartet“ (ADR-0033 Punkt 6, PO Z. 417):** Eine Datei mit `gross` ohne Hinweis `zu_gross_zum_anzeigen` zeigt „Der Patch ist groß (<plus + minus> Zeilen) und wird erst auf Wunsch geladen.“ mit „Änderungen anzeigen“; eine Datei mit `nachladen` „Diese Datei war nicht in der ersten Antwort, weil die Antwort zu groß wurde. Sie wird einzeln geladen.“ mit „Nachladen“. Beide laden `…/diff?commit=…&datei=<neu, bei gelöschten alt>`, **höchstens eine Anfrage `datei=` zur Zeit** je Seite. Während sie läuft, zeigt die Datei „Lädt die Änderungen …“. Wird eine zweite Datei angefordert, steht an ihrem Ort eine Sanduhr in `--kd-muted` und „Wartet, bis die andere Datei geladen ist …“, **ohne** „Nachladen“ und ohne „Änderungen anzeigen“. Ist die vorige Anfrage fertig, auch mit Fehler, startet die wartende von selbst und zeigt „Lädt die Änderungen …“. Liefert die Antwort mehrere Dateien (Ersatzzeichen im Namen), gilt die mit gleichem `status`, `alt`, `neu` an der Position ihrer Reihenfolge. Kommt `zu_gross_zum_anzeigen`, steht danach „Zu groß zum Anzeigen …“ ohne Knopf. Eine Datei mit `zu_gross_zum_anzeigen` in der ersten Antwort (Patch über der Grenze, Pfad über 4.096 Byte) hat keinen Knopf.
8. **Fehler (ADR-0033 Punkt 7):** Eine Fehlerart ergibt sich aus Status und Text: 503 mit `fehler`, das mit „Antwortbudget“ beginnt → „Server ausgelastet (Antwortbudget).“ (amber, Server-Symbol); jeder andere 503 → „Zeitgrenze überschritten.“ (rot, Uhr); 404 und 400 → kein Diff. Seite: „Server ausgelastet (Antwortbudget). Der Diff wurde nicht gelesen, weil der Server gerade zu viele große Antworten ausliefert. Es wird nicht von selbst wiederholt.“ bzw. „Zeitgrenze überschritten. Der Diff ließ sich nicht lesen: <fehler der Antwort> (503).“, je mit „Erneut versuchen“; 404 „Zu diesem Verweis gibt es keinen Diff: <verweis> ist <Zustandswort>.“ mit „Zur Liste der Commits“. Datei: „Zeitgrenze überschritten. Die Änderungen dieser Datei konnten nicht geladen werden (503).“ bzw. „Server ausgelastet (Antwortbudget). Die Änderungen dieser Datei wurden nicht geladen. Es wird nicht von selbst wiederholt.“, je mit „Erneut versuchen“; die Datei bleibt zu, die Seite lesbar. **Keine automatische Wiederholung.** Laden der Seite: „Liest den Diff von <kurzform> …“.
9. **Laden, Insel, Live (ADR-0033 Punkte 3 und 4):** Beim Öffnen laufen `GET …/commits` und `GET …/diff?commit=` parallel. Es gilt nur die Antwort zum aktuellen Schlüssel Aufgabe + Commit; eine Antwort für einen verlassenen Commit wird verworfen. Diff-Anfragen haben die Frist 15 s bis zum Kopf und 60 s für den Rumpf. Ein Live-Ereignis liest weder Liste noch Diff neu; der Diffbereich bleibt **derselbe Knoten** mit Klappen, Nachgeladenem, Textauswahl und Leseposition. Nach Zurück, Vor oder Neuladen ergibt der Aufbau dasselbe Bild der Klappen dieses Commits, solange die Seite nicht verlassen wurde.
10. **Rückweg (ADR-0033 Punkt 2):** „← #<nr>“ und „Zur Liste der Commits“ führen ins Aufgabenfenster mit der Ansicht „Commits“: mit Marke (aus der Liste geöffnet) über `history.back()`, ohne Marke (Link, Lesezeichen) über `replaceState` auf die Adresse des Fensters. Der Browser-Zurück-Knopf führt von der Seite in **einem** Schritt dorthin, gleich wie oft geblättert wurde.
11. **Knöpfe (PO Z. 418):** Alle Knöpfe (B1 und B2: „Alle Änderungen ansehen“, „Zurück“, „Vor“, „Zum ersten Commit“, „Alle einklappen“, „Erneut versuchen“, „Nachladen“, „Änderungen anzeigen“, „Zur Liste der Commits“, „Zurück zur Liste der Commits“) nutzen die gemeinsame Klasse `.btn` **unverändert**, mit dem Rand `--kd-line-strong`; der dunklere Rand des Artboards wird nicht übernommen. Die Symbolknöpfe „‹ ›“ haben ein Symbol mit mindestens 3:1 gegen ihren Grund und ihren Namen; jeder Knopf hat den Fokusring.
12. **Fremder Text (ADR-0033 Punkt 8, Label `sicherheit`):** Pfade, Patch-Zeilen, Titel, Autor, Zweige, Verweise und `fehler` gehen nur über `esc` in feste Elemente, nie als HTML oder Markdown, und es gibt keine Hervorhebung. Bidi-Steuerzeichen (U+202A–202E, U+2066–2069) erscheinen in Pfaden und Patch-Zeilen als Marke mit Auge-Symbol und Text (z. B. `⟨U+202E⟩`), andere Steuerzeichen außer Tab und ein `\r` am Zeilenende als Bildzeichen mit Code (`␛ U+001B`, `␍`); die Bedienhilfe liest „sichtbar gemachtes Bidi-Steuerzeichen U+202E“, `aria-label` trägt die Marke als Text. **Nichts davon wird entfernt.**
13. **Tokens (PO Z. 401):** Die Tokens `--tk-keyword`, `--tk-string`, `--tk-comment`, `--tk-number`, `--tk-function`, `--tk-type`, `--tk-macro` kommen in der gezeichneten Form hell und dunkel nach `web/kd-tokens.css`; B2 verwendet sie nicht (Hervorhebung erst B4).

## Nicht-funktionale Anforderungen

- **Breite:** Bei 320, 414, 641, 768, 980 und 1280 px (Fensterbreite), hell und dunkel, gilt `documentElement.scrollWidth ≤ documentElement.clientWidth`; quer scrollen darf nur der Code-Bereich je Datei (ADR-0033 Punkt 8, lange Zeilen). Die Zwischenbreiten 641, 768 und 980 px sind Pflicht (Lehre #212: zwischen schmalem und breitem Layout wurde eine Spalte auf 38 px gequetscht).
- **Ziele:** Bei grobem Zeiger ist jedes Bedienziel der Seite und der Zeile der Liste mindestens 48 × 48 px.
- **Themen:** Kontrast nach `kontrastVerstoesse`: 4,5:1 für Text, 3:1 für Symbole und Ränder der Marken; Tokens `--tk-*` mindestens 5,45 hell und 6,03 dunkel auf Normal, Hinzugefügt und Entfernt (PO Z. 401).
- **Zeichnen:** 10.000 gezeichnete Zeilen beim ersten Aufbau (ADR-0033: gemessen 38 ms gestaffelt); ein Live-Ereignis zeichnet den Diffbereich nicht neu.
- **Last:** Die Seite startet höchstens zwei Anfragen beim Öffnen und höchstens eine `datei=` zur Zeit; keine Wiederholung ohne Klick.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, erweitert die von R00205; jede Probe stellt ihre Aufgabe selbst her). Browser headless, Zeitzone `Europe/Berlin`, Mensch `sh`:

- **Arbeits-Repository R, Register und Board wie in R00204/R00205** (K1–K4 auf `main`, W1 auf `karte/1`, V1 verwaist, V2 gelöscht, R1 nur auf `o/x`; Anwendung `kd`).
- **Aufgabe #1:** Verweise `kd:<K3>`, `kd:<W1>`, `kd:<V1>`, `kd:<V2>`, `kd:<R1>`; die Liste liefert `K3, W1, V1, R1, V2`. **Rechenbeispiel:** fünf Einträge, V2 (`fehlt`) hat keinen Diff → Folge `K3, W1, V1, R1`, n = 4; V1 ist „3 von 4“.
- **Aufgabe #6 (Rand c):** nur `kd:<V2>` und `xy:<K1>` (Anwendung nicht eingetragen).
- **Aufgabe #7 (Inhalt und Ränder), ein Commit D** mit: Textdatei mit drei Hunks, darin eine Zeile mit `\r\n`, eine mit U+2028 und `\ No newline at end of file`; neue, gelöschte, umbenannte (100 %) Datei; Modus 100644 → 100755 ohne Inhalt; Binärdatei; Datei mit Latin-1-Bytes; Pfad und Zeile mit U+202E, Zeile mit ESC (U+001B); Pfad, Zeile und Commit-Titel mit `<img src=x onerror=window.pwn=1> "x"`; eine Zeile aus 200.000 Zeichen; Datei mit 3.001 geänderten Zeilen (`gross`); Pfad über 4.096 Byte (über Git-Plumbing, `zu_gross_zum_anzeigen`).
- **Aufgabe #8 (Budget), Commit E:** fünf neue Dateien, vier mit je 2.499 Zeilen (je 2.500 gezeichnete Zeilen mit `@@`), die fünfte mit 1 Zeile. **Rechenbeispiel:** 4 × 2.500 = 10.000 ≤ 10.000 → vier offen; mit der fünften 10.002 > 10.000 → zu.
- **Aufgabe #9 (Nachladen), Commit F:** 25 Dateien zu je 202.019 Byte Patch (R00206: 20 mit `patch`, 5 `nachladen`) und eine `gross`-Datei.
- **Aufgabe #4 aus R00205** (Breitendaten) und #3 (acht Einträge, sechs Zustände) für die erneute Prüfung der Liste.

### Einstieg und Adresse

- [ ] **AK 1 Einstieg aus der Liste, B1 erneut geprüft:** Gegeben #1 mit geöffneter Ansicht „Commits“, dann steht im Kopf „Alle Änderungen ansehen“, Kurz-Hash und Zeile von K3, W1, V1 und R1 sind `a[href]` auf `…/review?commit=<voller verweis>`, V2 hat keinen Verweis; ein Linksklick auf die Zeile V1 zeigt die Review-Seite mit „3 von 4“, und **ein** Browser-Zurück zeigt wieder das Aufgabenfenster mit „Commits“, auch nach zweimal „Vor“ (`history.length` wächst beim Blättern nicht). „Alle Änderungen ansehen“ zeigt K3 mit „1 von 4“, und die Adresse nennt danach den vollen Verweis von K3 (`?commit=` URL-kodiert, `replaceState`). Bei 320 und 414 px (grober Zeiger) ist jede Zeile ein Ziel von mindestens 48 px Höhe. Alle übrigen Kriterien von R00205 (AK 1, AK 3–10 und AK 2 ohne den Punkt „kein Knopf, kein `a[href]`“) sind mit Knopf und Verweisen weiter grün.
- [ ] **AK 2 Adresse:** Gegeben die Adresse `#/aufgaben/aufgabe/1/review?commit=<die ersten 7 Zeichen von V1>` (Kurz-Präfix ohne Kürzel) aus einem Lesezeichen, dann zeigt die Seite V1 mit „3 von 4“ (Rand a: gezählt über den vollen Hash der Antwort), das Aufgabenfenster ist zu, und „← #1“ ersetzt die Adresse durch die des Fensters mit „Commits“, ohne einen Verlaufseintrag anzulegen. Dieselbe Seite steht unter der Board-Form `#/board/<slug>/aufgabe/1/review?commit=…`. `?commit=` mit 6 oder 65 Hex-Zeichen oder mit `<script>` ergibt „Verweis ungültig …“ ohne den Text der Adresse und ohne eine Anfrage an `…/diff`.

### Blättern und Ränder

- [ ] **AK 3 Blättern und Ränder (a)–(d):** Gegeben #1, dann gibt es bei „1 von 4“ (K3) kein „Zurück“ und bei „4 von 4“ (R1) kein „Vor“ — weder sichtbar noch deaktiviert noch versteckt im Dokument —, kein Umlauf, und jeder Schritt ersetzt den Verlaufseintrag. (b) Liefert `…/commits` die Folge ohne W1 (per `page.route`), zeigt `?commit=kd:<W1>` den Diff ohne „i von n“, ohne „Zurück“ und „Vor“, mit „Zum ersten Commit“ und dem Satz „kd:<kurz> gehört nicht zu den Commits dieser Aufgabe mit Diff …“; „Zum ersten Commit“ zeigt K3 mit „1 von 3“. (c) Gegeben #6, dann bleibt „Alle Änderungen ansehen“ auf `…/review` ohne `?commit=`, die Seite sagt „Keine Änderungen zu zeigen …“, nennt `kd:<V2>` „nicht mehr im Repository“ und `xy:<K1>` „Anwendung unbekannt“ mit Hinweis, und „Zurück zur Liste der Commits“ führt ins Fenster.

### Inhalt

- [ ] **AK 4 Diff und Merkmale:** Gegeben #7, dann nennt die Dateiliste jede Datei mit Statuswort, Pfad und `+`/`−`; die Textdatei zeigt die Zeilennummern alt und neu nach ihren Hunk-Köpfen, die U+2028-Zeile ist **eine** Zeile, `\ No newline at end of file` steht ohne Nummer; Umbenennung, Dateimodus, nicht UTF-8, Binärdatei und die gelöschte Datei (zugeklappt) stehen mit den Sätzen aus FA 5; die Datei mit 3.001 Zeilen zeigt „Der Patch ist groß (3.001 Zeilen) und wird erst auf Wunsch geladen.“ mit „Änderungen anzeigen“; die Datei mit dem Pfad über 4.096 Byte zeigt „Zu groß zum Anzeigen. Es stehen nur die Zahlen: …“ mit den Zahlen der Antwort und hat keinen Knopf; die Zeile aus 200.000 Zeichen steht ganz (`textContent`-Länge gleich), nicht umgebrochen. Kein Text der Seite enthält „KB“ oder „MB“. Ein Klick in der Dateiliste auf eine zugeklappte Datei klappt sie auf und bringt ihren Kopf ins Bild. Mit `dateien_gekappt` (per `page.route`, `gezeigt` 2.000, `gesamt` 2.431) steht „2.000 von 2.431 Dateien gezeigt. …“. **Budget** an #8: vier Dateien offen, die fünfte zu mit „anzeigen“; ihr Aufklappen fragt den Server nicht; jede offene Datei steht in Blöcken zu höchstens 500 Zeilen mit `content-visibility: auto`. **Mutationsprobe:** `<` statt `≤` am Budget macht die Probe rot.

### Laden, Nachladen, Fehler

- [ ] **AK 5 Nachladen in Reihe und „wartet“** (Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten): Gegeben #9, die Antwort auf die erste `datei=` ist gehalten, wenn `sh` nacheinander bei zwei Dateien „Nachladen“ wählt, dann zeigt die erste „Lädt die Änderungen …“, die zweite die Sanduhr und „Wartet, bis die andere Datei geladen ist …“ **ohne** „Nachladen“ und „Änderungen anzeigen“, und es läuft genau **eine** `datei=`-Anfrage; nach Freigabe der ersten startet die zweite von selbst (genau eine weitere Anfrage) und zeigt „Lädt die Änderungen …“. Dasselbe, wenn die erste mit 503 endet: die erste zeigt ihren Fehler mit „Erneut versuchen“, die zweite startet. Die `gross`-Datei lädt mit „Änderungen anzeigen“; kommt sie mit `zu_gross_zum_anzeigen` zurück, steht „Zu groß zum Anzeigen …“ ohne Knopf. **Mutationsproben:** ohne die Reihe (zwei Anfragen zugleich) rot; wartende startet nach einem Fehler nicht rot.
- [ ] **AK 6 Fehler und Laden der Seite:** Gegeben die Diff-Antwort ist gehalten, dann steht „Liest den Diff von kd:<kurz> …“ mit `role="status"` und `aria-busy`. Gegeben ein 503 mit `fehler` „Antwortbudget überschritten …“, dann steht „Server ausgelastet (Antwortbudget). …“ mit Server-Symbol; gegeben ein 503 mit anderem `fehler`, dann „Zeitgrenze überschritten. Der Diff ließ sich nicht lesen: <fehler> (503).“ mit Uhr; beide mit „Erneut versuchen“, das genau **eine** weitere Anfrage auslöst, und ohne weitere Anfrage von selbst (gezählt, nachdem die Fehlermeldung sichtbar steht, und erneut nach 70 s mit `page.clock`). Dieselben zwei Fehler an einer nachgeladenen Datei stehen an der Datei, die Seite bleibt lesbar. Gegeben `?commit=kd:<V2>`, dann steht „Zu diesem Verweis gibt es keinen Diff: kd:<kurz> ist nicht mehr im Repository.“ mit „Zur Liste der Commits“. Eine Diff-Antwort, deren Kopf nach 14 s kommt, wird gezeigt; eine, deren Kopf nach 15 s noch fehlt, endet als „Zeitgrenze überschritten“ (`page.clock`). **Mutationsprobe:** Fehlerart nach Status statt nach Text → rot.
- [ ] **AK 7 Verzögerte Antworten, Insel, Live** (deterministisch mit `page.route`): (1) Gegeben die Diff-Antwort für K3 ist gehalten, wenn `sh` „Vor“ wählt (W1) und dann K3 freigegeben wird, dann zeigt die Seite W1 mit „2 von 4“ und keine Datei von K3. (2) Gegeben ein Diff steht, eine Datei ist zugeklappt, eine nachgeladen und Text ist ausgewählt, wenn ein Live-Ereignis an #1 kommt (Kommentar über die API, sichtbar angekommen), dann ist der Diffbereich **derselbe Knoten** (Marke am Element bleibt), Klappen, Nachgeladenes, Auswahl und Leseposition bleiben, und es gibt **keine** weitere Anfrage an `…/commits` oder `…/diff`. (3) Zweimal „anzeigen“ nacheinander: siehe AK 5. (4) Zurück in einem Schritt: siehe AK 1. **Mutationsproben:** ohne die Prüfung „Schlüssel noch derselbe“ rot (gezählt wird die Folgewirkung, nicht nur das Endbild); Insel nicht zurückgesetzt rot.

### Darstellung, Sicherheit, Bedienung

- [ ] **AK 8 Fremder Text und sichtbare Zeichen:** Gegeben #7, dann stehen Pfad, Zeile und Titel mit `<img src=x onerror=window.pwn=1> "x"` zeichengleich als Text da, es entsteht kein `img`, `window.pwn` ist nicht gesetzt, und Anführungszeichen brechen kein Attribut. U+202E steht in Pfad (Dateiliste und Kopf) und Zeile als Marke `⟨U+202E⟩` mit Symbol, `aria-label` mit „sichtbar gemachtes Bidi-Steuerzeichen U+202E“; ESC steht als `␛ U+001B`, das `\r` am Zeilenende als `␍`, ein Tab bleibt Tab. **Mutationsproben:** Bidi- und Steuerzeichen entfernt statt sichtbar → rot; `esc` am Pfad entfernt → rot.
- [ ] **AK 9 Breite, Ziele, Knöpfe, Themen:** Gegeben #7 und #1, dann gilt bei 320, 414, **641, 768, 980** und 1280 px, hell und dunkel, mit offenen Dateien und der Zeile aus 200.000 Zeichen `documentElement.scrollWidth ≤ documentElement.clientWidth`, nur der Code-Bereich je Datei scrollt quer, und Dateiliste, Leiste und Commit-Kopf haben keine rechte Kante über `clientWidth`. Bis 640 px stehen „‹“ und „›“ mit den Namen „Voriger Commit, 2 von 4“ und „Nächster Commit, 4 von 4“ (an V1), ihr Symbol hat mindestens 3:1; bei grobem Zeiger ist jedes Ziel mindestens 48 × 48 px. Jeder Knopf der Seite und der Liste trägt `.btn`, und seine berechnete Randfarbe ist gleich der eines `.btn` außerhalb von D0009. Kontrast an Daten mit allen Zuständen — Laden, „wartet“, „Lädt die Änderungen …“, beide 503 an Seite und Datei, Band „verwaist“, Marken, `dateien_gekappt`, Rand (b) und (c) —: kein Text unter 4,5:1, kein Symbol und kein Rand der Marken unter 3:1; die Tokens `--tk-*` erreichen auf Normal, Hinzugefügt und Entfernt mindestens 5,45 (hell) und 6,03 (dunkel). **Mutationsproben:** eine Mindestbreite an der Dateiliste, die erst bei 641–980 px quer drückt, ist rot; ein Rand in `--kd-muted` statt `.btn` ist rot.
- [ ] **AK 10 Tastatur und Bedienhilfe:** Gegeben nur die Tastatur, dann erreicht Tab in dieser Reihenfolge Rückweg, „Zurück“, „Vor“, „Alle einklappen“, die Einträge der Dateiliste und je Datei Kopf und Code-Bereich (`tabindex="0"`); Enter und Leertaste klappen eine Datei (`aria-expanded` wechselt, Fokus bleibt); jeder Fokus ist sichtbar (Fokusring); hinzugefügte und entfernte Zeilen tragen neben der Tönung `+`/`−` und Lesetext; Zeilennummern und Zeichen sind `aria-hidden`. Nach dem Blättern steht der Fokus auf dem Blätterknopf oder, fehlt er am Rand, auf dem anderen, nie auf `body`. Die Zeitgrenze an einer Datei meldet sich mit `role="alert"`, das Antwortbudget mit `role="status"`.

## Betroffene Verzeichnisstruktur

- `web/adresse.js` — eigene Lese- und Bildefunktion der Review-Adresse (`sicht: 'review'`, `review: {nummer, commit}`, `nummer` null)
- neu `web/diff.js` (rein, Node-testbar wie `web/commits.js`): Hunks und Zeilennummern, Sichtbarmachen, Dateizustand, Aufklapp-Plan mit Budget und Blöcken, Fehlerart, Folge „i von n“ mit den Rändern
- `web/app.js` — Sicht `review` in `render()`, Insel `data-insel`, Laden mit eigener Frist, Verlauf (`pushState` mit Marke, `replaceState`)
- `web/ansicht.js` und `web/commits.js` — Knopf und Verweise der Liste (B1)
- `web/kd-tokens.css` (Tokens `--tk-*`), `web/kd-app.css` (Seite, Marken, Band; Knöpfe nur `.btn`)
- Tests: neu `e2e/einheit/diff.test.js`, `e2e/tests/r00207-review-seite.spec.js`; erweitert `e2e/einheit/adresse.test.js`, `e2e/tests/r00205-ansicht-commits.spec.js` (Punkt „kein Knopf, kein Verweis“ umgekehrt), `ziele.spec.js`, `kontrast.spec.js`, `ziele-hilfen.js`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Interaction I0197, Bubbles B1017–B1024 in `Dokumentation/Planung/kanbanD.md`:

1. **Adresse und Folge (rein):** Hash → Review-Adresse oder „ungültig“; Liste + voller Hash → `{i, n, zurueck, vor}` oder Rand (b)/(c).
2. **Diff rechnen (rein):** Patch → Zeilen mit Nummern, sichtbare Marken; Datei → Zustand; Antwort → Aufklapp-Plan (Budget 10.000, Blöcke 500); Status + Text → Fehlerart.
3. **Seite zeichnen:** Kopf, Leiste, Commit-Kopf, Band, Dateiliste, Dateien, Merkmale, Seitenränder; alles über `esc`.
4. **Laden, Insel, Blättern:** zwei Anfragen, nur neueste Antwort, eigene Frist, Insel über `render()`, `replaceState` je Schritt.
5. **Nachladen in Reihe:** eine `datei=` zur Zeit, „wartet“, Start nach Ende auch bei Fehler, Zuordnung, Fehler an der Datei.
6. **Einstieg und Rückweg:** Knopf und Verweise in B1, Marke im Verlauf, Rückweg.
7. **Messen:** Breiten (sechs), Ziele, Kontrast in allen Zuständen, Tastatur.
8. **Probe im echten Programm, Gate, abschließen.**

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, `#diff-fenster` (Seite), `#diff-raender` Bilder 1–10a (Dateiränder, Commit-Ränder, 503 Seite, Kappung, Marken, Blättern, Rand b und c), `#commits-ansicht` Bild 3/3a (Knopf und Verweise der Liste). **Abweichungen, bewusst:** Zustand „wartet“ nicht gezeichnet, Wortlaut aus FA 7 (PO Z. 417); Knopfrand `.btn` statt `--kd-muted` (PO Z. 418); Syntaxfarben der Zeichnung erst in B4; „Verweis ungültig“ nicht gezeichnet, Wortlaut aus FA 2 (offene Frage 1).
- **Breitenprobe:** `breiteMessen` (`e2e/tests/ziele-hilfen.js`) misst gegen `clientWidth`; nur der Code-Bereich je Datei gehört in `QUER_ERLAUBT`.
- **Verwurf-Probe** (Lehre #212): sie zählt die Folgewirkung (Zahl der Anfragen, Datei des richtigen Commits), nicht nur das Endbild.
- **Daten für die Proben:** echte Commits im Wegwerf-Repository (wie R00204/R00206); Zustände, die echtes Git nicht billig herstellt (503, `dateien_gekappt`, Rand b), per `page.route`.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node, `e2e/einheit`):** Adresse (%-Kodierung, 6/7/64/65 Hex, Kürzel, ohne `commit`, Board- und Aufgabenform, `<script>`); Patch (`\r\n`, U+2028, `\ No newline`, `@@ -0,0 +1 @@`, Bidi in Pfad und Zeile, ESC, Tab); Budget 10.000/10.002 und Blöcke 500/501; Fehlerart (503 „Antwortbudget …“, 503 sonst, 404, 400); Folge (n = 0, 1, 4; Kurz-Präfix; Hash nicht in der Folge); Zuordnung bei zwei Dateien gleichen Namens.
- **E2E:** AK 1–10 gegen das gestartete Programm (Playwright, headless), Antworten per `page.route` gehalten und über ein Promise freigegeben, Fristen mit `page.clock`, keine Schlafzeiten; Verneinungen erst nach einem sichtbaren Signal.
- **Mutationsproben je Grenze** (jede macht einen benannten Test rot): Budget `<` statt `≤`; Blöcke ohne `content-visibility`; Reihe der `datei=` aufgehoben; wartende startet nach Fehler nicht; Knopf an `zu_gross_zum_anzeigen`; Formprüfung 6 statt 7 bzw. 65 statt 64 Hex; „i“ aus dem Adresstext statt aus dem vollen Hash; `pushState` statt `replaceState` beim Blättern; ohne „Schlüssel noch derselbe“; Insel nicht zurückgesetzt; automatische Wiederholung; Fehlerart nach Status; Bidi entfernt statt sichtbar; `esc` am Pfad entfernt; Mindestbreite der Dateiliste bei 641–980 px; Knopfrand `--kd-muted`.

## Abhängigkeiten

- Abhängig von: [R00206](R00206-diff-eines-commits-per-api-lesen.md) (I0196, Karte #213, `braucht:213`, liegt auf `karte/213` in den Reviews; Grenzen nach ADR-0032 N5: einzeln 8 MB, Antwortbudget 64 MB mit 503 „Antwortbudget …“, Pfad über 4.096 Byte → `gross` mit `zu_gross_zum_anzeigen`); [R00205](R00205-ansicht-commits-im-aufgabenfenster.md) (I0195, Karte #212, erledigt); ADR-0033; Artboard D0009 (freigegeben mit Änderung).
- Blockiert: B3 Alle Änderungen (#215, ändert nur, was `…/review` zeigt), B4 Syntax-Hervorhebung (#216, zeichnet in die Blöcke dieser Seite).

## Offene Fragen

1. **Wortlaut „Verweis ungültig“** (ADR-0033 Punkt 1, nicht gezeichnet) — an den product-owner. Empfehlung und bis zur Antwort geplant: „Verweis ungültig. Die Adresse nennt keinen Commit in gültiger Form.“ mit „Zur Liste der Commits“, in der Form des 404-Randes (Bild 4), ohne den Text der Adresse.
2. **Tokens `--tk-*` schon in B2** (PO Z. 401) — an den product-owner. B2 verwendet sie nicht; geprüft werden können sie nur rechnerisch, nicht an der Seite. Empfehlung: in B4 (#216) mit der ersten Verwendung einführen; bis zur Antwort geplant wie entschieden (FA 13, rechnerische Probe in AK 9).
3. **Lesart des Zeichenbudgets** (ADR-0033 Punkt 5 „bis 10.000 Diff-Zeilen gezeichnet sind“) — an den architekt. Geplant: gezählt werden alle gezeichneten Zeilen ab `@@` (Kontext, Hunk-Köpfe, Hinweiszeilen), eine Datei öffnet nur, wenn sie ganz passt, und nach der ersten, die nicht passt, öffnet keine weitere (FA 6, Rechenbeispiel #8).

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine. Den Kartentitel „Review-Ansicht: Diff eines Commits“ setzt der Betreiber (PO Z. 413).

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00205 sieht der Mensch im Aufgabenfenster, welche Commits an einer Aufgabe hängen, aber nicht, was sie ändern; dafür braucht er heute Git auf einem Rechner mit dem Arbeits-Repository. Die Review-Seite holt den Diff jedes Commits über R00206 ins Board: ein Klick auf eine Zeile der Liste öffnet ihn, „Vor“ und „Zurück“ führen durch alle Commits der Aufgabe, und der Link lässt sich teilen. Weil große Dateien nur auf Wunsch und einzeln laden, Fehler mit Grund dastehen und nichts still gekürzt wird, kann der Mensch auch einen großen Commit vollständig prüfen, ohne den Server zu überlasten. Weil Bidi- und Steuerzeichen sichtbar statt entfernt werden, fällt ein versteckter Eingriff („Trojan Source“) gerade im Review auf.

## Notizen

- **Wegen Schlank arbeiten A** zehn Kriterien; Grenzfälle der reinen Rechnung (Kodierung, Hex-Längen, Blockgrenzen, Zuordnung) gehören in die Unit-Tests des entwicklers.
- **Verworfen:** Commit-Auswahl als Dropdown (PO Z. 416); Umschalter „Alle Änderungen | Ein Commit“ in B2 (ADR-0033 Punkt 9); deaktivierte Blätterknöpfe (PO Z. 411, Rand d); automatische Wiederholung (ADR-0033 Punkt 7); Grenzen in Byte im Text (PO Z. 412); eigener dunklerer Knopfrand (PO Z. 418).
- **Optionen** zur Lage der Seite (eigene Seite, Insel, ganz über `render()`) und zum Zeichnen (alles, gestaffelt, virtuell) sind in ADR-0033 abgewogen; diese Anforderung übernimmt S1 und Z2.
