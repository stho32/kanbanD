---
id: R00148
status: Neu
datum: 2026-11-13
ursprung: Bug-Report
ursprungslauf: R00012
---

# R00148: Behebung — eine laufende Aktion nimmt keinen zweiten Auslöser an

## Beschreibung

Ein Schreib-Auslöser (Knopf, Kästchen, ✕) bleibt während seiner Anfrage bedienbar. Der zweite Auslöser desselben Menschen läuft deshalb noch einmal los: er trifft den **nachgerückten** Eintrag oder wiederholt die Aktion. Sechs Fälle sind belegt (Volltexte in den archivierten Karten #106, #65, #95, #121 A2, #55, #134):

| Fall | Auslöser | heute |
|---|---|---|
| #106 | Doppelklick auf ✕ an Teilaufgabe `b` in `a, b, c` (`web/ansicht.js:432`, `data-act="teil-weg"`, `data-arg`) | zwei `DELETE …/teilaufgaben/1`; das zweite trifft `c` — **Datenverlust ohne Rückweg** |
| #65 | Doppeltipp (120 ms wie 600 ms, Touch 390) auf die Teilaufgabe der Kartenleiste (`.naechste-ziel`, `web/ansicht.js:849`, `data-act="teil-karte"`) | `b` wird abgehakt, `c` rückt an dieselbe Stelle und wird vom zweiten Tipp ebenfalls abgehakt (zwei `PATCH`); auf der letzten Teilaufgabe verschwindet die Leiste, der zweite Tipp öffnet das Aufgabenfenster |
| #95 | Doppelklick auf „Anlegen" im Fenster „Neue Aufgabe" (`web/ansicht.js:239`, `data-act="nf-anlegen"` → `neueAufgabeAnlegen`, `web/app.js:466–477`) | zwei `POST /api/aufgaben` → zwei gleiche Aufgaben |
| #121 A2 | zweimal „Fertig" im Spalten-Dialog (`web/ansicht.js:40`, `data-act="setup-ok"` → `web/app.js:2003–2012`) | zwei `PUT …/spalten` |
| #55 | Doppelklick auf „⇄ Achsen tauschen" (`web/app.js:1603` → `bestandAchsenSetzen`, `:49–61`) | der zweite Klick rechnet aus dem schon getauschten Zustand und tauscht zurück — zwei `PUT …/bestand`, zwei Commits, netto keine Änderung |
| #134 | Doppelklick auf das ✕ einer Wirkung (`web/ansicht.js:642`, `data-act="wirkung-weg"`, `data-arg`) oder einer Entwurfs-Teilaufgabe im Fenster „Neue Aufgabe" (`web/ansicht.js:230`, `data-act="nf-teil-weg"`, `data-arg`) | Index-Adressierung: der zweite Klick trifft die nachgerückte Zeile (bei der Wirkung mit Commit, bei der Entwurfszeile lokal) |

Die technische Entscheidung steht in [ADR-0025](../Dokumentation/ADRs/0025-genau-ein-ausloeser-je-aktion.md) **Option A** samt **Nachtrag N2** („Reichweite aus dem Härtungsdurchgang 2026-11-12 — drei weitere Fälle; Regel 4 berichtigt, Regel 6 geschärft"): **Sperre am Auslöser**, solange seine Anfrage läuft (Regel 1/2), die Stelle (`data-arg`) bleibt nur unter dieser Sperre tragbar (Regel 4), **eine Stelle** für alle schreibenden Anfragen (Regel 6), Anlegen über den vorhandenen Schlüssel (Regel 5, [R00098](R00098-idempotentes-anlegen-ueber-fremdschluessel.md)). Diese Anforderung macht sie prüfbar und ändert die Entscheidung nicht. Nicht ihr Umfang: das Kettenende der Warteschlange ([R00147](R00147-behebung-gescheitertes-nachladen-verschluckt-eigene-aenderung.md), Karte #80), die hängende Anfrage (Karte #148), die Gleichstand-Regel (Karte #82), ein zweiter Browser-Tab (ADR-0025, akzeptierte Schwäche).

Der Vorrang kommt vom product-owner: „Datenverlust ohne Rückweg wiegt schwerer als jede offene Gestaltungsfrage" (`AI-Team/po-entscheidungen.md`, 2026-11-08 zu #12 → #106).

Zahlt ein auf: [Vision](R00000-vision.md) — „**Git ist das Gedächtnis.** Jede Aktion in kanbanD ergibt einen eigenen Commit." Ein zweiter Commit, den niemand befohlen hat, und ein gelöschter Eintrag, den niemand gewählt hat, brechen beides; und „Jede Gestaltung wird freigegeben, bevor sie gebaut wird" gilt für die sichtbare Form der Sperre.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Rückgängig](../Dokumentation/Domaenenwissen/D00008-rueckgaengig.md)
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Ursachenanalyse

### Root Cause

Belegt am Stand `750172f`:

1. **Der Schreibweg merkt sich nicht, dass eine Anfrage läuft.** `act` (`web/app.js:1275`) verteilt einen Auslöser an seinen Handler; die Handler senden und warten (`await schreiben`, `warteschlange`), geben aber keinen Sperrzustand aus. `S.ui` kennt kein Feld „läuft" (Suche nach `laeuft`/`gesperrt` in `web/app.js`: kein Treffer). Der zweite Klick findet denselben bedienbaren Knoten vor und läuft erneut.
2. **Die Adressierung über die Stelle.** `data-arg` trägt den Index: `teil-weg` (`web/app.js:1441`), `herkunft-weg` (`:1758`), `wirkung-weg` (`:1681`), `nf-teil-weg` (`:1327`). Ohne Sperre trifft der zweite Auslöser die nachgerückte Zeile; die Kartenleiste (`.naechste-ziel`) wird durch das eigene Neuzeichnen sogar auf den **nächsten** Eintrag umgeschrieben (`web/ansicht.js:849`, `a.teilaufgaben.findIndex(t => !t.erledigt)`).
3. **Die Schreibwege streuen.** Nur vier Aufrufe gehen über die eine Stelle `warteschlange` (`web/app.js:1407`, `:1427`, `:1438`, `:1465`). Fensterschreibungen laufen über `schreiben` (`:482`, ruft `api` direkt), die übrigen Auslöser über rohes `api`: `:58` (`bestand-tauschen`), `:1344` (`bewegen`), `:1683` (`wirkung-weg`), `:470`/`:472` (`nf-anlegen`), `:2010` (`setup-ok`), `:1622` (`wbs-status`) und weitere. Eine Sperre an einer dieser Stellen erreicht die anderen nicht (ADR-0025 Regel 6).
4. **`nf-anlegen` ist nicht idempotent.** `neueAufgabeAnlegen` (`web/app.js:466–477`) sendet `POST /api/aufgaben` ohne `key`, obwohl der Schlüssel gebaut ist ([R00098](R00098-idempotentes-anlegen-ueber-fremdschluessel.md); `src/web/endpunkte.rs:55`, „offene Karte mit dem Schlüssel → 200 mit dieser Karte, nichts wird geschrieben").
5. **Auslöser ohne Anfrage.** `nf-teil-weg` (`web/app.js:1327`) ändert nur die lokale Entwurfsliste (`u.neu.teil.splice(+arg, 1)`) — aus jeder „solange die Anfrage läuft"-Sperre fällt er heraus (ADR-0025 N2).

Ausgeschlossen: der **zweite Tab** und der gleichzeitig schreibende Agent (ADR-0025, akzeptierte Schwäche — die Sperre ist clientseitig); eine **hängende** Anfrage (Karte #148); die Gleichstand-Regel in `web/uebernahme.js` (Karte #82). Geprüft und **nicht** betroffen: #40/[R00138](R00138-fokus-trifft-nach-fremder-aenderung-dasselbe-element.md) — dort geht es allein um den **Fokus** nach einer fremden Änderung; `data-halt` und die Schlüsselregel liegen bereits (`I0127`, grün), die Adressierung der Anfrage hat R00138 ausdrücklich ausgeklammert.

### Betroffene Komponenten

- `web/app.js`: `act` (`:1275`), `warteschlange`/`warteschlangeFuehren` (`:441–443`, `web/warteschlange.js`), `schreiben` (`:482`), `neueAufgabeAnlegen` (`:466–477`), `bestandAchsenSetzen` (`:49–61`), die Fälle `nf-teil-weg` (`:1327`), `nf-anlegen` (`:1330`), `bewegen` (`:1331`), `teil-karte` (`:1397`), `teil-weg` (`:1441`), `wirkung-weg` (`:1681`), `herkunft-weg` (`:1758`), `setup-ok` (`:2003`)
- `web/ansicht.js`: die Knöpfe `.naechste-ziel` (`:849`), `teil-weg` (`:432`), `wirkung-weg` (`:642`), `nf-teil-weg` (`:230`), `nf-anlegen` (`:239`), `setup-ok` (`:40`)
- **neu (Vorschlag)**: ein reines Modul für den Auslöser-Zustand (Stil `web/uebernahme.js`), damit der Sperrzustand in Node prüfbar ist
- **unverändert**: Server und API — Regel 5 nutzt den gebauten `key`; `data-arg` bleibt (ADR-0025 Regel 4)

## Lösungsvorschlag

### Langfristige Lösung

Option A aus ADR-0025 (Regel 1, 2, 4, 5, 6 und Nachtrag N2), unverändert:

1. **Genau ein Auslöser je Aktion (Regel 1).** Solange die Anfrage eines Schreib-Auslösers läuft, hat **derselbe Auslöser** keine Wirkung: keine zweite Anfrage, kein zweites Fenster, kein zweiter Commit. Der Sperrzustand ist Zustand der Oberfläche (`S.ui`, ADR-0007) und übersteht das Neuzeichnen; er hängt nicht am DOM-Knoten. Ausgenommen sind Auslöser ohne Schreibwirkung (Ansicht wechseln, Fenster öffnen, Menü).
2. **Der Sperrzustand endet mit der Antwort** — auch nach einem Fehlschlag; er ist kein Dauerzustand.
3. **Fokus (Regel 2).** Der Auslöser verliert den Fokus nicht: `aria-disabled`, **kein** natives `disabled` (das nähme den Knoten aus der Tabreihenfolge, der Fokus fiele auf `BODY`, ADR-0010). Die sichtbare Form ist mit AK 19/20 geprüft und am **2026-11-14** freigegeben (product-owner; Zustand `#sperrform` an D0002 für Textknopf, Symbolknopf/✕ und Kartenleiste, an D0003 für Kästchen und Chip-✕): eine Dämpfungsregel für alle Familien — Schrift/Symbol/Fläche der Bestandteile statt `opacity` am Knoten.
4. **Eine Stelle (Regel 6).** Sperre und Reihenfolge liegen im Schreibweg, durch den **jede** schreibende Anfrage läuft (`warteschlange`); `schreiben` und die rohen `api`-Schreibaufrufe werden dorthin gezogen. Ein schreibender Auslöser, dessen Anfrage daran vorbeigeht, ist ein Befund.
5. **Anlegen mit Schlüssel (Regel 5).** Das Fenster „Neue Aufgabe" erzeugt beim Öffnen **einen** Schlüssel und schickt ihn bei jedem `POST /api/aufgaben` derselben Formularfüllung mit; die Wiederholung antwortet `200` mit `neu: false` und schreibt nichts.
6. **Auslöser ohne Anfrage (N2).** `nf-teil-weg` adressiert die Entwurfszeile über eine im Zustand vergebene, stabile Kennung statt über die Stelle; der zweite Klick auf dieselbe Zeile ist ein No-op.

### Optionen

| | A: Sperre am Auslöser (ADR-0025 Regel 1/6) | B: stabile Kennungen statt Stelle | C: optimistisch zeichnen | D: gleiche Anfragen in der Schlange zusammenfassen |
|---|---|---|---|---|
| Deckt die sechs Fälle | ja, mit **einem** Mechanismus | ja | nein (#95, #121 A2 bleiben) | nein (#106: der zweite Klick trifft eine **andere** Stelle) |
| Dateiformat | unverändert | Teilaufgabe/Herkunft/Wirkung bräuchten Kennungen im Markdown, Migration, Handpflege | unverändert | unverändert |
| Testbarkeit | hoch: je Fall ein Doppelklick; heute durchweg rot | hoch | mittel | niedrig („gleiche Anfrage" bei `POST …/teilaufgaben` ohne Schlüssel nicht erkennbar) |
| Reversibilität | hoch (Sichtzustand) | niedrig (Format) | mittel | hoch |
| Sichtbare Änderung | die Sperre (Form: freigegeben 2026-11-14) | keine | der Eintrag verschwindet sofort | keine |

**Entscheidung: A** — durch ADR-0025 Option A bereits entschieden (mit N2) und hier nur umgesetzt; B/C/D sind dort verworfen (Nachtrag N2 „Fälle ohne Anfrage" nimmt allein die lokale Liste aus).

### Alternative Ansätze

- **B — stabile Kennungen** (ADR-0025 Option B): robust auch gegen zwei Tabs, aber Teilaufgaben sind Markdown-Kästchen — Kennungen wären ein Formatwechsel mit Migration; verworfen (ADR-0025).
- **C — optimistisch zeichnen** (Option C): behebt #95 und #121 A2 nicht und führt eine zweite Wahrheit neben `S.` ein; verworfen.
- **D — Deduplizierung in der Schlange** (Option D): der zweite Klick auf eine **andere** Stelle ist eine andere Anfrage — #106 bliebe offen; verworfen.

## Test-Strategie

### Unit Tests zur Bug-Reproduktion

- **Der Auslöser-Zustand (neu, rein)**: `sperre.neu(ausloeser)` → `sperre.laeuft(ausloeser)` ist wahr; `sperre.frei(ausloeser)` → falsch; zwei verschiedene Auslöser sind unabhängig; `sperre.alleFrei()` nach beiden Ausgängen. Ordnet die Sperre einen **anderen** `data-arg` am selben Platz demselben Auslöser zu (Kartenleiste), ist für `arg` 0 gesperrt und für 1 ebenfalls — **heute rot**, weil es die Stelle noch nicht gibt.
- **Der Schlüssel des Fensters**: zweimal derselbe Formularzustand → derselbe `key`; ein neu geöffnetes Fenster → ein anderer.
- Muster `e2e/einheit/uebernahme.test.js`; die Kette selbst ist bereits reines Modul (`web/warteschlange.js`, geprüft in `e2e/einheit/warteschlange.test.js`).

### E2E (Playwright)

- neu `e2e/tests/r00148-zweiter-ausloeser.spec.js`: die sechs Fälle der Karte (AK 4–11), die Sperre selbst (AK 12–16), die eine Stelle (AK 17) und der Schlüssel (AK 18). Muster `e2e/tests/r00147-warteschlange.spec.js` (`kanbanStarten(einrichten(DATEIEN))`, `alsPerson`, `mutanteEinsetzen`), `e2e/tests/r00112-rueckgaengig.spec.js` (Fenster und Listen), `e2e/tests/r00050-live-waehrend-anfragen.spec.js` (Antwort verzögern).
- **Heute rot** sind AK 4, 5, 6, 7, 8 (zweites `POST`), 9, 10, 17, 18; AK 11 ist heute ebenfalls rot (die nachgerückte Entwurfszeile), AK 12–16 sind ohne Sperre nicht prüfbar.
- Zeitfenster: die beiden Tipps liegen bei 120 ms und 600 ms **innerhalb** der laufenden Anfrage; die Antwort wird dafür über `page.route` um mindestens 1 s verzögert. Ohne diese Verzögerung ist die Anfrage vor dem zweiten Tipp beendet — dann prüft der Fall nichts.

### Regressionstests

- `e2e/tests/r00112-rueckgaengig.spec.js` (Hinweis mit „rückgängig" bleibt bedienbar, Fokus nach dem Entfernen), `r00037-teilaufgaben-schnell.spec.js` und `r00050-live-waehrend-anfragen.spec.js` (Reihenfolge, Live während eigener Anfragen), `r00108`, `r00115`, `r00029` (Karte und Kartenleiste), `r00144`, `r00145`, `r00146` (Oberfläche der Oberfläche unverändert), `e2e/einheit/`.
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`.

## Akzeptanzkriterien

Grundbestand: Board `entwicklung`, Karte #1 „Abnahme prüfen" mit den offenen Teilaufgaben „eins", „zwei", „drei" (über die API herstellbar), Person `st` (Mensch), Live-Verbindung steht (`data-live="verbunden"`); 1280 px hell; der Touch-Fall im Fensterkontext 390 px. „Doppelklick" heißt zwei Klicks auf **dasselbe** Ziel in ≤ 120 ms; „Doppeltipp" zwei Berührungen in 120 ms bzw. 600 ms. **Soweit ein Fall eine laufende Anfrage braucht, wird die Antwort über `page.route` um ≥ 1 s verzögert** — sonst ist die Anfrage vor dem zweiten Auslöser beendet und der Fall prüft nichts (die Verzögerung ist Probe-Mittel, keine Zusage).

### Bug behoben (Pflicht)

- [ ] Der Reproduktionstest ist ohne Fix rot und mit Fix grün
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story nicht mehr auf
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün (`cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`)

### Abnahme-Proben der Karte #138, wörtlich

- [ ] **4. (#106) Doppelklick auf das ✕ einer Teilaufgabe.** Gegeben Karte #1 offen im Aufgabenfenster mit den Teilaufgaben „eins", „zwei", „drei"; **wenn** das ✕ an „zwei" doppelgeklickt wird (und ebenso als Variante: zweimal `Enter` auf dem fokussierten ✕); **dann** ist **nur** „zwei" entfernt — die Datei enthält „eins" und „drei" in dieser Reihenfolge, es wurde **genau ein** `DELETE /api/aufgaben/1/teilaufgaben/1` gesendet, es entstand genau ein Commit von `st`, und der Hinweis bietet „Teilaufgabe „zwei" entfernt" mit rückgängig an. Heute rot: zwei `DELETE`, das zweite entfernt „drei"
- [ ] **5. (#65 a/b) Doppeltipp auf die Teilaufgabe der Kartenleiste.** Gegeben Touch 390 px, die Antwort der ersten Berührung läuft noch; **wenn** die Teilaufgabe der Kartenleiste „zwei" in 120 ms und — dieselbe Lage neu hergestellt — in 600 ms ein zweites Mal berührt wird; **dann** ist nur „zwei" abgehakt (genau ein `PATCH /api/aufgaben/1/teilaufgaben/1` mit `{"erledigt":true}`), „drei" bleibt offen, und es entstand genau ein Commit. Heute rot: der zweite Tipp hakt „drei" ab (zwei `PATCH`)
- [ ] **6. (#65 c) Doppeltipp auf die letzte offene Teilaufgabe öffnet kein Fenster.** Gegeben „eins" und „zwei" sind abgehakt, „drei" ist die letzte offene Teilaufgabe, die Antwort läuft noch; **wenn** sie doppelt angetippt wird; **dann** ist „drei" abgehakt, genau ein `PATCH` ging raus, genau ein Commit entstand, und es ist **kein** Fenster offen (`[role="dialog"]` leer, `#fenster` nicht vorhanden). Heute rot: der zweite Tipp öffnet das Aufgabenfenster
- [ ] **7. (#95) Doppelklick auf „Anlegen".** Gegeben das Fenster „Neue Aufgabe" mit dem Titel „Abnahme prüfen"; **wenn** „Anlegen" doppelgeklickt wird; **dann** entstand **genau eine** neue Aufgabe (eine neue Datei, eine Board-Zeile, genau ein Commit), der Hinweis nennt genau eine Nummer, und das Netzprotokoll zeigt genau einen `POST /api/aufgaben`. Heute rot: zwei Aufgaben, zwei Commits
- [ ] **8. (#121 A2) Zweimal „Fertig" im Spalten-Dialog.** Gegeben der Spalten-Dialog mit einer geänderten Notiz; **wenn** zweimal „Fertig" geklickt wird; **dann** ging genau **ein** `PUT /api/boards/entwicklung/spalten` raus, es entstand genau ein Commit (`git log --oneline | wc -l` vor/nach), und die Board-Datei trägt die Notiz einmal. Heute rot: zwei `PUT`
- [ ] **9. (#55) Doppelklick auf „⇄ Achsen tauschen".** Gegeben der Bericht „Bestand nach Labels" mit den Achsen repo × nc; **wenn** „⇄ Achsen tauschen" doppelgeklickt wird; **dann** entstand **höchstens ein** Commit, und die Achsen sind genau **einmal** getauscht (Frontmatter `report-labels: {rows: nc, columns: repo}`). Heute rot: zwei Commits, netto keine Änderung
- [ ] **10. (#134 a) Doppelklick auf das ✕ einer Wirkung.** Gegeben #1 mit zwei Wirkungen (`wbs-effects`); **wenn** das ✕ der ersten doppelgeklickt wird; **dann** ging genau ein `DELETE /api/aufgaben/1/wbs-effects/0` raus, es entstand genau ein Commit, und die Datei trägt genau die **zweite** Wirkung. Heute rot: zwei `DELETE`, die zweite Wirkung ist ebenfalls weg
- [ ] **11. (#134 b) Doppelklick auf das ✕ einer Entwurfs-Teilaufgabe.** Gegeben das Fenster „Neue Aufgabe" mit den Entwurfs-Teilaufgaben „eins", „zwei"; **wenn** das ✕ an „eins" doppelgeklickt wird; **dann** ist nur „eins" aus der Liste verschwunden, „zwei" steht noch da, und es gab dafür keinen Serveraufruf und keinen Commit. Heute rot: auch „zwei" fällt der Stelle zum Opfer

### Der eine Auslöser (ADR-0025 Regel 1/2)

- [ ] **12. Die Sperre wirkt, solange die Anfrage läuft.** Gegeben ein Schreib-Auslöser (Varianten: `teil-weg`, `nf-anlegen`, `bestand-tauschen`, `wirkung-weg`), dessen Anfrage läuft (Antwort verzögert); **wenn** derselbe Auslöser ein zweites Mal ausgelöst wird; **dann** geht keine zweite Anfrage raus, es entsteht kein zweiter Commit, und es öffnet sich kein zweites Fenster
- [ ] **13. Der Sperrzustand übersteht das Neuzeichnen.** Gegeben die Anfrage eines Auslösers läuft (Antwort verzögert); **wenn** ein Live-Ereignis die Ansicht neu zeichnet (ein Agent ändert über die API den Titel von #2); **dann** bleibt derselbe Auslöser ohne Wirkung (keine zweite Anfrage) — die Sperre hängt nicht am Knoten
- [ ] **14. Der Auslöser verliert den Fokus nicht.** Gegeben die Anfrage läuft; **wenn** der Auslöser geklickt wurde; **dann** ist `document.activeElement` weiterhin dieser Auslöser (nie `BODY`), er ist per `Tab` erreichbar (kein natives `disabled`), und höchstens `aria-disabled="true"` steht an ihm
- [ ] **15. Auslöser ohne Schreibwirkung bleiben frei.** Gegeben die Anfrage eines Schreib-Auslösers läuft (Antwort verzögert); **wenn** in dieser Zeit das ⋮-Menü geöffnet, die Ansicht gewechselt oder ein anderes Fenster geöffnet wird; **dann** geschieht das normal (die Sperre trifft nur schreibende Auslöser)
- [ ] **16. Die Sperre endet mit der Antwort.** Gegeben die Anfrage eines Auslösers läuft und scheitert (Netzfehler, `page.route` bricht ab); **wenn** die Ablehnung angekommen ist; **dann** ist derselbe Auslöser wieder bedienbar — ein erneuter Klick sendet wieder eine Anfrage (die Sperre bleibt nicht stehen)

### Eine Stelle und der Schlüssel (ADR-0025 Regel 5/6)

- [ ] **17. Kein Überholen.** Gegeben ein schreibender Auslöser, dessen Antwort verzögert kommt; **wenn** währenddessen ein **anderer** schreibender Auslöser ausgelöst wird (z. B. „Anlegen" und danach eine Teilaufgabe); **dann** beginnt die zweite schreibende Anfrage erst nach der Antwort der ersten (Netzprotokoll: keine Überlappung), und beide Änderungen sind gespeichert. Heute rot: die Fensterschreibungen (`schreiben`, `api` direkt) laufen parallel
- [ ] **18. Anlegen trägt den Schlüssel.** Gegeben das Fenster „Neue Aufgabe" mit Titel; **wenn** „Anlegen" geklickt wird; **dann** trägt der `POST /api/aufgaben` ein `key` (Netzprotokoll), zwei Klicks senden **denselben** Schlüssel, und derselbe `POST` ein zweites Mal geschickt (aus der Seite heraus) antwortet `200` mit `neu: false`, ohne dass eine zweite Datei oder ein zweiter Commit entsteht. Heute rot: kein `key` in der Anfrage

### Sichtbare Sperrform (ADR-0025 Regel 2, ux-Vorprüfung 2026-11-13, Freigabe 2026-11-14)

- [ ] **19. Sichtbare Sperrform je Auslöserfamilie.** Gegeben ein Schreib-Auslöser, dessen Anfrage läuft; **wenn** die Oberfläche den Zustand zeichnet, **dann** ist er in beiden Themen (hell und dunkel) sichtbar, ohne Hover, ohne Druck und ohne Cursorwechsel, und ohne dass das Kästchen seinen Zustand wechselt (kein `aria-checked`-Wechsel). Maßstab ist die am **2026-11-14** freigegebene Form (product-owner, `AI-Team/po-entscheidungen.md`; Zustand `#sperrform` an **D0002** und **D0003**, Commit `5c021a5`): Der gesperrte Auslöser (`aria-disabled="true"`, `aria-busy="true"`, **nie** natives `disabled`) dämpft seine **Bestandteile**, nicht den Knoten — Schrift und Symbol auf `--kd-faint`, die Kontur auf `--kd-line`, eine gefüllte Fläche auf `--kd-sunken`; der **Fokusring** bleibt 2 px `--kd-accent` mit 2 px Abstand, **ungedämpft** (kein `opacity` am Knoten, AK 20). Ausnahmen: die neutrale Ruhefläche (`--kd-surface`) des Textknopfs bleibt; das angehakte Kästchen bleibt angehakt (Fläche `--kd-faint`, Haken `--kd-surface`), sein Zustand wechselt nie. Je Familie am Artboard: **Textknopf** (`button.btn`), **Symbolknopf/✕** (`button.btn.btn-sym`, z. B. `data-act="teil-weg"`, `data-act="nf-teil-weg"`, `data-act="anhang-weg"`) und **Kartenleiste** (`button.naechste-ziel`) an **D0002 `#sperrform`**; **Kästchen** (`i[role=checkbox]`) und **Chip-✕** (`.ochip button`, z. B. `data-act="herkunft-weg"`/`data-act="wirkung-weg"`) an **D0003 `#sperrform`**. Kontraste als prüfbare Schwelle: der Fokusring mindestens 3:1 in beiden Themen (gemessen 5,95 hell / 3,42 dunkel). Ein Auslöser ohne Schreibwirkung bleibt ungedämpft (AK 15).
- [ ] **20. Fokus bleibt am Auslöser, Fokusring ≥ 3:1 trotz Dämpfung.** Gegeben der Auslöser ist fokussiert und seine Anfrage läuft; **wenn** der Sperrzustand gezeichnet wird, **dann** bleibt `document.activeElement` dieser Auslöser, er ist per `Tab` erreichbar (kein natives `disabled`), und der Fokusring hat mindestens 3:1 Kontrast zur Fläche — auch gedämpft; kein pauschales `opacity` am Knoten (es dimmt den Ring mit). Heute rot: der naheliegende Weg `opacity` am Knoten dimmt den Ring mit; der Fokusring ist 2 px `--kd-accent` (WCAG 1.4.11).

### Mutanten (test-ehrlichkeit)

Die Stelle wird per `page.route` auf die ausgelieferte Datei ersetzt (`**/web/app.js` bzw. das Modul der Sperre); greift der Ersatz nicht, wirft die Route. Kein Mutant wird ins Repository geschrieben.

- [ ] M1 „Sperrzustand am DOM-Knoten (natives `disabled` bzw. Attribut statt `S.ui`)" → AK 13, 14 rot
- [ ] M2 „Sperre über `data-act`+`data-arg` (Stelle) statt über den Auslöser" → AK 5, 6, 11 rot
- [ ] M3 „`wirkung-weg` und `bestand-tauschen` gehen weiter am Schreibweg vorbei" → AK 9, 10, 17 rot
- [ ] M4 „Anlegen ohne `key`" → AK 18 rot
- [ ] M5 „Entwurfs-✕ weiter über die Stelle" → AK 11 rot
- [ ] M6 „Sperre endet nicht mit der Antwort" → AK 16 rot
- [ ] Das Ergebnis jeder Mutantenprobe (Mutante, Fall, rot ja/nein) steht im Bericht des Baus

## Betroffene Verzeichnisstruktur

```
web/
  app.js             act (Verteiler), neueAufgabeAnlegen (Schlüssel), die sechs Fälle; schreiben und die rohen api-Schreibaufrufe
  warteschlange.js   heute schon die eine Stelle der Reihenfolge — nimmt den Sperrzustand mit auf
  uebernahme.js      Stilvorbild für ein reines Modul (neu, Vorschlag: sperre.js)
  ansicht.js         die Knöpfe (unverändert bis auf höchstens aria-disabled)
e2e/
  einheit/           neu: Unit der Sperre und des Schlüssels
  tests/r00148-zweiter-ausloeser.spec.js   neu: die sechs Fälle, Sperre, eine Stelle, Schlüssel
```

## Technische Überlegungen

### Ablauf

1. **Der Auslöser bekommt einen Namen.** Beim Klick wird aus dem getroffenen Element eine Kennung gebildet, unter der die Sperre geführt wird (Vorschlag: `data-act` **plus Platz des Auslösers in der gezeichneten Fläche**, z. B. `.ka[data-id="1"] .naechste-ziel`) — **nicht** allein `data-arg`: die Kartenleiste schreibt ihr `data-arg` beim eigenen Neuzeichnen auf den nächsten Eintrag um (`web/ansicht.js:849`), und genau dann träfe die zweite Berührung eine andere Stelle. Den Schnitt wählt der Entwickler (ADR-0025 Regel 6, „eine Stelle").
2. **Die Sperre umschließt die Anfrage.** Der Schreibweg setzt den Zustand vor dem Senden und nimmt ihn in einem `finally`-artigen Schritt zurück — auch bei einem Fehlschlag (AK 16).
3. **Der Zustand lebt in `S.ui`** (ADR-0007) und übersteht das Neuzeichnen; `fensterMelden`/`S.ui.fehler` bleiben unberührt.
4. **Bündeln.** `schreiben` (`web/app.js:482`) und die rohen `api`-Schreibaufrufe werden auf die eine Stelle gezogen; Aufrufe **ohne** Schreibwirkung (`GET`, `laden`) bleiben, wo sie sind.
5. **Anlegen.** `neueAufgabeAnlegen` schickt `key` aus dem beim Öffnen des Fensters erzeugten Wert; nach `neu: false` erscheint derselbe Hinweis „#<nr> angelegt" wie nach `neu: true` (R00098), ohne zweite Datei. Für „mehrere" (`POST /api/aufgaben/mehrere`) trägt jeder Eintrag einen stabilen Schlüssel.
6. **Entwurfsliste.** `nf-teil-weg` adressiert die Zeile über eine stabile Kennung (im Zustand vergeben, kein Serverformat); der doppelte Klick auf dieselbe Zeile ist ein No-op. `data-halt` gibt es an diesen ✕ bereits (`web/ansicht.js:230`) — die Kennung der Aktion ist davon zu unterscheiden.

### Grobentwurf (Klassen-Entwurf ohne Implementierungen)

**Wichtige Einstiegsstellen:** der Klick-Verteiler `act` und der Schreibweg `warteschlange` in `web/app.js`; die Knöpfe in `web/ansicht.js`; die E2E-Probe `e2e/tests/r00148-zweiter-ausloeser.spec.js`.

- **neu (Vorschlag) `web/sperre.js`** (reines Modul, Stil `web/uebernahme.js`): führt die Menge der laufenden Auslöser.
  - `namenVon(element)` → Kennung des Auslösers aus dem getroffenen Element
  - `laeuft(name)`, `starten(name)`, `beenden(name)`
- **`act` (`web/app.js:1275`)**: prüft die Sperre vor dem Verteilen, überspringt einen gesperrten schreibenden Auslöser, setzt und nimmt den Zustand.
- **`warteschlangeFuehren` (`web/warteschlange.js`)**: bleibt die eine Stelle für Reihenfolge und Kettenende.

### Änderungen an bestehenden Klassen

- `neueAufgabeAnlegen` (`web/app.js:466–477`): `key` in beiden Rümpfen; Zustand `u.neu.schluessel` beim Öffnen des Fensters (`act`-Fall `add`, `:1315`).
- `bestandAchsenSetzen` (`web/app.js:49–61`), `wirkung-weg` (`:1681`), `bewegen` (`:1331`), `setup-ok` (`:2003`): Schreibaufruf auf die eine Stelle.
- `nf-teil-weg` (`web/app.js:1327`): Kennung statt Index.

## Tests

Nach Skill `test-pyramide` und `test-ehrlichkeit`; jede Probe prüft eine Zustandsänderung (Datei, `git log`, Netzprotokoll), nicht nur den Aufruf.

- **Unit (Node, rein):** neu `e2e/einheit/sperre.test.js` (AK der Sperre, Zuordnung des Auslösers), Schlüssel des Fensters; `e2e/einheit/warteschlange.test.js` bleibt.
- **E2E:** `e2e/tests/r00148-zweiter-ausloeser.spec.js` (AK 4–18); Wächter `r00112`, `r00037`, `r00050`, `r00108`, `r00115`, `r00029`, `r00144`, `r00145`, `r00146`.

## Abhängigkeiten

- Abhängig von: [R00098](R00098-idempotentes-anlegen-ueber-fremdschluessel.md) (`key`, gebaut), [R00037](R00037-teilaufgaben-schnell-hintereinander.md)/[R00110](R00110-fenster-zeigt-nur-den-neuesten-stand.md) (Warteschlange, die eine Stelle), [R00147](R00147-behebung-gescheitertes-nachladen-verschluckt-eigene-aenderung.md) (Kettenende endet erfüllt, gebaut)
- Blockiert: [R00138](R00138-fokus-trifft-nach-fremder-aenderung-dasselbe-element.md) nicht (grün); die Gleichstand-Regel (Karte #82) und die hängende Anfrage (Karte #148) bleiben eigenständig

## Offene Fragen

- Keine an den Auftraggeber. Die Technikfrage ist mit ADR-0025 (Option A, Regel 1/2/4/5/6, Nachtrag N2) entschieden; die **sichtbare Form** der Sperre hat die Vorprüfung des `ux-reviewer` (Label `oberflaeche`, ADR-0025 Regel 2 und Konsequenzen „`aria-disabled` sieht ohne Gestaltung aus wie bedienbar") festgelegt und der `product-owner` hat sie am **2026-11-14** freigegeben (`AI-Team/po-entscheidungen.md`): Zustand `#sperrform` an D0002 (Textknopf, Symbolknopf/✕, Kartenleiste) und D0003 (Kästchen, Chip-✕, hell und dunkel), eine Dämpfungsregel für alle Familien (Schrift/Symbol `--kd-faint`, Kontur `--kd-line`, gefüllte Fläche `--kd-sunken`, Fokusring ungedämpft ≥ 3:1). Die Leitplanke „Jede Gestaltung wird freigegeben" ist damit erfüllt; AK 19/20 prüfen die Wirkung, nicht das Aussehen. Kein neuer sichtbarer Text erwartet — die Hinweise „#<nr> angelegt" und „Teilaufgabe „<text>" entfernt" gibt es.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine erwartet. Die ux-Vorprüfung ergab einen neuen sichtbaren Zustand; er ist je Auslöserfamilie an D0002 (Textknopf, Symbolknopf/✕, Kartenleiste) und D0003 (Kästchen, Chip-✕) gezeichnet (Commit `5c021a5`) und am **2026-11-14** freigegeben (`AI-Team/po-entscheidungen.md`, Zustand `#sperrform`). Bildschirmfotos der Proben legt der Director auf den Abnahmezettel, wenn die Sperre sichtbar wird.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Plausibilitätsprüfung des Backlogs (#138, zusammengelegt aus #106, #65, #95, #121 A2, #55, #134): ein Doppelklick auf ein ✕ löscht die nachgerückte Teilaufgabe, ein Doppeltipp hakt den Nachbarn ab, „Anlegen" legt zwei Karten an. Die Ursache ist, dass ein Schreib-Auslöser während seiner Anfrage bedienbar bleibt und die Aktion über die **Stelle** adressiert ist (X). Läuft jede schreibende Anfrage durch **eine** Stelle, die den Auslöser kennt und ihn bis zur Antwort sperrt (Y), kann kein zweiter Auslöser eine verschobene Stelle treffen: die Datei enthält genau das, was der Mensch gewählt hat, und es entsteht genau ein Commit je Aktion (Z) — die Leitplanke „Git ist das Gedächtnis" und der Vorrang „Datenverlust ohne Rückweg wiegt schwerer als jede offene Gestaltungsfrage" halten. Der Hebel sitzt am einen Schreibweg und nicht bei den sechs Fällen einzeln: die Klasse wiederholt sich sonst an jedem neuen Knopf (ADR-0025 „Änderbarkeit"), und stabile Kennungen (Option B) verlangten einen Formatwechsel für Markdown-Kästchen. Der vorhandene `key` (R00098) wird dabei zur zweiten Netto-Sicherung des Anlegens, ohne neue Serverzusage.

## Notizen

- **Sichtbare Sperrform — Vorprüfung und Freigabe eingearbeitet (2026-11-14)**: Der ux-Reviewer hat die sichtbare Form vorgeprüft, der `gestalter` hat sie als **eine** Dämpfungsregel für alle Auslöserfamilien an D0002 und D0003 gezeichnet (Zustand `#sperrform`, Commit `5c021a5`), der `product-owner` hat sie am **2026-11-14** freigegeben (`AI-Team/po-entscheidungen.md`). AK 19 ist von der Hausform auf die **Wirkung** gestellt: der frühere Satz, die Knopf-Familien nutzten die vorhandene deaktivierte Knopf-Dämpfung, ist gestrichen — jene Regel greift nur bei nativem `disabled`, die Sperre nutzt `aria-disabled`, und ihre Knoten-Opacity widerspricht AK 20 (Fokusring ≥ 3:1). F0125 und B0687 nennen jetzt dieselbe Fassung (Schrift/Symbol `--kd-faint`, Kontur `--kd-line`, gefüllte Fläche `--kd-sunken`, Fokusring ungedämpft, Ausnahmen Ruhefläche und angehaktes Kästchen; Artboards D0002/D0003 `#sperrform`). Die Zeilennummern der Knöpfe in AK 19 sind durch Selektoren bzw. `data-act` ersetzt.
- **WBS-Heimat (Detailplanung 2026-11-13)**: eigene Interaction **I0135** unter D0002 (Board) mit den Features F0125 (Sperre am einen Schreibweg) und F0126 (Auslöser ohne Anfrage) und sechs Bubbles B0685–B0690; eigene Anforderung R00148. Die Härtungsregel (`AI-Team/gelerntes.md` 2026-11-11; Vorbilder I0134/R00147, I0127/R00138) verlangt das: I0005, I0009, I0012, I0037, I0052, I0092 sind **grün/abgenommen** — eine rote Folge-Bubble daran öffnete deren Abnahme. Elterndialog D0002, weil der Schreibweg jede schreibende Ansicht bedient (wie I0134).
- **Weiche (`befunde-einplanen`)**: **falsch gebaut** — der Slice hält die Zusage „jede Aktion ist ein Commit" (R00012, R00009 „kein Commit ohne Änderung") nicht; deshalb `/anforderung aus-bug` mit eigener Interaction. Kein Befund an einer Befundbehebung, kein Rückschritt eines Fixes.
- **Architektur (Karte #138, bestanden 2026-11-13, `architekt`)**: Technikfrage bereits entschieden → ADR-0025 Option A, Nachtrag N2 (`750172f`); kein neuer ADR. Der Review-Punkt aus ADR-0025 („ein schreibender Auslöser außerhalb des Verteilers, eine Sperre am Knoten statt im Zustand") gehört dem `code-reviewer` und dem `architektur-reviewer` (Label `architektur`).
- **Lesart der 600-ms-Probe**: die Karte verlangt „nur b ist abgehakt" auch beim zweiten Tipp nach 600 ms. ADR-0025 Regel 1 sichert das „solange die Anfrage läuft"; die Probe hält die Antwort deshalb (≥ 1 s) — ohne Halten wäre die Anfrage vorbei und der zweite Tipp eine **neue** Handlung, die wirken darf. Steht dahinter mehr (z. B. eine kurze Nachsperre über die Antwort hinaus), ist das eine eigene Entscheidung und nicht Teil dieser Anforderung (zur Kenntnis für die ux-/Architektur-Vorprüfung).
- **Zu #40/[R00138](R00138-fokus-trifft-nach-fremder-aenderung-dasselbe-element.md)** (Auftrag: „Vorher prüfen"): R00138 regelt den **Fokus** nach einer **fremden** Änderung über `data-halt` (I0127, grün) und grenzt die Adressierung des Löschens ausdrücklich aus; hier geht es um den **zweiten eigenen Auslöser**. Kein Konflikt, keine Vorarbeit zu übernehmen; `data-halt` bleibt unberührt, `data-arg` bleibt (ADR-0025 Regel 4).
- **Priorität**: Hoch — Datenverlust ohne Rückweg (#106: das Rückgängig deckt nur den zweiten Löschvorgang).
- **Betroffene Nutzer/Systeme**: jeder Mensch, der auf Board oder im Aufgabenfenster schnell zweimal auslöst (Doppelklick, Doppeltipp); mittelbar jeder Schreibweg der Oberfläche.
- **Workaround**: einzelne, bewusste Klicks; auf Touch langsam tippen.
- **Nicht Umfang**: zweiter Browser-Tab und gleichzeitig schreibender Agent (ADR-0025, akzeptierte Schwäche); hängende Anfrage (Karte #148); Gleichstand in `web/uebernahme.js` (Karte #82); das Kettenende (R00147, gebaut).
- **Verworfene Alternativen**: B (stabile Kennungen), C (optimistisch zeichnen), D (Deduplizierung) — je ein Satz unter „Alternative Ansätze".
- **Herkunft**: Karte #138; Volltexte in den archivierten Karten #106, #65, #95, #121 A2, #55, #134; `ursprungslauf: R00012` (Teilaufgaben abhaken — der Slice des Datenverlust-Falls).
