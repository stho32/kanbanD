# ADR-0033: Review-Seite eines Commits — Adresse hinter `/aufgabe/<nr>/review?commit=`, Diff als stehende Insel, gestaffeltes Zeichnen, Nachladen einzeln und ohne Selbstwiederholung

**Status**: Akzeptiert (Punkte 1–9; Punkt 9 entschieden vom product-owner am 2026-11-20, po-entscheidungen Z. 411, mit der Bedingung „Blättern“; Nachtrag N1 für B3 #215 akzeptiert, N1.5 und N1.9 vom product-owner bestätigt, po-entscheidungen Z. 437–441)
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
- [x] B3 (#215): `…/review` ohne `commit` zeigt den Gesamt-Diff; der Umschalter kommt dazu — entschieden in Nachtrag N1.
- [x] gestalter und product-owner: Nachzeichnung D0009 nach N1.9 (freigegeben mit Änderung, po-entscheidungen Z. 437–441).
- [ ] B4 (#216): die Hervorhebung zeichnet in dieselben Blöcke zu 500 Zeilen; Prism tokenisiert je Hunk-Seite (ADR-0032 Punkt 10). Das Zeichenbudget nach Punkt 5 wird mit Farbe neu gemessen.

## Nachtrag 2026-11-20 N1: „Alle Änderungen der Karte“ (B3, Karte #215) — Adresse und Umschalter, eine Reihe für alle Diff-Anfragen, Folge-Dateien, Hinweise, mehrere Anwendungen

Der bisherige Text bleibt stehen; N1 gilt, wo er ihm widerspricht (Punkt 1 letzter Spiegelstrich, Punkt 6 „höchstens eine Anfrage `datei=` zur Zeit“, Punkt 9 „bis B3“). Entscheider: Claude (autonom, architekt, Auftrag Director Karte #215, Lauf 215-architekt-1). **Status N1: Akzeptiert.** N1.5 und N1.9 hat der product-owner am 2026-11-20 bestätigt (po-entscheidungen Z. 437–441, Lauf 215-product-owner-1).

**Belegt (Code, API A4 auf `karte/214`, 96e6db43, R00208 erledigt)**:
- Antwort `{anwendung, spanne, commits, dateien, hinweise}`. `anwendung` ist das Kürzel, `""` für die Standardanwendung. `anwendung=<kürzel>` wählt, **auch leer** (= Standardanwendung); ohne den Parameter gilt die erste Anwendung in der Reihenfolge der Verweise (`src/dienst/gesamt_diff.rs:63`).
- Folge-Eintrag `{pfad, plus, minus, binaer, schritte: [{commit, …Felder der Diffdatei}]}` (`src/modell/gesamt_diff.rs:215–231`).
- `datei=<name>` ohne `commit` behält alle Einträge mit diesem Namen (Netto `neu`, gelöscht `alt`, Folge `pfad`), 404 für Namen außerhalb von `D_karte`, 8 MB für alle Schritte zusammen; `zu_gross_zum_anzeigen` nennt den Namen, bei einer Folge-Datei also für alle ihre Schritte gleich (`:226`, `:281`, `:297`, `:332`).
- `ausgelassen` mit `unlesbar` oder `anwendung_unbekannt` steht in **jeder** Antwort. Verweise der Anwendung ohne einbezogenen Commit (alle verwaist, fehlend, Merge) → 200 mit `commits: []` und den Hinweisen; Karte ganz ohne Verweise → 404 (`:68`, `:149`).
- Nicht in der API: die Hashes der fremden Commits (`fremd_dazwischen` trägt nur Zahlen), der Zwilling eines verwaisten Commits (Vorschlag N1.7 in ADR-0032, Karte #220), ein Status je Folge-Datei.

**Gemessen (2026-11-20, Last 3,1–3,8 bei 8 Kernen, `nice -n 10`; Skripte in der Ablage der Factory `gemeinsam/scratchpad/arch-215/`)**:
- Verteilung an der echten Geschichte von kanbanD (`main`, Erst-Eltern-Linie, `karten_messen.py`), Folge als Kartenpfad, den ein fremder Commit der Spanne berührt (Näherung von ADR-0032 N6.3 ohne Umbenennungen). Stellvertreter der Karte ist die Anforderung (`[Rnnnnn]` im Betreff, 201 Gruppen):

  | Größe | Median | p90 | Max |
  |---|---|---|---|
  | Commits je Karte | 6 | 16 | 45 |
  | Dateien je Karte | 13 | 29 | 41 |
  | Zeilen (+/−, Summe der Commits) | 417 | 1.597 | 4.367 |
  | Schritte je Folge-Datei | 1 | 5 | 22 |

  Folge-Dateien in 43 von 201 Karten (21 %), dort im Median 43 % der Dateien (p90 89 %); mehr als 1.000 fremde Commits, also ganz als Folge, in 4 (2 %); keine Karte über 10.000 Zeilen. Nach der Kartennummer `(#nr)` im Betreff (22 Karten) hat 3 (14 %) Folge-Dateien. Mehrere Anwendungen an einer Karte kommen in kanbanD nicht vor (ein Repository); Annahme: selten.
- Bedingtes Lesen im Browser (`etag-probe.js`, Chromium aus `e2e/node_modules`): Eine Antwort mit `ETag` und ohne `Cache-Control` fragt der Browser bei jedem weiteren `fetch` **von selbst** mit `If-None-Match` nach und reicht bei 304 die gespeicherte Antwort als 200 an das Skript (Server: 3 Anfragen, 2 mit Tag). Setzt das Skript `If-None-Match` selbst, kommt 304 mit leerem Rumpf und `ok: false` an — `diffHolen` läse das als Fehler.

### N1.1 Adresse und Umschalter (ändert Punkt 1 letzter Spiegelstrich)

| Option | Stärke | Schwäche |
|---|---|---|
| **H1 — `…/review` zeigt „Alle Änderungen“, `?commit=` einen Commit; der Umschalter ersetzt den Verlaufseintrag** (gewählt) | PO Z. 411 wörtlich (B3 ändert nur, was die Adresse zeigt); Knopf und Verweise aus B1 bleiben; „Zurück zur Liste“ bleibt ein Schritt (Punkt 2) | „Zurück“ des Browsers kehrt nicht zur vorigen Ansicht der Seite zurück, sondern ins Fenster |
| H2 — wie H1, Umschalter mit `pushState` | Zurück wechselt die Ansicht | `history.back()` mit Marke landete in der anderen Ansicht statt im Fenster; der Verlauf stapelt (gegen Punkt 2, ADR-0029 N1) |
| H3 — eigene Adresse `…/alle` | getrennte Zustände | zweite Adresse; der Knopf aus B2 müsste umziehen (gegen Z. 411) |

- `…/review` ohne `commit` zeigt „Alle Änderungen“ und **ersetzt die Adresse nicht mehr**. `?commit=` bleibt, wie es ist (Punkte 1, 2, 9).
- Umschalter „Alle Änderungen | Ein Commit“ über dem Inhalt, in **beiden** Ansichten. Er besteht aus zwei echten Verweisen (`<a href>`, Mittelklick öffnet einen Tab). Der gezeigte trägt `aria-current="page"`. Ein einfacher Klick ersetzt den Verlaufseintrag (`replaceState`, die Marke „aus der Liste“ bleibt), wie Blättern.
- Ziel von „Ein Commit“: der zuletzt auf dieser Seite gezeigte Commit, sonst der erste mit Diff. Für den ersten gilt der Weg aus B2 (`reviewErsterCommit`, wartet auf die Liste, Rand (c) aus Punkt 9). Das `href` steht, sobald das Ziel bekannt ist.
- **Keine Auswahl** (beantwortet PO Z. 416): In „Alle Änderungen“ ist jeder einbezogene Commit in der Commit-Liste der Seite und jeder Schrittkopf einer Folge-Datei (N1.4) ein Verweis auf `?commit=`, also in einem Schritt erreichbar. In „Ein Commit“ blättert man. Ein Dropdown wäre die dritte Auswahl aus derselben Liste.
- Fokus nach dem Umschalten: auf den nun gewählten Teil des Umschalters, denn beide Teile stehen in beiden Ansichten. Nie auf `body`.
- Seitentitel in „Alle Änderungen“: „Review #<nr> · Alle Änderungen — kanbanD“; in „Ein Commit“ bleibt der Titel aus B2 (Z. 425). Die Ansage nennt die Zahlen in Worten, z. B. „Alle Änderungen der Aufgabe #219: 13 Dateien, 1.059 Zeilen hinzugefügt, 25 entfernt.“, nie „+“/„−“ (po-entscheidungen Z. 440).

### N1.2 Laden: eine Reihe für alle Diff-Anfragen der Seite (erweitert Punkte 3 und 6)

- Beim Öffnen von „Alle Änderungen“ laufen `GET …/commits` (Liste, wie B2) und `GET …/diff` ohne `commit` und ohne `anwendung` parallel. Die Liste ist klein und läuft außerhalb der Reihe.
- Nennt die Antwort `weitere_anwendungen`, liest die Seite je Kürzel `GET …/diff?anwendung=<kürzel>`, **nacheinander** in der Reihenfolge des Hinweises.
- **Höchstens eine Anfrage an `…/diff` zur Zeit je Seite**, gleich ob Abschnitt einer Anwendung oder `datei=`. Ein Klick auf „Nachladen“ oder „Änderungen anzeigen“ geht vor noch nicht begonnene Anwendungen, denn auf ihn wartet ein Mensch. Eine laufende Anfrage wird nie abgebrochen, um zu überholen. Grund: eine Antwort trägt bis 4 MB Patch (rund 24 MB JSON), `datei=` bis 8 MB (rund 48 MB). Zwei zugleich füllten das Antwortbudget von 64 MB mit Antworten derselben Seite.
- **Lauf-Kennung je Anfrage** (Lehre #209): Jede Anfrage trägt ein eigenes Objekt. Eine Antwort gilt nur, solange genau dieses Objekt der laufende Lauf von `S.ui.review` ist, nie über Index, Kürzel oder Namen. Umschalten, Wechsel des Commits oder der Adresse und Verlassen brechen die laufende Anfrage mit `AbortController` ab und leeren die Reihe.
- Kein Zustand des Gesamt-Diffs übersteht das Umschalten, die Rückkehr zu „Alle Änderungen“ liest neu. Der Browser macht daraus von selbst eine bedingte Anfrage (gemessen). Der Server antwortet nach 2 Git-Prozessen mit 304 (ADR-0032 N6.10), solange sich kein Zweig bewegt hat. Hat sich einer bewegt, ist die neue Antwort die richtige. **`If-None-Match` setzt die Oberfläche nicht selbst**, sonst käme 304 als Fehler an.
- Klappen werden je Anwendung unter `alle:<kürzel>` gemerkt (wie `klappenJe`) und gelten nur, wenn die Dateiliste gleich ist (dieselben Namen in derselben Reihenfolge).
- Ein Live-Ereignis liest nicht (Punkt 3). Inkauf: neue Verweise an der Karte erscheinen erst nach Umschalten oder Neuladen. Ein Band „neu laden“ kommt nicht mit B3 (po-entscheidungen Z. 441); zeigt der Betrieb veraltete Reviews, wird es eine Folgekarte für B1 und B3.
- Fristen wie Punkt 3 (`diffHolen`).

### N1.3 Insel und Abschnitte (erweitert Punkt 4)

- Die Insel trägt `data-insel="<nr>:alle"`. Je Anwendung steht darin ein Abschnitt mit Überschrift (Kürzel, Zahl der einbezogenen Commits und der Dateien), in der Reihenfolge der Antworten.
- Eine später ankommende Anwendung **hängt ihren Abschnitt in die stehende Insel** (wie `reviewDateiNeu`, ohne die Insel neu aufzubauen). Kopf, Summen und Liste zeichnet `render()`. Der Fokus bleibt, wo er ist.
- Kennungen sind über Abschnitte und Schritte eindeutig, z. B. `rv-d<a>-<i>` und `rv-d<a>-<i>-<j>`. `data-arg` trägt `<a>:<i>`.
- Die Summenzeile oben zählt Dateien, `plus` und `minus` über die geladenen Abschnitte und sagt, solange noch einer lädt, dass er lädt.
- Seitenweite Hinweise (`ausgelassen` mit `unlesbar` und `anwendung_unbekannt` stehen in jeder Antwort) erscheinen einmal je Seite, entdoppelt nach Verweis.
- Keine einbezogenen Commits in einer Anwendung (`commits: []`): Der Abschnitt sagt „Keine Änderungen zu zeigen“ mit den Hinweisen. 404 ohne Verweise: die Meldung aus Rand (c) (`keineHtml`).

### N1.4 Folge-Dateien

- Ein Eintrag mit `schritte` ist eine Folge-Datei. Ihr Kopf zeigt den Pfad, die Summe `plus`/`minus` aus der Antwort und „Folge · n Commits“, aber **kein Statuswort**. Einen Netto-Zustand gibt es nicht, und ein abgeleitetes Wort (z. B. aus dem ersten Schritt) behauptete ihn. Das ist derselbe Grund wie für die fehlende Netto-Zahl (ADR-0032 N6.6). Das Statuswort steht je Schritt.
- Aufgeklappt steht einmal der Satz zur Folge, dann je Schritt ein Kopf: Kurzverweis und Titel (aus `commits` der Antwort, zugeordnet über `commit` wörtlich) als Verweis auf `…/review?commit=<verweis>`, dazu Statuswort und Zahlen. Darunter folgt der Schritt wie eine Datei in B2 (`dateiZustand`, `merkmalSaetze`, `hinweisHtml`, `codeHtml` je Schritt).
- Die Zahl in Liste und Kopf ist die Summe der Schritte darunter. Damit ist PO Z. 405 erfüllt. Inkauf: doppelt gezählte Zeilen (N6.6).
- **Zeichenbudget seitenweit** (präzisiert Punkt 5): Gezählt werden die gezeichneten Zeilen aller Schritte mit `patch`. Eine Folge-Datei öffnet ganz oder gar nicht. „Die erste Datei immer“ gilt nur für die erste Datei der Seite. Nach der ersten, die nicht passt, öffnet keine weitere, auch nicht in später ankommenden Anwendungen. Ein Schritt ohne `patch` zählt nicht und unterbricht nicht. Gemessen liegt jede der 201 Karten darunter (höchstens 4.367 Zeilen), das Budget greift also nur bei Ausreißern.

### N1.5 Ganz als Folge (präzisiert ADR-0032 N6.4 für die Oberfläche; G2 bestätigt, po-entscheidungen Z. 438)

| Option | Stärke | Schwäche |
|---|---|---|
| G1 — je Commit gruppiert, wie in `#alle-raender` gezeichnet | liest sich wie die Commits nacheinander | zweite Darstellung, die Oberfläche dreht die Antwort um; dasselbe Bild gibt es schon über „Ein Commit“ mit Blättern |
| **G2 — je Datei als Folge, wie die API liefert** (gewählt) | eine Darstellung für alle Fälle; der Leser sieht je Datei, was die Karte nacheinander tat | weicht von der freigegebenen Zeichnung ab |
| G3 — auf „Ein Commit“ umleiten | am einfachsten | „Alle Änderungen“ verschwände in 2 % der Karten still |

Über den Dateien des Abschnitts steht der Grund (`nicht_linear`, `fremd_zu_viele`, `fremd_zu_gross`) in Worten, dazu der Satz, dass jede Datei als Folge steht.

### N1.6 Nachladen im Gesamt-Diff (erweitert Punkt 6)

| Option | Stärke | Schwäche |
|---|---|---|
| **N1 — `datei=<name>&anwendung=<kürzel>` ohne `commit`; der Eintrag wird ersetzt** (gewählt) | dieselbe Rechnung wie die Liste (N6.9: Netto oder Folge wie N6.3), die Antwort hat die Form des Eintrags; nur Namen aus der Antwort, der Server prüft `D_karte` | 8 MB für alle Schritte zusammen; Kosten einer ganzen Gesamt-Anfrage (gemessen 90–230 ms, N6) |
| N2 — je Schritt `commit=<schritt.commit>&datei=` (A3) | 8 MB je Schritt; Code aus B2 unverändert | anderer Lauf (Pfadangabe nur der Datei statt der Folge-Pfade), Umbenennung und Status des Schritts können abweichen, die Zuordnung kann scheitern |
| N3 — die ganze Anwendung ohne Budget neu lesen | ein Weg | hebt Budget und Grenzen auf |

- `anwendung=` steht **immer** dabei, auch leer. Ohne den Parameter gälte die erste Anwendung der Karte, und für die zweite käme 404 oder die Datei einer anderen Anwendung.
- `datei=` nimmt den Namen aus der Antwort, nie einen Text der Oberfläche.
- Zuordnung: Netto über `zuordnen` (Punkt 6), Folge über `pfad` und die Position unter gleichnamigen. Kommt der Eintrag in der anderen Art zurück (ein Zweig hat sich bewegt, Netto ↔ Folge), gilt die neue Antwort.
- Ist eine Folge-Datei zusammen zu groß (`zu_gross_zum_anzeigen`), bleibt jeder Schritt über seinen Kopf („Ein Commit“, 8 MB je Datei) lesbar. Nichts ist still.
- Nachladen geht durch die Reihe (N1.2). Lauf-Kennung und Fokus wie B2 (Code-Review #209 M2, UX-Review #209 M1).

### N1.7 Hinweise in Worten (Wortlaute freigegeben, po-entscheidungen Z. 437 und 440; Vorgabe Z. 427)

| `art` | Ort | Inhalt | Verweis |
|---|---|---|---|
| `ganz_als_folge` | Abschnitt, über den Dateien | Grund in Worten (N1.5) | – |
| `fremd_dazwischen` | Abschnitt; an jeder Folge-Datei ein Satz | Zahl der fremden Commits und der Folge-Dateien; keine Hashes (die API liefert keine) | – |
| `verwaist` | Abschnitt, Commit-Liste | verwaist, zählt nicht mit | „einzeln ansehen“ → `?commit=` |
| `merge_ausgelassen` | Abschnitt, Commit-Liste | Merge, im Gesamtbild ausgelassen | „einzeln ansehen“ → `?commit=` (Z. 427) |
| `ausgelassen` | Seite (`unlesbar`, `anwendung_unbekannt`) bzw. Abschnitt (`fehlt`) | Zustandswort wie in der Liste | – (kein Diff) |
| `weitere_anwendungen` | – | kein Satz; löst N1.2 aus, je Anwendung ein Abschnitt | – |
| `dateien_gekappt` | Abschnitt | wie B2 (`gekapptHtml`), dazu: über „Ein Commit“ lesbar | – |
| `zu_gross_zum_anzeigen` | Datei bzw. Schritt | Zustand wie B2 | Schrittkopf |
| unbekannte `art` | Abschnitt | neutraler Satz mit dem Namen der Art | – |

Wortlaute nach der Freigabe (Z. 437, 440):
- Fremde Commits: „Die Änderungen des fremden Commits sind nicht zu sehen.“ bzw. „…; Änderungen fremder Commits fehlen.“ — nie „Zeilen … nirgends“, denn Kontextzeilen eines Kartenschritts dürfen fremden Text zeigen (Z. 426).
- Ganz als Folge: „einen zusammengefassten Diff der ganzen Karte gibt es hier nicht“ — nicht „eine Summe … gibt es nicht“, denn Kopf und Liste zeigen die Summe der Schritte (N6.6).
- Grund `nicht_linear`: „Die Commits der Karte folgen nicht auf einem Zweig aufeinander.“
- Merge: „… ist ein Merge und in diesem Gesamtbild ausgelassen“ mit „einzeln ansehen“; Commit-Liste „nicht einbezogen: verwaist“ / „nicht einbezogen: Merge“; Abschnitte „Lädt die Änderungen der Anwendung <kürzel> …“, „Wartet, bis die Anwendung <kürzel> geladen ist …“, „Keine Änderungen zu zeigen“.

Fremder Text: `verweis` bei `unlesbar` ist der Text der Aufgabendatei und geht nur über `sichtbarHtml` (Punkt 8), die Kurzform nur für Verweise in Form (`kurzVerweis`).

### N1.8 Was `web/diff.js` wiederverwendet, was neu ist

- **Unverändert genutzt**: `folge`, `patchZeilen`, `sichtbarTeile`/`sichtbarHtml`, `pfadHtml`, `dateiZustand`, `bloecke`, `codeHtml`, `merkmalSaetze`, `hinweisHtml`, `dateiFehlerHtml`, `fehlerArt`, `zuordnen`, `kurzVerweis`, `gekapptHtml`, `keineHtml`, `meldungHtml`, `knopf`. Aus `web/app.js`: `diffHolen` mit Fristen, Insel über `hauptbereichErsetzen`, `reviewDateiNeu` (Fokus), `reviewErsterCommit`, `reviewZurueck`, `reviewOeffnen`.
- **Geändert**: `aufklappPlan` bekommt Restbudget und den Zustand „gesperrt“ und zählt Folge-Dateien über ihre Schritte. Er bleibt rein, und mit vollem Budget gibt er für B2 dasselbe wie heute (Einheitentest). `dateiHtml`, `inselHtml` und `dateilisteHtml` bekommen ein Präfix für Kennungen. `laufend`/`schlange` der Seite werden zur Reihe aus N1.2. `diffFehlerHtml` nennt ohne Verweis die Ansicht.
- **Neu**: das reine Modul `web/gesamt.js` mit Node-Tests wie `diff.js`. Es enthält Folge-Datei und Schritte, Hinweis → Satz und Ziel, Abschnitt je Anwendung, Umschalter, Summen über Abschnitte, die Zuordnung der `datei=`-Antwort und die Wahl der nächsten Anfrage der Reihe. Grund: `diff.js` bleibt bei B2 und ist der Ort von B4 (#216, Hervorhebung in `codeHtml`). Getrennte Dateien vermeiden Konflikte zwischen den Karten (vgl. `vKarte`, gelerntes #201).

### N1.9 Folgen für die Zeichnung D0009 (nachgezeichnet, freigegeben mit Änderung, po-entscheidungen Z. 437–440)

- `#alle-aenderungen`:
  - (a) Folge-Datei ohne Statuswort, das Statuswort steht je Schritt (N1.4).
  - (b) `fremd_dazwischen` mit der Zahl statt des Hashs `d8ce3ef`. Der Satz an der Datei sagt nicht „ein fremder Commit“.
  - (c) `verwaist` ohne „Sein Zwilling …“, weil die API ihn nicht kennt (#220).
  - (d) Schrittkopf als Verweis auf den Commit.
  - (e) Hinweis `merge_ausgelassen` mit Verweis zeichnen (fehlt).
  - (f) Umschalter auch in der Ansicht „Ein Commit“, in den Zuständen gewählt, Hover und Fokus.
- `#alle-raender`:
  - (g) „keine Linie“ und „über 1.000“ je Datei als Folge statt je Commit (N1.5).
  - (h) „zwei Anwendungen“ mit dem Zustand „lädt“ für den zweiten Abschnitt.
  - (i) Grund `fremd_zu_gross`.
  - (j) `ausgelassen` mit `unlesbar` und `anwendung_unbekannt`.
- Kontrast in Ruhe, Hover, Fokus und „gewählt“, hell und dunkel, für den Umschalter und alle neuen Verweise. Die Komponentenregel muss `a:hover` (`web/kd-base.css:4`) schlagen (UX-Review #209 M2).
- Rand des Umschalters: `--kd-muted` (6,47:1 hell, 6,97:1 dunkel) nur über den Modifikator `.seg.umsch`, nicht an der Basis `.seg`; `.btn` behält `--kd-line-strong` (po-entscheidungen Z. 439, Z. 418).

### N1.10 Durchsetzung (Abnahme-Proben für den planer)

1. `…/review` zeigt „Alle Änderungen“, und die Adresse bleibt. Umschalter → `?commit=<erster>`, zurück → `…/review`. Danach führt „Zurück zur Liste“ in einem Schritt ins Fenster, und `history.length` bleibt über die Umschaltungen gleich.
2. Folge-Datei mit zwei Schritten (verzögerte Route mit fester Antwort): Kopf ohne Statuswort, „Folge · 2 Commits“, Summe = Schritte, Schrittköpfe verweisen auf `?commit=`.
3. Budget seitenweit: Anwendung 1 hat 9.000 Zeilen, Anwendung 2 eine Datei zu 1.500, die zu bleibt. Mutant „Budget je Anwendung neu“ → rot. Eine Folge-Datei mit Schritten zu 6.000 und 5.000 nach einer ersten Datei bleibt zu (ganz oder gar nicht).
4. Reihe: verzögerte Route, die zweite Anwendung lädt, Klick auf „Nachladen“. Die `datei=`-Anfrage startet erst nach deren Ende. Steht eine dritte Anwendung aus, kommt `datei=` vor ihr. Der Zähler gleichzeitiger `…/diff`-Anfragen ist nie > 1.
5. Lauf-Kennung: Umschalten, während die zweite Anwendung lädt (verzögert). Die Anfrage wird abgebrochen (die Route sieht den Abbruch), und kein Abschnitt erscheint später. Die Rückkehr zu „Alle Änderungen“ lädt neu.
6. `datei=` trägt immer `anwendung=`, auch leer. Mutant ohne `anwendung` → die Datei der zweiten Anwendung lädt falsch (rot).
7. Hinweise: je Art der Satz. `merge_ausgelassen` und `verwaist` verweisen auf `?commit=`. Ein `unlesbar`-Verweis mit Bidi-Zeichen erscheint als Marke.
8. Fokus: nach dem Umschalten auf dem gewählten Teil; nach der Ankunft der zweiten Anwendung unverändert; nie auf `body`.
9. Live-Ereignis während des Lesens: Die Insel bleibt derselbe Knoten (Marke), auch nach der Ankunft der zweiten Anwendung.
10. Kontrast (auch Hover) für Umschalter und Verweise: Text ≥ 4,5:1, Rand und Fokus ≥ 3:1, hell und dunkel.

Pre-Mortem:
- (a) Eine weitere Anwendung lädt parallel, und bei großen Karten kommt 503 „Antwortbudget“ (Probe 4).
- (b) Die späte Antwort einer verlassenen Ansicht hängt einen Abschnitt an (Probe 5).
- (c) `datei=` ohne `anwendung` (Probe 6).
- (d) Das Budget wird je Anwendung zurückgesetzt (Probe 3).
- (e) Die Oberfläche setzt `If-None-Match` selbst, und es erscheint „Der Diff ließ sich nicht lesen (304)“ (Review-Punkt für `code-reviewer`).
- (f) Das Statuswort einer Folge-Datei wird aus dem ersten Schritt abgeleitet (Probe 2).

### N1 Konsequenzen

- Positiv:
  - Adresse, Knopf und Rückweg aus B2 bleiben.
  - Eine Seite stellt nie zwei große Diff-Anfragen zugleich.
  - Jede Änderung der Karte ist in einem Schritt erreichbar, auch ausgelassene Merges, verwaiste Commits und zu große Folge-Dateien.
  - B4 trifft `diff.js` ohne Konflikt.
- Inkauf:
  - Eine zweite Anwendung erscheint erst nach der ersten.
  - Ein Klick auf „Nachladen“ wartet hinter einer laufenden Anwendung.
  - Die Rückkehr zu „Alle Änderungen“ kostet eine (meist bedingte) Anfrage.
  - Neue Verweise erscheinen erst nach Umschalten oder Neuladen.
  - Die Zeichnung muss in zehn Punkten nachgezogen werden.

## Quellen / Bezüge

- `web/adresse.js:11–37`, `web/app.js:100`, `:106–121`, `:288–336`, `:345–411`, `:923–960`, `:1384–1440`, `web/commits.js:1–60`
- ADR-0007 (Sichtzustand übersteht das Neuzeichnen), ADR-0014 (nur die neueste Antwort), ADR-0029 mit N1, ADR-0030, ADR-0032 Punkte 6, 8, N4.3, N4.5, N5.1, N5.5
- R00205 (B1, Z. 17 und 193), R00206 (FA 2, 5, 6, 11, AK 6, 18)
- Artboard `Dokumentation/Wireframes/D0009.dc.html` `#diff-fenster`, `#diff-raender`
- Messung: `content-visibility` nach CSS Containment Module Level 2 (W3C, https://www.w3.org/TR/css-contain-2/, abgerufen 2026-11-20); Chromium über Playwright aus `e2e/node_modules`
- N1: `src/dienst/gesamt_diff.rs`, `src/modell/gesamt_diff.rs`, `src/dienst/diff.rs:116–150` auf `karte/214` (96e6db43); `web/diff.js`, `web/app.js:978–1320`, `web/kd-base.css:4`; ADR-0032 N6; R00208; po-entscheidungen Z. 405, 411, 416, 427; Fetch-Standard, „HTTP-network-or-cache fetch“ (bedingte Kopfzeilen des Skripts → Cache-Modus `no-store`), https://fetch.spec.whatwg.org/, abgerufen 2026-11-20 — im Browser geprobt
