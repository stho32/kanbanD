---
id: R00225
status: Erledigt
datum: 2026-11-21
ursprung: Bug-Report
ursprungslauf: R00208
---

# R00225: Behebung — Gesamt-Diff: Folge und „fremde Commits“ ohne fremden Commit

## Beschreibung

Befund aus dem Entwicklertest #229 (2026-11-20), Karte #234. Eine Aufgabe ändert `d/x` in K1 (aus der Datei wird das Verzeichnis `d/x/inner`) und nimmt das in K2 zurück (wieder die Datei `d/x` mit dem Inhalt der Basis). Zwischen K1 und K2 liegt **kein** fremder Commit. Trotzdem zeigt die Review-Seite „Alle Änderungen“ ([R00210](R00210-alle-aenderungen-der-aufgabe-in-der-review-seite.md)) `d/x` als „Folge · 2 Commits“ mit dem Satz „Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert …“. Der Satz im Abschnitt sagt dagegen „… liegen 0 fremde Commits …“.

**Erwartet** (Karte #234, R00210, PO Z. 437–444): Den Satz über fremde Commits gibt es nur, wenn mindestens ein fremder Commit zwischen den Schritten der Aufgabe liegt. Eine Datei, die die Aufgabe ändert und selbst zurücknimmt, erscheint im Gesamtbild nicht.

Die Ursache liegt im Vertrag der API ([R00208](R00208-gesamt-diff-der-karte-per-api-lesen.md)), nicht in der Oberfläche. Die API meldet `d/x` als Folge-Eintrag mit `fremd_dazwischen {commits: 0, dateien: 1}`, und `web/gesamt.js` gibt das treu wieder (R00210 FA 6). Nach R00208 FA 5 ist eine Datei Folge, weil ein fremder Commit sie berührt. Hier berührt sie keiner. Das ist **falsch gebaut**, kein neuer Umfang. Die Entscheidung steht in [ADR-0032 Nachtrag N8](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) (architekt, Lauf 234-architekt-1). R00208 FA 7 ist danach nachgezogen (Notiz dort). Die Oberfläche bleibt unverändert (N8.3 Punkt 5).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112). Eine Aussage über fremde Arbeit, die es nicht gibt, führt den Reviewer in die Irre.

## Ursachenanalyse

### Root Cause

Belegt am Stand von `main` `782ed9fe`. Git 2.48.1 hat es nachgestellt (N8.1): `git diff -M basis letzter` liefert nur `R100 b → bb` und `M g`. `d/x` ist **netto unverändert** und steht in keinem Netto-Eintrag. Die Kartenschritte tragen `D d/x` (K1) und `A d/x` (K2).

- `src/modell/gesamt_diff.rs:254–258` (`Einteilung::folgepfade`): Folge sind alle Kartenpfade ohne Netto-Eintrag. Ausgenommen ist nur der Zwischenname einer gedeckten, unbelasteten Gruppe. Ob der Pfad belastet ist, prüft die Funktion nicht. Ein netto unveränderter Pfad wird darum Folge.
- `src/dienst/gesamt_diff.rs:308–310`: `FremdDazwischen { commits: fremde, … }` steht, sobald es einen Folge-Eintrag gibt, auch bei `fremde == 0`.
- `src/dienst/gesamt_diff.rs:179`: `fremde` zählt Merges der Karte nicht mit, obwohl sie nach N6.5 zu `D_fremd` beitragen. Das ist der zweite Weg zu „0 fremde Commits“: Fall M unten.
- `web/gesamt.js:44, :73, :249`: Die Oberfläche setzt `FOLGE_SATZ_FREMD` an jede Folge-Datei ohne `ganz_als_folge`. Bei `commits` 0 baut `fremdSatz` (`:51–56`) „liegen 0 fremde Commits“. Das folgt dem Vertrag und ist richtig.

