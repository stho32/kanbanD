---
id: R00244
status: Neu
datum: 2026-11-23
---

# R00244: Laufansicht — Farbcodes und Fehlerzustand im Satz lesbar

## Beschreibung

Karte #267, Nachfolger von #261 (Kommentar des Betreibers „Es ist noch schwer lesbar“). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N6, Punkte 1–7, Variante C; Produkt `AI-Team/po-entscheidungen.md` Z. 625 (Farbcodes), 626 (fehlgeschlagenes Edit), 627 (Kurzform behält die Marke), 628 (Zeichnung D0009 `#laufansicht` Bild 14 freigegeben).

Wer in der Laufansicht ein Ergebnis liest, sieht heute jedes Farbsteuerzeichen als Kästchen (252 in 144 echten Transkripten, vor allem in der Fehlerausgabe des Playwright-MCP). Danach liest er Text mit der Bedeutung der Farbe: gedämpft, rot, grün, gelb, fett. Was die feste Liste nicht trägt, bleibt sichtbar als Marke. Ein fehlgeschlagenes Edit oder Write sagt es in Worten („Nicht angewendet — der Schritt ist fehlgeschlagen.“) und zeigt seinen Diff gedämpft statt grün und rot. Die Fehlerfarbe liegt nur an der Zeile und am Ergebnis des Schritts; Aufruf, Diff und Felder bleiben neutral.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): R00240 macht lesbar, was in einem Schritt geschah; diese Anforderung nimmt dem Ergebnis die Fremdzeichen und dem gescheiterten Schritt die falsche Behauptung einer Änderung, ohne etwas zu verbergen.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)

## Geschäftlicher Nutzen

