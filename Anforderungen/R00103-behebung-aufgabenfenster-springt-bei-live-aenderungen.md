---
id: R00103
status: Neu
datum: 2026-11-05
ursprung: Bug-Report
ursprungslauf: R00007
---

# R00103: Behebung des Sprungs im Aufgabenfenster bei Live-Änderungen

## Beschreibung

Wer eine Aufgabe im Aufgabenfenster liest oder bearbeitet, während ein Agent oder ein zweiter Browser irgendetwas im Ordner ändert, verliert seinen Platz: Das Fenster springt nach oben, und wer gerade im Titel tippt, verliert den Fokus. Schlimmer: Der halb getippte Titel wird dabei gespeichert und committet, ohne dass die Person das Feld verlassen hat. Es genügt ein Kommentar an eine **andere** Aufgabe.

Reproduktion (architekt, headless gegen `target/release/kanbanD`, Stand `6333800`, 2026-11-05): Aufgabe #1 mit 40 Kommentaren im Fenster öffnen, Hauptbereich auf 400 scrollen, dann per API einen Kommentar an #1 oder an #2 schreiben. Erwartet: Scrollstand 400. Tatsächlich: 0, im breiten Layout (1400 × 700) wie im schmalen (600 × 700). Beim Tippen im Titel von #1 landet der Fokus auf der Seite (`BODY`), und Git zeigt direkt nach dem fremden Kommentar einen Commit „#1 geändert: Titel“ mit dem halben Titel. Das Kommentarfeld des Fensters behält Inhalt und Fokus.

Zahlt ein auf: [Vision](R00000-vision.md) — „Live überall, egal woher die Änderung kommt“: Live darf nicht heißen, dass ein Mensch neben arbeitenden Agenten nicht mehr lesen und schreiben kann.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)
- [Seitenleiste](../Dokumentation/Domaenenwissen/D00003-seitenleiste.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)

## Ursachenanalyse

### Root Cause

Belegt im Code (ADR-0007, Kontext):

- Jedes Live-Ereignis, das den Serverstand ändert, zeichnet alles neu: `ereignis()` → `laden({ nurBeiAenderung: true })` → `render()` (`web/app.js:1756–1769`). Ein Kommentar an irgendeine Aufgabe ändert `S.aufgaben` und damit den Vergleichsstand (`web/app.js:150`), deshalb wirkt auch ein Kommentar an eine andere Aufgabe.
- `render()` ersetzt `#kopf`, `#main` und `#over` per `innerHTML` (`web/app.js:446–452`). Das Aufgabenfenster liegt in `#over` (`web/ansicht.js:222–237`) und entsteht dabei mit Scrollstand 0 neu.
- Leseposition gerettet wird nur über eine feste Selektorliste in `#main` (`rollpositionen()`, `web/app.js:467–479`, aus R00063). Die Scrollflächen des Fensters — breit `.mod-main` und `.mod-side` (`web/kd-app.css:226–227`), schmal `.mod-body` (`web/kd-app.css:710–714`) — stehen nicht darin.
- Fokus, Wert und Cursor gerettet werden nur für ein Eingabefeld mit `id` (`web/app.js:434–460`). Titel, Labels, Fälligkeit, Spalte und Klasse tragen `data-af`, aber keine `id` (`web/ansicht.js:211`, `225–236`); 37 Eingabeelemente in `web/*.js` haben keine `id`. Das Kommentarfeld `#km-inp` hat eine und ist deshalb heil.
- Der ungewollte Commit: Die Felder speichern über `change` (`web/app.js:1165–1172`). Belegt beim Bau (roter Test, `Dokumentation/Gelerntes.md`, 2026-11-05): Das fokussierte, geänderte Feld löst `change` aus, während `innerHTML` es ersetzt — zu diesem Zeitpunkt hängt es noch im Dokument (`isConnected` wahr), ein Wächter „hängt das Feld noch?“ greift deshalb nicht. Abhilfe ist ein Merker um das Ersetzen: `change`-Ereignisse währenddessen werden verworfen. Und weil der Browser „geändert“ ab dem Fokussieren misst, meldet das zurückgesetzte Feld beim Verlassen ohne Weitertippen kein `change` mehr; dieses eine `change` wird beim Verlassen nachgetragen.

