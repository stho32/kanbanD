---
id: R00235
status: Neu
datum: 2026-11-22
---

# R00235: Review-Seite — Dateien nach Art gruppiert, Code zuerst

## Beschreibung

Karte #252, Scheibe S1 nach ADR-0042 (`54bfe75a`) und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` (`92493baf`, PO Z. 539 „freigegeben mit Änderung“). Wer auf der Review-Seite einen Commit oder alle Änderungen einer Aufgabe prüft, sieht die Dateien in drei Gruppen in fester Reihenfolge: „Code“, „Tests“, „Doku und Planung“. Jeder Gruppenkopf nennt Zahl der Dateien und Zeilen. Geänderte und gelöschte Tests tragen einen Hinweis, jede Datei der Liste einen Größenbalken. Die Doku und große neue Dateien beginnen eingeklappt, bleiben in der Dateiliste aber vollständig und sind einen Klick entfernt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme liest, sieht zuerst, was am Programm geändert ist, und erkennt sofort, ob ein bestehender Test angepasst wurde.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Bei einem typischen Commit wie `b0bea5fd` aus #247 (8 Dateien) steht heute die Doku vor dem Code, weil die Reihenfolge der Pfade gilt. Der Mensch scrollt an Planung und Anforderungen vorbei, bevor er die eine geänderte Code-Datei sieht. Ein geänderter Test sieht aus wie ein neuer. Das Zeichenbudget wird an Doku verbraucht, und Code kann deshalb zu bleiben. Nach S1 steht der Code oben und offen. Ein geänderter Test ist als solcher markiert, und die Doku kostet nichts, bis man sie öffnet.

## Funktionale Anforderungen

- FA 1: Jede Datei gehört genau einer Art an: `test`, `doku` oder `code`, nach den festen Pfadregeln aus ADR-0042 Punkt 1 in dieser Prüfreihenfolge. Im Zweifel ist sie `code`.
- FA 2: Die Dateien stehen im Hauptteil und in der Dateiliste in den Gruppen „Code“, „Tests“, „Doku und Planung“, in dieser Reihenfolge. Innerhalb einer Gruppe gilt die Reihenfolge der API. Eine Gruppe ohne Datei entfällt.
- FA 3: Jeder Gruppenkopf trägt „<n> Dateien · +<a> −<b>“ (bei einer „1 Datei“), Zahlen mit Tausenderpunkt (PO Z. 537). Er klappt die Gruppe auf und zu.
- FA 4: Die Gruppe „Doku und Planung“ beginnt eingeklappt. Die Dateiliste führt ihre Dateien trotzdem alle (PO Z. 543).
- FA 5: Bei Dateien der Art `test` steht ein Hinweis in der Dateiliste und im Kopf der Datei: „bestehender Test geändert“ bei `M` oder `R` mit mindestens einer entfernten Zeile, „Test gelöscht“ bei `D`. Neue Tests und Tests ohne entfernte Zeile tragen keinen Hinweis (ADR-0042 Punkt 3, Wortlaut PO Z. 537).
- FA 6: Eine neue Datei (`A`) mit mehr als 500 hinzugefügten Zeilen beginnt eingeklappt. Sie zeigt „Neue Datei mit <n> Zeilen, beginnt eingeklappt.“ und „Änderungen anzeigen“, im Kopf „+<n> −0“ (PO Z. 536, 540 (a)).
- FA 7: Das Zeichenbudget (ADR-0033 Punkt 5, N1.4) folgt der gruppierten Reihenfolge. Doku-Dateien und große neue Dateien (FA 6) zählen nicht und unterbrechen die Folge nicht. „Die erste Datei immer“ gilt für die erste Datei mit `patch`, die nach diesen Regeln öffnen darf (ADR-0042 Punkt 1).
- FA 8: Ein Klick auf eine Datei der Dateiliste klappt ihre Gruppe und die Datei auf und springt hin, auch wenn eins davon zu war (PO Z. 543, Änderung 3 aus Z. 539).
- FA 9: Jede Datei der Liste trägt einen Größenbalken aus `plus` und `minus`, relativ zur größten Datei der Seite. Die Zahlen daneben tragen die Aussage (ADR-0042 Punkt 9).
- FA 10: „Alle Änderungen“ zeigt dieselben Gruppen je Abschnitt einer Anwendung. Folge-Dateien werden nach ihrem Pfad eingeteilt (ADR-0042 Punkt 1).

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nicht quer. Quer scrollt nur der Code einer Datei (PO Z. 539, Änderung 1, Teil S1). Gruppenköpfe sind mit der Tastatur bedienbar und sagen ihren Zustand an.
- Performance: Das Zeichenbudget von 10.000 Zeilen und die Blöcke zu 500 Zeilen bleiben (ADR-0042 Q2). Die Einteilung ist eine reine Funktion je Pfad und braucht keine Anfrage.
- Sicherheit: Es gibt keine neue Route, keinen neuen Prozess und kein neues Antwortfeld. S1 braucht `wurzel` nicht, das kommt mit #255. Pfade bleiben sichtbar gemacht (ADR-0033 Punkt 8).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `e2e/tests/review-hilfen.js`): Wegwerf-Repository R mit Anwendung `kd`, Mensch `sh`, Browser headless.

