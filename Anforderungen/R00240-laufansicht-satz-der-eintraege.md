---
id: R00240
status: Erledigt
datum: 2026-11-22
---

# R00240: Laufansicht — Einträge lesbar gesetzt: Aufruf abgesetzt, Ergebnis gekürzt, Marken

## Beschreibung

Karte #261, Scheibe C1 „Satz“ (PO Z. 592). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N4 Punkte 2 (ohne Pfad-Links), 3, 4, 7, 8 und 9, mit dem Nachtrag aus Lauf 261-architekt-2 (Systemhinweis nur als vollständiger Block am Zeilenanfang, Kürzung auch für Shell- und Wert-Block). Produkt `AI-Team/po-entscheidungen.md` Z. 591–613 (Z. 608–613 nach der UX-Vorprüfung). Zeichnung D0009 `#laufansicht` Bild 12 mit den Notizen „Satz (#261, C1)“ bis „Beispieldaten #261/#264“ (freigegeben Z. 602).

Wer in der Laufansicht einen Schritt aufklappt, sieht den **Aufruf als eigenen, abgesetzten Block** und das **Ergebnis darunter**. Ein Bash-Befehl steht als Shell-Block mit Umbruch an `&&`, `||` und `;`. Andere Aufrufe stehen als „Schlüssel: Wert“, Edit und Write als Diff, verschachtelte Werte als formatiertes JSON. Lange Blöcke zeigen 20 Zeilen und dahinter „weitere <n> Zeilen“. Die Schlusszeile eines Testlaufs steht hervorgehoben über dem Ergebnis. Eine von Claude Code gekürzte Ausgabe trägt eine Marke, die das sagt. Systemhinweise mitten in Ergebnis und Nachricht sind eingeklappt. Das „…“ von kanbanD ist als Kürzung erkennbar. „Längste Schritte“ und „Teuerste Schritte“ nennen die Absicht des Schritts. Lesen, Auswertung, Format, Server und OpenAPI bleiben unverändert.

Nicht Teil dieser Anforderung sind Pfade als Links und die Pfad-Marken ‹kanbanD›, ‹Worktree #n› und ‹Ablage› (N4 Punkte 5 und 6). Sie kommen mit C2, Karte #264. In C1 stehen alle Pfade als Text.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): R00234 und R00239 zeigen, wo ein Lauf Zeit und Fehler hatte. Diese Anforderung macht lesbar, was in einem Schritt geschah.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Betreiber fand die Laufansicht „noch schwer lesbar“ (Karte #261). Heute steht ein Aufruf als roher JSON-Text in einer Zeile. 39 % der Ergebnisse haben mehr als 20 Zeilen und schieben die folgenden Schritte aus dem Bild. 4,4 % sind von Claude Code gekürzt, ohne dass man das sieht (Zählung über 89 Transkripte, N4 „Belegt“). Wer eine Karte abnimmt, will in Sekunden sehen, was der Agent aufgerufen hat, ob die Tests bestanden haben und was er tatsächlich zu sehen bekam.

## Funktionale Anforderungen