Ausgeschlossen: Die Ereignisse selbst sind korrekt (R00007, R00085); das Neuzeichnen nur bei Änderung (R00061) greift, aber jede fremde Änderung ist eine Änderung. R00063 hat das Fenster ausdrücklich nicht geprüft (dort Notizen: „Nicht geprüft: das Aufgabenfenster … bei Live-Änderungen“).

`ursprungslauf: R00007`: Mit R00007 („Die Oberfläche lädt nach jedem Ereignis neu“) wurde das volle Neuzeichnen auf fremde Änderungen gelegt; Fenster und `change`-Speichern stammen aus R00011 und waren vorher nicht betroffen.

### Betroffene Komponenten

- `web/app.js`: `render()`, `rollpositionen()`, `rollpositionenSetzen()`, das `halten` des aktiven Feldes, der `change`-Handler der Fensterfelder
- `web/ansicht.js`: Aufgabenfenster (Felder ohne eindeutigen Schlüssel brauchen ggf. `data-halt`)
- mittelbar jede Sicht in `#main` (Board, Aufgabenliste, Berichte, WBS-Sicht), weil der Sicherer die Selektorliste ersetzt

## Lösungsvorschlag

### Langfristige Lösung

Option B aus [ADR-0007](../Dokumentation/ADRs/0007-sichtzustand-uebersteht-das-neuzeichnen.md): ein **allgemeiner Sicherer in `render()`** für `#main` und `#over`.

- Vor dem Ersetzen sichert er den Scrollstand jedes Elements mit `scrollTop` oder `scrollLeft` ≠ 0, das aktive Element samt Wert und Cursor; danach stellt er beides über einen **stabilen Schlüssel** wieder her.
- Schlüsselregel, in dieser Reihenfolge: `id` → `data-halt="<name>"` → Feldschlüssel `data-af`, `data-nf`, `data-wf`, `data-wn`, `data-tf` samt Attributwert → `data-act` + `data-arg` → eine Klasse, die im Bereich (`#main` bzw. `#over`) genau einmal vorkommt. **Ohne eindeutigen Schlüssel wird nichts zurückgesetzt.**
- Die Leseposition wandert nur innerhalb derselben Sicht (`#main`, wie heute `data-sicht`) bzw. derselben offenen Aufgabe (`#over`) mit.
- Ein Feld, das nur durch das Neuzeichnen seinen Knoten verliert, speichert nicht.
- Er ersetzt `rollpositionen()` und das `halten` per `id`; ein ausdrückliches Fokusziel einer Aktion (`S.ui.fokus`) geht dem gesicherten Fokus vor, wie heute.

### Alternative Ansätze

- **A — Liste erweitern, Feldern `id` geben**: behebt den Fall, nicht die Klasse; die nächste Fläche oder das nächste Feld ohne `id` fällt wieder heraus, und der ungewollte Commit bleibt.
- **C — nur neu zeichnen, was sich geändert hat**: hilft beim Kommentar an eine andere Aufgabe, nicht an dieselbe; braucht B ohnehin und führt fehleranfälliges Abhängigkeitswissen je Bereich ein (bleibt spätere Lastmaßnahme, eigene ADR).
- **D — DOM-Abgleich (Morphing)**: gründlich, aber tauscht den Zeichenkern der ganzen Oberfläche; unverhältnismäßig für einen Fehler, den B schließt.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Der Fehler entsteht nur im echten DOM mit Layout; die Reproduktion ist deshalb ein **E2E-Test** (Playwright), neu `e2e/tests/r00103-sichtzustand.spec.js`, nach dem Muster `e2e/tests/r00085-live-verbindung.spec.js:42`: gewartet wird auf das Neuzeichnen über `window.kdTest.renders()` (Zähler steigt), nie mit fester Wartezeit. Ohne Fix rot, mit Fix grün.