- **K-Art**: so geformt wie `b0bea5fd` aus #247. In der Reihenfolge der API stehen:
  - `Anforderungen/R00001.md` M +1 −0
  - `Dokumentation/Gelerntes.md` M +1 −0
  - `Schaetzungen/S00001.md` M +1 −0
  - `e2e/einheit/kontrast.test.js` M +2 −1
  - `e2e/einheit/sperrform.test.js` A +143
  - `e2e/tests/r00219-ansicht.spec.js` M +2 −2
  - `e2e/tests/r00229-sperrform.spec.js` A +150
  - `web/kd-app.css` M +2 −3
- **K-Rand**:
  - `e2e/tests/r00150-alte-leiste.spec.js` D −118
  - `e2e/einheit/sperre.test.js` → `e2e/einheit/sperrform-alt.test.js` R +3 −2
  - `tests/nur-neu.rs` M +4 −0
  - `tests/fixtures/genau-500.json` A +500
  - `tests/fixtures/genau-501.json` A +501
  - `src/grosse-antwort.json` A +1.240
  - `src/lang.rs` M +600 −0
- **K-Budget**: jede Datei ein Hunk mit 2.499 Zeilen und einem Kopf, also 2.500 gezeichnete Zeilen. Ausnahmen: `src/d.rs` ist A +600 (601 Zeilen), `tests/g.rs` hat 2.501 Zeilen. Reihenfolge der API:
  - `Dokumentation/a.md`
  - `src/b.rs`
  - `src/d.rs`
  - `src/e.rs`
  - `src/f.rs`
  - `tests/c.rs`
  - `tests/g.rs`
- **K-Doku**: nur `Dokumentation/x.md` und `README.md`, je M +1 −0.
- **Aufgabe #3**: Commits in `kd` und in einer zweiten Anwendung `wb`, insgesamt diese Dateien:
  - in `kd`: `src/a.rs` M, `tests/a_test.rs` A, `README.md` M
  - in `wb`: `b.js` M, `docs/b.md` A

Heute (Stand `92493baf`) stehen alle Dateien in der Reihenfolge der API ohne Gruppen. AK 1–8 sind deshalb rot.

### Einteilung und Reihenfolge

- [ ] **AK 1 Code zuerst:** Gegeben K-Art, wenn `sh` die Review-Seite des Commits öffnet, dann stehen im Hauptteil und in der Dateiliste die Gruppen in dieser Reihenfolge:
  - „Code“ mit „1 Datei · +2 −3“ (`web/kd-app.css`)
  - „Tests“ mit „4 Dateien · +297 −3“ in der Reihenfolge `kontrast.test.js`, `sperrform.test.js`, `r00219-ansicht.spec.js`, `r00229-sperrform.spec.js`. Rechnung: 2 + 143 + 2 + 150 = 297 und 1 + 2 = 3.
  - „Doku und Planung“ mit „3 Dateien · +3 −0“

  In der Einheitenprobe von `dateiArt` gilt: `src/foo_test.go`, `FooTests.cs` und `tests/fixtures/a.md` sind `test`, `README.md` ist `doku`, `Cargo.toml` und `.github/workflows/ci.yml` sind `code` (ADR-0042 „Durchsetzung“). Heute rot: Doku steht zuerst, Code zuletzt.
