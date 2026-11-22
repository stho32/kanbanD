---
id: R00234
status: Neu
datum: 2026-11-22
---

# R00234: Laufansicht — Ergebnis und Dauer eines Laufs auf einen Blick

## Beschreibung

Karte #251, Scheibe A „Ergebnis und Dauer“ (Zuschnitt PO Z. 522; Scheibe B „Überblick und Navigation“ ist Karte #253). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N1 (`7f497216`), Punkte 1, 3, 4, 5 ohne Blättern, und 6. Produkt `AI-Team/po-entscheidungen.md` Z. 517–526 und 529. Zeichnung D0009 `#laufansicht`, freigegeben wie gezeichnet (Z. 524, `5d303b43`).

Wer einen Agentenlauf in der Laufansicht öffnet, sieht oben, wie lange der Lauf dauerte und wofür die Zeit verging (Werkzeuge, Denken, Warten). Er sieht auch, was der Lauf gemeldet hat (Ergebnis, Commits, Fehler, Kosten), und zwar bevor er einen Eintrag liest. Jeder Schritt trägt seine Dauer, und „Längste Schritte“ springt zu den drei längsten. Alles wird aus den gelesenen Einträgen gerechnet. Server, OpenAPI und das Format des Transkripts bleiben unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): In der Abnahme beantwortet die Laufansicht die zwei Fragen „War das ein sinnvolles Vorgehen?“ und „Was hat am längsten gedauert?“, ohne das Transkript von oben bis unten zu lesen.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

An #247 bestand der Planer-Lauf zu 270 von 330 s aus Denkzeit, der Entwickler-Lauf zu 72 von 77 min aus Wartebefehlen (ADR-0041 N1 „Belegt“). Bisher sah das in der Laufansicht niemand, ohne die Uhrzeiten von Hand abzuziehen. Mit dieser Scheibe steht es im Kopf der Seite, und der Bericht des Agenten steht vor dem ersten Eintrag.

## Funktionale Anforderungen

