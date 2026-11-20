# ADR-0033: Review-Seite eines Commits — Adresse hinter `/aufgabe/<nr>/review?commit=`, Diff als stehende Insel, gestaffeltes Zeichnen, Nachladen einzeln und ohne Selbstwiederholung

**Status**: Akzeptiert (Punkte 1–9; Punkt 9 entschieden vom product-owner am 2026-11-20, po-entscheidungen Z. 411, mit der Bedingung „Blättern“)
**Datum**: 2026-11-20
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #209, Lauf 209-architekt-1)
**Kontext-Anforderung**: — (Karte #209, nach Feinschnitt nur Scheibe B2 „Diff-Ansicht eines Commits“; die Anforderung schreibt der planer). Bezug: ADR-0007, ADR-0014, ADR-0029, ADR-0030, ADR-0032 (Punkte 6 und 8, N4, N5 auf `karte/213`), R00205 (B1), R00206 (A3), Artboard D0009 `#diff-fenster`, `#diff-raender`
**Erprobt durch**: DOM-Messung headless (Chromium aus `e2e/node_modules`, `nice -n 19`, Last 1,6–2,0 bei 8 Kernen, 2026-11-20; Skripte in der Ablage der Factory `gemeinsam/scratchpad/arch-209/dom-messung*.js`); alles andere am Code gelesen, nicht gefahren

## Kontext

- **Belegt (Code)**:
  - Die Oberfläche kennt nur Hash-Adressen. `nummerLesen` (`web/adresse.js:33`) verlangt das Ende der Adresse direkt hinter der Nummer; `#/board/x/aufgabe/7/review?…` liefert heute die Ansicht `board` ohne Nummer. ADR-0029 sagt zu: weitere Teile nur **hinter** `/aufgabe/<nr>`, die beiden Formen bleiben.
  - `render()` (`web/app.js:1384`) ersetzt bei jedem Zeichnen `#main` über `innerHTML`, auch nach jedem Live-Ereignis, das den Stand ändert. Einzelne Knoten überstehen das nur, wenn sie ausdrücklich zurückgesetzt werden (`commitsStatusBehalten`, `datumsknotenBehalten`, `hauptbereichErsetzen` mit der Personenwahl).
  - `fensterDerAdresseFolgen` öffnet das Aufgabenfenster für jede Adresse mit `nummer` (`web/app.js:396`).
  - `api()` (`web/app.js:106`) bricht jede Anfrage nach `ANTWORT_FRIST_MS` = 15 s ab, gemessen bis zum Ende des Rumpfs. Der Diff antwortet spätestens nach 15 s (ADR-0032 N4.1) und darf danach bis 60 s schreiben (N5.1).
  - B1 (`web/commits.js`) ist rein und in Node testbar. Fremder Text geht dort unverändert durch und wird erst beim Zeichnen maskiert (`esc`); Bidi-Steuerzeichen werden aus Zweignamen **entfernt**.
- **Belegt (API, R00206 und ADR-0032 N4/N5)**: Patch je Datei ≤ 256 KB und ≤ 3.000 Zeilen (`plus + minus`), sonst `gross`; Summe ≤ 4 MB roh, dann `nachladen`; Dateiliste ≤ 2.000 (`dateien_gekappt`); einzeln geladener Patch ≤ 8 MB (N5.1), sonst `gross` mit `zu_gross_zum_anzeigen`; Pfad > 4.096 Byte → `gross` mit `zu_gross_zum_anzeigen`, `datei=` weist ihn mit 400 ab; Antwortbudget 64 MB, Überschreitung sofort 503 mit `fehler`, das mit `Antwortbudget` beginnt; Zeitgrenze 503 `{fehler}`. Die API liefert **keine Bytegröße** je Datei. `datei=` mit einem Namen aus Ersatzzeichen kann **zwei** Dateien liefern (R00206 AK 6). Der Diff zu einem vollen Hash ändert sich nie (ETag).
- **Gemessen (DOM)**: Diff-Zeilen als Raster-Zeile (vier Zellen) über `innerHTML` einsetzen und Layout erzwingen:

  | Zeilen | ohne Staffelung | Blöcke zu 300 Zeilen mit `content-visibility: auto` |
  |---|---|---|
  | 1.000 | 47 ms | – |
  | 10.000 | 405 ms (Neuzeichnen 562 ms) | 38 ms |
  | 30.000 | 1.222 ms (Neuzeichnen 1.702 ms) | 108 ms |
  | 100.000 | 4.796 ms, 500.000 Knoten | 389 ms |

  Eine Antwort bis 4 MB trägt bei üblichen 40 Byte je Zeile rund 100.000 Zeilen, ein einzeln geladener Patch bis 8 MB rund 200.000.
- **Artboard**: Die Review-Seite ist eine Vollansicht (Kopf „#219 Review“, „3 von 4“, „Alle einklappen“, Dateiliste links). Gezeichnet sind auch der Umschalter „Alle Änderungen | Ein Commit“ (gehört zu B3) und der Text „über 20 MB“ (vor N5). Der Zustand 503 „Antwortbudget“ fehlt.

## Optionen

### Wo die Review-Seite lebt

- **S1 — Ansicht der Einzelseite, Diffbereich als stehende Insel** (gewählt): neue Sicht `review` in `web/app.js`. `render()` zeichnet Kopf, Navigation und Dateiliste wie jede Ansicht. Den Diffbereich setzt es nach dem Ersetzen als **denselben Knoten** wieder ein, solange Aufgabe und Commit gleich sind. Stärke: Adresse und Zurück passen zu ADR-0029, `S.ui.tab` bleibt beim Zurück stehen (das Fenster zeigt wieder „Commits“), ein Live-Ereignis kostet nur den Kopf. Schwäche: ein zweiter Weg neben `innerHTML`, der Diffbereich muss seinen Zustand selbst nachführen.
- **S2 — eigene Seite `web/review.html` mit Pfad-Adresse**: völlig frei vom Neuzeichnen. Schwäche: neue Server-Route, eine zweite Adressform neben ADR-0029, Kopf, Thema und Sprache doppelt, Zurück lädt die ganze Einzelseite neu.
- **S3 — Ansicht der Einzelseite, ganz über `render()`**: am einfachsten. Schwäche: jedes Live-Ereignis zeichnet bis zu 100.000 Zeilen neu (gemessen 1,7 s bei 30.000), eine Textauswahl und offene Klappen gehen beim Lesen verloren. Während die Factory arbeitet, kommen Ereignisse im Minutentakt.

### Wie viel gezeichnet wird

- **Z1 — alles sofort**: 4,8 s bei 100.000 Zeilen, verworfen.
- **Z2 — Budget für das erste Aufklappen + Blöcke mit `content-visibility: auto`** (gewählt): ein Zehntel der Zeit (gemessen). Strg+F findet auch Text in Blöcken außerhalb des Bildes, denn der Browser zeichnet ihn nur nicht. Schwäche: die Bildlaufleiste springt leicht, solange Blöcke ihre geschätzte Höhe tragen.
- **Z3 — virtuelles Scrollen**: konstant schnell. Schwäche: Strg+F und Bildschirmleser sehen nur die gezeichneten Zeilen, eigener Bildlaufcode. Verworfen.

## Entscheidung

**Gewählt: S1 und Z2.** Akzeptierte Schwäche: der Diffbereich ist der einzige Bereich von `#main`, der nicht aus `render()` entsteht; seine Klappen leben in `S.ui.review` und in der Insel zugleich.

1. **Adresse** (erweitert ADR-0029 hinter `/aufgabe/<nr>`, beide Formen bleiben):
   - `#/board/<slug>/aufgabe/<nr>/review?commit=<verweis>` und `#/aufgaben/aufgabe/<nr>/review?commit=<verweis>`. `<verweis>` ist URL-kodiert und lautet wie in der API (`<kürzel>:<hash>` oder `<hash>`). Links der Oberfläche tragen den **vollen** Verweis aus der Liste. Kurze Präfixe ab 7 Zeichen, die Menschen oder Agenten tippen, nimmt die API an (R00206 FA 2).
   - Eine **eigene** reine Lesefunktion in `web/adresse.js` liefert `sicht: 'review'` mit `review: {nummer, commit}`. `nummer` bleibt dabei `null`, sodass `fensterDerAdresseFolgen` und `adresseNachfuehren` die Review-Adresse nicht als „Fenster offen“ lesen. `nummerLesen` ändert sich nicht.
   - Der Verweis aus der Adresse wird gegen `^([a-z0-9]{1,8}:)?[0-9a-fA-F]{7,64}$` geprüft, bevor er in eine Anfrage geht. Ungültig → Seite „Verweis ungültig“ **ohne** den Text der Adresse (ADR-0029 Regel 3). Nur ein geprüfter Verweis wird angezeigt.
   - `…/review` ohne `commit` ist für B3 reserviert. In B2 zeigt diese Adresse den ersten Commit mit Diff (`replaceState` auf `?commit=`), nie eine leere Seite.
2. **Navigation**:
   - Hash und Zeile in der Liste aus B1 sind echte `<a href>`. Ein einfacher Linksklick ohne Umschalt- und Steuertaste läuft über `act`, schreibt `history.pushState` mit der Marke `AUS_DER_ANSICHT_GEOEFFNET` und lädt. Mittelklick und „In neuem Tab öffnen“ bleiben Links.
   - „Zurück zur Liste“: mit Marke `history.back()`, ohne Marke (Link, Lesezeichen) `replaceState` auf die Adresse des Fensters. So stapelt nichts, wie in ADR-0029 N1.
   - Der Wechsel zum vorigen oder nächsten Commit („3 von 4“) **ersetzt** den Eintrag, wie der Wechsel der Aufgabe in ADR-0029 Regel 2.
   - Gezählt und geblättert wird über die Einträge von `GET …/commits` mit Diff (`auf_zweig`, `verwaist`), in der Reihenfolge der API. Die übrigen Einträge zählen nicht mit. Ränder nach Punkt 9 (a)–(d).
3. **Laden**:
   - Beim Öffnen der Seite (Adresse neu) laufen zwei Anfragen parallel: `GET …/commits` (Navigation, Band „verwaist“, Zweig) und `GET …/diff?commit=`. Der Titel kommt aus `/api/aufgaben`, das `laden` ohnehin liest.
   - Es gilt nur die neueste Antwort (ADR-0014). Der Schlüssel ist Aufgabe + voller Hash. Eine Antwort für einen inzwischen verlassenen Commit wird verworfen.
   - **Ein Live-Ereignis liest weder Liste noch Diff neu** (wie B1). Der Diff zu einem vollen Hash ändert sich nie. Ein Rebase, der den Verweis an der Karte ersetzt, macht den gezeigten Commit höchstens `verwaist`, sein Diff bleibt gültig. Beim Verlassen der Sicht fällt `S.ui.review` weg (Speicher bis etwa 24 MB JSON).
   - Diff-Anfragen haben eine eigene Frist: **15 s bis zum Kopf, 60 s für den Rumpf** (N4.1, N5.1), statt `ANTWORT_FRIST_MS` 15 s für beides. Ein Abbruch durch den Browser gibt das Budget des Servers frei.
4. **Insel**: Der Diffbereich trägt `data-insel="<nr>:<voller hash>"`. Nach dem Ersetzen von `#main` setzt `render()` den vorigen Knoten wieder ein, wenn der Schlüssel gleich ist, wie bei `commitsStatusBehalten`. Aufklappen, Einklappen und Nachladen ändern nur den Abschnitt **ihrer** Datei und tragen den Stand in `S.ui.review.dateien[i]` nach, sodass ein frischer Aufbau (Zurück, Vor, Neuladen) dasselbe Bild ergibt. Die Leseposition hält ADR-0007, weil der Knoten bleibt.
5. **Zeichenbudget**:
   - Beim ersten Aufbau werden Dateien mit `patch` in der Reihenfolge der Liste aufgeklappt, bis **10.000 Diff-Zeilen** gezeichnet sind (gemessen 38 ms gestaffelt). Die übrigen bleiben zu, mit ihren Zählern und „anzeigen“. Der Patch liegt schon vor, Aufklappen fragt den Server nicht. Gelöschte Dateien sind immer zu (Artboard).
   - **Zählweise (präzisiert 2026-11-20, Frage des planers zu R00207):** Gezählt wird jede gezeichnete Zeile, also jede Zeile des Patch-Textes ab `@@`, zerlegt an `\n`; das abschließende `\n` ergibt keine eigene Zeile. **Hunk-Köpfe und `\ No newline at end of file` zählen mit**, denn beide sind gezeichnete Zeilen. Kontextzeilen zählen ebenso. Eine Datei öffnet nur, wenn sie **ganz** ins Restbudget passt (Summe einschließlich der Datei ≤ 10.000). Nach der ersten Datei, die nicht passt, öffnet **keine weitere**, auch keine kleinere spätere: das Bild bleibt eine lückenlose Spitze der Liste. Gelöschte Dateien und Dateien ohne `patch` zählen nicht und unterbrechen die Folge nicht.
   - **Ausnahme:** Die **erste** Datei mit `patch` öffnet immer, auch über 10.000 Zeilen. Das kommt vor, weil die Grenze von 3.000 nur `plus + minus` zählt und Kontext und Köpfe dazukommen. Ohne die Ausnahme stünde eine Seite mit einer einzigen großen Datei ganz zu. Die Blöcke zu 500 Zeilen halten auch sie im gemessenen Bereich. Danach öffnet nichts mehr.
   - Beispiel (R00207 #8): vier Dateien zu je 2.499 Zeilen + 1 Kopf = 4 × 2.500 = 10.000 → alle vier offen; die fünfte (1 Zeile + 1 Kopf) ergäbe 10.002 → zu.
   - Jede aufgeklappte Datei wird in **Blöcken zu 500 Zeilen** mit `content-visibility: auto` und `contain-intrinsic-size: auto <geschätzte Höhe>` gezeichnet. Auch ein einzeln geladener Patch von 8 MB bleibt so im Bereich der gemessenen 0,4 s je 100.000 Zeilen. Ohne Unterstützung im Browser wird alles gezeichnet, langsamer, aber vollständig.
   - Was der Mensch selbst aufklappt, wird immer gezeichnet. Es gibt keine Obergrenze und keine stille Kürzung.
6. **Nachladen** (`gross` ohne Hinweis, `nachladen`):
   - Nur auf Klick, **höchstens eine Anfrage `datei=` zur Zeit** je Seite, weitere warten sichtbar („wartet“). Grund: ein einzeln geladener Patch kann bis 48 MB JSON halten (N5.1); zwei gleichzeitig füllten das Budget von 64 MB mit Antworten derselben Seite.
   - `datei=` nimmt `neu`, bei gelöschten `alt`. Liefert die Antwort mehrere Dateien (Name mit Ersatzzeichen), wird die mit gleichem `status`, `alt` und `neu` an der Position übernommen, die ihrer Reihenfolge unter den gleichnamigen entspricht.
   - Kommt die Datei mit `gross` und dem Hinweis `zu_gross_zum_anzeigen` zurück, steht sie danach als „zu groß zum Anzeigen“ da, ohne Knopf.
   - Eine Datei mit `zu_gross_zum_anzeigen` in der ersten Antwort (Patch über der Grenze oder Pfad über 4.096 Byte) bekommt **keinen** Knopf „anzeigen“, nur die Zähler. `datei=` würde sie ohnehin abweisen.
7. **Fehler**:
   - 503 mit `fehler`, das mit `Antwortbudget` beginnt, ist der Zustand „Server ausgelastet“. Jeder andere 503 ist „Zeitgrenze“. 404 und 400 sind „kein Diff möglich“ (Artboard). Die Unterscheidung steht in einer reinen Funktion.
   - **Keine automatische Wiederholung**, weder für die Seite noch für eine Datei. Es gibt einen Knopf „Erneut versuchen“. Grund: eine Wiederholung ohne Menschen trifft das Budget genau dann, wenn es voll ist, und verdeckt die Ursache. Ein Druck kostet nichts.
   - Ein Fehler beim Nachladen lässt die Datei zu, die Meldung steht an ihr (Artboard). Die Seite bleibt lesbar.
   - Texte ohne Zahl der Grenze: „zu groß zum Anzeigen“ ohne „über 20 MB“ oder „über 8 MB“. Die Grenze gehört dem Server und wurde schon einmal geändert (N5.1). „groß“ nennt die Zeilen (`plus + minus`), keine KB, weil die API keine Bytegröße liefert.
   - `dateien_gekappt` zeigt die Hinweiszeile mit `gezeigt` und `gesamt` aus der Antwort (Bedingung des PO). Die Dateien über der Kappe sind in B2 nicht erreichbar, denn ihre Pfade kennt die Seite nicht. Die Zeile sagt das.
8. **Fremder Text** (Pfade, Patch-Zeilen, Titel, Autor, Zweige):
   - Gezeichnet wird nur über `esc` in festen Elementen (Geist ADR-0030), nie Markdown, keine Hervorhebung in B2.
   - Zerlegt wird der Patch nur an `\n` (nicht an `\r`, U+2028, U+0085, R00206 AK 18). Die Zeilennummern kommen aus den `@@ -a,b +c,d @@`-Köpfen. `\ No newline at end of file` ist eine Hinweiszeile ohne Nummer.
   - **Unsichtbares wird sichtbar, nicht entfernt**: Bidi-Steuerzeichen (U+202A–202E, U+2066–2069) erscheinen in Pfaden und Patch-Zeilen als Marke (z. B. `⟨U+202E⟩`). Steuerzeichen außer Tab und ein `\r` am Zeilenende erscheinen als Bildzeichen (U+2400 + Code, `␍`). Grund: im Review ist ein verstecktes Bidi-Zeichen genau der Angriff („Trojan Source“), Entfernen verbärge ihn. B1 entfernt sie in Zweignamen weiter, das bleibt.
   - Lange Zeilen (bis 256 KB in einer Zeile) laufen je Datei quer (Artboard), sie werden nie umgebrochen oder gekürzt.
9. **Knopf „Alle Änderungen ansehen“ bis B3** (Akzeptiert, product-owner 2026-11-20, po-entscheidungen Z. 411): Er führt in B2 auf `…/review` und damit nach Punkt 1 auf den ersten Commit mit Diff, mit „1 von n“. Der Knopftext bleibt wie gezeichnet. Der Umschalter „Alle Änderungen | Ein Commit“ steht in B2 **nicht** auf der Seite, denn ohne B3 hätte er kein Ziel. B3 ändert nur, was `…/review` zeigt. Der Knopf und seine Adresse bleiben.
   - **Bedingung des PO: Blättern.** Die Seite geht von Commit zu Commit (vor und zurück, „2 von n“), und jeder Commit ist auch über `?commit=` erreichbar. So ist jede Änderung der Karte erreichbar. Das deckt Punkt 2: dieselbe Folge und dieselbe Zählung (Einträge mit Diff in der Reihenfolge der API), „Erster Commit mit Diff“ in Punkt 1 ist ihr erstes Glied, und jeder Schritt ersetzt den Verlaufseintrag.
   - **Lücken geschlossen**: (a) Die Stelle „i“ wird über den **vollen Hash** aus der Diff-Antwort in der Liste gesucht, nie über den Text der Adresse. So zählt auch ein getippter Kurz-Präfix richtig. (b) Steht der Commit der Adresse nicht unter den Einträgen mit Diff (Liste und Diff sind zwei Anfragen, N4.2), zeigt die Seite den Diff ohne „i von n“ und mit „zum ersten Commit“. (c) Hat die Karte keinen Commit mit Diff, ersetzt `…/review` die Adresse nicht. Die Seite sagt „Keine Änderungen zu zeigen“, nennt die Zustände der Einträge und führt zurück zur Liste, statt leer zu bleiben. (d) „vor“ fehlt am letzten Commit, „zurück“ am ersten. Es gibt keinen Umlauf und keinen toten Knopf.

## Konsequenzen

**Positiv:**
- Ein Live-Ereignis kostet auf der Review-Seite nur den Kopf. Textauswahl, Klappen und Leseposition bleiben.
- Die größte Antwort (4 MB) ist in rund 0,4 s gezeichnet statt in 5 s. Strg+F findet weiter alles.
- Eine einzelne Review-Seite kann das Antwortbudget nicht allein füllen.
- Ein verstecktes Bidi-Zeichen im Commit fällt im Review auf.
- Die Adresse ist ein Deep-Link nach ADR-0029, auch für Agenten.

**Negativ / Inkauf:**
- Zweiter Zeichenweg (Insel) neben `innerHTML`.
- Bei `content-visibility` springt die Bildlaufleiste leicht.
- Dateien jenseits der Kappe von 2.000 sind in B2 nicht ansehbar, aber benannt.
- Ein Commit, der während des Lesens per Rebase ersetzt wird, bleibt bis zum Neuladen mit dem alten Hash stehen. Das Band „verwaist“ erscheint erst nach erneutem Öffnen.

**Durchsetzung:**
- Reines Modul `web/diff.js` (Node-Tests wie `web/commits.js`): Hunks und Zeilennummern, Sichtbarmachen, Zustand je Datei (`patch` / `gross` / `nachladen` / `binaer` / `zu_gross` / ohne Inhalt), Aufklapp-Plan mit Budget, Fehlerart, Navigation „i von n“. In `web/adresse.js` die Lese- und Bildefunktion der Review-Adresse.
- Einheitentests: Adresse mit `%`-Kodierung, fremden Zeichen, 6 und 65 Hex, ohne `commit`, Board- und Aufgabenform. Patch mit `\r\n`, U+2028, `\ No newline`, Hunk `@@ -0,0 +1 @@`, Bidi in Pfad und Zeile. Budget genau 10.000 und 10.001 Zeilen.
- E2E mit **verzögert antwortendem** Fake bzw. verzögerter Route (gemeinsames Gelerntes): Commit wechseln, während der Diff noch lädt (die alte Antwort wird verworfen); Live-Ereignis während des Lesens (die Insel ist danach **derselbe** Knoten, geprüft über eine Marke am Element); zwei Klicks „anzeigen“ (die zweite Anfrage startet erst nach der ersten); Zurück nach Öffnen aus der Liste (ein Schritt, Fenster mit „Commits“).
- Review-Punkt für `security-reviewer`: kein `innerHTML` mit fremdem Text ohne `esc`. Bidi sichtbar in Pfad und Zeile.

**Folgeentscheidungen / Aufgaben:**
- [ ] gestalter: Zustand 503 „Antwortbudget“ (Seite und Datei) und die Hinweiszeile `dateien_gekappt` nachzeichnen; „über 20 MB“ und „380 KB“ aus den Rändern nehmen; Umschalter „Alle Änderungen | Ein Commit“ in B2 weglassen; Marke für Bidi- und Steuerzeichen.
- [x] product-owner: Punkt 9 (2026-11-20, mit Bedingung „Blättern“).
- [ ] B3 (#215): `…/review` ohne `commit` zeigt den Gesamt-Diff; der Umschalter kommt dazu.
- [ ] B4 (#216): die Hervorhebung zeichnet in dieselben Blöcke zu 500 Zeilen; Prism tokenisiert je Hunk-Seite (ADR-0032 Punkt 10). Das Zeichenbudget nach Punkt 5 wird mit Farbe neu gemessen.

## Quellen / Bezüge

- `web/adresse.js:11–37`, `web/app.js:100`, `:106–121`, `:288–336`, `:345–411`, `:923–960`, `:1384–1440`, `web/commits.js:1–60`
- ADR-0007 (Sichtzustand übersteht das Neuzeichnen), ADR-0014 (nur die neueste Antwort), ADR-0029 mit N1, ADR-0030, ADR-0032 Punkte 6, 8, N4.3, N4.5, N5.1, N5.5
- R00205 (B1, Z. 17 und 193), R00206 (FA 2, 5, 6, 11, AK 6, 18)
- Artboard `Dokumentation/Wireframes/D0009.dc.html` `#diff-fenster`, `#diff-raender`
- Messung: `content-visibility` nach CSS Containment Module Level 2 (W3C, https://www.w3.org/TR/css-contain-2/, abgerufen 2026-11-20); Chromium über Playwright aus `e2e/node_modules`