- [ ] **AK 2 Doku zu, Liste vollständig** (gestalter, PO Z. 543): Gegeben K-Art, wenn die Seite geladen ist, dann ist „Doku und Planung“ eingeklappt, ihre Dateien zeigen keinen Code, und die Dateiliste führt alle 8 Dateien, die drei Doku-Dateien mit Zahlen. Klickt `sh` auf den Gruppenkopf, so öffnet die Gruppe und zeigt ihre Dateien offen. Ein zweiter Klick schließt sie wieder. Der Gruppenkopf ist mit der Tastatur erreichbar und sagt „eingeklappt“ bzw. „ausgeklappt“ an (`aria-expanded`). „Alle aufklappen“ öffnet auch die Gruppen. Leerfall: Gegeben K-Doku, dann steht nur die Gruppe „Doku und Planung“ mit „2 Dateien · +2 −0“ da, eingeklappt, ohne Fehlermeldung. Heute rot.
- [ ] **AK 3 Klick in der Dateiliste klappt auf** (PO Z. 539 Änderung 3, Z. 543): Gegeben K-Art mit eingeklappter Doku, wenn `sh` in der Dateiliste `Dokumentation/Gelerntes.md` wählt, dann sind die Gruppe „Doku und Planung“ und die Datei aufgeklappt, der Kopf der Datei hat den Fokus, und seine Oberkante liegt im sichtbaren Bereich (`getBoundingClientRect`). Ebenso klappt die Wahl von `src/grosse-antwort.json` in K-Rand die eingeklappte Datei auf. Heute rot: Gruppen gibt es nicht.

### Hinweise und Größen

- [ ] **AK 4 Test-Hinweise** (Wortlaut PO Z. 537): Hinweise stehen in der Dateiliste und im Kopf der Datei, sonst nirgends.
  - Gegeben K-Art, dann tragen `kontrast.test.js` (−1) und `r00219-ansicht.spec.js` (−2) den Hinweis „bestehender Test geändert“. Die neuen Tests und `web/kd-app.css` (Code, −3) tragen keinen Hinweis.
  - Gegeben K-Rand, dann trägt `r00150-alte-leiste.spec.js` „Test gelöscht“ und die umbenannte `sperrform-alt.test.js` (−2) „bestehender Test geändert“. `tests/nur-neu.rs` (M, −0) trägt keinen Hinweis, das ist die Grenze zwischen 0 und 1 entfernter Zeile.

  Heute rot.
- [ ] **AK 5 Große neue Datei, Grenze 500/501** (gestalter, PO Z. 536, 540 (a)): Gegeben K-Rand, wenn die Seite geladen ist:
  - `genau-500.json` (A +500) ist offen.
  - `genau-501.json` ist eingeklappt mit dem Satz „Neue Datei mit 501 Zeilen, beginnt eingeklappt.“, dem Knopf „Änderungen anzeigen“ und im Kopf „+501 −0“.
  - `src/grosse-antwort.json` zeigt „Neue Datei mit 1.240 Zeilen, beginnt eingeklappt.“.
  - `src/lang.rs` (M +600) ist offen, denn die Schwelle gilt nur für neue Dateien.

  „Änderungen anzeigen“ zeigt die 501 Zeilen ohne Anfrage an den Server. Heute rot.
