# ADR-0014: Nur die neueste Antwort wird übernommen — eine laufende Nummer je Laden im Browser, Übernahme nur über eine reine Prüfung

**Status**: Akzeptiert
**Datum**: 2026-11-07
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #76 „Bug: ältere Antwort von laden() überschreibt neueren Stand (Teilaufgaben 0/0 trotz Datei)“; Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: Probe E aus #75 (5 von 5 rot) und ihre Wiederholung mit Netzprotokoll unter #76 (3 von 3 reproduziert, siehe Kontext). Die gewählte Option braucht keinen Server und keine neue Bibliothek; ob sie wirkt, zeigt die Mutantenprobe der Abnahme.

## Kontext

Die Oberfläche hält ihren ganzen Stand in einem Objekt `S` (`web/app.js:2`). `laden()` (`web/app.js:175`) holt ihn in mehreren Anfragen neu und übernimmt ihn seit R00061 auf einmal (`Object.assign(S, …)`, `web/app.js:215`), damit nie ein halber Stand gezeichnet wird. Neu geladen wird von vielen Stellen, ohne dass einer vom anderen weiß:

- **Live-Ereignis**: `ereignis()` (`web/app.js:2082`) ruft `laden({ nurBeiAenderung: true })`. Es prüft `schlangeOffen > 0` nur beim Start (`:2083`). Ein Laden, das schon läuft, wenn eine eigene Schreibanfrage eingereiht wird, läuft weiter.
- **Warteschlange**: Sie lädt neu, sobald sie leer ist (`web/app.js:326`).
- **Aktionen**: `act()` und viele Einzelaktionen rufen `laden()` nach dem Schreiben. Das gilt auch für den Fehlerpfad `:1402`.
- **Wiederverbinden**: `web/app.js:2118`.
- **Fenster**: `oeffnen` (`:837`) und `blaettern` (`:843`) rufen `dateiLaden()` (`:290`) direkt auf, ohne Laden davor.

Nirgends wird geprüft, ob die Antwort, die gerade übernommen wird, noch die neueste ist. **Es gewinnt, wer zuletzt ankommt, nicht wer zuletzt gefragt hat.** Ungeschützt übernommen wird an vier Stellen:

1. `S.zustand` sofort beim Eintreffen (`:176`), also noch vor dem Rest und außerhalb der Übernahme auf einmal.
2. Der Hauptblock (`:215`).
3. `dateiLaden()` (`:290–296`).
4. `defektLaden()` (`:279–288`).

`serverStand()` (`:171`) und `nurBeiAenderung` (`:221`) verhindern das Neuzeichnen nur dann, wenn sich der Stand nicht geändert hat. Die ältere Antwort unterscheidet sich aber vom gezeichneten Stand, deshalb wird sie sogar gezeichnet.

**Beleg: Probe E, wiederholt unter #76.** Das Fenster von #1 ist offen. Eine fremde Änderung an #2 löst ein Ereignis aus, `GET /api/aufgaben` kommt 400 ms verzögert, und währenddessen wird „neu“ als Teilaufgabe eingegeben. Netzprotokoll in ms seit der ersten Anfrage, Lauf 0:

| Zeit | Vorgang |
|---|---|
| 156 | Laden L1 (aus dem Ereignis) startet |
| 184 | L1 fragt `GET /api/aufgaben` (wird gehalten) |
| 250 | `POST …/teilaufgaben` (Warteschlange) |
| 267 | Laden L2 (Warteschlange leer) startet |
| 283 | L2 übernimmt den Stand mit „neu“ |
| 418 | Laden L3 (Echo des eigenen Commits) startet |
| 471 | L3 übernimmt den Stand mit „neu“ |
| 635 | Antwort von L1 kommt an und überschreibt `S.aufgaben` mit dem Stand ohne „neu“ |
| 637–674 | L1 lädt danach `dateiLaden()` frisch |

Endbild nach 1,5 s, in allen drei Läufen gleich:
- Die Datei enthält `- [ ] neu`.
- Die Liste im Fenster hat 0 Einträge, der Abschnittskopf zeigt „TEILAUFGABEN 0/0“.
- Der Reiter „Datei“ (aus `S.ui.datei`) zeigt dagegen schon den neuen Inhalt. Dasselbe Fenster widerspricht sich also selbst.
- Erst die nächste fremde Änderung heilt die Anzeige: 2 s später zeigt die Liste 1 Eintrag. „Dauerhaft“ heißt deshalb: bis zum nächsten übernommenen Laden.