Ausgeschlossen: „nie fremd“, denn `d/x` hat keine fremde Zeile. Ebenso ausgeschlossen sind die Folge-Einträge belasteter Pfade (R00208 #2 unverändert richtig) und `ganz_als_folge`, der eigene Sätze hat.

Der Defekt ist eingetreten, nicht latent: Der Entwicklertest #229 hat ihn im echten Programm gesehen. Schaden: Der Reviewer liest eine falsche Aussage über fremde Arbeit, und eine Datei ohne Änderung steht im Gesamtbild. Ein Agent bekommt über die API dieselbe falsche Aussage (`fremd_dazwischen {commits: 0}`, `format=patch`).

### Betroffene Komponenten

- `src/modell/gesamt_diff.rs`: `Einteilung::folgepfade` (A00006 Modell)
- `src/dienst/gesamt_diff.rs`: Folgeplan, Hinweis `fremd_dazwischen`, `datei=` und `format=patch` (A00004 Dienste)
- `README.md` „Für Agenten“, Abschnitt Gesamt-Diff (Satz zu `datei=`)
- Tests: neue Dateien `tests/akzeptanz_r00225.rs` und `e2e/tests/r00225-ohne-fremde.spec.js`, dazu Modultests in `src/modell/gesamt_diff.rs`
- **Nicht** betroffen: `web/gesamt.js` (N8.3 Punkt 5)

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0032 N8.3, Option V2 „netto unverändert erscheint nirgends“:

1. **Folge-Pfade** sind die Kartenpfade ohne Netto-Eintrag, die eine von zwei Bedingungen erfüllen. (a) Sie sind **belastet**, liegen also in `D_fremd` oder in einer belasteten Gruppe (N7.1). (b) Oder sie stehen in einem Eintrag der Netto-Liste, den `Einteilung::netto` verworfen hat: abweichende Paarung mit einem belasteten Pfad (N7.10) oder ein Pfad außerhalb von `D_karte`. Jeder andere Kartenpfad ohne Netto-Eintrag ist netto unverändert oder ein Zwischenname. Er **erscheint nirgends**: nicht in `dateien`, nicht in `format=patch`, nicht in `fremd_dazwischen.dateien`. Die Zwischennamen-Regel aus N7.1 geht darin auf.
2. **Abgeschnittene Netto-Liste** (`netto_vollstaendig` falsch): Unbelastete Pfade sind netto, nicht Folge, wie heute ohne fremde Pfade (B3). Sie zählen über `gesamt` in `dateien_gekappt`. Kein Pfad verschwindet ohne Zählung.
3. **`fremd_dazwischen`** steht nur, wenn zwei Bedingungen gelten: `commits ≥ 1` und mindestens ein Folge-Eintrag (oder einer, der am Schnitt verworfen wurde). `dateien` zählt genau diese Einträge. Belastet nur ein Merge der Karte einen Pfad, und liegt kein fremder Commit in der Spanne, bleibt der Pfad Folge, aber ohne `fremd_dazwischen`. Den Grund nennt der vorhandene Hinweis `merge_ausgelassen`.
4. **`datei=<netto unveränderter Pfad>`** ergibt 404 `{fehler}`, wie heute für einen Zwischennamen.
5. Die Oberfläche bleibt unverändert. Mit 1–3 ist jede Folge-Datei ohne `ganz_als_folge` belastet, und `fremdSatz` bekommt nie `commits: 0`.

Akzeptierte Schwäche (N8.3): Arbeit, die die Aufgabe selbst zurücknimmt, sieht man im Gesamtbild nicht. Sie bleibt in der Commit-Liste und über „Ein Commit“ lesbar.

### Alternative Ansätze

Verworfen nach N8.2:
- **V1, nur Oberfläche** (Satz nach `commits > 0` wählen): Im gemischten Fall N+F bekäme `d/x` weiter den Satz, und `dateien` zählte ihn mit. Die API behielte ihre falsche Aussage für jeden anderen Leser.
- **V3, Grund je Folge-Eintrag**: Das bringt ein neues Feld, einen neuen Wortlaut und eine neue Zeichnung. Eine Folge ohne fremde Arbeit widerspricht dem Sinn der Folge (N6.3).
- **V4, synthetischer Netto-Eintrag 0/0**: Git liefert keinen solchen Eintrag. Er bräche „bytegleich zu `git diff`“ (`format=patch`).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm, `tests/akzeptanz_r00225.rs`. Helfer und Ausgangslage wie in `tests/akzeptanz_r00208.rs`. Die Fälle N, N+F und M aus AK 1–3 kommen als erste Tests und sind **rot ohne Fix**. Fall N ergibt heute einen Folge-Eintrag `d/x` und `fremd_dazwischen {commits 0, dateien 1}`. Die gemessenen Werte stehen in der Commit-Nachricht der ersten Bubble. Den Satz auf der Seite prüft zusätzlich ein Playwright-Test (`e2e/tests/r00225-ohne-fremde.spec.js`), Ausgangslage nach `gemeinsam/scratchpad/etest-229/ui_board.py` der Factory.

### Code-Extraktion für isoliertes Testing

Nicht nötig. `Einteilung::folgepfade` ist rein. Ein Modultest deckt die Tabelle ab: belastet, unbelastet ohne Netto-Eintrag, Zwischenname, Pfad aus einem verworfenen Netto-Eintrag.

### Regressionstests

Ohne geänderte Erwartung grün:
- `tests/akzeptanz_r00208.rs`, darin `b2_rest_zwilling_ausserhalb_der_netto_eintraege`, `b2_typwechsel_mit_gleichem_blob` und `b3_namen_der_kartencommits_ueber_vier_mb`. Bei `datei_auf_jeden_pfad` lassen die `weitere`-Pfade schon heute 200 oder 404 zu (`:712–715`).
- `tests/lastprobe_r00208.rs`, `tests/akzeptanz_r00213.rs`, `tests/akzeptanz_r00206.rs`
- `e2e/tests/r00210-alle-aenderungen.spec.js`, `e2e/einheit/gesamt.test.js`

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API wie R00208; Arbeits-Repository R, Anwendung `kd` als Standardanwendung; Browser headless, Mensch `sh`). Auf `main` von R liegt der Commit **A0** mit den Dateien `b`, `d/x` und `g`.
- **Fall N** (netto unverändert, ohne fremden Commit): **K1** löscht `b` und die Datei `d/x`, legt das Verzeichnis `d/x` mit `d/x/inner` (Inhalt von `b` aus A0) an und ändert eine Zeile von `g`. **K2** benennt `d/x/inner` in `bb` um und legt `d/x` wieder mit dem Inhalt aus A0 an. Die Aufgabe trägt `kd:<K1>`, `kd:<K2>`. **Rechenbeispiel:** `git diff -M50% <A0> <K2>` liefert genau `R100 b → bb` und `M g` (N8.1). Der Gesamt-Diff hat also 2 Einträge, `bb` und `g`, beide netto.
- **Fall N+F** (gemischt): wie N, dazu zwischen K1 und K2 ein fremder Commit **F** (nicht an der Aufgabe), der eine andere Zeile von `g` auf `FREMD-g` ändert. **Rechenbeispiel:** `g` ist belastet und damit Folge mit dem Schritt K1. `bb` bleibt netto. `d/x` ist unbelastet und netto unverändert, erscheint also nirgends. Ergebnis: 2 Einträge, `fremd_dazwischen {commits 1, dateien 1}`.
- **Fall F** (Gegenprobe): R00208 #2 (K1, fremd F, K2 an `a.txt`).
- **Fall M** (nur Merge der Karte): **N1** ändert Zeile 2 von `n.txt`. Danach wird auf `main` mit `--no-ff` ein Seitenzweig gemergt (Merge **MK**), dessen Commit Zeile 8 von `n.txt` auf `FREMD-8` ändert. Danach ändert **N2** Zeile 11 von `n.txt`. Die Aufgabe trägt `kd:<N1>`, `kd:<MK>`, `kd:<N2>`. Auf der Erst-Eltern-Linie liegt kein fremder Commit.