1. **Dauer** (N1 Punkt 1): Die Gesamtdauer ist die Summe der Lücken zwischen aufeinanderfolgenden Einträgen mit gültiger `zeit`. Eine negative Lücke zählt 0. Jede Lücke gehört dem späteren Eintrag. Vor einem `werkzeugergebnis` ist sie **Werkzeug**, vor einem Eintrag von `agent` **Denken**, vor einer Nachricht von `mensch` **Warten**. Ein Eintrag ohne gültige `zeit` hat keine Dauer, und die Lücke über ihn hinweg gehört dem nächsten Eintrag mit Zeit.
2. **Dauerform** (Z. 520 (1)), abgerundet auf ganze Sekunden: unter 1 s „< 1 s“, unter 60 s „<n> s“, ab 60 s „<m> min <s> s“, ab 1 h „<h> h <m> min“.
3. **Kopf** (Z. 520 (2)–(4), Z. 526): „Gesamtdauer“ mit dem Wert, darunter „Werkzeuge <Dauer> · Denken <Dauer> · Warten <Dauer>“. Ein Teil mit 0 ms entfällt (Z. 527). Weniger als zwei Einträge mit Zeit ergeben „Dauer unbekannt“ und darunter „Weniger als zwei Einträge tragen eine Zeit.“. Ist die Grenze erreicht, steht „mindestens <Dauer>“ und darunter „gerechnet bis zur Grenze des Transkripts“ mit der Aufteilung. Ohne gelesene Einträge (lädt, liegt nicht auf diesem Rechner, Lesen gescheitert) steht „–“.
4. **Kennzahlen** (Z. 520 (6), Z. 525, 526): „Ergebnis“, „Werkzeugaufrufe“, „Fehler erkannt“, „Commits“ und „Kosten“. Ein fehlender Wert ist „–“. „Kosten“ kommt aus dem Kosteneintrag der Karte mit derselben Kennung, live. Die Leiste zeigt keinen „Betrag“ mehr. Die Spalte „Betrag“ der Liste „Läufe“ bleibt.
5. **Bericht zuerst** (N1 Punkt 5, Z. 520 (7)): Der Bericht ist der letzte Eintrag von `agent`, dessen Text eine Zeile `^Ergebnis: (bestanden|befund|blockiert)` trägt. Bei einem Aufruf werden die Textwerte seines JSON-Objekts durchsucht. Er steht als Karte „Bericht“ über den Einträgen und ist selbst kein Eintrag. „Commits“ zählt die Kennungen `\b[0-9a-f]{7,40}\b` in seiner Zeile `^Commits:`, dabei ergibt „keine“ den Wert 0. Ohne Bericht steht gedämpft „Kein Bericht erkannt: Keine Nachricht des Agenten enthält eine Zeile „Ergebnis:“.“.
6. **Werkzeugzeile** (N1 Punkt 3, Z. 519): Ein Ergebnis gehört zum ältesten offenen Aufruf. Aufruf und Ergebnis bilden eine Zeile an der Stelle des Aufrufs. Sie zeigt den Werkzeugnamen, den Kurzbefehl in Festbreitenschrift, darunter klein die Absicht (`description`, fehlt sie, entfällt die Zeile ohne Platzhalter), das Ergebnis-Kürzel und die Dauer `zeit(Ergebnis) − zeit(Aufruf)`. Kommt ein Aufruf vor dem Ergebnis eines anderen, tragen beide die Marke „parallel“. Ein Aufruf ohne Ergebnis und ein Ergebnis ohne Aufruf stehen je allein mit „–“. Aufgeklappt stehen Aufruf und Ergebnis ganz, wie heute.
7. **Fehler** (N1 Punkt 4): Ein Ergebnis ist ein Fehler, wenn seine erste Zeile `Exit code <n>` mit n ≠ 0 lautet oder sein Text mit `<tool_use_error>` beginnt. Die Werkzeugzeile steht dann rot mit Warnzeichen und zählt in „Fehler erkannt“.
8. **Denk- und Wartezeilen** (Z. 518, Z. 520 (5)): Eine Lücke der Art Denken oder Warten ab 5.000 ms steht als eigene Zeile vor ihrem Eintrag: „<Dauer> denkt“ bzw. „<Dauer> wartet“. Die Schwelle ist eine Konstante in `web/lauf.js` und steht nicht in der Oberfläche.
9. **Eingeklappt** (N1 Punkt 5, Z. 520 (10)): Der Auftrag (erste Nachricht von `mensch`) und jeder Systemhinweis (Nachricht von `mensch`, deren Text ohne führenden Leerraum mit `<system-reminder>` oder `[SYSTEM NOTIFICATION` beginnt) stehen eingeklappt an ihrer Stelle, beschriftet „Auftrag“ bzw. „Systemhinweis“.
10. **Längste Schritte** (N1 Punkt 1): Die drei längsten Schritt-, Denk- und Wartezeilen stehen nach Dauer geordnet, bei Gleichstand die frühere zuerst. Jede ist ein Knopf, der zur Zeile springt und ihr den Fokus gibt, ohne die Adresse zu ändern. Ohne Dauer („Dauer unbekannt“) entfällt die Liste.
11. **Einmal rechnen** (N1 Punkt 6): Die Auswertung läuft einmal je erfolgreichem Lesen. Ein Live-Ereignis zeichnet Kopf und Kennzahlen aus ihr und aus der Karte neu, ohne sie neu zu rechnen. Die Einträge bleiben die Insel (R00221 FA 9).

## Nicht-funktionale Anforderungen