**Zweiter Beleg ohne Verzögerung.** Im Code-Review #75 (A5) wurde US-1 von R00050 bei 0 ms und CPU-Drossel 6× einmal in 4 Läufen rot (`crev-75/wdh/b-instr.log:48`). Ein Laden, das bei kurz leerer Warteschlange gestartet war, zeichnete einen älteren Stand. Das Rennen braucht also kein künstlich langsames Netz.

**Lastprofil** (`AI-Team/umgebung.md`): Live-Änderung in allen Sichten < 1 s, bis 5 schreibende Aufrufe je Sekunde durch Agenten, 1–3 Tabs. Bei 5 Ereignissen je Sekunde überlappen sich Ladevorgänge regelmäßig, sobald ein Laden länger als 200 ms dauert.

Der Server kennt keine Versionsnummer seines Stands: kein `ETag`, kein `If-None-Match`, keine Revision in den Antworten (`grep -rni "etag\|revision" src/` ohne Treffer).

## Optionen

### Option A: Laufende Nummer im Browser, Übernahme nur über eine reine Prüfung

Jedes Laden zieht beim Start eine Nummer aus einem Zähler. Vor jeder Übernahme in `S` fragt eine reine Funktion, ob diese Nummer noch übernommen werden darf. Ist sie veraltet, verwirft das Laden seine Antwort vollständig: nichts übernehmen, nichts zeichnen, Rückgabe `false`.

- **Vorteile**
  - Nur im Browser; Server und API bleiben unverändert.
  - Eine Regel für alle vier Übernahmestellen.
  - Die Prüfung ist eine reine Funktion und damit per `node --test` prüfbar.
  - Die Mutante „Prüfung immer wahr“ ist eine Zeile.
- **Nachteile**
  - Eine verworfene Antwort hat Netzlast gekostet.
  - Die Reihenfolge gilt nur innerhalb eines Tabs. Zwei Tabs bleiben unabhängig, was richtig ist, weil jeder seinen eigenen Stand zeigt.
- **Schwäche:** Die Nummer ordnet die Anfragen, nicht den Stand auf dem Server. Eine später gestartete Anfrage kann auf dem Server einen älteren Stand lesen, wenn der Server Anfragen umordnet. Bei einem Prozess mit Sperre im Schreibweg (X00001) tritt das nicht auf, gemessen ist es aber nicht.

### Option B: `AbortController` — das vorige Laden wird abgebrochen

`api()` (`:86–94`) bekommt ein `signal`. Jedes neue Laden bricht das laufende ab.

- **Vorteile**
  - Spart die Netzlast der veralteten Antwort.
  - Standard des Browsers.
- **Nachteile**
  - Ein Abbruch wirkt nur, solange `fetch` noch läuft. Ist die Antwort schon da und das Laden steht in einem späteren `await` (`:203–212`, `dateiLaden` danach), übernimmt es trotzdem. Man braucht also zusätzlich eine Prüfung wie in Option A.
  - Jeder Aufrufer muss `AbortError` von echten Fehlern trennen, sonst landet ein Abbruch in `fensterFehler` oder im `catch` von `act()` (`:1400–1402`).
  - Bei 5 Ereignissen je Sekunde und einem Laden über 200 ms bricht jedes Laden das vorige ab, und es wird nie fertig. Die Anzeige verhungert.
- **Schwäche:** Allein löst Option B das Problem nicht, mit Option A zusammen ist sie nur Optimierung.

### Option C: Version vom Server (`ETag`, Commit-Hash oder laufende Revision) in jeder Antwort

Der Server liefert zu jeder Antwort seine Revision. Der Browser übernimmt nur eine Antwort, deren Revision nicht kleiner ist als die gezeigte.

- **Vorteile**
  - Echte Reihenfolge des Stands, auch über Tabs und Umordnungen hinweg.
  - Ein `If-None-Match` könnte später unveränderte Antworten sparen.
- **Nachteile**
  - Der Server bekommt ein neues Feld an jeder Leseantwort (rund 10 Endpunkte allein in `laden()`).
  - Die Revision muss bei Änderungen von außen (Wächter, `src/waechter.rs`) und bei Commits gleich weiterzählen.
  - Ein Laden besteht aus mehreren Antworten mit womöglich verschiedenen Revisionen. Man bräuchte eine Regel, welche zählt, oder einen Endpunkt für den ganzen Stand.
  - Ein Commit-Hash hat keine Reihenfolge, man bräuchte zusätzlich einen Zähler.