1. **Aufruf abgesetzt** (N4 Punkt 2, PO Z. 601, 602): Ein aufgeklappter Schritt zeigt den Aufruf als eigenen Block mit Fläche, Rand, Kante links und dem Wort „Aufruf“. Darunter steht ohne Fläche „Ergebnis“, beides in derselben Zeile der Liste. Hat der Schritt kein Ergebnis im Transkript, steht unter dem Aufruf gedämpft „Kein Ergebnis im Transkript.“. Ist das Ergebnis da, aber leer oder nur Leerraum, steht unter „Ergebnis“ gedämpft „Leeres Ergebnis.“ (PO Z. 612).
2. **Shell-Block** (N4 Punkt 2): Bei Bash steht `command` als Block in Festbreite nach `shellUmbruch`: Ein `\n` kommt **nach** `&&`, `||` und `;` auf oberster Ebene. Er kommt nie innerhalb von `'…'`, `"…"`, `$(…)` oder Backticks, nie nach `\`, nie bei `;;`, nie hinter einem `#`, das ein Wort beginnt, und nie hinter dem ersten `<<`. Sonst ändert sich kein Zeichen. `description` steht nicht im Block. Weitere Felder stehen darunter als „Schlüssel: Wert“.
3. **„Schlüssel: Wert“ und JSON** (N4 Punkt 2): Ein Aufruf mit flachem JSON-Objekt zeigt seine Felder als „Schlüssel: Wert“ in der Reihenfolge des Objekts. Ein Wert mit Zeilenumbruch steht als Block unter seinem Schlüssel. Ist der Text kein Objekt oder trägt er einen verschachtelten Wert, steht er als formatiertes JSON mit zwei Leerzeichen Einzug. Ein JSON-Objekt als Ergebnis steht ebenso. Gefärbt wird mit den Rollen aus ADR-0037 über die Tokens des Stils (Schlüssel `--kd-tk-function`, Text `--kd-tk-string`, Zahl `--kd-tk-number`, `true`/`false`/`null` `--kd-tk-keyword`). Die Klassen `.tk-*` gelten in `web/kd-app.css` heute nur unter `.dz .c`; die Insel bekommt eigene Regeln auf dieselben Tokens. Kein JSON ergibt den Text wie heute.
4. **Diff** (N4 Punkt 2, PO Z. 597): Edit zeigt `old_string` als entfernte und `new_string` als hinzugefügte Zeilen. Gleiche Zeilen am Anfang und am Ende stehen als Kontext. Write zeigt `content` ganz als hinzugefügt. Die Zeichen `−` und `+` und die Flächen sind wie auf der Review-Seite (`--kd-status-ok-bg`/`--kd-status-error-bg`, Zeichen in `--kd-status-ok-ink`/`--kd-status-error-ink`), ohne Syntaxfarben und ohne Zeilennummern. `replace_all` steht nur bei `true` als Feld unter dem Diff.
5. **Kürzung** (N4 Punkt 3 mit Nachtrag, PO Z. 595, 597, 606): Ergebnis, Diff, Shell-Block und Wert-Block zeigen die ersten 20 Zeilen des Textes offen. Gezählt werden Zeilen des Textes nach `shellUmbruch`, keine umbrochenen Bildschirmzeilen. Der Rest steht in einem eingebetteten `details`, dessen Knopf „weitere <n> Zeilen“ heißt, in der Einzahl „1 weitere Zeile“, `n` mit Tausenderpunkt. Aufgeklappt bleibt der Knopf stehen. Der Knopf ist das `summary` des `details`, ohne eigenes `aria-expanded`. Sein zugänglicher Name beginnt mit dem sichtbaren Text und nennt den Block: „weitere 5 Zeilen des Ergebnisses“, „… des Aufrufs“ (Shell- und Wert-Block), „… der Änderung“ (Diff), in der Einzahl „1 weitere Zeile des Ergebnisses“ usw. Der Rest ist im DOM, und eine Kürzung trägt nie „…“.
6. **Ergebnis in Festbreite** (N4 Punkt 3): Das Ergebnis behält seine Zeilenumbrüche und ist nie Markdown (R00221 FA 10).
7. **Testzeile** (N4 Punkt 3, PO Z. 598 und Z. 619): In den letzten 20 Zeilen eines Ergebnisses werden alle Zeilen der Form `<n> passed`, `<n> failed`, `test result: ok|FAILED. <n> passed; <n> failed`, `# pass <n>` oder `# fail <n>` gesucht. Trägt mindestens eine davon einen Fehlschlag > 0 (`<n> failed`, `<n> failed` in der `test result`-Zeile, `# fail <n>` mit n > 0), ist der Ton der Fehler-Ton (`--kd-status-error-bg`/`-ink`) und die gezeigte Zeile die **letzte** dieser Fehlschlagszeilen, mit ihrem Text unverändert (z. B. „1 failed“). Sonst ist der Ton der Erfolg-Ton (`--kd-status-ok-bg`/`-ink`) und die gezeigte Zeile die letzte Zeile der Form. Die gezeigte Zeile steht zusätzlich über dem Ergebnis hervorgehoben, mit Kante und Symbol. Es wird nie eine Zeile aus mehreren zusammengesetzt. Sie trägt immer ihren Text. Davor steht unsichtbar (Klasse `vh`) „Tests fehlgeschlagen: “ im Fehler-Ton bzw. „Tests bestanden: “ im Erfolg-Ton; das Symbol ist `aria-hidden` (PO Z. 613). Der Lesetext folgt dem Ton: „Tests fehlgeschlagen: 1 failed“ bzw. „Tests bestanden: 2 passed (1.1s)“. An ihrer Stelle im Ergebnis bleibt sie unverändert, ebenso alle übrigen Zeilen.
8. **Von Claude Code gekürzt** (N4 Punkt 3, PO Z. 594, 604): Beginnt ein Ergebnis nach Leerraum mit `<persisted-output>` in der Form `Output too large (<Größe>). Full output saved to: <Pfad>`, Leerzeile, `Preview (…):`, Vorschau, `</persisted-output>`, dann steht über der Vorschau die Marke „Von Claude Code gekürzt (<Größe>): Der Agent sah nur diese Vorschau. Vollständig: <Pfad>“. Die Größe steht deutsch („69.9KB“ → „69,9 KB“), der Pfad als Text. Die Vorschau ist gesetzt wie ein Ergebnis. Passt das Innere nicht zur Form, lautet die Marke „Von Claude Code gekürzt: Der Agent sah nur diese Vorschau.“, und darunter steht der Text wie heute. In der Zusammenfassung steht statt `<persisted-output>` „Von Claude Code gekürzt“ mit Symbol, ohne Größe. Das Symbol ist `aria-hidden`; Marke und Kurzform tragen ihre Aussage als Text.
9. **Fehler in gekürzter Ausgabe** (N4 Punkt 3): Bei einem erkannten `<persisted-output>` prüft die Fehlererkennung (R00234 FA 8) die erste Zeile der Vorschau statt der des Texts.
10. **Eingebettete Systemhinweise** (N4 Nachtrag Punkt 1, PO Z. 600, 603, 605): In Ergebnis und Nachricht wird jeder vollständige Block, der am Zeilenanfang mit `<system-reminder>` beginnt und mit `</system-reminder>` schließt, an seiner Stelle als eingeklapptes „Systemhinweis“ gesetzt. Ein Tag mitten in einer Zeile und ein Block ohne Ende bleiben Text. Der Filter „Systemhinweise“ (R00239 FA 5) blendet diese Hinweise mit aus. Ist „nur Fehler“ an, folgen die eingebetteten Hinweise einer sichtbaren Fehlerzeile dem behaltenen Stand von „Systemhinweise“: angehakt sichtbar, sonst nicht (PO Z. 609). Besteht ein Ergebnis nur aus solchen Blöcken, steht in der Zusammenfassung gedämpft „Systemhinweis“. Sind sie dann ausgeblendet, steht unter „Ergebnis“ gedämpft „Nur Systemhinweis, ausgeblendet (Filter „Systemhinweise“).“ (PO Z. 611).

    **Ansage** (PO Z. 608, präzisiert R00239 FA 6 / Z. 587): Nach einem Wechsel von „Systemhinweise“ folgt im selben Satz von `#lv-status` die Zahl `e` der eingebetteten Hinweise in den sichtbaren Zeilen: „<s> von <g> Einträgen sichtbar, <e> eingebettete Systemhinweise sichtbar.“ bzw. „… ausgeblendet.“, bei e = 1 „1 eingebetteter Systemhinweis sichtbar.“ bzw. „… ausgeblendet.“, `e` mit Tausenderpunkt. Nur bei e > 0 und s > 0; sonst bleibt der Satz aus R00239 unverändert. `e` kommt aus der Auswertung, nicht aus dem DOM. Weiter genau eine Ansage je Wechsel.
