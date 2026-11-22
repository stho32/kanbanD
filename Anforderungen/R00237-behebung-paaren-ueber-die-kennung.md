---
id: R00237
status: Neu
datum: 2026-11-22
ursprung: Bug-Report
ursprungslauf: R00234
---

# R00237: Behebung — die Laufansicht paart Aufruf und Ergebnis über die Kennung des Aufrufs, nicht über die Reihenfolge

## Beschreibung

Karte #262 (Vorrang, Auftrag des Betreibers). Kommen die Ergebnisse paralleler Aufrufe in anderer Reihenfolge zurück, als die Aufrufe gestellt wurden, zeigt die Laufansicht ein Ergebnis beim falschen Aufruf. Dauer, Kürzel und Fehlermarke der Schrittzeile und „Längste Schritte“ stimmen dann nicht.

Reproduktion (Beispiel der Karte, geprobt am Stand `cddb15ac` mit Node 20): Aufruf A `Bash` um 10:00:00, Aufruf B `Bash` um 10:00:01, Ergebnis von B („entwickler“) um 10:00:03, Ergebnis von A („Exit code 1“) um 10:00:10.

- **Erwartet**: A dauert 10 s und trägt den Fehler, B dauert 2 s.
- **Tatsächlich**: A zeigt 3 s mit dem Kürzel „entwickler“, B zeigt 9 s mit „Exit code 1“ und dem Fehler; „Längste Schritte“ nennt B (9 s) vor A (3 s).

Das ist **falsch gebaut**: R00234 FA 6 sagt jeder Schrittzeile die Dauer `zeit(Ergebnis) − zeit(Aufruf)` *ihres* Ergebnisses zu und verlangt das Kürzel des Ergebnisses. Die Regel „Ein Ergebnis gehört zum ältesten offenen Aufruf“ (R00234 FA 6, erster Satz; ADR-0041 N1 Punkt 3) hält diese Zusage bei vertauschter Reihenfolge nicht. Sie gilt künftig nur noch als Rückfall für Einträge ohne Kennung (ADR-0041 N2 ersetzt N1 Punkt 3, erster Spiegelstrich). Häufigkeit nach ADR-0041 N2 „Belegt“: In 400 Protokollen paart die Warteschlange 130-mal falsch, das betrifft 109 Läufe (27 %).

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“: Wer einen Lauf abnimmt, sieht bei jedem Aufruf dessen eigenes Ergebnis und dessen eigene Dauer.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)

## Ursachenanalyse

### Root Cause

Belegt am Stand `cddb15ac` (Zweig `karte/262`):

- `eintragPruefen` (`web/lauf.js:64–69`) übernimmt nur `art`, `wer`, `text`, `zeit`, `name`. Die Kennungen `id` und `zu`, die der Umwandler der Factory seit Factory-Commit `89cb890` schreibt, fallen als unbekannte Schlüssel weg.
- `ergebnisZuordnen` (`web/lauf.js:398–408`) nimmt mit `offen.shift()` immer den ältesten offenen Aufruf. Ohne Kennung kennt die Auswertung keinen anderen Weg.
- `aufrufOeffnen` (`web/lauf.js:390–395`) läuft bei jedem Aufruf über alle offenen (`offen.forEach`, `:392`). Dadurch wächst die Zeit quadratisch: Mit 10.000 offenen Aufrufen braucht `laufAuswerten` heute 214–267 ms, mit 1.000 sind es 14–16 ms (gemessen am 2026-11-22 12:53, Last 2,7, `nice -n 10`, Skript `gemeinsam/scratchpad/arch-262/probe.js` der Factory).

Ausgeschlossen: Server und OpenAPI. Der Server liest die gz-Datei nie zeilenweise (`src/dienst/transkripte.rs`), das Format betrifft nur `web/lauf.js` und den Erzeuger. Gesamtdauer, Werkzeug, Denken, Warten, Denk- und Wartezeilen hängen an keiner Paarung (ADR-0041 N1 Punkt 1) und sind schon heute richtig.

### Betroffene Komponenten