- Arrange: eigene Instanz auf freiem Port, Board `entwicklung`, Aufgabe #1 „Abnahme prüfen“ mit 40 Kommentaren (über `POST /api/aufgaben/1/kommentare`), Aufgabe #2; Person `st` (Mensch) im Browser, `bot` (Agent) für die API. #1 im Fenster öffnen.
- Act: Scrollstand bzw. Eingabe herstellen, `renders()` merken, Kommentar per API, warten bis `renders()` größer ist.
- Assert: Scrollstand, Fokus, Wert, Cursor wie in den Akzeptanzkriterien; Commits mit „#1 geändert: Titel“ im Testordner per `git log` vorher und nachher gezählt.
- Beide Layouts: breit 1400 × 700 (Hauptbereich `.mod-main`, Seitenleiste `.mod-side`), schmal 600 × 700 (`.mod-body`).

### Code-Extraktion für isoliertes Testing

Die Schlüsselregel als reine Funktion in einem eigenen Modul (wie `web/auswahl.js`): Eingabe ist eine Beschreibung des Elements (Tag, `id`, Datenattribute, Klassen, Anzahl gleicher Klassen im Bereich), Ausgabe der Schlüssel oder „keiner“. Einheitstest `e2e/einheit/sichtzustand.test.js` über `node --test e2e/einheit/`.

### Regressionstests