- [ ] **AK 6 Zeichenbudget nach Gruppen** (ADR-0042 Punkt 1, ADR-0033 Punkt 5): Gegeben K-Budget, wenn die Seite geladen ist, dann sind `src/b.rs`, `src/e.rs`, `src/f.rs` und `tests/c.rs` offen, `src/d.rs`, `tests/g.rs` und `Dokumentation/a.md` zu.
  - Rechnung: b 2.500 → `d` zählt nicht (A +600 > 500) → e 5.000 → f 7.500 → c 10.000 ≤ 10.000 offen → g 12.501 > 10.000 zu, danach öffnet keine mehr → `a` zählt als Doku nicht.
  - Heute (Reihenfolge der API, ohne Regeln) sind a, b, d und e offen: 2.500, 5.000, 5.601, 8.101; f käme auf 10.601. Deshalb rot.
  - Einheitenprobe: Eine Doku-Datei zu 11.000 Zeilen an erster Stelle, danach Code zu 10.500 Zeilen. Dann öffnet der Code („die erste Datei, die öffnen darf“), und die Doku bleibt zu.
  - Dieselben Regeln gelten seitenweit über die Abschnitte von „Alle Änderungen“ (ADR-0033 N1.4).
- [ ] **AK 7 Größenbalken** (ADR-0042 Punkt 9): Gegeben K-Art, dann trägt jede Datei der Liste einen Balken mit einem Teil für `+` und einem für `−`. Jeder Teil ist so lang wie seine Zahl, geteilt durch die größte Summe `plus + minus` der Seite, mal die volle Länge L, auf ±1 px genau. Jede Zahl über 0 ergibt mindestens 1 px, eine 0 ergibt keinen Teil.
  - Rechnung: `r00229-sperrform.spec.js` (150) hat die volle Länge L.
  - `sperrform.test.js` (143) hat 143/150 · L.
  - `web/kd-app.css` hat je Teil mindestens 1 px, denn bei L = 44 px ergeben 2/150 · L = 0,59 px und 3/150 · L = 0,88 px.

  Der Balken wird nicht vorgelesen, die Zahlen daneben schon. Heute rot.

### Alle Änderungen, Breite, Bestand

- [ ] **AK 8 Alle Änderungen gruppiert** (ADR-0042 Punkt 1): Gegeben Aufgabe #3, wenn `sh` „Alle Änderungen“ öffnet, dann zeigt der Abschnitt `kd` „Code“ (`src/a.rs`), „Tests“ (`tests/a_test.rs`) und eingeklappt „Doku und Planung“ (`README.md`). Der Abschnitt `wb` zeigt „Code“ (`b.js`) und eingeklappt „Doku und Planung“ (`docs/b.md`), aber keine Gruppe „Tests“. Die Dateiliste führt je Abschnitt alle Dateien. Ein Klick auf `docs/b.md` in der Liste klappt Gruppe und Datei in `wb` auf wie in AK 3. In der Einheitenprobe wird eine Folge-Datei `docs/x.md` als `doku` eingeteilt. Heute rot.
- [ ] **AK 9 320 px ohne Querscrollen, beide Themen** (PO Z. 539 Änderung 1, Teil S1): Gegeben K-Art und K-Rand, Breiten 320, 414, 641, 980 und 1280 px, Themen hell und dunkel.
  - Die Seite scrollt nicht quer: `document.documentElement.scrollWidth ≤ clientWidth`.
  - Gruppenköpfe, Zahlen, Test-Hinweise, der Satz der großen neuen Datei und die Größenbalken liegen ganz innerhalb der Breite: rechte Kante ≤ `clientWidth`, kein Text abgeschnitten.
  - Quer scrollt nur der Code-Bereich einer Datei.
  - Die Schrift des Test-Hinweises steht in hell und dunkel ≥ 4,5:1 gegen ihre Fläche (`kontrastMessen`).
  - Der Fokusring eines Gruppenkopfs ist sichtbar.

  Heute grün ist nur der Bestand ohne Gruppen, als Wächter in `r00207-review-seite.spec.js:900–908` und `r00210-alle-aenderungen.spec.js:728–737`. Die neuen Teile sind rot, weil es sie nicht gibt.
