---
id: R00246
status: Neu
datum: 2026-11-23
---

# R00246: Review-Seite — Dateien als gesehen markieren

## Beschreibung

Karte #257, Scheibe S3 nach ADR-0042 Nachtrag N1.4 (ersetzt Punkt 2), Reihenfolge 3 von 6 (PO Z. 538), und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` (PO Z. 539). Wer auf der Review-Seite einen Commit oder alle Änderungen einer Aufgabe prüft, hakt jede Datei, die er geprüft hat, im Kopf der Datei als „Gesehen“ ab. Die Datei klappt dabei ein, über der Dateiliste steht „<k> von <n> gesehen“, und in der Liste trägt die Datei ein Haken-Symbol. „Gesehen“ gilt dauerhaft in diesem Browser (nicht nur in der Sitzung, PO Z. 534): ein neuer Tab und der nächste Tag zeigen es noch, und eine Datei, die sich ändert, gilt wieder als ungesehen. Nichts geht an den Server und nichts an die Karte.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme viele Dateien prüft, sieht jederzeit, was er schon gelesen hat und was noch offen ist.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Ein Commit wie `b0bea5fd` aus #247 hat acht Dateien, eine Aufgabe in „Alle Änderungen“ leicht dreißig. Wer die Seite verlässt, einen Fund bespricht oder am nächsten Tag zurückkehrt, weiß nicht mehr, wo er stand, und scrollt durch Dateien, die er schon geprüft hat. Mit dem Haken steht die Zahl der offenen Dateien über der Liste, gelesene Dateien machen dem Rest Platz und zählen nicht ins Zeichenbudget, und der Fortschritt überlebt Neuladen, neuen Tab und Pause. Dass er nur im Browser liegt, kostet keinen Commit im Board-Git je Haken (G3 verworfen).

## Funktionale Anforderungen

