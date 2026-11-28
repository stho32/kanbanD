---
id: R00271
status: Erledigt
datum: 2026-11-27
ursprung: Bug-Report
ursprungslauf: R00248
---

# R00271: Behebung — der Leseanker von „Umbrechen“ misst in der Nummernspalte

## Beschreibung

Auf der Review-Seite hält der Schalter „Umbrechen“ (R00248) die Lesestelle mit `reviewLeseZeileMerken()` (`web/app.js:2166`). Dieser Anker setzt seinen Messpunkt in die **Mitte der Rolle** `#review` (`document.elementFromPoint(r.left + r.width / 2, r.top + 1)`, `web/app.js:2167`). Bei breitem Fenster und kurzen Zeilen liegt die Mitte der Rolle **neben** der Tabelle: der Punkt trifft die `tbody` (oder den Bereich darunter), nicht eine Zeile `tr`, und der Anker fällt auf den **Dateikopf** `.df-k` zurück. Die Nachführung hängt sich dann an den Kopf der Datei statt an die gelesene Zeile — wer mitten in einer Datei aus kurzen Zeilen liest, verliert beim Umschalten die Lesestelle. „Nebeneinander“ (R00249) misst seit #260 in der **Nummernspalte** (`reviewNummernSpalte`, `web/app.js:2270–2274`) und trifft die Zeile.

Reproduzierbar (1280 px, Datei aus kurzen Zeilen): eine kurze Zeile an die Oberkante von `#review` rollen, „Umbrechen“ umschalten — erwartet: dieselbe Zeile bleibt stehen (≤ 36 px); tatsächlich: `reviewLeseZeileMerken()` liefert den Dateikopf, die Zeile springt um die Höhe aller Zeilen darüber. Bei langen Zeilen (R00248 AK 9) trifft die Mitte die Zeile, der Fehler bleibt dort verborgen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme Zeilen prüft, bleibt beim Umschalten an seiner Stelle.

### Domänenbezug
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Ursachenanalyse

### Root Cause
`reviewLeseZeileMerken` (`web/app.js:2167`) misst die Lage mit einem `elementFromPoint` in der **Mitte** der Rolle (`r.left + r.width / 2`). Bei kurzen Zeilen steht die Nummernspalte links an der Zeile, die Code-Zelle bleibt schmal; der Punkt in der Rollenmitte liegt neben der Tabelle. Die Kette `getroffen.closest('tr') || (getroffen.closest('section.df') || …).querySelector('.df-k')` findet dann keine Zeile und fällt auf den Dateikopf zurück. `reviewLeseZeileNachKennung` („Nebeneinander“, `:2251`) löst dasselbe mit `reviewNummernSpalte(rolle, r)` (`:2270–2274`) — die Nummer steht in jeder Zeile und liegt links, unabhängig von der Zeilenbreite. Ausgeschlossen: die Nachführung selbst (`reviewLesepositionHalten` läuft), die Bindung der Klasse (`umbr` sitzt an `#review`), der Schalterzustand. Der Fehler ist allein der Messpunkt.

### Betroffene Komponenten
- `web/app.js`: `reviewLeseZeileMerken` (Messpunkt, `:2166–2171`), Aufrufer `reviewUmbrechenSetzen` (`:2186`), Rückfall `reviewLesepositionMerken` (`#rv-a0`); `reviewLeseZeileNachKennung` (`:2249`) benutzt `reviewLeseZeileMerken` als Rückfall.
- Keine Server-, Format- oder Stiländerung.

## Lösungsvorschlag

### Langfristige Lösung
`reviewLeseZeileMerken` teilt `reviewNummernSpalte(rolle, r)` mit „Nebeneinander“ (ADR-0042 Nachtrag N10): der Messpunkt liegt in der Nummernspalte, für „Umbrechen“ und „Nebeneinander“ derselbe. Der Rückfall bleibt (Kopf der Datei, dann `#rv-a0`). Eine Zeile, kein neuer Mechanismus.

### Alternative Ansätze
- **Mitte der Rolle (heute):** verworfen — trifft schmale Zeilen nicht, Rückfall auf den Dateikopf, Lesezeile verloren.
- **Breite abtasten:** verworfen — N6.2 verwirft das Abtasten ausdrücklich; ein Lauf je Umschalten, neuer Weg.
- **Rückfall von „Umbrechen“ ganz auf `reviewLeseZeileNachKennung` umstellen:** verworfen — N10 will **einen** Messpunkt für beide Schalter; zwei Wege divergieren sonst wieder.

## Test-Strategie

### Unit Test zur Bug-Reproduktion
Nicht möglich: der Fehler ist eine Layout-Geometrie (`elementFromPoint` bei 1280 px), keine reine Logik. Die Reproduktion ist ein **E2E**-Test (headless Chromium, echtes Git), der vor dem Fix rot ist (AK 1). Code-Extraktion entfällt: `reviewLeseZeileMerken` ist DOM-nah und wird von `reviewUmbrechenSetzen` gebraucht.