Der Betreiber will die Ansicht „leichter lesbar“, nicht „weniger“ (#261). Gezählt (ADR-0041 N6 „Belegt“): 18 von 5.357 Ergebnissen (0,3 %) tragen `U+001B`, zusammen 252 Zeichen, davon 228 Farbfolgen aus fünf Codes; Hauptquelle ist die Fehlerausgabe des Playwright-MCP, also genau der Fall, in dem jemand nachliest. 4 von 48 Edit/Write-Ergebnissen sind fehlgeschlagen (8 %); dort stand ein grüner Diff über einem roten Schritt und der Aufruf trug ohne Absicht das Rot der Zeile (Klassenzusammenstoß mit dem allgemeinen `.fehl`). Beides kostet beim Nachlesen Aufmerksamkeit und behauptet Falsches.

## Funktionale Anforderungen

1. **Farbfolgen übersetzen, nur im Ergebnis** (N6 Punkt 1): Eine Farbfolge `ESC[<p>(;<p>)*m` mit höchstens 4 Teilen, jeder Teil leer, `0`, `1`, `2`, `22`, `31`, `32` oder `33`, wird im Ergebnis eines Schritts nicht als Marke gezeigt, sondern wirkt auf den Text danach. In Aufruf, Nachricht, Name, Pfad und Kurzform der Zeile wird nie übersetzt; dort bleibt jedes `ESC` eine Marke (R00240 FA 10, N4).
2. **Wirkung** (N6 Punkt 2): `0`, `22` und eine leere Folge (`ESC[m`) setzen alles zurück, `1` setzt fett, `2` gedämpft, `31` rot, `32` grün, `33` gelb; von den vier Farben gilt die zuletzt genannte, fett ist davon unabhängig. Der Zustand beginnt je Ergebnis neu und endet mit ihm. Eine Folge, die den Zustand nicht ändert, öffnet keine neue Spanne. Die Wirkung kommt nur über feste Klassen: kein `style`, kein Wert aus dem Text, keine Hintergrundfarbe, keine Deckkraft, kein `display`.
3. **Alles andere bleibt Marke** (N6 Punkt 1, 3): `ESC(B`, `ESC[8m` (verbergen), `ESC[7m` (umkehren), `ESC[30m` und `ESC[30;40m`, `ESC[38;5;196m`, jede Folge mit einem Teil außerhalb der Liste, mit mehr als 4 Teilen, ohne Abschluss, und ein einzelnes `ESC`. Nichts, was Text verbergen könnte, wird je übersetzt. Die Rohform bleibt im Transkript-Download.
4. **Budget und Spannen** (N6 Punkt 4): Eine übersetzte Folge zählt nicht gegen das Budget der Marken (1.000 je Text, 10.000 je Lauf, R00240 FA 10); `MARKIERBAR` bekommt dafür einen Vorgriff („`U+001B` nicht, wenn eine erlaubte Folge folgt“). Ein Ergebnis trägt höchstens 2.000 Spannen; jedes `ESC`, das nicht übersetzt wurde, ist eine Marke im Budget oder in der Zusammenfassung „… und n weitere Steuerzeichen“.
5. **`MARKIERBAR` an drei Orten gleich** (N6 Punkt 4): `web/lauf.js` (`zeichenBuchen`), `web/lauf-satz.js` und `web/diff.js` entscheiden für jeden Text gleich, auch mit dem Vorgriff; ein Node-Test hält sie gleich.
6. **Kontrast** (N6 Punkt 3): Jede Klasse der Übersetzung (gedämpft, rot, grün, gelb, mit und ohne fett) hat auf der Fläche des Ergebnisses in beiden Themes mindestens 4,5 : 1.
7. **Fehlgeschlagenes Edit oder Write** (N6 Punkt 6, Z. 626): Mit `s.fehler` steht über dem Diff der Satz „Nicht angewendet — der Schritt ist fehlgeschlagen.“ (Gedankenstrich U+2014, Punkt am Ende, sichtbarer Text); der Diff trägt die Klasse `nicht-angewendet`: keine grünen und roten Flächen, Zeilen gedämpft, `+` und `−` bleiben; der Lesetext sagt „vorgesehen hinzuzufügen:“ bzw. „vorgesehen zu entfernen:“. Ohne Ergebnis im Transkript bleibt der Diff wie heute.
8. **Fehlerfarbe nur an Zeile und Ergebnis** (N6 Punkt 7, Z. 625): Im fehlgeschlagenen Schritt haben die Zeile und das Ergebnis die Fehlerfarbe; Aufruf, Diff und Felder haben die Textfarbe. Das allgemeine `.fehl` wird nicht umbenannt.

## Nicht-funktionale Anforderungen

- **Sicherheit** (Review-Punkt `security-reviewer`): Text aus einem Ergebnis ist fremd. Er darf nie Text verbergen (kein `8`, kein Hintergrund, keine Umkehr, keine Deckkraft) und nie eine Wirkung außer den fünf festen Klassen haben (AK 2, 3). Eine neue erlaubte Folge muss ihre Farbe aus dem Token-Satz nehmen und die Kontrastprobe bestehen (AK 6).
- **Leistung**: höchstens 2.000 Spannen je Ergebnis, ein Durchlauf je Text; 3 MiB aus Farbfolgen dürfen die Seite nicht einfrieren (AK 4). Keine eigene Messung; die Messung aus R00240 und die Schwellen aus R00241 bleiben maßgeblich.
- **Zugänglichkeit**: Farbe trägt nie allein ein Urteil (Z. 472, 598, 612): der Fehlerzustand steht als Wort („Fehler:“, „Nicht angewendet“); Gedämpft, Rot, Grün und Gelb haben keine Bedeutung für Bildschirmleser, der Text steht ohne Kästchen im Lesefluss.
- **Architektur** (Fitness Function N4/N6): die Übersetzung ist eine reine Funktion in `web/lauf-satz.js` (Zeile und Zustand → Teile mit Klasse), frei von `innerHTML` und `document`; ein Zustand je Ergebnis.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00240: die gz-Datei erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/<n>/transkripte` ab; Unit-Proben in Node). Mensch `sh`, Browser headless (Chromium), Board `fabrik` mit `record-transcripts: true`. **T16** (neu, nur erfundene Inhalte, angelehnt an echte Fälle) = `planer@2026-11-25T10:00+01:00` in Aufgabe #1:

| Nr | art · wer | Inhalt |
|---|---|---|
| 1 | nachricht · mensch | „Projekt: /w/demo“⏎„Arbeitsort: Worktree /w/wt/demo/karte-7“ |
| 2 | aufruf · `Bash` | `{"command":"npx playwright test","description":"E2E"}` |
| 3 | ergebnis | „Exit code 1“⏎„### Error: locator.click: Timeout 5000ms exceeded.“⏎„Call log:“⏎`ESC[2m  - waiting for getByRole('button', { name: 'Speichern' })ESC[22m`⏎`ESC[2m  - locator resolved to <button>ESC[22m`⏎`ESC(B ESC[m` |
| 4 | aufruf · `Bash` | `{"command":"cargo fmt --check","description":"Format"}` |
| 5 | ergebnis | „Exit code 1“⏎„Diff in src/main.rs:3:“⏎`ESC[31m-    let x=1;ESC[0m`⏎`ESC[32m+    let x = 1;ESC[0m`⏎„ok-Zeile ohne Farbe“ |
| 6 | aufruf · `Edit` | `{"file_path":"/w/wt/demo/karte-7/web/a.js","old_string":"alt","new_string":"neu"}` |
| 7 | ergebnis | `<tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>` |
| 8 | aufruf · `Write` | `{"file_path":"/w/wt/demo/karte-7/notiz.md","content":"a"}` |
| 9 | ergebnis | `<tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>` |
| 10 | aufruf · `Edit` | wie Nr 6, ohne Ergebnis im Transkript |
| 11 | aufruf · `Edit` | `{"file_path":"/w/wt/demo/karte-7/web/b.js","old_string":"alt","new_string":"neu"}` |
| 12 | ergebnis | „The file /w/wt/demo/karte-7/web/b.js has been updated.“ |
| 13 | aufruf · `Bash` | `{"command":"echo ESC[31mrotESC[0m","description":"Marke"}` (mit echtem `U+001B`) |
| 14 | ergebnis | `ESC[8mgeheimESC[0m ESC[7mumgekehrtESC[0m ESC[30;40mschwarzESC[0m ESC[38;5;196mrotESC[0m` |
| 15 | nachricht · agent | `ESC[31mfertigESC[0m` |
| 16 | aufruf · `Bash` | `{"command":"ls","description":"Liste"}` |
| 17 | ergebnis | `ESC[32mgruenESC[0m fertig` |

`ESC` steht für `U+001B`. Zählen in den Proben: Spanne = zusammenhängender Text unter einem Zustand, der von der Grundschrift abweicht.

### Farbcodes im Ergebnis

- [ ] **AK 1 Übersetzen, Rechenbeispiel:** Gegeben das Ergebnis Nr 3 von T16, wenn `sh` den Schritt aufklappt, dann steht der Text der beiden „- waiting …“-Zeilen ohne ein einziges Kästchen für Farbfolgen, in zwei gedämpften Spannen, und der Rest (`Exit code 1`, `### Error: …`, `Call log:`) steht in Grundschrift; der Textinhalt des Ergebnisses ist der Text ohne die Folgen. Das `ESC(B` in der letzten Zeile bleibt eine Marke (AK 3), die `ESC[m` dahinter ist übersetzt und sichtbar nicht vorhanden. Beispiel rustfmt, Nr 5: „-    let x=1;“ ist rot, „+    let x = 1;“ grün, die Zeile „ok-Zeile ohne Farbe“ in Grundschrift, je Spanne endet an `ESC[0m`; 2 Spannen, 0 Marken. Rechenbeispiel Zustand: `ESC[1;31mAESC[22mB` ergibt A fett und rot, B in Grundschrift; `ESC[1;2;31;32mx` (4 Teile) ergibt x fett und grün; `ESC[31mAESC[31mB` ergibt eine Spanne „AB“.
- [ ] **AK 2 Zustand je Ergebnis, nur feste Wirkung:** Gegeben die Ergebnisse Nr 5 und danach Nr 12 von T16, wenn beide aufgeklappt sind, dann beginnt Nr 12 in Grundschrift, obwohl Nr 5 nach dem Reset endete; endet ein erstes Ergebnis offen (`ESC[31mx` ohne `ESC[0m`), beginnt das nächste trotzdem in Grundschrift. Im gezeichneten Ergebnis hat kein Element ein `style`-Attribut, und keine übersetzte Spanne trägt eine Hintergrundfarbe, Deckkraft oder `display`.
- [ ] **AK 3 Alles andere bleibt Marke, sichtbar:** Gegeben das Ergebnis Nr 14 von T16, wenn `sh` es aufklappt, dann steht „geheim“, „umgekehrt“, „schwarz“ und „rot“ lesbar da, in Grundschrift, mit je einer Marke für das `ESC` der unerlaubten Folge und dem gewöhnlichen Text `[8m`, `[7m`, `[30;40m`, `[38;5;196m`; nur `ESC[0m` ist übersetzt: 4 Marken, 0 Spannen. Dasselbe gilt für `ESC[0;8m`, `ESC(B`, ein einzelnes `ESC`, `ESC[` ohne Abschluss und `ESC[1;1;1;1;1m` (5 Teile): Marke, nie Wirkung. Im Aufruf Nr 13, in der Nachricht Nr 15 und in der Kurzform der Zeile von Nr 16/17 (das Ergebnis beginnt mit einer erlaubten Folge) bleibt jedes `ESC` eine Marke, während das aufgeklappte Ergebnis „gruen“ grün zeigt (Wirkung nur im Ergebnis).
- [ ] **AK 4 Budget, Grenzen und Spannen:** Gegeben ein Ergebnis aus 1.200 mal `ESC[2mxESC[22m`, wenn `sh` es aufklappt, dann stehen 1.200 gedämpfte Spannen und keine Marke und keine Zusammenfassung „weitere Steuerzeichen“; das Budget des Laufs ist unberührt (10.000 frei). Gegeben ein Ergebnis aus 1.200 mal `ESC[8mx`, dann stehen 1.000 Marken und „… und 200 weitere Steuerzeichen“ (R00240 FA 10 unverändert). Gegeben ein Ergebnis aus 3.000 mal `ESC[31mxESC[0m`, dann sind höchstens 2.000 Spannen gesetzt, jedes übrige `ESC` ist eine Marke im Budget oder in der Zusammenfassung (gezeigt plus gezählt = Zahl der nicht übersetzten `ESC`), und die Seite bleibt bedienbar; 3 MiB `ESC[31m` ohne Text öffnen keine Spanne.
- [ ] **AK 5 `MARKIERBAR` an drei Orten gleich:** Gegeben jedes Zeichen von `U+0000` bis `U+FFFF`, einzeln, mit einer erlaubten Folge dahinter (`ESC[2m`) und mit einer nicht erlaubten (`ESC[8m`), wenn Budget (`zeichenBuchen`), Satz (`MARKIERBAR_SATZ`) und Diff (`sichtbarTeile`) entscheiden, ob das Zeichen eine Marke ist, dann stimmen alle drei in jedem Fall überein; ein Ergebnis mit 252 erlaubten `ESC` bucht 0, mit 252 unerlaubten bucht es 252.
- [ ] **AK 6 Kontrast in beiden Themes:** Gegeben ein Ergebnis mit je einer Spanne gedämpft, rot, grün, gelb, fett und rot-fett, wenn `sh` es in hellem und dunklem Thema ansieht, dann hat jede Spanne zur Fläche des Ergebnisses ein Kontrastverhältnis von mindestens 4,5 : 1 (gemessen aus `getComputedStyle`, auch im fehlgeschlagenen Schritt, dessen Ergebnis auf der Seitenfläche steht).

### Fehlgeschlagener Schritt

- [ ] **AK 7 Edit und Write „nicht angewendet“:** Gegeben die Schritte Nr 6/7 (Edit) und Nr 8/9 (Write) von T16, wenn `sh` sie aufklappt, dann steht über dem Diff der Satz „Nicht angewendet — der Schritt ist fehlgeschlagen.“, der Diff hat keine grüne und keine rote Fläche (keine Zeile mit der Klasse `add` oder `del` mit Fläche), seine Zeilen sind gedämpft, `+` und `−` stehen weiter vor den Zeilen, und der Lesetext sagt „vorgesehen hinzuzufügen:“ bzw. „vorgesehen zu entfernen:“ statt „hinzugefügt:“ bzw. „entfernt:“. Gegenprobe: Nr 10 (Edit ohne Ergebnis) zeigt den Diff wie heute mit „Kein Ergebnis im Transkript.“ und ohne den Satz; Nr 11/12 (Edit erfolgreich) zeigt grünen und roten Diff und keinen Satz.
- [ ] **AK 8 Fehlerfarbe nur an Zeile und Ergebnis:** Gegeben der fehlgeschlagene Schritt Nr 6/7 aufgeklappt, dann haben Name, Kurzform und Dauer der Zeile und der Text des Ergebnisses die Fehlerfarbe (Token `--kd-status-error-ink`), der Aufruf (Feld „file_path“, Diff, Satz „Nicht angewendet …“) die Textfarbe `--kd-text`, auch in Nr 4/5 für den Bash-Aufruf; ohne Fehler (Nr 11/12) ist nichts rot. Die Schriftgröße von Aufruf, Diff und Ergebnis ist dieselbe wie bei einem Schritt ohne Fehler (nicht 12 px des allgemeinen `.fehl`).

Grenz- und Leerfälle, bedacht: leeres Ergebnis und Ergebnis nur aus Folgen (Text ohne Spanne, 0 Marken, kein leeres Element); Folge am Ende ohne Text dahinter (öffnet keine Spanne); `ESC[` am Textende (Marke, wie `ESC` ohne Abschluss); Spanne über einen Zeilenumbruch (die Zustandsgrenze liegt im Ergebnis, nicht in der Zeile: eine rote Spanne über zwei Zeilen bleibt über beide rot; Zeilenkürzung „weitere n Zeilen“ übernimmt den Zustand am Schnitt, AK 2 gilt nach dem Aufklappen); Ergebnis mit Hinweis `<system-reminder>`: Folgen im Hinweis sind wie im übrigen Ergebnis übersetzt; Ergebnis als JSON-Objekt: Folgen in Werten bleiben Marken (die Zeile des JSON-Satzes bekommt keine Übersetzung); Ergebnis ohne `ESC` ist byte-gleich zum Stand vor der Änderung (Regression R00240). Verworfen: Hintergründe, 256 Farben, `8`, `7` (Variante D, N6).

## Betroffene Verzeichnisstruktur

- `web/lauf-satz.js`: reine Funktion für die Übersetzung, `ergebnisSatz` nutzt sie über den Zeilenparameter, `aufrufSatz`/`editHtml` bekommen den Fehlerzustand, `MARKIERBAR` mit Vorgriff.
- `web/lauf.js`: `schrittHtml` gibt `s.fehler` an den Aufruf-Satz, `MARKIERBAR` und `zeichenBuchen` mit Vorgriff; `web/diff.js`: `MARKIERBAR` (`sichtbarTeile`) mit Vorgriff.
- `web/kd-app.css`: Klassen der Übersetzung, `nicht-angewendet`, `.lv-s-ganz` und `.lv-s.fehl .lv-erg`; nur Tokens.
- Tests: `e2e/einheit/lauf-satz.test.js` (und `lauf.test.js`, `diff.test.js` für den Gleichheitstest), `e2e/tests/laufansicht-t16.js` (Fixture), `e2e/tests/r00244-laufansicht-farbcodes-und-fehlerzustand.spec.js`; Modell `Dokumentation/Architektur/A00009-oberflaeche.md`.

## Technische Überlegungen

### Ablauf (Vorplanung nach N6, Bauordnung 7 → 6 → 1–5; welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1275** Proben zuerst und Fehlerfarbe (N6 Punkt 7, AK 8): T16, Probe der Textfarben im Fehlschritt rot; `.lv-s-ganz{color:var(--kd-text)}` und `.lv-s.fehl .lv-erg{color:var(--kd-status-error-ink)}`.
2. **B1276** Fehlgeschlagenes Edit/Write (N6 Punkt 6, AK 7): `schrittHtml` → `aufrufSatz(…, fehler)` → Satz und Klasse `nicht-angewendet`, Lesetext.
3. **B1277** Übersetzung als reine Funktion (N6 Punkt 1–3, 5, AK 1–3 Unit): Zeile und Zustand → Teile mit Klasse; Gegenproben `8`, `7`, `30;40`, `38;5;196`, `ESC(B`, 5 Teile.
4. **B1278** `MARKIERBAR` mit Vorgriff an drei Orten und Gleichheitstest, Spannengrenze (N6 Punkt 4, AK 4, 5).
5. **B1279** Einbau in `ergebnisSatz`, Klassen und Kontrast, E2E an T16, Gate (AK 1–6).

### Grobentwurf

Wichtige Einstiegsstellen: `ergebnisSatz(text, zeile)` und `teileHtml` in `web/lauf-satz.js` (der `zeile`-Parameter bekommt die Übersetzung), `schrittHtml` in `web/lauf.js` (Fehlerzustand an `aufrufSatz`), `zeichenBuchen`.

- `farbteile(text, zustand)` (reine Funktion) — Text und Zustand → Teile `{text, klasse}` und Endzustand; keine Zeichen von `ESC` in den Teilen außer Marken.
- `SATZ_GRENZEN.farben = 2000` — Grenze der Spannen je Ergebnis.
- `MARKIERBAR` mit Vorgriff — an drei Orten gleich.

### Hinweise

- **Offener Punkt für entwickler und `architekt`**: `MARKIERBAR` ist ein regulärer Ausdruck und kennt die Grenze von 2.000 Spannen nicht. N6 Punkt 4 sagt „darüber bleiben die weiteren Folgen Marken und laufen in das Budget“. Empfehlung des planers: Hat ein Ergebnis mehr als 2.000 Spannen, wird es ganz wie heute gezeigt (jedes `ESC` eine Marke, im Budget); das ist mit dem Ausdruck vereinbar und erfüllt AK 4 (höchstens 2.000 Spannen, kein `ESC` verschwindet). Eine Aufteilung „erste 2.000 übersetzt, Rest Marken“ erfüllt AK 4 ebenso, wenn Budget und Satz dieselbe Zahl zählen (AK 5).
- **`22` setzt wie `0` alles zurück** (N6 Punkt 2: „`0` und `22` setzen zurück“); in einem Terminal setzte `22` nur fett und gedämpft zurück. Im Bestand schließt `22` immer ein `2`.
- **Zusammenspiel mit #264** (R00242): beide ändern `ergebnisSatz` und `schrittHtml`; keine fachliche Abhängigkeit, nur Merge-Reihenfolge.
- Modell A00009 (Laufansicht) „Ist“ nachführen.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`, Test zuerst je Bubble.

- **Unit (Node):** Übersetzung (AK 1–4) mit den Gegenproben aus N6 „Durchsetzung“ wörtlich: `ESC[2m a ESC[22m` ohne `U+001B` im HTML; je Gegenprobe Marke: `ESC[8m`, `ESC[30m`, `ESC[38;5;196m`, `ESC[0;8m`, `ESC(B`, einzelnes `ESC`, 5 Teile; 3 MiB `ESC[31m` höchstens 2.000 Spannen, Rest Marken im Budget; Gleichheitstest `MARKIERBAR` (AK 5).
- **E2E (Chromium, headless):** AK 1–4 und 6–8 an T16, hell und dunkel; Kontrast je Klasse aus `getComputedStyle`; im Fehlschritt Textfarbe des Aufruf-Blocks `--kd-text`.
- **Mutanten** (Mindestmenge, in einer eigenen Kopie, je von einem benannten Test getötet): „`8` in der Liste“; „Hintergrundfarbe zugelassen“; „`7` in der Liste“; „Zustand läuft über das Ergebnis hinaus“ (Zwei-Ergebnis-Probe, AK 2); „Vorgriff fehlt an einem der drei Orte“ (AK 5); „Spannengrenze fehlt“ (AK 4); „Klasse `nicht-angewendet` fehlt“; „Regel `.lv-s.fehl .lv-erg` entfernt“; „`color` in `.lv-s-ganz` entfernt“.
- **Regression:** R00221, R00234, R00237–R00243 bleiben grün; ein Ergebnis ohne `ESC` ist byte-gleich.

## Abhängigkeiten

- Abhängig von: [R00240](R00240-laufansicht-satz-der-eintraege.md) (I0230, grün: `web/lauf-satz.js`, `MARKIERBAR` an drei Orten, Budget FA 10), [R00234](R00234-laufansicht-ergebnis-und-dauer.md) (Ursprung von `s.fehler`, Fehlererkennung). Zeichnung D0009 `#laufansicht` Bild 14 (freigegeben).
- Blockiert: nichts.

## Offene Fragen

Keine, die den Bau aufhält. Die Fragen 1–3 des architekt und alle des gestalter sind vom PO beantwortet (Z. 625–627, 628ff.). Hinweis an den architekt/entwickler: die Reichweite des Vorgriffs bei mehr als 2.000 Spannen (siehe „Hinweise“) und die Deutung von `22` (Rückfall auf `0`) sind Planungsentscheidungen mit Empfehlung, kein Richtungspunkt.

## Manuelle Vorbereitungstätigkeiten

- Keine. Die Fixture T16 entsteht im Test.

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 (Laufansicht) „Ist“ nachführen: Übersetzung, `nicht-angewendet`, Fehlerfarbe.

## Warum löst diese Anforderung das Problem?

Auslöser ist der Kommentar des Betreibers zu #261 „Es ist noch schwer lesbar“. Wirkungskette: ein Playwright-Fehler mit Call log trägt eine Marke je Zeilenrand → 252 Kästchen verdecken den Text → die Übersetzung der fünf Codes der Zählung nimmt sie aus dem Text und behält die Bedeutung (gedämpft, rot, grün) → was nicht in der festen Liste steht, bleibt Marke, also kann kein Programm Text verbergen. Zweite Kette: ein Edit scheitert (`tool_use_error`) → heute grüner Diff und rote Schrift im Aufruf → der Leser hält den Schritt für angewendet oder liest ihn nicht → Satz, gedämpfter Diff und Fehlerfarbe nur an Zeile und Ergebnis sagen es in Worten.

## Missing-Docs

- Die Liste der sieben Codes (`1` und `33` ohne Beleg im Bestand) ist eine Zugabe für Cargo- und Testausgaben (N6 „In Kauf genommen“).

## Notizen

- Priorität: Mittel (Lesbarkeit; keine Funktion fällt aus).
- Quellen: Karte #267; ADR-0041 N6 (Akzeptiert, 06ad0203); `AI-Team/po-entscheidungen.md` Z. 625–628; D0009 `#laufansicht` Bild 14.
- Verworfene Varianten (N6): A Marken bleiben (löst die Karte nicht); B alle Folgen ausblenden (Bedeutung und Spur gehen verloren, widerspricht Z. 600/601); D ANSI voll auslesen (öffnet den Weg, Text zu verstecken).
- Entscheidungen des planers: `sicherheit` als Label (Fremdtext bestimmt Darstellung), Spannengrenze und `22` siehe „Hinweise“; eine Interaction mit fünf Bubbles statt drei Interactions, weil eine Karte, eine Bauordnung (7 → 6 → 1–5) und ein Dialog.
