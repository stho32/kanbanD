---
id: R00147
status: Neu
datum: 2026-11-13
ursprung: Bug-Report
ursprungslauf: R00110
---

# R00147: Behebung — ein gescheitertes Nachladen der Warteschlange verschluckt die nächste eigene Änderung

## Beschreibung

Die Warteschlange sendet eigene Änderungen streng nacheinander und lädt danach einmal neu (`warteschlange()`, `web/app.js:433–442`). Ihr letztes Glied ist

```js
.then(() => {
  if (--schlangeOffen > 0) return;
  marke = takt;
  return laden();
})
```

(`web/app.js:436–440`) — **ohne Ablehnungspfad**. Wirft dieses Nachladen (Netzfehler, Server in der Neustartpause, ein Endpunkt der Sammelabfrage antwortet mit Fehler), ist die geteilte Kette `schlange` (`:433`) abgelehnt und bleibt es, bis ein späteres Nachladen gelingt.

Reproduktion (Probe des Architekten, `ADR-0025` Nachtrag N1, drei Läufe gleich; gegen `target/debug/kanbanD` mit Wegwerf-Ordner): Karte #1 mit drei offenen Teilaufgaben, abgehakt über den Kartenknopf `.naechste-ziel` (`data-act="teil-karte"` → `warteschlange()`, `web/app.js:1372–1383`); der **nächste** `GET /api/zustand` wird hart abgelehnt (`fetch` wirft `TypeError: Failed to fetch`), sodass das Nachladen scheitert.

| Schritt | erwartet | heute |
|---|---|---|
| 1. Abhaken; das Nachladen scheitert | die Änderung ist gespeichert, eine Meldung sagt, was geschah | `PATCH …/teilaufgaben/0` geht raus und wird gespeichert; **keine sichtbare Meldung** auf dem Board (die Meldung des `catch` liegt nur in `S.ui.fensterFehler`, den allein der Fuß eines offenen Aufgabenfensters zeichnet, `web/ansicht.js:343`); die unbehandelte Ablehnung erscheint als `pageerror` in der Konsole |
| 2. Abhaken | `PATCH …/teilaufgaben/1` geht raus und wird gespeichert | der `PATCH` wird **nicht gesendet** — die eigene Änderung geht still verloren. Erst jetzt meldet der `catch` „Keine Verbindung zum Server — nichts geändert." — eine Meldung zum gescheiterten **Nachladen**, im Aufgabenfenster neben der gespeicherten Änderung, und dazu falsch: die Änderung *ist* gespeichert |
| 3. Abhaken | wie Schritt 2 | wird wieder gesendet: das Nachladen aus Schritt 2 ist gelungen und hat die Kette geheilt |