- [ ] **AK 10 Bestand bleibt, Mutanten:** Was nicht S1 ist, bleibt wie in B2/B3: Umschalter „Alle Änderungen | Ein Commit“, Commit-Kopf, Zweig-Chips, Blättern, Syntaxfarben, „Zu groß zum Anzeigen“ und Nachladen (D0009 Bild 3). Es gibt keine Commit-Leiste, kein „Gesehen“, keine Knöpfe je Datei und keine Wortmarke.
  - Bestehende Tests behalten ihre Erwartungen. Hat eine Ausgangslage Code nur zufällig `.txt` oder `.md` genannt und wird ihre Datei dadurch zu `doku`, bekommt sie eine Endung der Art `code` ohne Farbe (`.dat`). Prüft ein Test Markdown selbst (`r00217` `feindlich.md`), klappt er die Gruppe zuerst auf. Jede so geänderte Ausgangslage und jede geänderte Erwartung nennt der entwickler im Bericht mit Grund.
  - Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie:
    - (m1) `dateiArt` prüft `doku` vor `test` → AK 1 rot (`tests/fixtures/a.md`)
    - (m2) Doku zählt ins Budget → AK 6 rot
    - (m3) Schwelle `≥ 500` statt `> 500` → AK 5 rot
    - (m4) Schwelle gilt auch für `M` → AK 5 rot (`src/lang.rs`)
    - (m5) Test-Hinweis ohne Bedingung `minus > 0` → AK 4 rot (`tests/nur-neu.rs`)
    - (m6) die Dateiliste öffnet nur die Datei, nicht die Gruppe → AK 3 rot
    - (m7) Budget weiter in der Reihenfolge der API → AK 6 rot
    - (m8) Einzahl fehlt („1 Dateien“) → AK 1 rot

## Betroffene Verzeichnisstruktur