- **Leistung** (N1 Punkt 6, ADR-0041 Q5): Die Auswertung ist ein Durchlauf (O(n)). Für echte Läufe liegt die Zeit von der Antwort bis zum Bild unter 300 ms. Das ist eine Beobachtung im Bericht, kein Gate und ein Tag-Kriterium (8–21 Uhr, Last ≤ 2, `nice -n 10`). Die Messprobe des architekt ergab 38–61 ms für 20.000 Zeilen.
- **Sicherheit** (Review-Punkt N1): Bericht, Kurzbefehl, Absicht und Ergebnis-Kürzel gehen dieselben Wege wie bisher: `sichtbarText` mit Budget, danach `markdownHtml` bzw. Maskieren (R00221 FA 10).
- **Zugänglichkeit**: Ein Fehler ist nie nur an der Farbe zu erkennen. Es gibt genau eine Ansage wie in R00221 FA 11, und Kopf und Kennzahlen sagen nichts zusätzlich an.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00221: gz-Dateien erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/1/transkripte` ab, Kosten über `POST /api/aufgaben/1/kosteneintraege`). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, Board `fabrik` mit `record-transcripts: true`, Aufgabe #1:

| Lauf | Kennung | Transkript | Kosteneintrag |
|---|---|---|---|
| T1 | `planer@2026-11-21T23:30+01:00` | die 15 Einträge unten | 1,79 USD |
| T3 | `entwickler@2026-11-21T08:00+01:00` | 20.001 Zeilen, Zeile k mit `zeit` 08:00:00 + (k − 1) s: ungerade Zeilen ein Aufruf `Bash` von `agent`, gerade sein Ergebnis; Zeile 20.001 ist eine Nachricht von `agent` mit „Ergebnis: bestanden“ | — |
| T4 | `architekt@2026-11-21T23:40+01:00` | Aufruf `Bash` mit `zeit` 23:40:00+01:00, Ergebnis „Exit code 0“ ohne `zeit`, Nachricht von `agent` „fertig“ mit `zeit` „gestern“ | — (in AK 10 gebucht: 0,51 USD) |
| T5 | `code-reviewer@2026-11-21T22:00+01:00` | danach im Ordner gelöscht → `fehlt` | 0,42 USD |

**T1** (Zeit 2026-11-21, Versatz +01:00; Text der Aufrufe als JSON):

| Nr | art · wer | zeit | Inhalt |
|---|---|---|---|
| 1 | nachricht · mensch | 23:30:00.000 | „Projekt: kanbanD · Karte: #247“ (Auftrag) |
| 2 | nachricht · mensch | 23:30:01.000 | „&lt;system-reminder&gt;Lies zuerst …“ |
| 3 | aufruf · agent `Bash` | 23:30:22.000 | `{"command":"ls Anforderungen \| tail -2","description":"Nächste freie Nummer"}` |
| 4 | ergebnis · werkzeug | 23:30:26.000 | „R00228-wackler-unter-last.md“ + zweite Zeile |
| 5 | aufruf · agent `Bash` | 23:30:30.999 | `{"command":"grep -n kd-muted web/laeufe.js"}` (ohne Absicht) |
| 6 | ergebnis · werkzeug | 23:30:31.999 | „Exit code 1“ |
| 7 | aufruf · agent `Read` | 23:30:36.999 | `{"file_path":"a.md"}` |
| 8 | aufruf · agent `Read` | 23:30:37.499 | `{"file_path":"b.md"}` |
| 9 | ergebnis · werkzeug | 23:30:39.499 | „1→# a“ |
| 10 | ergebnis · werkzeug | 23:30:40.499 | „&lt;tool_use_error&gt;File does not exist.&lt;/tool_use_error&gt;“ |
| 11 | aufruf · agent `Bash` | ohne | `{"command":"git status --short","description":"Arbeitsbaum prüfen"}` |
| 12 | ergebnis · werkzeug | 23:30:45.499 | „kein error gefunden“ |
| 13 | nachricht · mensch | 23:31:50.499 | „Bitte weiter.“ |
| 14 | nachricht · agent | 23:31:52.000 | „Zwischenstand, Ergebnis: befund mitten im Satz.“ |
| 15 | aufruf · agent `SubagentHandback` | 23:32:30.000 | `{"message":"R00229 angelegt.\nErgebnis: bestanden\nCommits: f9e808a6 [DOC] R00229 · Arbeitsbaum sauber: ja"}` |

**Rechenbeispiel T1** (geprobt gegen die Regel aus FA 1): Werkzeug = 4 (vor 4) + 1 (vor 6) + 2 (vor 9) + 1 (vor 10) + 5 (vor 12, über Nr 11 ohne Zeit) = **13 s**. Denken = 21 (vor 3) + 4,999 (vor 5) + 5,000 (vor 7) + 0,5 (vor 8) + 1,501 (vor 14) + 38 (vor 15) = **71 s**. Warten = 1 (vor 2) + 65 (vor 13) = **66 s**. Summe 150 s = 23:30:00 bis 23:32:30. Paare nach der Warteschlange: 3↔4 (4 s), 5↔6 (1 s), 7↔9 (2,5 s → „2 s“), 8↔10 (3 s), 11↔12 („–“), 15 ohne Ergebnis („–“).

### Kopf und Kennzahlen

- [ ] **AK 1 Gesamtdauer und Aufteilung:** Gegeben die Laufansicht von T1, dann steht „Gesamtdauer“ mit „2 min 30 s“ und darunter „Werkzeuge 13 s · Denken 1 min 11 s · Warten 1 min 6 s“. Die Dauerform ist in Node an `dauerText` geprobt, mit den Werten 0 → „< 1 s“, 999 → „< 1 s“, 1.000 → „1 s“, 4.999 → „4 s“, 59.999 → „59 s“, 60.000 → „1 min 0 s“, 71.000 → „1 min 11 s“, 3.599.999 → „59 min 59 s“, 3.600.000 → „1 h 0 min“ und 3.725.000 → „1 h 2 min“. Eine negative Lücke zählt in Node 0, und ein Lauf nur aus Werkzeug und Denken zeigt kein „Warten“.
- [ ] **AK 2 Kopf in den Sonderfällen:** Gegeben T3, dann steht „mindestens 5 h 33 min“ (19.999 s über die 20.000 gelesenen Einträge), darunter „gerechnet bis zur Grenze des Transkripts“ und „Werkzeuge 2 h 46 min · Denken 2 h 46 min“ (10.000 s und 9.999 s). Gegeben T4, dann steht „Dauer unbekannt“ mit „Weniger als zwei Einträge tragen eine Zeit.“, es gibt weder eine Aufteilung noch „Längste Schritte“, und jede Zeile zeigt „–“. Gegeben T5 (`fehlt`), T1 mit 503 per `page.route` oder T1 mit gehaltener Antwort, dann zeigen Gesamtdauer, Ergebnis, Werkzeugaufrufe, Fehler erkannt und Commits je „–“, und „Kosten“ zeigt den Betrag der Karte (T5 „0,42 $“, T1 „1,79 $“). Der Satz des Zustands steht darunter wie bisher.
- [ ] **AK 3 Kennzahlen:** Gegeben T1, dann zeigen Ergebnis „bestanden“, Werkzeugaufrufe „6“, Fehler erkannt „2“, Commits „1“ und Kosten „1,79 $“. Gegeben T4, dann zeigen Ergebnis „–“ (vorgelesen „kein Bericht erkannt“), Werkzeugaufrufe „1“, Fehler erkannt „0“, Commits „–“ und Kosten „–“. Die Leiste nennt in keinem Lauf einen „Betrag“, und die Liste „Läufe“ zeigt bei T1 weiter „1,79 $“ in der Spalte „Betrag“.

### Bericht und Einträge

- [ ] **AK 4 Bericht zuerst:** Gegeben T1, dann steht vor dem ersten Eintrag die Karte „Bericht“ mit dem Text aus Nr 15 („R00229 angelegt.“, „Ergebnis: bestanden“, „Commits: f9e808a6 …“). Nr 14 („Ergebnis: befund“ mitten im Satz) ist nicht der Bericht. Die Karte liegt außerhalb der Liste der Einträge (`ol` der Insel), damit ein Filter der Einträge sie nicht verbergen kann. Die Probe unter „nur Fehler“ trägt Karte #253 (Z. 529). Gegeben T3 und T4, dann steht an ihrer Stelle gedämpft „Kein Bericht erkannt: Keine Nachricht des Agenten enthält eine Zeile „Ergebnis:“.“; bei T3 liegt der Bericht hinter der Grenze. In Node gilt: „Commits: keine“ ergibt 0, ein Bericht in einer Nachricht wird ebenso erkannt wie im JSON eines Aufrufs, und `Ergebnis:` nur mitten in einer Zeile wird nicht erkannt.
- [ ] **AK 5 Werkzeugzeile mit Befehl und Absicht:** Gegeben T1, dann ist Nr 3 mit Nr 4 eine Zeile mit „Bash“, dem Befehl „ls Anforderungen | tail -2“ in Festbreitenschrift, darunter „Nächste freie Nummer“, dem Kürzel „R00228-wackler-unter-last.md“ und „4 s“. Nr 4 steht nicht als eigene Zeile da. Nr 5 hat keine zweite Zeile und keinen Platzhalter. Nr 7 und Nr 8 tragen „parallel“ mit „2 s“ bzw. „3 s“. Nr 11 und Nr 15 zeigen „–“. Aufgeklappt zeigt Nr 3 den Aufruf und das Ergebnis ganz. Ein Befehl mit erster Zeile aus 250 Zeichen zeigt höchstens 200 davon und „…“ (wie R00221 AK 6). In Node liefert `kurzbefehl` bei JSON mit `command` den Befehl, bei Text ohne JSON dessen erste Zeile und bei JSON ohne bekannten Schlüssel die erste Zeile des ersten Textwerts.
- [ ] **AK 6 Fehler rot:** Gegeben T1, dann stehen die Zeilen von Nr 5 („Exit code 1“) und Nr 8 (`<tool_use_error>`) in der Fehlerform mit Warnzeichen, und die Textalternative des Warnzeichens nennt den Fehler. Die Zeilen von Nr 3 und Nr 11 („kein error gefunden“) stehen nicht so. In Node ist „Exit code 0“ kein Fehler, „Exit code 2“ einer, „error“ mitten im Text keiner und `<tool_use_error>` am Anfang einer.
- [ ] **AK 7 Denk- und Wartezeilen ab 5 s:** Gegeben T1, dann stehen genau vier solche Zeilen: „21 s denkt“ vor Nr 3, „5 s denkt“ vor Nr 7 (genau 5.000 ms), „1 min 5 s wartet“ vor Nr 13 und „38 s denkt“ vor Nr 15. Vor Nr 5 (4.999 ms), Nr 2 (1 s) und Nr 14 (1,501 s) steht keine.
- [ ] **AK 8 Auftrag und Systemhinweise eingeklappt:** Gegeben T1, dann steht Nr 1 eingeklappt als „Auftrag“ und Nr 2 eingeklappt als „Systemhinweis“, beide an ihrer Stelle und aufklappbar. Nr 13 („Bitte weiter.“) steht offen. In Node ist eine Nachricht von `mensch` mit „  [SYSTEM NOTIFICATION …“ (führender Leerraum) ein Systemhinweis. Eine mit „Hinweis: &lt;system-reminder&gt;“ ist keiner.

### Springen, Live und Darstellung

- [ ] **AK 9 Längste Schritte:** Gegeben T1, dann zeigt „Längste Schritte“ der Reihe nach „1 min 5 s“ (wartet, vor Nr 13), „38 s“ (denkt, vor Nr 15) und „21 s“ (denkt, vor Nr 3). Eine Denk- oder Wartezeile nennt den Schritt dahinter („denkt · vor …“). Gegeben T3, dann sind es die Schritte der Zeilen 1, 3 und 5, je „1 s“ (Gleichstand, die frühere zuerst). Wählt `sh` den ersten Eintrag mit Klick oder Enter, dann steht die Wartezeile vor Nr 13 im sichtbaren Bereich und hat den Fokus. `location.hash` und `history.length` bleiben gleich.
- [ ] **AK 10 Live, Breite, Zugänglichkeit:** Gegeben die Laufansicht von T4 mit der Marke `el.__probe = 1` an der Insel, wenn ein Kosteneintrag `architekt` 2026-11-21T23:40+01:00 über 0,51 USD gebucht wird, dann zeigt „Kosten“ „0,51 $“ ohne neues `GET …/transkripte/…`. Die Insel trägt die Marke noch, und `laufAuswerten` lief genau einmal (Zähler). Gegeben T1 mit einem Befehl aus 45.000 Zeichen, dann gilt bei 320, 641, 980 und 1280 px, hell und dunkel, `scrollWidth ≤ clientWidth` an Dokument und Bildlaufbehälter. Text und Kennzahlen stehen ≥ 4,5:1, die Fehlerzeile auch auf ihrer Fläche. Die Knöpfe von „Längste Schritte“ sind bei grobem Zeiger ≥ 48 px hoch. Der Statusbereich sagt je Ergebnis genau einmal an wie in R00221 AK 10 (`MutationObserver`).

## Betroffene Verzeichnisstruktur

- `web/lauf.js`: Auswertung und Zeichnen der Einträge, rein, in Browser und Node (wie heute).
- `web/laeufe.js`: Leiste ohne „Betrag“.
- `web/app.js`: nur Aufruf der Auswertung einmal je Lesen, Ablage in `S.ui.lauf` und Sprung über `act`. Hier wird keine Dauer gerechnet (Review-Punkt N1).
- `web/kd-app.css`: Formen nach `#laufansicht` mit Tokens aus `web/kd-tokens.css`, keine neue Farbe.
- Tests: `e2e/einheit/lauf.test.js` und `lauf-zeichnen.test.js` (Node), `e2e/tests/r00234-laufansicht-ergebnis-und-dauer.spec.js` (E2E), Hilfen aus `e2e/tests/laufansicht-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **Auswerten, rein** (B1206–B1208): Gelesene Zeilen → `laufAuswerten(zeilen)` → `{gesamt, werkzeug, denken, warten, bekannt, grenze, schritte: [{nr, art, dauer, parallel, fehler, befehl, absicht, kuerzel}], luecken: [{vorNr, art, dauer}], top3, bericht, kennzahlen}`, in einem Durchlauf.
   - 1.1 Lücken und Arten, `dauerText(ms)`
   - 1.2 Warteschlange der offenen Aufrufe, `kurzbefehl(text) → {befehl, absicht}`, `fehlerErkennen(text)`
   - 1.3 `berichtFinden(zeilen)`, Zählen der Commits, Top 3
2. **Zeichnen** (B1209–B1211): Auswertung + Karte → Kopf mit Kennzahlen, Karte „Bericht“ vor der Insel, Zeilen in der Insel (`id="lv-s<Zeilennummer>"`, `tabindex="-1"`), „Längste Schritte“ als Knöpfe mit `data-act`.
3. **Messen und nachziehen** (B1212), danach **Probe im echten Programm, Mutanten, Gate** (B1213).

### Grobentwurf

**Einstiegsstellen:** `laufLesen` in `web/app.js:1940` (nach erfolgreichem Lesen einmal auswerten), das Zeichnen der Seite in `web/app.js:2056` (Kopf neben `laeufeLeisteHtml`) und `laufHtml` in `web/lauf.js:128` (Zeilen der Insel).

- `laufAuswerten(zeilen, grenze)` (rein) — liefert die Auswertung oben. Die Schwelle `DENKZEILE_AB_MS = 5000` ist eine Konstante.
- `dauerText(ms)` (rein) — liefert die Dauerform aus FA 2.
- `kurzbefehl(text)` (rein) — liefert `{befehl, absicht}` nach N1 Punkt 3.
- `fehlerErkennen(text)` (rein) — liefert wahr nach N1 Punkt 4.
- `berichtFinden(zeilen)` (rein) — liefert `{text, ergebnis, commits} | null` nach N1 Punkt 5.
- `laufKopfHtml(auswertung, kosten, esc)` (rein) — zeichnet Kopf und Kennzahlen, auch für den Zustand ohne Auswertung („–“).
- `laufHtml(zeilen, grenze, esc, auswertung)` — gepaarte Zeilen sowie Denk- und Wartezeilen. Auftrag und Systemhinweis stehen als `details`.

### Hinweise

- Die Auswertung liegt in `S.ui.lauf` neben dem Text der Insel. Bei Live wird sie nie neu gerechnet (AK 10, Zähler).
- Der Sprung nimmt `scrollIntoView` und `focus()`, nie `href="#…"`, denn der Hash ist die Adresse (ADR-0029).
- Werkzeug, Denken und Warten haben in Kopf, Zeilen und später in der Legende von B dieselben Namen (Z. 520 Begründung).

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node):** die Proben aus ADR-0041 N1 „Durchsetzung“ wörtlich. Werkzeug + Denken + Warten = Gesamtdauer, bei `A A E E` ohne Doppelzählung. Fehlende und falsch geformte `zeit`, eine negative Lücke, weniger als zwei Zeitpunkte. Ein Ergebnis ohne Aufruf, ein Aufruf ohne Ergebnis. Denkzeile bei 5.000 und 4.999 ms. Top 3 mit Gleichstand. `fehlerErkennen`, Bericht und `kurzbefehl` nach AK 4–6. Dazu T1 als Ganzes gegen das Rechenbeispiel.
- **E2E (Chromium, headless):** AK 1–10 mit T1, T3, T4 und T5. Antworten werden per `page.route` gehalten und über ein Promise freigegeben. Verneinungen stehen erst nach einem sichtbaren Signal.
- **Mutanten** (eigene Kopie, nicht im Worktree), je von einem benannten Test getötet:
  - m1 Lücke dem früheren Eintrag zugeordnet → AK 1 rot
  - m2 Schwelle `>` statt `≥` 5.000 ms → AK 7 rot
  - m3 Fehler über Suche nach „error“ → AK 6 rot (Nr 12)
  - m4 Paaren mit dem jüngsten offenen Aufruf → AK 5 rot (7 und 8 vertauscht)
  - m5 Bericht nur aus Nachrichten → AK 4 rot
  - m6 Bericht als Eintrag in der Liste → AK 4 rot
  - m7 Sprung über `href="#lv-s…"` → AK 9 rot
  - m8 Auswertung bei Live neu gerechnet → AK 10 rot
- **Regression:** `r00221-laufansicht.spec.js` folgt dem Nachtrag in R00221 (Leiste ohne Betrag, gepaarte Zeilen), sonst bleiben alle Erwartungen.

## Abhängigkeiten

- Abhängig von: [R00221](R00221-laufansicht-transkript-eines-agentenlaufs-lesen.md) (I0211, Laufansicht, Insel, Grenze, Zustände); [R00219](R00219-ansicht-laeufe-im-aufgabenfenster.md) (I0209, `laeufe()` mit Kosten je Kennung); Zeichnung D0009 `#laufansicht` (Z. 524).
- Blockiert: Karte #253 Scheibe B „Überblick und Navigation“ (Zeitachse, Gliederung mit Filtern, Blättern; `braucht:251`).