11. **Das „…“ von kanbanD** (PO Z. 601): Kürzt kanbanD eine Zusammenfassung oder einen Eintrag der Listen auf 200 Zeichen, steht das „…“ in einem eigenen gedämpften Element (`--kd-muted`, nicht `--kd-faint`) mit Tooltip und Lesetext „Von kanbanD gekürzt, vollständig im aufgeklappten Schritt“ (PO Z. 610). Der Lesetext steht unsichtbar im `textContent` des Elements, nicht `aria-hidden`. Ein „…“ im Text selbst bleibt Text.
12. **Absicht in den Listen** (N4 Punkt 4, PO Z. 599): „Längste Schritte“ und „Teuerste Schritte“ beschriften einen Schritt mit seiner Absicht (`description`, bis zwei Zeilen). Darunter steht der Befehl einzeilig, gekürzt und gedämpft. Auch „nach <Schritt>“ nennt die Absicht, wenn es eine gibt. Ohne Absicht steht der Befehl allein wie heute.
13. **Grenzen je Eintrag** (N4 Punkt 7): „Schlüssel: Wert“, JSON-Satz und Diff gibt es nur, wenn der Text des Aufrufs höchstens 64 KiB und höchstens 2.000 Zeilen hat. `shellUmbruch` gibt es nur bei `command` bis 16 KiB. Reicht das Zeichenbudget nicht für den ganzen Aufruf, oder liegt er über den Grenzen, steht er wie heute als `pre`. Auch dieser Rückfall steht im Block „Aufruf“ mit Fläche, Kante und dem Wort „Aufruf“; nur sein Inhalt ist `pre`. Die Grenzen sind Konstanten in `web/lauf-satz.js`.

## Nicht-funktionale Anforderungen