- `e2e/tests/r00033-kontextmenue.spec.js:94–103` und `e2e/tests/r00054-wbs-sicht.spec.js:106–115` bleiben grün (Leseposition in `#main`, heute über die Selektorliste).
- Kommentarfeld des Fensters (heute heil, weil mit `id`) bleibt heil, auch bei zwei Ereignissen kurz hintereinander.
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`.

## Akzeptanzkriterien

Gegeben jeder Prüfung: Board `entwicklung`, Aufgabe #1 „Abnahme prüfen“ mit 40 Kommentaren, Aufgabe #2 „Board aufräumen“, Person `st` hat #1 im Aufgabenfenster offen; Live-Ereignis heißt: Der Agent `bot` schreibt über die API einen Kommentar. Scrollstände in Pixeln, Toleranz ±1.

### Bug behoben (Pflicht)
- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün

### Leseposition im Fenster (F0022)
- [ ] Beispiel breit: Gegeben 1400 × 700 und der Hauptbereich auf 400 gescrollt, wenn `bot` #1 kommentiert, dann steht der Hauptbereich danach auf 400 (399–401) — heute 0
- [ ] Beispiel breit, andere Aufgabe: Gegeben dasselbe, wenn `bot` #2 kommentiert, dann steht der Hauptbereich auf 400 — heute 0
- [ ] Beispiel Seitenleiste: Gegeben breit, die Seitenleiste ist um einen Wert s > 0 gescrollt (Fensterhöhe so gewählt, dass sie überläuft, z. B. 1400 × 420), wenn `bot` #2 kommentiert, dann steht sie auf s ±1, und der Hauptbereich behält seinen eigenen Stand
- [ ] Beispiel schmal: Gegeben 600 × 700 und der Fensterinhalt auf 400 gescrollt, wenn `bot` #1 bzw. #2 kommentiert, dann steht er je auf 400 — heute 0
- [ ] Grenzwert: Gegeben der Hauptbereich steht ganz unten, wenn `bot` #1 kommentiert (der Inhalt wird länger), dann bleibt der bisherige Scrollstand stehen; er rutscht nicht ans neue Ende
- [ ] Leerfall: Gegeben nichts ist gescrollt (0), wenn `bot` #2 kommentiert, dann steht alles weiter auf 0
- [ ] Gegenbeispiel: Gegeben der Hauptbereich von #1 steht auf 400, wenn `st` das Fenster schließt und #2 öffnet, dann beginnt #2 oben (0) — die Leseposition wandert nicht in eine andere Aufgabe mit *(Blättern aufgehoben durch Betreiber-Entscheidung 2026-11-12 (#144): der Fall prüft das Öffnen einer anderen Aufgabe, R00144 FA 9)*
- [ ] Fehlfall (Einheitstest der Schlüsselregel): Gegeben zwei Flächen derselben Klasse ohne `id`, `data-halt`, Feld- oder Aktionsschlüssel im selben Bereich, dann hat keine einen Schlüssel und keine wird zurückgesetzt; Gegeben eine Fläche mit `data-halt="x"` und eine mit nur dieser Klasse, dann ist `data-halt` der Schlüssel (Vorrang `id` > `data-halt` > Feldschlüssel > Aktion > eindeutige Klasse)
- [ ] Regression: die Leseposition in Board, Aufgabenliste und WBS-Sicht bleibt wie bisher (`r00033-kontextmenue.spec.js:94–103`, `r00054-wbs-sicht.spec.js:106–115` grün)

### Tippen im Fenster (F0023)
- [ ] Beispiel: Gegeben `st` hat im Titel von #1 „Abnahme prüfen“ zu „Abnahme prü“ gelöscht, der Cursor steht hinter „prü“ (Position 11), wenn `bot` #2 kommentiert, dann hat der Titel weiter den Fokus, zeigt „Abnahme prü“, der Cursor steht auf 11, und `st` tippt ohne Klick weiter
- [ ] Negativbeweis: Gegeben dasselbe, wenn `bot` #2 kommentiert, dann ist die Zahl der Commits „#1 geändert: Titel“ im Ordner nachher gleich vorher (`git log`), und `GET /api/aufgaben/1` liefert weiter „Abnahme prüfen“ — heute ein Commit mit dem halben Titel
- [ ] Gegenprobe Speichern: Gegeben `st` hat nach dem Ereignis den Titel zu „Abnahme prüfen lassen“ vervollständigt, wenn `st` das Feld verlässt, dann entsteht genau ein Commit „#1 geändert: Titel“, und die Aufgabe heißt „Abnahme prüfen lassen“
- [ ] Leerfall: Gegeben der Titel hat den Fokus und ist unverändert, wenn `bot` #2 kommentiert, dann bleibt der Fokus im Titel, und es entsteht kein Commit für #1
- [ ] Grenzfall Auswahl: Gegeben im Titel ist „prüfen“ markiert (Zeichen 8–14), wenn `bot` #2 kommentiert, dann ist danach dieselbe Auswahl markiert
- [ ] Weitere Felder ohne `id`: Gegeben `st` tippt in den Labels von #1 „ux, bu“, wenn `bot` #2 kommentiert, dann behält das Feld Fokus und Wert, und es entsteht kein Commit „#1 geändert: Labels“
- [ ] Zwei Ereignisse: Gegeben `st` tippt im Titel wie oben, wenn `bot` kurz hintereinander zwei Kommentare an #2 schreibt (zweiter, bevor `st` weitertippt), dann gelten Fokus, Wert, Cursor und Negativbeweis nach beiden Ereignissen
- [ ] Regression Kommentarfeld: Gegeben `st` hat im Kommentarfeld von #1 „noch offen“ getippt, wenn `bot` zwei Kommentare kurz hintereinander an #1 schreibt, dann behält das Kommentarfeld Fokus und „noch offen“, und `st` hat keinen Kommentar abgeschickt
- [ ] Fremde Änderung am selben Titel, getippt: Gegeben `st` hat im Titel von #1 „Abnahme prü“ getippt (Cursor 11), wenn `bot` den Titel von #1 über die API in „Abnahme durchführen“ ändert, dann zeigt das Feld weiter „Abnahme prü“, Fokus und Cursor 11 bleiben; vervollständigt `st` danach zu „Abnahme prüfen lassen“ und verlässt das Feld, dann heißt die Aufgabe „Abnahme prüfen lassen“, und `git log` zeigt den Commit von `bot` vor genau einem Commit „#1 geändert: Titel“ von `st`
- [ ] Fremde Änderung am selben Titel, nicht getippt: Gegeben der Titel von #1 hat den Fokus und ist unverändert, wenn `bot` ihn über die API in „Abnahme durchführen“ ändert, dann zeigt das Feld „Abnahme durchführen“, beim Verlassen entsteht kein Commit von `st`, und `GET /api/aufgaben/1` liefert „Abnahme durchführen“

### Durchsetzung (ADR-0007)
- [ ] Neben dem Sicherer gibt es keine Selektorliste für Scrollflächen und keinen eigenen Sonderweg, der das aktive Feld über die `id` hält (`rollpositionen()` und das `halten` sind ersetzt); ein ausdrückliches Fokusziel einer Aktion geht vor wie heute

## Implementierungshinweise

- Bereich `#main`: Leseposition nur, wenn `#main[data-sicht]` gleich bleibt (Bedingung aus R00063 übernehmen). Bereich `#over`: nur, wenn dieselbe Aufgabe offen bleibt (`S.ui.offen` vor und nach dem Neuzeichnen gleich).
- Wiederherstellen des Scrollstands vor dem Setzen des Fokus (`focus({ preventScroll: true })`), sonst zieht der Fokus die Fläche weg.
- Der gerettete Wert wird gesetzt, ohne dass das Verlassen des Feldes danach stumm bleibt: Ein Feld, dessen Wert programmatisch gesetzt wurde, löst beim Verlassen sonst kein `change` aus — die Gegenprobe „Speichern“ deckt das ab.
- „Geändert“ heißt: Der Wert des Feldes weicht vom zuletzt gezeichneten Wert dieses Feldes ab. Nur ein geändertes Feld behält beim Neuzeichnen seinen Wert; einem unveränderten Feld schreibt der Sicherer nie den alten Wert zurück — es zeigt den neu gezeichneten (auch fremden) Wert, Fokus und Cursor bleiben (PO-Entscheidung `AI-Team/po-entscheidungen.md`, Zeile 63).
- Muster der E2E-Tests: `kanbanStarten`, `alsPerson`, `liveBereit` aus `e2e/tests/hilfen.js`; Warten über `window.kdTest.renders()`.
- Lastprofil (`AI-Team/umgebung.md`): bis 5 Schreibaufrufe/s, also bis zu fünf Neuzeichnungen je Sekunde — der Sicherer darf keine Anfrage an den Server stellen.