- `web/lauf.js`: `eintragPruefen` (liest `id` und `zu`), `aufrufOeffnen`, `ergebnisZuordnen` (Paaren nach G1, Zähler für „parallel“)
- `e2e/einheit/lauf-auswerten.test.js`, `e2e/einheit/lauf.test.js` (Erwartung an `eintragPruefen`, `:76`, bekommt `id: null, zu: null`)
- `e2e/tests/`: eine neue Probe der Laufansicht
- **Nicht** betroffen: Server, OpenAPI, Zeichnen (`schrittHtml` zeigt weiter das gepaarte Ergebnis), Wortlaute, `tokens` (gehört zu #263, PO Z. 569)

## Lösungsvorschlag

### Langfristige Lösung

ADR-0041 N2 Punkte 1 (ohne `tokens`), 2 und 3, Variante G1:

1. **Format** (PO Z. 569): Ein Eintrag darf `id` (nur an `werkzeugaufruf`) und `zu` (nur an `werkzeugergebnis`) tragen. Beide sind Texte mit 1–256 Zeichen (`length`). Ein falsch geformtes Feld gilt als fehlend, und der Eintrag bleibt lesbar. `eintragPruefen` liefert `id` und `zu`, sonst `null`.
2. **Paaren in einem Durchlauf**:
   - Ein Aufruf mit `id` wird unter seiner Kennung offen geführt. Trug schon ein früherer Aufruf dieselbe `id`, gilt die erste, und der spätere zählt als Aufruf ohne `id`.
   - Ein Ergebnis mit `zu` gehört zum offenen Aufruf mit dieser `id`. Gibt es keinen (die Kennung ist unbekannt oder ihr Aufruf ist schon gepaart), steht das Ergebnis allein, und keine Warteschlange greift.
   - Ein Ergebnis ohne `zu` gehört zum ältesten offenen Aufruf ohne `id`. Gibt es keinen, gehört es zum ältesten offenen Aufruf überhaupt.
   - Verglichen wird Zeichen für Zeichen, ohne Trimmen und ohne Angleichen der Groß- und Kleinschreibung. Die Zuordnung geht über eine `Map`. Kennungen werden nie gezeichnet.
3. **Aufwand O(n)**: Zwei Warteschlangen (alle, ohne `id`) mit Kopfzeiger und einer Marke „gepaart“, dazu die `Map`. Nichts wird aus der Mitte einer Liste entfernt. „parallel“ geht über einen Zähler statt über `offen.forEach`.
4. **Ohne Felder** ergibt das genau die Warteschlange von heute. Ein Lauf ohne Kennungen bekommt keine Marke und keinen neuen Wortlaut (PO Z. 570).

### Alternative Ansätze

Entschieden in ADR-0041 N2 „Optionen zum gemischten Transkript“, hier nur benannt:

- **G2 Schalter je Transkript** (trägt ein Eintrag eine Kennung, wird nur noch über Kennungen gepaart): Ein Erzeuger, der `zu` nur manchmal schreibt, lässt jedes Ergebnis ohne `zu` allein stehen. Das wäre schlechter als heute, und niemand sähe den Grund.
- **G3 Kennung nur als Prüfung** (weiter die Warteschlange, ein Widerspruch wird markiert): Die Ansicht bliebe falsch und sagte es nur. Die Abnahme der Karte verfehlt das.
- **Paaren über die Zeit** (das zeitlich nächste Ergebnis): Das rät genauso wie die Warteschlange, nur anders.

## Test-Strategie

### Test zur Bug-Reproduktion

Node-Test gegen `laufAuswerten` mit den vier Einträgen aus dem Beispiel, A und B mit `id`, die Ergebnisse mit `zu` (AK 1). Heute rot, weil A 3 s zeigt und der Fehler bei B steht.

### Code-Extraktion für isoliertes Testing

Nicht nötig. `laufAuswerten` und `eintragPruefen` sind schon rein und in Node testbar (`e2e/einheit/`).

### Regressionstests

- Die Erwartungen von heute für Läufe ohne Felder sind Literale. Sie werden **vor dem Fix** am Stand `cddb15ac` aufgenommen, nicht danach aus dem neuen Code abgeleitet (AK 2).
- Die Tests zu R00221 und R00234 (Node und E2E) bleiben ohne geänderte Erwartung grün. Ausnahme ist `lauf.test.js:76`: Dort kommen `id: null, zu: null` hinzu.
- Altbestand gegen den alten Stand (AK 3, legacy-reviewer).

## Akzeptanzkriterien

**Ausgangslage**: Zeiten in UTC am 2026-11-22, `t+k` heißt 10:00:00 + k s. Alle Aufrufe sind `Bash` von `agent`, alle Ergebnisse von `werkzeug`. **T6** ist das Beispiel der Karte: Nr 1 Aufruf A `{"command":"cat regeln"}` bei `t+0` mit `id: "toolu_A"`, Nr 2 Aufruf B `{"command":"cat entwickler"}` bei `t+1` mit `id: "toolu_B"`, Nr 3 Ergebnis „entwickler“ bei `t+3` mit `zu: "toolu_B"`, Nr 4 Ergebnis „Exit code 1\nregeln“ bei `t+10` mit `zu: "toolu_A"`. **T6o** sind dieselben Zeilen ohne `id` und `zu`. Für die E2E-Probe wird T6 wie in R00234 „Ausgangslage“ als gz-Datei über `POST /api/aufgaben/1/transkripte` an #1 des Boards `fabrik` abgelegt.

### Abnahme der Karte (ADR-0041 N2 „Durchsetzung“), in Bubble 1 als Tests zuerst rot

- [ ] **AK 1 Vertauschte Ergebnisse**: Gegeben T6, wenn der Lauf ausgewertet wird, dann zeigt Schritt Nr 1 das Ergebnis Nr 4 mit 10 s, Fehler und Kürzel „Exit code 1“, und Schritt Nr 2 zeigt das Ergebnis Nr 3 mit 2 s ohne Fehler. „Längste Schritte“ nennt Nr 1 (10 s) vor Nr 2 (2 s). Gesamtdauer 10 s, Werkzeug 9 s (2 s vor Nr 3, 7 s vor Nr 4), Denken 1 s, beide „parallel“, 2 Werkzeugaufrufe, 1 Fehler erkannt. Alle Werte außer Paarung, Schrittdauer, Kürzel, Fehlermarke und „Längste Schritte“ sind dieselben wie bei T6o. **Heute rot**: Nr 1 zeigt 3 s, Nr 2 zeigt 9 s mit dem Fehler.
- [ ] **AK 2 Ohne Felder wie heute**: Gegeben T6o und T1 aus R00234, wenn der Lauf ausgewertet wird, dann ist die Auswertung `deepStrictEqual` zum Literal, das vor dem Fix am Stand `cddb15ac` aufgenommen wurde. Für T6o heißt das Nr 1 mit 3 s, Nr 2 mit 9 s und Fehler. Die Laufansicht zeigt für einen Lauf ohne Kennungen keinen Text, den sie vorher nicht zeigte.
- [ ] **AK 3 Altbestand** (Review-Punkt legacy-reviewer): Gegeben eine Kopie aller Transkripte unter `~/Projekte/Kanban-Boards/*/transkripte/*/*.jsonl.gz`, die kein `id` und kein `zu` tragen (bei der Zählung im ADR 47), wenn jede mit `zeilenLesen` und `laufAuswerten` am Stand `cddb15ac` und am Stand der Karte ausgewertet wird, dann sind beide Auswertungen `deepStrictEqual`. Die Transkripte mit Kennungen liest auch der Stand `cddb15ac` ohne unlesbare Zeile, denn unbekannte Schlüssel fallen dort weg. Gelesen wird nur in der Kopie.

### Grenzfälle der Paarung

- [ ] **AK 4 `zu` ohne passenden Aufruf**: Gegeben Aufruf Nr 1 mit `id: "a"` bei `t+0` und Ergebnis Nr 2 mit `zu: "x"` bei `t+2`, dann steht Nr 1 allein mit „–“ und „kein Ergebnis“, und Nr 2 steht allein mit „–“ und „kein Aufruf“. Die Warteschlange greift nicht. Gegeben Aufruf Nr 1 mit `id: "a"` bei `t+0`, Ergebnis Nr 2 mit `zu: "a"` bei `t+2` und Ergebnis Nr 3 mit `zu: "a"` bei `t+5`, dann zeigt Nr 1 das Ergebnis Nr 2 mit 2 s, und Nr 3 steht allein mit „kein Aufruf“.
- [ ] **AK 5 Doppelte `id`**: Gegeben Aufruf Nr 1 bei `t+0` und Aufruf Nr 2 bei `t+1`, beide mit `id: "a"`, dann Ergebnis Nr 3 mit `zu: "a"` bei `t+3` und Ergebnis Nr 4 ohne `zu` bei `t+6`. Dann zeigt Nr 1 das Ergebnis Nr 3 mit 3 s (die erste `id` gilt), und Nr 2 zeigt das Ergebnis Nr 4 mit 5 s (Nr 2 zählt als Aufruf ohne `id`).
- [ ] **AK 6 Gemischt**: Gegeben Aufruf Nr 1 mit `id: "a"` bei `t+0`, Aufruf Nr 2 ohne `id` bei `t+1`, Ergebnis Nr 3 ohne `zu` bei `t+3` und Ergebnis Nr 4 mit `zu: "a"` bei `t+10`, dann zeigt Nr 1 das Ergebnis Nr 4 mit 10 s, und Nr 2 zeigt das Ergebnis Nr 3 mit 2 s. Gegeben nur Aufruf Nr 1 mit `id: "a"` bei `t+0`, Ergebnis Nr 2 ohne `zu` bei `t+2` und Ergebnis Nr 3 mit `zu: "a"` bei `t+5`, dann zeigt Nr 1 das Ergebnis Nr 2 mit 2 s, und Nr 3 steht allein mit „kein Aufruf“ (in Kauf genommen, ADR-0041 N2).
- [ ] **AK 7 Falsch geformtes Feld und Vergleich**: Gegeben T6, in dem bei Nr 1 `id` je einmal ersetzt ist durch `7`, `""`, einen Text aus 257 Zeichen, `null` und `{}`, dann bleibt Nr 1 lesbar (keine Meldung „Zeile 1 des Transkripts ist nicht lesbar.“), `eintragPruefen` liefert `id: null`. Nr 1 zählt als Aufruf ohne `id` und steht ohne Ergebnis („kein Ergebnis“), Nr 2 zeigt das Ergebnis Nr 3 mit 2 s, und Nr 4 (`zu: "toolu_A"`) steht allein („kein Aufruf“), denn wo eine Kennung genannt ist, greift kein Rückfall. Ein Text aus genau 256 Zeichen paart wie `"toolu_A"`. Ebenso fällt `id` an einer Nachricht und `zu` an einem Aufruf weg. `"toolu_a"` und `" toolu_A"` paaren nicht mit `"toolu_A"`. `id: "__proto__"` und `id: "constructor"` paaren wie jede andere Kennung, und ein Ergebnis mit `zu: "constructor"` ohne Aufruf dieser Kennung steht allein.

### Aufwand, Ansicht, Bug-Vorlage

- [ ] **AK 8 Ohne quadratischen Anteil** (ADR-0041 N2 Punkt 2, Review-Punkt code-reviewer): Auf den offenen Aufrufen gibt es in der Paarung keine Schleife je Aufruf oder je Ergebnis und kein `shift`, `splice`, `indexOf`, `findIndex`, `filter` oder `forEach`. Kennungen sind nie Schlüssel eines einfachen Objekts. Das ist prüfbar per Lesen von `web/lauf.js`. **Beobachtung im Bericht, kein Gate**: 10.000 Aufrufe mit `id`, danach die Ergebnisse in umgekehrter Reihenfolge mit `zu` (die Obergrenze von 20.000 Zeilen, `LAUF_GRENZEN`), Ziel unter 100 ms. Dazu 5.000 Aufrufe in derselben Form, die höchstens etwa die halbe Zeit brauchen. Heute sind es 214–267 ms für 10.000 und 56–65 ms für 5.000.
- [ ] **AK 9 Im echten Programm**: Gegeben T6 an #1, wenn `sh` den Lauf in „Läufe“ mit „Ansehen“ öffnet, dann trägt die Zeile von `cat regeln` „10 s“, ist rot mit Warnzeichen und zeigt das Kürzel „Exit code 1“, und die Zeile von `cat entwickler` trägt „2 s“. „Längste Schritte“ nennt zuerst „10 s“, dann „2 s“, und „Fehler erkannt“ im Kopf steht auf 1. Mit `id: "<b>x</b>"` statt `"toolu_A"` (und passendem `zu`) erscheint die Kennung weder im Text der Seite noch im HTML der Insel, auch nicht maskiert (`&lt;b&gt;x`). **Heute rot** („3 s“ und „9 s“, der Fehler bei `cat entwickler`).
- [ ] **AK 10 Bug-Vorlage und Mutanten**: Die Tests aus AK 1 und AK 4–7 sind ohne Fix rot und mit Fix grün, AK 2 ist vor und nach dem Fix grün. Alle Tests aller Ebenen sind grün. In einer eigenen Kopie, nicht im Worktree, tötet je ein benannter Test diese Mutanten:
  - (m1) `zu` wird ignoriert, es gilt immer die Warteschlange → AK 1 rot
  - (m2) ein `zu` ohne Treffer fällt auf die Warteschlange zurück → AK 4 rot
  - (m3) bei doppelter `id` gilt die letzte → AK 5 rot
  - (m4) ein Ergebnis ohne `zu` nimmt den ältesten offenen Aufruf überhaupt, nicht zuerst den ältesten ohne `id` → AK 6 rot
  - (m5) ein falsch geformtes `id` macht die Zeile unlesbar → AK 7 rot
  - (m6) Kennungen werden vor dem Vergleich getrimmt oder klein geschrieben → AK 7 rot
  - (m7) die Zuordnung geht über ein einfaches Objekt statt über `Map` → AK 7 rot (`constructor`)
  - (m8) die Kennung wird in die Zeile gezeichnet → AK 9 rot

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.

## Nicht-Ziele

- `tokens`: Regel und Anzeige gehören zur Anforderung von #263 (PO Z. 569). Hier wird `tokens` nicht gelesen und fällt wie jeder unbekannte Schlüssel weg.
- Eine Marke oder ein Hinweis für Läufe ohne Kennungen (PO Z. 570).
- Das neue Ablegen der alten Transkripte (ADR-0041 N2 Punkt 4). Das ist ein Werkzeug des Directors und kein Teil von kanbanD.
- Server, OpenAPI und neue Wortlaute.

## Implementierungshinweise

- **„parallel“ über einen Zähler**: Jeder Aufruf merkt sich seine laufende Nummer `k` (der wievielte begonnene Aufruf er ist) und, ob bei seinem Beginn ein Aufruf offen war (Zähler der offenen > 0). Wird er gepaart, ist er auch dann parallel, wenn bis dahin mehr als `k` Aufrufe begonnen haben. Ein Aufruf, der bis zum Ende offen bleibt, ist parallel, sobald nach ihm ein weiterer begann. Das ist genau die Regel von heute, mit „offen“ nach der neuen Paarung, und ohne Felder bleibt die Marke deshalb unverändert (AK 2).
- Wird ein Aufruf mit `id` über den Rückfall gepaart (AK 6, zweiter Fall), trägt er die Marke „gepaart“, und die Suche über `zu` findet ihn danach nicht mehr.
- Die Köpfe der Warteschlangen überspringen gepaarte Aufrufe. Jeder Aufruf wird höchstens einmal übersprungen, also bleibt es O(n).
- Den Namen übernimmt das Ergebnis weiter vom Aufruf. Ein Ergebnis ohne Aufruf behält seinen eigenen `name`.
- Die Literale für AK 2 nimmt Bubble 1 am Stand `cddb15ac` auf, bevor `web/lauf.js` geändert wird.

## Offene Fragen

- keine, die den Bau aufhält.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ein Agent stellt zwei Aufrufe gleichzeitig, und das schnellere Ergebnis kommt zuerst zurück. Die Warteschlange gibt es dem ältesten Aufruf, und so trägt jeder Aufruf Dauer und Fehler des anderen. Wer abnimmt, sucht den Fehler dann am falschen Befehl und sieht den falschen Schritt als längsten. Der Erzeuger kennt die richtige Zuordnung schon und schreibt sie als `id` und `zu` ins Transkript, aber `eintragPruefen` wirft sie heute weg. Liest die Auswertung beide Felder und paart über sie, stimmt jede Schrittzeile, ohne dass etwas geraten wird. Der Rückfall auf die Warteschlange hält Läufe ohne Felder genau so, wie sie heute sind. Die Ursache sitzt in der Paarung und nicht im Zeichnen, deshalb ist die Paarung der Hebel: Die Zeichnung zeigt schon heute, was die Auswertung liefert.

## Notizen

- Priorität: Hoch (27 % der Läufe der Factory betroffen, ADR-0041 N2 „Belegt“)
- Betroffene Nutzer/Systeme: jeder, der in der Abnahme einen Lauf mit parallelen Aufrufen liest; Erzeuger mit Kennungen (Umwandler der Factory seit `89cb890`)
- Workaround: aufgeklappt den Text von Aufruf und Ergebnis vergleichen
- Grundlage: ADR-0041 N2 (`cddb15ac`), PO Z. 568–570, Messprobe und Zählung des architekt (`gemeinsam/scratchpad/arch-262/` der Factory)
- Verhältnis zu R00234: FA 6, erster Satz („Ein Ergebnis gehört zum ältesten offenen Aufruf“), gilt mit dieser Anforderung nur noch für Einträge ohne Kennung. R00234 selbst bleibt unverändert (abgeschlossen), seine Kriterien gelten für T1 ohne Felder weiter (AK 2).
- Zehn Kriterien (factory.md „Schlank arbeiten“). Weitere Grenzfälle der Paarung gehören dem entwickler.
