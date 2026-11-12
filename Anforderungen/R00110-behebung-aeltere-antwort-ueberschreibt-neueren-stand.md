---
id: R00110
status: Neu
datum: 2026-11-07
ursprung: Bug-Report
ursprungslauf: R00007
---

# R00110: Behebung — eine ältere Antwort überschreibt den neueren Stand

## Beschreibung

Wer im Aufgabenfenster eine Teilaufgabe eingibt, während ein Agent etwas anderes im Ordner ändert, sieht seine Eingabe wieder verschwinden: Die Datei enthält `- [ ] neu`, das Fenster zeigt aber „TEILAUFGABEN 0/0“ und eine leere Liste. Der Reiter „Datei“ desselben Fensters zeigt dagegen schon die neue Zeile, das Fenster widerspricht sich also selbst. Erst die nächste fremde Änderung heilt die Anzeige.

Reproduktion (architekt, Probe E aus #75, 5 von 5 rot; Wiederholung unter #76 mit Netzprotokoll, 3 von 3; ADR-0014, Kontext): Fenster von #1 offen. Eine fremde Änderung an #2 löst ein Live-Ereignis aus, dessen `GET /api/aufgaben` um 400 ms verzögert ankommt. Währenddessen wird „neu“ + Enter als Teilaufgabe eingegeben. Die angezeigten Anzahlen sind 0, 1, 1, 0, 0, 0. Zweiter Beleg ohne Verzögerung: Code-Review #75 (A5), US-1 von R00050 bei 0 ms und CPU-Drossel 6× einmal in 4 Läufen rot (`crev-75/wdh/b-instr.log:48`).

Zahlt ein auf: [Vision](R00000-vision.md) — „Live überall, egal woher die Änderung kommt“: Live heißt, dass die Oberfläche den neuesten Stand zeigt, nicht den, der zuletzt ankam. Unter dem Lastprofil (bis 5 schreibende Aufrufe je Sekunde durch Agenten, `AI-Team/umgebung.md`) überlappen sich Ladevorgänge regelmäßig.

Die technische Entscheidung steht in [ADR-0014](../Dokumentation/ADRs/0014-nur-die-neueste-antwort-wird-uebernommen.md) samt Nachtrag N1; diese Anforderung macht sie prüfbar.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Ursachenanalyse

### Root Cause

Belegt im Code (ADR-0014, Kontext; Stand `52bb8d4`):

- Die Oberfläche hält ihren Stand in einem Objekt `S` (`web/app.js:2`). `laden()` (`web/app.js:175`) holt ihn in mehreren Anfragen und übernimmt ihn seit R00061 auf einmal (`Object.assign(S, …)`, `web/app.js:215`).
- Neu geladen wird von vielen Stellen, ohne dass eine von der anderen weiß: das Live-Ereignis `ereignis()` (`web/app.js:2082`), die Warteschlange, sobald sie leer ist (`web/app.js:326`), Aktionen nach dem Schreiben samt Fehlerpfad (`web/app.js:1402`), das Wiederverbinden (`web/app.js:2118`) und das Fenster beim Öffnen (`oeffnen` `:837` ruft `dateiLaden()` direkt) — das Blättern ist durch Betreiber-Entscheidung 2026-11-12 (#144) gestrichen (R00144 FA 9).
- Nirgends wird geprüft, ob eine Antwort noch die neueste ist. **Es gewinnt, wer zuletzt ankommt, nicht wer zuletzt gefragt hat.** Ungeschützt übernommen wird an vier Stellen:
  1. `S.zustand` sofort beim Eintreffen (`web/app.js:176`), noch vor dem Rest und außerhalb der Übernahme auf einmal
  2. der Hauptblock (`web/app.js:215`)
  3. `dateiLaden()` (`web/app.js:290–296`)
  4. `defektLaden()` (`web/app.js:279–288`)
- `ereignis()` prüft `schlangeOffen > 0` nur beim Start (`web/app.js:2083`). Ein Laden, das schon läuft, wenn eine eigene Teilaufgabe eingereiht wird, läuft weiter und überschreibt sie, wenn seine Antwort nach dem Laden der Warteschlange ankommt.
- `serverStand()` (`web/app.js:171`) und `nurBeiAenderung` (`web/app.js:221`) verhindern nur das Neuzeichnen eines unveränderten Stands. Die ältere Antwort unterscheidet sich vom gezeichneten Stand und wird deshalb sogar gezeichnet.
- Der Server kennt keine Versionsnummer seines Stands (kein `ETag`, keine Revision).

Netzprotokoll der Probe E (ms seit der ersten Anfrage, Lauf 0):

| Zeit | Vorgang |
|---|---|
| 156 | Laden L1 (aus dem Ereignis) startet |
| 184 | L1 fragt `GET /api/aufgaben` (gehalten) |
| 250 | `POST …/teilaufgaben` (Warteschlange) |
| 267 | Laden L2 (Warteschlange leer) startet |
| 283 | L2 übernimmt den Stand mit „neu“ |
| 418 | Laden L3 (Echo des eigenen Commits) startet |
| 471 | L3 übernimmt den Stand mit „neu“ |
| 635 | Antwort von L1 kommt an und überschreibt `S.aufgaben` mit dem Stand ohne „neu“ |
| 637–674 | L1 lädt danach `dateiLaden()` frisch — deshalb zeigt der Reiter „Datei“ den neuen Inhalt |

Der Nebenbefund „Kopf zeigte nicht live“ ist der Abschnittskopf „TEILAUFGABEN 0/0“ (`web/ansicht.js:300`), dieselbe Ursache (PO `AI-Team/po-entscheidungen.md`, Z. 150).

`ursprungslauf: R00007`: Mit R00007 („Die Oberfläche lädt nach jedem Ereignis neu“) laden Ereignisse unabhängig von eigenen Anfragen neu; damit entstand das Überlappen. R00037/R00050 (Warteschlange, Ereignis übergehen bei offener Schlange) und R00061 (Übernahme auf einmal) haben es eingeschränkt, aber keine Reihenfolge der Antworten eingeführt.

### Betroffene Komponenten

- `web/app.js`: `laden()`, `dateiLaden()`, `defektLaden()`, `warteschlange` (Laden bei leerer Schlange), `ereignis()`
- neu: ein reines Modul mit der Prüfung `uebernehmen` im Stil von `web/verbindung.js`
- unverändert: Server und API

## Lösungsvorschlag

### Langfristige Lösung

Option A aus ADR-0014: eine laufende Nummer je Laden im Browser, Übernahme nur über eine reine Prüfung. Die Regeln wörtlich nach ADR-0014, „Entscheidung“:

1. **Ein Takt.** Ein Zähler im Browser (Vorschlag `takt`) zählt jeden Start von `laden()`, `dateiLaden()` und `defektLaden()` hoch. Jedes Laden merkt sich seine Nummer `start`.
2. **Monoton.** Eine Antwort wird nur übernommen, wenn ihr `start` größer ist als die Nummer der zuletzt übernommenen Antwort; danach gilt zuletzt übernommen = `start`. Es zählt „neuer als das Gezeigte“, nicht „das zuletzt Gestartete“ — deshalb verhungert bei 5 Ereignissen je Sekunde nichts.
3. **Eigene Änderungen schützen.** Solange die Warteschlange offen ist (`schlangeOffen > 0`), wird keine Antwort übernommen. Wird sie leer, setzt sie vor ihrem eigenen Laden eine Marke auf den aktuellen Takt; jede Antwort mit `start` ≤ Marke ist veraltet.
4. **Eine reine Prüfung.** Die Regeln 2 und 3 stehen in einer reinen Funktion, im Browser und in Node nutzbar: `uebernehmen({ start, zuletzt, marke, schlangeOffen })` → `true | false`. Sie wird unmittelbar vor jeder Übernahme in `S` aufgerufen; nirgends sonst wird diese Entscheidung getroffen.
5. **Alles oder nichts.** `laden()` sammelt auch `S.zustand` und die abgeleiteten Felder (`einstellungenDefekt`, `ui.first`, `ui.view`, `ui.slug`) zuerst lokal und übernimmt sie im selben Schritt wie heute `:215`. Ein verworfenes Laden ruft kein `dateiLaden()` und kein `defektLaden()`, setzt `geladenerStand` nicht, zeichnet nicht und gibt `false` zurück.
6. **Das Fenster.** `dateiLaden()` und `defektLaden()` prüfen mit demselben Takt und zusätzlich, ob `S.ui.offen` bzw. `S.ui.offenDefekt` noch die Nummer ist, für die sie gestartet wurden. Innerhalb von `laden()` laufen sie als Teil desselben Ladens, unter dessen Nummer.
7. **Markierung „extern“.** Wird das Laden eines Ereignisses verworfen, merkt sich `ereignis()` die Pfade und setzt `S.extern` beim nächsten übernommenen Laden.

### Alternative Ansätze

Verworfen in ADR-0014 (Vergleichstabelle in N1):

- **B — `AbortController`**: wirkt nur, solange `fetch` läuft; ist die Antwort schon da und das Laden steht in einem späteren `await`, übernimmt es trotzdem. Jeder Aufrufer müsste `AbortError` von echten Fehlern trennen, und bei 5 Ereignissen je Sekunde bricht jedes Laden das vorige ab — die Anzeige verhungert. Bleibt mögliche Optimierung der Netzlast, eigene Karte erst nach einer Messung.
- **C — Version vom Server**: rund 10 Endpunkte und die API ändern sich, die Revision muss über Wächter und Commits weiterzählen, und den Fall „optimistisch gezeigt, noch nicht gespeichert“ (Regel 3) löst sie nicht.
- **D — Einzelflug**: verhindert das Überlappen, nicht das Übernehmen eines Stands, der vor der eigenen Änderung gelesen wurde; `dateiLaden` liegt außerhalb, und rund 9 Aufrufer von `laden()` bekämen ein geteiltes Versprechen mit anderer Bedeutung.

## Test-Strategie

Ebenen nach ADR-0014 N1:

- **Unit** (`e2e/einheit/`, `node --test`): die reine Prüfung `uebernehmen` und der Wächter der Übernahmestellen.
- **Integration**: entfällt mit Grund. Server und API ändern sich nicht; die einzige neue Grenze liegt zwischen Browser und API und wird E2E über den echten Einstieg geprüft.
- **E2E** (Playwright, im Bestand der Suite, Treiber `e2e/tests/hilfen.js`: `kanbanStarten`, `alsPerson`, `liveBereit`): die Fälle F1–F4.

### Unit Test zur Bug-Reproduktion

Der Fehler entsteht nur aus der Reihenfolge echter Antworten im Browser; die Reproduktion ist deshalb der **E2E-Fall F1** (Probe E), vorgeschlagen als `e2e/tests/r00110-neueste-antwort.spec.js`. Ohne Fix rot, mit Fix grün. Er steht vor der ersten Bubble als erwartet roter Test (`test.fail` mit Verweis auf #76) und wird beim Bau ohne Umdeutung grün.

Herstellen der Reihenfolge (verzögert antwortender Fake an der Grenze des Browsers, nicht im eigenen Code): `page.route` hält die betreffende Antwort fest, bis der Test sie freigibt. Gewartet wird nur auf Ereignisse:

1. auf den aufgelösten Route-Handler (die gehaltene Antwort ist ausgeliefert),
2. danach auf `window.kdTest.gezeichnet()` (`web/app.js:2143`),
3. erst dann wird geurteilt.

Keine feste Pause; die 1,5 s der Probe E gehören nicht in den Test. Verzögerungen (0, 250, 400 ms) sind Teil der Herstellung, nicht des Wartens.

### Code-Extraktion für isoliertes Testing

Die Regeln 2 und 3 als reine Funktion `uebernehmen({ start, zuletzt, marke, schlangeOffen })` in einem eigenen Modul im Stil von `web/verbindung.js` (Vorschlag `web/uebernahme.js`), Einheitstest Vorschlag `e2e/einheit/uebernahme.test.js`.

### Regressionstests

- `e2e/tests/r00050-live-waehrend-anfragen.spec.js` (US-1 „Ruhige Liste“), `r00037-teilaufgaben-schnell.spec.js`, `r00061-ruhezustand.spec.js`, `r00085-live-verbindung.spec.js`, `r00103-sichtzustand.spec.js` bleiben grün.
- F1 mit 0 ms Verzögerung unter CPU-Drossel 6× läuft als Regression mit; sie tritt nicht als Nachweis gegen eine Mutante an (rot nur 1 von 4 Läufen).
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`.

## Akzeptanzkriterien

Gegeben jeder E2E-Prüfung: Board `entwicklung`, Aufgabe #1 „Abnahme prüfen“ ohne Teilaufgaben, Aufgabe #2 „Board aufräumen“; Person `st` (Mensch) im Browser, Live-Verbindung steht (`data-live="verbunden"`); der Agent `bot` schreibt über die API. „Fremde Änderung“ heißt: `bot` ändert den Titel von #2 in „Board aufräumen lassen“.

### Bug behoben (Pflicht)
- [ ] Der Reproduktionstest F1 ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün (`cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`)

### Prüfung `uebernehmen` (Unit)
- [ ] Älter als gezeigt: `{ start: 3, zuletzt: 5, marke: 0, schlangeOffen: 0 }` → `false`
- [ ] Neuer: `{ start: 6, zuletzt: 5, marke: 0, schlangeOffen: 0 }` → `true`
- [ ] Schlange offen: `{ start: 6, zuletzt: 5, marke: 0, schlangeOffen: 1 }` → `false`
- [ ] Marke: `{ start: 4, zuletzt: 2, marke: 4, schlangeOffen: 0 }` → `false` (`start` ≤ Marke); `{ start: 5, zuletzt: 2, marke: 4, schlangeOffen: 0 }` → `true`
- [ ] Gleichstand: `{ start: 5, zuletzt: 5, marke: 0, schlangeOffen: 0 }` → `false` (übernommen wird nur „größer als zuletzt“, Regel 2)

### F1 — Alte Antwort nach neueren (Probe E)
- [ ] Beispiel: Gegeben das Fenster von #1 ist offen und zeigt „TEILAUFGABEN 0/0“, die Datei von #1 enthält keine Teilaufgabe; wenn `bot` die fremde Änderung schreibt, das `GET /api/aufgaben` aus dem dadurch ausgelösten Laden gehalten wird, `st` „neu“ + Enter eingibt und die gehaltene Antwort erst freigegeben wird, nachdem zwei neuere Ladevorgänge übernommen sind, dann enthält die Datei `- [ ] neu`, und das Fenster zeigt 1 Teilaufgabe „neu“ und „TEILAUFGABEN 0/1“ — heute 0 und „0/0“
- [ ] Monotonie: Ein MutationObserver protokolliert über den ganzen Lauf die Anzahl `.chk` im Fenster; sie fällt nie (heute 0, 1, 1, 0)
- [ ] Gegenprobe nach Neuladen: Nach `page.reload()` und Öffnen von #1 zeigt das Fenster 1 Teilaufgabe und „TEILAUFGABEN 0/1“
- [ ] Verzögerungen: F1 läuft mit 250 ms und 400 ms Verzögerung der gehaltenen Antwort, jeweils grün; dazu 0 ms unter CPU-Drossel 6× als Regression
- [ ] Live-Auflage (PO Z. 150): Derselbe MutationObserver hält über den ganzen Lauf fest, dass `.kz-live` („nicht live“, `web/ansicht.js:67`) nie erscheint und `data-live="verbunden"` an `<html>` nie wegfällt. Wird diese Prüfung rot, meldet der Bau sie als eigenen `befund`; R00110 baut dafür nichts
- [ ] Fremde Änderung kommt an: Am Ende zeigt Karte #2 „Board aufräumen lassen“

### F2 — Alte Antwort vor dem Laden der Warteschlange (Regel 3)
- [ ] Beispiel: Gegeben dasselbe Vorher wie F1; wenn das `GET /api/aufgaben` des Ereignis-Ladens gehalten wird, `st` „neu“ + Enter eingibt, das erste `GET /api/zustand` nach der Antwort auf den `POST …/teilaufgaben` (das Laden der Warteschlange) ebenfalls gehalten wird und zuerst die alte Antwort, danach das Laden der Warteschlange freigegeben wird, dann fällt die Anzahl `.chk` nie (MutationObserver), und am Ende gelten Datei, Liste, „TEILAUFGABEN 0/1“ und die Gegenprobe nach Neuladen wie in F1

### F3 — Fensterwechsel (Regel 6)

*(Auslöser nachgezogen: Betreiber-Entscheidung 2026-11-12 (#144) streicht das Blättern; der Fall prüft das Schließen und Öffnen einer anderen Aufgabe — R00144 FA 9, ADR-0018 Nachtrag N2 Grenze.)*
- [ ] Beispiel: Gegeben das Fenster von #1 ist offen und der Reiter „Datei“ zeigt die Datei von #1; wenn `GET /api/aufgaben/1` eines erneuten Ladens gehalten wird, `st` das Fenster von #1 schließt und #2 öffnet und danach die Antwort für #1 freigegeben wird, dann zeigt die Ansicht „Datei“ die Datei von #2 (`id: 2`, „Board aufräumen“) — nicht die von #1
- [ ] Gegenprobe nach Neuladen: Nach `page.reload()` und Öffnen von #2 zeigt der Reiter „Datei“ dieselbe Datei von #2

### F4 — Markierung „extern“ (Regel 7)
- [ ] Beispiel: Gegeben die Herstellung wie in F1, wobei das Laden des Ereignisses verworfen wird, weil ein neueres übernommen ist; dann trägt Karte #2 innerhalb der 10 s, die die Markierung steht, die Markierung einer fremden Änderung (Klasse `fremd` und Hinweis „extern · aufgaben/0002-…“) — heute fehlt sie, sobald das Laden des Ereignisses nichts zeichnet

### Mutanten (Abnahme-Probe, test-ehrlichkeit)
Je Fall wird die Stelle per `page.route` auf die ausgelieferte Datei, die sie enthält (`**/web/app.js` bzw. das Modul der Prüfung), ersetzt; greift der Ersatz nicht, wirft die Route. Kein Mutant wird ins Repository geschrieben.
- [ ] F1 wird rot, wenn `uebernehmen` immer `true` liefert (bei 250 ms und bei 400 ms)
- [ ] F2 wird rot, wenn nur die Marke entfernt ist und die Monotonie bleibt; F1 allein bemerkt diese Mutante nicht
- [ ] F3 wird rot, wenn der Vergleich mit `S.ui.offen` entfernt ist
- [ ] F4 wird rot, wenn das Merken der Pfade in `ereignis()` entfernt ist
- [ ] Das Ergebnis jeder Mutantenprobe (Fall, Mutante, rot ja/nein) steht im Bericht des Baus

### Wächter der Übernahmestellen (Unit, PO Z. 151)
- [ ] `ERLAUBT` nennt `laden`, `dateiLaden`, `defektLaden`, je mit der Zahl ihrer Übernahmen nach dem Bau; eine zusätzliche Übernahme in einer erlaubten Funktion macht den Wächter ebenso rot wie eine in einer fremden Funktion
- [ ] Als Übernahme zählen `S.<feld> = …` und `Object.assign(S, …)` mit einem der Felder `S.aufgaben`, `S.board`, `S.zustand`, `S.ui.datei`, `S.ui.defektDatei`; Rücksetzen auf `null` oder `[]` zählt nicht (heute Übernahmen `web/app.js:176`, `:215`, `:285`, `:292`; Rücksetzungen `:282`, `:286`, `:295`, `:1625`)
- [ ] Jede erlaubte Funktion ruft `uebernehmen(` auf
- [ ] Mutante 1: eine zusätzliche Zeile `S.aufgaben = (await api('GET', '/api/aufgaben')).aufgaben` in einer anderen Funktion macht den Wächter rot
- [ ] Mutante 2: `dateiLaden` ohne den Aufruf von `uebernehmen(` macht den Wächter rot
- [ ] Die Meldung nennt Datei, Zeile und Funktion
- [ ] Beide Mutanten werden in einem eigenen Arbeitsbaum geprobt und sauber zurückgelegt; der Wächter ersetzt die E2E-Mutanten F1–F4 nicht

## Implementierungshinweise

- Muster des Wächters: `e2e/einheit/fokus.test.js:94–100` (Liste `ERLAUBT`, Zählung je Funktion, PO Z. 109).
- „Zuletzt übernommen“ wird je Übernahmeziel geführt: einmal für den Hauptstand aus `laden()`, einmal für die Datei des Fensters aus `dateiLaden()`/`defektLaden()`. Nur so passt Regel 2 (Gleichstand → verwerfen) zu Regel 6 (`dateiLaden()` innerhalb von `laden()` läuft unter dessen Nummer): der Hauptstand ist mit `start` übernommen, die Datei des Fensters noch nicht. Der Takt bleibt einer für alle (Regel 1).
- `laden()` gibt heute schon `false` zurück, wenn bei `nurBeiAenderung` nichts geändert ist (`ereignis()` prüft `neu === false`, `web/app.js:2085`). Für Regel 7 muss `ereignis()` „verworfen“ von „unverändert“ unterscheiden können; wie, entscheidet der Bau — die Akzeptanzkriterien prüfen nur das beobachtbare Ergebnis.
- Rund 9 Aufrufer von `laden()` bekommen in seltenen Fällen `false` und zeichnen dann nicht selbst. Wer danach `render()` aufruft (z. B. `act()` `web/app.js:1404`), zeichnet den gezeigten Stand; das ist richtig und kein Fehler.
- Lastprofil (`AI-Team/umgebung.md`): bis 5 Schreibaufrufe je Sekunde, Live < 1 s, 1–3 Tabs. Die Prüfung stellt keine Anfrage an den Server.
- Bewusst in Kauf genommen (ADR-0014): verworfene Antworten kosten Netzlast; die Reihenfolge gilt nur je Tab; was der Server zwischen zwei Anfragen eines Ladens ändert, bleibt ein Mischstand, den das nächste Ereignis neu zeichnet. Restrisiko: Umordnung von Anfragen auf dem Server (ungemessen, X00001).

## Offene Fragen

- Entschieden vom Product Owner: `AI-Team/po-entscheidungen.md`, Z. 150 (Lesart des Nebenbefunds, Live-Auflage in F1) und Z. 151 (Wächtertest in #76)

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass jede Antwort übernommen wird, sobald sie ankommt, egal wann sie gefragt wurde. Bekommt jedes Laden beim Start eine Nummer und darf nur übernehmen, wer neuer ist als das Gezeigte, kann eine alte Antwort einen neueren Stand nicht mehr überschreiben (F1). Weil eine Antwort, die vor der eigenen Eingabe gelesen wurde, durch die Marke der Warteschlange als veraltet gilt, verschwindet auch eine optimistisch gezeigte Teilaufgabe nicht mehr zwischen Eingabe und Speichern (F2). Prüft das Fenster zusätzlich, ob es noch die Aufgabe zeigt, für die es geladen hat, zeigt es nach schnellem Schließen und Öffnen einer anderen Aufgabe nie die Datei der vorigen (F3), und das Merken der Pfade erhält den Hinweis auf fremde Änderungen, wenn ein Laden verworfen wird (F4). Weil alles aus einem Laden zusammen oder gar nicht übernommen wird, kommen Liste, Abschnittskopf und Reiter „Datei“ aus demselben Stand — das Fenster widerspricht sich nicht mehr. Der Hebel sitzt im Browser, weil der Fehler dort entsteht; Server und API bleiben unverändert. Der Wächter verhindert, dass die nächste Übernahmestelle die Regel still umgeht, und die Mutanten belegen, dass jeder Fall seine Regel tatsächlich prüft.

## Notizen

- Priorität: Hoch (Klasse Vorrang) — eine gespeicherte Eingabe erscheint als verloren, unter Agentenlast regelmäßig
- Betroffene Nutzer/Systeme: jeder Mensch mit offenem Aufgabenfenster, während Agenten oder ein zweiter Browser schreiben; mittelbar jede Sicht, die `laden()` zeichnet
- Workaround: Seite neu laden oder auf die nächste fremde Änderung warten
- Herkunft: Befundkarte #76 „Bug: ältere Antwort von laden() überschreibt neueren Stand (Teilaufgaben 0/0 trotz Datei)“, gefunden vom architekt bei #75 (Probe E); Abnahme-Idee der Karte „Probe E als E2E-Test; Endzustand = Datei, Anzahl fällt nie“ steht in F1 (Beispiel und Monotonie); ADR-0014 (`9645f42`, Nachtrag N1 `ee75418`)
- Nicht Umfang: Option B (Abbruch zur Senkung der Netzlast) — eigene Karte erst nach einer Messung
- Keine Oberfläche ändert sich: kein neuer Zustand, kein Artboard