- **Leistung** (N4 Punkte 8, 9): Gesetzt wird einmal je Lesen beim Bau der Insel. Bei Live, Filter und Blättern wird nichts neu gesetzt, und `JSON.parse` läuft je Aufruf höchstens zweimal. Die Zeit von der Antwort bis zum Bild wird für den größten echten Lauf und für eine Datei an der Grenze **vor und nach** #261 gemessen. Das ist eine Beobachtung im Bericht, kein Gate und ein Tag-Kriterium (8–21 Uhr, Last ≤ 2, `nice -n 10`). Ziel bleibt unter 300 ms für den größten echten Lauf (Q5) und etwa 1–1,5 s an der Grenze. Liegt der Anstieg an der Grenze über 50 %, geht die Frage an den architekt.
- **Sicherheit** (N4 „Durchsetzung“): Jedes Zeichen aus Aufruf und Ergebnis geht über `esc` bzw. `sichtbarHtml`, auch Schlüssel, Werte, Diff-Zeilen, Größe und Pfad der Marke. Diese Scheibe erzeugt keinen neuen Link. In `summary` steht kein `<a`.
- **Zugänglichkeit**: Der Aufruf ist auch ohne Farbe erkennbar (Wort „Aufruf“, Kante, Rand; PO Z. 602). Diff-Zeilen werden mit „entfernt:“ bzw. „hinzugefügt:“ vorgelesen. Testzeile und Marke tragen Text, nie nur Farbe (Z. 472). Der Knopf „weitere <n> Zeilen“ ist mit der Tastatur bedienbar. Ziele messen bei grobem Zeiger ≥ 48 px, bei feinem ≥ 24 px. Text hat ≥ 4,5:1, Fokusring ≥ 2 px.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00234: die gz-Datei erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/1/transkripte` ab). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, Board `fabrik` mit `record-transcripts: true`. Aufgabe #1 trägt T13 = `entwickler@2026-11-21T09:00+01:00` ohne Kosteneintrag (Datum 2026-11-21, weil der Server Zeitpunkte in der Zukunft ablehnt). Alle Inhalte sind erfunden. Die Formen von `<persisted-output>` und `<system-reminder>` sind denen echter Transkripte nachgebildet.

**T13** (Zeit 2026-11-21, Versatz +01:00; Text der Aufrufe als JSON):

| Nr | art · wer | zeit | Inhalt |
|---|---|---|---|
| 1 | nachricht · mensch | 09:00:00 | „Projekt: /w/demo · Karte: #9“ (Auftrag) |
| 2 | aufruf · agent `Bash` | 09:00:01 | `{"command":"cd /w/demo && npm test; echo \"a && b\" \| grep 'x;y' # Ende; z","description":"Tests fahren","timeout":120000}` |
| 3 | ergebnis · werkzeug | 09:00:41 | 25 Zeilen: „Zeile 1“ bis „Zeile 23“, „1 failed, 3 passed“, „Ende“ |
| 4 | aufruf · agent `Bash` | 09:00:42 | `{"command":"echo <250 × a> && cat gross.log","description":"Protokoll lesen"}` |
| 5 | ergebnis · werkzeug | 09:01:12 | `<persisted-output>`⏎`Output too large (69.9KB). Full output saved to: /tmp/demo/tool-results/b1.txt`⏎⏎`Preview (first 2KB):`⏎`Exit code 1`⏎`fehlt: gross.log`⏎`...`⏎`</persisted-output>` |
| 6 | aufruf · agent `Edit` | 09:01:13 | `{"file_path":"/w/demo/a.js","old_string":"x\nalt\ny","new_string":"x\nneu\ny"}` |
| 7 | ergebnis · werkzeug | 09:01:14 | „Datei geändert.“⏎`<system-reminder>`⏎„Nicht vergessen.“⏎`</system-reminder>`⏎„weiter“ |
| 8 | aufruf · agent `Write` | 09:01:15 | `{"file_path":"/w/demo/b.txt","content":"b1\nb2\n…\nb25"}` (25 Zeilen) |
| 9 | ergebnis · werkzeug | 09:01:35 | „Datei geschrieben.“ |
| 10 | aufruf · agent `Read` | 09:01:36 | `{"file_path":"/w/demo/a.md","offset":10,"limit":2}` |
| 11 | ergebnis · werkzeug | 09:01:37 | `<system-reminder>`⏎„Nur Hinweis.“⏎`</system-reminder>` |
| 12 | nachricht · mensch | 09:01:38 | „Bitte weiter.“⏎`<system-reminder>`⏎„Todo-Liste leer.“⏎`</system-reminder>` |
| 13 | aufruf · agent `mcp__demo__abfrage` | 09:01:39 | `{"query":"stand"}` |
| 14 | ergebnis · werkzeug | 09:01:40 | `{"ok":true,"n":3,"liste":[1,null],"text":"a"}` |
| 15 | aufruf · agent `Bash` | 09:01:41 | `{"command":"cat <<EOF > c.txt\nl1\n…\nl19\nEOF","description":"Datei anlegen"}` (21 Zeilen) |
| 16 | ergebnis · werkzeug | 09:01:42 | „ok“ |
| 17 | nachricht · agent | 09:01:43 | „Ergebnis: bestanden“ |

**Rechenbeispiele** (geprobt gegen ein Modell der Regeln, `gemeinsam/scratchpad/plan-261/modell.js` der Factory):

- `shellUmbruch` Nr 2 ergibt drei Zeilen: `cd /w/demo &&` · ` npm test;` · ` echo "a && b" | grep 'x;y' # Ende; z`. Ohne die eingefügten `\n` ist es wieder der Befehl.
- Nr 4 ergibt zwei Zeilen: `echo <250 × a> &&` · ` cat gross.log`. Die Zusammenfassung zeigt `echo ` und 195 × `a`, also 200 Zeichen, dann das „…“ von kanbanD.
- Nr 15 bleibt unverändert, denn ab `<<` wird nicht umbrochen. Von 21 Zeilen sind 20 offen (bis „l19“), dann folgt „1 weitere Zeile“.
- Nr 3: 25 Zeilen ergeben 20 offen (bis „Zeile 20“) und „weitere 5 Zeilen“. Die Testzeile „1 failed, 3 passed“ hat 1 Fehlschlag und steht deshalb im Fehler-Ton. Die erste Zeile „Zeile 1“ ist kein Fehler.
- Nr 5: Die Marke lautet „Von Claude Code gekürzt (69,9 KB): Der Agent sah nur diese Vorschau. Vollständig: /tmp/demo/tool-results/b1.txt“, die Vorschau „Exit code 1 / fehlt: gross.log / ...“. Das ist ein Fehler, also hat der Kopf „Fehler erkannt“ 1.
- Diff Nr 6: Kontext `x` · `− alt` · `+ neu` · Kontext `y`. Diff Nr 8: 25 Zeilen `+`, davon 20 offen, dann „weitere 5 Zeilen“.
- Nr 14 formatiert ergibt 9 Zeilen: `{`, `  "ok": true,`, `  "n": 3,`, `  "liste": [`, `    1,`, `    null`, `  ],`, `  "text": "a"`, `}`. Das sind weniger als 20, also keine Kürzung.
- „Längste Schritte“: Nr 2 dauert 40 s, Nr 4 30 s, Nr 8 20 s. Jede Lücke vor einem Aufruf ist 1 s, darum gibt es keine Denkzeile.

### Aufruf