### Bug behoben

- [x] **AK 1 Fall N, API (Abnahme-Probe N8.4, wörtlich):** `GET /api/aufgaben/<nr>/diff` hat keinen Eintrag `d/x` (auch nicht `d/x/inner`), genau die Einträge `bb` und `g`, beide netto, und keinen Hinweis `fremd_dazwischen`. `format=patch` enthält keine Zeile mit `d/x` und keine Zeile `# kanbanD: fremd_dazwischen`. `…&datei=d/x` ergibt 404 mit `{fehler}`. Heute: Folge-Eintrag `d/x` mit `fremd_dazwischen {commits 0, dateien 1}`.
- [x] **AK 2 Fall N+F, API (N8.4):** `g` ist Folge mit dem Schritt K1, `bb` ist netto, `d/x` steht nirgends (auch nicht in `format=patch`), und `hinweise` enthält `{art "fremd_dazwischen", commits 1, dateien 1}`. `…&datei=d/x` ergibt 404, `…&datei=g` ergibt 200 mit dem Folge-Eintrag. Die Probe „nie fremd“ aus R00208 ist erfüllt: keine `+`/`-`-Zeile mit `FREMD`.
- [x] **AK 3 Fall M, API (N8.4):** `n.txt` ist Folge mit den Schritten N1 und N2. `hinweise` enthält `{art "merge_ausgelassen", verweis "kd:<MK>"}` und **keinen** Hinweis `fremd_dazwischen`. Keine Antwort enthält `fremd_dazwischen` mit `commits` 0. Heute: `fremd_dazwischen {commits 0, dateien 1}`.
- [x] **AK 4 Fall F, Gegenprobe:** R00208 #2 antwortet unverändert: `a.txt` Folge, `fremd_dazwischen {commits 1, dateien 1}`, `k.txt` netto.
- [x] **AK 5 Seite „Alle Änderungen“ (Abnahme-Probe der Karte #234, wörtlich: „Aufgabe mit zwei eigenen Commits an `d/x` ohne fremden Commit dazwischen. Auf „Alle Änderungen“ kommt der Satz nicht vor. Mit einem fremden Commit dazwischen steht er da.“):** Die Aufgaben der Fälle N, N+F und F werden je über `#/aufgaben/aufgabe/<nr>/review` geöffnet.
  - Fall N: Der Abschnitt zeigt „2 Commits · 2 Dateien“, keine Datei `d/x`, keinen Satz, der mit „Zwischen den Commits der Aufgabe“ beginnt, und nirgends „Fremde Commits haben diese Datei“. Heute: `d/x` mit „Folge · 2 Commits“ und beiden Sätzen, einer davon mit „0 fremde Commits“.
  - Fall N+F: Wörtlich steht „Zwischen den Commits der Aufgabe liegt 1 fremder Commit. Er berührt Dateien der Aufgabe; 1 Datei steht deshalb als Folge der Schritte der Aufgabe. Die Änderungen des fremden Commits sind nicht zu sehen.“ Aufgeklappt steht „Fremde Commits haben diese Datei …“ genau einmal, und zwar an `g`. `d/x` steht nicht da.
  - Fall F: Die Sätze stehen wie in R00210 AK 2 und AK 3.
- [x] **AK 6 Abgeschnittene Netto-Liste (N8.3 Punkt 2, Pre-Mortem j):** Ist die Netto-Liste abgeschnitten (`netto_vollstaendig` falsch), werden unbelastete Kartenpfade nicht zu Folge. Sie verschwinden auch nicht ohne Zählung: Sie zählen über `gesamt` in `dateien_gekappt`. Der Test läuft mit einer Karte über der Kappe von 2.000 Einträgen und einem fremden Commit an einer anderen Datei der Karte, oder mit verkleinerter Grenze wie R00213 AK 4. `gesamt` ist größer oder gleich der Zahl der netto geänderten Dateien der Karte.
- [x] **AK 7 Mutanten (N8.4):** Jeder Mutant wird von einem benannten Test getötet.
  - (m1) Unbelastete Pfade ohne Netto-Eintrag bleiben Folge → AK 1 rot.
  - (m2) Alle unbelasteten Pfade fallen heraus, auch die aus verworfenen Netto-Einträgen → `b2_rest_zwilling_ausserhalb_der_netto_eintraege` rot.
  - (m3) `fremd_dazwischen` ohne die Bedingung `commits ≥ 1` → AK 3 rot.
  - (m4) Bei abgeschnittener Netto-Liste fallen unbelastete Pfade ohne Zählung weg → AK 6 rot.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [x] **AK 8 README „Für Agenten“:** Der Abschnitt Gesamt-Diff sagt in einem Satz, dass eine Datei, die die Karte ändert und selbst zurücknimmt, nicht erscheint und dass `datei=` auf sie 404 ergibt. Außerdem sagt er, dass `fremd_dazwischen` nur mit mindestens einem fremden Commit steht.
- [x] **AK 9 Bug-Vorlage:** Die Reproduktionstests (AK 1–3) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt im Szenario der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün, darin die Regressionstests oben ohne geänderte Erwartung, die Lastprobe von R00208 (p95 unter 500 ms) und die Prozessgrenze (höchstens 15 Git-Prozesse).

## Implementierungshinweise

- Die Bedingung (b) aus Lösung Punkt 1 stammt aus dem Netto-Lauf: Die Pfade der Einträge, die `Einteilung::netto` verwirft, bleiben Folge-Kandidaten, auch wenn sie unbelastet sind. Ohne diese Menge kippt m2.
- `fremde` (`:179`) bleibt unverändert, Merges der Karte zählen weiter nicht. Geändert wird nur die Bedingung, unter der der Hinweis steht.
- Ein netto unveränderter Pfad bekommt bei `datei=` den 404-Text, den heute ein Zwischenname bekommt (`datei_fehlt`, `:651`). Den Wortlaut ändert #234 nur nach einer Entscheidung des product-owner, siehe „Offene Fragen“.
- Kein zusätzlicher Git-Prozess: Belastung und verworfene Netto-Einträge sind nach dem Namens- und dem Netto-Lauf bekannt.

## Offene Fragen

Keine hält den Bau auf. An den product-owner (über den Director), je mit Empfehlung:

1. **404-Text für einen netto unveränderten Pfad.** Heute lautet er „die Datei steht in keinem Kartencommit von #<nr> — datei= nennt einen Pfad der Karte, buchstäblich“. Für `d/x` und für Zwischennamen stimmt das nicht, denn der Pfad steht in Kartencommits. Empfehlung: ein eigener Text für diesen Fall, etwa „die Datei hat im Gesamtbild von #<nr> keine Änderung (die Aufgabe nimmt sie selbst zurück) — die Schritte mit commit= und datei= laden“. Dann bekommt die Karte das Label `text`. Bis zur Antwort gilt der heutige Text (N8.3 Punkt 4), und AK 1 und AK 2 prüfen nur Status 404 und `{fehler}`.
2. **Satz an einer Folge-Datei, die nur ein Merge der Karte belastet (Fall M).** Nach dem Fix steht dort weiter „Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert …“. Der Abschnitt hat dann aber keinen Satz über fremde Commits mehr, nur „<MK> ist ein Merge und in diesem Gesamtbild ausgelassen.“ Die ADR stellt das ausdrücklich außerhalb von #234 (N8.3 Punkt 3). Empfehlung: nicht in #234. Der Satz ist sachlich gedeckt, weil der Merge fremde Änderungen in die Datei gebracht hat. Eine eigene Folgekarte lohnt erst, wenn ein Reviewer darüber stolpert.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Die Aufgabe nimmt eine eigene Änderung an `d/x` zurück. `d/x` hat dann keinen Netto-Eintrag und wird nach der heutigen Regel Folge (X). Zählt ein Pfad ohne Netto-Eintrag nur dann als Folge, wenn ein fremder Commit oder ein Merge ihn belastet oder wenn sein Netto-Eintrag verworfen wurde, fällt `d/x` aus dem Gesamtbild. Netto ist die Datei ja leer, wie in GitHubs „Files changed“ (Y). Ohne Folge-Eintrag und mit der Bedingung `commits ≥ 1` meldet die API kein `fremd_dazwischen` mit 0 Commits mehr. Die Seite zeigt keinen Satz über fremde Commits, die es nicht gibt, und muss dafür nicht geändert werden (Z). Der Hebel sitzt im Vertrag statt in der Oberfläche. So stimmt die Aussage auch für Agenten und `format=patch`, und auch im gemischten Fall N+F, den ein Fix nur an der Oberfläche falsch ließe.

## Notizen

- Priorität: Mittel. Die Aussage ist falsch, aber es erscheint kein fremder Inhalt, und keine Antwort fällt aus.
- Betroffene Nutzer und Systeme: Reviewer auf der Review-Seite „Alle Änderungen“ (R00210), Reviewer-Agenten über den Gesamt-Diff (R00208). Ein Agenten-Client der Factory, der `fremd_dazwischen` liest, ist nicht bekannt (`werkzeuge/` geprüft 2026-11-21).
- Workaround: die Commit-Liste und „Ein Commit“ lesen.
- Heimat: I0215 unter D0009, eigene Interaction statt Bubble an I0198 oder I0200 (Lehre #17/#80).
- Proben: `gemeinsam/scratchpad/etest-229/ui_board.py` (Ausgangslage der Seite); die Nachstellung des architekten (`gemeinsam/scratchpad/arch-234/r`) ist entfernt. Beide liegen im Factory-Repo.