## Offene Fragen

- Entschieden vom Product Owner: `AI-Team/po-entscheidungen.md`, Zeilen 63–66

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist das volle Neuzeichnen bei jedem fremden Ereignis, das im Fenster alles ohne Schlüssel auf Anfang setzt und ein fokussiertes Feld aushängt. Sichert `render()` den Zustand über stabile Schlüssel und stellt ihn danach her, steht nach jedem Ereignis dieselbe Leseposition, derselbe Fokus und derselbe Cursor da — egal, welche Fläche oder welches Feld es ist, auch künftige ohne Zutun. Verwirft der Speicherweg das `change` während des Ersetzens und trägt es beim Verlassen genau einmal nach, entsteht kein Commit mehr, den die Person nicht ausgelöst hat; gespeichert wird erst, wenn sie das Feld verlässt. Der Hebel sitzt in `render()`, weil dort der Verlust entsteht: eine Korrektur je Fläche oder Feld (Option A) lässt die Fehlerklasse offen, ein selteneres Neuzeichnen (Option C) hilft bei Änderungen an der offenen Aufgabe nicht. Damit bleibt das Aufgabenfenster unter Agentenlast (bis fünf Neuzeichnungen je Sekunde) benutzbar.

## Notizen

- Priorität: Hoch — der ungewollte Commit schreibt Daten, die niemand gewollt hat
- Betroffene Nutzer/Systeme: jeder Mensch, der ein Aufgabenfenster offen hat, während Agenten oder ein zweiter Browser schreiben
- Workaround: keiner; Titel nur ändern, wenn niemand sonst schreibt
- Herkunft: Karte #19 „Aufgabenfenster springt bei Live-Änderungen nach oben“ (Labels ux, bug, Betreiber 2026-10-31); Befund und Abnahme-Probe des architekt (2026-11-05, ADR-0007, Commit 01bf27a)
- Kein Konflikt-Hinweis bei gleichzeitiger Änderung desselben Feldes (PO Zeile 63); eigene Karte erst bei Befund
- Nicht Umfang (ADR-0007): Textauswahl in Lesetext und aufgeklappte `<details>` überstehen das Neuzeichnen weiter nicht; weniger Neuzeichnen (Option C) ist eigene Karte