## Offene Fragen

1. **Lücke vor einem Eintrag ohne Art nach FA 1** (an den architekt, blockiert nicht). Das gilt für eine Nachricht von `werkzeug` oder einen Aufruf von `mensch`. N1 Punkt 1 ordnet nur Ergebnis, `agent` und Nachricht von `mensch` zu, verlangt aber, dass die drei Teile genau die Gesamtdauer ergeben. Empfehlung, gilt bis zur Antwort: Zugeordnet wird nach `wer`, also `werkzeug` → Werkzeug, `agent` → Denken, `mensch` → Warten. Ein Ergebnis zählt immer als Werkzeug.
2. **Textalternative des Warnzeichens an der Fehlerzeile** (an die UX-Vorprüfung, blockiert nicht). Empfehlung: „Fehler“, vorgelesen vor dem Werkzeugnamen.

## Manuelle Vorbereitungstätigkeiten

- Beobachtung Tempo tagsüber einplanen (8–21 Uhr, Last ≤ 2).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 nachführen (Auswertung in `web/lauf.js`, Kopf aus Auswertung und Karte).
- Factory: Kosten je Lauf mit der Kennung des Transkripts buchen (N1 Folgeaufgabe, Vorschlag des Directors `c9c7b24`). Ohne diese Buchung zeigt „Kosten“ an echten Karten „–“.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Lauf an #247: Wer prüfte, sah 534 Einträge mit Uhrzeiten, aber keine Dauer. Dass 270 von 330 s Denkzeit waren, fand nur, wer rechnete. Diese Anforderung rechnet die Lücken einmal aus den gelesenen Einträgen und ordnet jede genau einer Art zu. Daraus ergeben sich die Gesamtdauer und die Aufteilung im Kopf, die Dauer an jeder Zeile und die drei längsten Schritte. Wer abnimmt, sieht damit in einem Blick, wofür die Zeit verging, und springt mit einem Klick dorthin. Der Bericht über den Einträgen und die gepaarte Zeile mit Befehl und Absicht beantworten die zweite Frage („sinnvolles Vorgehen?“), denn Meldung und Tat stehen nebeneinander. Der Hebel liegt in der Auswertung im Browser und nicht in einem neuen Feld am Format: Der Erzeuger kennt weder Dauer noch Abschnitte, und Altbestand bliebe sonst leer (N1 Option F).

## Notizen

- **Grenze zu Scheibe B (#253):** Die Zeitachse, die Filter „Nachrichten“, „Werkzeuge“, „Systemhinweise“ und „nur Fehler“ und das Blättern gehören nicht hierher. Ohne B steht „Längste Schritte“ allein in der linken Spalte (Notiz der Zeichnung). Auftrag und Systemhinweise stehen in A eingeklappt an ihrer Stelle, die Filter kommen mit B. Dass der Bericht unter „nur Fehler“ stehen bleibt (Z. 529), sichert A durch den Aufbau ab (AK 4: Die Karte liegt nicht in der Liste der Einträge). Die Probe mit dem Filter gehört in die Anforderung von #253, weil es den Filter vorher nicht gibt.
- **Verworfene Alternativen** (N1): Abschnitte abzuleiten (R) oder als neues Feld zu führen (F) ist verworfen, Z. 517. Kosten über den Text von `cost.items` zuzuordnen ist brüchig und verworfen.
- **Zehn Kriterien** (Schlank arbeiten). Weitere Grenzfälle der Paarung gehören dem entwickler.