- [x] **AK 1 Aufruf abgesetzt, Shell-Block:** Gegeben die Laufansicht von T13, wenn `sh` die Zeile von Nr 2 aufklappt, dann steht der Block „Aufruf“ mit eigener Fläche und Kante über „Ergebnis“, beides in derselben Zeile. Darin steht der Shell-Block in Festbreite mit genau den drei Zeilen des Rechenbeispiels. Darunter steht „timeout: 120000“. „Tests fahren“ steht nicht im Block. Der `textContent` des Shell-Blocks ohne `\n` ist gleich `command`. In Node bleiben `echo "a && b"`, `echo 'x;y'`, `$(a; b)`, `a \&& b`, `case x in a) ;; esac`, `echo a # b; c` und `cat <<EOF⏎a; b⏎EOF` unverändert. `a && b; c` ergibt drei Zeilen. Mit emuliertem `forced-colors: active` hat der Block „Aufruf“ hell und dunkel eine Kante links von 3 px und oben einen Rand von 1 px, sein erstes Kind trägt den Text „Aufruf“, und „Ergebnis“ hat keine Kante. In Node ergibt ein Aufruf ohne Ergebnis unter dem Aufruf gedämpft „Kein Ergebnis im Transkript.“, ein Ergebnis `""` und eines aus `" \n "` je „Leeres Ergebnis.“.
- [x] **AK 2 Kürzung „weitere n Zeilen“:** Gegeben T13 mit der Marke `el.__probe = 1` an der Insel. Dann zeigt Nr 15 aufgeklappt 20 Zeilen bis „l19“ und den Knopf „1 weitere Zeile“. Das Ergebnis Nr 3 in der Zeile von Nr 2 zeigt 20 Zeilen bis „Zeile 20“ und „weitere 5 Zeilen“, Nr 8 20 Diff-Zeilen bis „+ b20“ und „weitere 5 Zeilen“. Wenn `sh` dort bei Nr 3 „weitere 5 Zeilen“ wählt, dann stehen „Zeile 21“ bis „Ende“ da, der Knopf bleibt stehen, und die Insel trägt die Marke noch. Schon vor dem Aufklappen enthält der `textContent` der Insel „Zeile 23“. In keinem der drei Blöcke steht „…“. Der zugängliche Name des Knopfs bei Nr 3 ist „weitere 5 Zeilen des Ergebnisses“, bei Nr 8 „weitere 5 Zeilen der Änderung“, bei Nr 15 „1 weitere Zeile des Aufrufs“. Fokussiert `sh` ihn per Tab, klappen Enter und danach Leertaste auf und zu; `document.activeElement` bleibt das `summary`, `ariaSnapshot()` zeigt `expanded` bzw. `collapsed`, `#lv-status` ändert sich nicht, und `scrollY` ändert sich um höchstens 1 px. In Node gilt: 1.358 Zeilen ergeben „weitere 1.338 Zeilen“, 20 Zeilen ergeben keinen Knopf, und ein Einzeiler mit 500 Zeichen ergibt keinen Knopf.
- [x] **AK 3 „Schlüssel: Wert“ und JSON:** Gegeben T13, dann zeigt Nr 10 aufgeklappt drei Zeilen „file_path: /w/demo/a.md“, „offset: 10“ und „limit: 2“, ohne Link. Nr 13 zeigt „query: stand“. Das Ergebnis von Nr 14 steht als die 9 Zeilen des Rechenbeispiels. „"ok"“ trägt die Rolle für Schlüssel, `true` und `null` die für Schlüsselwörter, `3` die für Zahlen und `"a"` die für Text. In Node steht ein Aufruf `{"q":{"a":1}}` als formatiertes JSON, und ein Aufruf „kein json“ steht wie heute als Text. Farben, hell und dunkel: `getComputedStyle` von „"ok"“ ist gleich dem aufgelösten `--kd-tk-function`, von `true` gleich `--kd-tk-keyword`; die Fläche der Testzeile von Nr 2 gleich `--kd-status-error-bg`, die von „+ neu“ in Nr 6 gleich `--kd-status-ok-bg` und die von „− alt“ gleich `--kd-status-error-bg`. Keine Regel der Insel nennt `--kd-wbs-` oder `var(--tk-`.
- [x] **AK 4 Edit und Write als Diff:** Gegeben T13, dann zeigt Nr 6 aufgeklappt den Diff mit Kontext „x“, „− alt“, „+ neu“ und Kontext „y“. Die zweite Zeile liest sich mit „entfernt:“, die dritte mit „hinzugefügt:“. Nr 8 zeigt nur Zeilen mit „+“ (FA 4, Kürzung AK 2). In Node gilt: Ein leeres `old_string` ergibt nur hinzugefügte Zeilen. Gleiche Texte ergeben nur Kontext. `"replace_all":true` steht als „replace_all: true“ unter dem Diff, `false` steht nicht da.

### Ergebnis