- **Schwäche:** Großer Eingriff in Server und API für einen Fehler, der im Browser entsteht. Den Fall „optimistisch gezeigt, aber noch nicht gespeichert“ (siehe Regel 3) löst Option C auch nicht.

### Option D: Einzelflug — höchstens ein Laden zugleich, danach einmal nachladen

Ein laufendes Laden blockiert neue. Wer während des Ladens laden will, setzt eine Marke, und nach dem Ende wird genau einmal nachgeladen.

- **Vorteile**
  - Weniger Last bei Ereignisserien.
  - Kein Überlappen, also auch keine veraltete Antwort aus einem Überlappen.
- **Nachteile**
  - `oeffnen` und `blaettern` laden ihre Datei unabhängig vom Laden. Sie müssten mit in den Einzelflug, sonst bleibt das Rennen dort bestehen.
  - Ein Laden, das vor einer optimistischen Änderung gestartet ist, überschreibt sie trotzdem, wenn es danach ankommt. Das ist genau der Fall aus Probe E, wenn L1 vor L2 ankommt.
  - Viele Aufrufer warten auf `laden()` und erwarten danach den neuen Stand (`await laden(); render()`). Sie bekämen ein geteiltes Versprechen mit anderer Bedeutung.
- **Schwäche:** Verhindert das Überlappen, nicht das Übernehmen eines Stands, der vor der eigenen Änderung gelesen wurde.

## Entscheidung

**Gewählt: Option A.** Option B und Option D bleiben spätere Optimierungen, falls die Netzlast messbar stört.

1. **Ein Takt.** Ein Zähler im Browser (Vorschlag: `takt`) zählt jeden Start von `laden()`, `dateiLaden()` und `defektLaden()` hoch. Jedes Laden merkt sich seine Nummer `start`.
2. **Monoton.** Eine Antwort wird nur übernommen, wenn ihr `start` größer ist als die Nummer der zuletzt übernommenen Antwort. Danach gilt: zuletzt übernommen = `start`.
   Es zählt also „neuer als das Gezeigte“, nicht „das zuletzt Gestartete“. Deshalb kann bei 5 Ereignissen je Sekunde nichts verhungern: Jedes Laden, das neuer ist als das Gezeigte, kommt durch, und nur ältere werden verworfen.
3. **Eigene Änderungen schützen.** Solange die Warteschlange offen ist (`schlangeOffen > 0`), wird keine Antwort übernommen. Wird sie leer, setzt sie vor ihrem eigenen Laden eine Marke auf den aktuellen Takt. Jede Antwort mit `start` ≤ Marke ist veraltet, denn sie hat den Server gelesen, bevor die eigenen Schreibanfragen gespeichert waren.
   Ohne diese Regel überschreibt ein Laden, das vor der optimistischen Änderung gestartet ist und vor dem Laden der Warteschlange ankommt, die Änderung trotzdem. Die Anzahl fiele dann kurz und stiege wieder.
4. **Eine reine Prüfung.** Die Regeln 2 und 3 stehen in einer reinen Funktion, im Browser und in Node nutzbar, im Stil von `web/verbindung.js`. Vorschlag:
   `uebernehmen({ start, zuletzt, marke, schlangeOffen })` → `true | false`.
   Aufgerufen wird sie unmittelbar vor jeder Übernahme in `S`, und nirgends sonst wird diese Entscheidung getroffen.
5. **Alles oder nichts.** `laden()` sammelt auch `S.zustand` (heute `:176`) und die abgeleiteten Felder (`einstellungenDefekt`, `ui.first`, `ui.view`, `ui.slug`) zuerst lokal und übernimmt sie im selben Schritt wie `:215`. Damit gilt R00061 auch für den Zustand.
   Ein verworfenes Laden:
   - ruft kein `dateiLaden()` und kein `defektLaden()`,
   - setzt `geladenerStand` nicht,
   - zeichnet nicht,
   - gibt `false` zurück.
6. **Das Fenster.** `dateiLaden()` und `defektLaden()` prüfen mit demselben Takt und zusätzlich, ob `S.ui.offen` bzw. `S.ui.offenDefekt` noch die Nummer ist, für die sie gestartet wurden. Sonst zeigt nach schnellem Blättern Fenster #2 die Datei von #1.
   Innerhalb von `laden()` laufen sie als Teil desselben Ladens, unter dessen Nummer.