### Regressionstests
- `e2e/tests/r00248-review-umbrechen.spec.js` AK 9 und `e2e/tests/r00249-review-nebeneinander.spec.js` AK 1 bleiben unverändert grün (Rückfall und Nummernspalten-Weg).
- Volle Playwright-Suite ohne `nice` und ohne parallele Last (Lehre #15).

## Akzeptanzkriterien

Ausgangslage: Repository R mit Anwendung `kd`, Aufgabe #9; Mensch `sh`, Browser headless; Breite 1280 px (P1) und 980 px (P2), hell. Kurzzeilen-Datei wie R00248 K-Kurz (`src/kurz.rs`, `let a = 1;` → `let a = 2;`), Langzeilen-Datei wie R00248 K-Lang (`src/u.rs`).

### Anker (P1, heute rot)
- [x] **AK 1 Anker ist eine Zeile:** Gegeben R bei 1280 px, eine **kurze** Zeile (R00248 K-Kurz) an die Oberkante von `#review` gerollt, wenn `reviewLeseZeileMerken()` aufgerufen wird, dann liefert es eine `tr` (heute `.df-k`).
- [x] **AK 2 Sichtbar bleibt die Lesezeile:** Gegeben R bei 980 px, lange Zeilen (R00248 K-Lang, `src/u.rs`) **über** der kurzen obersten Zeile, wenn `sh` „Umbrechen“ ein- und wieder ausschaltet, dann steht dieselbe Zeile (`data-z`) nach jedem Schalten mit `|top_danach − top_davor| ≤ 36` px an ihrer Stelle.

### Rückfall und Bestand (heute grün)
- [x] **AK 3 Rückfall unverändert:** Gegeben keine Zeile an der Oberkante (Dateikopf von `src/kurz.rs` oben), wenn umgeschaltet wird, dann gilt weiter der Rückfall (Kopf der Datei, dann `#rv-a0`); `r00248` AK 9 und `r00249` AK 1 bleiben unverändert grün.

### Schutz
- [x] **AK 4 Mutant:** Gegeben eine eigene Kopie mit dem Messpunkt wieder in der Mitte der Rolle, wenn die Probe gefahren wird, dann wird sie rot (über AK 1 oder AK 2); das Original wird auf dem committeten Stand zurückgelegt und ist wieder grün.

## Implementierungshinweise
- `reviewNummernSpalte(rolle, r)` (`web/app.js:2270–2274`) gibt es schon (R00249); aus `reviewLeseZeileMerken` mitbenutzen, nicht kopieren. Dort bleibt der Rückfall auf `r.left + r.width / 2` für den Fall ohne `.dz-b` erhalten.
- `reviewLeseZeileMerken` bleibt der Rückfall von `reviewLeseZeileNachKennung`; die Rückgabeform `{ anker, oben }` bleibt, damit `reviewLesepositionHalten` unverändert ist.
- Kein `role`, kein `aria-*`, kein Server, kein Format, keine neue Einstellung.

## Offene Fragen
Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Schalter „Umbrechen“ ist gebaut, um beim Umschalten die Lesestelle zu halten (R00248 FA 3). Heute misst `reviewLeseZeileMerken` in der Rollenmitte; bei kurzen Zeilen liegt dort keine Zeile, und die Nachführung hängt sich an den Dateikopf, der weit oberhalb steht. Wer mitten in einer Datei mit kurzen Zeilen liest und umschaltet, springt an den Dateikopf und sucht die Stelle neu — gerade die kurzen Zeilen, für die der Umbruch wenig ändert, verlieren die Lesestelle. Der Hebel ist der Messpunkt, nicht die Nachführung: `reviewLesepositionHalten` ist richtig, es bekommt nur den falschen Anker. Mit `reviewNummernSpalte` trifft der Punkt die Nummer jeder Zeile — links, unabhängig von der Zeilenbreite — und beide Schalter messen an derselben Stelle (ADR-0042 N10). Eine vorgelagerte (die Nachführung umbauen) oder nachgelagerte (nur den Rückfall verbessern) Änderung träfe die Ursache nicht.

## Notizen
- Priorität: Mittel (Lesekomfort beim Umschalten, kein Datenverlust).
- Betroffene Nutzer/Systeme: Review-Seite, Schalter „Umbrechen“ (R00248).
- Workaround: die Zeile nach dem Umschalten neu suchen.
- **Verworfene Alternativen:** siehe „Alternative Ansätze“.
- **Abgrenzung:** R00248 bleibt abgenommen — der Messpunkt war nie Kriterium (ADR-0042 N6.2 nennt den Anker „oberste sichtbare Zeile“, nicht den x-Punkt); die Kriterien bleiben gültig. Nicht Teil: der Rückfall, andere Lesepfade, „Nebeneinander“ (misst schon richtig).
- **Berührt #274** (ADR-0042 N5/N6/N7): dessen Klassenumbenennung `.dz` → `.pop-dz` macht die Diff-Tabelle zur echten Tabelle über die Rollenbreite; danach könnte der mittige Messpunkt zufällig wieder eine Zeile treffen. Die Probe ist daher am Stand **vor** #274 ehrlich; #275 vor #274 bauen oder den Mutanten auf dem Stand vor #274 zeigen. Keine `Braucht`-Kante: die Änderung selbst hängt nicht an #274.