- [x] **AK 5 Testzeile:** Gegeben T13, wenn `sh` Nr 2 aufklappt, dann steht über dem Ergebnis die Zeile „1 failed, 3 passed“ im Fehler-Ton, mit Symbol und Kante. Ihr `ariaSnapshot()` enthält „Tests fehlgeschlagen: 1 failed, 3 passed“, das Symbol ist `aria-hidden`. Aufgeklappt steht sie auch an ihrer Stelle als 24. Zeile unverändert. In Node ergibt „2448 passed“ den Erfolg-Ton, „test result: FAILED. 3 passed; 1 failed“ den Fehler-Ton und „# fail 0“ den Erfolg-Ton mit dem Lesetext „Tests bestanden: # fail 0“. Vier Proben zur Wahl der Zeile (PO Z. 619): `'Exit code 1\n\n  1 failed\n    t/a.spec.js:3:1 › b\n  2 passed (1.1s)\n'` ergibt den Fehler-Ton, die Zeile „1 failed“ und den Lesetext „Tests fehlgeschlagen: 1 failed“; `'  2 passed (1.1s)\n'` ergibt den Erfolg-Ton; `'# pass 3\n# fail 1'` ergibt den Fehler-Ton mit „# fail 1“; `'# fail 0\n# pass 3'` ergibt den Erfolg-Ton. „3 passed“ als erste von 21 Zeilen wird nicht gefunden. Ein Ergebnis „# Titel“ steht als Text und nicht als Überschrift.
- [x] **AK 6 Von Claude Code gekürzt:** Gegeben T13, dann steht in der Zusammenfassung der Zeile von Nr 4 (Ergebnis Nr 5) „Von Claude Code gekürzt“ mit Symbol und ohne „69,9 KB“, und nirgends in der Zeile steht `<persisted-output>`. Aufgeklappt steht die Marke wörtlich wie im Rechenbeispiel mit dem Pfad als Text und darunter die Vorschau. Die Zeile steht in der Fehlerform, und der Kopf zeigt „Fehler erkannt“ 1. Das Scheren-Symbol ist `aria-hidden`; „Von Claude Code gekürzt“ steht im `textContent` und im `ariaSnapshot()` der Zusammenfassung. Text von Marke und Kurzform hat hell und dunkel ≥ 4,5:1 gegen seinen tatsächlichen Hintergrund. In Node ergibt „1.2MB“ „1,2 MB“, und ein `<persisted-output>` ohne die Form ergibt „Von Claude Code gekürzt: Der Agent sah nur diese Vorschau.“ ohne Größe und Pfad.
- [x] **AK 7 Eingebettete Systemhinweise:** Gegeben T13 mit „Systemhinweise“ an, dann steht im Ergebnis von Nr 6 zwischen „Datei geändert.“ und „weiter“ ein eingeklapptes „Systemhinweis“, und aufgeklappt zeigt es „Nicht vergessen.“. In Nr 12 steht nach „Bitte weiter.“ ebenso eines mit „Todo-Liste leer.“. Die Zusammenfassung der Zeile von Nr 10 (Ergebnis Nr 11) zeigt gedämpft „Systemhinweis“. Mit „Systemhinweise“ aus (Vorgabe) ist keiner der eingebetteten Hinweise aus Nr 7, Nr 11 und Nr 12 sichtbar. „Datei geändert.“, „weiter“, „Bitte weiter.“ und die Zeile von Nr 10 mit „Systemhinweis“ in der Zusammenfassung bleiben sichtbar (sie ist eine Werkzeugzeile), und die Insel trägt die Marke `el.__probe` noch. Aufgeklappt steht bei Nr 10 unter „Ergebnis“ mit „Systemhinweise“ aus gedämpft „Nur Systemhinweis, ausgeblendet (Filter „Systemhinweise“).“, mit „Systemhinweise“ an der eingeklappte „Systemhinweis“. **„nur Fehler“** an einer zweiten Ausgangslage T13f (Aufgabe #2 wie #1, zwei Einträge: Aufruf `Bash` `{"command":"false","description":"Fehler zeigen"}` und Ergebnis „Exit code 1“⏎`<system-reminder>`⏎„Hinweis F.“⏎`</system-reminder>`): Ist „Systemhinweise“ angehakt und `sh` hakt „nur Fehler“ an, steht der eingebettete Hinweis in der Fehlerzeile; war „Systemhinweise“ aus, steht er dort nicht. In Node bleiben „Text mit `<system-reminder>` mitten`</system-reminder>`“ und ein Block ohne `</system-reminder>` unverändert Text.

### Zusammenfassung und Listen

- [x] **AK 8 „…“ von kanbanD und Absicht in den Listen:** Gegeben T13, dann endet der Befehl in der Zusammenfassung von Nr 4 nach 200 Zeichen mit einem „…“ in eigenem, gedämpftem Element. Dessen Tooltip und Lesetext lauten „Von kanbanD gekürzt, vollständig im aufgeklappten Schritt“. Der Lesetext steht im `textContent` des Elements und im `ariaSnapshot()` der Zeile, und `getComputedStyle(el).color` hat hell und dunkel ≥ 4,5:1 gegen den Grund der Zeile. „Längste Schritte“ zeigt der Reihe nach „Tests fahren“ mit „40 s“, „Protokoll lesen“ mit „30 s“ und „Write /w/demo/b.txt“ mit „20 s“. Unter den ersten beiden steht gedämpft der gekürzte Befehl, unter dem dritten nichts. In Node beschriftet „Teuerste Schritte“ einen Schritt mit Absicht ebenso und nennt in „nach <Schritt>“ die Absicht des Schritts davor.

### Grenzen und Darstellung

- [x] **AK 9 Grenzen und Maskieren:** In Node gilt: Ein Aufruf mit 64 KiB + 1 Byte, einer mit 2.001 Zeilen und einer über dem Zeichenbudget stehen je als `pre` wie heute. Ein `command` mit 16 KiB + 1 Byte steht ohne eingefügten Umbruch. Ein Edit mit `new_string` „<img src=x onerror=alert(1)>“, ein Aufruf mit dem Schlüssel „<b>k</b>“ und ein `<persisted-output>` mit „<i>“ im Pfad ergeben je kein Element `img`, `b` oder `i`. Der Text steht sichtbar so da. Kein Satz enthält ein `<a`. In jedem Rückfall auf `pre` ist das erste Kind des Blocks „Aufruf“ das Wort „Aufruf“.
- [x] **AK 10 Breite, Themen, Zugänglichkeit, Ansage:** Gegeben T13 mit allen Schritten aufgeklappt und „Systemhinweise“ an, dazu ein Aufruf `mcp__demo__abfrage` mit einem Schlüssel aus 60 × `k` und einem Wert aus 300 Zeichen ohne Leerzeichen. Dann gilt bei 320, 641, 980 und 1280 px, hell und dunkel, an Dokument und Bildlaufbehälter und je Block (Klassen der Zeichnung: `.lv-auf`, `.lv-kv`, `.lv-dif`, `.lv-tz`, `.lv-cc`, `.lv-mehr`, `.lv-ein`, `.lv-ell`, dazu `.lv-erg` und jedes `pre`): `scrollWidth ≤ clientWidth`, und `overflow` ist weder `hidden` noch `scroll`. Text in diesen Blöcken hat nach `getComputedStyle(color)` gegen den tatsächlichen Hintergrund (`--kd-sunken` im Aufruf, `--kd-surface` sonst) ≥ 4,5:1. Der Knopf „weitere <n> Zeilen“ misst ≥ 24 px, bei grobem Zeiger ≥ 48 px; der Fokusring jedes `summary`, auch im eingebetteten Systemhinweis, ist ≥ 2 px und ≥ 3:1. Der Aufruf ist im `ariaSnapshot()` mit dem Wort „Aufruf“ vor seinem Inhalt erkennbar. **Ansage:** Hakt `sh` „Systemhinweise“ an, endet die eine Ansage in `#lv-status` auf „, 3 eingebettete Systemhinweise sichtbar.“ (Nr 7, Nr 11, Nr 12); hakt er es ab, auf „, 3 eingebettete Systemhinweise ausgeblendet.“. Der Teil davor ist der Satz aus R00239 FA 6 für denselben Wechsel. In Node ergibt e = 1 „1 eingebetteter Systemhinweis sichtbar.“ und e = 0 den Satz aus R00239 ohne Zusatz.

## Betroffene Verzeichnisstruktur

- `web/lauf-satz.js` (neu, N4 Punkt 1): `aufrufSatz`, `ergebnisSatz`, `shellUmbruch`, `jsonHtml`, `editDiff`, `gekuerztErkennen`, `systemhinweiseTrennen`, `testzeileFinden`, Kürzung und Grenzen. Rein, in Browser und Node wie `web/lauf.js`; `pfadMarken` und `pfadLinkHtml` kommen erst mit C2.
- `web/lauf.js`: `schrittHtml` und `nachrichtTextHtml` rufen den Satz auf. Dazu `fehlerErkennen` (Vorschau), `gekuerzt` (eigenes Element für „…“) und `laengsteListe`/`teuersteListe` (Absicht). Lesen und Auswerten bleiben hier.
- `web/app.js`: keine Änderung (`grep -c "laufAuswerten(" web/app.js` bleibt 1).
- `web/kd-app.css`: `.lv-auf`, Shell- und Wert-Block, Diff, Testzeile, Marke, „weitere <n> Zeilen“, `.tk-*` auch in der Insel. Nur Tokens aus `web/kd-tokens.css` (`--kd-status-*`, `--kd-tk-*`), keine neue Farbe. Die Zeichnung D0009 nennt noch `--kd-wbs-error-*` und `--tk-*`; diese Variablen gibt es im Stil nicht, sie werden nicht übernommen.
- `web/index.html`: `lauf-satz.js` vor `lauf.js` laden.
- Tests: `e2e/einheit/lauf-satz.test.js`, `lauf-zeichnen.test.js` (Node), `e2e/tests/r00240-laufansicht-satz.spec.js` mit Daten `e2e/tests/laufansicht-t13.js` (E2E), Hilfen aus `e2e/tests/laufansicht-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **Proben zuerst** (B1253): T13 und AK 1–10 als rote Spezifikation.
2. **Reine Bausteine** in `web/lauf-satz.js`: Shell-Block und Kürzung (B1254), danach parallel der Aufruf-Satz (B1255) und der Ergebnis-Satz (B1256).
3. **Einbau** in die Schrittzeile mit Zusammenfassung (B1257). Parallel zu 2 geht die Absicht in den Listen (B1258).
4. **Messen** (B1259), dann **Probe im echten Programm, Mutanten, Messung vor und nach, Gate** (B1260).

### Grobentwurf

- `aufrufSatz(name, text, esc) → html | null`: `null` heißt „wie heute als `pre`“ (über den Grenzen, kein Satz möglich). Bash → Shell-Block und übrige Felder. Edit/Write → Diff. Flaches Objekt → „Schlüssel: Wert“. Sonst → `jsonHtml`.
- `ergebnisSatz(text, esc) → {html, kurz, fehlerText}`: `kurz` ist die Kurzform der Zusammenfassung („Von Claude Code gekürzt“, „Systemhinweis“ oder `null`). `fehlerText` ist der Text, an dessen Anfang `fehlerErkennen` prüft.
- `kuerzungHtml(zeilenHtml[], esc) → html`: 20 offen, dann `details` mit dem Knopf aus FA 5. Eine Funktion für alle vier Blockarten.
- `shellUmbruch(command) → text`: ein Durchlauf mit Zustand für Quoting, `$(`-Tiefe, Kommentar und Heredoc.
- `editDiff(alt, neu) → [{art: 'kontext'|'weg'|'neu', zeile}]`: Präfix und Suffix, kein LCS.
- Das Zeichenbudget bleibt: Der Aufruf wird einmal ganz über `zeichenBuchen` gebucht. Bei `rest > 0` gibt es den Satz nicht.

### Hinweise

- **Bestandstests**: Tests, die heute im aufgeklappten Schritt `pre` mit „Aufruf“ und rohem JSON erwarten (R00221, R00234, R00237), ändern ihre Erwartung nur dort, wo der Satz an die Stelle von `pre` tritt. Die Liste dieser Erwartungen steht im Bericht des entwicklers.
- Der Nachtrag 261-architekt-2 nennt für den Test „weitere 1 Zeilen“. Maßgeblich ist der Wortlaut des PO in Z. 595: „1 weitere Zeile“.
- Die Marke „gekürzt“ erhält in C2 den Pfad als Link. Darum entsteht der Pfad in C1 an genau einer Stelle der Marke, damit C2 nur sie ersetzt.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`, Test zuerst je Bubble.

- **Unit (Node):** Die Proben aus ADR-0041 N4 „Durchsetzung“ wörtlich, ohne die Pfad-Proben und mit dem Nachtrag 261-architekt-2 (Block ohne Ende bleibt Text, Tag mitten in der Zeile bleibt Text, Kürzung bei 21 und 25 Zeilen, keine bei einem Einzeiler mit 500 Zeichen). Dazu die Rechenbeispiele von T13.
- **E2E (Chromium, headless):** AK 1–10 an T13. Wörtlich aus N4 „Durchsetzung“: „weitere n Zeilen“ klappt auf, und die Insel bleibt (`el.__probe`). Der Filter „Systemhinweise“ blendet einen eingebetteten Hinweis aus.
- **Mutanten** wählt der entwickler (Schlank arbeiten A). Jeder wird in einer eigenen Kopie von einem benannten Test getötet.
- **Regression:** Die Tests von R00221, R00234, R00237, R00238 und R00239 bleiben grün, mit geänderter Erwartung nur nach „Hinweise“.

## Abhängigkeiten

- Abhängig von: [R00239](R00239-laufansicht-zeitachse-filter-blaettern.md) (I0229, Karte #253: Filter „Systemhinweise“, Listen unter „Zeigen“; Status `Neu`, im Bau). [R00234](R00234-laufansicht-ergebnis-und-dauer.md) (I0224: Schrittzeile, Fehlererkennung, „Längste Schritte“). [R00238](R00238-laufansicht-tokens-je-lauf-und-schritt.md) (I0228: Listenfunktion, „Teuerste Schritte“). Gebaut wird auf dem Stand nach #253 (`braucht:253`, N3 Punkt 6).
- Blockiert: Karte #264, C2 „Pfade“ (N4 Punkte 5 und 6, `braucht:261`).

## Offene Fragen

Keine, die den Bau aufhält. Entschieden durch den PO: Zuschnitt C1/C2 (Z. 592), Wortlaute (Z. 594–596, 600), Kürzung auch für Write und Diffs (Z. 597), Testzeile zusätzlich oben (Z. 598), Absicht in beiden Listen (Z. 599), „…“ von kanbanD gedämpft (Z. 601), Zeichnung (Z. 602), Systemhinweis nur als vollständiger Block (Z. 603), Kurzformen in der Zusammenfassung (Z. 604, 605), Kürzung für Shell- und Wert-Block (Z. 606), nach der UX-Vorprüfung: Ansage mit eingebetteten Hinweisen (Z. 608), „nur Fehler“ (Z. 609), Urheber des „…“ (Z. 610), „Nur Systemhinweis, ausgeblendet …“ (Z. 611), kein und leeres Ergebnis (Z. 612), Präfix der Testzeile (Z. 613), Wahl von Ton und Zeile der Testzeile (Z. 619).

## Manuelle Vorbereitungstätigkeiten

- Bauen erst, wenn #253 auf `main` ist. Der Zweig `karte/261` wird vorher auf `main` gehoben.
- Die Messung vor #261 (N4 Punkt 9) läuft am Stand vor dem ersten Bau-Commit, tagsüber bei Last ≤ 2.

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 (Laufansicht) um `web/lauf-satz.js` nachführen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Satz des Betreibers „Es ist noch schwer lesbar“ an einem echten Lauf (Karte #261). Ein Aufruf steht heute als roher JSON-Text in einer Zeile. Ein Ergebnis mit hunderten Zeilen schiebt alles Folgende weg, und eine von Claude Code gekürzte Ausgabe sieht aus wie eine vollständige. Setzt kanbanD den Aufruf als abgesetzten Block in der Form seines Werkzeugs (Shell-Block, Diff, „Schlüssel: Wert“), erkennt der Mensch auf einen Blick, was der Agent tun wollte. Kürzt kanbanD jeden langen Block auf 20 Zeilen und hebt die Testzeile hervor, steht das Urteil des Werkzeugs oben, und die nächsten Schritte bleiben im Bild. Die Marke „Von Claude Code gekürzt“ und das gedämpfte „…“ zeigen den Urheber jeder Kürzung. Das beantwortet die Frage des Betreibers, ob die „…“ im Transkript stehen. Der Hebel ist der Satz und nicht das Lesen oder Auswerten, denn die Daten sind vollständig da. Es fehlt nur ihre Form.

## Missing-Docs

- Die Form von `<persisted-output>` ist nur aus 151 beobachteten Fällen bekannt (N4 „Belegt“). Eine Beschreibung von Claude Code dazu fehlt. Ändert sie sich, greift der Rückfall aus FA 8.

## Notizen

- **Verworfene Alternativen** (N4 „Optionen“): E2 (Satz träge beim Aufklappen) verworfen, weil Strg+F Zugeklapptes nicht mehr fände. E3 (Prism-Worker) verworfen, weil zweistufiges Zeichnen gegen „einmal zeichnen“ steht. Die Optionen M1–M3 der Marken gehören zu C2.
- **Nachgeschärft nach der UX-Vorprüfung** (`gemeinsam/scratchpad/ux-261/vorpruefung.md` der Factory, Lauf 261-planer-2): S1–S11 in FA 1, 3, 4, 5, 7, 8, 10, 11, 13 und AK 1–3, 5–10; ohne neues Kriterium. Nicht übernommen: aus S8 die Regel „Wert unter dem Schlüssel ab 12 Zeichen unter 641 px“ (Gestaltung, nicht entschieden; das Kriterium „kein Querscrollen“ genügt), aus S4 „kein Tooltip bei grobem Zeiger“ (nicht entschieden, `title` lässt sich je Zeiger nicht abschalten). Die Kann-Punkte bleiben beim ux-reviewer nach dem Bau.
- **Zehn Kriterien** (Schlank arbeiten A). Weitere Grenzfälle von `shellUmbruch` und `editDiff` gehören dem entwickler.