- Oberfläche der Review-Seite: `web/diff.js` (Ein Commit, Plan, Zeichnen) und `web/gesamt.js` (Alle Änderungen). Die reinen Funktionen `dateiArt` und die Gruppierung kommen in ein neues `web/review-uebersicht.js` oder in `web/diff.js`, das wählt der entwickler (ADR-0042 Punkt 1). Ein neues Modul gehört in `dateien!` (`src/web/statisch.rs`).
- Ereignisse: `web/app.js` (`review-klappe`, `review-datei`, `review-alle`, `aufklappPlan` bei `:1373`, `aufklappPlanSeite` bei `:1625`).
- Stil: `web/kd-app.css`, nur Tokens. Die Zeichnung nennt `--kd-wbs-warn-bg`/`-ink`, im Programm heißen dieselben Werte `--kd-status-warn-bg`/`-ink` (`web/kd-tokens.css:45`, `:92`).
- Tests: `e2e/einheit/` (Node) und `e2e/tests/r00235-review-gruppen.spec.js`. Die Ausgangslage kommt in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1214 Art, Gruppen, Köpfe, Test-Hinweis, rein**: Pfad → `code | test | doku` (ADR-0042 Punkt 1). Dateien → Gruppen `{art, indizes, n, plus, minus}` in der Reihenfolge Code, Tests, Doku. Kopftext mit Einzahl und Tausenderpunkt (`tausender`). Datei → Hinweis oder keiner.
2. **B1215 Bestehende Ausgangslagen umstellen**, bevor sich das Zeichnen ändert, damit das Gate grün bleibt (AK 10).
3. **B1216 Aufklappplan**: `planZeilen`/`aufklappPlanSeite` über die gruppierte Folge. `doku` und `A` mit `plus > 500` ergeben `null` (zählen nicht, unterbrechen nicht). `erste` gilt für die erste Datei, die öffnen darf.
4. **B1217 Ein Commit zeichnen**: Gruppenköpfe als Knopf mit `aria-expanded`, gruppierte Liste mit Hinweis und Balken, Satz der großen neuen Datei mit „Änderungen anzeigen“. Die Indizes der API bleiben die Kennung der Datei (`data-arg`, `rv-dk<i>`), nur die Folge ändert sich.
5. **B1218 Alle Änderungen zeichnen**: dieselben Gruppen je Abschnitt, Folge-Dateien nach dem Pfad.
6. **B1219 Dateiliste und „Alle aufklappen“**: `review-datei` öffnet die Gruppe, dann die Datei, setzt den Fokus und scrollt. `review-alle` öffnet auch die Gruppen.
7. **B1220 Breite, Themen, Kontrast**: messen und nachziehen (AK 9). Die Vorprüfung macht der ux-reviewer.
8. **B1221 Probe im echten Programm**, dann Mutanten m1–m8, Gate und Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht`. Für S1 gelten Bild 3 („Stand nach #252 allein“) und Bild 7 a)–e) (Ränder), dazu die Notiz „Was die Zeichnung festlegt“, Absätze S1. Verbindlich sind die Wortlaute aus PO Z. 537 und 540 (a) und die Änderungen 1 und 3 aus Z. 539. Kachelrand (Z. 542) und Sprungzeile (Z. 545) gehören zu #256 und #255.

## Tests

- **Unit** (Node, rein): `dateiArt` (alle Pfade aus AK 1, Groß- und Kleinschreibung), Gruppen und Kopftext (0, 1, 2 Dateien, Tausenderpunkt), Hinweis (A, M −0, M −1, R −2, D), Plan (K-Budget, Doku zuerst mit 11.000 Zeilen, 500/501, seitenweit über zwei Abschnitte), Balkenmaße.
- **Integration**: keine neue, der Server bleibt unverändert.
- **E2E**: AK 1–9 im gestarteten Programm gegen echtes Git. Warten nur auf ein sichtbares Signal, nie auf Text, der vor und nach der Aktion gleich dasteht. Lage mit `getBoundingClientRect`. Kontrast mit `kontrastMessen` in beiden Themen.

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen), R00217 (I0207 Syntaxfarben, grün), ADR-0042, ADR-0033
- Blockiert: #255 (S4 Pfad, VS Code, Patch), #256 (S2 Commit-Leiste), #257 (S3 Gesehen), #258 (S5 Wortmarke), #259 (S6 Umbrechen), #260 (S7 Nebeneinander), alle mit `braucht:252` (PO Z. 538)

## Offene Fragen

- keine. Die einzige Frage an den Betreiber (Z. 533, „Diff in VS Code“) betrifft #255 und blockiert nichts.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Abnahme von #247: Im Commit `b0bea5fd` stand die Planung vor der einzigen Code-Datei, und zwei geänderte Tests sahen aus wie neue. Ordnet die Seite die Dateien nach ihrer Art, steht der Code oben und offen. Der Prüfer liest also zuerst, was das Programm ändert. Markiert die Seite einen bestehenden Test, der Zeilen verliert, fällt eine aufgeweichte Erwartung sofort auf, ohne dass der Prüfer Dateien vergleichen muss. Zählen Doku und große neue Dateien nicht ins Budget, öffnen die Code-Dateien, die vorher hinter Planungstext zu blieben. Der Hebel ist die Reihenfolge und nicht ein Filter: Nichts wird verborgen, die Liste bleibt vollständig, und ein Klick öffnet jede Datei.

## Notizen

- Verworfene Alternativen: ADR-0042 A2 (Regeln je Anwendung im Register) und A3 (Art am Server). Beide sind dort begründet.
- Bewusst nicht in S1: Pfad, VS Code und Patch (#255), Commit-Leiste und Kopf samt Titelumbruch bei 320 px und Kachelrand (#256), Gesehen (#257), Wortmarke (#258), Umbrechen (#259), Nebeneinander (#260).
- Entscheidung des planers (Bild 7 e): Öffnet der Mensch die Gruppe „Doku und Planung“, zeigen sich ihre Dateien offen, denn was er selbst aufklappt, wird gezeichnet (ADR-0033 Punkt 5). Gelöschte Dateien und neue Dateien über 500 Zeilen bleiben darin zu.