Je gescheitertem Nachladen geht also genau die **nächste** eigene Änderung verloren — ohne Commit und, auf dem Board ausgelöst, ohne jede Meldung. Das widerspricht [R00037](R00037-teilaufgaben-schnell-hintereinander.md) FA 1 („die Anfrage wird an eine Warteschlange gehängt, die strikt nacheinander sendet"), R00037 FA 2 (der Fehler wird benannt) und dem Zielbild „Jede Aktion in kanbanD ergibt einen eigenen Commit".

Die technische Entscheidung steht in [ADR-0025](../Dokumentation/ADRs/0025-genau-ein-ausloeser-je-aktion.md) **Regel 3** samt [Nachtrag N1](../Dokumentation/ADRs/0025-genau-ein-ausloeser-je-aktion.md#nachtrag-n1-2026-11-13-probe-zu-80--der-ist-zustand-geschärft-kontext-berichtigt); diese Anforderung macht sie prüfbar und ändert die Entscheidung nicht. Sie baut **nur** das Kettenende: die Sperre am Auslöser (Regel 1/2) ist Karte **#138** (eigener Umfang), die hängende Anfrage Karte **#148**.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git ist das Gedächtnis. Jede Aktion in kanbanD ergibt einen eigenen Commit." Eine Änderung, die still nicht gesendet wird, hinterlässt keinen Commit; und „jede Änderung erscheint sofort in allen offenen Sichten" gilt auch für die eigene.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) (Vorschlag für den Meldungsort)

## Ursachenanalyse

### Root Cause

Belegt am Stand `4f14ef8`:

1. **Das Kettenende hat keinen Ablehnungspfad.** `warteschlange()` (`web/app.js:434–442`) hängt an die geteilte Kette `schlange` (`:433`) vier Glieder: `.then(anfrage)` → `.then(festhalten der Speicherzeit)` → `.catch(fensterMelden)` → `.then(…)` mit `return laden()` (`:436–440`). Der `catch` sitzt **vor** dem letzten `then`; er rettet nur die früheren Glieder. Wirft das letzte Glied, bleibt `schlange` abgelehnt, und im Augenblick der Ablehnung hat sie keinen Handler — sie erscheint als unbehandelte Ablehnung (`pageerror`).
2. **Die nächste Anfrage wird übersprungen.** Der nächste Aufruf baut `schlange.then(anfrage)…`; bei abgelehntem Vorgänger läuft `anfrage` nicht, die Ablehnung wandert bis zum `catch` dieses neuen Aufrufs, der dann meldet (die Lehre „eine geteilte Promise-Kette trägt die Ablehnung ihres letzten Glieds weiter", `AI-Team/gelerntes.md` 2026-11-13). Die eigene Änderung wird **nicht gesendet**, ohne dass ihr Aufrufer es erfährt: `warteschlange` gibt die abgelehnte Kette zurück, die Aufrufer prüfen sie nicht.
3. **Die Meldung nennt den falschen Vorgang und erreicht den Auslöser nicht.** `catch(fensterMelden(f.message))` schreibt nach `S.ui.fensterFehler` (`web/app.js:613–615`); gezeichnet wird das nur im Fuß des Aufgabenfensters (`web/ansicht.js:343`, `role="alert"`). Wer auf dem **Board** abhakt, sieht nichts. Der gemeldete Text „Keine Verbindung zum Server — nichts geändert." (`NETZ_FEHLER`, `web/app.js:88`) beschreibt eine gescheiterte **eigene Anfrage** und ist beim gescheiterten Nachladen sachlich falsch.

Ausgeschlossen: der **hängende** Fall. Antwortet der Server nie (`api()` setzt keine Frist, `web/app.js:90–104`), läuft das letzte `.then` nie und `schlangeOffen` bleibt dauerhaft > 0 — derselbe sichtbare Stillstand aus anderer Ursache. Gemessen steht `schlangeOffen` nach dem **geworfenen** Fall auf `0`, weil `--schlangeOffen` vor `return laden()` steht (`:437–438`); die Kontext-Aussage „der Zähler bleibt stehen" gilt nur fürs Hängen. Das ist die Restlücke der eigenen Karte **#148**, nicht Teil dieser Anforderung.

### Betroffene Komponenten

- `web/app.js`: `warteschlange` (`:433–442`), `laden` (`:211`, wirft über `api`, `:90`), `fensterMelden` (`:613–615`), der Hinweis (`:2952`, `dauer`); Aufrufer der Warteschlange (`:1382`, `:1402`, `:1413`, `:1440`)
- `web/ansicht.js`: `:343` (Fensterfuß, heute der einzige Ort der Meldung) und `:1024` (Hinweis, `role="status"`) — unverändert, nur genutzt
- **neu (Vorschlag)**: ein reines Modul für die Kette, siehe „Code-Extraktion für isoliertes Testing"
- **unverändert**: Server und API; `web/uebernahme.js` — die Gleichstand-Regel ist Karte **#82** (ADR-0014 Nachtrag N2)

## Lösungsvorschlag

### Langfristige Lösung

Option A aus ADR-0025 Regel 3 und deren Nachtrag N1, wörtlich:

1. **Die Schlange endet immer erfüllt.** `warteschlange()` gibt eine Kette zurück, die nach jedem Fehler erfüllt ist; auch ein geworfenes `laden()` hinterlässt keine unbehandelte Ablehnung. `schlangeOffen` wird in **jedem** Fall heruntergezählt, nicht nur im Erfolgszweig.
2. **Je Fehlschlag genau eine Meldung, und sie nennt den richtigen Vorgang.** Ein gescheitertes **Nachladen** darf nicht „nichts geändert" heißen — die eigene Änderung ist gespeichert. Sie ist von der Meldung einer gescheiterten **eigenen Anfrage** unterscheidbar (Vorschlag: „Änderung gespeichert — Ansicht nicht neu geladen (keine Verbindung)").
3. **Die Meldung erreicht den Auslöser.** Wer auf dem Board abhakt, sieht den Fuß des Aufgabenfensters nicht: die Meldung erscheint dort, wo ausgelöst wurde. Vorschlag: der vorhandene Hinweis (D00007, `web/ansicht.js:1024`, `role="status"`, knopflos) — ohne offenes Fenster liegt er unten auf dem Board, bei offenem Fenster in dessen Hinweis-Anker; kein neues Element, kein zweiter Meldungsort. Der Fensterfuß (`fensterMelden`) bleibt der Ort für eine gescheiterte **eigene** Anfrage.
4. **Eine Stelle.** Ablehnungspfad, Zähler und Meldung liegen in `warteschlange()` (`web/app.js`), nicht bei den Aufrufern (ADR-0025 Regel 6); ein Auslöser, der eine Anfrage direkt ruft, ist ein Befund (Review-Punkt). Ein Fehlschlag wird **nicht** zweimal gemeldet.

### Optionen

| | A: Kettenende endet erfüllt (ADR-0025 Regel 3) | B: Ablehnung am Aufrufer abfangen | C: Frist je Anfrage (`AbortController`) | D: Warteschlange auflösen |
|---|---|---|---|---|
| Komplexität | klein: ein Ablehnungspfad, ein Zählerort | mittel: vier Aufrufstellen, jede künftige auch | groß: jeder `api()`-Aufrufer bekommt Fehlerpfad | groß: Umbau des Schreibwegs der Oberfläche |
| Testbarkeit | hoch: Unit der Kette + E2E-Probe wörtlich aus N1 | mittel: eine Probe je Aufrufer | mittel: künstlich hängende Antwort | niedrig: die Reihenfolge (Marke, ADR-0014) wäre neu zu proben |
| Reversibilität | hoch: eine Stelle | mittel | niedrig | niedrig |
| Risiko | gering; deckt genau die Fehlerklasse | die Klasse bleibt für den nächsten Auslöser offen (Regel 6) | deckt den **hängenden** Fall, nicht den geworfenen | Regression an Reihenfolge und Übernahme |
| Sichtbare Änderung | neue Meldung (Text im vorhandenen Hinweis) | keine | keine | keine |

**Entscheidung: A** — durch ADR-0025 Regel 3 bereits entschieden und hier nur umgesetzt.

### Alternative Ansätze

- **B — Ablehnung am Aufrufer abfangen** (jede Aktion hängt ihr eigenes `catch` an `warteschlange(…)`): heilt die heute bekannten Aufrufer, nicht die unbehandelte Ablehnung der geteilten Kette und nicht den nächsten Aufrufer — jeder neue Auslöser erbte den Fehler (gegen ADR-0025 Regel 6).
- **C — Frist je Anfrage** (`AbortController`, ADR-0014 Option B) mit definiertem Fehlerpfad: deckt den **hängenden** Fall (#148), nicht den geworfenen; berührt jeden `api()`-Aufrufer und ist eine eigene Entscheidung (Karte #148).
- **D — Warteschlange ganz auflösen** (jede Aktion als eigene Kette mit globalem Ausgleich): größter Umbau, dieselbe Fehlerklasse an jeder neuen Stelle, und die Reihenfolge (Marke, ADR-0014) müsste neu begründet werden — verworfen.

**Gewählt: A** (ADR-0025 Regel 3) — sie schließt die Fehlerklasse an der einen Stelle, an der sie entsteht.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Die Kette reißt auch ohne Browser: `warteschlange` mit einem `laden()`, das wirft, und einer zweiten eingereihten Anfrage (siehe „Code-Extraktion").

- Arrange: Zähler `schlangeOffen` und Marke; `laden` wirft beim ersten Aufruf; zwei Anfragen werden eingereiht.
- Act: beide Aufrufe abwarten.
- Assert: die zweite Anfrage ist gelaufen (Aufrufzähler 2), `schlangeOffen` steht auf 0, das zurückgegebene Versprechen ist **erfüllt** (`await` wirft nicht), die Nachlade-Meldung wurde genau einmal mit dem richtigen Text gerufen.
- Heute rot: die zweite Anfrage läuft nicht, und die Kette ist abgelehnt.
- Vorschlag: `e2e/einheit/warteschlange.test.js` (Muster `e2e/einheit/uebernahme.test.js`).

### Code-Extraktion für isoliertes Testing

Empfehlung: die Kette in ein **reines Modul** ziehen (Vorschlag `web/warteschlange.js`, Stil `web/uebernahme.js` / `web/verbindung.js`): eine Funktion, die Kette und Zähler führt, die drei Ausgänge kennt (Erfolg, gescheiterte eigene Anfrage, gescheitertes Nachladen) und `api` und `laden` hereingereicht bekommt. Der Schnitt ist die Wahl des Entwicklers; die Abnahme prüft nur das beobachtbare Ergebnis (ADR-0025 Regel 6: eine Stelle).

### Regressionstests

- `e2e/tests/r00037-teilaufgaben-schnell.spec.js` und `e2e/tests/r00050-live-waehrend-anfragen.spec.js` (Reihenfolge, Live während eigener Anfragen) bleiben grün.
- `e2e/tests/r00112-rueckgaengig.spec.js`: ein stehender Hinweis mit „rückgängig" wird von der Meldung nicht verdrängt.
- `e2e/einheit/uebernahme.test.js` (Wächter der Übernahmestellen) unverändert grün.
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`.

## Akzeptanzkriterien

Grundbestand: Board `entwicklung`, Karte #1 „Abnahme prüfen" mit drei offenen Teilaufgaben „eins", „zwei", „drei" (über die API herstellbar); Person `st` (Mensch) im Browser, Live-Verbindung steht (`data-live="verbunden"`). Der Netzfehler wird an der Grenze des Browsers hergestellt (`page.route`): der **nächste** `GET /api/zustand` scheitert hart (`fetch` wirft), kein weiterer Aufruf. 1280 px, hell.

### Bug behoben (Pflicht)

- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün (`cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`)

### Abnahme-Probe der Karte #80, wörtlich (ADR-0025 Nachtrag N1)

- [ ] **1.** Gegeben das Board zeigt Karte #1 mit drei offenen Teilaufgaben; **wenn** die erste Teilaufgabe über den Kartenknopf abgehakt wird und das dadurch ausgelöste Nachladen hart scheitert; **dann** steht `- [x]` in der Datei von #1, es gibt genau einen neuen Commit von `st`, und es erscheint **keine** unbehandelte Ablehnung (`pageerror`)
- [ ] **2. (heute rot)** Gegeben die Lage nach 1.; **wenn** die zweite Teilaufgabe abgehakt wird; **dann** ist `PATCH /api/aufgaben/1/teilaufgaben/1` mit `{ "erledigt": true }` gesendet worden (Netzprotokoll), die Datei enthält zwei Haken, und es entstand genau ein weiterer Commit von `st` — heute wird kein `PATCH` gesendet und kein Commit erzeugt
- [ ] **3.** Gegeben die Lage nach 2.; **wenn** die dritte Teilaufgabe abgehakt wird; **dann** kommt auch sie an (drei Haken in der Datei, drei Commits), und die Ansicht zeigt den neuen Stand ohne Neuladen der Seite
- [ ] **4.** `schlangeOffen` endet in **jedem** Schritt bei 0 (Unit, AK 9–11). *Mitlaufend, heute schon grün* (Nachtrag N1 hat den Kontext berichtigt): ändert `bot` nach dem letzten Schritt über die API den Titel von #2, zeigt die Ansicht die Änderung ohne Zutun (`data-live="verbunden"` bleibt) — der Stillstand durch **hängende** Anfragen ist Karte #148 und wird hier nicht geprüft

### Meldung (ADR-0025 Regel 3, Nachtrag N1 Punkte 2–3)

- [ ] **5.** Gegeben die Lage nach der ersten gescheiterten Ladung (AK 1); **wenn** die Meldung erscheint; **dann** ist sie **auf dem Board** sichtbar (nicht allein im Fuß eines offenen Aufgabenfensters), sagt, dass die Änderung gespeichert ist, enthält nicht den Wortlaut „nichts geändert" und ist für Hilfstechnik erreichbar (`role="status"` oder `role="alert"`)
- [ ] **6.** Genau **eine** Meldung je Fehlschlag: es steht kein zweiter Text mit demselben Anlass (der Fensterfuß zeigt die Meldung des Nachladens nicht zusätzlich)
- [ ] **7.** Eine gescheiterte **eigene** Anfrage (der `PATCH` scheitert) meldet unverändert über den vorhandenen Weg („Keine Verbindung zum Server — nichts geändert." im Fensterfuß); die beiden Meldungen sind unterscheidbar
- [ ] **8.** Ein stehender Hinweis mit „rückgängig" (R00112) wird von der Meldung nicht verdrängt: sein Knopf bleibt, solange seine 8 s laufen, bedienbar (`e2e/tests/r00112-rueckgaengig.spec.js` bleibt grün)

### Kette (Unit)

- [ ] **9.** `laden` wirft beim ersten Aufruf, zwei Anfragen sind eingereiht → die zweite Anfrage läuft, `schlangeOffen` steht 0, das zurückgegebene Versprechen ist erfüllt, die Nachlade-Meldung wurde genau einmal gerufen
- [ ] **10.** Gelingt das Nachladen, verhält sich die Kette wie heute: die Anfragen laufen in Reihenfolge, die Marke wird vor dem Laden gesetzt, es wird einmal neu geladen
- [ ] **11.** Der Zähler geht auch herunter, wenn das **Nachladen** wirft (nicht nur, wenn die eigene Anfrage scheitert)

### Mutanten (test-ehrlichkeit)

Die Stelle wird per `page.route` auf die ausgelieferte Datei ersetzt (`**/web/app.js` bzw. das Modul der Kette); greift der Ersatz nicht, wirft die Route. Kein Mutant wird ins Repository geschrieben.

- [ ] M1 „Kettenende ohne Ablehnungspfad" (der heutige Zustand) → AK 2, 5, 9 rot
- [ ] M2 „`schlangeOffen` nur im Erfolgszweig herunterzählen" → AK 9, 11 rot
- [ ] M3 „Meldung lautet wieder ‚nichts geändert'" → AK 5 rot
- [ ] M4 „Meldung nur in `S.ui.fensterFehler` (Fensterfuß)" → AK 5 rot
- [ ] Das Ergebnis jeder Mutantenprobe (Mutante, Fall, rot ja/nein) steht im Bericht des Baus

## Implementierungshinweise

- Herstellung der Probe wörtlich nach ADR-0025 Nachtrag N1 (Tabelle Schritt 1–3); Treiber `e2e/tests/hilfen.js` (`kanbanStarten`, `alsPerson`, `liveBereit`), Muster `e2e/tests/r00050-live-waehrend-anfragen.spec.js`.
- `web/`-Dateien sind per `include_bytes!` eingebettet — sichtbar erst nach `cargo build` und Neustart.
- `NETZ_FEHLER` (`web/app.js:88`) bleibt der Text der gescheiterten **eigenen** Anfrage, damit er nicht seine Bedeutung verliert; die Meldung des Nachladens ist ein eigener Text.
- Der Hinweis lebt 8 s (`web/app.js:2952`, `dauer`); ein knopfloser Hinweis weicht einer Timer-Erinnerung (`hinweisBleibtStehen`, `:2916`). Die Meldung darf nicht unbemerkt verfallen — Lebensdauer und Form entscheidet die ux-Vorprüfung, die Abnahme prüft das Vorhandensein nach dem Fehlschlag.
- Die Meldung ist Sichtzustand (`S.ui`) und übersteht das Neuzeichnen (ADR-0007); Lastprofil: bis zu zehn Agenten schreiben gleichzeitig.
- **Abgrenzung:** #82 (`zuletztFenster - 1` in `dateiLaden`, `web/app.js:368`) bleibt eigene Karte (ADR-0014 Nachtrag N2); sie berührt `web/uebernahme.js`, nicht das Kettenende.

## Offene Fragen

- Keine an den Auftraggeber. Die Technikfrage ist mit ADR-0025 Regel 3 und Nachtrag N1 entschieden. Ort, Form, Lebensdauer und Wortlaut der Meldung bestätigt oder schärft die Vorprüfung des `ux-reviewer` (Label `oberflaeche`) bzw. der `rechtschreib-reviewer` (Label `text`) — ohne die Zusage dieser Anforderung zu ändern (AK 5–8).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine erwartet: die Meldung nutzt den vorhandenen Hinweis (D00007) bzw. den Fensterfuß, es entsteht kein neuer Anblick. Ergibt die Vorprüfung des `ux-reviewer` doch einen neuen sichtbaren Zustand, gilt die Leitplanke „Keine Gestaltung geht in den Bau, die niemand angesehen hat": dann zeichnet der `gestalter` ihn am Artboard D0002, und der `product-owner` gibt ihn frei, bevor die Oberflächen-Bubble baut.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Code-Review #76 (A3, begründet, nicht geprobt): Nach einem gescheiterten Nachladen der Warteschlange geht die **nächste** eigene Änderung still verloren — kein `PATCH`, kein Commit, und auf dem Board ausgelöst nicht einmal eine Meldung. Die Ursache ist das Kettenende: `return laden()` liegt im letzten `.then` der geteilten Kette und hat keinen Ablehnungspfad; die Ablehnung überspringt danach jede folgende Anfrage (X). Wird das Kettenende in jedem Fall erfüllt — Ablehnungspfad, Zähler herunter, eine Meldung mit dem richtigen Vorgang am Auslöser —, läuft die nächste eigene Änderung wieder (Y), und was der Mensch sieht, widerspricht der Datei nicht mehr: es gibt je Aktion einen Commit, und ein Fehlschlag wird als Fehlschlag benannt statt als „nichts geändert" (Z). Der Hebel sitzt im Kettenende und nicht beim einzelnen Auslöser, weil die Kette die eine Stelle ist, durch die jede schreibende Aktion läuft (ADR-0025 Regel 6): ein Fix je Aufrufer ließe die Fehlerklasse beim nächsten neuen Auslöser wieder aufleben, und eine Frist je Anfrage (Option C) deckt den anderen Fall (#148) und wäre hier eine eigene Entscheidung.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-13)**: eigene kleine Interaction **I0134** unter D0002 (Board), Bubbles B0682 (Abnahme-Probe, erwartet rot), B0683 (Kettenende) und B0684 (Meldung) mit eigener Anforderung R00147. Die Härtungsregel (`AI-Team/gelerntes.md` 2026-11-11; Vorbilder I0106/R00117, I0122/R00132, I0127/R00138) verlangt das: I0037 (R00037/R00050) und I0099 (R00110) sind **grün/abgenommen** — eine rote Folge-Bubble daran öffnete deren Abnahme. Elterndialog D0002, weil die Warteschlange jede schreibende Ansicht bedient und die Meldung dem Board-Auslöser gilt (ADR-0025 Regel 3 „Fuß/Toast").
- **Weiche (`befunde-einplanen`)**: **falsch gebaut** — die Zusage aus R00037 FA 1/FA 2 („strikt nacheinander sendet", der Fehler wird benannt) hält der Slice nicht; deshalb `/anforderung aus-bug` mit eigener Interaction. Kein Befund an einer Befundbehebung (die Ursache ist älter als #76), kein Rückschritt eines Fixes.
- **Architektur (Karte #80, bestanden 2026-11-13, `architekt`)**: Technikfrage bereits entschieden → ADR-0025 Regel 3, Nachtrag N1 (`4f14ef8`) mit Probe, Kontext-Berichtigung und geschärften Meldungspflichten; kein neuer ADR.
- **Priorität**: Hoch — eine gespeicherte Änderung erscheint als verloren; unter Agentenlast und in der Neustartpause des Servers wiederkehrend.
- **Betroffene Nutzer/Systeme**: jeder Mensch, der auf Board oder im Aufgabenfenster schreibt, während ein Nachladen scheitert; mittelbar jede Sicht, die `laden()` zeichnet.
- **Workaround**: Seite neu laden (heilt die Kette) oder die Änderung ein zweites Mal auslösen.
- **Nicht Umfang**: die Sperre am Auslöser (Regel 1/2, Karte #138); die hängende Anfrage (Karte #148); die Gleichstand-Regel in `web/uebernahme.js` (Karte #82); die Gleichzeitigkeit mehrerer Tabs.
- **Verworfene Alternativen**: B (Ablehnung je Aufrufer), C (Frist je Anfrage), D (Warteschlange auflösen) — je ein Satz unter „Alternative Ansätze".
- **Herkunft**: Karte #80 „Bug: scheitert ein Laden in der Warteschlange, laufen folgende eigene Änderungen nicht mehr" (aus #76 Code-Review A3); `ursprungslauf: R00110` (der Slice, in dessen Code das Kettenende steht).