7. **Markierung „extern“.** `ereignis()` setzt `S.extern` heute nur, wenn sein eigenes Laden zeichnet (`:2085`). Wird dieses Laden verworfen, weil ein neueres gewinnt, merkt sich `ereignis()` die Pfade und setzt die Markierung beim nächsten übernommenen Laden. Sonst ginge der Hinweis auf eine fremde Änderung still verloren.
8. **Durchsetzung.** Drei Proben, siehe Abschnitt „Abnahme-Idee“ in den Folgeaufgaben:
   - E2E-Probe nach Probe E: Endzustand gleich Datei, Anzahl fällt nie.
   - Mutante „Prüfung immer wahr“: Die E2E-Probe muss rot werden.
   - Unit-Test der reinen Prüfung.

Was überwiegt: Der Fehler entsteht im Browser, und dort ist er mit einer Zahl und einer reinen Funktion zu schließen. Server und API bleiben, wie sie sind.

Bewusst in Kauf genommen:
- Verworfene Antworten kosten Netzlast.
- Die Reihenfolge gilt nur innerhalb eines Tabs.
- Was der Server zwischen zwei Anfragen eines Ladens ändert, bleibt wie heute ein Mischstand. Das nächste Ereignis zeichnet ihn neu.

## Konsequenzen

**Positiv:**
- Die Anzeige ist monoton: Kein gezeigter Stand wird von einem älteren ersetzt, auch nicht unter 5 Schreibzugriffen je Sekunde.
- Eine optimistische Änderung verschwindet nicht mehr zwischen Eingabe und Speichern.
- Das Fenster widerspricht sich nicht mehr: Liste und Kopf des Abschnitts kommen aus demselben übernommenen Laden wie der Reiter „Datei“.
- Die Regel ist eine Funktion mit eigenem Test. Neue Übernahmestellen haben ein Vorbild.

**Negativ / Inkauf zu nehmen:**
- Rund 9 Aufrufer von `laden()` (`grep -c "await laden()" web/app.js`) bekommen in seltenen Fällen `false` zurück und zeichnen dann nicht selbst. Wer danach `render()` aufruft (zum Beispiel `act()` `:1404`), zeichnet den gezeigten Stand, und das ist richtig.
- Ein Test, der sich auf „nach `laden()` steht der neue Stand in `S`“ verlässt, kann bei überlappendem Laden anders ausgehen als vorher. Gemeint ist das Verhalten, nicht ein Fehler des Tests.
- Neue Übernahmestellen müssen die Prüfung aufrufen. Ein direktes `S.x = await api(…)` umgeht sie still. Dagegen hilft der Wächtertest aus den Folgeaufgaben.

**Folgeentscheidungen / Aufgaben:**
- [ ] Abnahme-Idee an den planer:
  - E2E-Test nach Probe E: Fenster offen, fremde Änderung, `GET /api/aufgaben` verzögert, Eintrag tippen. Prüfungen:
    - Endzustand: Liste und Kopfzähler gleich Datei.
    - Die Anzahl `.chk` im Fenster fällt nie, beobachtet per MutationObserver.
    - Je Verzögerung 0, 250 und 400 ms.
  - Zweiter Fall: Blättern von #1 nach #2 mit verzögertem `GET /api/aufgaben/1`. Das Fenster zeigt am Ende die Datei von #2.
  - Mutante nach dem Muster aus #75 (`page.route('**/web/app.js', …)` ersetzt die Prüfung durch `true` und wirft, wenn der Ersatz nicht greift): Der E2E-Test muss rot werden.
  - Unit-Test unter `e2e/einheit/` für die reine Prüfung. Er deckt mindestens ab:
    - älter als gezeigt → verwerfen
    - neuer → übernehmen
    - Schlange offen → verwerfen
    - `start` ≤ Marke → verwerfen
    - Gleichstand
- [ ] Wächtertest nach dem Muster von `e2e/einheit/fokus.test.js` (Liste `ERLAUBT`): Zuweisungen an `S.aufgaben`, `S.board`, `S.zustand`, `S.ui.datei`, `S.ui.defektDatei` aus einer Antwort nur an den erlaubten Stellen. Ob er in #76 oder später kommt, entscheidet der planer (Empfehlung: in #76, weil die Regel sonst beim nächsten Bau umgangen wird).
- [ ] Ob Option B (Abbruch) die Netzlast unter 5 Ereignissen je Sekunde messbar senkt, ist eine eigene Karte, erst nach einer Messung.

## Nachtrag N1 2026-11-07: Vergleichstabelle und geschärfte Abnahme