- FA 1: Jede Datei trägt im Dateikopf ein Kästchen „Gesehen“, in der Tab-Folge nach „Pfad“, „VS Code“, „Patch“ (R00236). Das Kästchen gibt es in „Ein Commit“ und in „Alle Änderungen“ je Abschnitt (PO Z. 534, D0009).
- FA 2: Über der Dateiliste steht „<k> von <n> gesehen“ mit einem Balken der Breite k / n. <n> zählt **alle** Dateien der Dateiliste, auch die der eingeklappten Gruppe „Doku und Planung“ und Dateien ohne Code (gelöscht, binär); in „Alle Änderungen“ alle Dateien der geladenen Abschnitte. Ein Abschnitt, der lädt oder scheiterte, zählt nicht. Die Zeile ist eine Statusmeldung (`aria-live=polite`), der Balken nur Zierde (`aria-hidden`) (ADR-0042 N1.4, PO Z. 535).
- FA 3: Jede gesehene Datei trägt in der Dateiliste ein Haken-Symbol mit dem Lesetext „gesehen“, nicht nur eine Farbe.
- FA 4: Der Haken klappt die Datei ein, die Entnahme des Hakens klappt sie wieder auf (PO Z. 535). Der Kopf der Datei bleibt stehen, der Fokus bleibt auf dem Kästchen. Eine Datei, die ohne Haken keinen Code zeigt — neue Datei über 500 Zeilen, nachzuladende, binäre, gelöschte —, bleibt beim Entfernen des Hakens in ihrem Zustand mit ihrem Satz.
- FA 5: Beim Laden beginnen gesehene Dateien eingeklappt. Wie die Doku zählen sie nicht ins Zeichenbudget (10.000 Zeilen, ADR-0033 Punkt 5) und unterbrechen die Folge nicht; „die erste Datei immer“ gilt für die erste Datei, die danach öffnen darf (ADR-0042 Punkt 1, N1.4).
- FA 6: „Alle aufklappen“ öffnet auch gesehene Dateien, der Haken bleibt; „Alle einklappen“ schließt wie bisher (R00235 FA 4). Ein Klick auf eine gesehene Datei in der Dateiliste öffnet sie und springt hin, der Haken bleibt (R00235 FA 8). Entschieden (PO Z. 640, Frage 1).
- FA 7: Gespeichert wird in `localStorage` unter `kanbanD.gesehen.<board-slug>.<nr>` als `{"zeit": <ms seit 1970>, "gesehen": [<schlüssel>…]}`; `zeit` ist der Zeitpunkt des letzten Setzens oder Entfernens an dieser Karte (ADR-0042 N1.4, PO Z. 534). Schlüssel in „Ein Commit“: `<voller Hash>` U+0000 `<Pfad>` (bei gelöschten Dateien der alte Pfad). In „Alle Änderungen“: `alle` U+0000 `<Anwendung>` U+0000 `<Pfad>` U+0000 `<Fingerabdruck>`. Der Fingerabdruck ist FNV-1a (32 Bit, hexadezimal) über Felder, die immer in der Antwort stehen: bei einer Datei `status`, `alt`, `neu`, `plus`, `minus`, `binaer`, bei einer Folge-Datei `plus`, `minus`, `binaer` und die Verweise der Schritte — **nie über `patch`**: der Patch liegt je nach Zeichnen und Nachladen vor oder nicht, und ein Haken würde beim nächsten Laden verschwinden (ADR-0042 N3.1, Abschnitt „Fingerabdruck der Datei ohne `patch`“, Commit `9df2ae17`; die Abweichung von Punkt 2 „falls geladen“ ist dort entschieden, Frage 3). Feldliste und Ausschluss von `patch` stimmen mit N3.1 überein.
- FA 8: Eine Datei, die sich ändert, gilt wieder als ungesehen: in „Ein Commit“ durch den anderen Hash, in „Alle Änderungen“ durch einen anderen Fingerabdruck.
- FA 9: Höchstens 200 Karten je Browser. Gibt es nach einem Haken mehr als 200 Schlüssel mit dem Präfix `kanbanD.gesehen.`, fällt der mit der kleinsten `zeit` weg; fremde Schlüssel bleiben. Ein Wert, der sich nicht lesen lässt, gilt als leer, zählt beim Aufräumen als der älteste und wird beim nächsten Setzen überschrieben.
- FA 10: Jeder Haken liest den Wert frisch, ändert genau seinen Eintrag und schreibt zurück; der Haken eines anderen Tabs geht so nicht verloren. Ein schon offener Tab zeigt ihn erst beim nächsten Zeichnen, ein `storage`-Ereignis ist nicht nötig. Fehlt `localStorage` oder wirft es (Kontingent, gesperrt), gilt „Gesehen“ nur bis zum Neuladen, ohne Fehler in der Konsole und ohne Wurf in die Seite; der Haken wirkt in der Seite weiter (Einklappen, Fortschritt). Dazu steht in derselben Zeile wie „<k> von <n> gesehen“ ein Satz als Statusmeldung (`role="status"`), im gedämpften Ton, kein Fehlerrot, keine Schaltfläche: „Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.“ Er erscheint beim ersten fehlgeschlagenen Zugriff auf den Speicher (Lesen oder Schreiben) und verschwindet, wenn ein späteres Schreiben gelingt oder die Seite neu lädt (bei weiter werfendem Speicher erscheint er beim Laden erneut). Bei funktionierendem Speicher steht er nie da (PO Z. 641, ADR-0042 N1.4 „ohne Meldung“ gilt dafür nicht mehr).

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nicht quer. Das Kästchen ist mit der Tastatur erreichbar und per Leertaste bedienbar, sein Name beginnt mit dem sichtbaren Text „Gesehen“ und nennt die Datei (WCAG 2.5.3), die Zielgröße ist 24 px, bei grobem Zeiger 44 px.
- Performance: keine neue Anfrage; Lesen und Schreiben je Haken ein `localStorage`-Zugriff, Zeichnen wie bisher (Blöcke zu 500 Zeilen).
- Sicherheit: kein neuer Endpunkt, kein neues Feld, kein Prozess. Pfade stehen nur als Schlüssel im Speicher und werden nie als HTML gezeichnet.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtRepository` in `e2e/tests/review-hilfen.js`): K-Art, K-Rand, K-Budget und Aufgabe #3 wie in R00235 „Ausgangslage“; dazu ein Commit K3b in `kd`, der `src/a.rs` um eine hinzugefügte Zeile ändert und an Aufgabe #3 hängt. Mensch `sh`, Browser headless, Board-Slug aus dem Wegwerf-Board.

- **K-Art**: acht Dateien — Code `web/kd-app.css` (+2 −3), Tests `kontrast.test.js`, `sperrform.test.js`, `r00219-ansicht.spec.js`, `r00229-sperrform.spec.js`, Doku drei Dateien.
- **K-Budget**: Reihenfolge nach Gruppen `src/b.rs`, `src/d.rs`, `src/e.rs`, `src/f.rs`, `tests/c.rs`, `tests/g.rs`, `Dokumentation/a.md`; je 2.500 gezeichnete Zeilen, `d.rs` neue Datei mit 601, `g.rs` mit 2.501.

Heute (Stand `0872b754`) gibt es weder Kästchen noch Fortschritt noch Speicher. AK 1–10 sind deshalb rot.

### Bedienung

- [ ] **AK 1 Haken, Fortschritt, Ein- und Aufklappen:** Gegeben K-Art, nichts gesehen, wenn `sh` die Review-Seite des Commits öffnet, dann steht über der Dateiliste „0 von 8 gesehen“ mit einem Balken der Breite 0 %, und jede der acht Dateien hat ein Kästchen „Gesehen“ (das der drei Doku-Dateien sichtbar, sobald `sh` die Gruppe „Doku und Planung“ öffnet). Hakt `sh` `web/kd-app.css` an, dann steht dort „1 von 8 gesehen“ (Balken 12,5 %, Rechnung 1 / 8), die Datei ist zu, ihr Kopf mit dem Kästchen steht noch da, der Fokus liegt auf dem Kästchen, und in der Liste trägt die Datei das Haken-Symbol mit dem Lesetext „gesehen“. Nimmt `sh` den Haken weg, steht dort „0 von 8 gesehen“, die Datei ist offen, und das Symbol ist weg. Die Gruppe „Doku und Planung“ bleibt zu; ihre drei Dateien zählen in n mit, n bleibt 8. Mit der Leertaste lässt sich das Kästchen bedienen. Heute rot.

### Speicher und Wirkung

- [ ] **AK 2 Dauerhaft im Browser, nichts zum Server:** Gegeben K-Art, wenn `sh` `web/kd-app.css` und `kontrast.test.js` anhakt und die Seite neu lädt, dann steht „2 von 8 gesehen“ und beide Dateien sind zu; ein neuer Tab im selben Browser-Kontext zeigt dasselbe, ein neuer Browser-Kontext „0 von 8“. In `localStorage` steht genau ein Schlüssel `kanbanD.gesehen.<slug>.<nr>` mit `zeit` und zwei Einträgen `<voller Hash>` U+0000 `<Pfad>`; eine andere Aufgabe und ein anderes Board teilen den Wert nicht. Während der Bedienung geht keine Anfrage mit einer anderen Methode als GET an den Server, und die Zahl der Commits im Board-Repository bleibt gleich. Öffnet `sh` einen anderen Commit derselben Datei, ist sie dort ungesehen. Heute rot.
- [ ] **AK 3 Gesehene zählen nicht ins Zeichenbudget:** Gegeben K-Budget, nichts gesehen, dann sind `b.rs`, `e.rs`, `f.rs` und `c.rs` offen (4 × 2.500 = 10.000), `d.rs` (neue Datei über 500 Zeilen), `g.rs` (10.000 + 2.501 > 10.000) und `a.md` zu. Gegeben `sh` hakt `b.rs` und `e.rs` an und lädt neu, dann sind `b.rs` und `e.rs` zu, und `f.rs`, `c.rs` und `g.rs` sind offen (2.500 + 2.500 + 2.501 = 7.501 ≤ 10.000); `d.rs` und `a.md` bleiben zu. Einheitenprobe des Plans: zwei Dateien zu je 12.000 Zeilen, die erste gesehen — die zweite öffnet als erste Datei, die öffnen darf, die erste bleibt zu. Heute rot.
- [ ] **AK 4 „Alle aufklappen“, Dateiliste, Entfernen** (Frage 1): Gegeben K-Art mit `web/kd-app.css` und `kontrast.test.js` gesehen, wenn `sh` „Alle aufklappen“ wählt, dann sind alle Dateien und Gruppen offen, die beiden Haken bleiben, und es steht weiter „2 von 8 gesehen“; „Alle einklappen“ schließt wie bisher alle Dateien und lässt jede Gruppe stehen. Ein Klick auf `kontrast.test.js` in der Dateiliste, nachdem „Alle einklappen“ gewählt war, öffnet die Datei und springt hin, der Haken bleibt. Gegeben K-Rand, `tests/fixtures/genau-501.json` (neue Datei mit 501 Zeilen) angehakt und wieder entfernt, dann bleibt sie zu und trägt „Neue Datei mit 501 Zeilen, beginnt eingeklappt.“. Heute rot.
- [ ] **AK 5 Alle Änderungen, Änderung der Datei, Nachladen:** Gegeben Aufgabe #3 mit `kd` und `wb` (fünf Dateien), wenn `sh` „Alle Änderungen“ öffnet und `src/a.rs` anhakt, dann steht „1 von 5 gesehen“, der Haken überlebt das Neuladen, und die gleichnamige Datei einer anderen Anwendung ist unberührt. Hängt K3b (eine hinzugefügte Zeile) an die Aufgabe, so ist `src/a.rs` nach dem Neuladen wieder ungesehen („0 von 5 gesehen“, `src/a.rs` offen), die übrigen Dateien behalten ihren Stand. Gegeben K-Rand mit `src/grosse-antwort.json` angehakt, wenn `sh` dort „Änderungen anzeigen“ wählt, dann bleibt der Haken. Einheitenprobe `fingerabdruck`: gleiche Felder gleicher Wert; `plus` 2 → 3 anderer; mit und ohne `patch` gleicher; eine Folge mit einem dritten Schritt anderer. Heute rot.

### Ränder

- [ ] **AK 6 Obergrenze und unlesbarer Wert:** Gegeben die Karten #1 bis #200 mit je einem Haken (`zeit` aufsteigend), wenn `sh` danach bei #1 noch einen Haken setzt und dann bei #201 einen, dann stehen 200 Schlüssel `kanbanD.gesehen.…` im Speicher, #2 fehlt (kleinste `zeit`), #1 und #201 stehen da. Ein fremder Schlüssel wie `kanbanD.spalten-zu.<slug>` bleibt unberührt. Gegeben der Wert einer Karte ist `{kaputt`, dann steht „0 von 8 gesehen“ ohne Fehler, der nächste Haken überschreibt ihn, und beim Aufräumen zählt er als der älteste. Heute rot.
- [ ] **AK 7 Speicher nicht verfügbar:** Gegeben `localStorage` wirft bei jedem Zugriff (gesperrt oder Kontingent voll), wenn `sh` `web/kd-app.css` anhakt, dann klappt die Datei ein, es steht „1 von 8 gesehen“, und in derselben Zeile steht als `role="status"`, gedämpft (nicht im Fehlerrot, ohne Schaltfläche) der Satz „Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.“; es gibt keinen Fehler in der Konsole (`pageerror`). Vor dem ersten Haken ist der Satz schon da, wenn schon das Lesen beim Laden fehlschlug. Nach dem Neuladen steht „0 von 8 gesehen“ und bei weiter werfendem Speicher der Satz wieder. Gegeben der Speicher wirft nur beim ersten Schreiben und funktioniert danach (`addInitScript`), wenn `sh` zwei Dateien anhakt, dann steht der Satz nach dem ersten Haken da und ist nach dem zweiten verschwunden. Gegeben ein funktionierender Speicher (AK 1 bis 6), dann steht der Satz nie da. Heute rot (PO Z. 641).
- [ ] **AK 8 Zwei Tabs:** Gegeben K-Art in zwei Tabs desselben Browser-Kontexts, beide geladen, wenn `sh` in Tab A `web/kd-app.css` und danach in Tab B `kontrast.test.js` anhakt, dann steht nach dem Neuladen beider Tabs „2 von 8 gesehen“; Tab B hat den Haken aus Tab A bis zu seinem nächsten Zeichnen nicht angezeigt, ihn aber nicht überschrieben. Heute rot.

### Breite, Bestand, Mutanten

- [ ] **AK 9 Breite, Themen, Kontrast, Tastatur:** Gegeben K-Art, Breiten 320, 414, 980 und 1280 px, Themen hell und dunkel, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`; Kästchen und Haken-Symbol liegen ganz in der Breite, jedes Ziel ist ≥ 24 px, bei grobem Zeiger ≥ 44 px; das Haken-Symbol hat gegen seine Fläche ≥ 3:1, der Text der Zeile und des Kästchens ≥ 4,5:1 (`kontrastMessen`); die Tab-Folge im Dateikopf ist „Pfad“, „VS Code“, „Patch“, „Gesehen“; der Name des Kästchens beginnt mit „Gesehen“ und enthält den Pfad der Datei. Nach dem Haken liest ein Bildschirmleser „1 von 8 gesehen“ vor (Statusmeldung, genau eine). Heute rot.
- [ ] **AK 10 Bestand und Mutanten:** Ohne gesetzten Haken verhält sich die Seite wie vor S3: Gruppen, Größenbalken, Aufklapper „Dateien (<n>) und Commits“, „Pfad“, „VS Code“, „Patch“, Blättern und die Leiste von R00245, soweit sie dann auf main steht; bestehende Tests behalten ihre Erwartungen, jede geänderte Erwartung nennt der entwickler im Bericht mit Grund. Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie:
  - (m1) `sessionStorage` statt `localStorage` → AK 2 rot (neuer Tab)
  - (m2) der Haken klappt die Datei nicht ein → AK 1 rot
  - (m3) das Entfernen klappt nicht auf → AK 1 rot
  - (m4) gesehene Dateien zählen ins Zeichenbudget → AK 3 rot
  - (m5) n zählt nur die Dateien offener Gruppen → AK 1 rot (8 statt 5)
  - (m6) das Aufräumen lässt die neueste statt der ältesten Karte fallen → AK 6 rot
  - (m7) der Fingerabdruck enthält `patch` → AK 5 rot (Nachladen)
  - (m8) der Fingerabdruck ohne `plus` und `minus` → AK 5 rot (K3b)
  - (m9) der Haken schreibt den Stand vom Laden statt frisch zu lesen → AK 8 rot
  - (m10) der Schlüssel ohne Nummer oder Slug → AK 2 rot
  - (m11) „Alle aufklappen“ lässt gesehene Dateien zu → AK 4 rot
  - (m12) ein werfender Speicher wirft bis in die Seite → AK 7 rot
  - (m13) die Meldung fehlt bei werfendem Speicher → AK 7 rot
  - (m14) die Meldung bleibt nach einem gelungenen Schreiben stehen → AK 7 rot

## Betroffene Verzeichnisstruktur

- Reine Funktionen (Schlüssel, Fingerabdruck, Speicher mit Obergrenze, Plan mit gesehenen Dateien) kommen in `web/review-uebersicht.js` (ADR-0042 N1.2: hängt von nichts ab, Node-tauglich; der Speicher wird als Parameter übergeben).
- Zeichnen: `web/diff.js` (`dateiHtml`, Plan `offen`/`budgetZu`), `web/app.js` (`reviewDiffHtml`, Handler neben `review-alle` und `review-datei`, Zustand `r.klappenJe`), `web/gesamt.js` (Abschnitte in „Alle Änderungen“).
- Stil: `web/kd-app.css`, nur Tokens; die Maße der Zeichnung (`.ru-ges`, `.ru-fs`, `.ru-gm` in `D0009.dc.html`) gelten als Anhalt.
- Tests: `e2e/einheit/` (Node) und `e2e/tests/r00246-review-gesehen.spec.js`; die Ausgangslage kommt in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1288 Speicher je Karte, rein**: Werte lesen, setzen, entfernen, Obergrenze 200, unlesbar, werfend. Einheitentests zuerst.
2. **B1289 Schlüssel und Fingerabdruck, rein**: beide Formen und FNV-1a über die Felder aus FA 7. Parallel zu B1288.
3. **B1290 Ein Commit**: Kästchen im Dateikopf, Haken-Symbol, „k von n gesehen“, Ein- und Aufklappen.
4. **B1291 Grundzustand beim Laden**: Plan mit gesehenen Dateien, Budget, „Alle aufklappen“, Dateiliste. Parallel zu B1292.
5. **B1292 Alle Änderungen**: dieselbe Bedienung je Abschnitt, Fingerabdruck, Nachladen.
6. **B1293 Breite, Themen, Kontrast, Tastatur messen und nachziehen** (AK 9). Die Vorprüfung macht der ux-reviewer.
7. **B1294 Probe im echten Programm**, Mutanten m1–m14, Gate, Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht`. Für S3 gelten Bild 1 (Haken in zwei Tests, „2 von 8 gesehen“, die gesehenen Tests eingeklappt) und das Kästchen `ru-ges` im Dateikopf in Bild 2 bis 6 sowie „0 von 9 gesehen“ in „Alle Änderungen“. Verbindlich sind PO Z. 534, 535, 537 (Wortlaut „Gesehen“, „<k> von <n> gesehen“) und 539. Nicht gezeichnet sind der Fehlerpfad (AK 7), die Meldung bei nicht speicherbarem „Gesehen“ (FA 10, Wortlaut verbindlich nach PO Z. 641) und die Zeile bei einem Abschnitt, der noch lädt; ihre Form wählt der entwickler nach dem Muster der bestehenden Zustände und lässt sie vom ux-reviewer prüfen.

## Tests

- **Unit** (Node, rein): Speicher (201 Karten, unlesbar, werfend, frisch gelesen), Schlüssel, Fingerabdruck (AK 5), Plan mit gesehenen Dateien (AK 3).
- **Integration**: keine neue, der Server bleibt unverändert.
- **E2E**: AK 1–10 im gestarteten Programm gegen echtes Git, ein Test mit zwei Seiten in einem Kontext und einer in einem neuen Kontext (AK 2, 8). Der werfende Speicher kommt über `addInitScript`, die Karten #1–#201 über direkte Werte im Speicher. Keine Schlafzeiten; Verneinungen erst nach einem sichtbaren Signal.

## Abhängigkeiten

- Abhängig von: R00235 (I0225 Gruppen und Aufklapper, grün), R00236 (I0226 Kopf mit „Pfad“, „VS Code“, „Patch“, grün), ADR-0042 N1.4, ADR-0033 Punkt 5
- Blockiert: nichts unmittelbar. Berührt dieselben Dateien wie R00245 (#256, im Bau): Reihenfolge des Zusammenführens klärt der Director.

## Offene Fragen

- Frage 1 — **entschieden** (PO Z. 640, 2026-11-23: ja, der Haken bleibt; FA 6, AK 4, m11 gelten ohne Vorbehalt). Ursprünglich: Öffnet „Alle aufklappen“ auch Dateien, die als gesehen markiert sind? Empfehlung: **ja**, der Haken bleibt. Wer „Alle aufklappen“ wählt, will alles lesen können; sonst bliebe nur, jeden Haken einzeln zu entfernen und den Fortschritt zu verlieren. Der architekt schlägt dasselbe vor. Nicht richtungsweisend: Verhalten einer beauftragten Ansicht, umkehrbar.
- Frage 2 — **entschieden** (PO Z. 641, 2026-11-23: ja, Wortlaut „Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.“ als `role="status"`, gedämpft, in der Zeile „<k> von <n> gesehen“; FA 10, AK 7, m13, m14; ADR-0042 N1.4 „ohne Meldung“ gilt dafür nicht mehr). Ursprünglich: Soll die Seite sagen, wenn der Browser „Gesehen“ nicht speichern kann (Kontingent voll, gesperrt)? Empfehlung: **ja**, ein Satz bei „<k> von <n> gesehen“: „Gesehen wird in diesem Browser nicht gespeichert.“ Sonst verliert der Mensch beim Neuladen seinen Fortschritt, ohne es zu wissen (PO Z. 556: kein stiller Verlust). ADR-0042 N1.4 sagt „ohne Meldung“. (Erledigt: Satz in FA 10 und AK 7.)
- Frage 3 — **entschieden** (ADR-0042 N3, Commit `9df2ae17`: Fingerabdruck nie über `patch`; FA 7 deckt sich mit N3.1; Lücke N3.3 in Kauf genommen, Stufe `blob` nur auf eigene Karte, N3.4). Ursprünglich: Der Fingerabdruck „falls geladen, `patch`“ ändert sich, sobald ein Patch nachgeladen wird oder ein gesehener, eingeklappter Eintrag beim nächsten Laden anders vorliegt; der Haken verschwände. FA 7 nimmt den Patch heraus (Folge-Datei: Verweise der Schritte). Preis: eine Änderung, die `plus` und `minus` gleich lässt (eine Zeile ersetzt), erkennt der Fingerabdruck in „Alle Änderungen“ nicht. Empfehlung: so annehmen; will der Betreiber das nicht, kommt später ein kleines Feld mit der Blob-Kennung je Datei in die Antwort (neues Feld, kein neuer Endpunkt, eigene Karte). 

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Abnahme von #247: acht Dateien in einem Commit, und wer nach einer Unterbrechung zurückkehrt, scrollt wieder durch alles, weil die Seite nicht weiß, was er geprüft hat. Merkt sich die Seite die Haken im Browser, dann zeigt sie über der Liste „<k> von <n> gesehen“, klappt Geprüftes ein und lässt es nicht mehr ins Zeichenbudget zählen; offen bleibt, was noch ansteht, und der Mensch sieht, was ungeprüft ist, auch in der Doku. Dass der Wert dauerhaft im Browser liegt, trägt über neuen Tab, Pause und nächsten Tag; dass eine geänderte Datei wieder ungesehen gilt, verhindert, dass ein Haken auf veraltetem Stand Vertrauen vortäuscht. Der Hebel ist die Beschränkung auf den Browser: kein Commit je Haken, kein neuer Endpunkt, kein Datenformat im Board; die Obergrenze von 200 Karten hält den Speicher klein.

## Notizen

- Optionen für den Speicherort (ADR-0042 Punkt 2 und N1.4; entschieden vom product-owner, PO Z. 534): (G1) `sessionStorage` — verworfen, der Fortschritt wäre im neuen Tab und nach jeder Pause weg; (G2) `localStorage` je Karte mit Obergrenze — gewählt, wie die übrige Ansichtswahl (`kanbanD.spalten-zu.<slug>`, `web/app.js:129`); (G3) an der Karte im Board-Git — verworfen, ein Commit je Haken, neues Format, Konflikte zwischen Prüfern. Ergebnis der Frage „im Browser oder auf dem Server“: im Browser, **kein Datenformat im Board**; das Format `{zeit, gesehen}` ist rein lokal.
- Entscheidung des planers: Der Fingerabdruck liest nie `patch` (FA 7, Frage 3); er weicht damit vom Wortlaut des ADR ab, nicht von seiner Absicht („eine geänderte Datei gilt wieder als ungesehen“).
- Entscheidung des planers: Entfernen des Hakens öffnet nur Dateien, die Code zeigen können (FA 4); eine große neue Datei beginnt weiter zu (R00235 FA 6, PO Z. 536).
- Inkauf (ADR-0042 N1.4): „Gesehen“ gilt je Browser und Gerät, nicht je Mensch und nicht an der Karte. Wer die Website-Daten löscht, verliert den Fortschritt. Beim Schreiben im selben Augenblick aus zwei Tabs kann ein Haken verloren gehen.
- Grenze, die bleibt (Hypothese, nicht gemessen): eine Aufgabe mit 30 Commits und je 50 Dateien ergäbe rund 1.500 Schlüssel von je etwa 100 Byte, also 150 KB; mal 200 Karten sind 30 MB und überschritten das Kontingent von etwa 5 MB. Dann greift FA 10 (Fehlerpfad). Typisch (8 Dateien, 3 Commits, 2 KB je Karte) sind es 400 KB für 200 Karten. Fällt das im Betrieb auf, ist die Obergrenze 200 Schlüssel je Karte die erste Maßnahme (eigene Karte, kein Teil von S3).
- Bewusst nicht in S3: Wortmarke (#258), Umbrechen (#259), Nebeneinander (#260), „wer hat gesehen“, Abgleich zwischen Geräten, „Alle als gesehen markieren“.
- Härtung ohne Kriterium, für die UX-Vorprüfung: Tastenkürzel zum Abhaken der Datei im Blick, Rückmeldung beim Entfernen des Hakens an einer Datei außerhalb des Bildes.