Die Entscheidung bleibt unverändert. Ergänzt werden zwei Dinge:
- die Vergleichstabelle nach Skill `optionen-vor-entscheidung`,
- die Abnahme-Idee, geprüft gegen die Skills `test-pyramide` und `test-ehrlichkeit`.

### Vergleich

| # | Option | Komplexität | Testbarkeit | Reversibilität | Risiko | Last bei 5 Schreibzugriffen/s |
|---|---|---|---|---|---|---|
| A | Laufende Nummer im Browser plus reine Prüfung | gering, nur `web/app.js` und ein reines Modul | sehr gut: Unit-Test der Prüfung, Mutante in einer Zeile | hoch, eine Prüfung entfernen | niedrig; Restrisiko ist die Umordnung auf dem Server (ungemessen) | verworfene Antworten kosten Netzlast |
| B | `AbortController` | mittel, `signal` und Behandlung von `AbortError` an jedem Aufrufer | mittel, der Abbruch hängt am Zeitpunkt | hoch | hoch: allein unwirksam nach dem Eintreffen, die Anzeige verhungert | geringste Last |
| C | Version vom Server | hoch, rund 10 Endpunkte, Zähler über Wächter und Commits | gut, die Revision ist beobachtbar | gering, die API ändert sich nach außen | mittel: Antworten eines Ladens mit verschiedenen Revisionen; der optimistische Fall bleibt offen | wie A |
| D | Einzelflug mit einmal Nachladen | mittel, geteiltes Versprechen für rund 9 Aufrufer | mittel | mittel | mittel: der optimistische Fall bleibt offen, `dateiLaden` liegt außerhalb | gering |

Gewählt bleibt A. Was überwiegt und welche Schwäche in Kauf genommen wird, steht unter „Entscheidung“.

### Abnahme-Idee, geschärft

**Ebenen**
- **Unit** (`e2e/einheit/`): die reine Prüfung, Fälle wie unter „Folgeaufgaben“.
- **Integration**: entfällt mit Grund. Server und API ändern sich nicht. Die einzige neue Grenze ist die zwischen Browser und API, und die prüft E2E über den echten Einstieg.
- **E2E**: im Bestand der Suite, mit `e2e/tests/hilfen.js` als Treiber.

**Je E2E-Fall gilt**
- **Vorher und nachher.** Vorher ist im Fenster 0 Teilaufgaben angezeigt und die Datei enthält keine. Nachher enthält die Datei `- [ ] neu`, und Liste und Zähler „TEILAUFGABEN“ zeigen 1.
- **Neu laden zur Gegenprobe.** Nach Seitenneuladen zeigt das Fenster ebenfalls 1. Das beweist die Speicherung, nicht den Speicher im Browser.
- **Warten auf ein Ereignis, keine feste Pause.**
  - Auf das Ende der gehaltenen Antwort, also den aufgelösten Route-Handler.
  - Dann auf `kdTest.gezeichnet()` (`web/app.js:2143`).
  - Erst danach wird geurteilt. Die 1,5 s Pause der Probe E gehören nicht in den Test.
- **Monotonie.** Ein MutationObserver protokolliert die Anzahl `.chk` im Fenster. Sie fällt nie.

**Fälle und Mutanten** (Mechanismus aus #75: `page.route('**/web/app.js', …)` mit Wurf, wenn der Ersatz nicht greift)

| Fall | Herstellung | Mutante, die rot werden muss |
|---|---|---|
| F1 Alte Antwort nach neueren | Probe E: `GET /api/aufgaben` aus dem Ereignis wird gehalten, bis zwei neuere Ladevorgänge übernommen sind | Prüfung liefert immer `true` |
| F2 Alte Antwort vor dem Laden der Warteschlange (Regel 3) | Die gehaltene Antwort wird freigegeben, nachdem der POST beantwortet ist und bevor das Laden der Warteschlange startet, zum Beispiel durch Halten auch des ersten `GET /api/zustand` nach dem POST | nur die Marke entfernt, die Monotonie bleibt. F1 allein bemerkt diese Mutante nicht |
| F3 Blättern (Regel 6) | Fenster #1 offen, `GET /api/aufgaben/1` gehalten, Blättern nach #2, dann freigeben. Nachher: Reiter „Datei“ zeigt die Datei von #2 | Vergleich mit `S.ui.offen` entfernt |
| F4 Markierung „extern“ (Regel 7) | Wie F1, das Laden des Ereignisses wird verworfen. Nachher trägt Karte #2 die Markierung einer fremden Änderung | Merken der Pfade entfernt |

- **Verzögerung 0 ms unter CPU-Drossel** läuft nur als Regression mit. Rot wurde sie nur einmal in 4 Läufen (`crev-75/wdh/b-instr.log:48`), deshalb tritt sie nicht als Nachweis gegen eine Mutante an.
- **Nachweis gegen Mutanten** führen nur F1–F4, weil sie die Reihenfolge der Antworten festlegen.

## Nachtrag N2 2026-11-07: Regeln nach dem Bau — je Ziel, Markierung vom Überholenden, Umschalten als Übernahme

Nachgetragen nach dem Merge von #76 (R00110, kanbanD `eb5a81f`). Der Bau hat drei Regeln geschärft, die der Text oben offen ließ. Belege aus `web/app.js` und `web/uebernahme.js` auf `eb5a81f`.

**Zu Regel 2 (Monotonie): je Ziel.** Ein Takt für alle Ladevorgänge (`takt`, `web/app.js:175–176`), aber zwei Stände „zuletzt übernommen“:
- `zuletztStand` für den Hauptstand. Gelesen und gesetzt nur in `laden` (`web/app.js:190`, `:194`).
- `zuletztFenster` für das Aufgabenfenster. Gelesen und gesetzt in `defektLaden` (`:315`, `:319`, `:324`) und `dateiLaden` (`:336`, `:342`, `:346`).

Ein Laden des Fensters (Öffnen, Blättern: `act` `:894`, `:900–904`) überholt den Hauptstand also nicht und umgekehrt. Innerhalb von `laden` laufen `dateiLaden` und `defektLaden` unter dessen Nummer (`sichtFolgen`, `:259–260`).

**Zu Regel 7 (Markierung „extern“): der überholende Stand markiert.** Verwirft `laden` die Antwort eines Ereignisses, merkt `ereignis` dessen Pfade und die Spalten von vorher (`externVerworfen`, `:178`, `:2146–2149`). Markiert wird beim nächsten übernommenen Laden (`externNachtragen`, `:206`, `:2169–2173`). Ist schon ein neueres übernommen (`wennVerworfen(zuletztStand > start)`, `:191`), kommt keines mehr nach. Dann markiert sofort der Stand, der das verworfene überholt hat, und es wird gezeichnet (`:2149`). Spalten-Markierungen vergleichen gegen `vorher` des verworfenen Ereignisses, nicht gegen den Stand dazwischen.

**Umschalten des Fensters ist eine Übernahme.** Wechselt das Fenster seine Art (defekt → repariert → normal), rückt „zuletzt übernommen“ dort vor, wo umgeschaltet wird: in `defektLaden` vor dem Umschalten auf „repariert“ (`:319–320`). Eine ältere Antwort „defekt“, die währenddessen eintrifft, schaltet dadurch nicht zurück (Nacharbeit 2). Das folgende `dateiLaden` derselben Nummer (`gleicherTakt: true`, `:321`) gilt als Gleichstand und wird übernommen, obwohl `start` gleich `zuletztFenster` ist.

**Bekannte Schuld (Karte #82).** Der Gleichstand ist nicht als Regel im reinen Modul gebaut. Er steckt als `zuletzt: gleicherTakt ? zuletztFenster - 1 : zuletztFenster` im Aufrufer (`web/app.js:336`). `uebernehmen` (`web/uebernahme.js:9–11`) kennt nur `start > zuletzt`, und der Unit-Test `e2e/einheit/uebernahme.test.js` prüft den Gleichstand nicht. Folgen:
- Die Regel „dieselbe Nummer wird nicht zweimal übernommen“ (Test `:27–29`) hat eine Ausnahme, die nur im Aufrufer steht.
- Ein zweiter Aufrufer mit `gleicherTakt` würde die Ausnahme still erben.

Zielbild für #82: Der Gleichstand wird ein benannter Parameter der reinen Prüfung, zum Beispiel `gleichstandErlaubt`, und bekommt einen eigenen Unit-Fall. Der Wächter (`ERLAUBT`, `:40–45`) bleibt unverändert, weil sich die Übernahmestellen nicht ändern. Keine neue Option, keine Änderung an Regeln 1–8.

**Status bleibt `Akzeptiert`.** Der Bau hat die Wahl A bestätigt. Belege: die Fälle F1–F4 aus Nachtrag N1 samt Mutanten und die Wächtertests `e2e/einheit/uebernahme.test.js:157–247` im Gate des Merges.
